import type {
  AsterExecutionStrategy,
  AsterSessionInfo,
  AutoContinueRequestPayload,
} from "@/lib/api/agentRuntime";
import type { Message, MessageImage, WriteArtifactContext } from "../types";
import { normalizeExecutionStrategy } from "./agentChatCoreUtils";

export type TaskStatus = "draft" | "running" | "waiting" | "done" | "failed";

export interface Topic {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messagesCount: number;
  executionStrategy: AsterExecutionStrategy;
  status: TaskStatus;
  lastPreview: string;
  isPinned: boolean;
  hasUnread: boolean;
  tag?: string | null;
  sourceSessionId: string;
}

export interface UseAsterAgentChatOptions {
  systemPrompt?: string;
  onWriteFile?: (
    content: string,
    fileName: string,
    context?: WriteArtifactContext,
  ) => void;
  workspaceId: string;
  disableSessionRestore?: boolean;
}

export interface SendMessageObserver {
  onTextDelta?: (delta: string, accumulated: string) => void;
  onComplete?: (content: string) => void;
  onError?: (message: string) => void;
}

export interface SendMessageOptions {
  purpose?: Message["purpose"];
  observer?: SendMessageObserver;
  requestMetadata?: Record<string, unknown>;
}

export interface WorkspacePathMissingState {
  content: string;
  images: MessageImage[];
}

export interface AgentPreferences {
  providerType: string;
  model: string;
}

export interface AgentPreferenceKeys {
  providerKey: string;
  modelKey: string;
  migratedKey: string;
}

export interface SessionModelPreference {
  providerType: string;
  model: string;
}

export interface ClearMessagesOptions {
  showToast?: boolean;
  toastMessage?: string;
}

export interface LiveTaskSnapshot {
  updatedAt?: Date;
  messagesCount: number;
  status: TaskStatus;
  lastPreview: string;
  hasUnread: boolean;
}

export type SendMessageFn = (
  content: string,
  images: MessageImage[],
  webSearch?: boolean,
  thinking?: boolean,
  skipUserMessage?: boolean,
  executionStrategyOverride?: AsterExecutionStrategy,
  modelOverride?: string,
  autoContinue?: AutoContinueRequestPayload,
  options?: SendMessageOptions,
) => Promise<void>;

export const getScopedStorageKey = (
  workspaceId: string | null | undefined,
  prefix: string,
): string => {
  const resolvedWorkspaceId = workspaceId?.trim();
  return `${prefix}_${resolvedWorkspaceId || "global"}`;
};

function normalizeTaskPreviewText(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 96);
}

function extractMessageTextContent(message: Message): string {
  if (message.content?.trim()) {
    return normalizeTaskPreviewText(message.content);
  }

  const partText = message.contentParts
    ?.filter(
      (part): part is Extract<(typeof message.contentParts)[number], { type: "text" | "thinking" }> =>
        part.type === "text" || part.type === "thinking",
    )
    .map((part) => part.text)
    .join(" ");

  return normalizeTaskPreviewText(partText || "");
}

function extractToolCallPreview(message: Message): string {
  const latestToolCall = [...(message.toolCalls || [])].reverse().find(Boolean);
  if (!latestToolCall) {
    return "";
  }

  const toolName = latestToolCall.name?.trim() || "工具";
  if (latestToolCall.status === "failed") {
    return `执行失败：${toolName}`;
  }
  if (latestToolCall.status === "running") {
    return `正在执行：${toolName}`;
  }
  return `最近执行：${toolName}`;
}

export function extractTaskPreviewFromMessages(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const textContent = extractMessageTextContent(message);
    if (textContent) {
      return textContent;
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const hasPendingAction = message.actionRequests?.some(
      (item) => item.status === "pending" || item.status === "queued",
    );
    if (hasPendingAction) {
      return "等待你确认或补充信息后继续执行。";
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const toolPreview = extractToolCallPreview(message);
    if (toolPreview) {
      return toolPreview;
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const runtimeDetail = normalizeTaskPreviewText(
      `${message.runtimeStatus?.title || ""} ${message.runtimeStatus?.detail || ""}`,
    );
    if (runtimeDetail) {
      return runtimeDetail;
    }
  }

  return "";
}

export function deriveTaskStatusFromLiveState(params: {
  messages: Message[];
  isSending: boolean;
  pendingActionCount: number;
  queuedTurnCount?: number;
  workspaceError: boolean;
}): TaskStatus {
  const {
    messages,
    isSending,
    pendingActionCount,
    queuedTurnCount = 0,
    workspaceError,
  } = params;

  if (workspaceError) {
    return "failed";
  }

  if (isSending || queuedTurnCount > 0) {
    return "running";
  }

  const hasPendingActionInMessages = messages.some((message) =>
    message.actionRequests?.some(
      (item) => item.status === "pending" || item.status === "queued",
    ),
  );
  if (pendingActionCount > 0 || hasPendingActionInMessages) {
    return "waiting";
  }

  if (messages.length === 0) {
    return "draft";
  }

  const latestMessage = messages[messages.length - 1];
  const latestToolFailed = latestMessage?.toolCalls?.some(
    (item) => item.status === "failed",
  );
  if (latestToolFailed) {
    return "failed";
  }

  if (latestMessage?.role === "user") {
    return "running";
  }

  return "done";
}

export function buildLiveTaskSnapshot(params: {
  messages: Message[];
  isSending: boolean;
  pendingActionCount: number;
  queuedTurnCount?: number;
  workspaceError: boolean;
}): LiveTaskSnapshot {
  const { messages, isSending, pendingActionCount, queuedTurnCount, workspaceError } =
    params;
  const lastMessage = messages[messages.length - 1];
  const preview = extractTaskPreviewFromMessages(messages);

  return {
    updatedAt: lastMessage?.timestamp,
    messagesCount: messages.length,
    status: deriveTaskStatusFromLiveState({
      messages,
      isSending,
      pendingActionCount,
      queuedTurnCount,
      workspaceError,
    }),
    lastPreview:
      preview || "等待你补充任务需求后开始执行。",
    hasUnread: false,
  };
}

export const mapSessionToTopic = (session: AsterSessionInfo): Topic => {
  const updatedAtEpoch = Number.isFinite(session.updated_at)
    ? session.updated_at
    : session.created_at;
  const messagesCount = session.messages_count ?? 0;

  return {
    id: session.id,
    title:
      session.name ||
      `任务 ${new Date(session.created_at * 1000).toLocaleDateString("zh-CN")}`,
    createdAt: new Date(session.created_at * 1000),
    updatedAt: new Date(updatedAtEpoch * 1000),
    messagesCount,
    executionStrategy: normalizeExecutionStrategy(session.execution_strategy),
    status: messagesCount > 0 ? "done" : "draft",
    lastPreview:
      messagesCount > 0
        ? `已记录 ${messagesCount} 条消息，可继续补充或复盘。`
        : "等待你补充任务需求后开始执行。",
    isPinned: false,
    hasUnread: false,
    tag: null,
    sourceSessionId: session.id,
  };
};
