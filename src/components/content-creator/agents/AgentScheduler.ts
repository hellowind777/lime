/**
 * @file AgentScheduler.ts
 * @description Agent 调度器，协调多个 Agent 的执行
 * @module components/content-creator/agents/AgentScheduler
 */

import { getPosterAgent } from "./poster";
import type {
  AgentInput,
  AgentOutput,
  AgentProgressCallback,
  PosterAgentId,
} from "./base/types";
import { activityLogger } from "../utils/activityLogger";

/**
 * 海报 Agent 调度器
 *
 * 协调多个 Agent 的执行，支持工作流编排。
 */
export class PosterAgentScheduler {
  /**
   * 运行工作流
   *
   * @param stages - Agent 执行阶段列表
   * @param initialInput - 初始输入
   * @param onProgress - 进度回调
   * @returns 各阶段的输出结果
   */
  async runWorkflow(
    stages: PosterAgentId[],
    initialInput: AgentInput,
    onProgress?: AgentProgressCallback,
  ): Promise<Map<PosterAgentId, AgentOutput>> {
    // 记录工作流开始
    activityLogger.log({
      eventType: 'workflow_start',
      status: 'success',
      title: '开始执行工作流',
      description: `共 ${stages.length} 个阶段`,
      metadata: { stages },
    });

    const results = new Map<PosterAgentId, AgentOutput>();
    let currentInput = initialInput;

    for (const agentId of stages) {
      const agent = getPosterAgent(agentId);
      if (!agent) {
        console.warn(`[AgentScheduler] Agent not found: ${agentId}`);
        continue;
      }

      // 通知开始
      onProgress?.(agentId, 0);

      try {
        // 执行 Agent
        const output = await agent.execute(currentInput);
        results.set(agentId, output);

        // 将输出作为下一个 Agent 的输入
        currentInput = {
          ...currentInput,
          context: {
            ...currentInput.context,
            [`${agentId}Result`]: output,
            // 提取主要建议作为下一阶段的输入
            ...this.extractMainSuggestion(agentId, output),
          },
        };

        // 通知完成
        onProgress?.(agentId, 100, output);
      } catch (error) {
        console.error(`[AgentScheduler] Agent ${agentId} failed:`, error);
        // 通知失败但继续执行
        onProgress?.(agentId, -1);
      }
    }

    // 记录工作流完成
    activityLogger.log({
      eventType: 'workflow_complete',
      status: 'success',
      title: '工作流执行完成',
      description: `所有 ${stages.length} 个阶段已完成`,
    });

    return results;
  }

  /**
   * 运行单个 Agent
   *
   * @param agentId - Agent ID
   * @param input - 输入
   * @returns Agent 输出
   */
  async runAgent(
    agentId: PosterAgentId,
    input: AgentInput,
  ): Promise<AgentOutput | null> {
    const agent = getPosterAgent(agentId);
    if (!agent) {
      console.warn(`[AgentScheduler] Agent not found: ${agentId}`);
      return null;
    }

    return agent.execute(input);
  }

  /**
   * 提取主要建议作为下一阶段的输入
   */
  private extractMainSuggestion(
    agentId: PosterAgentId,
    output: AgentOutput,
  ): Record<string, unknown> {
    const mainSuggestion = output.suggestions[0];
    if (!mainSuggestion) return {};

    switch (agentId) {
      case "requirement":
        return { requirement: mainSuggestion.content };
      case "style":
        return { style: mainSuggestion.content };
      case "layout":
        return { layout: mainSuggestion.content };
      case "content":
        return { filledLayout: mainSuggestion.content };
      case "refine":
        return { refinements: output.suggestions.map((s) => s.content) };
      case "export":
        return { exportOptions: output.suggestions.map((s) => s.content) };
      default:
        return {};
    }
  }
}

/**
 * 预定义工作流
 */
export const POSTER_WORKFLOWS = {
  /**
   * 完整工作流：从需求到导出
   */
  full: [
    "requirement",
    "style",
    "layout",
    "content",
    "refine",
    "export",
  ] as PosterAgentId[],

  /**
   * 快速工作流：跳过需求分析
   */
  quick: ["style", "layout", "content"] as PosterAgentId[],

  /**
   * 优化工作流：仅优化和导出
   */
  optimize: ["refine", "export"] as PosterAgentId[],

  /**
   * 布局工作流：仅生成布局
   */
  layout: ["requirement", "style", "layout"] as PosterAgentId[],
};

// 导出单例
export const posterAgentScheduler = new PosterAgentScheduler();

export default PosterAgentScheduler;
