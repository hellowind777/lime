//! Lime Agent Crate
//!
//! 包含 Agent 模块中不依赖主 crate 内部模块的纯逻辑部分。
//! 深耦合部分（aster_state、aster_agent 流式桥接）留在主 crate。

#![allow(clippy::explicit_counter_loop)]
#![allow(clippy::unnecessary_map_or)]
#![allow(clippy::to_string_in_format_args)]
#![allow(clippy::match_like_matches_macro)]
#![allow(clippy::derivable_impls)]
#![allow(clippy::borrowed_box)]

pub mod ask_bridge;
pub mod aster_runtime_support;
pub mod aster_state;
pub mod aster_state_support;
pub mod credential_bridge;
pub mod durable_memory_fs;
pub mod event_converter;
pub mod hooks;
pub mod lsp_bridge;
pub mod mcp_bridge;
pub mod prompt;
pub mod queued_turn;
pub mod request_tool_policy;
pub mod runtime_queue;
mod session_store;
pub mod shell_security;
pub mod skill_execution;
pub mod subagent_scheduler;
pub mod tool_io_offload;
pub mod tool_permissions;
pub mod tools;
mod write_artifact_events;

pub use ask_bridge::{create_ask_callback, extract_response as extract_ask_response};
pub use aster_runtime_support::initialize_aster_runtime;
pub use aster_state::{AsterAgentState, ProviderConfig, QueuedTurnTask};
pub use aster_state_support::{
    build_project_system_prompt, create_lime_identity, create_lime_tool_config, message_helpers,
    reload_lime_skills, SessionConfigBuilder,
};
pub use credential_bridge::{
    create_aster_provider, AsterProviderConfig, CredentialBridge, CredentialBridgeError,
};
pub use durable_memory_fs::{
    durable_memory_permission_pattern, is_virtual_memory_path, resolve_durable_memory_root,
    resolve_virtual_memory_path, to_virtual_memory_path, virtual_memory_relative_path,
    DURABLE_MEMORY_VIRTUAL_ROOT, LEGACY_DURABLE_MEMORY_ROOT_ENV, LIME_DURABLE_MEMORY_ROOT_ENV,
};
pub use event_converter::{
    convert_agent_event, convert_item_runtime, convert_to_tauri_message, convert_turn_runtime,
    TauriAgentEvent, TauriArtifactSnapshot, TauriRuntimeStatus,
};
pub use lsp_bridge::create_lsp_callback;
pub use prompt::SystemPromptBuilder;
pub use queued_turn::QueuedTurnSnapshot;
pub use request_tool_policy::{
    execute_web_search_preflight_if_needed, merge_system_prompt_with_request_tool_policy,
    merge_system_prompt_with_web_search_preflight_context, message_suggests_news_expansion,
    resolve_request_tool_policy, resolve_request_tool_policy_with_mode, stream_reply_with_policy,
    ReplyAttemptError, RequestToolPolicy, RequestToolPolicyMode, StreamReplyExecution,
    WebSearchExecutionTracker, REQUEST_TOOL_POLICY_MARKER,
};
pub use runtime_queue::{
    clear_runtime_queue, list_runtime_queue_snapshots, remove_runtime_queued_turn,
    resume_persisted_runtime_queues_on_startup, resume_runtime_queue_if_needed,
    submit_runtime_turn, RuntimeQueueEventEmitter, RuntimeQueueExecutor,
};
pub use session_store::{
    create_session_sync, delete_session, get_persisted_session_metadata_sync,
    get_runtime_session_detail, get_session_sync, list_sessions_sync,
    list_title_preview_messages_sync, rename_session_sync, update_session_execution_strategy_sync,
    update_session_working_dir_sync, PersistedSessionMetadata, SessionDetail, SessionInfo,
    SessionTitlePreviewMessage, SessionTodoItem,
};
pub use shell_security::ShellSecurityChecker;
pub use skill_execution::{
    execute_skill_prompt, execute_skill_workflow, SkillEventEmitter, SkillExecutionError,
    SkillExecutionResult, SkillWorkflowExecution, StepResult,
};
pub use subagent_scheduler::{
    LimeScheduler, LimeSubAgentExecutor, SchedulerEventEmitter, SubAgentProgressEvent, SubAgentRole,
};
pub use tool_permissions::{DynamicPermissionCheck, PermissionBehavior};
pub use tools::{BrowserAction, BrowserTool, BrowserToolError, BrowserToolResult};
pub use write_artifact_events::WriteArtifactEventEmitter;
