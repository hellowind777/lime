import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentChatHomeShell } from "./AgentChatHomeShell";

const { mockBuildClawAgentParams, mockSaveChatToolPreferences } = vi.hoisted(() => ({
  mockBuildClawAgentParams: vi.fn((overrides?: Record<string, unknown>) => ({
    agentEntry: "claw",
    ...(overrides || {}),
  })),
  mockSaveChatToolPreferences: vi.fn(),
}));

vi.mock("./components/EmptyState", () => ({
  EmptyState: ({
    onSend,
    onRecommendationClick,
  }: {
    onSend: (
      value: string,
      executionStrategy?: unknown,
      images?: Array<{ data: string; mediaType: string }>,
    ) => void;
    onRecommendationClick?: (shortLabel: string, fullPrompt: string) => void;
  }) => (
    <>
      <button
        type="button"
        data-testid="home-shell-send"
        onClick={() => onSend("整理成 notebook 工作方式", undefined, [])}
      >
        发送
      </button>
      <button
        type="button"
        data-testid="home-shell-team-recommendation"
        onClick={() =>
          onRecommendationClick?.(
            "Team 冒烟测试",
            "请按 team runtime 方式做一次冒烟测试：主线程先拆成两个子任务，再创建 explorer 与 executor 两个子代理并行处理；至少等待一个子代理完成，必要时继续 send_input，最后回到主线程输出 team workspace 总结。",
          )
        }
      >
        Team 推荐
      </button>
    </>
  ),
}));

vi.mock("@/lib/api/memory", () => ({
  getProjectMemory: vi.fn(async () => ({
    characters: [],
  })),
}));

vi.mock("@/lib/api/skills", () => ({
  skillsApi: {
    getLocal: vi.fn(async () => []),
    getAll: vi.fn(async () => []),
  },
}));

vi.mock("./hooks/agentChatStorage", () => ({
  DEFAULT_AGENT_MODEL: "mock-model",
  DEFAULT_AGENT_PROVIDER: "mock-provider",
  GLOBAL_MODEL_PREF_KEY: "global-model",
  GLOBAL_PROVIDER_PREF_KEY: "global-provider",
  getAgentPreferenceKeys: vi.fn(() => ({
    providerKey: "provider-key",
    modelKey: "model-key",
  })),
  loadPersisted: vi.fn((_key: string, fallback: unknown) => fallback),
  loadPersistedString: vi.fn(() => ""),
  savePersisted: vi.fn(),
}));

vi.mock("./hooks/agentChatCoreUtils", () => ({
  normalizeExecutionStrategy: vi.fn((value: string) => value || "react"),
}));

vi.mock("./utils/chatToolPreferences", () => ({
  loadChatToolPreferences: vi.fn(() => ({
    webSearch: false,
    thinking: false,
    task: false,
    subagent: false,
  })),
  saveChatToolPreferences: mockSaveChatToolPreferences,
}));

vi.mock("@/lib/workspace/navigation", () => ({
  buildClawAgentParams: mockBuildClawAgentParams,
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

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
  vi.clearAllMocks();
});

function renderShell(
  props: Partial<React.ComponentProps<typeof AgentChatHomeShell>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof AgentChatHomeShell> = {
    onNavigate: vi.fn(),
    projectId: "project-1",
    theme: "general",
    lockTheme: false,
    onEnterWorkspace: vi.fn(),
  };

  act(() => {
    root.render(<AgentChatHomeShell {...defaultProps} {...props} />);
  });

  mountedRoots.push({ root, container });
  return {
    container,
    props: {
      ...defaultProps,
      ...props,
    },
  };
}

async function flushEffects(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("AgentChatHomeShell", () => {
  it("发送首条消息时应直接导航到 claw 工作区", async () => {
    const onNavigate = vi.fn();
    const onEnterWorkspace = vi.fn();
    const { container } = renderShell({
      onNavigate,
      onEnterWorkspace,
    });

    await flushEffects();

    const sendButton = container.querySelector(
      '[data-testid="home-shell-send"]',
    ) as HTMLButtonElement | null;

    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    await flushEffects();

    expect(mockBuildClawAgentParams).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        theme: "general",
        initialCreationMode: "guided",
        initialUserPrompt: "整理成 notebook 工作方式",
        initialUserImages: [],
        openBrowserAssistOnMount: undefined,
        newChatAt: expect.any(Number),
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        agentEntry: "claw",
        projectId: "project-1",
        initialUserPrompt: "整理成 notebook 工作方式",
        newChatAt: expect.any(Number),
      }),
    );
    expect(onEnterWorkspace).not.toHaveBeenCalled();
  });

  it("点击 team 推荐时应开启多代理偏好并直接进入工作区", async () => {
    const onEnterWorkspace = vi.fn();
    const { container } = renderShell({
      onNavigate: undefined,
      onEnterWorkspace,
    });

    await flushEffects();

    const teamRecommendationButton = container.querySelector(
      '[data-testid="home-shell-team-recommendation"]',
    ) as HTMLButtonElement | null;

    expect(teamRecommendationButton).toBeTruthy();

    act(() => {
      teamRecommendationButton?.click();
    });

    await flushEffects();

    expect(mockSaveChatToolPreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({
        webSearch: false,
        thinking: false,
        task: false,
        subagent: true,
      }),
      "general",
    );
    expect(onEnterWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        theme: "general",
        initialCreationMode: "guided",
        initialUserPrompt:
          "请按 team runtime 方式做一次冒烟测试：主线程先拆成两个子任务，再创建 explorer 与 executor 两个子代理并行处理；至少等待一个子代理完成，必要时继续 send_input，最后回到主线程输出 team workspace 总结。",
        newChatAt: expect.any(Number),
      }),
    );
  });
});
