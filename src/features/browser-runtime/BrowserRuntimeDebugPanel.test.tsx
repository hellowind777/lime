import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRuntimeDebugPanel } from "./BrowserRuntimeDebugPanel";

const { mockUseBrowserRuntimeDebug } = vi.hoisted(() => ({
  mockUseBrowserRuntimeDebug: vi.fn(),
}));

const defaultRuntimeState = {
  selectedSession: null,
  selectedProfileKey: "general_browser_assist",
  setSelectedProfileKey: vi.fn(),
  selectedTargetId: "",
  setSelectedTargetId: vi.fn(),
  targets: [],
  sessionState: null,
  latestFrame: null,
  latestFrameMetadata: null,
  consoleEvents: [],
  networkEvents: [],
  loadingTargets: false,
  openingSession: false,
  streaming: false,
  refreshingState: false,
  controlBusy: false,
  lifecycleState: null,
  isHumanControlling: false,
  isWaitingForHuman: false,
  isAgentResuming: false,
  canDirectControl: false,
  refreshTargets: vi.fn(async () => undefined),
  openSession: vi.fn(async () => undefined),
  startStream: vi.fn(async () => undefined),
  stopStream: vi.fn(async () => undefined),
  closeSession: vi.fn(async () => undefined),
  refreshSessionState: vi.fn(async () => undefined),
  takeOverSession: vi.fn(async () => undefined),
  releaseSession: vi.fn(async () => undefined),
  resumeSession: vi.fn(async () => undefined),
  clickAt: vi.fn(async () => undefined),
  scrollPage: vi.fn(async () => undefined),
  typeIntoFocusedElement: vi.fn(async () => undefined),
};

vi.mock("./useBrowserRuntimeDebug", () => ({
  useBrowserRuntimeDebug: mockUseBrowserRuntimeDebug,
}));

vi.mock("./api", () => ({
  browserRuntimeApi: {
    openBrowserRuntimeDebuggerWindow: vi.fn(async () => undefined),
    reopenProfileWindow: vi.fn(async () => undefined),
  },
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockUseBrowserRuntimeDebug.mockReturnValue({
    ...defaultRuntimeState,
  });
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

async function renderPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  await act(async () => {
    root.render(
      <BrowserRuntimeDebugPanel
        sessions={[]}
        initialProfileKey="general_browser_assist"
        initialSessionId="browser-session-1"
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

describe("BrowserRuntimeDebugPanel", () => {
  it("存在初始附着会话时不应因空 session 列表而退回占位提示", async () => {
    const container = await renderPanel();
    expect(container.textContent).toContain("浏览器实时会话");
    expect(container.textContent).toContain("正在连接浏览器会话");
    expect(container.textContent).not.toContain(
      "还没有运行中的独立 Chrome Profile",
    );
  });

  it("启动浏览器时应展示明确的加载提示", async () => {
    mockUseBrowserRuntimeDebug.mockReturnValue({
      ...defaultRuntimeState,
      openingSession: true,
      refreshingState: false,
    });

    const container = await renderPanel();

    expect(container.textContent).toContain("正在启动 Chrome、连接调试通道");
    expect(container.textContent).toContain("通常需要 3–8 秒");
  });
});
