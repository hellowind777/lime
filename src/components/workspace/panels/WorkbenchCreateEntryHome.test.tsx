import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkbenchCreateEntryHome } from "./WorkbenchCreateEntryHome";
import {
  cleanupMountedRoots,
  clickButtonByText,
  fillTextInput,
  findButtonByText,
  findInputByPlaceholder,
  flushEffects,
  mountHarness,
  setupReactActEnvironment,
  type MountedRoot,
} from "../hooks/testUtils";
import {
  buildCreateConfirmationA2UI,
  type PendingCreateConfirmation,
} from "@/components/workspace/utils/createConfirmationPolicy";

setupReactActEnvironment();

describe("WorkbenchCreateEntryHome", () => {
  const mountedRoots: MountedRoot[] = [];

  const pendingConfirmation: PendingCreateConfirmation = {
    projectId: "project-1",
    source: "workspace_prompt",
    creationMode: "guided",
    initialUserPrompt: "请帮我生成一篇关于 AI Agent 行业趋势的文章",
    createdAt: 1_700_000_000_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupMountedRoots(mountedRoots);
  });

  it("无待确认任务时展示工作态首页", () => {
    const { container } = mountHarness(
      WorkbenchCreateEntryHome,
      {
        projectName: "社媒项目A",
        pendingCreateConfirmation: undefined,
        createConfirmationResponse: null,
        onOpenCreateContentDialog: vi.fn(),
        onSubmitCreateConfirmation: vi.fn(),
        onCancelCreateConfirmation: vi.fn(),
      },
      mountedRoots,
    );

    expect(container.querySelector("[data-testid='workspace-create-entry-home']")).not.toBeNull();
    expect(container.querySelector("[data-testid='workspace-create-confirmation-card']")).toBeNull();
    expect(container.textContent).toContain("当前没有待处理任务");
    expect(container.textContent).toContain("社媒项目A");
    expect(container.textContent).toContain("创作首页");
  });

  it("待确认任务时展示创建确认卡片与原始需求", async () => {
    const { container } = mountHarness(
      WorkbenchCreateEntryHome,
      {
        projectName: "社媒项目A",
        pendingCreateConfirmation: pendingConfirmation,
        createConfirmationResponse: buildCreateConfirmationA2UI(
          pendingConfirmation,
        ),
        onOpenCreateContentDialog: vi.fn(),
        onSubmitCreateConfirmation: vi.fn(),
        onCancelCreateConfirmation: vi.fn(),
      },
      mountedRoots,
    );

    expect(container.querySelector("[data-testid='workspace-create-confirmation-card']")).not.toBeNull();
    expect(container.textContent).toContain("确认创作方式");
    expect(container.textContent).toContain("原始需求");
    expect(container.textContent).toContain(
      "请帮我生成一篇关于 AI Agent 行业趋势的文章",
    );
    expect(findButtonByText(container, "开始处理")).toBeDefined();
  });

  it("A2UI 按需显示补充说明，并在提交时回传用户选择", async () => {
    const submitSpy = vi.fn();
    const { container } = mountHarness(
      WorkbenchCreateEntryHome,
      {
        projectName: "社媒项目A",
        pendingCreateConfirmation: pendingConfirmation,
        createConfirmationResponse: buildCreateConfirmationA2UI(
          pendingConfirmation,
        ),
        onOpenCreateContentDialog: vi.fn(),
        onSubmitCreateConfirmation: submitSpy,
        onCancelCreateConfirmation: vi.fn(),
      },
      mountedRoots,
    );

    expect(container.textContent).not.toContain("补充说明（可选）");
    const submitButton = findButtonByText(container, "开始处理");
    expect(submitButton?.disabled).toBe(true);

    clickButtonByText(container, "其他方式");
    await flushEffects();

    expect(container.textContent).toContain("补充说明（可选）");
    fillTextInput(
      findInputByPlaceholder(
        container,
        "如果你有明确主题、素材、目标读者或限制条件，可以补充在这里",
      ),
      "按我的素材继续扩写",
    );
    await flushEffects();

    clickButtonByText(container, "开始处理");
    await flushEffects();

    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create_confirmation_option: ["other"],
      }),
    );
  });
});
