import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCrashDiagnosticPayload,
  buildCrashDiagnosticFileName,
  buildCrashDiagnosticClipboardText,
  copyCrashDiagnosticJsonToClipboard,
  copyCrashDiagnosticToClipboard,
  detectDesktopPlatform,
  getClipboardPermissionGuide,
  sanitizeDiagnosticSceneTag,
} from "./crashDiagnostic";
import { clearInvokeTraceBuffer } from "./dev-bridge/safeInvoke";
import {
  clearWorkspaceRepairHistory,
  recordWorkspaceRepair,
} from "./workspaceHealthTelemetry";

const payload = {
  generated_at: "2026-03-02T00:00:00.000Z",
  app_version: "0.76.0",
  platform: "MacIntel",
  user_agent: "ProxyCast-Test",
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
  page_url: "tauri://localhost/settings",
  runtime: "tauri" as const,
  crash_reporting: {
    enabled: true,
    dsn: null,
    environment: "production",
    sample_rate: 1,
    send_pii: false,
  },
  frontend_crash_logs: [],
};

describe("copyCrashDiagnosticToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearWorkspaceRepairHistory();
    clearInvokeTraceBuffer();
  });

  it("应支持复制纯 JSON", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await copyCrashDiagnosticJsonToClipboard(payload);

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
  });

  it("优先使用 navigator.clipboard 写入", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await copyCrashDiagnosticToClipboard(payload);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(
      buildCrashDiagnosticClipboardText(payload),
    );
  });

  it("clipboard API 失败时回退 execCommand", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
        ),
      );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await copyCrashDiagnosticToClipboard(payload);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("全部复制方案失败时返回中文可操作错误", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new Error("NotAllowedError: denied permission"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const execCommand = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await expect(copyCrashDiagnosticToClipboard(payload)).rejects.toThrow(
      "剪贴板权限被系统拒绝，请允许权限后重试，或使用“导出诊断 JSON”",
    );
  });
});

describe("clipboard permission guide", () => {
  it("应正确识别平台", () => {
    expect(detectDesktopPlatform("MacIntel", "")).toBe("macos");
    expect(detectDesktopPlatform("Win32", "")).toBe("windows");
    expect(detectDesktopPlatform("Linux x86_64", "")).toBe("linux");
  });

  it("应返回分系统引导文案", () => {
    const macGuide = getClipboardPermissionGuide("MacIntel", "");
    expect(macGuide.title).toContain("macOS");
    expect(macGuide.steps.length).toBeGreaterThan(0);
    expect(macGuide.settingsUrl).toContain("x-apple.systempreferences");

    const windowsGuide = getClipboardPermissionGuide("Win32", "");
    expect(windowsGuide.title).toContain("Windows");
    expect(windowsGuide.settingsUrl).toBe("ms-settings:clipboard");
  });
});

describe("diagnostic clipboard text", () => {
  it("应包含提示词和 JSON 诊断数据", () => {
    const text = buildCrashDiagnosticClipboardText(payload);
    expect(text).toContain("ProxyCast 故障诊断请求");
    expect(text).toContain("自动摘要");
    expect(text).toContain("你的任务");
    expect(text).toContain("诊断数据（JSON）");
    expect(text).toContain('"platform": "MacIntel"');
  });
});

describe("diagnostic export file name", () => {
  it("应支持场景标签并生成稳定文件名", () => {
    const fileName = buildCrashDiagnosticFileName(payload, {
      sceneTag: "Workspace Path Missing",
      timestamp: new Date("2026-03-02T08:09:10.000Z").getTime(),
    });

    expect(fileName).toContain("proxycast-crash-workspace-path-missing");
    expect(fileName).toContain("v-0-76-0");
    expect(fileName).toContain("20260302-");
    expect(fileName.endsWith(".json")).toBe(true);
  });

  it("应对场景标签做安全清洗", () => {
    expect(sanitizeDiagnosticSceneTag("  Crash@Recovery/中文  ")).toBe(
      "crash-recovery",
    );
    expect(sanitizeDiagnosticSceneTag("___")).toBeUndefined();
  });
});

describe("buildCrashDiagnosticPayload", () => {
  afterEach(() => {
    clearWorkspaceRepairHistory();
    clearInvokeTraceBuffer();
  });

  it("应注入 workspace 自动修复记录", () => {
    recordWorkspaceRepair({
      workspaceId: "ws-001",
      rootPath: "/tmp/ws-001",
      source: "workspace_refresh",
    });

    const diagnostic = buildCrashDiagnosticPayload({
      crashConfig: payload.crash_reporting,
      logs: payload.frontend_crash_logs,
      appVersion: payload.app_version,
      platform: payload.platform,
      userAgent: payload.user_agent,
    });

    expect(diagnostic.workspace_repair_history?.length).toBe(1);
    expect(diagnostic.workspace_repair_history?.[0].workspace_id).toBe(
      "ws-001",
    );
    expect(diagnostic.workspace_repair_history?.[0].source).toBe(
      "workspace_refresh",
    );
  });

  it("摘要应包含最近调用轨迹条数", () => {
    window.localStorage.setItem(
      "proxycast_invoke_trace_buffer_v1",
      JSON.stringify([
        {
          timestamp: "2026-03-09T01:02:03.000Z",
          command: "get_config",
          transport: "tauri-ipc",
          status: "success",
          duration_ms: 12,
        },
      ]),
    );

    const diagnostic = buildCrashDiagnosticPayload({
      crashConfig: payload.crash_reporting,
      logs: payload.frontend_crash_logs,
      appVersion: payload.app_version,
      platform: payload.platform,
      userAgent: payload.user_agent,
    });

    const text = buildCrashDiagnosticClipboardText(diagnostic);
    expect(diagnostic.invoke_trace_buffer?.length).toBe(1);
    expect(text).toContain("最近调用轨迹条数：1");
  });
});
