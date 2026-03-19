//! Agent 会话存储服务
//!
//! 提供会话创建、列表查询、详情查询能力。
//! 数据事实源收敛到 lime_core::database::agent_session_repository + Lime 数据库。

use aster::session::extension_data::{resolve_todo_list_state, TodoListItem, TodoListItemStatus};
use aster::session::SessionRuntimeSnapshot;
use chrono::Utc;
use lime_core::agent::types::{AgentMessage, AgentSession, ContentPart, MessageContent};
use lime_core::database::agent_session_repository::{
    self, SessionRecordDetail, SessionRecordMetadata, SessionRecordOverview,
    SessionRecordPreviewMessage,
};
use lime_core::database::dao::agent_timeline::{
    AgentThreadItem, AgentThreadTurn, AgentTimelineDao,
};
use lime_core::database::DbConnection;
use lime_core::workspace::WorkspaceManager;
use lime_services::aster_session_store::LimeSessionStore;
use std::collections::HashMap;
use uuid::Uuid;

use crate::aster_runtime_support::load_aster_runtime_snapshot;
use crate::event_converter::{
    convert_item_runtime, convert_turn_runtime, TauriMessage, TauriMessageContent,
};
use crate::tool_io_offload::{
    build_history_tool_io_eviction_plan_for_model, force_offload_plain_tool_output_for_history,
    force_offload_tool_arguments_for_history, maybe_offload_plain_tool_output,
    maybe_offload_tool_arguments,
};
#[cfg(test)]
use lime_core::database::dao::agent::AgentDao;

/// 会话信息（简化版）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub messages_count: usize,
    pub execution_strategy: Option<String>,
    pub model: Option<String>,
    pub working_dir: Option<String>,
    pub workspace_id: Option<String>,
}

/// 会话详情（包含消息）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionDetail {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub thread_id: String,
    pub model: Option<String>,
    pub working_dir: Option<String>,
    pub workspace_id: Option<String>,
    pub messages: Vec<TauriMessage>,
    pub execution_strategy: Option<String>,
    pub turns: Vec<AgentThreadTurn>,
    pub items: Vec<AgentThreadItem>,
    #[serde(default)]
    pub todo_items: Vec<SessionTodoItem>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionTodoStatus {
    Pending,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct SessionTodoItem {
    pub content: String,
    pub status: SessionTodoStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_form: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct CreateSessionRecordInput {
    pub session_id: Option<String>,
    pub title: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub working_dir: Option<String>,
    pub workspace_id: Option<String>,
    pub execution_strategy: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct PersistedSessionMetadata {
    pub system_prompt: Option<String>,
    pub working_dir: Option<String>,
    pub execution_strategy: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionTitlePreviewMessage {
    pub role: String,
    pub content: String,
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    let trimmed = value?.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn normalize_optional_nonempty_body(value: Option<String>) -> Option<String> {
    let text = value?;
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

fn map_session_todo_status(status: TodoListItemStatus) -> SessionTodoStatus {
    match status {
        TodoListItemStatus::Pending => SessionTodoStatus::Pending,
        TodoListItemStatus::InProgress => SessionTodoStatus::InProgress,
        TodoListItemStatus::Completed => SessionTodoStatus::Completed,
    }
}

fn map_session_todo_item(item: TodoListItem) -> Option<SessionTodoItem> {
    let content = item.content.trim().to_string();
    if content.is_empty() {
        return None;
    }

    let active_form = normalize_optional_nonempty_body(Some(item.active_form));
    Some(SessionTodoItem {
        content,
        status: map_session_todo_status(item.status),
        active_form,
    })
}

fn load_session_todo_items_from_conn(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Vec<SessionTodoItem> {
    let extension_data = match LimeSessionStore::load_extension_data_from_conn(conn, session_id) {
        Ok(extension_data) => extension_data,
        Err(error) => {
            tracing::warn!(
                "[SessionStore] 读取 session todo 状态失败: session_id={}, error={}",
                session_id,
                error
            );
            return Vec::new();
        }
    };

    resolve_todo_list_state(&extension_data)
        .map(|todo_list| {
            todo_list
                .items
                .into_iter()
                .filter_map(map_session_todo_item)
                .collect()
        })
        .unwrap_or_default()
}

fn sort_runtime_turns(turns: &mut [AgentThreadTurn]) {
    turns.sort_by(|left, right| {
        left.started_at
            .cmp(&right.started_at)
            .then(left.created_at.cmp(&right.created_at))
            .then(left.id.cmp(&right.id))
    });
}

fn sort_runtime_items(items: &mut [AgentThreadItem], turn_started_at: &HashMap<String, String>) {
    items.sort_by(|left, right| {
        let left_turn_started = turn_started_at
            .get(&left.turn_id)
            .map(String::as_str)
            .unwrap_or(left.started_at.as_str());
        let right_turn_started = turn_started_at
            .get(&right.turn_id)
            .map(String::as_str)
            .unwrap_or(right.started_at.as_str());

        left_turn_started
            .cmp(right_turn_started)
            .then(left.sequence.cmp(&right.sequence))
            .then(left.turn_id.cmp(&right.turn_id))
            .then(left.started_at.cmp(&right.started_at))
            .then(left.id.cmp(&right.id))
    });
}

fn apply_aster_runtime_snapshot(detail: &mut SessionDetail, snapshot: &SessionRuntimeSnapshot) {
    if let Some(thread) = snapshot.threads.first() {
        detail.thread_id = thread.thread.id.clone();
    }

    if snapshot.threads.is_empty() {
        return;
    }

    let mut turns_by_id = detail
        .turns
        .drain(..)
        .map(|turn| (turn.id.clone(), turn))
        .collect::<HashMap<_, _>>();
    for thread in &snapshot.threads {
        for turn in &thread.turns {
            turns_by_id.insert(turn.id.clone(), convert_turn_runtime(turn.clone()));
        }
    }
    detail.turns = turns_by_id.into_values().collect();
    sort_runtime_turns(&mut detail.turns);

    let turn_started_at = detail
        .turns
        .iter()
        .map(|turn| (turn.id.clone(), turn.started_at.clone()))
        .collect::<HashMap<_, _>>();

    let mut items_by_id = detail
        .items
        .drain(..)
        .map(|item| (item.id.clone(), item))
        .collect::<HashMap<_, _>>();
    for thread in &snapshot.threads {
        for item in &thread.items {
            items_by_id.insert(item.id.clone(), convert_item_runtime(item.clone()));
        }
    }
    detail.items = items_by_id.into_values().collect();
    sort_runtime_items(&mut detail.items, &turn_started_at);
}

fn build_runtime_session_info(overview: SessionRecordOverview) -> SessionInfo {
    let working_dir = overview.working_dir;
    let workspace_id = overview.workspace_id;

    SessionInfo {
        id: overview.id,
        name: overview.title.unwrap_or_else(|| "未命名".to_string()),
        created_at: chrono::DateTime::parse_from_rfc3339(&overview.created_at)
            .map(|dt| dt.timestamp())
            .unwrap_or(0),
        updated_at: chrono::DateTime::parse_from_rfc3339(&overview.updated_at)
            .map(|dt| dt.timestamp())
            .unwrap_or(0),
        messages_count: overview.messages_count,
        execution_strategy: overview.execution_strategy,
        model: Some(overview.model),
        working_dir,
        workspace_id,
    }
}

/// 解析会话 working_dir（优先入参，其次 workspace_id）
fn resolve_session_working_dir(
    db: &DbConnection,
    working_dir: Option<String>,
    workspace_id: String,
) -> Result<Option<String>, String> {
    if let Some(path) = working_dir {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }

    let workspace_id = workspace_id.trim().to_string();
    if workspace_id.is_empty() {
        return Err("workspace_id 必填，请先选择项目工作区".to_string());
    }

    let manager = WorkspaceManager::new(db.clone());
    if let Some(workspace) = manager.get(&workspace_id)? {
        return Ok(Some(workspace.root_path.to_string_lossy().to_string()));
    }

    Err(format!("Workspace 不存在: {}", workspace_id))
}

fn normalize_execution_strategy(execution_strategy: Option<String>) -> String {
    match execution_strategy.as_deref() {
        Some("code_orchestrated") => "code_orchestrated".to_string(),
        Some("auto") => "auto".to_string(),
        _ => "react".to_string(),
    }
}

fn resolve_optional_session_working_dir(
    db: &DbConnection,
    working_dir: Option<String>,
    workspace_id: Option<String>,
) -> Result<Option<String>, String> {
    if let Some(path) = normalize_optional_text(working_dir) {
        return Ok(Some(path));
    }

    if let Some(workspace_id) = normalize_optional_text(workspace_id) {
        return resolve_session_working_dir(db, None, workspace_id);
    }

    Ok(None)
}

/// 创建并持久化会话记录
pub(crate) fn create_session_record_sync(
    db: &DbConnection,
    input: CreateSessionRecordInput,
) -> Result<AgentSession, String> {
    let now = Utc::now().to_rfc3339();
    let session = AgentSession {
        id: normalize_optional_text(input.session_id).unwrap_or_else(|| Uuid::new_v4().to_string()),
        model: normalize_optional_text(input.model).unwrap_or_else(|| "agent:default".to_string()),
        messages: Vec::new(),
        system_prompt: normalize_optional_nonempty_body(input.system_prompt),
        title: normalize_optional_text(input.title),
        working_dir: resolve_optional_session_working_dir(
            db,
            input.working_dir,
            input.workspace_id,
        )?,
        execution_strategy: Some(normalize_execution_strategy(input.execution_strategy)),
        created_at: now.clone(),
        updated_at: now,
    };

    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    agent_session_repository::create_session(&conn, &session)?;

    Ok(session)
}

/// 创建新会话
pub fn create_session_sync(
    db: &DbConnection,
    name: Option<String>,
    working_dir: Option<String>,
    workspace_id: String,
    execution_strategy: Option<String>,
) -> Result<String, String> {
    let session = create_session_record_sync(
        db,
        CreateSessionRecordInput {
            title: Some(normalize_optional_text(name).unwrap_or_else(|| "新对话".to_string())),
            working_dir,
            workspace_id: Some(workspace_id),
            execution_strategy,
            ..CreateSessionRecordInput::default()
        },
    )?;

    Ok(session.id)
}

/// 列出所有会话
pub fn list_sessions_sync(db: &DbConnection) -> Result<Vec<SessionInfo>, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    let sessions = agent_session_repository::list_session_overviews(&conn)?;

    Ok(sessions
        .into_iter()
        .map(build_runtime_session_info)
        .collect())
}

pub fn get_persisted_session_metadata_sync(
    db: &DbConnection,
    session_id: &str,
) -> Result<Option<PersistedSessionMetadata>, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    let session = agent_session_repository::get_persisted_session_metadata(&conn, session_id)?;

    Ok(
        session.map(|metadata: SessionRecordMetadata| PersistedSessionMetadata {
            system_prompt: metadata.system_prompt,
            working_dir: metadata.working_dir,
            execution_strategy: metadata.execution_strategy,
        }),
    )
}

pub fn list_title_preview_messages_sync(
    db: &DbConnection,
    session_id: &str,
    limit: usize,
) -> Result<Vec<SessionTitlePreviewMessage>, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    let messages = agent_session_repository::list_title_preview_messages(&conn, session_id, limit)?;

    Ok(messages
        .into_iter()
        .map(
            |msg: SessionRecordPreviewMessage| SessionTitlePreviewMessage {
                role: msg.role,
                content: msg.content,
            },
        )
        .collect())
}

/// 获取会话详情
pub fn get_session_sync(db: &DbConnection, session_id: &str) -> Result<SessionDetail, String> {
    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;

    let SessionRecordDetail {
        session,
        workspace_id,
    } = agent_session_repository::get_session_with_messages(&conn, session_id)?
        .ok_or_else(|| format!("会话不存在: {session_id}"))?;

    let turns = AgentTimelineDao::list_turns_by_thread(&conn, session_id)
        .map_err(|e| format!("获取 turn 历史失败: {e}"))?;
    let items = AgentTimelineDao::list_items_by_thread(&conn, session_id)
        .map_err(|e| format!("获取 item 历史失败: {e}"))?;
    let working_dir = session.working_dir.clone();
    let todo_items = load_session_todo_items_from_conn(&conn, session_id);

    let tauri_messages = convert_agent_messages(&session.messages, Some(session.model.as_str()));

    tracing::debug!(
        "[SessionStore] 会话消息转换完成: session_id={}, messages_count={}",
        session_id,
        tauri_messages.len()
    );

    Ok(SessionDetail {
        id: session.id,
        name: session.title.unwrap_or_else(|| "未命名".to_string()),
        created_at: chrono::DateTime::parse_from_rfc3339(&session.created_at)
            .map(|dt| dt.timestamp())
            .unwrap_or(0),
        updated_at: chrono::DateTime::parse_from_rfc3339(&session.updated_at)
            .map(|dt| dt.timestamp())
            .unwrap_or(0),
        thread_id: session_id.to_string(),
        model: Some(session.model),
        working_dir,
        workspace_id,
        messages: tauri_messages,
        execution_strategy: session.execution_strategy,
        turns,
        items,
        todo_items,
    })
}

pub async fn get_runtime_session_detail(
    db: &DbConnection,
    session_id: &str,
) -> Result<SessionDetail, String> {
    let mut detail = get_session_sync(db, session_id)?;

    match load_aster_runtime_snapshot(session_id).await {
        Ok(snapshot) => apply_aster_runtime_snapshot(&mut detail, &snapshot),
        Err(error) => {
            tracing::warn!(
                "[SessionStore] 读取 Aster runtime snapshot 失败: session_id={}, error={}",
                session_id,
                error
            );
        }
    }

    Ok(detail)
}

/// 重命名会话
pub fn rename_session_sync(db: &DbConnection, session_id: &str, name: &str) -> Result<(), String> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("会话名称不能为空".to_string());
    }

    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    let now = Utc::now().to_rfc3339();
    agent_session_repository::rename_session(&conn, session_id, trimmed_name, &now)?;

    Ok(())
}

pub fn update_session_working_dir_sync(
    db: &DbConnection,
    session_id: &str,
    working_dir: &str,
) -> Result<(), String> {
    let trimmed_working_dir = working_dir.trim();
    if trimmed_working_dir.is_empty() {
        return Err("working_dir 不能为空".to_string());
    }

    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    agent_session_repository::update_session_working_dir(&conn, session_id, trimmed_working_dir)?;

    Ok(())
}

pub fn update_session_execution_strategy_sync(
    db: &DbConnection,
    session_id: &str,
    execution_strategy: &str,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("数据库锁定失败: {e}"))?;
    agent_session_repository::update_session_execution_strategy(
        &conn,
        session_id,
        execution_strategy,
    )?;
    Ok(())
}

/// 删除会话
pub async fn delete_session(db: &DbConnection, session_id: &str) -> Result<(), String> {
    aster::session::SessionStore::delete_session(&LimeSessionStore::new(db.clone()), session_id)
        .await
        .map_err(|e| format!("删除会话失败: {e}"))
}

fn parse_tool_call_arguments(arguments: &str) -> serde_json::Value {
    let trimmed = arguments.trim();
    if trimmed.is_empty() {
        return serde_json::json!({});
    }

    serde_json::from_str::<serde_json::Value>(trimmed)
        .unwrap_or_else(|_| serde_json::json!({ "raw": arguments }))
}

fn parse_data_url(url: &str) -> Option<(String, String)> {
    let trimmed = url.trim();
    let payload = trimmed.strip_prefix("data:")?;
    let (meta, data) = payload.split_once(',')?;
    if data.trim().is_empty() {
        return None;
    }

    let mut segments = meta.split(';');
    let mime_type = segments.next().unwrap_or_default().trim();
    let has_base64 = segments.any(|segment| segment.eq_ignore_ascii_case("base64"));

    if !has_base64 {
        return None;
    }

    let normalized_mime = if mime_type.is_empty() {
        "application/octet-stream".to_string()
    } else {
        mime_type.to_string()
    };

    Some((normalized_mime, data.trim().to_string()))
}

fn convert_image_part(image_url: &str) -> Option<TauriMessageContent> {
    let normalized = image_url.trim();
    if normalized.is_empty() {
        return None;
    }

    if let Some((mime_type, data)) = parse_data_url(normalized) {
        return Some(TauriMessageContent::Image { mime_type, data });
    }

    if normalized.starts_with("data:") {
        return Some(TauriMessageContent::Text {
            text: "[图片消息]".to_string(),
        });
    }

    Some(TauriMessageContent::Text {
        text: format!("![image]({normalized})"),
    })
}

/// 将 AgentMessage 转换为 TauriMessage
fn convert_agent_messages(
    messages: &[AgentMessage],
    model_name: Option<&str>,
) -> Vec<TauriMessage> {
    let eviction_plan = build_history_tool_io_eviction_plan_for_model(messages, model_name);
    messages
        .iter()
        .map(|message| convert_agent_message(message, &eviction_plan))
        .collect()
}

fn convert_agent_message(
    message: &AgentMessage,
    eviction_plan: &crate::tool_io_offload::HistoryToolIoEvictionPlan,
) -> TauriMessage {
    let mut content = match &message.content {
        MessageContent::Text(text) => {
            if text.trim().is_empty() {
                Vec::new()
            } else {
                vec![TauriMessageContent::Text { text: text.clone() }]
            }
        }
        MessageContent::Parts(parts) => parts
            .iter()
            .filter_map(|part| match part {
                ContentPart::Text { text } => {
                    if text.trim().is_empty() {
                        None
                    } else {
                        Some(TauriMessageContent::Text { text: text.clone() })
                    }
                }
                ContentPart::ImageUrl { image_url } => convert_image_part(&image_url.url),
            })
            .collect(),
    };

    // 添加 reasoning_content 作为 thinking 类型
    if let Some(reasoning) = &message.reasoning_content {
        content.insert(
            0,
            TauriMessageContent::Thinking {
                text: reasoning.clone(),
            },
        );
    }

    if let Some(tool_calls) = &message.tool_calls {
        for call in tool_calls {
            let parsed_arguments = parse_tool_call_arguments(&call.function.arguments);
            let arguments = if eviction_plan.request_ids.contains(&call.id) {
                force_offload_tool_arguments_for_history(&call.id, &parsed_arguments)
            } else {
                maybe_offload_tool_arguments(&call.id, &parsed_arguments)
            };
            content.push(TauriMessageContent::ToolRequest {
                id: call.id.clone(),
                tool_name: call.function.name.clone(),
                arguments,
            });
        }
    }

    if let Some(tool_call_id) = &message.tool_call_id {
        let tool_output = message.content.as_text();
        let offloaded = if eviction_plan.response_ids.contains(tool_call_id) {
            force_offload_plain_tool_output_for_history(tool_call_id, &tool_output, None)
        } else {
            maybe_offload_plain_tool_output(tool_call_id, &tool_output, None)
        };

        // tool/user 的工具结果协议消息都不应作为普通文本重复渲染。
        if message.role.eq_ignore_ascii_case("tool") || message.role.eq_ignore_ascii_case("user") {
            content.retain(|part| !matches!(part, TauriMessageContent::Text { .. }));
        }

        content.push(TauriMessageContent::ToolResponse {
            id: tool_call_id.clone(),
            success: true,
            output: offloaded.output,
            error: None,
            images: None,
            metadata: if offloaded.metadata.is_empty() {
                None
            } else {
                Some(offloaded.metadata)
            },
        });
    }

    let timestamp = chrono::DateTime::parse_from_rfc3339(&message.timestamp)
        .map(|dt| dt.timestamp())
        .unwrap_or(0);

    let result = TauriMessage {
        id: None,
        role: message.role.clone(),
        content,
        timestamp,
    };

    // 调试日志
    tracing::debug!(
        "[SessionStore] 转换消息: role={}, content_items={}",
        result.role,
        result.content.len()
    );

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use lime_core::agent::types::{FunctionCall, ImageUrl, ToolCall};
    use lime_core::database::{schema, DbConnection};
    use std::ffi::OsString;
    use std::sync::{Arc, Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    struct EnvGuard {
        values: Vec<(&'static str, Option<OsString>)>,
    }

    impl EnvGuard {
        fn set(entries: &[(&'static str, OsString)]) -> Self {
            let mut values = Vec::new();
            for (key, value) in entries {
                values.push((*key, std::env::var_os(key)));
                std::env::set_var(key, value);
            }
            Self { values }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, previous) in self.values.drain(..) {
                if let Some(value) = previous {
                    std::env::set_var(key, value);
                } else {
                    std::env::remove_var(key);
                }
            }
        }
    }

    fn create_test_db() -> DbConnection {
        let conn = rusqlite::Connection::open_in_memory().expect("open in-memory db");
        schema::create_tables(&conn).expect("create tables");
        Arc::new(Mutex::new(conn))
    }

    fn insert_test_workspace(db: &DbConnection, workspace_id: &str, root_path: &str) {
        let conn = db.lock().expect("lock db");
        conn.execute(
            "INSERT INTO workspaces (id, name, workspace_type, root_path, is_default, settings_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 0, '{}', 0, 0)",
            rusqlite::params![workspace_id, "测试工作区", "general", root_path],
        )
        .expect("insert workspace");
    }

    fn insert_test_session_with_message(
        db: &DbConnection,
        session_id: &str,
        working_dir: &str,
        message_text: &str,
    ) {
        create_session_record_sync(
            db,
            CreateSessionRecordInput {
                session_id: Some(session_id.to_string()),
                title: Some("测试会话".to_string()),
                model: Some("agent:test".to_string()),
                working_dir: Some(working_dir.to_string()),
                execution_strategy: Some("react".to_string()),
                ..CreateSessionRecordInput::default()
            },
        )
        .expect("create session");

        let conn = db.lock().expect("lock db");
        AgentDao::add_message(
            &conn,
            session_id,
            &AgentMessage {
                role: "user".to_string(),
                content: MessageContent::Text(message_text.to_string()),
                timestamp: "2026-03-18T08:00:00Z".to_string(),
                tool_calls: None,
                tool_call_id: None,
                reasoning_content: None,
            },
        )
        .expect("add message");
    }

    #[test]
    fn parse_tool_call_arguments_should_parse_json_or_keep_raw() {
        let parsed = parse_tool_call_arguments(r#"{"path":"./a.txt"}"#);
        assert_eq!(parsed["path"], serde_json::json!("./a.txt"));

        let fallback = parse_tool_call_arguments("not-json");
        assert_eq!(fallback["raw"], serde_json::json!("not-json"));
    }

    #[test]
    fn convert_agent_message_should_preserve_tool_request_and_response() {
        let assistant = AgentMessage {
            role: "assistant".to_string(),
            content: MessageContent::Text("".to_string()),
            timestamp: "2026-02-19T13:00:00Z".to_string(),
            tool_calls: Some(vec![ToolCall {
                id: "call-1".to_string(),
                call_type: "function".to_string(),
                function: FunctionCall {
                    name: "Write".to_string(),
                    arguments: r#"{"path":"./a.txt"}"#.to_string(),
                },
            }]),
            tool_call_id: None,
            reasoning_content: None,
        };

        let assistant_converted = convert_agent_message(
            &assistant,
            &crate::tool_io_offload::HistoryToolIoEvictionPlan::default(),
        );
        assert!(assistant_converted.content.iter().any(|part| {
            matches!(
                part,
                TauriMessageContent::ToolRequest { id, tool_name, .. }
                    if id == "call-1" && tool_name == "Write"
            )
        }));

        let tool = AgentMessage {
            role: "tool".to_string(),
            content: MessageContent::Text("写入成功".to_string()),
            timestamp: "2026-02-19T13:00:01Z".to_string(),
            tool_calls: None,
            tool_call_id: Some("call-1".to_string()),
            reasoning_content: None,
        };

        let tool_converted = convert_agent_message(
            &tool,
            &crate::tool_io_offload::HistoryToolIoEvictionPlan::default(),
        );
        assert!(!tool_converted
            .content
            .iter()
            .any(|part| matches!(part, TauriMessageContent::Text { .. })));
        assert!(tool_converted.content.iter().any(|part| {
            matches!(
                part,
                TauriMessageContent::ToolResponse { id, output, .. }
                    if id == "call-1" && output == "写入成功"
            )
        }));
    }

    #[test]
    fn convert_agent_message_should_keep_image_parts_for_history() {
        let user_with_image = AgentMessage {
            role: "user".to_string(),
            content: MessageContent::Parts(vec![
                ContentPart::Text {
                    text: "参考图".to_string(),
                },
                ContentPart::ImageUrl {
                    image_url: ImageUrl {
                        url: "data:image/png;base64,aGVsbG8=".to_string(),
                        detail: None,
                    },
                },
            ]),
            timestamp: "2026-02-19T13:00:02Z".to_string(),
            tool_calls: None,
            tool_call_id: None,
            reasoning_content: None,
        };

        let converted = convert_agent_message(
            &user_with_image,
            &crate::tool_io_offload::HistoryToolIoEvictionPlan::default(),
        );
        assert!(converted.content.iter().any(|part| {
            matches!(
                part,
                TauriMessageContent::Image { mime_type, data }
                    if mime_type == "image/png" && data == "aGVsbG8="
            )
        }));
        assert!(converted
            .content
            .iter()
            .any(|part| matches!(part, TauriMessageContent::Text { text } if text == "参考图")));
    }

    #[test]
    fn convert_agent_message_should_not_render_user_tool_response_as_plain_text() {
        let user_tool_response = AgentMessage {
            role: "user".to_string(),
            content: MessageContent::Text("任务已完成".to_string()),
            timestamp: "2026-02-19T13:00:03Z".to_string(),
            tool_calls: None,
            tool_call_id: Some("call-2".to_string()),
            reasoning_content: None,
        };

        let converted = convert_agent_message(
            &user_tool_response,
            &crate::tool_io_offload::HistoryToolIoEvictionPlan::default(),
        );
        assert!(!converted
            .content
            .iter()
            .any(|part| matches!(part, TauriMessageContent::Text { .. })));
        assert!(converted.content.iter().any(|part| {
            matches!(
                part,
                TauriMessageContent::ToolResponse { id, output, .. }
                    if id == "call-2" && output == "任务已完成"
            )
        }));
    }

    #[test]
    fn convert_agent_messages_should_force_offload_old_large_tool_calls_under_context_pressure() {
        let _lock = env_lock().lock().expect("lock env");
        let _env = EnvGuard::set(&[
            (
                crate::tool_io_offload::TOOL_TOKEN_LIMIT_BEFORE_EVICT_ENV_KEYS[0],
                OsString::from("50"),
            ),
            (
                crate::tool_io_offload::CONTEXT_MAX_INPUT_TOKENS_ENV_KEYS[0],
                OsString::from("600"),
            ),
            (
                crate::tool_io_offload::CONTEXT_WINDOW_TRIGGER_RATIO_ENV_KEYS[0],
                OsString::from("0.5"),
            ),
            (
                crate::tool_io_offload::CONTEXT_KEEP_RECENT_MESSAGES_ENV_KEYS[0],
                OsString::from("1"),
            ),
        ]);

        let messages = vec![
            AgentMessage {
                role: "assistant".to_string(),
                content: MessageContent::Text(String::new()),
                timestamp: "2026-03-11T00:00:00Z".to_string(),
                tool_calls: Some(vec![ToolCall {
                    id: "call-history-1".to_string(),
                    call_type: "function".to_string(),
                    function: FunctionCall {
                        name: "Write".to_string(),
                        arguments: serde_json::json!({
                            "path": "docs/huge.md",
                            "content": "token ".repeat(220),
                        })
                        .to_string(),
                    },
                }]),
                tool_call_id: None,
                reasoning_content: None,
            },
            AgentMessage {
                role: "user".to_string(),
                content: MessageContent::Text("token ".repeat(320)),
                timestamp: "2026-03-11T00:00:01Z".to_string(),
                tool_calls: None,
                tool_call_id: None,
                reasoning_content: None,
            },
            AgentMessage {
                role: "assistant".to_string(),
                content: MessageContent::Text("最近一条消息".to_string()),
                timestamp: "2026-03-11T00:00:02Z".to_string(),
                tool_calls: None,
                tool_call_id: None,
                reasoning_content: None,
            },
        ];

        let converted = convert_agent_messages(&messages, Some("gpt-4"));
        let first = converted.first().expect("first message");
        let request = first
            .content
            .iter()
            .find_map(|part| match part {
                TauriMessageContent::ToolRequest { arguments, .. } => Some(arguments),
                _ => None,
            })
            .expect("tool request");

        let record = request
            .as_object()
            .expect("offloaded request should be object");
        assert!(record.contains_key(crate::tool_io_offload::LIME_TOOL_ARGUMENTS_OFFLOAD_KEY));
    }

    #[test]
    fn list_sessions_sync_should_resolve_workspace_id_from_working_dir() {
        let db = create_test_db();
        insert_test_workspace(&db, "workspace-1", "/tmp/lime-workspace-1");
        insert_test_session_with_message(&db, "session-1", "/tmp/lime-workspace-1", "你好，世界");

        let sessions = list_sessions_sync(&db).expect("list sessions");
        let session = sessions
            .iter()
            .find(|item| item.id == "session-1")
            .expect("session exists");

        assert_eq!(session.workspace_id.as_deref(), Some("workspace-1"));
        assert_eq!(
            session.working_dir.as_deref(),
            Some("/tmp/lime-workspace-1")
        );
        assert_eq!(session.messages_count, 1);
    }

    #[test]
    fn get_session_sync_should_resolve_workspace_id_from_working_dir() {
        let db = create_test_db();
        insert_test_workspace(&db, "workspace-2", "/tmp/lime-workspace-2");
        insert_test_session_with_message(&db, "session-2", "/tmp/lime-workspace-2", "继续处理");

        let detail = get_session_sync(&db, "session-2").expect("get session");

        assert_eq!(detail.workspace_id.as_deref(), Some("workspace-2"));
        assert_eq!(detail.working_dir.as_deref(), Some("/tmp/lime-workspace-2"));
        assert_eq!(detail.messages.len(), 1);
    }

    #[test]
    fn update_session_working_dir_sync_should_refresh_workspace_binding() {
        let db = create_test_db();
        insert_test_workspace(&db, "workspace-3", "/tmp/lime-workspace-3");
        insert_test_workspace(&db, "workspace-4", "/tmp/lime-workspace-4");
        insert_test_session_with_message(&db, "session-3", "/tmp/lime-workspace-3", "切换目录");

        update_session_working_dir_sync(&db, "session-3", "/tmp/lime-workspace-4")
            .expect("update working_dir");

        let detail = get_session_sync(&db, "session-3").expect("get session");
        assert_eq!(detail.working_dir.as_deref(), Some("/tmp/lime-workspace-4"));
        assert_eq!(detail.workspace_id.as_deref(), Some("workspace-4"));
    }

    #[test]
    fn rename_session_sync_should_update_session_title() {
        let db = create_test_db();
        insert_test_session_with_message(
            &db,
            "session-rename",
            "/tmp/lime-workspace-5",
            "原始消息",
        );

        rename_session_sync(&db, "session-rename", "新的会话标题").expect("rename session");

        let session = get_session_sync(&db, "session-rename").expect("get session");
        assert_eq!(session.name, "新的会话标题");
    }

    #[test]
    fn list_title_preview_messages_sync_should_only_keep_chat_roles() {
        let db = create_test_db();
        create_session_record_sync(
            &db,
            CreateSessionRecordInput {
                session_id: Some("session-title".to_string()),
                title: Some("测试标题".to_string()),
                model: Some("agent:test".to_string()),
                execution_strategy: Some("react".to_string()),
                ..CreateSessionRecordInput::default()
            },
        )
        .expect("create session");

        let conn = db.lock().expect("lock db");
        AgentDao::add_message(
            &conn,
            "session-title",
            &AgentMessage {
                role: "system".to_string(),
                content: MessageContent::Text("忽略这条系统消息".to_string()),
                timestamp: "2026-03-18T08:00:00Z".to_string(),
                tool_calls: None,
                tool_call_id: None,
                reasoning_content: None,
            },
        )
        .expect("add system message");
        AgentDao::add_message(
            &conn,
            "session-title",
            &AgentMessage {
                role: "user".to_string(),
                content: MessageContent::Text("第一条用户消息".to_string()),
                timestamp: "2026-03-18T08:01:00Z".to_string(),
                tool_calls: None,
                tool_call_id: None,
                reasoning_content: None,
            },
        )
        .expect("add user message");
        AgentDao::add_message(
            &conn,
            "session-title",
            &AgentMessage {
                role: "assistant".to_string(),
                content: MessageContent::Text("第一条助手消息".to_string()),
                timestamp: "2026-03-18T08:02:00Z".to_string(),
                tool_calls: None,
                tool_call_id: None,
                reasoning_content: None,
            },
        )
        .expect("add assistant message");
        AgentDao::add_message(
            &conn,
            "session-title",
            &AgentMessage {
                role: "tool".to_string(),
                content: MessageContent::Text("忽略工具输出".to_string()),
                timestamp: "2026-03-18T08:03:00Z".to_string(),
                tool_calls: None,
                tool_call_id: Some("tool-1".to_string()),
                reasoning_content: None,
            },
        )
        .expect("add tool message");
        drop(conn);

        let preview =
            list_title_preview_messages_sync(&db, "session-title", 4).expect("load preview");
        assert_eq!(
            preview,
            vec![
                SessionTitlePreviewMessage {
                    role: "user".to_string(),
                    content: "第一条用户消息".to_string(),
                },
                SessionTitlePreviewMessage {
                    role: "assistant".to_string(),
                    content: "第一条助手消息".to_string(),
                },
            ]
        );
    }
}
