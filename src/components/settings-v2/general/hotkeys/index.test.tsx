import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetExperimentalConfig, mockGetVoiceInputConfig } = vi.hoisted(
  () => ({
    mockGetExperimentalConfig: vi.fn(),
    mockGetVoiceInputConfig: vi.fn(),
  }),
);

vi.mock("@/lib/api/experimentalFeatures", () => ({
  getExperimentalConfig: mockGetExperimentalConfig,
}));

vi.mock("@/lib/api/asrProvider", () => ({
  getVoiceInputConfig: mockGetVoiceInputConfig,
}));

import { HotkeysSettings } from ".";

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
    root.render(<HotkeysSettings />);
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

function findButtonByText(
  container: HTMLElement,
  text: string,
): HTMLButtonElement {
  const element = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.includes(text),
  );
  if (!element) {
    throw new Error(`未找到按钮文本: ${text}`);
  }
  return element as HTMLButtonElement;
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushEffects();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  vi.clearAllMocks();

  mockGetExperimentalConfig.mockResolvedValue({
    screenshot_chat: {
      enabled: true,
      shortcut: "CommandOrControl+Shift+4",
    },
  });

  mockGetVoiceInputConfig.mockResolvedValue({
    enabled: true,
    shortcut: "CommandOrControl+Shift+Space",
    processor: {
      polish_enabled: true,
      default_instruction_id: "default",
    },
    output: {
      mode: "type",
      type_delay_ms: 0,
    },
    instructions: [],
    sound_enabled: true,
    translate_shortcut: "",
    translate_instruction_id: "",
  });
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

describe("HotkeysSettings", () => {
  it("应渲染新的快捷键总览与主要分区", async () => {
    const container = renderComponent();
    await waitForLoad();

    const text = container.textContent ?? "";
    expect(text).toContain("HOTKEY MAP");
    expect(text).toContain("快捷键总数");
    expect(text).toContain("全局快捷键");
    expect(text).toContain("页面内快捷键");
    expect(text).toContain("截图对话");
    expect(text).toContain("语音输入");
    expect(text).toContain("终端搜索");
    expect(text).toContain("⌘/Ctrl");
    expect(text).toContain("未设置");
  });

  it("加载失败后应支持重试并重新渲染内容", async () => {
    mockGetExperimentalConfig
      .mockRejectedValueOnce(new Error("网络异常"))
      .mockResolvedValue({
        screenshot_chat: {
          enabled: false,
          shortcut: "CommandOrControl+Shift+S",
        },
      });

    const container = renderComponent();
    await waitForLoad();

    expect(container.textContent).toContain("加载快捷键失败：网络异常");

    await clickButton(findButtonByText(container, "重试"));
    await waitForLoad();

    expect(mockGetExperimentalConfig).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("全局快捷键");
    expect(container.textContent).toContain("截图对话");
  });

  it("应正确展示待配置的翻译快捷键状态", async () => {
    mockGetExperimentalConfig.mockResolvedValue({
      screenshot_chat: {
        enabled: false,
        shortcut: "",
      },
    });

    mockGetVoiceInputConfig.mockResolvedValue({
      enabled: false,
      shortcut: "",
      processor: {
        polish_enabled: false,
        default_instruction_id: "default",
      },
      output: {
        mode: "type",
        type_delay_ms: 0,
      },
      instructions: [],
      sound_enabled: false,
      translate_shortcut: "",
      translate_instruction_id: "",
    });

    const container = renderComponent();
    await waitForLoad();

    const text = container.textContent ?? "";
    expect(text).toContain("待配置");
    expect(text).toContain("语音翻译模式");
    expect(text).toContain("未启用");
    expect(text).toContain("翻译指令未绑定");
  });
});
