/**
 * Aster Agent Zustand Store
 *
 * 基于 Aster 框架的 Agent 状态管理
 * 参考 Claude-Cowork 的设计模式
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  isAsterSessionNotFoundError,
  resolveRestorableSessionId,
} from "@/lib/asterSessionRecovery";

// ============ 类型定义 ============

/** 消息图片 */
export interface MessageImage {
  data: string;
  mediaType: string;
}

/** 工具调用结果 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

/** 工具调用状态 */
export interface ToolCallState {
  id: string;
  name: string;
  arguments?: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: ToolResult;
  startTime?: Date;
  endTime?: Date;
}

/** Token 使用量 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/** 内容片段类型 */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_use"; toolCall: ToolCallState };

/** 消息 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: MessageImage[];
  timestamp: Date;
  isThinking?: boolean;
  thinkingContent?: string;
  toolCalls?: ToolCallState[];
  usage?: TokenUsage;
  contentParts?: ContentPart[];
}

/** 会话信息 */
export interface SessionInfo {
  id: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  messagesCount: number;
}

/** 权限确认请求 */
export interface ActionRequired {
  requestId: string;
  actionType:
    | "tool_confirmation"
    | "ask_user"
    | "elicitation"
    | "permission_request";
  toolName?: string;
  arguments?: Record<string, unknown>;
  prompt?: string;
  requestedSchema?: Record<string, unknown>;
  options?: Array<{
    label: string;
    description?: string;
  }>;
  timestamp: Date;
}

/** 确认响应 */
export interface ConfirmResponse {
  requestId: string;
  confirmed: boolean;
  response?: string;
  actionType?: ActionRequired["actionType"];
  userData?: unknown;
}

// ============ Tauri 事件类型 ============

/** Tauri Agent 事件 */
export type TauriAgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | {
      type: "tool_start";
      tool_name: string;
      tool_id: string;
      arguments?: string;
    }
  | { type: "tool_end"; tool_id: string; result: ToolResult }
  | {
      type: "action_required";
      request_id: string;
      action_type: string;
      data: Record<string, unknown>;
    }
  | { type: "model_change"; model: string; mode: string }
  | { type: "done"; usage?: TokenUsage }
  | { type: "final_done"; usage?: TokenUsage }
  | { type: "warning"; code?: string; message: string }
  | { type: "error"; message: string }
  | { type: "message"; message: unknown };

// ============ Store 状态类型 ============

interface AgentState {
  // 会话状态
  currentSessionId: string | null;
  sessions: SessionInfo[];
  messages: Message[];

  // 流式状态
  isStreaming: boolean;
  currentAssistantMsgId: string | null;

  // 权限确认
  pendingActions: ActionRequired[];

  // 配置
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  sendMessage: (content: string, images?: MessageImage[]) => Promise<void>;
  stopStreaming: () => Promise<void>;
  confirmAction: (response: ConfirmResponse) => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createSession: (name?: string) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
  loadSessions: () => Promise<void>;

  // 内部方法
  _handleEvent: (event: TauriAgentEvent) => void;
  _cleanup: () => void;
}

// ============ Store 实现 ============

// 事件监听器引用
let eventUnlisten: UnlistenFn | null = null;

export const useAgentStore = create<AgentState>((set, get) => ({
  // 初始状态
  currentSessionId: null,
  sessions: [],
  messages: [],
  isStreaming: false,
  currentAssistantMsgId: null,
  pendingActions: [],
  isInitialized: false,

  // 初始化 Agent
  initialize: async () => {
    try {
      await invoke("aster_agent_init");
      set({ isInitialized: true });
      console.log("[AgentStore] Agent 初始化成功");

      // 加载会话列表
      await get().loadSessions();
    } catch (error) {
      console.error("[AgentStore] Agent 初始化失败:", error);
      throw error;
    }
  },

  // 发送消息
  sendMessage: async (content: string, images?: MessageImage[]) => {
    const state = get();

    // 确保已初始化
    if (!state.isInitialized) {
      await state.initialize();
    }

    // 确保有会话
    let sessionId = state.currentSessionId;
    if (!sessionId) {
      sessionId = await state.createSession();
    }

    // 创建用户消息
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      images,
      timestamp: new Date(),
    };

    // 创建助手消息占位符
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isThinking: true,
      thinkingContent: "思考中...",
      contentParts: [],
    };

    // 更新状态
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
      currentAssistantMsgId: assistantMsgId,
    }));

    // 创建唯一事件名称
    const eventName = `aster_stream_${assistantMsgId}`;

    try {
      // 设置事件监听器
      eventUnlisten = await listen<TauriAgentEvent>(eventName, (event) => {
        get()._handleEvent(event.payload);
      });

      // 发送请求
      await invoke("aster_agent_chat_stream", {
        request: {
          message: content,
          session_id: sessionId,
          event_name: eventName,
          images: images?.map((img) => ({
            data: img.data,
            media_type: img.mediaType,
          })),
        },
      });
    } catch (error) {
      console.error("[AgentStore] 发送消息失败:", error);

      // 更新消息状态为错误
      set((s) => ({
        messages: s.messages.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isThinking: false,
                content: `错误: ${error}`,
              }
            : msg,
        ),
        isStreaming: false,
        currentAssistantMsgId: null,
      }));

      get()._cleanup();
      throw error;
    }
  },

  // 停止流式响应
  stopStreaming: async () => {
    const state = get();
    if (!state.currentSessionId) return;

    try {
      await invoke("aster_agent_stop", {
        sessionId: state.currentSessionId,
      });
    } catch (error) {
      console.error("[AgentStore] 停止失败:", error);
    }

    // 更新消息状态
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === s.currentAssistantMsgId
          ? {
              ...msg,
              isThinking: false,
              content: msg.content || "(已停止生成)",
            }
          : msg,
      ),
      isStreaming: false,
      currentAssistantMsgId: null,
    }));

    get()._cleanup();
  },

  // 确认权限请求
  confirmAction: async (response: ConfirmResponse) => {
    try {
      const state = get();
      const actionType =
        response.actionType ||
        state.pendingActions.find((a) => a.requestId === response.requestId)
          ?.actionType;

      if (actionType === "elicitation" || actionType === "ask_user") {
        if (!state.currentSessionId) {
          throw new Error("缺少会话 ID，无法提交 elicitation 响应");
        }

        let userData: unknown;
        if (!response.confirmed) {
          userData = "";
        } else if (response.userData !== undefined) {
          userData = response.userData;
        } else if (response.response !== undefined) {
          const rawResponse = response.response.trim();
          if (!rawResponse) {
            userData = "";
          } else {
            try {
              userData = JSON.parse(rawResponse);
            } catch {
              userData = rawResponse;
            }
          }
        } else {
          userData = "";
        }

        await invoke("aster_agent_submit_elicitation_response", {
          sessionId: state.currentSessionId,
          request: {
            request_id: response.requestId,
            user_data: userData,
          },
        });
      } else {
        await invoke("aster_agent_confirm", {
          request: {
            request_id: response.requestId,
            confirmed: response.confirmed,
            response: response.response,
          },
        });
      }

      // 移除已处理的请求
      set((s) => ({
        pendingActions: s.pendingActions.filter(
          (a) => a.requestId !== response.requestId,
        ),
      }));
    } catch (error) {
      console.error("[AgentStore] 确认失败:", error);
      throw error;
    }
  },

  // 切换会话
  switchSession: async (sessionId: string) => {
    try {
      const detail = await invoke<{
        id: string;
        name?: string;
        messages: Array<{
          role: string;
          content: string;
          timestamp: string;
        }>;
      }>("aster_session_get", { sessionId });

      // 转换消息格式
      const messages: Message[] = detail.messages.map((msg, index) => ({
        id: `${sessionId}-${index}`,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      set({
        currentSessionId: sessionId,
        messages,
        pendingActions: [],
      });
    } catch (error) {
      console.error("[AgentStore] 切换会话失败:", error);
      if (isAsterSessionNotFoundError(error)) {
        try {
          const sessions = await invoke<
            Array<{
              id: string;
              created_at: number;
              updated_at: number;
            }>
          >("aster_session_list");
          const recoveredSessionId = resolveRestorableSessionId({
            candidateSessionId: null,
            sessions: sessions.map((item) => ({
              id: item.id,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
            })),
          });

          if (recoveredSessionId && recoveredSessionId !== sessionId) {
            await get().switchSession(recoveredSessionId);
            return;
          }

          await get().createSession();
          set({
            messages: [],
            pendingActions: [],
          });
          return;
        } catch (recoveryError) {
          console.error("[AgentStore] 恢复会话失败:", recoveryError);
        }
      }
      throw error;
    }
  },

  // 创建会话
  createSession: async (name?: string) => {
    try {
      const sessionId = await invoke<string>("aster_session_create", {
        workingDir: null,
        name,
      });

      set((s) => ({
        currentSessionId: sessionId,
        messages: [],
        sessions: [
          {
            id: sessionId,
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
            messagesCount: 0,
          },
          ...s.sessions,
        ],
      }));

      return sessionId;
    } catch (error) {
      console.error("[AgentStore] 创建会话失败:", error);
      throw error;
    }
  },

  // 删除会话
  deleteSession: async (sessionId: string) => {
    // TODO: 实现后端删除接口
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== sessionId),
      ...(s.currentSessionId === sessionId
        ? { currentSessionId: null, messages: [] }
        : {}),
    }));
  },

  // 清空消息
  clearMessages: () => {
    set({
      messages: [],
      currentSessionId: null,
      pendingActions: [],
    });
  },

  // 加载会话列表
  loadSessions: async () => {
    try {
      const sessions = await invoke<
        Array<{
          id: string;
          name?: string;
          created_at: string;
          updated_at: string;
          messages_count: number;
        }>
      >("aster_session_list");

      set({
        sessions: sessions.map((s) => ({
          id: s.id,
          name: s.name,
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
          messagesCount: s.messages_count,
        })),
      });
    } catch (error) {
      console.error("[AgentStore] 加载会话列表失败:", error);
    }
  },

  // 处理事件
  _handleEvent: (event: TauriAgentEvent) => {
    const state = get();
    const msgId = state.currentAssistantMsgId;
    if (!msgId) return;

    console.log("[AgentStore] 收到事件:", event.type, event);

    switch (event.type) {
      case "text_delta":
        set((s) => ({
          messages: s.messages.map((msg) => {
            if (msg.id !== msgId) return msg;

            const newContent = msg.content + event.text;
            const newParts = [...(msg.contentParts || [])];

            // 追加到最后一个 text 类型，或创建新的
            const lastPart = newParts[newParts.length - 1];
            if (lastPart && lastPart.type === "text") {
              newParts[newParts.length - 1] = {
                type: "text",
                text: lastPart.text + event.text,
              };
            } else {
              newParts.push({ type: "text", text: event.text });
            }

            return {
              ...msg,
              content: newContent,
              isThinking: false,
              thinkingContent: undefined,
              contentParts: newParts,
            };
          }),
        }));
        break;

      case "thinking_delta":
        set((s) => ({
          messages: s.messages.map((msg) => {
            if (msg.id !== msgId) return msg;

            const newParts = [...(msg.contentParts || [])];
            const lastPart = newParts[newParts.length - 1];
            if (lastPart && lastPart.type === "thinking") {
              newParts[newParts.length - 1] = {
                type: "thinking",
                text: lastPart.text + event.text,
              };
            } else {
              newParts.push({ type: "thinking", text: event.text });
            }

            return {
              ...msg,
              thinkingContent: (msg.thinkingContent || "") + event.text,
              contentParts: newParts,
            };
          }),
        }));
        break;

      case "tool_start": {
        const newToolCall: ToolCallState = {
          id: event.tool_id,
          name: event.tool_name,
          arguments: event.arguments,
          status: "running",
          startTime: new Date(),
        };

        set((s) => ({
          messages: s.messages.map((msg) => {
            if (msg.id !== msgId) return msg;

            // 检查是否已存在
            if (msg.toolCalls?.find((tc) => tc.id === event.tool_id)) {
              return msg;
            }

            return {
              ...msg,
              toolCalls: [...(msg.toolCalls || []), newToolCall],
              contentParts: [
                ...(msg.contentParts || []),
                { type: "tool_use" as const, toolCall: newToolCall },
              ],
            };
          }),
        }));
        break;
      }

      case "tool_end":
        set((s) => ({
          messages: s.messages.map((msg) => {
            if (msg.id !== msgId) return msg;

            const updatedToolCalls = (msg.toolCalls || []).map((tc) =>
              tc.id === event.tool_id
                ? {
                    ...tc,
                    status: event.result.success
                      ? ("completed" as const)
                      : ("failed" as const),
                    result: event.result,
                    endTime: new Date(),
                  }
                : tc,
            );

            const updatedContentParts = (msg.contentParts || []).map((part) => {
              if (
                part.type === "tool_use" &&
                part.toolCall.id === event.tool_id
              ) {
                return {
                  ...part,
                  toolCall: {
                    ...part.toolCall,
                    status: event.result.success
                      ? ("completed" as const)
                      : ("failed" as const),
                    result: event.result,
                    endTime: new Date(),
                  },
                };
              }
              return part;
            });

            return {
              ...msg,
              toolCalls: updatedToolCalls,
              contentParts: updatedContentParts,
            };
          }),
        }));
        break;

      case "action_required":
        set((s) => ({
          pendingActions: [
            ...s.pendingActions,
            {
              requestId: event.request_id,
              actionType: event.action_type as ActionRequired["actionType"],
              toolName: event.data.tool_name as string | undefined,
              arguments: event.data.arguments as
                | Record<string, unknown>
                | undefined,
              prompt:
                (event.data.prompt as string | undefined) ||
                (event.data.message as string | undefined),
              requestedSchema: event.data.requested_schema as
                | Record<string, unknown>
                | undefined,
              options: event.data.options as
                | Array<{
                    label: string;
                    description?: string;
                  }>
                | undefined,
              timestamp: new Date(),
            },
          ],
        }));
        break;

      case "done":
        // 单次响应完成，但工具循环可能继续
        console.log("[AgentStore] done 事件，等待 final_done...");
        break;

      case "final_done":
        set((s) => ({
          messages: s.messages.map((msg) =>
            msg.id === msgId
              ? {
                  ...msg,
                  isThinking: false,
                  usage: event.usage,
                }
              : msg,
          ),
          isStreaming: false,
          currentAssistantMsgId: null,
        }));
        get()._cleanup();
        break;

      case "error":
        set((s) => ({
          messages: s.messages.map((msg) =>
            msg.id === msgId
              ? {
                  ...msg,
                  isThinking: false,
                  content: msg.content || `错误: ${event.message}`,
                }
              : msg,
          ),
          isStreaming: false,
          currentAssistantMsgId: null,
        }));
        get()._cleanup();
        break;

      case "warning":
        console.warn("[AgentStore] warning:", event.code, event.message);
        break;
    }
  },

  // 清理资源
  _cleanup: () => {
    if (eventUnlisten) {
      eventUnlisten();
      eventUnlisten = null;
    }
  },
}));

// 导出便捷 hooks
export const useAgentMessages = () => useAgentStore((s) => s.messages);
export const useAgentStreaming = () => useAgentStore((s) => s.isStreaming);
export const useAgentSessions = () => useAgentStore((s) => s.sessions);
export const usePendingActions = () => useAgentStore((s) => s.pendingActions);
