use super::*;
use chrono::{DateTime, Utc};

/// Aster Agent 状态信息
#[derive(Debug, Serialize)]
pub struct AsterAgentStatus {
    pub initialized: bool,
    pub provider_configured: bool,
    pub provider_name: Option<String>,
    pub model_name: Option<String>,
    /// 凭证 UUID（来自凭证池）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential_uuid: Option<String>,
}

/// Provider 配置请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigureProviderRequest {
    #[serde(default)]
    pub provider_id: Option<String>,
    pub provider_name: String,
    pub model_name: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
}

/// 从凭证池配置 Provider 的请求
#[derive(Debug, Deserialize)]
pub struct ConfigureFromPoolRequest {
    /// Provider 类型 (openai, anthropic, kiro, gemini 等)
    pub provider_type: String,
    /// 模型名称
    pub model_name: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeToolInventoryRequest {
    #[serde(default)]
    pub creator: bool,
    #[serde(default)]
    pub browser_assist: bool,
    #[serde(default)]
    pub caller: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

/// 发送消息请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsterChatRequest {
    pub message: String,
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "eventName")]
    pub event_name: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub images: Option<Vec<ImageInput>>,
    /// Provider 配置（可选，如果未配置则使用当前配置）
    #[serde(default, alias = "providerConfig")]
    pub provider_config: Option<ConfigureProviderRequest>,
    /// 项目 ID（可选，用于注入项目上下文到 System Prompt）
    #[serde(default, alias = "projectId")]
    pub project_id: Option<String>,
    /// Workspace ID（必填，用于校验会话与工作区一致性）
    #[serde(alias = "workspaceId")]
    pub workspace_id: String,
    /// 是否强制开启联网搜索工具策略
    #[serde(default, alias = "webSearch")]
    pub web_search: Option<bool>,
    /// 联网搜索模式（disabled / allowed / required）
    #[serde(default, alias = "searchMode")]
    pub search_mode: Option<RequestToolPolicyMode>,
    /// 执行策略（react / code_orchestrated / auto）
    #[serde(default, alias = "executionStrategy")]
    pub execution_strategy: Option<AsterExecutionStrategy>,
    /// 自动续写策略（用于文稿续写等场景）
    #[serde(default, alias = "autoContinue")]
    pub auto_continue: Option<AutoContinuePayload>,
    /// 前端传入的 System Prompt（可选，优先级低于项目上下文）
    #[serde(default, alias = "systemPrompt")]
    pub system_prompt: Option<String>,
    /// 请求级元数据（可选，用于 harness / 主题工作台状态对齐）
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    /// 回合 ID（可选，由前端提供时透传到 Aster runtime）
    #[serde(default, alias = "turnId")]
    pub turn_id: Option<String>,
    /// 会话忙时是否进入后端队列
    #[serde(default, alias = "queueIfBusy")]
    pub queue_if_busy: Option<bool>,
    /// 队列项 ID（由前端或后端生成）
    #[serde(default, alias = "queuedTurnId")]
    pub queued_turn_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTurnConfigSnapshot {
    #[serde(default, alias = "providerConfig")]
    pub provider_config: Option<ConfigureProviderRequest>,
    #[serde(default, alias = "executionStrategy")]
    pub execution_strategy: Option<AsterExecutionStrategy>,
    #[serde(default, alias = "webSearch")]
    pub web_search: Option<bool>,
    #[serde(default, alias = "searchMode")]
    pub search_mode: Option<RequestToolPolicyMode>,
    #[serde(default, alias = "autoContinue")]
    pub auto_continue: Option<AutoContinuePayload>,
    #[serde(default, alias = "systemPrompt")]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeSubmitTurnRequest {
    pub message: String,
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "eventName")]
    pub event_name: String,
    #[serde(default)]
    pub images: Option<Vec<ImageInput>>,
    #[serde(alias = "workspaceId")]
    pub workspace_id: String,
    #[serde(default, alias = "turnConfig")]
    pub turn_config: Option<AgentTurnConfigSnapshot>,
    #[serde(default, alias = "turnId")]
    #[allow(dead_code)]
    pub turn_id: Option<String>,
    #[serde(default, alias = "queueIfBusy")]
    pub queue_if_busy: Option<bool>,
    #[serde(default, alias = "queuedTurnId")]
    pub queued_turn_id: Option<String>,
}

impl From<AgentRuntimeSubmitTurnRequest> for AsterChatRequest {
    fn from(request: AgentRuntimeSubmitTurnRequest) -> Self {
        let turn_config = request.turn_config;
        Self {
            message: request.message,
            session_id: request.session_id,
            event_name: request.event_name,
            images: request.images,
            provider_config: turn_config
                .as_ref()
                .and_then(|config| config.provider_config.clone()),
            project_id: None,
            workspace_id: request.workspace_id,
            web_search: turn_config.as_ref().and_then(|config| config.web_search),
            search_mode: turn_config.as_ref().and_then(|config| config.search_mode),
            execution_strategy: turn_config
                .as_ref()
                .and_then(|config| config.execution_strategy),
            auto_continue: turn_config
                .as_ref()
                .and_then(|config| config.auto_continue.clone()),
            system_prompt: turn_config
                .as_ref()
                .and_then(|config| config.system_prompt.clone()),
            metadata: turn_config.and_then(|config| config.metadata),
            turn_id: request.turn_id,
            queue_if_busy: request.queue_if_busy,
            queued_turn_id: request.queued_turn_id,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeInterruptTurnRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(default, alias = "turnId")]
    #[allow(dead_code)]
    pub turn_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeCompactSessionRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "eventName")]
    pub event_name: String,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeResumeThreadRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeReplayRequestRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "requestId")]
    pub request_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeRemoveQueuedTurnRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "queuedTurnId")]
    pub queued_turn_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimePromoteQueuedTurnRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "queuedTurnId")]
    pub queued_turn_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeSessionDetail {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub thread_id: String,
    pub messages: Vec<lime_agent::event_converter::TauriMessage>,
    pub execution_strategy: Option<String>,
    pub turns: Vec<lime_core::database::dao::agent_timeline::AgentThreadTurn>,
    pub items: Vec<lime_core::database::dao::agent_timeline::AgentThreadItem>,
    #[serde(default)]
    pub todo_items: Vec<lime_agent::SessionTodoItem>,
    #[serde(default)]
    pub queued_turns: Vec<QueuedTurnSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_read: Option<AgentRuntimeThreadReadModel>,
    #[serde(default)]
    pub child_subagent_sessions: Vec<lime_agent::ChildSubagentSession>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subagent_parent_context: Option<lime_agent::SubagentParentContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeRequestView {
    pub id: String,
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
    pub request_type: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeOutcomeView {
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    pub outcome_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_cause: Option<String>,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeIncidentView {
    pub id: String,
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
    pub incident_type: String,
    pub severity: String,
    pub status: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detected_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleared_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeThreadReadModel {
    pub thread_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_turn_id: Option<String>,
    #[serde(default)]
    pub pending_requests: Vec<AgentRuntimeRequestView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_outcome: Option<AgentRuntimeOutcomeView>,
    #[serde(default)]
    pub incidents: Vec<AgentRuntimeIncidentView>,
    #[serde(default)]
    pub queued_turns: Vec<QueuedTurnSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interrupt_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeReplayedActionRequiredView {
    #[serde(rename = "type")]
    pub event_type: String,
    pub request_id: String,
    pub action_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub questions: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requested_schema: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<AgentRuntimeActionScope>,
}

impl AgentRuntimeSessionDetail {
    pub(crate) fn from_session_detail_with_thread_read(
        detail: SessionDetail,
        queued_turns: Vec<QueuedTurnSnapshot>,
        thread_read: AgentRuntimeThreadReadModel,
    ) -> Self {
        Self {
            id: detail.id,
            name: detail.name,
            created_at: detail.created_at,
            updated_at: detail.updated_at,
            thread_id: detail.thread_id,
            messages: detail.messages,
            execution_strategy: detail.execution_strategy,
            turns: detail.turns,
            items: detail.items,
            todo_items: detail.todo_items,
            queued_turns,
            thread_read: Some(thread_read),
            child_subagent_sessions: detail.child_subagent_sessions,
            subagent_parent_context: detail.subagent_parent_context,
        }
    }
}

impl AgentRuntimeReplayedActionRequiredView {
    pub(crate) fn from_session_detail(detail: &SessionDetail, request_id: &str) -> Option<Self> {
        let trimmed_request_id = request_id.trim();
        if trimmed_request_id.is_empty() {
            return None;
        }

        detail.items.iter().rev().find_map(|item| {
            if !matches!(
                item.status,
                lime_core::database::dao::agent_timeline::AgentThreadItemStatus::InProgress
            ) {
                return None;
            }

            let scope = Some(AgentRuntimeActionScope {
                session_id: Some(detail.id.clone()),
                thread_id: Some(item.thread_id.clone()),
                turn_id: Some(item.turn_id.clone()),
            });

            match &item.payload {
                lime_core::database::dao::agent_timeline::AgentThreadItemPayload::ApprovalRequest {
                    request_id,
                    action_type,
                    prompt,
                    tool_name,
                    arguments,
                    ..
                } if request_id == trimmed_request_id => Some(Self {
                    event_type: "action_required".to_string(),
                    request_id: request_id.clone(),
                    action_type: action_type.clone(),
                    tool_name: tool_name.clone(),
                    arguments: arguments.clone(),
                    prompt: prompt.clone(),
                    questions: None,
                    requested_schema: None,
                    scope,
                }),
                lime_core::database::dao::agent_timeline::AgentThreadItemPayload::RequestUserInput {
                    request_id,
                    action_type,
                    prompt,
                    questions,
                    ..
                } if request_id == trimmed_request_id => Some(Self {
                    event_type: "action_required".to_string(),
                    request_id: request_id.clone(),
                    action_type: action_type.clone(),
                    tool_name: None,
                    arguments: None,
                    prompt: prompt.clone(),
                    questions: questions
                        .as_ref()
                        .and_then(|value| serde_json::to_value(value).ok()),
                    requested_schema: None,
                    scope,
                }),
                _ => None,
            }
        })
    }
}

impl AgentRuntimeThreadReadModel {
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn from_session_detail(
        detail: &SessionDetail,
        queued_turns: &[QueuedTurnSnapshot],
    ) -> Self {
        let pending_requests = build_pending_requests(detail);
        let last_outcome = build_last_outcome(detail);
        let incidents = build_incidents(detail, &pending_requests);
        Self::from_parts(
            detail,
            queued_turns,
            pending_requests,
            last_outcome,
            incidents,
        )
    }

    pub(crate) fn from_parts(
        detail: &SessionDetail,
        queued_turns: &[QueuedTurnSnapshot],
        pending_requests: Vec<AgentRuntimeRequestView>,
        last_outcome: Option<AgentRuntimeOutcomeView>,
        incidents: Vec<AgentRuntimeIncidentView>,
    ) -> Self {
        let latest_turn = detail.turns.last();
        let active_turn = detail
            .turns
            .iter()
            .rev()
            .find(|turn| {
                matches!(
                    turn.status,
                    lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Running
                )
            })
            .or(latest_turn);
        let status = if !pending_requests.is_empty() {
            "waiting_request".to_string()
        } else if active_turn
            .map(|turn| {
                matches!(
                    turn.status,
                    lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Running
                )
            })
            .unwrap_or(false)
        {
            "running".to_string()
        } else if let Some(turn) = latest_turn {
            turn.status.as_str().to_string()
        } else if !queued_turns.is_empty() {
            "queued".to_string()
        } else {
            "idle".to_string()
        };
        let interrupt_state = latest_turn.and_then(|turn| {
            if matches!(
                turn.status,
                lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Aborted
            ) {
                Some("interrupted".to_string())
            } else {
                None
            }
        });

        Self {
            thread_id: detail.thread_id.clone(),
            status,
            active_turn_id: active_turn.map(|turn| turn.id.clone()),
            pending_requests,
            last_outcome,
            incidents,
            queued_turns: queued_turns.to_vec(),
            interrupt_state,
            updated_at: latest_turn
                .map(|turn| turn.updated_at.clone())
                .or_else(|| Some(detail.updated_at.to_string())),
        }
    }
}

const APPROVAL_TIMEOUT_SECONDS: i64 = 180;
const USER_INPUT_TIMEOUT_SECONDS: i64 = 300;
const TURN_STUCK_TIMEOUT_SECONDS: i64 = 180;

fn parse_rfc3339_utc(raw: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|value| value.with_timezone(&Utc))
}

fn elapsed_seconds_since(raw: Option<&str>, now: &DateTime<Utc>) -> Option<i64> {
    let parsed = parse_rfc3339_utc(raw?)?;
    Some(now.signed_duration_since(parsed).num_seconds().max(0))
}

fn is_tool_confirmation_request(request_type: &str) -> bool {
    let normalized = request_type.to_ascii_lowercase();
    normalized.contains("tool") || normalized.contains("approval")
}

fn is_user_input_request(request_type: &str) -> bool {
    let normalized = request_type.to_ascii_lowercase();
    normalized.contains("ask") || normalized.contains("user") || normalized.contains("elicitation")
}

fn request_timeout_threshold_seconds(request: &AgentRuntimeRequestView) -> Option<i64> {
    if is_tool_confirmation_request(&request.request_type) {
        return Some(APPROVAL_TIMEOUT_SECONDS);
    }
    if is_user_input_request(&request.request_type) {
        return Some(USER_INPUT_TIMEOUT_SECONDS);
    }
    None
}

fn build_pending_request_incident(
    request: &AgentRuntimeRequestView,
    now: &DateTime<Utc>,
) -> AgentRuntimeIncidentView {
    let waited_seconds = elapsed_seconds_since(request.created_at.as_deref(), now).unwrap_or(0);
    let timeout_seconds =
        request_timeout_threshold_seconds(request).unwrap_or(USER_INPUT_TIMEOUT_SECONDS);
    let waited_minutes = ((waited_seconds + 59) / 60).max(1);
    let request_title = request
        .title
        .clone()
        .unwrap_or_else(|| "线程正在等待人工处理".to_string());

    let (incident_type, severity, title, details) =
        if is_tool_confirmation_request(&request.request_type) {
            if waited_seconds >= timeout_seconds {
                (
                    "approval_timeout".to_string(),
                    "high".to_string(),
                    "审批等待超过阈值".to_string(),
                    Some(serde_json::Value::String(format!(
                        "工具确认已等待 {waited_minutes} 分钟：{request_title}"
                    ))),
                )
            } else {
                (
                    "waiting_approval".to_string(),
                    "medium".to_string(),
                    "线程正在等待工具确认".to_string(),
                    Some(serde_json::Value::String(request_title)),
                )
            }
        } else if waited_seconds >= timeout_seconds {
            (
                "user_input_timeout".to_string(),
                "high".to_string(),
                "人工输入等待超过阈值".to_string(),
                Some(serde_json::Value::String(format!(
                    "人工输入已等待 {waited_minutes} 分钟：{request_title}"
                ))),
            )
        } else {
            (
                "waiting_user_input".to_string(),
                "medium".to_string(),
                "线程正在等待人工输入".to_string(),
                Some(serde_json::Value::String(request_title)),
            )
        };

    AgentRuntimeIncidentView {
        id: format!("incident-{}", request.id),
        thread_id: request.thread_id.clone(),
        turn_id: request.turn_id.clone(),
        item_id: request.item_id.clone(),
        incident_type,
        severity,
        status: "active".to_string(),
        title,
        details,
        detected_at: request.created_at.clone(),
        cleared_at: None,
    }
}

pub(crate) fn build_pending_requests(detail: &SessionDetail) -> Vec<AgentRuntimeRequestView> {
    detail
        .items
        .iter()
        .filter_map(|item| match &item.payload {
            lime_core::database::dao::agent_timeline::AgentThreadItemPayload::ApprovalRequest {
                request_id,
                action_type,
                prompt,
                tool_name,
                arguments,
                response,
            } if matches!(
                item.status,
                lime_core::database::dao::agent_timeline::AgentThreadItemStatus::InProgress
            ) =>
            {
                Some(AgentRuntimeRequestView {
                    id: request_id.clone(),
                    thread_id: item.thread_id.clone(),
                    turn_id: Some(item.turn_id.clone()),
                    item_id: Some(item.id.clone()),
                    request_type: action_type.clone(),
                    status: "pending".to_string(),
                    title: prompt
                        .clone()
                        .or_else(|| tool_name.as_ref().map(|value| format!("等待确认工具：{value}"))),
                    payload: arguments.clone(),
                    decision: response.clone(),
                    scope: Some(serde_json::json!({
                        "thread_id": item.thread_id,
                        "turn_id": item.turn_id,
                        "item_id": item.id,
                    })),
                    created_at: Some(item.started_at.clone()),
                    resolved_at: None,
                })
            }
            lime_core::database::dao::agent_timeline::AgentThreadItemPayload::RequestUserInput {
                request_id,
                action_type,
                prompt,
                questions,
                response,
            } if matches!(
                item.status,
                lime_core::database::dao::agent_timeline::AgentThreadItemStatus::InProgress
            ) =>
            {
                Some(AgentRuntimeRequestView {
                    id: request_id.clone(),
                    thread_id: item.thread_id.clone(),
                    turn_id: Some(item.turn_id.clone()),
                    item_id: Some(item.id.clone()),
                    request_type: action_type.clone(),
                    status: "pending".to_string(),
                    title: prompt.clone().or_else(|| {
                        questions
                            .as_ref()
                            .and_then(|items| items.first())
                            .map(|question| question.question.clone())
                    }),
                    payload: questions
                        .as_ref()
                        .and_then(|value| serde_json::to_value(value).ok()),
                    decision: response.clone(),
                    scope: Some(serde_json::json!({
                        "thread_id": item.thread_id,
                        "turn_id": item.turn_id,
                        "item_id": item.id,
                    })),
                    created_at: Some(item.started_at.clone()),
                    resolved_at: None,
                })
            }
            _ => None,
        })
        .collect()
}

pub(crate) fn build_last_outcome(detail: &SessionDetail) -> Option<AgentRuntimeOutcomeView> {
    let latest_turn = detail.turns.last()?;
    let latest_turn_summary = detail
        .items
        .iter()
        .rev()
        .find_map(|item| match &item.payload {
            lime_core::database::dao::agent_timeline::AgentThreadItemPayload::TurnSummary {
                text,
            } if item.turn_id == latest_turn.id => Some(text.clone()),
            _ => None,
        });
    let latest_failed_item = detail.items.iter().rev().find(|item| {
        item.turn_id == latest_turn.id
            && matches!(
                item.status,
                lime_core::database::dao::agent_timeline::AgentThreadItemStatus::Failed
            )
    });

    match latest_turn.status {
        lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Completed => {
            Some(AgentRuntimeOutcomeView {
                thread_id: latest_turn.thread_id.clone(),
                turn_id: Some(latest_turn.id.clone()),
                outcome_type: "completed".to_string(),
                summary: latest_turn_summary.or_else(|| Some("最近一次回合已稳定完成".to_string())),
                primary_cause: None,
                retryable: false,
                ended_at: latest_turn.completed_at.clone(),
            })
        }
        lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Aborted => {
            Some(AgentRuntimeOutcomeView {
                thread_id: latest_turn.thread_id.clone(),
                turn_id: Some(latest_turn.id.clone()),
                outcome_type: "interrupted".to_string(),
                summary: Some("最近一次回合已被中断".to_string()),
                primary_cause: None,
                retryable: true,
                ended_at: latest_turn.completed_at.clone(),
            })
        }
        lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Failed => {
            let (outcome_type, primary_cause) =
                classify_failed_turn(latest_turn, latest_failed_item);
            Some(AgentRuntimeOutcomeView {
                thread_id: latest_turn.thread_id.clone(),
                turn_id: Some(latest_turn.id.clone()),
                outcome_type,
                summary: latest_turn
                    .error_message
                    .clone()
                    .or_else(|| primary_cause.clone())
                    .or_else(|| Some("最近一次回合执行失败".to_string())),
                primary_cause,
                retryable: true,
                ended_at: latest_turn.completed_at.clone(),
            })
        }
        lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Running => None,
    }
}

fn classify_failed_turn(
    turn: &lime_core::database::dao::agent_timeline::AgentThreadTurn,
    failed_item: Option<&lime_core::database::dao::agent_timeline::AgentThreadItem>,
) -> (String, Option<String>) {
    if let Some(item) = failed_item {
        match &item.payload {
            lime_core::database::dao::agent_timeline::AgentThreadItemPayload::ToolCall {
                error, ..
            }
            | lime_core::database::dao::agent_timeline::AgentThreadItemPayload::CommandExecution {
                error, ..
            } => {
                return (
                    "failed_tool".to_string(),
                    error.clone().or_else(|| turn.error_message.clone()),
                );
            }
            lime_core::database::dao::agent_timeline::AgentThreadItemPayload::Error { message } => {
                return ("failed_tool".to_string(), Some(message.clone()));
            }
            _ => {}
        }
    }

    let lowered_error = turn
        .error_message
        .as_deref()
        .map(|value| value.to_lowercase())
        .unwrap_or_default();
    if lowered_error.contains("provider")
        || lowered_error.contains("rate limit")
        || lowered_error.contains("authentication")
        || lowered_error.contains("network")
        || lowered_error.contains("api")
    {
        return ("failed_provider".to_string(), turn.error_message.clone());
    }

    ("failed_model".to_string(), turn.error_message.clone())
}

pub(crate) fn build_incidents(
    detail: &SessionDetail,
    pending_requests: &[AgentRuntimeRequestView],
) -> Vec<AgentRuntimeIncidentView> {
    let now = Utc::now();

    if let Some(request) = pending_requests.first() {
        return vec![build_pending_request_incident(request, &now)];
    }

    let latest_turn = match detail.turns.last() {
        Some(value) => value,
        None => return Vec::new(),
    };

    if matches!(
        latest_turn.status,
        lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Failed
    ) {
        let latest_failed_item = detail.items.iter().rev().find(|item| {
            item.turn_id == latest_turn.id
                && matches!(
                    item.status,
                    lime_core::database::dao::agent_timeline::AgentThreadItemStatus::Failed
                )
        });
        let (outcome_type, primary_cause) = classify_failed_turn(latest_turn, latest_failed_item);
        let (incident_type, title) = match outcome_type.as_str() {
            "failed_tool" => ("tool_failed".to_string(), "工具执行失败".to_string()),
            "failed_provider" => (
                "provider_error".to_string(),
                "Provider 请求失败".to_string(),
            ),
            _ => (
                "turn_failed".to_string(),
                "最近一次回合执行失败".to_string(),
            ),
        };

        return vec![AgentRuntimeIncidentView {
            id: format!("incident-turn-failed-{}", latest_turn.id),
            thread_id: latest_turn.thread_id.clone(),
            turn_id: Some(latest_turn.id.clone()),
            item_id: latest_failed_item.map(|item| item.id.clone()),
            incident_type,
            severity: "high".to_string(),
            status: "active".to_string(),
            title,
            details: primary_cause.map(serde_json::Value::String),
            detected_at: Some(latest_turn.updated_at.clone()),
            cleared_at: None,
        }];
    }

    if matches!(
        latest_turn.status,
        lime_core::database::dao::agent_timeline::AgentThreadTurnStatus::Running
    ) && elapsed_seconds_since(Some(latest_turn.updated_at.as_str()), &now)
        .map(|value| value >= TURN_STUCK_TIMEOUT_SECONDS)
        .unwrap_or(false)
    {
        let waited_seconds =
            elapsed_seconds_since(Some(latest_turn.updated_at.as_str()), &now).unwrap_or(0);
        let waited_minutes = ((waited_seconds + 59) / 60).max(1);
        let prompt_preview = latest_turn.prompt_text.trim();
        let details = if prompt_preview.is_empty() {
            format!("最近 {waited_minutes} 分钟内没有新的线程更新，可尝试停止后恢复执行。")
        } else {
            format!(
                "回合“{prompt_preview}”最近 {waited_minutes} 分钟内没有新的线程更新，可尝试停止后恢复执行。"
            )
        };

        return vec![AgentRuntimeIncidentView {
            id: format!("incident-turn-stuck-{}", latest_turn.id),
            thread_id: latest_turn.thread_id.clone(),
            turn_id: Some(latest_turn.id.clone()),
            item_id: None,
            incident_type: "turn_stuck".to_string(),
            severity: "high".to_string(),
            status: "active".to_string(),
            title: "当前回合长时间无进展".to_string(),
            details: Some(serde_json::Value::String(details)),
            detected_at: Some(latest_turn.updated_at.clone()),
            cleared_at: None,
        }];
    }

    let latest_issue_item = detail.items.iter().rev().find(|item| match &item.payload {
        lime_core::database::dao::agent_timeline::AgentThreadItemPayload::Warning { .. }
        | lime_core::database::dao::agent_timeline::AgentThreadItemPayload::Error { .. } => true,
        _ => false,
    });

    match latest_issue_item {
        Some(item) => {
            let (incident_type, title, details, severity) = match &item.payload {
                lime_core::database::dao::agent_timeline::AgentThreadItemPayload::Warning {
                    message,
                    code,
                } => (
                    "runtime_warning".to_string(),
                    "时间线记录到警告项".to_string(),
                    Some(serde_json::json!({ "message": message, "code": code })),
                    "medium".to_string(),
                ),
                lime_core::database::dao::agent_timeline::AgentThreadItemPayload::Error {
                    message,
                } => (
                    "runtime_error".to_string(),
                    "时间线记录到异常项".to_string(),
                    Some(serde_json::json!({ "message": message })),
                    "high".to_string(),
                ),
                _ => unreachable!(),
            };
            vec![AgentRuntimeIncidentView {
                id: format!("incident-item-{}", item.id),
                thread_id: item.thread_id.clone(),
                turn_id: Some(item.turn_id.clone()),
                item_id: Some(item.id.clone()),
                incident_type,
                severity,
                status: "active".to_string(),
                title,
                details,
                detected_at: Some(item.updated_at.clone()),
                cleared_at: None,
            }]
        }
        None => Vec::new(),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentRuntimeSpawnSubagentRequest {
    #[serde(alias = "parentSessionId")]
    pub parent_session_id: String,
    pub message: String,
    #[serde(default, alias = "agentType")]
    pub agent_type: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default, alias = "reasoningEffort")]
    pub reasoning_effort: Option<String>,
    #[serde(default, alias = "forkContext")]
    pub fork_context: bool,
    #[serde(default, alias = "blueprintRoleId")]
    pub blueprint_role_id: Option<String>,
    #[serde(default, alias = "blueprintRoleLabel")]
    pub blueprint_role_label: Option<String>,
    #[serde(default, alias = "profileId")]
    pub profile_id: Option<String>,
    #[serde(default, alias = "profileName")]
    pub profile_name: Option<String>,
    #[serde(default, alias = "roleKey")]
    pub role_key: Option<String>,
    #[serde(default, alias = "skillIds")]
    pub skill_ids: Vec<String>,
    #[serde(default, alias = "skillDirectories")]
    pub skill_directories: Vec<String>,
    #[serde(default, alias = "teamPresetId")]
    pub team_preset_id: Option<String>,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default, alias = "systemOverlay")]
    pub system_overlay: Option<String>,
    #[serde(default, alias = "outputContract")]
    pub output_contract: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeSpawnSubagentResponse {
    #[serde(alias = "agentId")]
    pub agent_id: String,
    #[serde(default)]
    pub nickname: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentRuntimeSendSubagentInputRequest {
    pub id: String,
    pub message: String,
    #[serde(default)]
    pub interrupt: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeSendSubagentInputResponse {
    #[serde(alias = "submissionId")]
    pub submission_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentRuntimeWaitSubagentsRequest {
    pub ids: Vec<String>,
    #[serde(default, alias = "timeoutMs")]
    pub timeout_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeWaitSubagentsResponse {
    pub status: HashMap<String, SubagentRuntimeStatus>,
    pub timed_out: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentRuntimeResumeSubagentRequest {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeResumeSubagentResponse {
    pub status: SubagentRuntimeStatus,
    pub cascade_session_ids: Vec<String>,
    pub changed_session_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentRuntimeCloseSubagentRequest {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeCloseSubagentResponse {
    pub previous_status: SubagentRuntimeStatus,
    pub cascade_session_ids: Vec<String>,
    pub changed_session_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentRuntimeActionType {
    ToolConfirmation,
    AskUser,
    Elicitation,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentRuntimeActionScope {
    #[serde(default, alias = "sessionId")]
    pub session_id: Option<String>,
    #[serde(default, alias = "threadId")]
    pub thread_id: Option<String>,
    #[serde(default, alias = "turnId")]
    pub turn_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeRespondActionRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(alias = "requestId")]
    pub request_id: String,
    #[serde(alias = "actionType")]
    pub action_type: AgentRuntimeActionType,
    pub confirmed: bool,
    #[serde(default)]
    pub response: Option<String>,
    #[serde(default, alias = "userData")]
    pub user_data: Option<serde_json::Value>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default, alias = "eventName")]
    pub event_name: Option<String>,
    #[serde(default, alias = "actionScope")]
    pub action_scope: Option<AgentRuntimeActionScope>,
}

#[derive(Debug, Deserialize)]
pub struct AgentRuntimeUpdateSessionRequest {
    #[serde(alias = "sessionId")]
    pub session_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, alias = "executionStrategy")]
    pub execution_strategy: Option<AsterExecutionStrategy>,
}

/// 自动续写参数
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutoContinuePayload {
    /// 主开关
    pub enabled: bool,
    /// 快速模式
    #[serde(default, alias = "fastModeEnabled")]
    pub fast_mode_enabled: bool,
    /// 续写长度：0=短、1=中、2=长
    #[serde(default, alias = "continuationLength")]
    pub continuation_length: u8,
    /// 灵敏度：0-100
    #[serde(default)]
    pub sensitivity: u8,
    /// 来源标识
    #[serde(default)]
    pub source: Option<String>,
}

impl AutoContinuePayload {
    pub(crate) fn normalized(mut self) -> Self {
        self.continuation_length = self.continuation_length.min(2);
        self.sensitivity = self.sensitivity.min(100);
        self.source = self
            .source
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        self
    }

    pub(crate) fn length_instruction(&self) -> &'static str {
        match self.continuation_length.min(2) {
            0 => "短（补全 1-2 段，聚焦核心信息）",
            1 => "中（补全 3-5 段，兼顾结构与细节）",
            _ => "长（扩展为可发布草稿，结构完整）",
        }
    }

    pub(crate) fn sensitivity_instruction(&self) -> &'static str {
        match self.sensitivity.min(100) {
            0..=33 => "低：优先稳健延续原文表达",
            34..=66 => "中：保持一致性并适度优化表达",
            _ => "高：在不偏题前提下积极补充观点亮点",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use lime_agent::queued_turn::QueuedTurnSnapshot;
    use lime_core::database::dao::agent_timeline::{
        AgentRequestQuestion, AgentThreadItem, AgentThreadItemPayload, AgentThreadItemStatus,
        AgentThreadTurn, AgentThreadTurnStatus,
    };

    fn build_session_detail(
        turns: Vec<AgentThreadTurn>,
        items: Vec<AgentThreadItem>,
    ) -> SessionDetail {
        SessionDetail {
            id: "session-1".to_string(),
            name: "测试会话".to_string(),
            created_at: 1,
            updated_at: 2,
            thread_id: "thread-1".to_string(),
            model: None,
            working_dir: None,
            workspace_id: None,
            messages: Vec::new(),
            execution_strategy: None,
            turns,
            items,
            todo_items: Vec::new(),
            child_subagent_sessions: Vec::new(),
            subagent_parent_context: None,
        }
    }

    fn seconds_ago(seconds: i64) -> String {
        (Utc::now() - Duration::seconds(seconds)).to_rfc3339()
    }

    #[test]
    fn thread_read_should_expose_pending_request_and_waiting_incident() {
        let detail = build_session_detail(
            vec![AgentThreadTurn {
                id: "turn-1".to_string(),
                thread_id: "thread-1".to_string(),
                prompt_text: "继续发布".to_string(),
                status: AgentThreadTurnStatus::Running,
                started_at: seconds_ago(20),
                completed_at: None,
                error_message: None,
                created_at: seconds_ago(20),
                updated_at: seconds_ago(10),
            }],
            vec![AgentThreadItem {
                id: "item-1".to_string(),
                thread_id: "thread-1".to_string(),
                turn_id: "turn-1".to_string(),
                sequence: 1,
                status: AgentThreadItemStatus::InProgress,
                started_at: seconds_ago(15),
                completed_at: None,
                updated_at: seconds_ago(15),
                payload: AgentThreadItemPayload::RequestUserInput {
                    request_id: "req-1".to_string(),
                    action_type: "ask_user".to_string(),
                    prompt: Some("请确认是否继续发布".to_string()),
                    questions: Some(vec![AgentRequestQuestion {
                        question: "是否继续？".to_string(),
                        header: None,
                        options: None,
                        multi_select: None,
                    }]),
                    response: None,
                },
            }],
        );

        let thread_read = AgentRuntimeThreadReadModel::from_session_detail(&detail, &[]);

        assert_eq!(thread_read.status, "waiting_request");
        assert_eq!(thread_read.active_turn_id.as_deref(), Some("turn-1"));
        assert_eq!(thread_read.pending_requests.len(), 1);
        assert_eq!(thread_read.pending_requests[0].id, "req-1");
        assert_eq!(thread_read.incidents.len(), 1);
        assert_eq!(thread_read.incidents[0].incident_type, "waiting_user_input");
    }

    #[test]
    fn thread_read_should_escalate_tool_confirmation_timeout() {
        let detail = build_session_detail(
            vec![AgentThreadTurn {
                id: "turn-timeout".to_string(),
                thread_id: "thread-1".to_string(),
                prompt_text: "继续执行工具调用".to_string(),
                status: AgentThreadTurnStatus::Running,
                started_at: seconds_ago(400),
                completed_at: None,
                error_message: None,
                created_at: seconds_ago(400),
                updated_at: seconds_ago(200),
            }],
            vec![AgentThreadItem {
                id: "item-timeout".to_string(),
                thread_id: "thread-1".to_string(),
                turn_id: "turn-timeout".to_string(),
                sequence: 1,
                status: AgentThreadItemStatus::InProgress,
                started_at: seconds_ago(APPROVAL_TIMEOUT_SECONDS + 60),
                completed_at: None,
                updated_at: seconds_ago(APPROVAL_TIMEOUT_SECONDS + 60),
                payload: AgentThreadItemPayload::ApprovalRequest {
                    request_id: "req-timeout".to_string(),
                    action_type: "tool_confirmation".to_string(),
                    prompt: Some("请确认是否执行 apply_patch".to_string()),
                    tool_name: Some("apply_patch".to_string()),
                    arguments: None,
                    response: None,
                },
            }],
        );

        let thread_read = AgentRuntimeThreadReadModel::from_session_detail(&detail, &[]);

        assert_eq!(thread_read.status, "waiting_request");
        assert_eq!(thread_read.incidents.len(), 1);
        assert_eq!(thread_read.incidents[0].incident_type, "approval_timeout");
        assert_eq!(thread_read.incidents[0].severity, "high");
    }

    #[test]
    fn thread_read_should_expose_failed_outcome_and_queue_snapshot() {
        let detail = build_session_detail(
            vec![AgentThreadTurn {
                id: "turn-2".to_string(),
                thread_id: "thread-1".to_string(),
                prompt_text: "执行外部调用".to_string(),
                status: AgentThreadTurnStatus::Failed,
                started_at: "2026-03-23T09:10:00Z".to_string(),
                completed_at: Some("2026-03-23T09:10:30Z".to_string()),
                error_message: Some("Provider 错误: rate limit".to_string()),
                created_at: "2026-03-23T09:10:00Z".to_string(),
                updated_at: "2026-03-23T09:10:30Z".to_string(),
            }],
            Vec::new(),
        );
        let queued_turns = vec![QueuedTurnSnapshot {
            queued_turn_id: "queued-1".to_string(),
            message_preview: "继续重试".to_string(),
            message_text: "继续重试 provider 请求".to_string(),
            created_at: 1_742_721_830,
            image_count: 0,
            position: 1,
        }];

        let thread_read = AgentRuntimeThreadReadModel::from_session_detail(&detail, &queued_turns);

        assert_eq!(thread_read.status, "failed");
        assert_eq!(thread_read.queued_turns.len(), 1);
        assert_eq!(
            thread_read
                .last_outcome
                .as_ref()
                .map(|value| value.outcome_type.as_str()),
            Some("failed_provider")
        );
        assert_eq!(thread_read.incidents.len(), 1);
        assert_eq!(thread_read.incidents[0].incident_type, "provider_error");
    }

    #[test]
    fn thread_read_should_classify_running_turn_stuck() {
        let detail = build_session_detail(
            vec![AgentThreadTurn {
                id: "turn-stuck".to_string(),
                thread_id: "thread-1".to_string(),
                prompt_text: "长时间执行无响应".to_string(),
                status: AgentThreadTurnStatus::Running,
                started_at: seconds_ago(TURN_STUCK_TIMEOUT_SECONDS + 120),
                completed_at: None,
                error_message: None,
                created_at: seconds_ago(TURN_STUCK_TIMEOUT_SECONDS + 120),
                updated_at: seconds_ago(TURN_STUCK_TIMEOUT_SECONDS + 30),
            }],
            Vec::new(),
        );

        let thread_read = AgentRuntimeThreadReadModel::from_session_detail(&detail, &[]);

        assert_eq!(thread_read.status, "running");
        assert_eq!(thread_read.incidents.len(), 1);
        assert_eq!(thread_read.incidents[0].incident_type, "turn_stuck");
        assert_eq!(thread_read.incidents[0].severity, "high");
    }

    #[test]
    fn replay_request_should_rebuild_pending_action_payload() {
        let detail = build_session_detail(
            vec![AgentThreadTurn {
                id: "turn-replay".to_string(),
                thread_id: "thread-1".to_string(),
                prompt_text: "继续等待输入".to_string(),
                status: AgentThreadTurnStatus::Running,
                started_at: seconds_ago(30),
                completed_at: None,
                error_message: None,
                created_at: seconds_ago(30),
                updated_at: seconds_ago(10),
            }],
            vec![AgentThreadItem {
                id: "item-replay".to_string(),
                thread_id: "thread-1".to_string(),
                turn_id: "turn-replay".to_string(),
                sequence: 1,
                status: AgentThreadItemStatus::InProgress,
                started_at: seconds_ago(20),
                completed_at: None,
                updated_at: seconds_ago(15),
                payload: AgentThreadItemPayload::RequestUserInput {
                    request_id: "req-replay".to_string(),
                    action_type: "ask_user".to_string(),
                    prompt: Some("请确认是否继续发布".to_string()),
                    questions: Some(vec![AgentRequestQuestion {
                        question: "是否继续？".to_string(),
                        header: None,
                        options: None,
                        multi_select: None,
                    }]),
                    response: None,
                },
            }],
        );

        let replayed =
            AgentRuntimeReplayedActionRequiredView::from_session_detail(&detail, "req-replay")
                .expect("应能重建 replay 请求");

        assert_eq!(replayed.event_type, "action_required");
        assert_eq!(replayed.request_id, "req-replay");
        assert_eq!(replayed.action_type, "ask_user");
        assert_eq!(replayed.prompt.as_deref(), Some("请确认是否继续发布"));
        assert!(replayed.questions.is_some());
        assert_eq!(
            replayed.scope.and_then(|scope| scope.turn_id),
            Some("turn-replay".to_string())
        );
    }
}
