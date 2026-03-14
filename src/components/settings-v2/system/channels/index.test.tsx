import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockSaveConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSaveConfig: vi.fn(),
}));

const { mockUseConfiguredProviders } = vi.hoisted(() => ({
  mockUseConfiguredProviders: vi.fn(),
}));

vi.mock("@/lib/api/appConfig", () => ({
  getConfig: mockGetConfig,
  saveConfig: mockSaveConfig,
}));

vi.mock("@/hooks/useConfiguredProviders", () => ({
  useConfiguredProviders: mockUseConfiguredProviders,
}));

vi.mock("./ChannelLogTailPanel", () => ({
  ChannelLogTailPanel: () => <div>日志面板占位</div>,
}));

import { ChannelsSettings } from ".";

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
    root.render(<ChannelsSettings />);
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

  mockUseConfiguredProviders.mockReturnValue({
    providers: [],
    loading: false,
  });

  mockGetConfig.mockResolvedValue({
    channels: {
      telegram: {
        enabled: false,
        bot_token: "123456:telegram-token",
        allowed_user_ids: ["10001"],
        default_model: "openai/gpt-4.1",
      },
      discord: {
        enabled: true,
        bot_token: "discord-token",
        allowed_server_ids: ["guild-1"],
        default_model: "claude/claude-sonnet-4",
        default_account: "default",
        accounts: {},
        dm_policy: "pairing",
        allow_from: [],
        group_policy: "allowlist",
        group_allow_from: [],
        streaming: "partial",
        reply_to_mode: "off",
      },
      feishu: {
        enabled: false,
        app_id: "cli_test",
        app_secret: "secret",
        default_model: undefined,
        dm_policy: "open",
        allow_from: ["*"],
        group_policy: "allowlist",
        group_allow_from: [],
      },
    },
    gateway: {
      tunnel: {
        enabled: false,
        provider: "cloudflare",
        mode: "managed",
        local_host: "127.0.0.1",
        local_port: 3000,
        cloudflare: {
          tunnel_name: "proxycast",
          dns_name: "bot.example.com",
        },
      },
    },
  });

  mockSaveConfig.mockResolvedValue(undefined);
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

describe("ChannelsSettings", () => {
  it("应渲染新的渠道控制总览和工作区切换", async () => {
    const container = renderComponent();
    await waitForLoad();

    const text = container.textContent ?? "";
    expect(text).toContain("CHANNEL CONTROL");
    expect(text).toContain("工作区切换");
    expect(text).toContain("渠道总览");
    expect(text).toContain("推荐顺序");
    expect(text).toContain("Telegram");
    expect(text).toContain("Discord");
    expect(text).toContain("飞书");
  });

  it("在渠道配置页修改 Telegram 开关后应支持保存", async () => {
    const container = renderComponent();
    await waitForLoad();

    await clickButton(findButton(container, "渠道配置"));
    expect(container.textContent).toContain("Telegram 配置说明");

    const switches = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="switch"]'),
    );
    if (switches.length === 0) {
      throw new Error("未找到渠道开关");
    }

    await clickButton(switches[0]);

    expect(container.textContent).toContain("未保存的更改");

    await clickButton(findButton(container, "保存"));

    expect(mockSaveConfig).toHaveBeenCalledTimes(1);
    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.objectContaining({
          telegram: expect.objectContaining({
            enabled: true,
          }),
        }),
        gateway: expect.objectContaining({
          tunnel: expect.objectContaining({
            local_host: "127.0.0.1",
            local_port: 3000,
          }),
        }),
      }),
    );
  });
});
