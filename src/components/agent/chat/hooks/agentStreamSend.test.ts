import { describe, expect, it, vi } from "vitest";

vi.mock("./agentStreamUserInputSendPreparation", () => ({
  prepareAgentStreamUserInputSend: vi.fn(),
}));

vi.mock("./agentStreamPreparedSendDispatch", () => ({
  dispatchPreparedAgentStreamSend: vi.fn(),
}));

import { dispatchPreparedAgentStreamSend } from "./agentStreamPreparedSendDispatch";
import { prepareAgentStreamUserInputSend } from "./agentStreamUserInputSendPreparation";
import { sendAgentStreamMessage } from "./agentStreamSend";

describe("sendAgentStreamMessage", () => {
  it("应串起 prepare 与 dispatch", async () => {
    const env = { test: true } as never;
    const preparedSend = { prepared: true };
    vi.mocked(prepareAgentStreamUserInputSend).mockReturnValue(
      preparedSend as never,
    );

    await sendAgentStreamMessage({
      content: "继续执行",
      images: [],
      webSearch: true,
      thinking: true,
      executionStrategyOverride: "react",
      modelOverride: "gpt-5.4",
      systemPrompt: "system",
      env,
    });

    expect(prepareAgentStreamUserInputSend).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "继续执行",
        webSearch: true,
        thinking: true,
        systemPrompt: "system",
        env,
      }),
    );
    expect(dispatchPreparedAgentStreamSend).toHaveBeenCalledWith({
      preparedSend,
      env,
    });
  });
});
