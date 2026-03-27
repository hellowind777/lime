import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceA2UIRuntime } from "./useWorkspaceA2UIRuntime";
import type { Message } from "../types";

type HookProps = Parameters<typeof useWorkspaceA2UIRuntime>[0];

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function createAssistantMessage(id: string, content: string): Message {
  return {
    id,
    role: "assistant",
    content,
    timestamp: new Date("2026-03-27T10:00:00.000Z"),
  };
}

function createUserMessage(id: string, content: string): Message {
  return {
    id,
    role: "user",
    content,
    timestamp: new Date("2026-03-27T10:00:10.000Z"),
  };
}

function renderHook(_initialProps: HookProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestValue: ReturnType<typeof useWorkspaceA2UIRuntime> | null = null;

  function Probe(currentProps: HookProps) {
    latestValue = useWorkspaceA2UIRuntime(currentProps);
    return null;
  }

  const render = async (nextProps: HookProps) => {
    await act(async () => {
      root.render(<Probe {...nextProps} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  mountedRoots.push({ root, container });

  return {
    render,
    getValue: () => {
      if (!latestValue) {
        throw new Error("hook 尚未初始化");
      }
      return latestValue;
    },
  };
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) {
      break;
    }
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.restoreAllMocks();
});

describe("useWorkspaceA2UIRuntime", () => {
  it("内联 A2UI 在消息内容短暂变成不完整 JSON 时应保留最后一份有效表单", async () => {
    const validA2UIMessage = createAssistantMessage(
      "assistant-a2ui",
      [
        "```a2ui",
        '{"type":"form","title":"补充信息","fields":[{"id":"answer","type":"text","label":"你的回答"}],"submitLabel":"继续处理"}',
        "```",
      ].join("\n"),
    );
    const truncatedA2UIMessage = createAssistantMessage(
      "assistant-a2ui",
      ['```a2ui', '{"type":"form","title":"补充信息"'].join("\n"),
    );
    const { render, getValue } = renderHook({
      messages: [validA2UIMessage],
    });

    await render({ messages: [validA2UIMessage] });
    expect(getValue().pendingA2UIForm?.components.length).toBeGreaterThan(0);
    expect(getValue().a2uiSubmissionNotice).toBeNull();

    await render({ messages: [truncatedA2UIMessage] });
    expect(getValue().pendingA2UIForm?.components.length).toBeGreaterThan(0);
    expect(getValue().a2uiSubmissionNotice).toBeNull();
  });

  it("promoted action_required 在 pending 短暂切到 queued 时应继续保留输入区 A2UI", async () => {
    const pendingMessage: Message = {
      id: "assistant-action",
      role: "assistant",
      content: "请补充执行偏好。",
      timestamp: new Date("2026-03-27T10:01:00.000Z"),
      actionRequests: [
        {
          requestId: "req-a2ui-1",
          actionType: "ask_user",
          prompt: "请选择执行模式",
          questions: [
            {
              question: "你希望如何执行？",
              header: "执行模式",
              options: [{ label: "自动执行" }, { label: "手动确认" }],
            },
          ],
          status: "pending",
        },
      ],
    };
    const queuedMessage: Message = {
      ...pendingMessage,
      actionRequests: [
        {
          ...pendingMessage.actionRequests![0],
          status: "queued",
        },
      ],
    };
    const { render, getValue } = renderHook({
      messages: [pendingMessage],
    });

    await render({ messages: [pendingMessage] });
    expect(getValue().pendingA2UIForm?.id).toBe(
      "action-request-req-a2ui-1",
    );

    await render({ messages: [queuedMessage] });
    expect(getValue().pendingA2UIForm?.id).toBe(
      "action-request-req-a2ui-1",
    );
    expect(getValue().a2uiSubmissionNotice).toBeNull();
  });

  it("线程已切走且源消息消失时，应清理保留中的旧 A2UI", async () => {
    const validA2UIMessage = createAssistantMessage(
      "assistant-old",
      [
        "```a2ui",
        '{"type":"form","title":"补充信息","fields":[{"id":"answer","type":"text","label":"你的回答"}],"submitLabel":"继续处理"}',
        "```",
      ].join("\n"),
    );
    const { render, getValue } = renderHook({
      messages: [validA2UIMessage],
    });

    await render({ messages: [validA2UIMessage] });
    expect(getValue().pendingA2UIForm?.components.length).toBeGreaterThan(0);

    await render({
      messages: [createUserMessage("user-new-thread", "这是新的会话内容")],
    });
    expect(getValue().pendingA2UIForm).toBeNull();
    expect(getValue().a2uiSubmissionNotice).toBeNull();
  });
});
