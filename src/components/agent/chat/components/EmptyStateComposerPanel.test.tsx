import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyStateComposerPanel } from "./EmptyStateComposerPanel";

vi.mock("./ChatModelSelector", () => ({
  ChatModelSelector: () => <div data-testid="empty-state-model-selector" />,
}));

vi.mock("./Inputbar/components/CharacterMention", () => ({
  CharacterMention: () => <div data-testid="empty-state-character-mention" />,
}));

vi.mock("./Inputbar/components/SkillBadge", () => ({
  SkillBadge: () => <div data-testid="empty-state-skill-badge" />,
}));

vi.mock("./Inputbar/components/SkillSelector", () => ({
  SkillSelector: () => <div data-testid="empty-state-skill-selector" />,
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
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

function renderPanel(
  props?: Partial<React.ComponentProps<typeof EmptyStateComposerPanel>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof EmptyStateComposerPanel> = {
    input: "",
    setInput: vi.fn(),
    placeholder: "输入内容",
    onSend: vi.fn(),
    activeTheme: "general",
    providerType: "openai",
    setProviderType: vi.fn(),
    model: "gpt-4.1",
    setModel: vi.fn(),
    executionStrategy: "react",
    executionStrategyLabel: "ReAct",
    setExecutionStrategy: vi.fn(),
    onManageProviders: vi.fn(),
    isGeneralTheme: false,
    isEntryTheme: false,
    entryTaskType: "direct",
    entryTaskTypes: [],
    getEntryTaskTemplate: vi.fn(),
    entryTemplate: {
      type: "direct",
      label: "直接写作",
      description: "直接按需求写作",
      pattern: "{input}",
      slots: [],
    },
    entryPreview: "",
    entrySlotValues: {},
    onEntryTaskTypeChange: vi.fn(),
    onEntrySlotChange: vi.fn(),
    characters: [],
    skills: [],
    activeSkill: null,
    setActiveSkill: vi.fn(),
    clearActiveSkill: vi.fn(),
    isSkillsLoading: false,
    onNavigateToSettings: vi.fn(),
    onImportSkill: vi.fn(),
    onRefreshSkills: vi.fn(),
    showCreationModeSelector: false,
    creationMode: "guided",
    onCreationModeChange: vi.fn(),
    platform: "xiaohongshu",
    setPlatform: vi.fn(),
    depth: "deep",
    setDepth: vi.fn(),
    ratio: "3:4",
    setRatio: vi.fn(),
    style: "minimal",
    setStyle: vi.fn(),
    ratioPopoverOpen: false,
    setRatioPopoverOpen: vi.fn(),
    stylePopoverOpen: false,
    setStylePopoverOpen: vi.fn(),
    thinkingEnabled: false,
    onThinkingEnabledChange: vi.fn(),
    taskEnabled: false,
    onTaskEnabledChange: vi.fn(),
    subagentEnabled: false,
    onSubagentEnabledChange: vi.fn(),
    webSearchEnabled: false,
    onWebSearchEnabledChange: vi.fn(),
    pendingImages: [],
    onFileSelect: vi.fn(),
    onPaste: vi.fn(),
    onRemoveImage: vi.fn(),
  };

  act(() => {
    root.render(<EmptyStateComposerPanel {...defaultProps} {...props} />);
  });

  mountedRoots.push({ root, container });
  return container;
}

describe("EmptyStateComposerPanel", () => {
  it("应将 onPaste 绑定到输入框", () => {
    const onPaste = vi.fn();
    const container = renderPanel({ onPaste });
    const textarea = container.querySelector("textarea");

    expect(textarea).toBeTruthy();

    act(() => {
      textarea?.dispatchEvent(new Event("paste", { bubbles: true }));
    });

    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it("有待发送图片时应显示预览并支持删除", () => {
    const onRemoveImage = vi.fn();
    const container = renderPanel({
      pendingImages: [
        {
          data: "aGVsbG8=",
          mediaType: "image/png",
        },
      ],
      onRemoveImage,
    });

    expect(container.querySelector('img[alt="待发送图片 1"]')).toBeTruthy();

    const removeButton = container.querySelector(
      'button[aria-label="移除待发送图片 1"]',
    ) as HTMLButtonElement | null;

    expect(removeButton).toBeTruthy();

    act(() => {
      removeButton?.click();
    });

    expect(onRemoveImage).toHaveBeenCalledWith(0);
  });
});
