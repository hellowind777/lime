import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  Copy,
  ListTodo,
  Loader2,
  PauseCircle,
  PlayCircle,
  Waves,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AgentRuntimeThreadReadModel,
  QueuedTurnSnapshot,
} from "@/lib/api/agentRuntime";
import type { ActionRequired, AgentThreadItem, AgentThreadTurn } from "../types";
import {
  buildThreadReliabilityView,
  type ThreadReliabilityTone,
} from "../utils/threadReliabilityView";
import { AgentIncidentPanel } from "./AgentIncidentPanel";
import { AgentThreadOutcomeSummary } from "./AgentThreadOutcomeSummary";

interface AgentThreadReliabilityPanelProps {
  threadRead?: AgentRuntimeThreadReadModel | null;
  turns?: AgentThreadTurn[];
  threadItems?: AgentThreadItem[];
  currentTurnId?: string | null;
  pendingActions?: ActionRequired[];
  submittedActionsInFlight?: ActionRequired[];
  queuedTurns?: QueuedTurnSnapshot[];
  canInterrupt?: boolean;
  onInterruptCurrentTurn?: () => void | Promise<void>;
  onResumeThread?: () => boolean | Promise<boolean>;
  onReplayPendingRequest?: (requestId: string) => boolean | Promise<boolean>;
  onLocatePendingRequest?: (requestId: string) => void;
  onPromoteQueuedTurn?: (
    queuedTurnId: string,
  ) => boolean | Promise<boolean>;
  className?: string;
}

function serializeClipboardPayload(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (item instanceof Date ? item.toISOString() : item),
    2,
  );
}

function resolveToneClassName(tone: ThreadReliabilityTone) {
  switch (tone) {
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "waiting":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "paused":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function resolveStatShellClassName(tone: ThreadReliabilityTone) {
  switch (tone) {
    case "running":
      return "border-sky-200/80 bg-sky-50";
    case "waiting":
      return "border-amber-200/80 bg-amber-50";
    case "completed":
      return "border-emerald-200/80 bg-emerald-50";
    case "failed":
      return "border-rose-200/80 bg-rose-50";
    case "paused":
      return "border-slate-200/80 bg-slate-50";
    default:
      return "border-slate-200/80 bg-slate-50";
  }
}

function buildReliabilityDiagnosticText(params: {
  statusLabel: string;
  summary: string;
  view: ReturnType<typeof buildThreadReliabilityView>;
}): string {
  const { statusLabel, summary, view } = params;
  const sections: string[] = [
    "# Lime 线程可靠性诊断任务",
    "",
    "你现在是一名 AI 任务可靠性分析助手。请基于下面的线程可靠性数据，判断这次任务执行得好不好；如果执行不好，请找出根因，并给出可落地的修复建议。",
    "",
    "请重点回答以下问题：",
    "1. 这次任务整体表现属于：好 / 一般 / 差？请先给结论。",
    "2. 直接导致中断、失败、等待或漂移的主要原因是什么？",
    "3. 这是模型能力问题、Prompt/规划问题、工具问题、上下文问题、人工阻塞问题，还是产品交互问题？可多选，但要说明主次。",
    "4. 哪些问题是一次性偶发，哪些问题是系统性缺陷？",
    "5. 如果要优先修复，只做 1~3 件事，应该做什么？请按优先级排序。",
    "6. 如果当前信息还不足，请明确指出还缺哪些日志、埋点或上下文。",
    "",
    "请按以下结构输出：",
    "## 结论",
    "## 根因分析",
    "## 问题归类",
    "## 修复建议",
    "## 还缺少的信息",
    "",
    "---",
    "",
    "## 诊断数据",
    "",
    "### 当前状态",
    `- 状态：${statusLabel}`,
    `- 当前回合：${view.activeTurnLabel || "未知"}`,
    `- 摘要：${summary}`,
    `- 最近刷新：${view.updatedAtLabel || "未知"}`,
    `- 中断状态：${view.interruptStateLabel || "无"}`,
    "",
    "### 核心指标",
    `- 待处理请求：${view.pendingRequestCount}`,
    `- 活跃 Incident：${view.activeIncidentCount}`,
    `- 排队回合：${view.queuedTurnCount}`,
    "",
    "### 待处理请求",
  ];

  if (view.pendingRequests.length > 0) {
    for (const request of view.pendingRequests) {
      sections.push(
        `- ${request.title}｜${request.typeLabel}｜${request.statusLabel}${request.waitingLabel ? `｜${request.waitingLabel}` : ""}`,
      );
    }
  } else {
    sections.push("- 无");
  }

  sections.push("", "### 已提交待继续的请求");
  if (view.submittedRequests.length > 0) {
    for (const request of view.submittedRequests) {
      sections.push(
        `- ${request.title}｜${request.typeLabel}｜${request.statusLabel}`,
      );
    }
  } else {
    sections.push("- 无");
  }

  sections.push("", "### Incident");
  if (view.incidents.length > 0) {
    for (const incident of view.incidents) {
      sections.push(
        `- ${incident.title}｜${incident.incidentType}｜${incident.severityLabel}｜${incident.statusLabel}${incident.detail ? `｜${incident.detail}` : ""}`,
      );
    }
  } else {
    sections.push("- 无");
  }

  sections.push("", "### 最近结果");
  if (view.outcome) {
    sections.push(`- 标签：${view.outcome.label}`);
    sections.push(`- 摘要：${view.outcome.summary}`);
    sections.push(`- 主因：${view.outcome.primaryCause || "未知"}`);
    sections.push(`- 可重试：${view.outcome.retryable ? "是" : "否"}`);
    sections.push(`- 结束时间：${view.outcome.endedAtLabel || "未知"}`);
  } else {
    sections.push("- 无稳定 outcome");
  }

  sections.push("", "### 下一条排队回合");
  if (view.nextQueuedTurn) {
    sections.push(
      `- ${view.nextQueuedTurn.title}${view.nextQueuedTurn.positionLabel ? `｜${view.nextQueuedTurn.positionLabel}` : ""}`,
    );
  } else {
    sections.push("- 无");
  }

  sections.push("", "### 当前建议");
  if (view.recommendations.length > 0) {
    for (const recommendation of view.recommendations) {
      sections.push(`- ${recommendation}`);
    }
  } else {
    sections.push("- 暂无额外建议");
  }

  return sections.join("\n");
}

function buildReliabilityRawPayload(params: {
  threadRead?: AgentRuntimeThreadReadModel | null;
  turns: AgentThreadTurn[];
  threadItems: AgentThreadItem[];
  currentTurnId?: string | null;
  pendingActions: ActionRequired[];
  submittedActionsInFlight: ActionRequired[];
  queuedTurns: QueuedTurnSnapshot[];
  view: ReturnType<typeof buildThreadReliabilityView>;
}): Record<string, unknown> {
  return {
    exported_at: new Date().toISOString(),
    current_turn_id: params.currentTurnId || null,
    thread_read: params.threadRead || null,
    turns: params.turns,
    thread_items: params.threadItems,
    pending_actions: params.pendingActions,
    submitted_actions_in_flight: params.submittedActionsInFlight,
    queued_turns: params.queuedTurns,
    reliability_view: params.view,
  };
}

export const AgentThreadReliabilityPanel: React.FC<
  AgentThreadReliabilityPanelProps
> = ({
  threadRead,
  turns = [],
  threadItems = [],
  currentTurnId = null,
  pendingActions = [],
  submittedActionsInFlight = [],
  queuedTurns = [],
  canInterrupt = false,
  onInterruptCurrentTurn,
  onResumeThread,
  onReplayPendingRequest,
  onLocatePendingRequest,
  onPromoteQueuedTurn,
  className,
}) => {
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [isResumingThread, setIsResumingThread] = useState(false);
  const [isReplayingRequest, setIsReplayingRequest] = useState(false);
  const [isPromotingQueuedTurn, setIsPromotingQueuedTurn] = useState(false);
  const view = useMemo(
    () =>
      buildThreadReliabilityView({
        threadRead,
        turns,
        threadItems,
        currentTurnId,
        pendingActions,
        submittedActionsInFlight,
        queuedTurns,
      }),
    [
      currentTurnId,
      pendingActions,
      queuedTurns,
      submittedActionsInFlight,
      threadItems,
      threadRead,
      turns,
    ],
  );
  const statusLabel = isInterrupting ? "中断中" : view.statusLabel;
  const statusTone = isInterrupting ? "paused" : view.statusTone;
  const summary = isInterrupting
    ? "正在请求停止当前执行，等待运行时确认最新线程状态。"
    : view.summary;

  if (!view.shouldRender) {
    return null;
  }

  const handleInterrupt = async () => {
    if (!onInterruptCurrentTurn || isInterrupting) {
      return;
    }

    setIsInterrupting(true);
    try {
      await onInterruptCurrentTurn();
    } finally {
      setIsInterrupting(false);
    }
  };

  const handleLocatePendingRequest = () => {
    const requestId = view.pendingRequests[0]?.id;
    if (!requestId || !onLocatePendingRequest) {
      return;
    }
    onLocatePendingRequest(requestId);
  };

  const handlePromoteQueuedTurn = async () => {
    const queuedTurnId = view.nextQueuedTurn?.id;
    if (!queuedTurnId || !onPromoteQueuedTurn || isPromotingQueuedTurn) {
      return;
    }

    setIsPromotingQueuedTurn(true);
    try {
      await onPromoteQueuedTurn(queuedTurnId);
    } finally {
      setIsPromotingQueuedTurn(false);
    }
  };

  const handleReplayPendingRequest = async () => {
    const requestId = view.pendingRequests[0]?.id;
    if (!requestId || !onReplayPendingRequest || isReplayingRequest) {
      return;
    }

    setIsReplayingRequest(true);
    try {
      await onReplayPendingRequest(requestId);
    } finally {
      setIsReplayingRequest(false);
    }
  };

  const handleResumeThread = async () => {
    if (!onResumeThread || isResumingThread) {
      return;
    }

    setIsResumingThread(true);
    try {
      await onResumeThread();
    } finally {
      setIsResumingThread(false);
    }
  };

  const handleCopyDiagnostic = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("当前环境不支持剪贴板复制");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildReliabilityDiagnosticText({
          statusLabel,
          summary,
          view,
        }),
      );
      toast.success("AI 诊断内容已复制");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "复制 AI 诊断内容失败",
      );
    }
  };

  const handleCopyRawJson = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("当前环境不支持剪贴板复制");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        serializeClipboardPayload(
          buildReliabilityRawPayload({
            threadRead,
            turns,
            threadItems,
            currentTurnId,
            pendingActions,
            submittedActionsInFlight,
            queuedTurns,
            view,
          }),
        ),
      );
      toast.success("原始 JSON 已复制");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制原始 JSON 失败");
    }
  };

  return (
    <section
      className={cn(
        "mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-950/5",
        className,
      )}
      data-testid="agent-thread-reliability-panel"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium tracking-wide text-muted-foreground">
            线程可靠性
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={resolveToneClassName(statusTone)}
            >
              {statusLabel}
            </Badge>
            {view.activeTurnLabel ? (
              <span className="text-sm font-medium text-foreground">
                {view.activeTurnLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
          {view.updatedAtLabel ? <span>最近刷新 {view.updatedAtLabel}</span> : null}
          {view.interruptStateLabel ? (
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-slate-700"
            >
              {view.interruptStateLabel}
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyDiagnostic()}
            className="h-8 rounded-full"
            data-testid="agent-thread-reliability-copy"
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            复制给 AI
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyRawJson()}
            className="h-8 rounded-full"
            data-testid="agent-thread-reliability-copy-json"
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            复制原始 JSON
          </Button>
        </div>
      </div>
      <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
        “复制给 AI” 会附带诊断任务说明；“复制原始 JSON” 适合程序化分析、存档或二次处理。
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div
          className={cn(
            "rounded-2xl border px-3 py-3",
            resolveStatShellClassName(
              view.pendingRequestCount > 0 ? "waiting" : "neutral",
            ),
          )}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ListTodo className="h-4 w-4" />
            <span>待处理请求</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {view.pendingRequestCount}
          </div>
        </div>

        <div
          className={cn(
            "rounded-2xl border px-3 py-3",
            resolveStatShellClassName(
              view.activeIncidentCount > 0 ? "failed" : "neutral",
            ),
          )}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>活跃 Incident</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {view.activeIncidentCount}
          </div>
        </div>

        <div
          className={cn(
            "rounded-2xl border px-3 py-3",
            resolveStatShellClassName(
              view.queuedTurnCount > 0 ? "waiting" : "neutral",
            ),
          )}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Waves className="h-4 w-4" />
            <span>排队回合</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {view.queuedTurnCount}
          </div>
        </div>
      </div>

      {(canInterrupt && onInterruptCurrentTurn) ||
      (view.pendingRequests.length > 0 && onReplayPendingRequest) ||
      (view.nextQueuedTurn && onResumeThread) ||
      (view.pendingRequests.length > 0 && onLocatePendingRequest) ||
      (view.nextQueuedTurn && onPromoteQueuedTurn) ||
      view.recommendations.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-medium text-foreground">当前操作</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canInterrupt && onInterruptCurrentTurn ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleInterrupt()}
                disabled={
                  isInterrupting ||
                  isResumingThread ||
                  isReplayingRequest ||
                  isPromotingQueuedTurn
                }
                className="border-slate-300 bg-white"
              >
                {isInterrupting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PauseCircle className="mr-2 h-4 w-4" />
                )}
                {isInterrupting ? "正在停止" : "停止当前执行"}
              </Button>
            ) : null}

            {view.pendingRequests.length > 0 && onReplayPendingRequest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleReplayPendingRequest()}
                disabled={
                  isInterrupting ||
                  isResumingThread ||
                  isReplayingRequest ||
                  isPromotingQueuedTurn
                }
                className="border-sky-300 bg-white text-sky-700 hover:bg-sky-50"
              >
                {isReplayingRequest ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {isReplayingRequest ? "拉起中" : "重新拉起请求"}
              </Button>
            ) : null}

            {view.pendingRequests.length > 0 && onLocatePendingRequest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLocatePendingRequest}
                disabled={
                  isInterrupting ||
                  isResumingThread ||
                  isReplayingRequest ||
                  isPromotingQueuedTurn
                }
                className="border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
              >
                <Clock3 className="mr-2 h-4 w-4" />
                前往待处理请求
              </Button>
            ) : null}

            {view.nextQueuedTurn && onResumeThread ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleResumeThread()}
                disabled={
                  isInterrupting ||
                  isResumingThread ||
                  isReplayingRequest ||
                  isPromotingQueuedTurn
                }
                className="border-sky-300 bg-white text-sky-700 hover:bg-sky-50"
              >
                {isResumingThread ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {isResumingThread ? "恢复中" : "恢复执行"}
              </Button>
            ) : null}

            {view.nextQueuedTurn && onPromoteQueuedTurn ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handlePromoteQueuedTurn()}
                disabled={
                  isInterrupting ||
                  isResumingThread ||
                  isReplayingRequest ||
                  isPromotingQueuedTurn
                }
                className="border-sky-300 bg-white text-sky-700 hover:bg-sky-50"
              >
                {isPromotingQueuedTurn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {isPromotingQueuedTurn
                  ? "恢复中"
                  : view.nextQueuedTurn.positionLabel
                    ? `优先执行 ${view.nextQueuedTurn.positionLabel}`
                    : "优先执行排队回合"}
              </Button>
            ) : null}
          </div>

          {view.recommendations.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {view.recommendations.map((recommendation) => (
                <Badge
                  key={recommendation}
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-700"
                >
                  {recommendation}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {view.pendingRequests.length > 0 ? (
        <div
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
          data-testid="agent-thread-reliability-requests"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <Clock3 className="h-4 w-4" />
            <span>当前最需要处理的请求</span>
          </div>
          <div className="mt-3 space-y-2">
            {view.pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-amber-200/80 bg-white px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-foreground">
                    {request.title}
                  </div>
                  <Badge
                    variant="outline"
                    className={resolveToneClassName(request.statusTone)}
                  >
                    {request.typeLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {request.statusLabel}
                  </span>
                </div>
                {request.waitingLabel || request.createdAtLabel ? (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {[request.waitingLabel, request.createdAtLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {view.submittedRequests.length > 0 ? (
        <div
          className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3"
          data-testid="agent-thread-reliability-submitted"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-sky-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>已提交响应，等待线程继续执行</span>
          </div>
          <div className="mt-3 space-y-2">
            {view.submittedRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-sky-200/80 bg-white px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-foreground">
                    {request.title}
                  </div>
                  <Badge
                    variant="outline"
                    className={resolveToneClassName(request.statusTone)}
                  >
                    {request.typeLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {request.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {view.outcome ? (
          <AgentThreadOutcomeSummary outcome={view.outcome} />
        ) : (
          <div
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            data-testid="agent-thread-outcome-empty"
          >
            <div className="text-sm font-medium text-slate-700">最近结果</div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">
              当前尚未沉淀出稳定 outcome，继续以下方时间线为准。
            </div>
          </div>
        )}

        <AgentIncidentPanel incidents={view.incidents} />
      </div>
    </section>
  );
};
