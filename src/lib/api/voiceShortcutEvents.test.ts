import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeListen } from "@/lib/dev-bridge";
import {
  onVoiceStartRecording,
  onVoiceStopRecording,
} from "./voiceShortcutEvents";

vi.mock("@/lib/dev-bridge", () => ({
  safeListen: vi.fn(),
}));

describe("voiceShortcutEvents API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应代理开始与停止录音事件", async () => {
    vi.mocked(safeListen)
      .mockImplementationOnce(async (_event, handler) => {
        handler({ payload: undefined });
        return vi.fn();
      })
      .mockImplementationOnce(async (_event, handler) => {
        handler({ payload: undefined });
        return vi.fn();
      });

    const onStart = vi.fn();
    const onStop = vi.fn();

    await onVoiceStartRecording(onStart);
    await onVoiceStopRecording(onStop);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
