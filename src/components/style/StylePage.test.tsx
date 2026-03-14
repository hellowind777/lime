import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clickButtonByText,
  cleanupMountedRoots,
  flushEffects,
  mountHarness,
  setupReactActEnvironment,
  type MountedRoot,
} from "@/components/workspace/hooks/testUtils";
import {
  STYLE_LIBRARY_APPLICATION_HISTORY_KEY,
  STYLE_LIBRARY_STORAGE_KEY,
} from "@/lib/style-library";
import { StylePage } from "./StylePage";

setupReactActEnvironment();

describe("StylePage", () => {
  const mountedRoots: MountedRoot[] = [];

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanupMountedRoots(mountedRoots);
    window.localStorage.clear();
  });

  it("默认进入总览页，不直接展示完整工作台", async () => {
    const { container } = mountHarness(
      StylePage,
      {
        onNavigate: vi.fn(),
        pageParams: undefined,
      },
      mountedRoots,
    );

    await flushEffects();

    expect(container.textContent).toContain("先确认状态与下一步动作");
    expect(container.textContent).toContain("风格资产数");
    expect(container.textContent).toContain("当前状态");
    expect(container.textContent).toContain("最近使用的风格");
    expect(container.textContent).toContain("最近应用到的项目");
    expect(container.textContent).not.toContain("结构化编辑");
  });

  it("进入 library section 时展示工作台布局", async () => {
    const { container } = mountHarness(
      StylePage,
      {
        onNavigate: vi.fn(),
        pageParams: { section: "library" },
      },
      mountedRoots,
    );

    await flushEffects();

    expect(container.textContent).toContain("管理风格资产");
    expect(container.textContent).toContain("资产列表");
    expect(container.textContent).toContain("结构化编辑");
    expect(container.textContent).not.toContain("最近使用的风格");
  });

  it("应支持从最近应用项目直接跳到对应资产", async () => {
    window.localStorage.setItem(
      STYLE_LIBRARY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        activeEntryId: "entry-1",
        entries: [
          {
            id: "entry-1",
            sourceType: "manual",
            sourceLabel: "手动创建",
            sampleText: "示例文本",
            sourceFiles: [],
            profile: {
              version: 1,
              name: "风格 A",
              description: "理性、克制",
              category: "personal",
              applicableThemes: ["general"],
              targetPlatforms: [],
              targetAudience: "",
              toneKeywords: ["理性"],
              toneMetrics: {
                formality: 70,
                warmth: 40,
                humor: 10,
                emotion: 20,
                assertiveness: 60,
                creativity: 40,
              },
              structureRules: [],
              languageFeatures: [],
              rhetoricDevices: [],
              dos: [],
              donts: [],
              simulationStrength: 70,
              referenceExamples: [],
              customInstruction: "",
            },
            previewPrompt: "preview",
            createdAt: "2026-03-10T00:00:00.000Z",
            updatedAt: "2026-03-10T00:00:00.000Z",
          },
        ],
      }),
    );
    window.localStorage.setItem(
      STYLE_LIBRARY_APPLICATION_HISTORY_KEY,
      JSON.stringify([
        {
          projectId: "project-1",
          entryId: "entry-1",
          entryName: "风格 A",
          appliedAt: "2026-03-10T09:30:00.000Z",
        },
      ]),
    );

    const onNavigate = vi.fn();
    const { container } = mountHarness(
      StylePage,
      {
        onNavigate,
        pageParams: { section: "overview" },
      },
      mountedRoots,
    );

    await flushEffects();

    const button = clickButtonByText(container, "查看资产");
    expect(button).toBeDefined();
    expect(onNavigate).toHaveBeenCalledWith("style", { section: "library" });
  });

  it("应把来源资产 ID 带到项目风格策略跳转中", async () => {
    window.localStorage.setItem(
      STYLE_LIBRARY_APPLICATION_HISTORY_KEY,
      JSON.stringify([
        {
          projectId: "project-1",
          entryId: "entry-99",
          entryName: "风格 Z",
          appliedAt: "2026-03-10T09:30:00.000Z",
        },
      ]),
    );

    const onNavigate = vi.fn();
    const { container } = mountHarness(
      StylePage,
      {
        onNavigate,
        pageParams: { section: "overview" },
      },
      mountedRoots,
    );

    await flushEffects();

    const button = clickButtonByText(container, "查看项目风格");
    expect(button).toBeDefined();
    expect(onNavigate).toHaveBeenCalledWith("project-detail", {
      projectId: "project-1",
      openProjectStyleGuide: true,
      openProjectStyleGuideSourceEntryId: "entry-99",
    });
  });
});
