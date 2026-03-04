import { describe, expect, it } from "vitest";
import type { EnhancedModelMetadata } from "@/lib/types/modelRegistry";
import {
  isReasoningModel,
  resolveBaseModelOnThinkingOff,
  resolveThinkingModel,
} from "./thinkingModelResolver";

function buildModel(
  id: string,
  options?: Partial<EnhancedModelMetadata>,
): EnhancedModelMetadata {
  return {
    id,
    display_name: id,
    provider_id: "openai",
    provider_name: "OpenAI",
    family: null,
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
    release_date: null,
    is_latest: false,
    description: null,
    source: "custom",
    created_at: 0,
    updated_at: 0,
    ...options,
  };
}

describe("thinkingModelResolver", () => {
  it("开启思考时应切换到同基座 reasoning 变体", () => {
    const models = [
      buildModel("gpt-5.3-codex"),
      buildModel("gpt-5.3-codex-thinking", {
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

    const result = resolveThinkingModel({
      currentModelId: "gpt-5.3-codex",
      models,
    });

    expect(result.reason).toBe("matched");
    expect(result.switched).toBe(true);
    expect(result.targetModelId).toBe("gpt-5.3-codex-thinking");
  });

  it("开启思考时若当前已是 reasoning 模型则保持不变", () => {
    const models = [
      buildModel("gpt-5.3-codex-thinking", {
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

    const result = resolveThinkingModel({
      currentModelId: "gpt-5.3-codex-thinking",
      models,
    });

    expect(result.reason).toBe("already_reasoning");
    expect(result.switched).toBe(false);
    expect(result.targetModelId).toBe("gpt-5.3-codex-thinking");
  });

  it("开启思考时若无同 Provider 变体应返回 no_variant", () => {
    const models = [buildModel("gpt-5.3-codex"), buildModel("gpt-4.1")];
    const result = resolveThinkingModel({
      currentModelId: "gpt-5.3-codex",
      models,
    });
    expect(result.reason).toBe("no_variant");
    expect(result.switched).toBe(false);
    expect(result.targetModelId).toBe("gpt-5.3-codex");
  });

  it("关闭思考时应优先恢复记忆的 base model", () => {
    const models = [
      buildModel("gpt-5.3-codex"),
      buildModel("gpt-5.3-codex-thinking", {
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

    const result = resolveBaseModelOnThinkingOff({
      currentModelId: "gpt-5.3-codex-thinking",
      models,
      rememberedBaseModel: "gpt-5.3-codex",
    });

    expect(result.reason).toBe("restored_base");
    expect(result.switched).toBe(true);
    expect(result.targetModelId).toBe("gpt-5.3-codex");
  });

  it("isReasoningModel 在无元数据时仍能基于模型名识别", () => {
    expect(isReasoningModel("my-custom-thinking-model", [])).toBe(true);
    expect(isReasoningModel("my-custom-model", [])).toBe(false);
  });
});
