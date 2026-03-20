import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFilesPanel } from "./TaskFilesPanel";

vi.mock("../../TaskFiles", () => ({
  TaskFileList: () => <div data-testid="task-file-list" />,
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

function renderPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <TaskFilesPanel
        files={[
          {
            id: "file-1",
            name: "notes.md",
            type: "document",
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ]}
      />,
    );
  });

  mountedRoots.push({ root, container });
  return container;
}

describe("TaskFilesPanel", () => {
  it("应作为 overlay row 内部的相对定位控件渲染", () => {
    const container = renderPanel();
    const area = container.querySelector<HTMLElement>(
      '[data-testid="task-files-panel-area"]',
    );

    expect(area).toBeTruthy();
    expect(getComputedStyle(area as HTMLElement).position).toBe("relative");
  });

  it("点击触发按钮时应调用切换回调", () => {
    const onToggle = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TaskFilesPanel
          files={[
            {
              id: "file-1",
              name: "notes.md",
              type: "document",
              version: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]}
          onToggle={onToggle}
        />,
      );
    });

    mountedRoots.push({ root, container });

    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-task-files-trigger]",
    );

    act(() => {
      trigger?.click();
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
