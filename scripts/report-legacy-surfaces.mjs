#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import agentCommandCatalog from "../src/lib/governance/agentCommandCatalog.json" with { type: "json" };

const repoRoot = path.resolve(process.cwd());
const sourceRoots = ["src"];
const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const rustSourceRoots = ["src-tauri/src", "src-tauri/crates"];
const rustSourceExtensions = new Set([".rs"]);
const ignoredDirs = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "target",
  ".git",
  ".turbo",
  ".next",
]);

const agentLegacyCommandSurfaceMonitors =
  agentCommandCatalog.legacyCommandSurfaceMonitors;

const agentLegacyHelperSurfaceMonitors = (
  agentCommandCatalog.legacyHelperSurfaceMonitors ?? []
).map(({ helpers, ...monitor }) => ({
  ...monitor,
  patterns: helpers.map((helper) => `${helper}(`),
}));

const importSurfaceMonitors = [
  {
    id: "general-chat-root-entry",
    classification: "dead-candidate",
    description: "已删除的旧 general-chat 根导出入口",
    targets: ["src/components/general-chat/index.ts"],
    allowedPaths: [],
  },
  {
    id: "general-chat-page-entry",
    classification: "dead-candidate",
    description: "已删除的旧 general-chat 页面实现入口",
    targets: ["src/components/general-chat/GeneralChatPage.tsx"],
    allowedPaths: [],
  },
  {
    id: "general-chat-legacy-session-hook",
    classification: "dead-candidate",
    description: "旧 general-chat 会话兼容 Hook",
    targets: ["src/components/general-chat/hooks/useSession.ts"],
    allowedPaths: [],
  },
  {
    id: "general-chat-legacy-streaming-hook",
    classification: "dead-candidate",
    description: "已删除的旧 general-chat 流式兼容 Hook",
    targets: ["src/components/general-chat/hooks/useStreaming.ts"],
    allowedPaths: [],
  },
  {
    id: "general-chat-compat-gateway",
    classification: "dead-candidate",
    description: "general-chat compat API 网关",
    targets: ["src/lib/api/generalChatCompat.ts"],
    allowedPaths: [],
  },
  {
    id: "agent-compat-gateway",
    classification: "dead-candidate",
    description: "已删除的 Agent / Aster compat API 网关",
    targets: ["src/lib/api/agentCompat.ts"],
    allowedPaths: [],
  },
  {
    id: "agent-api-facade-entry",
    classification: "dead-candidate",
    description: "已删除 Agent API 门面入口",
    targets: ["src/lib/api/agent.ts"],
    allowedPaths: [],
  },
  {
    id: "agent-legacy-hook-entry",
    classification: "dead-candidate",
    description: "旧 Agent Chat Hook 入口",
    targets: ["src/components/agent/chat/hooks/useAgentChat.ts"],
    allowedPaths: [],
  },
  {
    id: "heartbeat-api-gateway",
    classification: "dead-candidate",
    description: "已删除的旧 heartbeat 前端 API 入口",
    targets: ["src/lib/api/heartbeat.ts"],
    allowedPaths: [],
  },
  {
    id: "heartbeat-settings-page-entry",
    classification: "dead-candidate",
    description: "已删除的旧 heartbeat 设置页入口",
    targets: ["src/components/settings-v2/system/heartbeat/index.tsx"],
    allowedPaths: [],
  },
  {
    id: "assistant-settings-page-entry",
    classification: "dead-candidate",
    description: "已删除的旧助理服务设置页入口",
    targets: ["src/components/settings-v2/agent/assistant/index.tsx"],
    allowedPaths: [],
  },
  {
    id: "stores-root-barrel-entry",
    classification: "dead-candidate",
    description: "旧 stores 根 barrel 入口",
    targets: ["src/stores/index.ts"],
    allowedPaths: [],
  },
  {
    id: "agent-legacy-store-entry",
    classification: "dead-candidate",
    description: "旧 Agent Zustand store 入口",
    targets: ["src/stores/agentStore.ts"],
    allowedPaths: [],
  },
  {
    id: "use-unified-chat-compat-hook",
    classification: "dead-candidate",
    description: "useUnifiedChat compat Hook 入口",
    targets: ["src/hooks/useUnifiedChat.ts"],
    allowedPaths: [],
  },
  {
    id: "unified-chat-compat-gateway",
    classification: "dead-candidate",
    description: "unified-chat compat API 网关",
    targets: ["src/lib/api/unified-chat.ts"],
    allowedPaths: [],
  },
  {
    id: "three-stage-workflow-hook-entry",
    classification: "dead-candidate",
    description: "旧 three-stage workflow React Hook 入口",
    targets: ["src/hooks/useThreeStageWorkflow.ts"],
    allowedPaths: [],
  },
  {
    id: "three-stage-workflow-manager-entry",
    classification: "dead-candidate",
    description: "旧 three-stage workflow 管理器入口",
    targets: ["src/lib/workflow/threeStageWorkflow.ts"],
    allowedPaths: [],
  },
  {
    id: "tool-hooks-api-gateway",
    classification: "dead-candidate",
    description: "旧 tool hooks 前端 API 网关",
    targets: ["src/lib/api/toolHooks.ts"],
    allowedPaths: [],
  },
  {
    id: "context-memory-legacy-api-gateway",
    classification: "dead-candidate",
    description: "旧 context memory 前端 API 网关",
    targets: ["src/lib/api/contextMemory.ts"],
    allowedPaths: [],
  },
  {
    id: "team-subagent-scheduler-hook",
    classification: "compat",
    description: "旧 SubAgent scheduler Hook 只允许停留在 compat 展示层",
    targets: ["src/hooks/useSubAgentScheduler.ts"],
    allowedPaths: [
      "src/components/agent/chat/hooks/useCompatSubagentRuntime.ts",
      "src/components/subagent/SubAgentProgress.tsx",
      "src/components/subagent/index.ts",
    ],
  },
  {
    id: "team-subagent-scheduler-api",
    classification: "compat",
    description: "旧 SubAgent scheduler API 只允许被 compat Hook 与降级展示层引用",
    targets: ["src/lib/api/subAgentScheduler.ts"],
    allowedPaths: [
      "src/hooks/useSubAgentScheduler.ts",
      "src/components/agent/chat/utils/compatSubagentRuntime.ts",
    ],
  },
];

const commandSurfaceMonitors = [
  ...agentLegacyCommandSurfaceMonitors,
  {
    id: "general-chat-compat-commands",
    classification: "dead-candidate",
    description: "已零引用的 general_chat compat 命令前端边界",
    commands: [
      "general_chat_get_session",
      "general_chat_list_sessions",
      "general_chat_create_session",
      "general_chat_delete_session",
      "general_chat_rename_session",
      "general_chat_get_messages",
    ],
    allowedPaths: [],
  },
  {
    id: "conversation-memory-legacy-commands",
    classification: "dead-candidate",
    description: "已零引用的旧 conversation memory 命令前端边界",
    commands: [
      "get_conversation_memory_overview",
      "get_conversation_memory_stats",
      "request_conversation_memory_analysis",
      "cleanup_conversation_memory",
    ],
    allowedPaths: [],
  },
  {
    id: "context-memory-legacy-commands",
    classification: "dead-candidate",
    description: "旧 context memory 命令前端边界",
    commands: [
      "save_memory_entry",
      "get_session_memories",
      "get_memory_context",
      "record_error",
      "should_avoid_operation",
      "mark_error_resolved",
      "get_memory_stats",
      "cleanup_expired_memories",
    ],
    allowedPaths: [],
  },
  {
    id: "chat-compat-commands",
    classification: "dead-candidate",
    description: "chat_* compat 命令前端边界",
    commands: [
      "chat_create_session",
      "chat_list_sessions",
      "chat_get_session",
      "chat_delete_session",
      "chat_rename_session",
      "chat_get_messages",
      "chat_send_message",
      "chat_stop_generation",
      "chat_configure_provider",
    ],
    allowedPaths: [],
  },
  {
    id: "prompt-switch-legacy-command",
    classification: "dead-candidate",
    description: "已零引用的旧 prompt 切换命令前端边界",
    commands: ["switch_prompt"],
    allowedPaths: [],
  },
  {
    id: "api-key-legacy-migration-commands",
    classification: "dead-candidate",
    description: "已零引用的旧 API Key 迁移命令前端边界",
    commands: [
      "get_legacy_api_key_credentials",
      "migrate_legacy_api_key_credentials",
      "delete_legacy_api_key_credential",
    ],
    allowedPaths: [],
  },
  {
    id: "heartbeat-legacy-commands",
    classification: "dead-candidate",
    description: "已零引用的旧 heartbeat 命令前端边界",
    commands: [
      "get_heartbeat_config",
      "update_heartbeat_config",
      "get_heartbeat_status",
      "get_heartbeat_tasks",
      "add_heartbeat_task",
      "delete_heartbeat_task",
      "update_heartbeat_task",
      "get_heartbeat_history",
      "get_heartbeat_execution_detail",
      "get_heartbeat_task_health",
      "deliver_heartbeat_task_health_alerts",
      "trigger_heartbeat_now",
      "get_task_templates",
      "apply_task_template",
      "generate_content_creator_tasks",
      "preview_heartbeat_schedule",
      "validate_heartbeat_schedule",
    ],
    allowedPaths: [],
  },
  {
    id: "tool-hooks-legacy-commands",
    classification: "dead-candidate",
    description: "旧 tool hooks 命令前端边界",
    commands: [
      "execute_hooks",
      "add_hook_rule",
      "remove_hook_rule",
      "toggle_hook_rule",
      "get_hook_rules",
      "get_hook_execution_stats",
      "clear_hook_execution_stats",
    ],
    allowedPaths: [],
  },
  {
    id: "team-subagent-scheduler-commands",
    classification: "compat",
    description: "旧 execute_subagent_tasks/cancel_subagent_tasks 只允许通过 compat API 网关暴露",
    commands: ["execute_subagent_tasks", "cancel_subagent_tasks"],
    allowedPaths: ["src/lib/api/subAgentScheduler.ts"],
  },
];

const frontendTextSurfaceMonitors = [
  ...agentLegacyHelperSurfaceMonitors,
  {
    id: "frontend-subagent-scheduler-event-bus",
    classification: "compat",
    description: "旧 subagent scheduler 事件名只允许 compat Hook 持有",
    patterns: ["subagent-scheduler-event"],
    allowedPaths: ["src/hooks/useSubAgentScheduler.ts"],
  },
  {
    id: "frontend-assistant-settings-surfaces",
    classification: "dead-candidate",
    description: "已零引用的前端助理服务设置页与配置面回流",
    patterns: [
      "SettingsTabs.Assistant",
      "settings.tab.assistant",
      "AssistantSettings",
      "AssistantConfig",
      "default_assistant_id",
      "custom_assistants",
      "show_suggestions",
      "auto_select",
    ],
    allowedPaths: [],
  },
  {
    id: "stores-root-barrel-imports",
    classification: "dead-candidate",
    description: "已零引用的 @/stores 根 barrel 回流",
    patterns: ['from "@/stores"', "from '@/stores'"],
    allowedPaths: [],
  },
];

const rustTextSurfaceMonitors = [
  {
    id: "rust-subagent-scheduler-event-bus",
    classification: "compat",
    description: "旧 subagent scheduler 事件名只允许 compat Rust emitter 持有",
    patterns: ["subagent-scheduler-event"],
    allowedPaths: ["src-tauri/src/agent/subagent_scheduler.rs"],
  },
  {
    id: "rust-general-chat-dao",
    classification: "dead-candidate",
    description: "已零引用的 Rust 业务层 direct GeneralChatDao 依赖",
    patterns: ["GeneralChatDao", "database::dao::general_chat"],
    allowedPaths: [],
  },
  {
    id: "rust-legacy-general-tables",
    classification: "compat",
    description: "Rust runtime direct legacy general 表访问",
    patterns: ["general_chat_sessions", "general_chat_messages"],
    allowedPaths: [
      "src-tauri/crates/core/src/app_paths.rs",
      "src-tauri/crates/core/src/database/migration/general_chat_migration.rs",
      "src-tauri/crates/core/src/database/migration.rs",
      "src-tauri/crates/core/src/database/schema.rs",
    ],
  },
  {
    id: "rust-legacy-general-helper-usage",
    classification: "dead-candidate",
    description: "Rust runtime pending general raw helper 回流",
    patterns: [
      "load_pending_general_session_messages_raw",
      "load_pending_general_messages_raw",
      "count_pending_general_sessions_raw",
      "count_pending_general_messages_raw",
      "sum_pending_general_message_chars_raw",
      "load_legacy_general_session_messages",
      "load_unmigrated_legacy_general_messages",
      "count_unmigrated_legacy_general_sessions",
      "count_unmigrated_legacy_general_messages",
      "sum_unmigrated_legacy_general_message_chars",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-pending-general-wrapper-usage",
    classification: "dead-candidate",
    description: "Rust 业务层 pending general 兼容 wrapper 回流",
    patterns: [
      "load_pending_general_messages(",
      "load_pending_general_session_messages(",
      "count_pending_general_sessions(",
      "count_pending_general_messages(",
      "sum_pending_general_message_chars(",
      "summarize_pending_general(",
    ],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-legacy-general-module-imports",
    classification: "dead-candidate",
    description:
      "已零引用的 Rust 外部模块 direct pending/legacy general 子模块",
    patterns: [
      "crate::database::legacy_general_chat::",
      "lime_core::database::legacy_general_chat::",
      "crate::database::pending_general_chat::",
      "lime_core::database::pending_general_chat::",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-general-migration-flag-runtime-leak",
    classification: "deprecated",
    description: "Rust 业务层重新直接判断 general 迁移完成标记",
    patterns: [
      "migration::is_general_chat_migration_completed",
      "is_general_chat_migration_completed(",
    ],
    allowedPaths: [
      "src-tauri/crates/core/src/database/migration/general_chat_migration.rs",
    ],
  },
  {
    id: "rust-services-crate-general-chat-compat",
    classification: "dead-candidate",
    description: "已零引用的 services crate general_chat 兼容壳回流",
    patterns: [
      "use crate::general_chat::",
      "use crate::general_chat::{",
      "crate::general_chat::SessionService",
    ],
    includePathPrefixes: ["src-tauri/crates/services/src"],
    allowedPaths: [],
  },
  {
    id: "rust-cross-crate-general-chat-compat",
    classification: "dead-candidate",
    description: "已零引用的跨 crate lime_services::general_chat 兼容壳回流",
    patterns: ["lime_services::general_chat::"],
    allowedPaths: [],
  },
  {
    id: "rust-provider-pool-legacy-selector",
    classification: "dead-candidate",
    description: "已零引用的 provider pool legacy 凭证选择兼容方法",
    patterns: ["select_credential_with_fallback_legacy"],
    allowedPaths: [],
  },
  {
    id: "rust-memory-legacy-command-shells",
    classification: "dead-candidate",
    description: "已零引用的旧 conversation memory Rust 命令壳回流",
    patterns: [
      "get_conversation_memory_stats",
      "get_conversation_memory_overview",
      "request_conversation_memory_analysis",
      "cleanup_conversation_memory",
    ],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [],
  },
  {
    id: "rust-memory-profile-prompt-helper-leak",
    classification: "deprecated",
    description:
      "低层 build_memory_profile_prompt helper 泄漏到统一装配边界之外",
    patterns: ["build_memory_profile_prompt("],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: ["src-tauri/src/services/memory_profile_prompt_service.rs"],
  },
  {
    id: "rust-memory-sources-prompt-helper-leak",
    classification: "deprecated",
    description:
      "低层 build_memory_sources_prompt helper 泄漏到统一装配边界之外",
    patterns: ["build_memory_sources_prompt("],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [
      "src-tauri/src/services/memory_profile_prompt_service.rs",
      "src-tauri/src/services/memory_source_resolver_service.rs",
    ],
  },
  {
    id: "rust-project-session-config-helper-leak",
    classification: "dead-candidate",
    description: "旧 create_session_config_with_project helper 回流",
    patterns: ["create_session_config_with_project("],
    allowedPaths: [],
  },
  {
    id: "rust-unified-chat-command-module-leak",
    classification: "dead-candidate",
    description: "Rust unified_chat compat 命令模块重新回到 commands 编译图",
    patterns: ["pub mod unified_chat_cmd;"],
    includePathPrefixes: ["src-tauri/src/commands"],
    allowedPaths: [],
  },
  {
    id: "rust-tool-hooks-command-module-leak",
    classification: "dead-candidate",
    description: "Rust tool_hooks 旧命令模块重新回到 commands 编译图",
    patterns: ["pub mod tool_hooks;"],
    includePathPrefixes: ["src-tauri/src/commands"],
    allowedPaths: [],
  },
  {
    id: "rust-tool-hooks-service-module-leak",
    classification: "dead-candidate",
    description: "services crate 旧 tool_hooks_service 模块重新回到编译图",
    patterns: ["pub mod tool_hooks_service;"],
    includePathPrefixes: ["src-tauri/crates/services/src"],
    allowedPaths: [],
  },
  {
    id: "rust-three-stage-workflow-tool-leak",
    classification: "dead-candidate",
    description: "legacy three_stage_workflow 工具名重新回到 Lime Rust 编译图",
    patterns: ['"three_stage_workflow"', "three_stage_workflow"],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-skill-workflow-tauri-orchestration-leak",
    classification: "dead-candidate",
    description: "已零引用的 skill workflow 执行主链回流到 Tauri skills 模块",
    patterns: [
      "SessionConfigBuilder::new(",
      "convert_agent_event(",
      "WriteArtifactEventEmitter::new(",
      ".reply(",
    ],
    includePathPrefixes: ["src-tauri/src/skills"],
    allowedPaths: [],
  },
  {
    id: "rust-skill-prompt-command-orchestration-leak",
    classification: "dead-candidate",
    description: "已零引用的 skill prompt 执行主链回流到 skill_exec_cmd 命令层",
    patterns: [
      "SessionConfigBuilder::new(",
      "convert_agent_event(",
      "WriteArtifactEventEmitter::new(",
      ".reply(",
    ],
    includePathPrefixes: ["src-tauri/src/commands/skill_exec_cmd.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-skill-runtime-command-bootstrap-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 skill runtime 准备与 provider fallback 回流到 skill_exec_cmd 命令层",
    patterns: [
      "ensure_browser_mcp_tools_registered(",
      "ensure_social_image_tool_registered(",
      "ensure_creation_task_tools_registered(",
      "build_memory_profile_prompt(",
      ".configure_provider_from_pool(",
      "TauriExecutionCallback::new(",
    ],
    includePathPrefixes: ["src-tauri/src/commands/skill_exec_cmd.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-skill-catalog-command-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 skill catalog 枚举与详情装配回流到 skill_exec_cmd 命令层",
    patterns: [
      "get_skill_roots(",
      "load_skills_from_directory(",
      "find_skill_by_name(",
      "invalid_skill_message(",
      "load_skill_from_file(",
      "parse_skill_frontmatter(",
      "parse_allowed_tools(",
      "parse_boolean(",
    ],
    includePathPrefixes: ["src-tauri/src/commands/skill_exec_cmd.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-skill-mode-branch-command-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 skill execution_mode 分支回流到 skill_exec_cmd 命令层",
    patterns: [
      'skill.execution_mode == "workflow"',
      "!skill.workflow_steps.is_empty()",
      "execute_skill_workflow(",
      "execute_skill_prompt(",
    ],
    includePathPrefixes: ["src-tauri/src/commands/skill_exec_cmd.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-request-tool-policy-compat-service",
    classification: "dead-candidate",
    description: "已零引用的 request_tool_policy 旧服务壳回流",
    patterns: [
      "crate::services::request_tool_policy_prompt_service::",
      "lime_lib::services::request_tool_policy_prompt_service::",
      "services::request_tool_policy_prompt_service::",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-service-agent-table-query-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Tauri service 层 direct agent_sessions/agent_messages 查询回流",
    patterns: [
      "FROM agent_sessions s",
      "FROM agent_messages m",
      "JOIN agent_sessions s ON s.id = m.session_id",
    ],
    includePathPrefixes: ["src-tauri/src/services"],
    allowedPaths: [],
  },
  {
    id: "rust-service-model-usage-table-query-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Tauri service 层 direct model_usage_stats 查询回流",
    patterns: [
      "FROM model_usage_stats",
      "SELECT COUNT(*) FROM model_usage_stats",
    ],
    includePathPrefixes: ["src-tauri/src/services"],
    allowedPaths: [],
  },
  {
    id: "rust-dev-bridge-unified-memory-sql-leak",
    classification: "dead-candidate",
    description: "已零引用的 DevBridge unified_memory SQL 绕路回流",
    patterns: [
      "FROM unified_memory",
      "INSERT INTO unified_memory",
      "UPDATE unified_memory",
      "DELETE FROM unified_memory",
    ],
    includePathPrefixes: ["src-tauri/src/dev_bridge/dispatcher/memory.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-runtime-legacy-queue-table-leak",
    classification: "deprecated",
    description: "legacy runtime queue 表名从数据库迁移边界向外扩散",
    patterns: ["agent_runtime_queued_turns"],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [
      "src-tauri/crates/core/src/database/agent_runtime_queue_repository.rs",
    ],
  },
  {
    id: "rust-agent-runtime-legacy-queue-migration-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 legacy runtime queue 启动迁移 helper 回流到其他模块",
    patterns: ["migrate_legacy_runtime_queue_to_aster_store("],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-legacy-todo-state-leak",
    classification: "dead-candidate",
    description: "已零引用的 Lime 业务层 direct legacy TodoState 读取回流",
    patterns: ["TodoState::from_extension_data(", "TodoState::new("],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-structured-todo-helper-bypass",
    classification: "dead-candidate",
    description:
      "已零引用的 Lime 业务层绕过 unified todo helper 直接读取 TodoListState",
    patterns: [
      "TodoListState::from_extension_data(",
      "TodoListState::from_markdown(",
    ],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-services-default-workspace-query-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 services crate direct 默认 workspace root 查询回流",
    patterns: ["SELECT root_path FROM workspaces WHERE is_default = 1 LIMIT 1"],
    includePathPrefixes: ["src-tauri/crates/services/src"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-direct-record-access",
    classification: "deprecated",
    description: "Rust 上层模块 direct Agent session 记录与消息读写回流",
    patterns: [
      "AgentDao::get_session(",
      "AgentDao::get_session_with_messages(",
      "AgentDao::list_sessions(",
      "AgentDao::list_session_overviews(",
      "AgentDao::get_message_count(",
      "AgentDao::get_messages(",
      "AgentDao::get_session_overview(",
      "AgentDao::session_exists(",
      "AgentDao::update_title(",
      "AgentDao::update_session_time(",
      "AgentDao::rename_session(",
      "AgentDao::update_working_dir(",
      "AgentDao::update_execution_strategy(",
    ],
    allowedPaths: [
      "src-tauri/crates/core/src/database/agent_session_repository.rs",
    ],
  },
  {
    id: "rust-agent-session-direct-delete",
    classification: "dead-candidate",
    description: "已零引用的 Rust 业务层 direct AgentDao::delete_session 回流",
    patterns: ["AgentDao::delete_session("],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-direct-create",
    classification: "deprecated",
    description: "Rust 业务层 direct AgentDao::create_session 回流",
    patterns: ["AgentDao::create_session("],
    allowedPaths: [
      "src-tauri/crates/core/src/database/agent_session_repository.rs",
    ],
  },
  {
    id: "rust-agent-dao-row-type-leak",
    classification: "dead-candidate",
    description: "agent crate 重新泄漏 core DAO row 类型",
    patterns: ["AgentSessionOverviewRow"],
    includePathPrefixes: ["src-tauri/crates/agent/src"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-workspace-query-leak",
    classification: "dead-candidate",
    description: "agent runtime direct workspaces 绑定查询回流",
    patterns: ["SELECT id FROM workspaces WHERE root_path = ? LIMIT 1"],
    includePathPrefixes: ["src-tauri/crates/agent/src"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-record-repository-module-leak",
    classification: "dead-candidate",
    description: "lime-agent 本地 session_record_repository 壳重新回到编译图",
    patterns: ["mod session_record_repository;"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-compat-surface",
    classification: "dead-candidate",
    description: "agent crate 旧 compat session API 回流",
    patterns: [
      "CompatSessionInfo",
      "list_compat_sessions_sync(",
      "get_compat_session_sync(",
    ],
    includePathPrefixes: ["src-tauri/crates/agent/src"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-store-public-module-leak",
    classification: "dead-candidate",
    description: "lime-agent 重新对 crate 外暴露 session_store 模块",
    patterns: ["pub mod session_store;"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-store-direct-module-usage",
    classification: "dead-candidate",
    description: "上层模块重新 direct 依赖 lime_agent::session_store 模块路径",
    patterns: ["lime_agent::session_store::"],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-session-record-create-api-leak",
    classification: "dead-candidate",
    description: "lime-agent crate 根重新暴露内部 session record 创建 API",
    patterns: ["create_session_record_sync,", "CreateSessionRecordInput,"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-tool-permission-public-module-leak",
    classification: "dead-candidate",
    description: "lime-agent 重新对 crate 外暴露旧 tool_permissions 模块",
    patterns: ["pub mod tool_permissions;"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-shell-security-public-module-leak",
    classification: "dead-candidate",
    description: "lime-agent 重新对 crate 外暴露旧 shell_security 模块",
    patterns: ["pub mod shell_security;"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-tool-permission-module-compiled-leak",
    classification: "dead-candidate",
    description: "旧 tool_permissions 模块重新回到 lime-agent lib.rs 编译图",
    patterns: ["mod tool_permissions;"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-shell-security-module-compiled-leak",
    classification: "dead-candidate",
    description: "旧 shell_security 模块重新回到 lime-agent lib.rs 编译图",
    patterns: ["mod shell_security;"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-tool-permission-root-export-leak",
    classification: "dead-candidate",
    description: "lime-agent crate 根重新暴露旧 tool_permissions 类型出口",
    patterns: ["pub use tool_permissions::"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-shell-security-root-export-leak",
    classification: "dead-candidate",
    description: "lime-agent crate 根重新暴露旧 shell_security 类型出口",
    patterns: ["pub use shell_security::"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-tool-permission-direct-module-usage",
    classification: "dead-candidate",
    description:
      "上层模块重新 direct 依赖 lime_agent::tool_permissions 模块路径",
    patterns: ["lime_agent::tool_permissions::"],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-shell-security-direct-module-usage",
    classification: "dead-candidate",
    description: "上层模块重新 direct 依赖 lime_agent::shell_security 模块路径",
    patterns: ["lime_agent::shell_security::"],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-tool-permission-root-type-usage",
    classification: "dead-candidate",
    description: "上层模块重新 direct 依赖 lime_agent 根导出的旧权限类型",
    patterns: [
      "lime_agent::DynamicPermissionCheck",
      "lime_agent::PermissionBehavior",
      "lime_agent::ShellSecurityChecker",
    ],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-tool-permission-internal-module-usage",
    classification: "dead-candidate",
    description:
      "lime-agent 内部除兼容壳外重新扩散 crate::tool_permissions 模块依赖",
    patterns: ["crate::tool_permissions::"],
    includePathPrefixes: ["src-tauri/crates/agent/src"],
    allowedPaths: ["src-tauri/crates/agent/src/shell_security.rs"],
  },
  {
    id: "rust-agent-integration-public-module-leak",
    classification: "dead-candidate",
    description: "agent 集成模块重新对外暴露 integration 模块路径",
    patterns: ["pub mod integration;"],
    includePathPrefixes: ["src-tauri/src/agent/mod.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-integration-module-compiled-leak",
    classification: "dead-candidate",
    description: "已退出编译图的 agent integration 模块重新回到 agent 根模块",
    patterns: ["mod integration;"],
    includePathPrefixes: ["src-tauri/src/agent/mod.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-integration-direct-module-usage",
    classification: "dead-candidate",
    description: "应用层重新 direct 依赖 crate::agent::integration 模块路径",
    patterns: ["crate::agent::integration::"],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [],
  },
  {
    id: "rust-agent-subagent-direct-module-usage",
    classification: "dead-candidate",
    description:
      "应用层重新 direct 依赖 crate::agent::subagent_scheduler 模块路径",
    patterns: ["crate::agent::subagent_scheduler::"],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-snapshot-helper-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Lime 业务层 direct Aster runtime snapshot helper 回流",
    patterns: ["load_session_runtime_snapshot("],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-store-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Lime 业务层 direct Aster shared runtime store 回流",
    patterns: [
      "shared_thread_runtime_store(",
      "initialize_shared_thread_runtime_store(",
      "initialize_shared_sqlite_thread_runtime_store(",
    ],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-store-public-require-api-leak",
    classification: "dead-candidate",
    description:
      "Aster runtime support 重新对 crate 外暴露 require_aster_thread_runtime_store",
    patterns: ["pub fn require_aster_thread_runtime_store("],
    includePathPrefixes: [
      "src-tauri/crates/agent/src/aster_runtime_support.rs",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-init-return-store-api-leak",
    classification: "dead-candidate",
    description:
      "Aster runtime 启动初始化 API 重新向 crate 外返回 runtime store",
    patterns: [
      "pub fn initialize_aster_thread_runtime_store() -> Result<Arc<dyn ThreadRuntimeStore>, String>",
    ],
    includePathPrefixes: [
      "src-tauri/crates/agent/src/aster_runtime_support.rs",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-public-legacy-init-helper-leak",
    classification: "dead-candidate",
    description:
      "Aster runtime support 重新对 crate 外暴露旧 initialize_aster_thread_runtime_store helper",
    patterns: ["pub fn initialize_aster_thread_runtime_store("],
    includePathPrefixes: [
      "src-tauri/crates/agent/src/aster_runtime_support.rs",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-snapshot-root-export-leak",
    classification: "dead-candidate",
    description:
      "lime-agent crate 根重新暴露 load_aster_runtime_snapshot helper",
    patterns: ["load_aster_runtime_snapshot"],
    includePathPrefixes: ["src-tauri/crates/agent/src/lib.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-aster-runtime-queue-service-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Lime 业务层 direct Aster shared runtime queue service 回流",
    patterns: [],
    regexPatterns: [
      String.raw`(?<!require_)shared_session_runtime_queue_service\(`,
    ],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-aster-path-root-env-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Lime 业务层 direct ASTER_PATH_ROOT 环境变量处理回流",
    patterns: ['"ASTER_PATH_ROOT"'],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-aster-global-session-store-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 Aster 全局 session store 注册回流到统一 runtime support 边界之外",
    patterns: ["set_global_session_store("],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-aster-runtime-path-leak",
    classification: "dead-candidate",
    description: "已零引用的 Lime 业务层硬编码 legacy aster runtime 路径回流",
    patterns: ['join(".lime").join("aster")', "~/.lime/aster"],
    includePathPrefixes: ["src-tauri/src", "src-tauri/crates"],
    allowedPaths: [],
  },
  {
    id: "rust-heartbeat-business-surfaces",
    classification: "dead-candidate",
    description: "已零引用的 Rust 业务层 heartbeat 旧实现回流",
    patterns: [
      "crate::services::heartbeat_service::",
      "services::heartbeat_service::",
      "HeartbeatServiceState",
      "heartbeat_service_adapter",
      "lime_core::database::dao::heartbeat",
      "heartbeat_tool",
      "RunSource::Heartbeat",
      "source = 'heartbeat'",
      'source: "heartbeat".to_string()',
    ],
    allowedPaths: [],
  },
  {
    id: "rust-assistant-config-surfaces",
    classification: "dead-candidate",
    description: "已零引用的 Rust 助理服务配置面回流",
    patterns: [
      "AssistantConfig",
      "AssistantProfile",
      "default_assistant_id",
      "custom_assistants",
      "show_suggestions",
      "auto_select",
    ],
    includePathPrefixes: [
      "src-tauri/crates/core/src/config",
      "src-tauri/src/config",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-migration-setting-key-leak",
    classification: "deprecated",
    description: "Rust 迁移 settings 标记字符串扩散",
    patterns: [
      '"migrated_api_keys_to_pool"',
      '"migrated_provider_ids_v1"',
      '"cleaned_legacy_api_key_credentials"',
      '"migrated_mcp_lime_enabled"',
      '"migrated_mcp_created_at_to_integer"',
      '"model_registry_refresh_needed"',
      '"model_registry_version"',
    ],
    allowedPaths: [
      "src-tauri/crates/core/src/database/migration/api_key_migration.rs",
      "src-tauri/crates/core/src/database/migration/mcp_migration.rs",
      "src-tauri/crates/core/src/database/migration/model_registry_migration.rs",
    ],
  },
  {
    id: "rust-startup-migration-call-leak",
    classification: "deprecated",
    description: "Rust 启动迁移直接调用扩散",
    patterns: [
      "migration::migrate_provider_ids(",
      "migration::mark_model_registry_refresh_needed(",
      "migration::check_model_registry_version(",
      "migration::migrate_api_keys_to_pool(",
      "migration::cleanup_legacy_api_key_credentials(",
      "migration::migrate_mcp_lime_enabled(",
      "migration::migrate_mcp_created_at_to_integer(",
      "migration::check_general_chat_migration_status(",
      "migration::migrate_general_chat_to_unified(",
      "migration_v2::migrate_unified_content_system(",
      "migration_v3::migrate_playwright_mcp_server(",
      "migration_v4::migrate_fix_promise_paths(",
    ],
    allowedPaths: ["src-tauri/crates/core/src/database/startup_migrations.rs"],
  },
  {
    id: "rust-startup-migration-manual-match-leak",
    classification: "dead-candidate",
    description: "已零引用的 startup migration 手写 match 调度回流",
    patterns: [
      "match migration::migrate_provider_ids(",
      "match migration::migrate_api_keys_to_pool(",
      "match migration::cleanup_legacy_api_key_credentials(",
      "match migration::migrate_mcp_lime_enabled(",
      "match migration::migrate_mcp_created_at_to_integer(",
      "match migration::migrate_general_chat_to_unified(",
      "match migration_v2::migrate_unified_content_system(",
      "match migration_v3::migrate_playwright_mcp_server(",
      "match migration_v4::migrate_fix_promise_paths(",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-versioned-migration-local-helper-leak",
    classification: "dead-candidate",
    description: "已零引用的 versioned migration 本地重复 settings helper 回流",
    patterns: [
      "fn is_migration_completed(conn:",
      "fn mark_migration_completed(conn:",
    ],
    includePathPrefixes: ["src-tauri/crates/core/src/database/migration_v"],
    allowedPaths: [],
  },
  {
    id: "rust-versioned-migration-transaction-leak",
    classification: "dead-candidate",
    description: "已零引用的 versioned migration 手写事务样板回流",
    patterns: [
      'conn.execute("BEGIN TRANSACTION"',
      'conn.execute("COMMIT"',
      'conn.execute("ROLLBACK"',
    ],
    includePathPrefixes: ["src-tauri/crates/core/src/database/migration_v"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-projects-path-leak",
    classification: "dead-candidate",
    description: "已零引用的数据库迁移硬编码 legacy projects 路径",
    patterns: ['".lime/projects"', 'join(".lime").join("projects")'],
    includePathPrefixes: ["src-tauri/crates/core/src/database"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-session-files-path-leak",
    classification: "dead-candidate",
    description: "已零引用的 session files 硬编码 legacy sessions 路径",
    patterns: ["~/.lime/sessions", 'join(".lime").join("sessions")'],
    includePathPrefixes: ["src-tauri/crates/core/src/session_files"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-legacy-config-path-leak",
    classification: "dead-candidate",
    description: "已零引用的数据库迁移硬编码 legacy config 路径",
    patterns: ["~/.lime/config.json", 'join(".lime").join("config.json")'],
    includePathPrefixes: ["src-tauri/crates/core/src/database"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-workspace-projects-path-leak",
    classification: "dead-candidate",
    description: "已零引用的上层命令或桥接层硬编码 workspace projects 路径",
    patterns: ["~/.lime/projects", 'join(".lime").join("projects")'],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [],
  },
  {
    id: "rust-services-hardcoded-projects-path-leak",
    classification: "dead-candidate",
    description: "已零引用的 services crate 硬编码 legacy projects 路径",
    patterns: ["~/.lime/projects", 'join(".lime").join("projects")'],
    includePathPrefixes: ["src-tauri/crates/services/src"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-logger-path-leak",
    classification: "dead-candidate",
    description: "已零引用的 logger fallback 硬编码 legacy logs 路径",
    patterns: ["~/.lime/logs", 'join(".lime").join("logs")'],
    includePathPrefixes: ["src-tauri/crates/core/src/logger.rs"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-skills-path-leak",
    classification: "dead-candidate",
    description: "已零引用的 skills 相关模块硬编码 legacy skills 路径",
    patterns: ["~/.lime/skills", 'join(".lime").join("skills")'],
    includePathPrefixes: ["src-tauri/src"],
    allowedPaths: [],
  },
  {
    id: "rust-hardcoded-memory-path-leak",
    classification: "dead-candidate",
    description:
      "已零引用的 memory 相关模块硬编码 legacy memory 或 AGENTS 路径",
    patterns: [
      "~/.lime/AGENTS.md",
      'join(".lime").join("AGENTS.md")',
      'join(".lime").join("memory")',
      ".lime/memory",
    ],
    includePathPrefixes: [
      "src-tauri/src",
      "src-tauri/crates/core/src/config",
      "src-tauri/crates/agent/src/prompt",
    ],
    allowedPaths: [],
  },
  {
    id: "rust-agent-legacy-global-instruction-path-leak",
    classification: "dead-candidate",
    description: "已零引用的 agent prompt 层 legacy 全局指令文件名回流",
    patterns: ['".lime/AGENT.md"', '".lime/instructions.md"'],
    includePathPrefixes: ["src-tauri/crates/agent/src/prompt"],
    allowedPaths: [],
  },
];

const rustTextCountMonitors = [
  {
    id: "rust-app-paths-root-fetch-duplication",
    classification: "deprecated",
    description: "app_paths 重复获取 preferred/legacy root 样板回流",
    includePathPrefixes: ["src-tauri/crates/core/src/app_paths.rs"],
    occurrences: [
      {
        pattern: "let preferred_root = preferred_data_dir()?;",
        maxCount: 1,
      },
      {
        pattern: "let legacy_root = legacy_home_dir()?;",
        maxCount: 1,
      },
    ],
  },
];

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function resolveExistingSourcePath(absolutePath) {
  if (fs.existsSync(absolutePath)) {
    const stats = fs.statSync(absolutePath);
    if (stats.isFile()) {
      return absolutePath;
    }
  }

  if (!path.extname(absolutePath)) {
    for (const extension of sourceExtensions) {
      const fileCandidate = `${absolutePath}${extension}`;
      if (fs.existsSync(fileCandidate) && fs.statSync(fileCandidate).isFile()) {
        return fileCandidate;
      }
    }
  }

  for (const extension of sourceExtensions) {
    const indexCandidate = path.join(absolutePath, `index${extension}`);
    if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
      return indexCandidate;
    }
  }

  return null;
}

function resolveImportPath(importerRelativePath, specifier) {
  let absoluteCandidate = null;

  if (specifier.startsWith("@/")) {
    absoluteCandidate = path.join(repoRoot, "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    absoluteCandidate = path.resolve(
      path.dirname(path.join(repoRoot, importerRelativePath)),
      specifier,
    );
  }

  if (!absoluteCandidate) {
    return null;
  }

  const resolvedPath = resolveExistingSourcePath(absoluteCandidate);
  if (!resolvedPath) {
    return null;
  }

  return normalizePath(path.relative(repoRoot, resolvedPath));
}

function isTestFile(relativePath) {
  return (
    /(^|\/)tests(\/|$)/.test(relativePath) ||
    /(^|\/)(__tests__|__mocks__)(\/|$)/.test(relativePath) ||
    /\.(test|spec)\.[^/.]+$/.test(relativePath)
  );
}

function walkDirectory(directoryPath, extensions) {
  const files = [];

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath, extensions));
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function extractImportSpecifiers(sourceCode) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+["'`]([^"'`]+)["'`]/g,
    /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\b(?:vi|jest)\.mock\s*\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceCode.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }

  return specifiers;
}

function extractInvokeCommands(sourceCode) {
  const commands = new Set();
  const patterns = [
    /\bsafeInvoke(?:<[^>]+>)?\s*\(\s*["'`]([^"'`]+)["'`]/g,
    /\binvoke(?:<[^>]+>)?\s*\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceCode.matchAll(pattern)) {
      commands.add(match[1]);
    }
  }

  return commands;
}

function stripRustTestModules(sourceCode) {
  return sourceCode.replace(
    /(?:^|\n)\s*#\s*\[\s*cfg\s*\(\s*test\s*\)\s*\][\s\S]*$/m,
    "\n",
  );
}

function collectSources() {
  const runtimeSources = [];
  const testSources = [];

  for (const root of sourceRoots) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    for (const filePath of walkDirectory(absoluteRoot, sourceExtensions)) {
      const relativePath = normalizePath(path.relative(repoRoot, filePath));
      const sourceCode = fs.readFileSync(filePath, "utf8");
      const imports = extractImportSpecifiers(sourceCode);
      const collectedSource = {
        relativePath,
        imports,
        resolvedImports: new Set(
          [...imports]
            .map((specifier) => resolveImportPath(relativePath, specifier))
            .filter(Boolean),
        ),
        commands: extractInvokeCommands(sourceCode),
      };

      if (isTestFile(relativePath)) {
        testSources.push(collectedSource);
        continue;
      }

      runtimeSources.push(collectedSource);
    }
  }

  return {
    runtimeSources,
    testSources,
  };
}

function collectTextSources(roots, extensions) {
  const runtimeSources = [];
  const testSources = [];

  for (const root of roots) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    for (const filePath of walkDirectory(absoluteRoot, extensions)) {
      const relativePath = normalizePath(path.relative(repoRoot, filePath));
      const sourceCode = fs.readFileSync(filePath, "utf8");
      const collectedSource = {
        relativePath,
        sourceCode:
          path.extname(relativePath) === ".rs"
            ? stripRustTestModules(sourceCode)
            : sourceCode,
        rawSourceCode: sourceCode,
      };

      if (isTestFile(relativePath)) {
        testSources.push(collectedSource);
        continue;
      }

      runtimeSources.push(collectedSource);
    }
  }

  return {
    runtimeSources,
    testSources,
  };
}

function formatPaths(paths) {
  if (paths.length === 0) {
    return "无";
  }

  return paths.map((item) => `    - ${item}`).join("\n");
}

function evaluateImportMonitor(monitor, runtimeSources, testSources) {
  const existingTargets = monitor.targets.filter((target) =>
    fs.existsSync(path.join(repoRoot, target)),
  );
  const missingTargets = monitor.targets.filter(
    (target) => !fs.existsSync(path.join(repoRoot, target)),
  );
  const references = runtimeSources
    .filter((file) =>
      [...file.resolvedImports].some((resolvedPath) =>
        monitor.targets.includes(resolvedPath),
      ),
    )
    .map((file) => file.relativePath)
    .sort();
  const testReferences = testSources
    .filter((file) =>
      [...file.resolvedImports].some((resolvedPath) =>
        monitor.targets.includes(resolvedPath),
      ),
    )
    .map((file) => file.relativePath)
    .sort();

  const violations = references.filter(
    (relativePath) => !monitor.allowedPaths.includes(relativePath),
  );

  return {
    ...monitor,
    existingTargets,
    missingTargets,
    references,
    testReferences,
    violations,
  };
}

function evaluateCommandMonitor(monitor, runtimeSources, testSources) {
  const referencesByCommand = new Map();
  const testReferencesByCommand = new Map();

  for (const command of monitor.commands) {
    referencesByCommand.set(
      command,
      runtimeSources
        .filter((file) => file.commands.has(command))
        .map((file) => file.relativePath)
        .sort(),
    );
    testReferencesByCommand.set(
      command,
      testSources
        .filter((file) => file.commands.has(command))
        .map((file) => file.relativePath)
        .sort(),
    );
  }

  const violations = [];
  for (const [command, references] of referencesByCommand.entries()) {
    for (const relativePath of references) {
      if (!monitor.allowedPaths.includes(relativePath)) {
        violations.push(`${command} -> ${relativePath}`);
      }
    }
  }

  return {
    ...monitor,
    referencesByCommand,
    testReferencesByCommand,
    violations,
  };
}

function evaluateTextMonitor(monitor, runtimeSources, testSources) {
  const filteredRuntimeSources = monitor.includePathPrefixes
    ? runtimeSources.filter((file) =>
        monitor.includePathPrefixes.some((prefix) =>
          file.relativePath.startsWith(prefix),
        ),
      )
    : runtimeSources;
  const filteredTestSources = monitor.includePathPrefixes
    ? testSources.filter((file) =>
        monitor.includePathPrefixes.some((prefix) =>
          file.relativePath.startsWith(prefix),
        ),
      )
    : testSources;
  const matchesPattern = (sourceCode) =>
    monitor.patterns.some((pattern) => sourceCode.includes(pattern)) ||
    (monitor.regexPatterns ?? []).some((pattern) =>
      new RegExp(pattern, "m").test(sourceCode),
    );

  const references = filteredRuntimeSources
    .filter((file) => matchesPattern(file.sourceCode))
    .map((file) => file.relativePath)
    .sort();
  const testReferences = filteredTestSources
    .filter((file) => matchesPattern(file.rawSourceCode ?? file.sourceCode))
    .map((file) => file.relativePath)
    .sort();
  const violations = references.filter(
    (relativePath) => !monitor.allowedPaths.includes(relativePath),
  );

  return {
    ...monitor,
    references,
    testReferences,
    violations,
  };
}

function countOccurrences(sourceCode, pattern) {
  if (!pattern) {
    return 0;
  }

  let count = 0;
  let startIndex = 0;

  while (true) {
    const matchIndex = sourceCode.indexOf(pattern, startIndex);
    if (matchIndex === -1) {
      return count;
    }
    count += 1;
    startIndex = matchIndex + pattern.length;
  }
}

function evaluateTextCountMonitor(monitor, runtimeSources, testSources) {
  const filteredRuntimeSources = monitor.includePathPrefixes
    ? runtimeSources.filter((file) =>
        monitor.includePathPrefixes.some((prefix) =>
          file.relativePath.startsWith(prefix),
        ),
      )
    : runtimeSources;
  const filteredTestSources = monitor.includePathPrefixes
    ? testSources.filter((file) =>
        monitor.includePathPrefixes.some((prefix) =>
          file.relativePath.startsWith(prefix),
        ),
      )
    : testSources;
  const runtimeMatches = [];
  const testMatches = [];
  const violations = [];

  for (const file of filteredRuntimeSources) {
    const counts = monitor.occurrences
      .map((rule) => ({
        ...rule,
        count: countOccurrences(file.sourceCode, rule.pattern),
      }))
      .filter((rule) => rule.count > 0);

    if (counts.length === 0) {
      continue;
    }

    runtimeMatches.push({
      relativePath: file.relativePath,
      counts,
    });

    for (const rule of counts) {
      if (rule.count > rule.maxCount) {
        violations.push(
          `${file.relativePath} -> ${rule.pattern} (${rule.count} > ${rule.maxCount})`,
        );
      }
    }
  }

  for (const file of filteredTestSources) {
    const counts = monitor.occurrences
      .map((rule) => ({
        ...rule,
        count: countOccurrences(
          file.rawSourceCode ?? file.sourceCode,
          rule.pattern,
        ),
      }))
      .filter((rule) => rule.count > 0);

    if (counts.length === 0) {
      continue;
    }

    testMatches.push({
      relativePath: file.relativePath,
      counts,
    });
  }

  return {
    ...monitor,
    runtimeMatches,
    testMatches,
    violations,
  };
}

function getImportStatus(result) {
  return result.violations.length > 0
    ? "违规"
    : result.references.length === 0 && result.existingTargets.length === 0
      ? "已删除"
      : result.references.length === 0
        ? "零引用"
        : "受控";
}

function getCommandStatus(result) {
  const flattenedReferences = [...result.referencesByCommand.values()].flat();
  const uniqueReferences = [...new Set(flattenedReferences)].sort();
  return result.violations.length > 0
    ? "违规"
    : uniqueReferences.length === 0
      ? "零引用"
      : "受控";
}

function getTextStatus(result) {
  return result.violations.length > 0
    ? "违规"
    : result.references.length === 0
      ? "零引用"
      : "受控";
}

function isStatusClassificationDrift(status, classification) {
  return (
    (status === "已删除" || status === "零引用") &&
    classification !== "dead-candidate"
  );
}

function printImportReport(result) {
  const status = getImportStatus(result);

  console.log(
    `- [${status}] ${result.id} (${result.classification})：${result.description}`,
  );
  console.log(`  目标文件：${result.targets.join(", ")}`);
  console.log(`  允许引用：${result.allowedPaths.join(", ") || "无"}`);
  if (result.missingTargets.length > 0) {
    console.log(`  已删除目标：\n${formatPaths(result.missingTargets)}`);
  }
  console.log(`  实际引用：\n${formatPaths(result.references)}`);
  console.log(`  测试引用：\n${formatPaths(result.testReferences)}`);

  if (result.violations.length > 0) {
    console.log(`  违规引用：\n${formatPaths(result.violations)}`);
  }
}

function printCommandReport(result) {
  const status = getCommandStatus(result);

  console.log(
    `- [${status}] ${result.id} (${result.classification})：${result.description}`,
  );
  console.log(`  命令：${result.commands.join(", ")}`);
  console.log(`  允许引用：${result.allowedPaths.join(", ") || "无"}`);

  for (const command of result.commands) {
    const references = result.referencesByCommand.get(command) ?? [];
    const testReferences = result.testReferencesByCommand.get(command) ?? [];
    console.log(`  ${command}：\n${formatPaths(references)}`);
    console.log(`  ${command}（测试）：\n${formatPaths(testReferences)}`);
  }

  if (result.violations.length > 0) {
    console.log(`  违规引用：\n${formatPaths(result.violations)}`);
  }
}

function printTextReport(result) {
  const status = getTextStatus(result);

  console.log(
    `- [${status}] ${result.id} (${result.classification})：${result.description}`,
  );
  const keywords = [
    ...result.patterns,
    ...(result.regexPatterns ?? []).map((pattern) => `regex:${pattern}`),
  ];
  console.log(`  关键字：${keywords.join(", ")}`);
  console.log(`  允许引用：${result.allowedPaths.join(", ") || "无"}`);
  console.log(`  实际引用：\n${formatPaths(result.references)}`);
  console.log(`  测试引用：\n${formatPaths(result.testReferences)}`);

  if (result.violations.length > 0) {
    console.log(`  违规引用：\n${formatPaths(result.violations)}`);
  }
}

function printTextCountReport(result) {
  const status =
    result.violations.length > 0
      ? "违规"
      : result.runtimeMatches.length === 0
        ? "零引用"
        : "受控";

  console.log(
    `- [${status}] ${result.id} (${result.classification})：${result.description}`,
  );
  console.log(
    `  次数规则：${result.occurrences
      .map((rule) => `${rule.pattern} <= ${rule.maxCount}`)
      .join("；")}`,
  );
  console.log(
    `  实际命中：\n${formatPaths(
      result.runtimeMatches.map(
        (item) =>
          `${item.relativePath} -> ${item.counts
            .map((rule) => `${rule.pattern} (${rule.count})`)
            .join("；")}`,
      ),
    )}`,
  );
  console.log(
    `  测试命中：\n${formatPaths(
      result.testMatches.map(
        (item) =>
          `${item.relativePath} -> ${item.counts
            .map((rule) => `${rule.pattern} (${rule.count})`)
            .join("；")}`,
      ),
    )}`,
  );

  if (result.violations.length > 0) {
    console.log(`  违规引用：\n${formatPaths(result.violations)}`);
  }
}

const { runtimeSources, testSources } = collectSources();
const {
  runtimeSources: frontendRuntimeTextSources,
  testSources: frontendTestTextSources,
} = collectTextSources(sourceRoots, sourceExtensions);
const { runtimeSources: rustRuntimeSources, testSources: rustTestSources } =
  collectTextSources(rustSourceRoots, rustSourceExtensions);
const importResults = importSurfaceMonitors.map((monitor) =>
  evaluateImportMonitor(monitor, runtimeSources, testSources),
);
const commandResults = commandSurfaceMonitors.map((monitor) =>
  evaluateCommandMonitor(monitor, runtimeSources, testSources),
);
const frontendTextResults = frontendTextSurfaceMonitors.map((monitor) =>
  evaluateTextMonitor(
    monitor,
    frontendRuntimeTextSources,
    frontendTestTextSources,
  ),
);
const rustTextResults = rustTextSurfaceMonitors.map((monitor) =>
  evaluateTextMonitor(monitor, rustRuntimeSources, rustTestSources),
);
const rustTextCountResults = rustTextCountMonitors.map((monitor) =>
  evaluateTextCountMonitor(monitor, rustRuntimeSources, rustTestSources),
);

const zeroReferenceCandidates = importResults
  .filter(
    (result) =>
      result.references.length === 0 && result.existingTargets.length > 0,
  )
  .map((result) => `${result.id} (${result.description})`);
const classificationDriftCandidates = [
  ...importResults
    .filter((result) =>
      isStatusClassificationDrift(
        getImportStatus(result),
        result.classification,
      ),
    )
    .map(
      (result) =>
        `${result.id} -> ${result.classification} / ${getImportStatus(result)}`,
    ),
  ...commandResults
    .filter((result) =>
      isStatusClassificationDrift(
        getCommandStatus(result),
        result.classification,
      ),
    )
    .map(
      (result) =>
        `${result.id} -> ${result.classification} / ${getCommandStatus(result)}`,
    ),
  ...frontendTextResults
    .filter((result) =>
      isStatusClassificationDrift(getTextStatus(result), result.classification),
    )
    .map(
      (result) =>
        `${result.id} -> ${result.classification} / ${getTextStatus(result)}`,
    ),
  ...rustTextResults
    .filter((result) =>
      isStatusClassificationDrift(getTextStatus(result), result.classification),
    )
    .map(
      (result) =>
        `${result.id} -> ${result.classification} / ${getTextStatus(result)}`,
    ),
  ...rustTextCountResults
    .filter((result) =>
      isStatusClassificationDrift(
        result.runtimeMatches.length === 0 ? "零引用" : "受控",
        result.classification,
      ),
    )
    .map(
      (result) =>
        `${result.id} -> ${result.classification} / ${
          result.runtimeMatches.length === 0 ? "零引用" : "受控"
        }`,
    ),
];
const violations = [
  ...importResults.flatMap((result) =>
    result.violations.map((item) => `${result.id} -> ${item}`),
  ),
  ...commandResults.flatMap((result) =>
    result.violations.map((item) => `${result.id} -> ${item}`),
  ),
  ...frontendTextResults.flatMap((result) =>
    result.violations.map((item) => `${result.id} -> ${item}`),
  ),
  ...rustTextResults.flatMap((result) =>
    result.violations.map((item) => `${result.id} -> ${item}`),
  ),
  ...rustTextCountResults.flatMap((result) =>
    result.violations.map((item) => `${result.id} -> ${item}`),
  ),
];

console.log("[lime] legacy surface report");
console.log("");
console.log("## 入口引用");
for (const result of importResults) {
  printImportReport(result);
}

console.log("");
console.log("## 命令边界");
for (const result of commandResults) {
  printCommandReport(result);
}

console.log("");
console.log("## 前端护栏");
for (const result of frontendTextResults) {
  printTextReport(result);
}

console.log("");
console.log("## Rust 护栏");
for (const result of rustTextResults) {
  printTextReport(result);
}
for (const result of rustTextCountResults) {
  printTextCountReport(result);
}

console.log("");
console.log("## 摘要");
console.log(`- 扫描文件数：${runtimeSources.length}`);
console.log(`- 测试文件数：${testSources.length}`);
console.log(`- Rust 扫描文件数：${rustRuntimeSources.length}`);
console.log(`- Rust 测试文件数：${rustTestSources.length}`);
console.log(`- 零引用候选：${zeroReferenceCandidates.length}`);
for (const candidate of zeroReferenceCandidates) {
  console.log(`  - ${candidate}`);
}
console.log(`- 分类漂移候选：${classificationDriftCandidates.length}`);
for (const candidate of classificationDriftCandidates) {
  console.log(`  - ${candidate}`);
}
console.log(`- 边界违规：${violations.length}`);
for (const violation of violations) {
  console.log(`  - ${violation}`);
}

if (violations.length > 0) {
  console.error("");
  console.error(
    "[lime] legacy surface report 检测到边界违规，请先治理再继续扩展。",
  );
  process.exit(1);
}
