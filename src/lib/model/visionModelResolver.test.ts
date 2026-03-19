import { describe, expect, it } from "vitest";
import type { EnhancedModelMetadata } from "@/lib/types/modelRegistry";
import { resolveVisionModel } from "./visionModelResolver";

function createModel(
  id: string,
  overrides: Partial<EnhancedModelMetadata> = {},
): EnhancedModelMetadata {
  return {
    id,
    display_name: id,
    provider_id: "zhipuai",
    provider_name: "Zhipu AI",
    family: id,
    tier: "pro",
    capabilities: {
      vision: false,
      tools: true,
      streaming: true,
      json_mode: true,
      function_calling: true,
      reasoning: false,
    },
    pricing: null,
    limits: {
      context_length: null,
      max_output_tokens: null,
      requests_per_minute: null,
      tokens_per_minute: null,
    },
    status: "active",
    release_date: "2026-01-01",
    is_latest: false,
    description: null,
    source: "local",
    created_at: 0,
    updated_at: 0,
    ...overrides,
  };
}

describe("resolveVisionModel", () => {
  it("当前模型已支持视觉时应保持不变", () => {
    const models = [
      createModel("glm-4.6v-flash", {
        capabilities: {
          vision: true,
          tools: true,
          streaming: true,
          json_mode: true,
          function_calling: true,
          reasoning: false,
        },
      }),
    ];

    const result = resolveVisionModel({
      currentModelId: "glm-4.6v-flash",
      models,
    });

    expect(result).toEqual({
      targetModelId: "glm-4.6v-flash",
      switched: false,
      reason: "already_vision",
    });
  });

  it("当前模型未收录但模型名可推断支持视觉时应保持不变", () => {
    const models = [
      createModel("gpt-5.3-codex", {
        provider_id: "codex",
        provider_name: "Codex",
        capabilities: {
          vision: true,
          tools: true,
          streaming: true,
          json_mode: true,
          function_calling: true,
          reasoning: true,
        },
      }),
    ];

    const result = resolveVisionModel({
      currentModelId: "gpt-5.4",
      models,
    });

    expect(result).toEqual({
      targetModelId: "gpt-5.4",
      switched: false,
      reason: "already_vision",
    });
  });

  it("应优先选择支持视觉的聊天模型，而不是纯生图模型", () => {
    const models = [
      createModel("gemini-3-pro-image-preview", {
        family: "gemini-3-pro-image",
        capabilities: {
          vision: true,
          tools: false,
          streaming: true,
          json_mode: false,
          function_calling: false,
          reasoning: false,
        },
        description: "image generation model",
        is_latest: true,
      }),
      createModel("glm-4.6v-flash", {
        family: "glm-4.6v",
        tier: "mini",
        capabilities: {
          vision: true,
          tools: true,
          streaming: true,
          json_mode: true,
          function_calling: true,
          reasoning: false,
        },
        release_date: "2026-02-01",
        is_latest: true,
      }),
      createModel("glm-4.7", {
        family: "glm-4.7",
        capabilities: {
          vision: false,
          tools: true,
          streaming: true,
          json_mode: true,
          function_calling: true,
          reasoning: true,
        },
      }),
    ];

    const result = resolveVisionModel({
      currentModelId: "glm-4.7",
      models,
    });

    expect(result.targetModelId).toBe("glm-4.6v-flash");
    expect(result.switched).toBe(true);
    expect(result.reason).toBe("fallback_latest");
  });

  it("没有可用视觉聊天模型时应返回 no_vision_model", () => {
    const models = [
      createModel("glm-4.7"),
      createModel("gemini-3-pro-image-preview", {
        capabilities: {
          vision: true,
          tools: false,
          streaming: true,
          json_mode: false,
          function_calling: false,
          reasoning: false,
        },
        description: "image generation model",
      }),
    ];

    const result = resolveVisionModel({
      currentModelId: "glm-4.7",
      models,
    });

    expect(result).toEqual({
      targetModelId: "glm-4.7",
      switched: false,
      reason: "no_vision_model",
    });
  });
});
