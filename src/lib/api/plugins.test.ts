import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import {
  cancelPluginTask,
  disablePlugin,
  enablePlugin,
  getPluginQueueStats,
  getPluginStatus,
  getPlugins,
  getPluginTask,
  listenPluginInstallProgress,
  listenPluginTaskEvent,
  listInstalledPlugins,
  listPluginTasks,
  reloadPlugins,
  uninstallPlugin,
  unloadPlugin,
} from "./plugins";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));

describe("plugins API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应获取插件运行态数据", async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce([{ name: "demo" }])
      .mockResolvedValueOnce([{ id: "plugin-1" }])
      .mockResolvedValueOnce([{ taskId: "task-1" }])
      .mockResolvedValueOnce([{ pluginId: "plugin-1", running: 1 }])
      .mockResolvedValueOnce({ taskId: "task-1" });

    await expect(getPluginStatus<{ enabled: boolean }>()).resolves.toEqual({
      enabled: true,
    });
    await expect(getPlugins<{ name: string }>()).resolves.toEqual([
      { name: "demo" },
    ]);
    await expect(listInstalledPlugins<{ id: string }>()).resolves.toEqual([
      { id: "plugin-1" },
    ]);
    await expect(
      listPluginTasks<{ taskId: string }>({ taskState: "running", limit: 100 }),
    ).resolves.toEqual([{ taskId: "task-1" }]);
    await expect(
      getPluginQueueStats<{ pluginId: string; running: number }>(),
    ).resolves.toEqual([{ pluginId: "plugin-1", running: 1 }]);
    await expect(getPluginTask<{ taskId: string }>("task-1")).resolves.toEqual({
      taskId: "task-1",
    });
  });

  it("应代理插件管理写操作", async () => {
    vi.mocked(safeInvoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(enablePlugin("demo")).resolves.toBeUndefined();
    await expect(disablePlugin("demo")).resolves.toBeUndefined();
    await expect(reloadPlugins()).resolves.toBeUndefined();
    await expect(unloadPlugin("demo")).resolves.toBeUndefined();
    await expect(uninstallPlugin("plugin-1")).resolves.toBe(true);
    await expect(cancelPluginTask("task-1")).resolves.toBe(true);
  });

  it("应代理插件事件监听", async () => {
    vi.mocked(safeListen)
      .mockImplementationOnce(async (_event, handler) => {
        handler({
          payload: {
            stage: "downloading",
            percent: 42,
            message: "下载中",
          },
        });
        return vi.fn();
      })
      .mockImplementationOnce(async (_event, handler) => {
        handler({ payload: undefined });
        return vi.fn();
      });

    const progressListener = vi.fn();
    const taskListener = vi.fn();

    await listenPluginInstallProgress(progressListener);
    await listenPluginTaskEvent(taskListener);

    expect(progressListener).toHaveBeenCalledWith({
      stage: "downloading",
      percent: 42,
      message: "下载中",
    });
    expect(taskListener).toHaveBeenCalledTimes(1);
  });
});
