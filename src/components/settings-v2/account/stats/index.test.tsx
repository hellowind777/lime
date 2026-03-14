import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUsageStats,
  mockGetModelUsageRanking,
  mockGetDailyUsageTrends,
} = vi.hoisted(() => ({
  mockGetUsageStats: vi.fn(),
  mockGetModelUsageRanking: vi.fn(),
  mockGetDailyUsageTrends: vi.fn(),
}));

vi.mock("@/lib/api/usageStats", () => ({
  getUsageStats: mockGetUsageStats,
  getModelUsageRanking: mockGetModelUsageRanking,
  getDailyUsageTrends: mockGetDailyUsageTrends,
}));

import { StatsSettings } from ".";

interface Mounted {
  container: HTMLDivElement;
  root: Root;
}

const mounted: Mounted[] = [];

function renderComponent(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StatsSettings />);
  });

  mounted.push({ container, root });
  return container;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForLoad() {
  await flushEffects();
  await flushEffects();
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushEffects();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  vi.clearAllMocks();

  mockGetUsageStats.mockResolvedValue({
    total_conversations: 240,
    total_messages: 1240,
    total_tokens: 120000,
    total_time_minutes: 900,
    monthly_conversations: 84,
    monthly_messages: 420,
    monthly_tokens: 28000,
    today_conversations: 8,
    today_messages: 42,
    today_tokens: 2600,
  });

  mockGetModelUsageRanking.mockResolvedValue([
    {
      model: "gpt-4.1",
      conversations: 40,
      tokens: 18000,
      percentage: 52,
    },
    {
      model: "claude-sonnet-4",
      conversations: 24,
      tokens: 9000,
      percentage: 26,
    },
  ]);

  mockGetDailyUsageTrends.mockResolvedValue([
    {
      date: "2026-03-01",
      conversations: 4,
      tokens: 1200,
    },
    {
      date: "2026-03-02",
      conversations: 0,
      tokens: 0,
    },
    {
      date: "2026-03-03",
      conversations: 7,
      tokens: 2600,
    },
  ]);
});

afterEach(() => {
  while (mounted.length > 0) {
    const target = mounted.pop();
    if (!target) {
      break;
    }

    act(() => {
      target.root.unmount();
    });
    target.container.remove();
  }

  vi.clearAllMocks();
});

describe("StatsSettings", () => {
  it("应渲染新的统计总览与分析面板", async () => {
    const container = renderComponent();
    await waitForLoad();

    const text = container.textContent ?? "";
    expect(text).toContain("USAGE SNAPSHOT");
    expect(text).toContain("阶段概览");
    expect(text).toContain("模型使用排行");
    expect(text).toContain("当前观察");
    expect(text).toContain("每日使用趋势");
    expect(text).toContain("活跃度日历");
    expect(text).toContain("gpt-4.1");
  });

  it("切换时间范围后应重新拉取对应统计", async () => {
    const container = renderComponent();
    await waitForLoad();

    const weekButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("本周"),
    );

    if (!weekButton) {
      throw new Error("未找到本周按钮");
    }

    await clickButton(weekButton);
    await waitForLoad();

    expect(mockGetUsageStats).toHaveBeenLastCalledWith("week");
    expect(mockGetModelUsageRanking).toHaveBeenLastCalledWith("week");
    expect(mockGetDailyUsageTrends).toHaveBeenLastCalledWith("week");
  });
});
