import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentThreadReliabilityPanel } from "./AgentThreadReliabilityPanel";
import type { ActionRequired, AgentThreadItem, AgentThreadTurn } from "../types";
import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime";

const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

interface MountedHarness {
  container: HTMLDivElement;
  root: Root;
}

const mountedRoots: MountedHarness[] = [];
let originalClipboard: Clipboard | undefined;

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  originalClipboard = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
  vi.clearAllMocks();
});

function renderPanel(props?: {
  threadRead?: AgentRuntimeThreadReadModel | null;
  turns?: AgentThreadTurn[];
  threadItems?: AgentThreadItem[];
  pendingActions?: ActionRequired[];
  submittedActionsInFlight?: ActionRequired[];
  currentTurnId?: string | null;
  canInterrupt?: boolean;
  onInterruptCurrentTurn?: () => void | Promise<void>;
  onResumeThread?: () => void | Promise<boolean>;
  onReplayPendingRequest?: (requestId: string) => void | Promise<boolean>;
  onLocatePendingRequest?: (requestId: string) => void;
  onPromoteQueuedTurn?: (queuedTurnId: string) => void | Promise<boolean>;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AgentThreadReliabilityPanel
        threadRead={props?.threadRead}
        turns={props?.turns}
        threadItems={props?.threadItems}
        pendingActions={props?.pendingActions}
        submittedActionsInFlight={props?.submittedActionsInFlight}
        currentTurnId={props?.currentTurnId}
        canInterrupt={props?.canInterrupt}
        onInterruptCurrentTurn={props?.onInterruptCurrentTurn}
        onResumeThread={props?.onResumeThread}
        onReplayPendingRequest={props?.onReplayPendingRequest}
        onLocatePendingRequest={props?.onLocatePendingRequest}
        onPromoteQueuedTurn={props?.onPromoteQueuedTurn}
      />,
    );
  });

  mountedRoots.push({ container, root });
  return container;
}

describe("AgentThreadReliabilityPanel", () => {
  it("应优先展示 thread_read 中的 outcome 与 incident", () => {
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "running",
        active_turn_id: "turn-1",
        pending_requests: [
          {
            id: "req-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            request_type: "tool_confirmation",
            status: "pending",
            title: "确认是否执行 browser_click",
            created_at: "2026-03-23T09:00:00Z",
          },
        ],
        last_outcome: {
          thread_id: "thread-1",
          turn_id: "turn-0",
          outcome_type: "failed_provider",
          summary: "最近一次 provider 请求失败",
          primary_cause: "429 rate limited",
          retryable: true,
          ended_at: "2026-03-23T08:58:00Z",
        },
        incidents: [
          {
            id: "incident-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            incident_type: "approval_timeout",
            severity: "high",
            status: "active",
            title: "审批等待超过阈值",
            details: "当前线程等待工具确认时间过长",
          },
        ],
      },
      turns: [
        {
          id: "turn-1",
          thread_id: "thread-1",
          prompt_text: "发布文章到公众号",
          status: "running",
          started_at: "2026-03-23T09:00:00Z",
          created_at: "2026-03-23T09:00:00Z",
          updated_at: "2026-03-23T09:00:10Z",
        },
      ],
      currentTurnId: "turn-1",
    });

    expect(
      container.querySelector('[data-testid="agent-thread-reliability-panel"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("线程可靠性");
    expect(container.textContent).toContain("待处理请求");
    expect(container.textContent).toContain("Provider 失败");
    expect(container.textContent).toContain("审批等待超过阈值");
    expect(container.textContent).toContain("审批等待过久，建议尽快处理或停止当前执行");
  });

  it("缺少 thread_read 时，应从当前 turn 与 pendingActions 推导并支持中断", async () => {
    const onInterruptCurrentTurn = vi.fn().mockResolvedValue(undefined);
    const container = renderPanel({
      turns: [
        {
          id: "turn-2",
          thread_id: "thread-1",
          prompt_text: "继续检查发布结果",
          status: "running",
          started_at: "2026-03-23T09:00:00Z",
          created_at: "2026-03-23T09:00:00Z",
          updated_at: "2026-03-23T09:00:12Z",
        },
      ],
      threadItems: [
        {
          id: "item-1",
          thread_id: "thread-1",
          turn_id: "turn-2",
          sequence: 1,
          status: "in_progress",
          started_at: "2026-03-23T09:00:01Z",
          updated_at: "2026-03-23T09:00:05Z",
          type: "turn_summary",
          text: "正在等待用户确认是否继续执行",
        },
      ],
      pendingActions: [
        {
          requestId: "req-local-1",
          actionType: "ask_user",
          prompt: "请确认是否继续发布",
          status: "pending",
        },
      ],
      currentTurnId: "turn-2",
      canInterrupt: true,
      onInterruptCurrentTurn,
    });

    expect(container.textContent).toContain("等待人工处理");
    expect(container.textContent).toContain("请确认是否继续发布");

    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("停止当前执行"),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onInterruptCurrentTurn).toHaveBeenCalledTimes(1);
  });

  it("中断进行中时，面板应展示中断中的瞬时状态", async () => {
    let resolveInterrupt: (() => void) | null = null;
    const onInterruptCurrentTurn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInterrupt = resolve;
        }),
    );
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "running",
        active_turn_id: "turn-1",
        pending_requests: [],
        incidents: [],
      },
      turns: [
        {
          id: "turn-1",
          thread_id: "thread-1",
          prompt_text: "继续整理发布说明",
          status: "running",
          started_at: "2026-03-23T09:00:00Z",
          created_at: "2026-03-23T09:00:00Z",
          updated_at: "2026-03-23T09:00:05Z",
        },
      ],
      currentTurnId: "turn-1",
      canInterrupt: true,
      onInterruptCurrentTurn,
    });

    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("停止当前执行"),
    );
    expect(button).toBeDefined();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("中断中");
    expect(container.textContent).toContain("正在请求停止当前执行");
    expect(container.textContent).toContain("正在停止");

    await act(async () => {
      resolveInterrupt?.();
      await Promise.resolve();
    });
  });

  it("应展示最近刷新时间、运行时中断态，并支持跳转待处理请求与恢复排队回合", async () => {
    const onLocatePendingRequest = vi.fn();
    const onResumeThread = vi.fn().mockResolvedValue(true);
    const onPromoteQueuedTurn = vi.fn().mockResolvedValue(true);
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "aborted",
        active_turn_id: "turn-1",
        pending_requests: [
          {
            id: "req-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            request_type: "ask_user",
            status: "pending",
            title: "请确认是否继续发布",
            created_at: "2026-03-23T09:00:00Z",
          },
        ],
        queued_turns: [
          {
            queued_turn_id: "queued-1",
            message_preview: "继续执行排队任务",
            message_text: "继续执行排队任务正文",
            created_at: 1711184400,
            image_count: 0,
            position: 1,
          },
        ],
        interrupt_state: "interrupted",
        updated_at: "2026-03-23T09:00:20Z",
        incidents: [],
      },
      onResumeThread,
      onLocatePendingRequest,
      onPromoteQueuedTurn,
    });

    expect(container.textContent).toContain("最近刷新");
    expect(container.textContent).toContain("运行时已确认中断");
    expect(container.textContent).toContain("前往待处理请求");
    expect(container.textContent).toContain("恢复执行");
    expect(container.textContent).toContain("优先执行 队列第 1 位");

    const buttons = Array.from(container.querySelectorAll("button"));
    const locateButton = buttons.find((node) =>
      node.textContent?.includes("前往待处理请求"),
    );
    const resumeButton = buttons.find((node) =>
      node.textContent?.includes("恢复执行"),
    );
    const promoteButton = buttons.find((node) =>
      node.textContent?.includes("优先执行 队列第 1 位"),
    );

    act(() => {
      locateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onLocatePendingRequest).toHaveBeenCalledWith("req-1");

    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(onResumeThread).toHaveBeenCalledTimes(1);

    await act(async () => {
      promoteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(onPromoteQueuedTurn).toHaveBeenCalledWith("queued-1");
  });

  it("请求已提交待回填时，应压住旧 pending 并展示继续处理中", () => {
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "waiting_request",
        active_turn_id: "turn-1",
        pending_requests: [
          {
            id: "req-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            request_type: "ask_user",
            status: "pending",
            title: "请确认是否继续发布",
            created_at: "2026-03-23T09:00:00Z",
          },
        ],
        incidents: [
          {
            id: "incident-req-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            incident_type: "waiting_user_input",
            severity: "medium",
            status: "active",
            title: "线程正在等待人工处理",
          },
        ],
      },
      submittedActionsInFlight: [
        {
          requestId: "req-1",
          actionType: "ask_user",
          prompt: "请确认是否继续发布",
          status: "submitted",
          submittedResponse: '{"answer":"继续"}',
          submittedUserData: { answer: "继续" },
        },
      ],
      turns: [
        {
          id: "turn-1",
          thread_id: "thread-1",
          prompt_text: "继续发布",
          status: "running",
          started_at: "2026-03-23T09:00:00Z",
          created_at: "2026-03-23T09:00:00Z",
          updated_at: "2026-03-23T09:00:10Z",
        },
      ],
      currentTurnId: "turn-1",
    });

    expect(container.textContent).toContain("处理中");
    expect(container.textContent).toContain("已提交响应，等待线程继续执行");
    expect(container.textContent).toContain("已提交响应：请确认是否继续发布");
    expect(container.textContent).not.toContain("当前最需要处理的请求");
  });

  it("运行回合卡住时，应展示主动恢复建议", () => {
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "running",
        active_turn_id: "turn-stuck",
        pending_requests: [],
        incidents: [
          {
            id: "incident-stuck",
            thread_id: "thread-1",
            turn_id: "turn-stuck",
            incident_type: "turn_stuck",
            severity: "high",
            status: "active",
            title: "当前回合长时间无进展",
            details: "最近 3 分钟内没有新的线程更新，可尝试停止后恢复执行。",
          },
        ],
      },
      turns: [
        {
          id: "turn-stuck",
          thread_id: "thread-1",
          prompt_text: "继续回填发布摘要",
          status: "running",
          started_at: "2026-03-23T09:55:00Z",
          created_at: "2026-03-23T09:55:00Z",
          updated_at: "2026-03-23T09:56:00Z",
        },
      ],
      currentTurnId: "turn-stuck",
      canInterrupt: true,
      onInterruptCurrentTurn: vi.fn().mockResolvedValue(undefined),
    });

    expect(container.textContent).toContain("当前回合长时间无进展");
    expect(container.textContent).toContain("当前回合长时间无进展，建议停止后恢复执行");
  });

  it("存在待处理请求时应支持重新拉起请求", async () => {
    const onReplayPendingRequest = vi.fn().mockResolvedValue(true);
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "waiting_request",
        pending_requests: [
          {
            id: "req-replay-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            request_type: "ask_user",
            status: "pending",
            title: "请重新确认执行模式",
            created_at: "2026-03-23T09:00:00Z",
          },
        ],
        incidents: [],
      },
      onReplayPendingRequest,
    });

    const replayButton = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent?.includes("重新拉起请求"),
    );
    expect(replayButton).toBeDefined();

    await act(async () => {
      replayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onReplayPendingRequest).toHaveBeenCalledWith("req-replay-1");
  });

  it("应支持复制给 AI 的可靠性诊断包", async () => {
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-1",
        status: "aborted",
        active_turn_id: "turn-1",
        pending_requests: [],
        last_outcome: {
          thread_id: "thread-1",
          turn_id: "turn-1",
          outcome_type: "failed_tool",
          summary: "工具执行中断",
          primary_cause: "浏览器页面已关闭",
          retryable: true,
          ended_at: "2026-03-23T10:02:00Z",
        },
        incidents: [
          {
            id: "incident-1",
            thread_id: "thread-1",
            turn_id: "turn-1",
            incident_type: "tool_failed",
            severity: "high",
            status: "active",
            title: "浏览器工具执行失败",
            details: "页面上下文已销毁",
          },
        ],
        updated_at: "2026-03-23T10:03:00Z",
      },
      turns: [
        {
          id: "turn-1",
          thread_id: "thread-1",
          prompt_text: "继续发布公众号文章",
          status: "aborted",
          started_at: "2026-03-23T10:00:00Z",
          created_at: "2026-03-23T10:00:00Z",
          updated_at: "2026-03-23T10:03:00Z",
        },
      ],
      currentTurnId: "turn-1",
    });

    const copyButton = container.querySelector(
      '[data-testid="agent-thread-reliability-copy"]',
    );
    expect(copyButton).not.toBeNull();

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("# Lime 线程可靠性诊断任务"),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("请按以下结构输出："),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("### Incident"),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("浏览器工具执行失败"),
    );
    expect(mockToast.success).toHaveBeenCalledWith("AI 诊断内容已复制");
    expect(container.textContent).toContain("复制给 AI");
    expect(container.textContent).toContain("复制原始 JSON");
    expect(container.textContent).toContain("会附带诊断任务说明");
  });

  it("应支持复制原始 JSON 诊断数据", async () => {
    const container = renderPanel({
      threadRead: {
        thread_id: "thread-json-1",
        status: "waiting_request",
        active_turn_id: "turn-json-1",
        pending_requests: [
          {
            id: "req-json-1",
            thread_id: "thread-json-1",
            turn_id: "turn-json-1",
            request_type: "ask_user",
            status: "pending",
            title: "请确认是否继续执行",
            created_at: "2026-03-23T10:00:00Z",
          },
        ],
        incidents: [],
      },
      turns: [
        {
          id: "turn-json-1",
          thread_id: "thread-json-1",
          prompt_text: "继续执行 JSON 校验任务",
          status: "waiting_request",
          started_at: "2026-03-23T10:00:00Z",
          created_at: "2026-03-23T10:00:00Z",
          updated_at: "2026-03-23T10:01:00Z",
        },
      ],
      currentTurnId: "turn-json-1",
      pendingActions: [
        {
          requestId: "req-json-1",
          actionType: "ask_user",
          prompt: "请确认是否继续执行",
          status: "pending",
        },
      ],
    });

    const jsonButton = container.querySelector(
      '[data-testid="agent-thread-reliability-copy-json"]',
    );
    expect(jsonButton).not.toBeNull();

    await act(async () => {
      jsonButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"thread_read"'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"reliability_view"'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"pending_actions"'),
    );
    expect(mockToast.success).toHaveBeenCalledWith("原始 JSON 已复制");
  });
});
