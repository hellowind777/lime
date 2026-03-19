import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <pre data-testid="syntax-highlighter" className={className}>
      {children}
    </pre>
  ),
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

vi.mock("./ArtifactPlaceholder", () => ({
  ArtifactPlaceholder: ({ language }: { language: string }) => (
    <div data-testid="artifact-placeholder">{language}</div>
  ),
}));

vi.mock("./A2UITaskCard", () => ({
  A2UITaskCard: () => <div data-testid="a2ui-task-card" />,
  A2UITaskLoadingCard: () => <div data-testid="a2ui-task-loading-card" />,
}));

interface MountedHarness {
  container: HTMLDivElement;
  root: Root;
}

interface RenderOptions {
  isStreaming?: boolean;
  collapseCodeBlocks?: boolean;
  shouldCollapseCodeBlock?: (language: string, code: string) => boolean;
}

const mountedRoots: MountedHarness[] = [];

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
  vi.useRealTimers();
  vi.clearAllMocks();
});

function render(
  content: string,
  {
    isStreaming = false,
    collapseCodeBlocks = false,
    shouldCollapseCodeBlock,
  }: RenderOptions = {},
): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MarkdownRenderer
        content={content}
        isStreaming={isStreaming}
        collapseCodeBlocks={collapseCodeBlocks}
        shouldCollapseCodeBlock={shouldCollapseCodeBlock}
      />,
    );
  });

  mountedRoots.push({ container, root });
  return container;
}

function renderHarness(
  content: string,
  {
    isStreaming = false,
    collapseCodeBlocks = false,
    shouldCollapseCodeBlock,
  }: RenderOptions = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const rerender = (
    nextContent: string,
    {
      isStreaming: nextIsStreaming = isStreaming,
      collapseCodeBlocks: nextCollapseCodeBlocks = collapseCodeBlocks,
      shouldCollapseCodeBlock: nextShouldCollapseCodeBlock =
        shouldCollapseCodeBlock,
    }: RenderOptions = {},
  ) => {
    act(() => {
      root.render(
        <MarkdownRenderer
          content={nextContent}
          isStreaming={nextIsStreaming}
          collapseCodeBlocks={nextCollapseCodeBlocks}
          shouldCollapseCodeBlock={nextShouldCollapseCodeBlock}
        />,
      );
    });
  };

  rerender(content, {
    isStreaming,
    collapseCodeBlocks,
    shouldCollapseCodeBlock,
  });

  mountedRoots.push({ container, root });
  return { container, rerender };
}

describe("MarkdownRenderer", () => {
  it("非流式时应保留 raw html 渲染能力", () => {
    const content = [
      "前置文本",
      "",
      '<div class="rendered-html">原始 HTML</div>',
      "",
      "后置文本",
    ].join("\n");

    const container = render(content);

    expect(container.querySelector(".rendered-html")).not.toBeNull();
    expect(container.textContent).toContain("原始 HTML");
  });

  it("大段流式输出时应跳过 raw html 重解析", () => {
    const content = [
      "A".repeat(2_200),
      "",
      '<div class="rendered-html">原始 HTML</div>',
      "",
      "结尾文本",
    ].join("\n");

    const container = render(content, { isStreaming: true });

    expect(container.querySelector(".rendered-html")).toBeNull();
    expect(container.textContent).toContain("结尾文本");
  });

  it("流式结束后应立即恢复完整 raw html 渲染", () => {
    vi.useFakeTimers();
    const content = [
      "A".repeat(2_200),
      "",
      '<div class="rendered-html">原始 HTML</div>',
      "",
      "结尾文本",
    ].join("\n");

    const { container, rerender } = renderHarness(content, {
      isStreaming: true,
    });
    expect(container.querySelector(".rendered-html")).toBeNull();

    rerender(content, { isStreaming: false });
    expect(container.querySelector(".rendered-html")).not.toBeNull();
  });

  it("逐块判定返回 false 时应保持对话内联代码渲染", () => {
    const shouldCollapseCodeBlock = vi.fn(() => false);
    const content = ["```ts", "const answer = 42;", "```"].join("\n");

    const container = render(content, {
      collapseCodeBlocks: true,
      shouldCollapseCodeBlock,
    });

    expect(shouldCollapseCodeBlock).toHaveBeenCalledWith(
      "ts",
      "const answer = 42;",
    );
    expect(
      container.querySelector('[data-testid="artifact-placeholder"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="syntax-highlighter"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("const answer = 42;");
  });

  it("逐块判定返回 true 时才应渲染 artifact 占位卡", () => {
    const content = ["```tsx", "export default function Demo() {}", "```"].join(
      "\n",
    );

    const container = render(content, {
      collapseCodeBlocks: true,
      shouldCollapseCodeBlock: () => true,
    });

    expect(
      container.querySelector('[data-testid="artifact-placeholder"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="syntax-highlighter"]'),
    ).toBeNull();
  });
});
