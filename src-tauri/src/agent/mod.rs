//! AI Agent 集成模块
//!
//! 纯逻辑部分已迁移到 lime-agent crate，
//! 本模块保留深耦合部分（Aster 状态与 Tauri 桥接）。

mod aster_agent;
pub mod aster_state;
mod credential_bridge;
pub mod runtime_queue_service;
mod subagent_scheduler;

// 从 lime-agent crate re-export
pub use lime_agent::event_converter;
pub use lime_agent::mcp_bridge;
pub use lime_agent::prompt;

// types 已迁移到 lime-core
pub use lime_core::agent::types;
pub use lime_core::agent::types::*;

pub use aster_agent::{AsterAgentWrapper, SessionDetail, SessionInfo};
pub use aster_state::AsterAgentState;
pub use credential_bridge::{
    create_aster_provider, AsterProviderConfig, CredentialBridge, CredentialBridgeError,
};
pub use lime_agent::{
    convert_agent_event, convert_to_tauri_message, initialize_aster_runtime, QueuedTurnSnapshot,
    QueuedTurnTask, TauriAgentEvent,
};
pub use subagent_scheduler::{
    LimeScheduler, LimeSubAgentExecutor, SubAgentProgressEvent, SubAgentRole,
};
