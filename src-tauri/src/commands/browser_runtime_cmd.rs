//! 浏览器运行时窗口命令

use crate::app::AppState;
use crate::commands::webview_cmd::{
    open_cdp_session_global, open_chrome_profile_window_global, shared_browser_runtime,
    start_browser_stream_global, OpenCdpSessionRequest, OpenChromeProfileRequest,
    OpenChromeProfileResponse, StartBrowserStreamRequest,
};
use crate::services::browser_runtime_window;
use proxycast_browser_runtime::BrowserStreamMode;
use proxycast_browser_runtime::CdpSessionState;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::AppHandle;
use tokio::time::{sleep, Duration};
use tracing::info;

const CDP_READY_MAX_ATTEMPTS: usize = 60;
const CDP_READY_RETRY_INTERVAL_MS: u64 = 250;

#[derive(Debug, Deserialize)]
pub struct OpenBrowserRuntimeDebuggerWindowRequest {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub profile_key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LaunchBrowserRuntimeAssistRequest {
    pub profile_key: String,
    pub url: String,
    #[serde(default)]
    pub target_id: Option<String>,
    #[serde(default = "default_open_window")]
    pub open_window: bool,
    #[serde(default = "default_stream_mode")]
    pub stream_mode: BrowserStreamMode,
}

#[derive(Debug, Serialize)]
pub struct BrowserRuntimeAssistLaunchResponse {
    pub profile: OpenChromeProfileResponse,
    pub session: CdpSessionState,
}

fn default_stream_mode() -> BrowserStreamMode {
    BrowserStreamMode::Both
}

fn default_open_window() -> bool {
    true
}

async fn wait_for_cdp_ready(
    remote_debugging_port: u16,
    requested_target_id: Option<&str>,
) -> Result<(), String> {
    let runtime = shared_browser_runtime();
    let mut last_error =
        format!("等待 CDP 端点就绪: http://127.0.0.1:{remote_debugging_port}/json/version");

    for attempt in 0..CDP_READY_MAX_ATTEMPTS {
        match runtime.list_targets(remote_debugging_port).await {
            Ok(targets) => {
                if let Some(target_id) = requested_target_id {
                    if targets.iter().any(|target| target.id == target_id) {
                        return Ok(());
                    }
                    last_error = if targets.is_empty() {
                        format!("CDP 已连通，但尚未发现 target_id={target_id}")
                    } else {
                        format!("CDP 已连通，但未找到 target_id={target_id}")
                    };
                } else {
                    return Ok(());
                }
            }
            Err(error) => {
                last_error = error;
                if runtime.is_cdp_endpoint_alive(remote_debugging_port).await {
                    last_error = format!("CDP 调试端点已响应，但标签页列表暂不可用: {last_error}");
                }
            }
        }

        if attempt + 1 < CDP_READY_MAX_ATTEMPTS {
            sleep(Duration::from_millis(CDP_READY_RETRY_INTERVAL_MS)).await;
        }
    }

    Err(format!("等待 CDP 就绪超时: {last_error}"))
}

#[tauri::command]
pub fn open_browser_runtime_debugger_window(
    app_handle: AppHandle,
    request: Option<OpenBrowserRuntimeDebuggerWindowRequest>,
) -> Result<(), String> {
    let request = request.unwrap_or(OpenBrowserRuntimeDebuggerWindowRequest {
        session_id: None,
        profile_key: None,
    });
    browser_runtime_window::open_browser_runtime_window(
        &app_handle,
        request.session_id.as_deref(),
        request.profile_key.as_deref(),
    )
    .map_err(|e| format!("打开浏览器运行时调试窗口失败: {e}"))
}

#[tauri::command]
pub fn close_browser_runtime_debugger_window(app_handle: AppHandle) -> Result<(), String> {
    browser_runtime_window::close_browser_runtime_window(&app_handle)
        .map_err(|e| format!("关闭浏览器运行时调试窗口失败: {e}"))
}

#[tauri::command]
pub async fn launch_browser_runtime_assist(
    app_handle: AppHandle,
    app_state: tauri::State<'_, AppState>,
    request: LaunchBrowserRuntimeAssistRequest,
) -> Result<BrowserRuntimeAssistLaunchResponse, String> {
    launch_browser_runtime_assist_global(app_handle, app_state.inner().clone(), request).await
}

pub async fn launch_browser_runtime_assist_global(
    app_handle: AppHandle,
    app_state: AppState,
    request: LaunchBrowserRuntimeAssistRequest,
) -> Result<BrowserRuntimeAssistLaunchResponse, String> {
    let launch_started_at = Instant::now();
    let profile_started_at = Instant::now();
    let profile = open_chrome_profile_window_global(
        app_handle.clone(),
        app_state,
        OpenChromeProfileRequest {
            profile_key: request.profile_key.clone(),
            url: request.url.clone(),
        },
    )
    .await?;
    let profile_elapsed_ms = profile_started_at.elapsed().as_millis();

    if !profile.success {
        return Err(profile
            .error
            .clone()
            .unwrap_or_else(|| "打开浏览器 profile 失败".to_string()));
    }

    info!(
        profile_key = %request.profile_key,
        url = %request.url,
        reused = profile.reused,
        remote_debugging_port = ?profile.remote_debugging_port,
        elapsed_ms = profile_elapsed_ms,
        "browser runtime assist: profile ready"
    );

    let remote_debugging_port = profile
        .remote_debugging_port
        .ok_or_else(|| "浏览器 profile 缺少 remote_debugging_port，无法连接 CDP".to_string())?;

    let cdp_ready_started_at = Instant::now();
    wait_for_cdp_ready(remote_debugging_port, request.target_id.as_deref()).await?;
    let cdp_ready_elapsed_ms = cdp_ready_started_at.elapsed().as_millis();
    info!(
        profile_key = %request.profile_key,
        remote_debugging_port,
        elapsed_ms = cdp_ready_elapsed_ms,
        "browser runtime assist: cdp ready"
    );

    let open_session_started_at = Instant::now();
    let session = open_cdp_session_global(OpenCdpSessionRequest {
        profile_key: request.profile_key.clone(),
        target_id: request.target_id.clone(),
    })
    .await?;
    let open_session_elapsed_ms = open_session_started_at.elapsed().as_millis();
    info!(
        profile_key = %request.profile_key,
        session_id = %session.session_id,
        target_id = ?session.target_id,
        elapsed_ms = open_session_elapsed_ms,
        "browser runtime assist: cdp session opened"
    );

    let stream_started_at = Instant::now();
    let stream_mode = request.stream_mode.clone();
    let session = start_browser_stream_global(
        app_handle.clone(),
        StartBrowserStreamRequest {
            session_id: session.session_id.clone(),
            mode: stream_mode.clone(),
        },
    )
    .await?;
    let stream_elapsed_ms = stream_started_at.elapsed().as_millis();
    info!(
        profile_key = %request.profile_key,
        session_id = %session.session_id,
        stream_mode = ?stream_mode,
        elapsed_ms = stream_elapsed_ms,
        "browser runtime assist: stream started"
    );

    if request.open_window {
        let window_started_at = Instant::now();
        browser_runtime_window::open_browser_runtime_window(
            &app_handle,
            Some(&session.session_id),
            Some(&request.profile_key),
        )
        .map_err(|e| format!("打开浏览器运行时调试窗口失败: {e}"))?;
        info!(
            profile_key = %request.profile_key,
            session_id = %session.session_id,
            elapsed_ms = window_started_at.elapsed().as_millis(),
            "browser runtime assist: debugger window opened"
        );
    }

    info!(
        profile_key = %request.profile_key,
        session_id = %session.session_id,
        total_elapsed_ms = launch_started_at.elapsed().as_millis(),
        profile_elapsed_ms,
        cdp_ready_elapsed_ms,
        open_session_elapsed_ms,
        stream_elapsed_ms,
        open_window = request.open_window,
        "browser runtime assist: launch completed"
    );

    Ok(BrowserRuntimeAssistLaunchResponse { profile, session })
}
