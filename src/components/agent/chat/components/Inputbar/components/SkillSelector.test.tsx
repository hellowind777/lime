import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillSelector } from "./SkillSelector";
import type { Skill } from "@/lib/api/skills";

const mockToastInfo = vi.fn();
const mockPopoverState = vi.hoisted(() => ({
  open: false,
  setOpen: (_next: boolean) => {},
}));

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    mockPopoverState.open = Boolean(open);
    mockPopoverState.setOpen = onOpenChange ?? (() => {});
    return <div>{children}</div>;
  },
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => {
    const child = React.Children.only(children) as React.ReactElement<{
      onClick?: React.MouseEventHandler<HTMLElement>;
    }>;

    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        mockPopoverState.setOpen(!mockPopoverState.open);
      },
    });
  },
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    mockPopoverState.open ? (
      <div data-testid="skill-selector-popover">{children}</div>
    ) : null,
}));

vi.mock("@/components/ui/command", () => {
  const Command = ({
    children,
    shouldFilter: _shouldFilter,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { shouldFilter?: boolean }) => (
    <div {...props}>{children}</div>
  );

  const CommandInput = ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="skill-selector-input"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  );

  const CommandList = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );

  const CommandGroup = ({
    heading,
    children,
  }: {
    heading?: string;
    children: React.ReactNode;
  }) => (
    <section>
      {heading ? <div>{heading}</div> : null}
      {children}
    </section>
  );

  const CommandItem = ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  );

  return {
    Command,
    CommandInput,
    CommandList,
    CommandGroup,
    CommandItem,
  };
});

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
  mockPopoverState.open = false;
  mockPopoverState.setOpen = () => {};
  vi.clearAllMocks();
});

function createSkill(name: string, key: string, installed: boolean): Skill {
  return {
    key,
    name,
    description: `${name} 的描述`,
    directory: `${key}-dir`,
    installed,
    sourceKind: "builtin",
  };
}

function renderSkillSelector(
  props?: Partial<React.ComponentProps<typeof SkillSelector>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof SkillSelector> = {
    skills: [],
    activeSkill: null,
    isLoading: false,
    onSelectSkill: vi.fn(),
    onClearSkill: vi.fn(),
  };

  act(() => {
    root.render(<SkillSelector {...defaultProps} {...props} />);
  });

  mountedRoots.push({ root, container });
  return container;
}

async function preloadSkillSelectorPanel() {
  await act(async () => {
    await import("./SkillSelectorPanel");
  });
}

async function openSkillSelector(container: HTMLElement) {
  await preloadSkillSelectorPanel();

  const triggerButton = container.querySelector(
    '[data-testid="skill-selector-trigger"]',
  ) as HTMLButtonElement | null;

  expect(triggerButton).toBeTruthy();

  await act(async () => {
    triggerButton?.click();
  });
}

describe("SkillSelector", () => {
  it("选择已安装技能时应回调 onSelectSkill", async () => {
    const onSelectSkill = vi.fn<(skill: Skill) => void>();
    const installedSkill = createSkill("写作助手", "writer", true);
    const container = renderSkillSelector({
      skills: [installedSkill],
      onSelectSkill,
    });

    await openSkillSelector(container);

    const skillButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("写作助手"),
    );
    expect(skillButton).toBeTruthy();

    act(() => {
      skillButton?.click();
    });

    expect(onSelectSkill).toHaveBeenCalledWith(installedSkill);
  });

  it("存在已选技能时应支持清空", async () => {
    const onClearSkill = vi.fn<() => void>();
    const activeSkill = createSkill("研究助手", "research", true);
    const container = renderSkillSelector({
      skills: [activeSkill],
      activeSkill,
      onClearSkill,
    });

    await openSkillSelector(container);

    expect(container.textContent).toContain("不使用技能");

    const clearButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("不使用技能"),
    );
    expect(clearButton).toBeTruthy();

    act(() => {
      clearButton?.click();
    });

    expect(onClearSkill).toHaveBeenCalledTimes(1);
  });

  it("点击未安装技能时应给出安装提示", async () => {
    const onNavigateToSettings = vi.fn<() => void>();
    const container = renderSkillSelector({
      skills: [createSkill("表格导入", "xlsx", false)],
      onNavigateToSettings,
    });

    await openSkillSelector(container);

    const unavailableSkillButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("表格导入"));
    expect(unavailableSkillButton).toBeTruthy();

    act(() => {
      unavailableSkillButton?.click();
    });

    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastInfo.mock.calls[0]?.[0]).toContain("尚未安装");
    expect(mockToastInfo.mock.calls[0]?.[1]).toMatchObject({
      action: {
        label: "去安装",
        onClick: onNavigateToSettings,
      },
    });
  });

  it("点击底部导入技能入口时应回调 onImportSkill", async () => {
    const onImportSkill = vi.fn<() => void>();
    const container = renderSkillSelector({
      onImportSkill,
    });

    await openSkillSelector(container);

    const importButton = container.querySelector(
      '[data-testid="skill-selector-import"]',
    ) as HTMLButtonElement | null;
    expect(importButton).toBeTruthy();

    await act(async () => {
      importButton?.click();
      await Promise.resolve();
    });

    expect(onImportSkill).toHaveBeenCalledTimes(1);
  });

  it("点击底部刷新技能入口时应回调 onRefreshSkills", async () => {
    const onRefreshSkills = vi.fn<() => void>();
    const installedSkill = createSkill("写作助手", "writer", true);
    const container = renderSkillSelector({
      skills: [installedSkill],
      onRefreshSkills,
    });

    await openSkillSelector(container);

    const refreshButton = container.querySelector(
      '[data-testid="skill-selector-refresh"]',
    ) as HTMLButtonElement | null;
    expect(refreshButton).toBeTruthy();

    await act(async () => {
      refreshButton?.click();
      await Promise.resolve();
    });

    expect(onRefreshSkills).toHaveBeenCalledTimes(1);
  });

  it("加载中且无技能时应显示加载状态", async () => {
    const container = renderSkillSelector({
      isLoading: true,
      skills: [],
      onRefreshSkills: vi.fn(),
    });

    await openSkillSelector(container);

    expect(container.textContent).toContain("技能加载中");
  });
});
