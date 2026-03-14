import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetConfig = vi.fn();
const mockSaveConfig = vi.fn();
const mockSetLanguage = vi.fn();
const mockSetSoundEnabled = vi.fn();
const mockPlayToolcallSound = vi.fn();
const mockResetOnboarding = vi.fn();

vi.mock("@/lib/api/appConfig", () => ({
  getConfig: () => mockGetConfig(),
  saveConfig: (config: unknown) => mockSaveConfig(config),
}));

vi.mock("@/i18n/I18nPatchProvider", () => ({
  useI18nPatch: () => ({
    setLanguage: mockSetLanguage,
  }),
}));

vi.mock("@/contexts/useSoundContext", () => ({
  useSoundContext: () => ({
    soundEnabled: true,
    setSoundEnabled: mockSetSoundEnabled,
    playToolcallSound: mockPlayToolcallSound,
  }),
}));

vi.mock("@/components/onboarding", () => ({
  useOnboardingState: () => ({
    resetOnboarding: mockResetOnboarding,
  }),
}));

import { AppearanceSettings } from "./index";

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

const mounted: RenderResult[] = [];

function createMockConfig() {
  return {
    language: "zh",
    content_creator: {
      enabled_themes: ["general"],
      media_defaults: {
        voice: {
          preferredProviderId: "openai",
        },
      },
    },
    navigation: {
      enabled_items: ["home-general"],
    },
    chat_appearance: {
      append_selected_text_to_recommendation: true,
      showAvatar: false,
    },
  } as any;
}

async function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<AppearanceSettings />);
  });

  await act(async () => {
    await Promise.resolve();
  });

  const rendered = { container, root };
  mounted.push(rendered);
  return rendered;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
      matchMedia?: typeof window.matchMedia;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  globalThis.matchMedia =
    globalThis.matchMedia ||
    (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia);

  localStorage.clear();
  mockGetConfig.mockResolvedValue(createMockConfig());
  mockSaveConfig.mockResolvedValue(undefined);
});

afterEach(() => {
  mockGetConfig.mockReset();
  mockSaveConfig.mockReset();
  mockSetLanguage.mockReset();
  mockSetSoundEnabled.mockReset();
  mockPlayToolcallSound.mockReset();
  mockResetOnboarding.mockReset();

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
});

describe("AppearanceSettings", () => {
  it("应在同一页面中渲染基础外观和聊天外观设置", async () => {
    const { container } = await renderPage();
    const text = container.textContent ?? "";

    expect(text).toContain("基础外观");
    expect(text).toContain("主题模式");
    expect(text).toContain("界面语言");
    expect(text).toContain("工作区与聊天外观");
    expect(text).toContain("创作模式卡片");
    expect(text).toContain("左侧边栏导航");
    expect(text).toContain("推荐自动附带选中内容");
    expect(text).toContain("重新运行引导");
  });

  it("切换创作模式时应保留 content_creator 的其他配置", async () => {
    const { container } = await renderPage();
    const button = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent?.includes("社媒内容"),
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const savedConfig = mockSaveConfig.mock.calls.at(-1)?.[0] as any;

    expect(savedConfig.content_creator.enabled_themes).toEqual([
      "general",
      "social-media",
    ]);
    expect(
      savedConfig.content_creator.media_defaults.voice.preferredProviderId,
    ).toBe("openai");
  });
});
