//! 请求级工具策略服务（兼容层）
//!
//! 真实实现已迁移到 `proxycast-agent::request_tool_policy`，
//! 此处保留旧路径仅用于兼容主 crate 既有调用与测试引用。

pub use proxycast_agent::request_tool_policy::{
    execute_web_search_preflight_if_needed, merge_system_prompt_with_request_tool_policy,
    resolve_request_tool_policy, stream_reply_with_policy, ReplyAttemptError, RequestToolPolicy,
    StreamReplyExecution, WebSearchExecutionTracker, REQUEST_TOOL_POLICY_MARKER,
};
