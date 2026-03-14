use crate::manager::CdpSessionHandle;
use crate::types::BrowserPageInfo;
use chrono::Utc;
use serde_json::{json, Value};
use std::time::Duration;

const DEFAULT_ACTION_TIMEOUT_MS: u64 = 15_000;

pub async fn execute_action(
    session: &CdpSessionHandle,
    action: &str,
    args: Value,
) -> Result<Value, String> {
    match action {
        "navigate" => navigate(session, &args).await,
        "click" => click(session, &args).await,
        "type" | "form_input" => type_text(session, &args).await,
        "scroll" | "scroll_page" => scroll(session, &args).await,
        "refresh_page" => evaluate_navigation(session, "window.location.reload()").await,
        "go_back" => evaluate_navigation(session, "window.history.back()").await,
        "go_forward" => evaluate_navigation(session, "window.history.forward()").await,
        "get_page_info" | "read_page" | "get_page_text" => {
            let page = session.capture_page_info().await?;
            Ok(json!({
                "tab": {
                    "id": session.state().await.target_id,
                    "title": page.title,
                    "url": page.url,
                },
                "markdown": page.markdown,
                "page_info": page,
            }))
        }
        "read_console_messages" => {
            let events =
                session.collect_console_messages(args.get("since").and_then(Value::as_u64));
            Ok(json!({ "messages": events }))
        }
        "read_network_requests" => {
            let events = session.collect_network_events(args.get("since").and_then(Value::as_u64));
            Ok(json!({ "events": events }))
        }
        _ => Err(format!("CDP 直连不支持动作: {action}")),
    }
}

async fn navigate(session: &CdpSessionHandle, args: &Value) -> Result<Value, String> {
    let nav_action = get_string_arg(args, &["action"]).unwrap_or_else(|| "goto".to_string());
    if nav_action != "goto" {
        return Err(format!(
            "CDP 直连当前仅支持 navigate.action=goto，收到: {nav_action}"
        ));
    }
    let url = get_string_arg(args, &["url"]).ok_or_else(|| "navigate 需要提供 url".to_string())?;
    session
        .send_command(
            "Page.navigate",
            json!({ "url": url }),
            DEFAULT_ACTION_TIMEOUT_MS,
        )
        .await?;
    tokio::time::sleep(Duration::from_millis(1200)).await;
    let page = session
        .capture_page_info()
        .await
        .unwrap_or(BrowserPageInfo {
            title: url.clone(),
            url: url.clone(),
            markdown: format!("# {}\nURL: {}", url, url),
            updated_at: Utc::now().to_rfc3339(),
        });
    Ok(json!({
        "url": url,
        "page_info": page,
    }))
}

async fn click(session: &CdpSessionHandle, args: &Value) -> Result<Value, String> {
    if let (Some(x), Some(y)) = (
        args.get("x").and_then(Value::as_f64),
        args.get("y").and_then(Value::as_f64),
    ) {
        session
            .send_command(
                "Input.dispatchMouseEvent",
                json!({
                    "type": "mousePressed",
                    "x": x,
                    "y": y,
                    "button": "left",
                    "clickCount": 1,
                }),
                DEFAULT_ACTION_TIMEOUT_MS,
            )
            .await?;
        session
            .send_command(
                "Input.dispatchMouseEvent",
                json!({
                    "type": "mouseReleased",
                    "x": x,
                    "y": y,
                    "button": "left",
                    "clickCount": 1,
                }),
                DEFAULT_ACTION_TIMEOUT_MS,
            )
            .await?;
        return Ok(json!({ "clicked": true, "x": x, "y": y }));
    }

    let selector = get_string_arg(args, &["selector", "target", "ref_id"])
        .ok_or_else(|| "click 需要 selector 或坐标".to_string())?;
    session
        .runtime_evaluate(
            format!(
                r#"
(() => {{
  const element = document.querySelector({selector});
  if (!element) {{
    return {{ ok: false, error: "未找到元素" }};
  }}
  element.click();
  return {{ ok: true }};
}})()
"#,
                selector = serde_json::to_string(&selector)
                    .map_err(|e| format!("编码 selector 失败: {e}"))?
            ),
            true,
            DEFAULT_ACTION_TIMEOUT_MS,
        )
        .await?;
    Ok(json!({ "clicked": true, "selector": selector }))
}

async fn type_text(session: &CdpSessionHandle, args: &Value) -> Result<Value, String> {
    let text = get_string_arg(args, &["text", "value"])
        .ok_or_else(|| "type 需要 text/value 参数".to_string())?;
    if let Some(selector) = get_string_arg(args, &["selector", "target", "ref_id"]) {
        session
            .runtime_evaluate(
                format!(
                    r#"
(() => {{
  const element = document.querySelector({selector});
  if (!element) {{
    return {{ ok: false, error: "未找到输入元素" }};
  }}
  element.focus();
  if ("value" in element) {{
    element.value = {text};
    element.dispatchEvent(new Event("input", {{ bubbles: true }}));
    element.dispatchEvent(new Event("change", {{ bubbles: true }}));
  }} else {{
    element.textContent = {text};
  }}
  return {{ ok: true }};
}})()
"#,
                    selector = serde_json::to_string(&selector)
                        .map_err(|e| format!("编码 selector 失败: {e}"))?,
                    text =
                        serde_json::to_string(&text).map_err(|e| format!("编码文本失败: {e}"))?,
                ),
                true,
                DEFAULT_ACTION_TIMEOUT_MS,
            )
            .await?;
        return Ok(json!({ "typed": true, "selector": selector }));
    }

    session
        .send_command(
            "Input.insertText",
            json!({
                "text": text,
            }),
            DEFAULT_ACTION_TIMEOUT_MS,
        )
        .await?;
    Ok(json!({ "typed": true }))
}

async fn scroll(session: &CdpSessionHandle, args: &Value) -> Result<Value, String> {
    let direction = get_string_arg(args, &["direction"]).unwrap_or_else(|| "down".to_string());
    let amount = args
        .get("amount")
        .and_then(Value::as_i64)
        .unwrap_or(500)
        .max(1);
    let signed_amount = if direction.eq_ignore_ascii_case("up") {
        -amount
    } else {
        amount
    };
    if let Some(selector) = get_string_arg(args, &["selector", "target", "ref_id"]) {
        session
            .runtime_evaluate(
                format!(
                    r#"
(() => {{
  const element = document.querySelector({selector});
  if (!element) {{
    return {{ ok: false, error: "未找到滚动元素" }};
  }}
  element.scrollBy({{ top: {amount}, behavior: "instant" }});
  return {{ ok: true }};
}})()
"#,
                    selector = serde_json::to_string(&selector)
                        .map_err(|e| format!("编码 selector 失败: {e}"))?,
                    amount = signed_amount,
                ),
                true,
                DEFAULT_ACTION_TIMEOUT_MS,
            )
            .await?;
        return Ok(json!({ "scrolled": true, "selector": selector, "amount": signed_amount }));
    }

    session
        .runtime_evaluate(
            format!("window.scrollBy({{ top: {signed_amount}, behavior: \"instant\" }});"),
            false,
            DEFAULT_ACTION_TIMEOUT_MS,
        )
        .await?;
    Ok(json!({ "scrolled": true, "amount": signed_amount }))
}

async fn evaluate_navigation(session: &CdpSessionHandle, script: &str) -> Result<Value, String> {
    session
        .runtime_evaluate(script.to_string(), false, DEFAULT_ACTION_TIMEOUT_MS)
        .await?;
    tokio::time::sleep(Duration::from_millis(800)).await;
    let page = session.capture_page_info().await?;
    Ok(json!({ "page_info": page }))
}

fn get_string_arg(args: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        args.get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    })
}
