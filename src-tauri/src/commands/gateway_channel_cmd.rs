//! Gateway 渠道命令
//!
//! 负责启动/停止/查询渠道运行时状态，当前优先支持 Telegram。

use crate::app::LogState;
use crate::config::GlobalConfigManagerState;
use crate::database::DbConnection;
use crate::services::web_search_runtime_service::apply_web_search_runtime_env;
use proxycast_gateway::discord::{
    probe_gateway_account as probe_discord_gateway_account, start_gateway as start_discord_gateway,
    status_gateway as status_discord_gateway, stop_gateway as stop_discord_gateway,
    DiscordGatewayState, DiscordProbeResult,
};
use proxycast_gateway::feishu::{
    probe_gateway_account as probe_feishu_gateway_account, start_gateway as start_feishu_gateway,
    status_gateway as status_feishu_gateway, stop_gateway as stop_feishu_gateway,
    FeishuGatewayState, FeishuProbeResult,
};
use proxycast_gateway::telegram::{
    probe_gateway_account as probe_telegram_gateway_account,
    start_gateway as start_telegram_gateway, status_gateway as status_telegram_gateway,
    stop_gateway as stop_telegram_gateway, TelegramGatewayState, TelegramProbeResult,
};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Deserialize)]
pub struct GatewayChannelStartRequest {
    pub channel: String,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub poll_timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GatewayChannelStopRequest {
    pub channel: String,
    #[serde(default)]
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GatewayChannelStatusRequest {
    pub channel: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TelegramProbeRequest {
    #[serde(default)]
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GatewayChannelStatusResponse {
    pub channel: String,
    pub status: serde_json::Value,
}

fn normalize_channel(channel: &str) -> Result<String, String> {
    let normalized = channel.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "telegram" | "feishu" | "discord" => Ok(normalized),
        _ => Err(format!(
            "暂不支持的渠道: {}（当前支持 telegram / feishu / discord）",
            channel
        )),
    }
}

#[tauri::command]
pub async fn gateway_channel_start(
    telegram_state: State<'_, TelegramGatewayState>,
    feishu_state: State<'_, FeishuGatewayState>,
    discord_state: State<'_, DiscordGatewayState>,
    db: State<'_, DbConnection>,
    logs: State<'_, LogState>,
    config_manager: State<'_, GlobalConfigManagerState>,
    request: GatewayChannelStartRequest,
) -> Result<GatewayChannelStatusResponse, String> {
    let channel = normalize_channel(&request.channel)?;

    let config = config_manager.config();
    apply_web_search_runtime_env(&config);
    let status = if channel == "telegram" {
        let status = start_telegram_gateway(
            &telegram_state,
            db.inner().clone(),
            logs.inner().clone(),
            config,
            request.account_id,
            request.poll_timeout_secs,
        )
        .await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    } else if channel == "feishu" {
        let status = start_feishu_gateway(
            &feishu_state,
            db.inner().clone(),
            logs.inner().clone(),
            config,
            request.account_id,
            request.poll_timeout_secs,
        )
        .await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    } else {
        let status = start_discord_gateway(
            &discord_state,
            db.inner().clone(),
            logs.inner().clone(),
            config,
            request.account_id,
            request.poll_timeout_secs,
        )
        .await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    };

    Ok(GatewayChannelStatusResponse { channel, status })
}

#[tauri::command]
pub async fn gateway_channel_stop(
    telegram_state: State<'_, TelegramGatewayState>,
    feishu_state: State<'_, FeishuGatewayState>,
    discord_state: State<'_, DiscordGatewayState>,
    request: GatewayChannelStopRequest,
) -> Result<GatewayChannelStatusResponse, String> {
    let channel = normalize_channel(&request.channel)?;

    let status = if channel == "telegram" {
        let status = stop_telegram_gateway(&telegram_state, request.account_id).await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    } else if channel == "feishu" {
        let status = stop_feishu_gateway(&feishu_state, request.account_id).await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    } else {
        let status = stop_discord_gateway(&discord_state, request.account_id).await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    };
    Ok(GatewayChannelStatusResponse { channel, status })
}

#[tauri::command]
pub async fn gateway_channel_status(
    telegram_state: State<'_, TelegramGatewayState>,
    feishu_state: State<'_, FeishuGatewayState>,
    discord_state: State<'_, DiscordGatewayState>,
    request: GatewayChannelStatusRequest,
) -> Result<GatewayChannelStatusResponse, String> {
    let channel = normalize_channel(&request.channel)?;

    let status = if channel == "telegram" {
        let status = status_telegram_gateway(&telegram_state).await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    } else if channel == "feishu" {
        let status = status_feishu_gateway(&feishu_state).await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    } else {
        let status = status_discord_gateway(&discord_state).await?;
        serde_json::to_value(status).map_err(|e| e.to_string())?
    };
    Ok(GatewayChannelStatusResponse { channel, status })
}

#[tauri::command]
pub async fn telegram_channel_probe(
    config_manager: State<'_, GlobalConfigManagerState>,
    request: TelegramProbeRequest,
) -> Result<TelegramProbeResult, String> {
    let config = config_manager.config();
    probe_telegram_gateway_account(&config, request.account_id).await
}

#[derive(Debug, Clone, Deserialize)]
pub struct FeishuProbeRequest {
    #[serde(default)]
    pub account_id: Option<String>,
}

#[tauri::command]
pub async fn feishu_channel_probe(
    config_manager: State<'_, GlobalConfigManagerState>,
    request: FeishuProbeRequest,
) -> Result<FeishuProbeResult, String> {
    let config = config_manager.config();
    probe_feishu_gateway_account(&config, request.account_id).await
}

#[derive(Debug, Clone, Deserialize)]
pub struct DiscordProbeRequest {
    #[serde(default)]
    pub account_id: Option<String>,
}

#[tauri::command]
pub async fn discord_channel_probe(
    config_manager: State<'_, GlobalConfigManagerState>,
    request: DiscordProbeRequest,
) -> Result<DiscordProbeResult, String> {
    let config = config_manager.config();
    probe_discord_gateway_account(&config, request.account_id).await
}
