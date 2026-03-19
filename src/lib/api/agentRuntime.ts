/**
 * Agent / Aster 现役运行时 API
 *
 * 仅保留当前仍在维护的进程、会话、流式与交互能力。
 */

import { safeInvoke } from "@/lib/dev-bridge";
import { logAgentDebug } from "@/lib/agentDebug";
import type {
  AgentThreadItem,
  AgentThreadTurn,
  ToolResultImage,
} from "./agentStream";
import {
  normalizeQueuedTurnSnapshots,
  type QueuedTurnSnapshot,
} from "./queuedTurn";

export type { QueuedTurnSnapshot } from "./queuedTurn";

/**
 * Agent 状态
 */
export interface AgentProcessStatus {
  running: boolean;
  base_url?: string;
  port?: number;
}

export type AsterExecutionStrategy = "react" | "code_orchestrated" | "auto";

/**
 * 图片输入
 */
export interface ImageInput {
  data: string;
  media_type: string;
}

const requireWorkspaceId = (
  workspaceId?: string,
  fallbackWorkspaceId?: string,
): string => {
  const resolvedWorkspaceId = (workspaceId ?? fallbackWorkspaceId)?.trim();
  if (!resolvedWorkspaceId) {
    throw new Error("workspaceId 不能为空，请先选择项目工作区");
  }
  return resolvedWorkspaceId;
};

/**
 * Aster Agent 状态
 */
export interface AsterAgentStatus {
  initialized: boolean;
  provider_configured: boolean;
  provider_name?: string;
  model_name?: string;
}

/**
 * Aster Provider 配置
 */
export interface AsterProviderConfig {
  provider_id?: string;
  provider_name: string;
  model_name: string;
  api_key?: string;
  base_url?: string;
}

export interface AutoContinueRequestPayload {
  enabled: boolean;
  fast_mode_enabled: boolean;
  continuation_length: number;
  sensitivity: number;
  source?: string;
}

export type AgentSearchMode = "disabled" | "allowed" | "required";

/**
 * Aster 会话信息（匹配后端 SessionInfo 结构）
 */
export interface AsterSessionInfo {
  id: string;
  name?: string;
  created_at: number;
  updated_at: number;
  model?: string;
  messages_count?: number;
  execution_strategy?: AsterExecutionStrategy;
  workspace_id?: string;
  working_dir?: string;
}

export interface AsterTodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  active_form?: string;
}

/**
 * TauriMessageContent（匹配后端 TauriMessageContent 枚举）
 */
export interface TauriMessageContent {
  type: string;
  text?: string;
  image_url?: { url: string; detail?: string } | string;
  id?: string;
  action_type?: string;
  data?: unknown;
  tool_name?: string;
  arguments?: unknown;
  success?: boolean;
  output?: string;
  error?: string;
  images?: ToolResultImage[];
  mime_type?: string;
}

/**
 * Aster 会话详情（匹配后端 SessionDetail 结构）
 */
export interface AsterSessionDetail {
  id: string;
  thread_id?: string;
  name?: string;
  created_at: number;
  updated_at: number;
  model?: string;
  workspace_id?: string;
  working_dir?: string;
  execution_strategy?: AsterExecutionStrategy;
  messages: Array<{
    id?: string;
    role: string;
    content: TauriMessageContent[];
    timestamp: number;
  }>;
  turns?: AgentThreadTurn[];
  items?: AgentThreadItem[];
  queued_turns?: QueuedTurnSnapshot[];
  todo_items?: AsterTodoItem[];
}

export interface AgentTurnConfigSnapshot {
  provider_config?: AsterProviderConfig;
  execution_strategy?: AsterExecutionStrategy;
  web_search?: boolean;
  search_mode?: AgentSearchMode;
  auto_continue?: AutoContinueRequestPayload;
  system_prompt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRuntimeSubmitTurnRequest {
  message: string;
  session_id: string;
  event_name: string;
  workspace_id: string;
  turn_id?: string;
  images?: ImageInput[];
  turn_config?: AgentTurnConfigSnapshot;
  queue_if_busy?: boolean;
  queued_turn_id?: string;
}

export interface AgentRuntimeInterruptTurnRequest {
  session_id: string;
  turn_id?: string;
}

export interface AgentRuntimeRemoveQueuedTurnRequest {
  session_id: string;
  queued_turn_id: string;
}

export interface AgentRuntimeRespondActionRequest {
  session_id: string;
  request_id: string;
  action_type: "tool_confirmation" | "ask_user" | "elicitation";
  confirmed: boolean;
  response?: string;
  user_data?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AgentRuntimeUpdateSessionRequest {
  session_id: string;
  name?: string;
  execution_strategy?: AsterExecutionStrategy;
}

export async function submitAgentRuntimeTurn(
  request: AgentRuntimeSubmitTurnRequest,
): Promise<void> {
  return await safeInvoke("agent_runtime_submit_turn", { request });
}

export async function interruptAgentRuntimeTurn(
  request: AgentRuntimeInterruptTurnRequest,
): Promise<boolean> {
  return await safeInvoke("agent_runtime_interrupt_turn", { request });
}

export async function removeAgentRuntimeQueuedTurn(
  request: AgentRuntimeRemoveQueuedTurnRequest,
): Promise<boolean> {
  return await safeInvoke("agent_runtime_remove_queued_turn", { request });
}

export async function respondAgentRuntimeAction(
  request: AgentRuntimeRespondActionRequest,
): Promise<void> {
  return await safeInvoke("agent_runtime_respond_action", { request });
}

export async function createAgentRuntimeSession(
  workspaceId: string,
  name?: string,
  executionStrategy?: AsterExecutionStrategy,
): Promise<string> {
  return await safeInvoke("agent_runtime_create_session", {
    workspaceId: requireWorkspaceId(workspaceId),
    name,
    executionStrategy,
  });
}

export async function listAgentRuntimeSessions(): Promise<AsterSessionInfo[]> {
  const startedAt = Date.now();
  let settled = false;
  const slowTimer: number | null =
    typeof window !== "undefined"
      ? window.setTimeout(() => {
          if (settled) {
            return;
          }
          logAgentDebug(
            "AgentApi",
            "runtimeListSessions.slow",
            {
              elapsedMs: Date.now() - startedAt,
            },
            {
              dedupeKey: "runtimeListSessions.slow",
              level: "warn",
              throttleMs: 1000,
            },
          );
        }, 1000)
      : null;

  logAgentDebug("AgentApi", "runtimeListSessions.start");

  try {
    const sessions = await safeInvoke<AsterSessionInfo[]>(
      "agent_runtime_list_sessions",
    );
    settled = true;
    logAgentDebug("AgentApi", "runtimeListSessions.success", {
      durationMs: Date.now() - startedAt,
      sessionsCount: sessions.length,
    });
    return sessions;
  } catch (error) {
    settled = true;
    logAgentDebug(
      "AgentApi",
      "runtimeListSessions.error",
      {
        durationMs: Date.now() - startedAt,
        error,
      },
      { level: "error" },
    );
    throw error;
  } finally {
    if (slowTimer !== null) {
      clearTimeout(slowTimer);
    }
  }
}

export async function getAgentRuntimeSession(
  sessionId: string,
): Promise<AsterSessionDetail> {
  const detail = await safeInvoke("agent_runtime_get_session", { sessionId });
  return {
    ...(detail as AsterSessionDetail),
    queued_turns: normalizeQueuedTurnSnapshots(
      (detail as AsterSessionDetail | null | undefined)?.queued_turns,
    ),
  };
}

export async function updateAgentRuntimeSession(
  request: AgentRuntimeUpdateSessionRequest,
): Promise<void> {
  return await safeInvoke("agent_runtime_update_session", { request });
}

export async function deleteAgentRuntimeSession(
  sessionId: string,
): Promise<void> {
  return await safeInvoke("agent_runtime_delete_session", { sessionId });
}

/**
 * 启动 Agent（初始化原生 Agent）
 */
export async function startAgentProcess(): Promise<AgentProcessStatus> {
  return await safeInvoke("agent_start_process", {});
}

/**
 * 停止 Agent
 */
export async function stopAgentProcess(): Promise<void> {
  return await safeInvoke("agent_stop_process");
}

/**
 * 获取 Agent 状态
 */
export async function getAgentProcessStatus(): Promise<AgentProcessStatus> {
  return await safeInvoke("agent_get_process_status");
}

/**
 * 生成会话智能标题
 *
 * 现役 runtime 命名入口。
 */
export async function generateAgentRuntimeSessionTitle(
  sessionId: string,
): Promise<string> {
  return await safeInvoke("agent_generate_title", {
    sessionId,
  });
}

/**
 * 初始化 Aster Agent
 */
export async function initAsterAgent(): Promise<AsterAgentStatus> {
  return await safeInvoke("aster_agent_init");
}

/**
 * 获取 Aster Agent 状态
 */
export async function getAsterAgentStatus(): Promise<AsterAgentStatus> {
  return await safeInvoke("aster_agent_status");
}

/**
 * 配置 Aster Agent 的 Provider
 */
export async function configureAsterProvider(
  config: AsterProviderConfig,
  sessionId: string,
): Promise<AsterAgentStatus> {
  return await safeInvoke("aster_agent_configure_provider", {
    request: config,
    session_id: sessionId,
  });
}

/**
 * 终端命令请求（从后端发送到前端）
 */
export interface TerminalCommandRequest {
  /** 请求 ID */
  request_id: string;
  /** 要执行的命令 */
  command: string;
  /** 工作目录（可选） */
  working_dir?: string;
  /** 超时时间（秒） */
  timeout_secs: number;
}

/**
 * 终端命令响应（从前端发送到后端）
 */
export interface TerminalCommandResponse {
  /** 请求 ID */
  request_id: string;
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output: string;
  /** 错误信息 */
  error?: string;
  /** 退出码 */
  exit_code?: number;
  /** 是否被用户拒绝 */
  rejected: boolean;
}

/**
 * 发送终端命令响应到后端
 *
 * 当用户批准或拒绝命令后，调用此函数将结果发送给 TerminalTool
 */
export async function sendTerminalCommandResponse(
  response: TerminalCommandResponse,
): Promise<void> {
  return await safeInvoke("agent_terminal_command_response", {
    requestId: response.request_id,
    success: response.success,
    output: response.output,
    error: response.error,
    exitCode: response.exit_code,
    rejected: response.rejected,
  });
}

/**
 * 终端滚动缓冲区请求（从后端发送到前端）
 */
export interface TermScrollbackRequest {
  /** 请求 ID */
  request_id: string;
  /** 终端会话 ID */
  session_id: string;
  /** 起始行号（可选，从 0 开始） */
  line_start?: number;
  /** 读取行数（可选） */
  count?: number;
}

/**
 * 终端滚动缓冲区响应（从前端发送到后端）
 */
export interface TermScrollbackResponse {
  /** 请求 ID */
  request_id: string;
  /** 是否成功 */
  success: boolean;
  /** 总行数 */
  total_lines: number;
  /** 实际返回的起始行号 */
  line_start: number;
  /** 实际返回的结束行号 */
  line_end: number;
  /** 输出内容 */
  content: string;
  /** 是否还有更多内容 */
  has_more: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 发送终端滚动缓冲区响应到后端
 *
 * 当前端读取终端输出历史后，调用此函数将结果发送给 TermScrollbackTool
 */
export async function sendTermScrollbackResponse(
  response: TermScrollbackResponse,
): Promise<void> {
  return await safeInvoke("agent_term_scrollback_response", {
    requestId: response.request_id,
    success: response.success,
    totalLines: response.total_lines,
    lineStart: response.line_start,
    lineEnd: response.line_end,
    content: response.content,
    hasMore: response.has_more,
    error: response.error,
  });
}
