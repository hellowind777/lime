import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetRateLimitConfig,
  mockUpdateRateLimitConfig,
  mockGetConversationConfig,
  mockUpdateConversationConfig,
  mockGetHintRoutes,
  mockUpdateHintRoutes,
  mockGetPairingConfig,
  mockUpdatePairingConfig,
} = vi.hoisted(() => ({
  mockGetRateLimitConfig: vi.fn(),
  mockUpdateRateLimitConfig: vi.fn(),
  mockGetConversationConfig: vi.fn(),
  mockUpdateConversationConfig: vi.fn(),
  mockGetHintRoutes: vi.fn(),
  mockUpdateHintRoutes: vi.fn(),
  mockGetPairingConfig: vi.fn(),
  mockUpdatePairingConfig: vi.fn(),
}));

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/api/securityPerformance", () => ({
  getRateLimitConfig: mockGetRateLimitConfig,
  updateRateLimitConfig: mockUpdateRateLimitConfig,
  getConversationConfig: mockGetConversationConfig,
  updateConversationConfig: mockUpdateConversationConfig,
  getHintRoutes: mockGetHintRoutes,
  updateHintRoutes: mockUpdateHintRoutes,
  getPairingConfig: mockGetPairingConfig,
  updatePairingConfig: mockUpdatePairingConfig,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { SecurityPerformanceSettings } from ".";

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
    root.render(<SecurityPerformanceSettings />);
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

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(text),
  );
  if (!button) {
    throw new Error(`未找到按钮: ${text}`);
  }
  return button as HTMLButtonElement;
}

function findSwitch(container: HTMLElement, ariaLabel: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${ariaLabel}"]`,
  );
  if (!button) {
    throw new Error(`未找到开关: ${ariaLabel}`);
  }
  return button;
}

function findInput(container: HTMLElement, id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) {
    throw new Error(`未找到输入框: ${id}`);
  }
  return input;
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushEffects();
  });
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!nativeSetter) {
    throw new Error("未找到 input value setter");
  }

  await act(async () => {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushEffects();
  });
}

async function blurInput(input: HTMLInputElement) {
  await act(async () => {
    input.focus();
    input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    input.blur();
    await flushEffects();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
      ResizeObserver?: typeof ResizeObserver;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  (
    globalThis as typeof globalThis & {
      ResizeObserver?: typeof ResizeObserver;
    }
  ).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  vi.clearAllMocks();

  mockGetRateLimitConfig.mockResolvedValue({
    enabled: false,
    requests_per_minute: 60,
    window_secs: 60,
  });
  mockUpdateRateLimitConfig.mockResolvedValue(undefined);

  mockGetConversationConfig.mockResolvedValue({
    trim_enabled: true,
    max_messages: 80,
    summary_enabled: false,
  });
  mockUpdateConversationConfig.mockResolvedValue(undefined);

  mockGetHintRoutes.mockResolvedValue([
    {
      hint: "translate",
      provider: "openai",
      model: "gpt-4.1",
    },
  ]);
  mockUpdateHintRoutes.mockResolvedValue(undefined);

  mockGetPairingConfig.mockResolvedValue({
    enabled: false,
  });
  mockUpdatePairingConfig.mockResolvedValue(undefined);
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

describe("SecurityPerformanceSettings", () => {
  it("应渲染新的安全与性能总览和主要分区", async () => {
    const container = renderComponent();
    await waitForLoad();

    const text = container.textContent ?? "";
    expect(text).toContain("SECURITY CONTROL");
    expect(text).toContain("速率限制");
    expect(text).toContain("对话管理");
    expect(text).toContain("提示路由");
    expect(text).toContain("配对认证");
    expect(text).toContain("治理建议");
    expect(
      findInput(container, "security-performance-route-hint-0").value,
    ).toBe("translate");
  });

  it("切换速率限制开关后应立即保存", async () => {
    const container = renderComponent();
    await waitForLoad();

    await clickButton(findSwitch(container, "启用速率限制"));

    expect(mockUpdateRateLimitConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({
      enabled: true,
      requests_per_minute: 60,
      window_secs: 60,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("速率限制已更新");
  });

  it("新增提示路由并失焦后应保存规则", async () => {
    const container = renderComponent();
    await waitForLoad();

    await clickButton(findButton(container, "添加规则"));

    await setInputValue(
      findInput(container, "security-performance-route-hint-1"),
      "code-review",
    );
    await setInputValue(
      findInput(container, "security-performance-route-provider-1"),
      "claude",
    );
    const modelInput = findInput(
      container,
      "security-performance-route-model-1",
    );
    await setInputValue(modelInput, "claude-sonnet-4");
    await blurInput(modelInput);

    expect(mockUpdateHintRoutes).toHaveBeenCalledTimes(1);
    expect(mockUpdateHintRoutes).toHaveBeenCalledWith([
      {
        hint: "translate",
        provider: "openai",
        model: "gpt-4.1",
      },
      {
        hint: "code-review",
        provider: "claude",
        model: "claude-sonnet-4",
      },
    ]);
    expect(mockToastSuccess).toHaveBeenCalledWith("提示路由已更新");
  });

  it("切换配对认证后应立即保存", async () => {
    const container = renderComponent();
    await waitForLoad();

    await clickButton(findSwitch(container, "启用配对认证"));

    expect(mockUpdatePairingConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdatePairingConfig).toHaveBeenCalledWith({ enabled: true });
    expect(mockToastSuccess).toHaveBeenCalledWith("配对认证已更新");
  });
});
