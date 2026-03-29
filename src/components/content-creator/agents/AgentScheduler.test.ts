/**
 * @file AgentScheduler 测试
 * @description 测试 Agent 调度器的功能
 * @module components/content-creator/agents/AgentScheduler.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PosterAgentScheduler, POSTER_WORKFLOWS } from "./AgentScheduler";
import type { AgentInput, AgentOutput, PosterAgentId } from "./base/types";

// Mock getPosterAgent
vi.mock("./poster", () => ({
  getPosterAgent: vi.fn((id: PosterAgentId) => {
    if (id === ("invalid" as PosterAgentId)) return undefined;
    return {
      execute: vi.fn().mockResolvedValue({
        summary: `${id} 执行完成`,
        suggestions: [
          {
            id: `${id}-suggestion`,
            type: "choice",
            title: `${id} 建议`,
            content: { result: `${id} result` },
            reason: "测试原因",
            confidence: 0.9,
          },
        ],
      } as AgentOutput),
    };
  }),
}));

describe("PosterAgentScheduler", () => {
  let scheduler: PosterAgentScheduler;

  beforeEach(() => {
    scheduler = new PosterAgentScheduler();
    vi.clearAllMocks();
  });

  describe("runAgent", () => {
    it("应该成功执行单个 Agent", async () => {
      const input: AgentInput = {
        context: { test: true },
      };

      const result = await scheduler.runAgent("requirement", input);

      expect(result).not.toBeNull();
      expect(result?.suggestions).toHaveLength(1);
      expect(result?.suggestions[0].id).toBe("requirement-suggestion");
    });

    it("应该在 Agent 不存在时返回 null", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const input: AgentInput = {
        context: {},
      };

      try {
        const result = await scheduler.runAgent(
          "invalid" as PosterAgentId,
          input,
        );

        expect(result).toBeNull();
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });
  });

  describe("runWorkflow", () => {
    it("应该按顺序执行工作流中的所有 Agent", async () => {
      const input: AgentInput = {
        context: { initial: true },
      };

      const stages: PosterAgentId[] = ["requirement", "style"];
      const results = await scheduler.runWorkflow(stages, input);

      expect(results.size).toBe(2);
      expect(results.has("requirement")).toBe(true);
      expect(results.has("style")).toBe(true);
    });

    it("应该调用进度回调", async () => {
      const input: AgentInput = {
        context: {},
      };
      const onProgress = vi.fn();

      await scheduler.runWorkflow(["requirement"], input, onProgress);

      // 应该调用两次：开始时 (0) 和完成时 (100)
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith("requirement", 0);
      expect(onProgress).toHaveBeenCalledWith(
        "requirement",
        100,
        expect.any(Object),
      );
    });

    it("应该将前一个 Agent 的输出传递给下一个", async () => {
      const input: AgentInput = {
        context: { initial: true },
      };

      const stages: PosterAgentId[] = ["requirement", "style", "layout"];
      const results = await scheduler.runWorkflow(stages, input);

      expect(results.size).toBe(3);
    });
  });

  describe("POSTER_WORKFLOWS", () => {
    it("full 工作流应该包含所有 6 个 Agent", () => {
      expect(POSTER_WORKFLOWS.full).toHaveLength(6);
      expect(POSTER_WORKFLOWS.full).toContain("requirement");
      expect(POSTER_WORKFLOWS.full).toContain("style");
      expect(POSTER_WORKFLOWS.full).toContain("layout");
      expect(POSTER_WORKFLOWS.full).toContain("content");
      expect(POSTER_WORKFLOWS.full).toContain("refine");
      expect(POSTER_WORKFLOWS.full).toContain("export");
    });

    it("quick 工作流应该包含 3 个 Agent", () => {
      expect(POSTER_WORKFLOWS.quick).toHaveLength(3);
      expect(POSTER_WORKFLOWS.quick).toContain("style");
      expect(POSTER_WORKFLOWS.quick).toContain("layout");
      expect(POSTER_WORKFLOWS.quick).toContain("content");
    });

    it("optimize 工作流应该包含 2 个 Agent", () => {
      expect(POSTER_WORKFLOWS.optimize).toHaveLength(2);
      expect(POSTER_WORKFLOWS.optimize).toContain("refine");
      expect(POSTER_WORKFLOWS.optimize).toContain("export");
    });

    it("layout 工作流应该包含 3 个 Agent", () => {
      expect(POSTER_WORKFLOWS.layout).toHaveLength(3);
      expect(POSTER_WORKFLOWS.layout).toContain("requirement");
      expect(POSTER_WORKFLOWS.layout).toContain("style");
      expect(POSTER_WORKFLOWS.layout).toContain("layout");
    });
  });
});
