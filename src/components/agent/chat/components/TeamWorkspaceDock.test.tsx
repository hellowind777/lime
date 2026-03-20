import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AsterSessionDetail } from "@/lib/api/agentRuntime";
import { TeamWorkspaceDock } from "./TeamWorkspaceDock";

const { mockGetAgentRuntimeSession } = vi.hoisted(() => ({
  mockGetAgentRuntimeSession: vi.fn(),
}));
const {
  mockSafeListen,
  mockParseStreamEvent,
} = vi.hoisted(() => ({
  mockSafeListen: vi.fn(),
  mockParseStreamEvent: vi.fn((payload: unknown) => payload),
}));

vi.mock("@/lib/api/agentRuntime", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/agentRuntime")>(
      "@/lib/api/agentRuntime",
    );
  return {
    ...actual,
    getAgentRuntimeSession: mockGetAgentRuntimeSession,
  };
});

vi.mock("@/lib/api/agentStream", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/agentStream")>(
      "@/lib/api/agentStream",
    );
  return {
    ...actual,
    parseStreamEvent: mockParseStreamEvent,
  };
});

vi.mock("@/lib/dev-bridge", () => ({
  safeListen: mockSafeListen,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className,
    onClick,
    type = "button",
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockGetAgentRuntimeSession.mockImplementation(async (sessionId: string) =>
    createSessionDetail(sessionId),
  );
  mockSafeListen.mockResolvedValue(() => {});
  mockParseStreamEvent.mockImplementation((payload: unknown) => payload);
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
  vi.clearAllMocks();
});

function createSessionDetail(
  sessionId: string,
  overrides: Partial<AsterSessionDetail> = {},
): AsterSessionDetail {
  return {
    id: sessionId,
    created_at: 1_710_000_000,
    updated_at: 1_710_000_100,
    messages: [],
    items: [],
    ...overrides,
  };
}

async function flushDockEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderDock(
  props?: Partial<React.ComponentProps<typeof TeamWorkspaceDock>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof TeamWorkspaceDock> = {
    shellVisible: true,
    currentSessionId: "parent-1",
    currentSessionName: "主线程",
    childSubagentSessions: [],
  };

  const render = async (
    nextProps?: Partial<React.ComponentProps<typeof TeamWorkspaceDock>>,
  ) => {
    await act(async () => {
      root.render(<TeamWorkspaceDock {...defaultProps} {...props} {...nextProps} />);
      await Promise.resolve();
    });
    await flushDockEffects();
  };

  await render();
  mountedRoots.push({ root, container });
  return { container, render };
}

describe("TeamWorkspaceDock", () => {
  it("空 team shell 点击外层浮钮后，应直接展开详情面板", async () => {
    const { container } = await renderDock({
      selectedTeamLabel: "前端联调团队",
      selectedTeamSummary: "分析、实现、验证三段式推进。",
      selectedTeamRoles: [
        {
          id: "explorer",
          label: "分析",
          summary: "负责定位问题与影响范围。",
        },
      ],
    });

    expect(container.textContent).toContain("Team");

    const toggleButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="team-workspace-dock-toggle"]',
    );
    expect(toggleButton).toBeTruthy();

    act(() => {
      toggleButton?.click();
    });

    expect(document.body.textContent).toContain("等待真实子代理");
    expect(document.body.textContent).toContain("spawn_agent");
    expect(document.body.textContent).toContain("不遮挡画布");
    expect(document.body.textContent).toContain("当前 Team：前端联调团队");
    expect(document.body.textContent).toContain("分析、实现、验证三段式推进。");
    expect(document.body.textContent).not.toContain("查看详情");
    expect(document.body.querySelector('[data-testid="team-workspace-empty-card"]')).toBeTruthy();
    expect(
      document.body.querySelector('[data-testid="team-workspace-selected-team"]'),
    ).toBeTruthy();
  });

  it("空态工作台应支持展开当前 Team 的详情", async () => {
    const { container } = await renderDock({
      selectedTeamLabel: "前端联调团队",
      selectedTeamSummary: "分析、实现、验证三段式推进。",
      selectedTeamRoles: [
        {
          id: "explorer",
          label: "分析",
          summary: "负责定位问题与影响范围。",
        },
        {
          id: "executor",
          label: "执行",
          summary: "负责落地改动与结果说明。",
        },
      ],
    });

    const toggleButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="team-workspace-dock-toggle"]',
    );
    expect(toggleButton).toBeTruthy();

    act(() => {
      toggleButton?.click();
    });

    const detailToggle = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="team-workspace-selected-team-toggle"]',
    );
    expect(detailToggle).toBeTruthy();

    act(() => {
      detailToggle?.click();
    });

    expect(
      document.body.querySelector(
        '[data-testid="team-workspace-selected-team-detail"]',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("负责定位问题与影响范围");
    expect(document.body.textContent).toContain("负责落地改动与结果说明");
  });

  it("真实子代理从空态出现时，应自动展开 team 面板", async () => {
    const { container, render } = await renderDock();

    expect(
      container.querySelector('[data-testid="team-workspace-dock-panel"]'),
    ).toBeNull();

    await render({
      childSubagentSessions: [
        {
          id: "child-1",
          name: "研究员",
          created_at: 1_710_000_000,
          updated_at: 1_710_000_100,
          session_type: "sub_agent",
          runtime_status: "running",
          task_summary: "整理竞品与数据来源",
          role_hint: "explorer",
        },
      ],
    });

    expect(
      document.body.querySelector('[data-testid="team-workspace-dock-panel"]'),
    ).toBeTruthy();
    expect(container.textContent).toContain("收起 Team");
    expect(document.body.textContent).toContain("研究员");
  });

  it("真实 team 图谱折叠时，应显示查看入口和动态提示", async () => {
    const { container } = await renderDock({
      childSubagentSessions: [
        {
          id: "child-1",
          name: "研究员",
          created_at: 1_710_000_000,
          updated_at: 1_710_000_100,
          session_type: "sub_agent",
          runtime_status: "running",
          task_summary: "整理竞品与数据来源",
          role_hint: "explorer",
        },
      ],
    });

    const toggleButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="team-workspace-dock-toggle"]',
    );

    expect(toggleButton?.textContent).toContain("查看 Team · 1");
    expect(
      container.querySelector('[data-testid="team-workspace-dock-signal"]'),
    ).toBeTruthy();
    expect(
      getComputedStyle(
        container.querySelector(
          '[data-testid="team-workspace-dock"]',
        ) as HTMLElement,
      ).zIndex,
    ).toBe("18");
  });

  it("inline 模式应作为输入区并排控件渲染，展开面板向上浮出而不占位", async () => {
    const { container, render } = await renderDock({
      placement: "inline",
    });

    await render({
      placement: "inline",
      childSubagentSessions: [
        {
          id: "child-1",
          name: "研究员",
          created_at: 1_710_000_000,
          updated_at: 1_710_000_100,
          session_type: "sub_agent",
          runtime_status: "running",
          task_summary: "整理竞品与数据来源",
          role_hint: "explorer",
        },
      ],
    });

    const dock = container.querySelector<HTMLElement>(
      '[data-testid="team-workspace-dock"]',
    );
    const panelInContainer = container.querySelector<HTMLElement>(
      '[data-testid="team-workspace-dock-panel"]',
    );
    const panelInBody = document.body.querySelector<HTMLElement>(
      '[data-testid="team-workspace-dock-panel"]',
    );

    expect(dock).toBeTruthy();
    expect(panelInContainer).toBeNull();
    expect(panelInBody).toBeTruthy();
    expect(getComputedStyle(dock as HTMLElement).position).toBe("relative");
    expect(getComputedStyle(dock as HTMLElement).zIndex).toBe("120");
    expect(getComputedStyle(panelInBody as HTMLElement).position).toBe("fixed");
    expect(getComputedStyle(panelInBody as HTMLElement).zIndex).toBe("10010");
  });
});
