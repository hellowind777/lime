import type { AgentThreadItem } from "@/lib/api/agentStream";
import type { AsterSubagentSessionInfo } from "@/lib/api/agentRuntime";

export type TeamWorkspaceRuntimeStatus =
  AsterSubagentSessionInfo["runtime_status"];
export type TeamWorkspaceResolvedRuntimeStatus =
  | TeamWorkspaceRuntimeStatus
  | "not_found";

export interface TeamWorkspaceActivityEntry {
  id: string;
  title: string;
  detail: string;
  statusLabel: string;
  badgeClassName: string;
}

export interface TeamWorkspaceLiveRuntimeState {
  runtimeStatus: TeamWorkspaceRuntimeStatus;
  latestTurnStatus: TeamWorkspaceRuntimeStatus;
  baseFingerprint: string;
}

export interface TeamWorkspaceRuntimeSessionSnapshot {
  id: string;
  runtimeStatus?: TeamWorkspaceRuntimeStatus;
  latestTurnStatus?: TeamWorkspaceRuntimeStatus;
  queuedTurnCount?: number;
  updatedAt?: number;
}

export interface TeamWorkspaceRuntimeCard {
  id: string;
  runtimeStatus?: TeamWorkspaceRuntimeStatus;
  latestTurnStatus?: TeamWorkspaceRuntimeStatus;
}

export interface TeamWorkspaceWaitSummary {
  awaitedSessionIds: string[];
  timedOut: boolean;
  resolvedSessionId?: string;
  resolvedStatus?: TeamWorkspaceResolvedRuntimeStatus;
  updatedAt: number;
}

export interface TeamWorkspaceControlSummary {
  action: "close" | "resume" | "close_completed";
  requestedSessionIds: string[];
  cascadeSessionIds: string[];
  affectedSessionIds: string[];
  updatedAt: number;
}

const STATUS_META = {
  idle: {
    label: "待开始",
    badgeClassName: "border border-slate-200 bg-white text-slate-600",
  },
  queued: {
    label: "排队中",
    badgeClassName: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  running: {
    label: "运行中",
    badgeClassName: "border border-sky-200 bg-sky-50 text-sky-700",
  },
  completed: {
    label: "已完成",
    badgeClassName: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "失败",
    badgeClassName: "border border-rose-200 bg-rose-50 text-rose-700",
  },
  aborted: {
    label: "已中止",
    badgeClassName: "border border-rose-200 bg-rose-50 text-rose-700",
  },
  closed: {
    label: "已关闭",
    badgeClassName: "border border-slate-200 bg-slate-100 text-slate-600",
  },
} satisfies Record<
  NonNullable<TeamWorkspaceRuntimeStatus> | "idle",
  { label: string; badgeClassName: string }
>;

const ACTIVITY_DETAIL_MAX_LENGTH = 220;

function resolveStatusMeta(status?: TeamWorkspaceRuntimeStatus) {
  return STATUS_META[status ?? "idle"];
}

function normalizeActivityText(
  value?: string | null,
  maxLength = ACTIVITY_DETAIL_MAX_LENGTH,
): string | null {
  const normalized = value
    ?.replace(/\r\n/g, "\n")
    .split("\0")
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function resolveActivityEntryStatusMeta(
  item: AgentThreadItem,
  status?: AgentThreadItem["status"],
) {
  if (item.type === "error") {
    return {
      label: "错误",
      badgeClassName: "border border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (item.type === "warning") {
    return {
      label: "警告",
      badgeClassName: "border border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  switch (status) {
    case "in_progress":
      return {
        label: "进行中",
        badgeClassName: "border border-sky-200 bg-sky-50 text-sky-700",
      };
    case "failed":
      return {
        label: "失败",
        badgeClassName: "border border-rose-200 bg-rose-50 text-rose-700",
      };
    case "completed":
      return {
        label: "完成",
        badgeClassName: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    default:
      return {
        label: "消息",
        badgeClassName: "border border-slate-200 bg-slate-50 text-slate-600",
      };
  }
}

function resolveItemActivityDescriptor(item: AgentThreadItem): {
  title: string;
  detail: string | null;
} | null {
  switch (item.type) {
    case "agent_message":
      return {
        title: "回复",
        detail: normalizeActivityText(item.text),
      };
    case "turn_summary":
      return {
        title: "总结",
        detail: normalizeActivityText(item.text),
      };
    case "reasoning":
      return {
        title: "推理",
        detail: normalizeActivityText(item.text),
      };
    case "plan":
      return {
        title: "计划",
        detail: normalizeActivityText(item.text),
      };
    case "tool_call":
      return {
        title: item.tool_name ? `工具 ${item.tool_name}` : "工具输出",
        detail:
          normalizeActivityText(item.error || item.output) ||
          normalizeActivityText(item.tool_name),
      };
    case "command_execution":
      return {
        title: item.error || item.aggregated_output ? "命令输出" : "命令",
        detail:
          normalizeActivityText(item.error || item.aggregated_output) ||
          normalizeActivityText(item.command),
      };
    case "web_search":
      return {
        title: item.output ? "检索结果" : "检索查询",
        detail:
          normalizeActivityText(item.output) || normalizeActivityText(item.query),
      };
    case "warning":
      return {
        title: "警告",
        detail: normalizeActivityText(item.message),
      };
    case "error":
      return {
        title: "错误",
        detail: normalizeActivityText(item.message),
      };
    case "subagent_activity":
      return {
        title: "子代理动态",
        detail: normalizeActivityText(
          item.summary || item.title || item.status_label,
        ),
      };
    default:
      return null;
  }
}

export function resolveTeamWorkspaceRuntimeStatusLabel(
  status?: TeamWorkspaceResolvedRuntimeStatus,
): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "aborted":
      return "已中止";
    case "closed":
      return "已关闭";
    case "not_found":
      return "未找到";
    default:
      return "待开始";
  }
}

export function isTeamWorkspaceTerminalStatus(
  status?: TeamWorkspaceResolvedRuntimeStatus,
): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "aborted" ||
    status === "closed" ||
    status === "not_found"
  );
}

export function normalizeTeamWorkspaceRuntimeStatus(
  status: TeamWorkspaceResolvedRuntimeStatus,
): TeamWorkspaceRuntimeStatus {
  return status === "not_found" ? "closed" : status;
}

export function buildTeamWorkspaceSessionFingerprint(
  session?: TeamWorkspaceRuntimeSessionSnapshot | null,
) {
  if (!session) {
    return "";
  }

  return [
    session.id,
    session.updatedAt ?? 0,
    session.runtimeStatus ?? "idle",
    session.latestTurnStatus ?? "idle",
    session.queuedTurnCount ?? 0,
  ].join(":");
}

export function buildStatusEventActivityEntry(
  sessionId: string,
  status: TeamWorkspaceRuntimeStatus | "not_found",
): TeamWorkspaceActivityEntry {
  const normalizedStatus = normalizeTeamWorkspaceRuntimeStatus(status);
  const statusMeta = resolveStatusMeta(normalizedStatus);
  return {
    id: `status-${sessionId}-${normalizedStatus}-${Date.now()}`,
    title: "状态切换",
    detail: `收到 team 状态事件，已切换为${statusMeta.label}。`,
    statusLabel: statusMeta.label,
    badgeClassName: statusMeta.badgeClassName,
  };
}

export function buildTeamWorkspaceActivityEntryFromThreadItem(
  item: AgentThreadItem,
): TeamWorkspaceActivityEntry | null {
  const descriptor = resolveItemActivityDescriptor(item);
  if (!descriptor?.detail) {
    return null;
  }

  const statusMeta = resolveActivityEntryStatusMeta(item, item.status);
  return {
    id: item.id,
    title: descriptor.title,
    detail: descriptor.detail,
    statusLabel: statusMeta.label,
    badgeClassName: statusMeta.badgeClassName,
  };
}

export function mergeSessionActivityEntries(
  liveEntries?: TeamWorkspaceActivityEntry[],
  storedEntries?: TeamWorkspaceActivityEntry[],
  limit = 4,
) {
  const merged: TeamWorkspaceActivityEntry[] = [];
  const seen = new Set<string>();

  for (const entry of [...(liveEntries ?? []), ...(storedEntries ?? [])]) {
    const dedupeKey = `${entry.title}:${entry.detail}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    merged.push(entry);
    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

export function applyLiveRuntimeState<T extends TeamWorkspaceRuntimeCard>(
  session: T | null,
  liveState?: TeamWorkspaceLiveRuntimeState,
): T | null {
  if (!session || !liveState) {
    return session;
  }

  return {
    ...session,
    runtimeStatus: liveState.runtimeStatus,
    latestTurnStatus: liveState.latestTurnStatus,
  };
}
