/**
 * @file BaseAgent.ts
 * @description Agent 基类，定义 Agent 的基本接口和通用方法
 * @module components/content-creator/agents/base/BaseAgent
 */

import { invoke } from "@tauri-apps/api/core";
import type { AgentConfig, AgentInput, AgentOutput } from "./types";
import { activityLogger } from "../../utils/activityLogger";

/**
 * Agent 基类
 *
 * 所有 Agent 都应继承此类并实现 execute 方法。
 */
export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * 获取 Agent ID
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * 获取 Agent 名称
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 获取 Agent 描述
   */
  get description(): string {
    return this.config.description;
  }

  /**
   * 执行 Agent 任务
   *
   * @param input - Agent 输入
   * @returns Agent 输出
   */
  abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * 构建 Prompt
   *
   * @param input - Agent 输入
   * @returns Prompt 字符串
   */
  protected abstract buildPrompt(input: AgentInput): string;

  /**
   * 调用 LLM
   *
   * @param prompt - Prompt 字符串
   * @returns LLM 响应
   */
  protected async callLLM(prompt: string): Promise<Record<string, unknown>> {
    // 记录Agent调用开始
    const logId = activityLogger.log({
      eventType: 'agent_call_start',
      status: 'pending',
      title: `调用 ${this.config.name}`,
      description: `提示词长度: ${prompt.length} 字符`,
      metadata: { agentId: this.config.id },
    });

    const startTime = Date.now();

    try {
      // 调用后端 LLM 服务
      const response = await invoke<string>("agent_chat", {
        agentId: this.config.id,
        message: prompt,
        model: this.config.model,
        temperature: this.config.temperature,
      });

      const duration = Date.now() - startTime;

      // 记录Agent调用成功
      activityLogger.updateLog(logId, {
        status: 'success',
        duration,
        description: `响应长度: ${response.length} 字符，耗时: ${(duration / 1000).toFixed(1)}s`,
      });

      // 尝试解析 JSON 响应
      return this.parseResponse(response);
    } catch (error) {
      const duration = Date.now() - startTime;

      // 记录Agent调用失败
      activityLogger.updateLog(logId, {
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(`[${this.config.id}] LLM 调用失败:`, error);
      throw error;
    }
  }

  /**
   * 解析 LLM 响应
   *
   * @param response - LLM 响应字符串
   * @returns 解析后的对象
   */
  protected parseResponse(response: string): Record<string, unknown> {
    // 尝试提取 JSON 块
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // 继续尝试其他方式
      }
    }

    // 尝试直接解析
    try {
      return JSON.parse(response);
    } catch {
      // 返回原始响应
      return { raw: response };
    }
  }

  /**
   * 验证输入
   *
   * @param input - Agent 输入
   * @param requiredFields - 必需字段
   * @throws 如果缺少必需字段
   */
  protected validateInput(input: AgentInput, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!(field in input.context)) {
        throw new Error(`缺少必需字段: ${field}`);
      }
    }
  }
}

export default BaseAgent;
