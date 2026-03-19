import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchResultPreviewList } from "./SearchResultPreviewList";

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

const mountedRoots: RenderResult[] = [];

function renderList() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const items = Array.from({ length: 6 }, (_, index) => ({
    id: `result-${index + 1}`,
    title: `结果 ${index + 1}`,
    url: `https://example.com/${index + 1}`,
    hostname: "example.com",
    snippet: `摘要 ${index + 1}`,
  }));

  act(() => {
    root.render(
      <SearchResultPreviewList
        items={items}
        onOpenUrl={vi.fn()}
        collapsedCount={4}
      />,
    );
  });

  const rendered = { container, root };
  mountedRoots.push(rendered);
  return rendered;
}

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
});

describe("SearchResultPreviewList", () => {
  it("搜索结果应默认折叠，并支持展开与收起", () => {
    const { container } = renderList();

    expect(container.textContent).toContain("结果 1");
    expect(container.textContent).toContain("结果 4");
    expect(container.textContent).not.toContain("结果 5");
    expect(container.textContent).toContain("展开其余 2 条结果");

    const toggleButton = container.querySelector(
      'button[aria-label="展开搜索结果"]',
    ) as HTMLButtonElement | null;

    act(() => {
      toggleButton?.click();
    });

    expect(container.textContent).toContain("结果 5");
    expect(container.textContent).toContain("结果 6");
    expect(container.textContent).toContain("收起结果");

    const collapseButton = container.querySelector(
      'button[aria-label="收起搜索结果"]',
    ) as HTMLButtonElement | null;

    act(() => {
      collapseButton?.click();
    });

    expect(container.textContent).not.toContain("结果 5");
    expect(container.textContent).not.toContain("结果 6");
    expect(container.textContent).toContain("展开其余 2 条结果");
  });

  it("悬浮预览在鼠标移出整体区域后应自动关闭", () => {
    vi.useFakeTimers();
    const { container } = renderList();
    const trigger = container.querySelector(
      'button[aria-label="预览搜索结果：结果 1"]',
    ) as HTMLButtonElement | null;

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
        }),
      );
    });

    expect(document.body.textContent).toContain("摘要 1");

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
        }),
      );
      vi.advanceTimersByTime(140);
    });

    expect(document.body.textContent).not.toContain("摘要 1");
  });
});
