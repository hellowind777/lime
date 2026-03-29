import { beforeEach, describe, expect, it, vi } from "vitest";
import { listenAgentRuntimeEvent } from "@/lib/api/agentRuntimeEvents";
import { defaultAgentRuntimeAdapter } from "./agentRuntimeAdapter";

vi.mock("@/lib/api/agentRuntimeEvents", () => ({
  listenAgentRuntimeEvent: vi.fn(),
}));

vi.mock("@/lib/api/agentRuntime", () => ({
  initAsterAgent: vi.fn(),
  createAgentRuntimeSession: vi.fn(),
  listAgentRuntimeSessions: vi.fn(),
  getAgentRuntimeSession: vi.fn(),
  getAgentRuntimeThreadRead: vi.fn(),
  replayAgentRuntimeRequest: vi.fn(),
  updateAgentRuntimeSession: vi.fn(),
  deleteAgentRuntimeSession: vi.fn(),
  compactAgentRuntimeSession: vi.fn(),
  interruptAgentRuntimeTurn: vi.fn(),
  resumeAgentRuntimeThread: vi.fn(),
  promoteAgentRuntimeQueuedTurn: vi.fn(),
  removeAgentRuntimeQueuedTurn: vi.fn(),
  respondAgentRuntimeAction: vi.fn(),
  submitAgentRuntimeTurn: vi.fn(),
}));

describe("defaultAgentRuntimeAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应通过 agentRuntimeEvents 代理 turn 与 team 事件监听", async () => {
    const unlisten = vi.fn();
    vi.mocked(listenAgentRuntimeEvent).mockResolvedValue(unlisten);

    const handler = vi.fn();

    await expect(
      defaultAgentRuntimeAdapter.listenToTurnEvents("turn-event", handler),
    ).resolves.toBe(unlisten);
    await expect(
      defaultAgentRuntimeAdapter.listenToTeamEvents("team-event", handler),
    ).resolves.toBe(unlisten);

    expect(listenAgentRuntimeEvent).toHaveBeenNthCalledWith(
      1,
      "turn-event",
      handler,
    );
    expect(listenAgentRuntimeEvent).toHaveBeenNthCalledWith(
      2,
      "team-event",
      handler,
    );
  });
});
