import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "./ChatSidebar";
import type { Topic } from "../hooks/agentChatShared";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div />,
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

const defaultTopics: Topic[] = [
  {
    id: "topic-1",
    title: "任务一",
    createdAt: new Date(),
    updatedAt: new Date(),
    messagesCount: 2,
    executionStrategy: "auto",
    status: "done",
    lastPreview: "已记录 2 条消息，可继续补充或复盘。",
    isPinned: false,
    hasUnread: false,
    tag: null,
    sourceSessionId: "topic-1",
  },
];

function renderSidebar(
  props?: Partial<React.ComponentProps<typeof ChatSidebar>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof ChatSidebar> = {
    onNewChat: vi.fn(),
    topics: defaultTopics,
    currentTopicId: "topic-1",
    onSwitchTopic: vi.fn(),
    onDeleteTopic: vi.fn(),
  };

  act(() => {
    root.render(<ChatSidebar {...defaultProps} {...props} />);
  });

  mountedRoots.push({ root, container });
  return container;
}

describe("ChatSidebar", () => {
  it("应显示新建任务入口和任务列表", () => {
    const container = renderSidebar();
    expect(container.textContent).toContain("新建任务");
    expect(container.textContent).toContain("任务一");
  });

  it("点击任务时应触发切换", () => {
    const onSwitchTopic = vi.fn();
    const container = renderSidebar({ onSwitchTopic });
    const taskItem = Array.from(
      container.querySelectorAll('[role="button"]'),
    ).find(
      (element) => element.textContent?.includes("任务一"),
    );
    expect(taskItem).toBeTruthy();
    if (taskItem) {
      act(() => {
        taskItem.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }
    expect(onSwitchTopic).toHaveBeenCalledWith("topic-1");
  });

  it("点击菜单删除任务时应触发删除", () => {
    const onDeleteTopic = vi.fn();
    const container = renderSidebar({ onDeleteTopic });
    const actionButton = container.querySelector(
      'button[aria-label="任务操作"]',
    ) as HTMLButtonElement | null;
    expect(actionButton).toBeTruthy();
    if (actionButton) {
      act(() => {
        actionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("删除任务"),
    );
    expect(deleteButton).toBeTruthy();
    if (deleteButton) {
      act(() => {
        deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }
    expect(onDeleteTopic).toHaveBeenCalledWith("topic-1");
  });

  it("切换为仅看进行中时应过滤已完成任务", () => {
    const container = renderSidebar({
      isSending: true,
      currentTopicId: "topic-1",
    });

    const filterButton = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("仅看进行中"),
    );
    expect(filterButton).toBeTruthy();

    act(() => {
      filterButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("任务一");
    expect(container.textContent).toContain("进行中");
  });
});
