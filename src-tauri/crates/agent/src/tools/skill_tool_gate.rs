//! Skill 工具门禁包装器
//!
//! 目标：
//! - 避免通用对话默认向模型暴露全部本地 Skills
//! - 保留显式工作流对 Skill 工具的按会话放行能力

use aster::tools::{PermissionCheckResult, SkillTool, Tool, ToolContext, ToolError, ToolResult};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

fn session_access_store() -> &'static Mutex<HashMap<String, bool>> {
    static STORE: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn set_skill_tool_session_access(session_id: &str, enabled: bool) {
    let session_id = session_id.trim();
    if session_id.is_empty() {
        return;
    }

    let store = session_access_store();
    let mut guard = match store.lock() {
        Ok(guard) => guard,
        Err(error) => error.into_inner(),
    };
    guard.insert(session_id.to_string(), enabled);
}

pub fn clear_skill_tool_session_access(session_id: &str) {
    let session_id = session_id.trim();
    if session_id.is_empty() {
        return;
    }

    let store = session_access_store();
    let mut guard = match store.lock() {
        Ok(guard) => guard,
        Err(error) => error.into_inner(),
    };
    guard.remove(session_id);
}

fn is_skill_tool_enabled_for_session(session_id: &str) -> bool {
    let session_id = session_id.trim();
    if session_id.is_empty() {
        return false;
    }

    let store = session_access_store();
    let guard = match store.lock() {
        Ok(guard) => guard,
        Err(error) => error.into_inner(),
    };
    guard.get(session_id).copied().unwrap_or(false)
}

fn skill_tool_disabled_message() -> &'static str {
    "当前会话未启用技能自动调用。请改用显式 /skill-name 指令，或切换到需要技能编排的工作流。"
}

pub struct ProxycastSkillTool {
    inner: SkillTool,
}

impl ProxycastSkillTool {
    pub fn new() -> Self {
        Self {
            inner: SkillTool::new(),
        }
    }
}

impl Default for ProxycastSkillTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for ProxycastSkillTool {
    fn name(&self) -> &str {
        self.inner.name()
    }

    fn description(&self) -> &str {
        "在显式启用的工作流中执行技能。通用对话默认不会暴露技能自动调用能力。"
    }

    fn input_schema(&self) -> Value {
        self.inner.input_schema()
    }

    async fn execute(&self, params: Value, context: &ToolContext) -> Result<ToolResult, ToolError> {
        if !is_skill_tool_enabled_for_session(&context.session_id) {
            return Err(ToolError::execution_failed(skill_tool_disabled_message()));
        }

        self.inner.execute(params, context).await
    }

    async fn check_permissions(
        &self,
        params: &Value,
        context: &ToolContext,
    ) -> PermissionCheckResult {
        if !is_skill_tool_enabled_for_session(&context.session_id) {
            return PermissionCheckResult::deny(skill_tool_disabled_message());
        }

        self.inner.check_permissions(params, context).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aster::tools::PermissionBehavior;

    fn create_context(session_id: &str) -> ToolContext {
        ToolContext::default().with_session_id(session_id)
    }

    #[tokio::test]
    async fn disabled_session_should_deny_skill_tool() {
        let session_id = "skill-disabled-session";
        clear_skill_tool_session_access(session_id);

        let tool = ProxycastSkillTool::new();
        let result = tool
            .check_permissions(
                &serde_json::json!({ "skill": "research" }),
                &create_context(session_id),
            )
            .await;

        assert_eq!(result.behavior, PermissionBehavior::Deny);
        assert_eq!(
            result.message.as_deref(),
            Some(skill_tool_disabled_message())
        );
    }

    #[tokio::test]
    async fn enabled_session_should_allow_skill_tool() {
        let session_id = "skill-enabled-session";
        set_skill_tool_session_access(session_id, true);

        let tool = ProxycastSkillTool::new();
        let result = tool
            .check_permissions(
                &serde_json::json!({ "skill": "research" }),
                &create_context(session_id),
            )
            .await;

        clear_skill_tool_session_access(session_id);

        assert_eq!(result.behavior, PermissionBehavior::Allow);
    }

    #[tokio::test]
    async fn disabled_session_should_fail_execute() {
        let session_id = "skill-execute-disabled-session";
        clear_skill_tool_session_access(session_id);

        let tool = ProxycastSkillTool::new();
        let error = tool
            .execute(
                serde_json::json!({ "skill": "research" }),
                &create_context(session_id),
            )
            .await
            .expect_err("disabled session should reject execute");

        assert!(error.to_string().contains("未启用技能自动调用"));
    }
}
