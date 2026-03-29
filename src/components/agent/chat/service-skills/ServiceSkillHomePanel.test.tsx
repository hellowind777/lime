import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceSkillHomePanel } from "./ServiceSkillHomePanel";
import type { ServiceSkillGroup, ServiceSkillHomeItem } from "./types";

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
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

function renderPanel(
  props: React.ComponentProps<typeof ServiceSkillHomePanel>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ServiceSkillHomePanel {...props} />);
  });

  mountedRoots.push({ root, container });
  return container;
}

function buildGroups(): ServiceSkillGroup[] {
  return [
    {
      key: "github",
      title: "GitHub",
      summary: "围绕仓库与 Issue 的只读研究技能。",
      entryHint: "先选 GitHub 技能，再补关键词或仓库名。",
      sort: 10,
      itemCount: 1,
    },
    {
      key: "general",
      title: "通用技能",
      summary: "不依赖站点登录态的业务技能。",
      entryHint: "不依赖浏览器时直接走通用技能。",
      sort: 90,
      itemCount: 1,
    },
  ];
}

function buildSkills(): ServiceSkillHomeItem[] {
  return [
    {
      id: "github-repo-radar",
      title: "GitHub 仓库雷达",
      summary: "根据关键词快速扫描仓库和讨论线索。",
      category: "GitHub",
      outputHint: "仓库列表 + 关键线索",
      source: "cloud_catalog",
      runnerType: "instant",
      defaultExecutorBinding: "browser_assist",
      executionLocation: "client_default",
      slotSchema: [],
      version: "tenant-v1",
      badge: "云目录",
      recentUsedAt: null,
      isRecent: false,
      runnerLabel: "浏览器协助",
      runnerTone: "sky",
      runnerDescription: "进入真实浏览器执行只读采集。",
      actionLabel: "填写参数",
      automationStatus: {
        jobId: "automation-job-1",
        jobName: "GitHub 仓库雷达",
        statusLabel: "成功",
        tone: "emerald",
        detail: "最近一次执行成功",
      },
      groupKey: "github",
      executionKind: "site_adapter",
    },
    {
      id: "daily-trend-briefing",
      title: "每日趋势简报",
      summary: "围绕主题生成一份可继续加工的趋势简报。",
      category: "研究规划",
      outputHint: "简报摘要 + 延展方向",
      source: "cloud_catalog",
      runnerType: "instant",
      defaultExecutorBinding: "agent_turn",
      executionLocation: "client_default",
      slotSchema: [],
      version: "tenant-v1",
      badge: "云目录",
      recentUsedAt: null,
      isRecent: false,
      runnerLabel: "本地即时执行",
      runnerTone: "emerald",
      runnerDescription: "进入 Claw 工作区继续整理。",
      actionLabel: "开始工作",
      automationStatus: null,
      groupKey: "general",
      executionKind: "agent_turn",
    },
    {
      id: "local-growth-playbook",
      title: "本地增长打法模版",
      summary: "项目级离线补充技能。",
      category: "本地打法",
      outputHint: "增长打法草案",
      source: "local_custom",
      runnerType: "managed",
      defaultExecutorBinding: "automation_job",
      executionLocation: "client_default",
      slotSchema: [],
      version: "local-v1",
      badge: "本地技能",
      recentUsedAt: null,
      isRecent: false,
      runnerLabel: "本地持续跟踪",
      runnerTone: "amber",
      runnerDescription: "可直接创建本地持续跟踪任务。",
      actionLabel: "创建跟踪",
      automationStatus: null,
      groupKey: "general",
      executionKind: "automation_job",
    },
  ];
}

describe("ServiceSkillHomePanel", () => {
  it("应先展示技能组，再进入技能项并透传选择回调", () => {
    const skills = buildSkills();
    const onSelect = vi.fn();
    const onOpenAutomationJob = vi.fn();

    const container = renderPanel({
      skills,
      groups: buildGroups(),
      catalogMeta: {
        tenantId: "tenant-demo",
        version: "tenant-2026-03-29",
        syncedAt: "2026-03-29T12:00:00.000Z",
        itemCount: 2,
        groupCount: 2,
        sourceLabel: "租户技能目录",
        isSeeded: false,
      },
      onSelect,
      onOpenAutomationJob,
    });

    expect(container.textContent).toContain("技能组");
    expect(container.textContent).toContain("租户技能目录");
    expect(container.textContent).toContain("分组 2");
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).toContain("通用技能");
    expect(container.textContent).toContain("本地技能 / 自定义技能");

    const groupButton = container.querySelector(
      '[data-testid="service-skill-group-github"]',
    ) as HTMLButtonElement | null;

    expect(groupButton).toBeTruthy();

    act(() => {
      groupButton?.click();
    });

    expect(container.textContent).toContain("GitHub 技能组");
    expect(container.textContent).toContain("可执行技能");
    expect(container.textContent).toContain("GitHub 仓库雷达");

    const skillCard = container.querySelector(
      '[data-testid="service-skill-github-repo-radar"]',
    ) as HTMLDivElement | null;

    expect(skillCard).toBeTruthy();

    act(() => {
      skillCard?.click();
    });

    expect(onSelect).toHaveBeenCalledWith(skills[0]);

    const statusButton = container.querySelector(
      '[data-testid="service-skill-github-repo-radar-secondary-status"]',
    ) as HTMLButtonElement | null;

    expect(statusButton).toBeTruthy();

    act(() => {
      statusButton?.click();
    });

    expect(onOpenAutomationJob).toHaveBeenCalledWith(skills[0]);

    const backButton = container.querySelector(
      '[data-testid="service-skill-group-back"]',
    ) as HTMLButtonElement | null;

    expect(backButton).toBeTruthy();

    act(() => {
      backButton?.click();
    });

    expect(container.textContent).toContain("技能组");
    expect(container.textContent).toContain("通用技能");
  });

  it("无分组数据时应回退到兼容的扁平技能列表", () => {
    const skills = buildSkills();
    const onSelect = vi.fn();

    const container = renderPanel({
      skills,
      groups: [],
      catalogMeta: {
        tenantId: "tenant-demo",
        version: "tenant-2026-03-29",
        syncedAt: "2026-03-29T12:00:00.000Z",
        itemCount: 2,
        sourceLabel: "租户技能目录",
        isSeeded: false,
      },
      onSelect,
    });

    expect(container.textContent).toContain("技能入口");
    expect(container.textContent).toContain("GitHub 仓库雷达");
    expect(container.textContent).toContain("每日趋势简报");

    const skillCard = container.querySelector(
      '[data-testid="service-skill-daily-trend-briefing"]',
    ) as HTMLDivElement | null;

    expect(skillCard).toBeTruthy();

    act(() => {
      skillCard?.click();
    });

    expect(onSelect).toHaveBeenCalledWith(skills[1]);
  });
});
