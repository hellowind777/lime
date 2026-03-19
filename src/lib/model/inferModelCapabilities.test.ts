import { describe, expect, it } from "vitest";
import {
  inferModelCapabilities,
  inferVisionCapability,
} from "./inferModelCapabilities";

describe("inferModelCapabilities", () => {
  it("应将 gpt-5.4 识别为支持视觉的模型", () => {
    expect(
      inferVisionCapability({
        modelId: "gpt-5.4",
        providerId: "codex",
      }),
    ).toBe(true);
  });

  it("应避免将生图模型误判为视觉聊天模型", () => {
    expect(
      inferVisionCapability({
        modelId: "gemini-3-pro-image-preview",
        providerId: "gemini",
      }),
    ).toBe(false);
  });

  it("应保留 thinking 模型的推理能力推断", () => {
    expect(
      inferModelCapabilities({
        modelId: "gpt-5.4-thinking",
        providerId: "openai",
      }),
    ).toMatchObject({
      vision: true,
      reasoning: true,
      tools: true,
      streaming: true,
      json_mode: true,
      function_calling: true,
    });
  });
});
