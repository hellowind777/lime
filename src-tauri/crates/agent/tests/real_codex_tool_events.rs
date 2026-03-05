use futures::StreamExt;
use proxycast_agent::{
    convert_agent_event, AsterAgentState, SessionConfigBuilder, TauriAgentEvent,
};
use proxycast_core::database::dao::api_key_provider::ApiProviderType;
use proxycast_core::database::init_database;
use proxycast_services::api_key_provider_service::ApiKeyProviderService;
use uuid::Uuid;

fn should_run_real_test() -> bool {
    std::env::var("PROXYCAST_REAL_API_TEST").ok().as_deref() == Some("1")
}

fn resolve_model_name(
    explicit: Option<String>,
    provider_models: &[String],
) -> Result<String, String> {
    if let Some(model) = explicit
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(model.to_string());
    }

    if let Some(model) = provider_models
        .iter()
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
    {
        return Ok(model.to_string());
    }

    Err(
        "未找到可用模型：请设置 PROXYCAST_REAL_MODEL，或在 Provider custom_models 中配置模型。"
            .to_string(),
    )
}

fn resolve_codex_provider_and_model(
    db: &proxycast_core::database::DbConnection,
) -> Result<(String, String), String> {
    let explicit_model = std::env::var("PROXYCAST_REAL_MODEL").ok();

    if let Ok(explicit) = std::env::var("PROXYCAST_REAL_PROVIDER_ID") {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            let service = ApiKeyProviderService::new();
            let provider = service
                .get_provider(db, trimmed)?
                .ok_or_else(|| format!("未找到指定 Provider: {trimmed}"))?;
            let model = resolve_model_name(explicit_model, &provider.provider.custom_models)?;
            return Ok((trimmed.to_string(), model));
        }
    }

    let service = ApiKeyProviderService::new();
    let providers = service.get_all_providers(db)?;
    providers
        .into_iter()
        .find(|item| {
            item.provider.enabled
                && item.provider.provider_type == ApiProviderType::Codex
                && item.api_keys.iter().any(|key| key.enabled)
        })
        .map(|item| {
            let model = resolve_model_name(explicit_model, &item.provider.custom_models)?;
            Ok::<_, String>((item.provider.id, model))
        })
        .transpose()?
        .ok_or_else(|| "未找到启用且含可用 Key 的 Codex Provider".to_string())
}

#[tokio::test]
#[ignore = "真实联网测试：设置 PROXYCAST_REAL_API_TEST=1 后执行"]
async fn test_real_codex_stream_emits_tool_events() {
    if !should_run_real_test() {
        return;
    }

    let db = init_database().expect("初始化数据库失败");
    let (provider_id, model_name) =
        resolve_codex_provider_and_model(&db).expect("解析 Codex Provider/模型失败");
    let session_id = format!("real-codex-tool-{}", Uuid::new_v4());

    let state = AsterAgentState::new();
    state
        .configure_provider_from_pool(&db, &provider_id, &model_name, &session_id)
        .await
        .expect("配置 Provider 失败");

    let agent_arc = state.get_agent_arc();
    let agent_guard = agent_arc.read().await;
    let agent = agent_guard.as_ref().expect("Agent 未初始化");

    let tools = agent.list_tools(None).await;
    assert!(
        !tools.is_empty(),
        "工具列表为空，无法验证 tool_start/tool_end"
    );

    let preferred_tool = tools
        .iter()
        .map(|tool| tool.name.to_string())
        .find(|name| name.contains("list_tools"))
        .unwrap_or_else(|| "bash".to_string());

    let prompt = if preferred_tool == "bash" {
        "请严格执行以下步骤：\
1) 必须调用工具 bash，执行命令 `echo PROXYCAST_REAL_TOOL_EVENT`; \
2) 然后只回复 `REAL_TOOL_OK`。"
            .to_string()
    } else {
        format!(
            "请严格执行以下步骤：\
1) 必须调用工具 `{}` 一次；\
2) 如果需要参数请传空对象；\
3) 然后只回复 `REAL_TOOL_OK`。",
            preferred_tool
        )
    };

    let user_message = aster::conversation::message::Message::user().with_text(prompt);
    let session_config = SessionConfigBuilder::new(&session_id).build();
    let mut stream = agent
        .reply(user_message, session_config, None)
        .await
        .expect("创建流式回复失败");

    let mut tool_start_count = 0usize;
    let mut tool_end_count = 0usize;
    let mut error_messages: Vec<String> = Vec::new();
    let mut text_buffer = String::new();

    while let Some(event_result) = stream.next().await {
        match event_result {
            Ok(agent_event) => {
                for event in convert_agent_event(agent_event) {
                    match event {
                        TauriAgentEvent::ToolStart { .. } => tool_start_count += 1,
                        TauriAgentEvent::ToolEnd { .. } => tool_end_count += 1,
                        TauriAgentEvent::TextDelta { text } => text_buffer.push_str(&text),
                        TauriAgentEvent::Error { message } => error_messages.push(message),
                        _ => {}
                    }
                }
            }
            Err(err) => error_messages.push(format!("stream_error: {err}")),
        }
    }

    assert!(
        error_messages.is_empty(),
        "流式过程中出现错误: {:?}",
        error_messages
    );
    assert!(
        tool_start_count > 0,
        "未收到 tool_start 事件，文本输出: {}",
        text_buffer
    );
    assert!(
        tool_end_count > 0,
        "未收到 tool_end 事件，文本输出: {}",
        text_buffer
    );
}
