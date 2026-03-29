/* eslint-disable no-restricted-syntax -- 测试底层 invoke 机制，需要直接使用命令名 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  baseInvoke: vi.fn(),
  baseListen: vi.fn(),
  baseEmit: vi.fn(),
  listenViaHttpEvent: vi.fn(),
  hasDevBridgeEventListenerCapability: vi.fn(),
  invokeViaHttp: vi.fn(),
  isDevBridgeAvailable: vi.fn(),
  normalizeDevBridgeError: vi.fn((cmd: string, error: unknown) => {
    if (error instanceof Error) {
      return new Error(`[${cmd}] ${error.message}`);
    }
    return new Error(`[${cmd}] ${String(error)}`);
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.baseInvoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.baseListen,
  emit: mocks.baseEmit,
}));

vi.mock("./http-client", () => ({
  hasDevBridgeEventListenerCapability:
    mocks.hasDevBridgeEventListenerCapability,
  invokeViaHttp: mocks.invokeViaHttp,
  isDevBridgeAvailable: mocks.isDevBridgeAvailable,
  listenViaHttpEvent: mocks.listenViaHttpEvent,
  normalizeDevBridgeError: mocks.normalizeDevBridgeError,
}));

vi.mock("./mockPriorityCommands", () => ({
  shouldPreferMockInBrowser: vi.fn(() => false),
}));

import {
  clearInvokeErrorBuffer,
  clearInvokeTraceBuffer,
  getInvokeErrorBuffer,
  getInvokeTraceBuffer,
  safeListen,
  safeInvoke,
} from "./safeInvoke";
import { shouldPreferMockInBrowser } from "./mockPriorityCommands";

describe("safeInvoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDevBridgeAvailable.mockReturnValue(true);
    mocks.hasDevBridgeEventListenerCapability.mockReturnValue(false);
    window.localStorage.clear();
    clearInvokeErrorBuffer();
    clearInvokeTraceBuffer();
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
  });

  it("浏览器开发模式下优先走 HTTP bridge", async () => {
    mocks.invokeViaHttp.mockResolvedValueOnce({ ok: true });

    const result = await safeInvoke("workspace_list");

    expect(result).toEqual({ ok: true });
    expect(mocks.invokeViaHttp).toHaveBeenCalledWith("workspace_list", undefined);
    expect(mocks.baseInvoke).not.toHaveBeenCalled();

    expect(getInvokeTraceBuffer()).toEqual([
      expect.objectContaining({
        command: "workspace_list",
        transport: "http-bridge",
        status: "success",
      }),
    ]);
  });

  it("HTTP bridge 失败时会回退到 mock/baseInvoke", async () => {
    mocks.invokeViaHttp.mockRejectedValueOnce(new Error("Failed to fetch"));
    mocks.baseInvoke.mockResolvedValueOnce(["mocked"]);

    await expect(safeInvoke("workspace_list")).resolves.toEqual(["mocked"]);

    expect(mocks.normalizeDevBridgeError).toHaveBeenCalled();
    expect(mocks.baseInvoke).toHaveBeenCalledWith("workspace_list", undefined);

    expect(getInvokeErrorBuffer()).toEqual([
      expect.objectContaining({
        command: "workspace_list",
        transport: "http-bridge",
      }),
    ]);
    expect(getInvokeTraceBuffer()).toEqual([
      expect.objectContaining({
        command: "workspace_list",
        transport: "http-bridge",
        status: "error",
      }),
      expect.objectContaining({
        command: "workspace_list",
        transport: "fallback-invoke",
        status: "success",
      }),
    ]);
  });

  it("mock 优先命令会直接走 fallback invoke", async () => {
    vi.mocked(shouldPreferMockInBrowser).mockReturnValueOnce(true);
    mocks.baseInvoke.mockResolvedValueOnce(["mock-first"]);

    await expect(safeInvoke("list_plugin_tasks")).resolves.toEqual(["mock-first"]);

    expect(mocks.invokeViaHttp).not.toHaveBeenCalled();
    expect(mocks.baseInvoke).toHaveBeenCalledWith("list_plugin_tasks", undefined);
  });

  it("HTTP bridge 与 mock 都失败时抛出 bridge 错误", async () => {
    mocks.invokeViaHttp.mockRejectedValueOnce(new Error("Failed to fetch"));
    mocks.baseInvoke.mockRejectedValueOnce(new Error("mock failed"));

    await expect(safeInvoke("workspace_list")).rejects.toThrow(
      "[workspace_list] Failed to fetch",
    );
  });

  it("事件 internals 已就绪时 safeListen 走原生 event API", async () => {
    const unlisten = vi.fn();
    (window as any).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
      transformCallback: vi.fn(),
    };
    mocks.baseListen.mockResolvedValueOnce(unlisten);

    await expect(safeListen("config-changed", vi.fn())).resolves.toBe(unlisten);
    expect(mocks.baseListen).toHaveBeenCalledWith(
      "config-changed",
      expect.any(Function),
    );
  });

  it("浏览器开发模式下 safeListen 优先走 HTTP 事件桥", async () => {
    const unlisten = vi.fn();
    mocks.hasDevBridgeEventListenerCapability.mockReturnValue(true);
    mocks.listenViaHttpEvent.mockResolvedValueOnce(unlisten);

    await expect(safeListen("config-changed", vi.fn())).resolves.toBe(unlisten);

    expect(mocks.listenViaHttpEvent).toHaveBeenCalledWith(
      "config-changed",
      expect.any(Function),
    );
    expect(mocks.baseListen).not.toHaveBeenCalled();
  });

  it("Tauri 运行时存在但事件桥缺失时 safeListen 返回空清理函数", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    vi.useFakeTimers();
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.fn(),
      },
    };

    try {
      const promise = safeListen("config-changed", vi.fn());
      await vi.advanceTimersByTimeAsync(3000);
      const unlisten = await promise;

      expect(typeof unlisten).toBe("function");
      expect(mocks.baseListen).not.toHaveBeenCalled();
    } finally {
      consoleWarnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("事件桥调用异常时 safeListen 降级为空清理函数", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    (window as any).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
      transformCallback: vi.fn(),
    };
    mocks.baseListen.mockRejectedValueOnce(
      new TypeError(
        "Cannot read properties of undefined (reading 'transformCallback')",
      ),
    );

    try {
      const unlisten = await safeListen("plugin-task-event", vi.fn());

      expect(typeof unlisten).toBe("function");
      expect(mocks.baseListen).toHaveBeenCalledWith(
        "plugin-task-event",
        expect.any(Function),
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });
});
