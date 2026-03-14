import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseComponentDebug } = vi.hoisted(() => ({
  mockUseComponentDebug: vi.fn(),
}));

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
}));

const { mockGetLogs, mockGetPersistedLogsTail } = vi.hoisted(() => ({
  mockGetLogs: vi.fn(),
  mockGetPersistedLogsTail: vi.fn(),
}));

const {
  mockGetServerDiagnostics,
  mockGetLogStorageDiagnostics,
  mockGetWindowsStartupDiagnostics,
} = vi.hoisted(() => ({
  mockGetServerDiagnostics: vi.fn(),
  mockGetLogStorageDiagnostics: vi.fn(),
  mockGetWindowsStartupDiagnostics: vi.fn(),
}));

const {
  mockBuildCrashDiagnosticPayload,
  mockClearCrashDiagnosticHistory,
  mockCollectRuntimeSnapshotForDiagnostic,
  mockCollectThemeWorkbenchDocumentStateForDiagnostic,
  mockCopyCrashDiagnosticJsonToClipboard,
  mockCopyCrashDiagnosticToClipboard,
  mockExportCrashDiagnosticToJson,
  mockIsClipboardPermissionDeniedError,
  mockNormalizeCrashReportingConfig,
  mockOpenCrashDiagnosticDownloadDirectory,
} = vi.hoisted(() => ({
  mockBuildCrashDiagnosticPayload: vi.fn(),
  mockClearCrashDiagnosticHistory: vi.fn(),
  mockCollectRuntimeSnapshotForDiagnostic: vi.fn(),
  mockCollectThemeWorkbenchDocumentStateForDiagnostic: vi.fn(),
  mockCopyCrashDiagnosticJsonToClipboard: vi.fn(),
  mockCopyCrashDiagnosticToClipboard: vi.fn(),
  mockExportCrashDiagnosticToJson: vi.fn(),
  mockIsClipboardPermissionDeniedError: vi.fn(),
  mockNormalizeCrashReportingConfig: vi.fn(),
  mockOpenCrashDiagnosticDownloadDirectory: vi.fn(),
}));

vi.mock("@/contexts/ComponentDebugContext", () => ({
  useComponentDebug: mockUseComponentDebug,
}));

vi.mock("@/lib/api/appConfig", () => ({
  getConfig: mockGetConfig,
}));

vi.mock("@/lib/api/logs", () => ({
  getLogs: mockGetLogs,
  getPersistedLogsTail: mockGetPersistedLogsTail,
}));

vi.mock("@/lib/api/serverRuntime", () => ({
  getServerDiagnostics: mockGetServerDiagnostics,
  getLogStorageDiagnostics: mockGetLogStorageDiagnostics,
  getWindowsStartupDiagnostics: mockGetWindowsStartupDiagnostics,
}));

vi.mock("@/lib/crashDiagnostic", () => ({
  buildCrashDiagnosticPayload: mockBuildCrashDiagnosticPayload,
  clearCrashDiagnosticHistory: mockClearCrashDiagnosticHistory,
  collectRuntimeSnapshotForDiagnostic: mockCollectRuntimeSnapshotForDiagnostic,
  collectThemeWorkbenchDocumentStateForDiagnostic:
    mockCollectThemeWorkbenchDocumentStateForDiagnostic,
  CLEAR_CRASH_DIAGNOSTIC_HISTORY_CONFIRM_TEXT: "确认清空诊断信息？",
  copyCrashDiagnosticJsonToClipboard: mockCopyCrashDiagnosticJsonToClipboard,
  copyCrashDiagnosticToClipboard: mockCopyCrashDiagnosticToClipboard,
  exportCrashDiagnosticToJson: mockExportCrashDiagnosticToJson,
  isClipboardPermissionDeniedError: mockIsClipboardPermissionDeniedError,
  normalizeCrashReportingConfig: mockNormalizeCrashReportingConfig,
  openCrashDiagnosticDownloadDirectory: mockOpenCrashDiagnosticDownloadDirectory,
}));

vi.mock("../shared/ClipboardPermissionGuideCard", () => ({
  ClipboardPermissionGuideCard: () => <div>剪贴板权限卡片占位</div>,
}));

vi.mock("../shared/WorkspaceRepairHistoryCard", () => ({
  WorkspaceRepairHistoryCard: () => <div>自愈记录卡片占位</div>,
}));

import { DeveloperSettings } from ".";

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
    root.render(<DeveloperSettings />);
  });

  mounted.push({ container, root });
  return container;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
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

  mockUseComponentDebug.mockReturnValue({
    enabled: false,
    setEnabled: vi.fn(),
    componentInfo: null,
    showComponentInfo: vi.fn(),
    hideComponentInfo: vi.fn(),
  });

  mockGetConfig.mockResolvedValue({
    crash_reporting: {
      enabled: true,
      dsn: null,
      environment: "production",
      sample_rate: 1,
      send_pii: false,
    },
  });
  mockGetLogs.mockResolvedValue([{ level: "error", message: "boom" }]);
  mockGetPersistedLogsTail.mockResolvedValue([{ level: "info", message: "ok" }]);
  mockGetServerDiagnostics.mockResolvedValue({ ok: true });
  mockGetLogStorageDiagnostics.mockResolvedValue({ ok: true });
  mockGetWindowsStartupDiagnostics.mockResolvedValue({ ok: true });

  mockCollectRuntimeSnapshotForDiagnostic.mockResolvedValue({
    runtimeSnapshot: { summary: "runtime" },
    collectionNotes: ["note-a"],
  });
  mockCollectThemeWorkbenchDocumentStateForDiagnostic.mockResolvedValue({
    documentId: "doc-1",
  });
  mockNormalizeCrashReportingConfig.mockImplementation((config) => config);
  mockBuildCrashDiagnosticPayload.mockReturnValue({ payload: "diagnostic" });
  mockCopyCrashDiagnosticToClipboard.mockResolvedValue(undefined);
  mockCopyCrashDiagnosticJsonToClipboard.mockResolvedValue(undefined);
  mockExportCrashDiagnosticToJson.mockReturnValue({
    fileName: "diagnostic.json",
    locationHint: "/tmp",
  });
  mockOpenCrashDiagnosticDownloadDirectory.mockResolvedValue({
    openedPath: "/tmp",
  });
  mockClearCrashDiagnosticHistory.mockResolvedValue(undefined);
  mockIsClipboardPermissionDeniedError.mockReturnValue(false);
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

describe("DeveloperSettings", () => {
  it("应渲染新的开发者工作台与主要分区", () => {
    const container = renderComponent();

    const text = container.textContent ?? "";
    expect(text).toContain("DEVELOPER DESK");
    expect(text).toContain("组件视图调试");
    expect(text).toContain("崩溃诊断日志（开发协作）");
    expect(text).toContain("诊断建议");
    expect(text).toContain("动作清单");
    expect(text).toContain("自愈记录卡片占位");
  });

  it("切换组件调试开关后应调用 setEnabled", async () => {
    const setEnabled = vi.fn();
    mockUseComponentDebug.mockReturnValue({
      enabled: false,
      setEnabled,
      componentInfo: null,
      showComponentInfo: vi.fn(),
      hideComponentInfo: vi.fn(),
    });

    const container = renderComponent();
    await clickButton(findSwitch(container, "切换组件视图调试"));

    expect(setEnabled).toHaveBeenCalledTimes(1);
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("点击复制诊断信息后应构建并复制诊断载荷", async () => {
    const container = renderComponent();

    await clickButton(findButton(container, "复制诊断信息"));
    await flushEffects();

    expect(mockCollectRuntimeSnapshotForDiagnostic).toHaveBeenCalledTimes(1);
    expect(mockBuildCrashDiagnosticPayload).toHaveBeenCalledTimes(1);
    expect(mockCopyCrashDiagnosticToClipboard).toHaveBeenCalledWith({
      payload: "diagnostic",
    });
    expect(container.textContent).toContain("诊断信息已复制，可直接发给开发者");
  });

  it("复制诊断因剪贴板权限失败时应显示权限指引", async () => {
    mockCopyCrashDiagnosticToClipboard.mockRejectedValueOnce(
      new Error("clipboard denied"),
    );
    mockIsClipboardPermissionDeniedError.mockReturnValue(true);

    const container = renderComponent();

    await clickButton(findButton(container, "复制诊断信息"));
    await flushEffects();

    expect(container.textContent).toContain("剪贴板权限卡片占位");
    expect(container.textContent).toContain("clipboard denied");
  });
});
