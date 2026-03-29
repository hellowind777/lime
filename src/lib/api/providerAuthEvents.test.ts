import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeListen } from "@/lib/dev-bridge";
import {
  onAntigravityAuthUrl,
  onClaudeOAuthAuthUrl,
  onCodexAuthUrl,
  onGeminiAuthUrl,
} from "./providerAuthEvents";

vi.mock("@/lib/dev-bridge", () => ({
  safeListen: vi.fn(),
}));

describe("providerAuthEvents API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应代理各 Provider OAuth 授权 URL 事件", async () => {
    vi.mocked(safeListen)
      .mockImplementationOnce(async (_event, handler) => {
        handler({ payload: { auth_url: "https://anti.example/auth" } });
        return vi.fn();
      })
      .mockImplementationOnce(async (_event, handler) => {
        handler({ payload: { auth_url: "https://claude.example/auth" } });
        return vi.fn();
      })
      .mockImplementationOnce(async (_event, handler) => {
        handler({ payload: { auth_url: "https://codex.example/auth" } });
        return vi.fn();
      })
      .mockImplementationOnce(async (_event, handler) => {
        handler({
          payload: {
            auth_url: "https://gemini.example/auth",
            session_id: "session-1",
          },
        });
        return vi.fn();
      });

    const antiListener = vi.fn();
    const claudeListener = vi.fn();
    const codexListener = vi.fn();
    const geminiListener = vi.fn();

    await onAntigravityAuthUrl(antiListener);
    await onClaudeOAuthAuthUrl(claudeListener);
    await onCodexAuthUrl(codexListener);
    await onGeminiAuthUrl(geminiListener);

    expect(antiListener).toHaveBeenCalledWith({
      auth_url: "https://anti.example/auth",
    });
    expect(claudeListener).toHaveBeenCalledWith({
      auth_url: "https://claude.example/auth",
    });
    expect(codexListener).toHaveBeenCalledWith({
      auth_url: "https://codex.example/auth",
    });
    expect(geminiListener).toHaveBeenCalledWith({
      auth_url: "https://gemini.example/auth",
      session_id: "session-1",
    });
  });
});
