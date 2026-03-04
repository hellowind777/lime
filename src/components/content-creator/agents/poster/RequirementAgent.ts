/**
 * @file RequirementAgent.ts
 * @description 需求分析 Agent，分析用户设计需求，生成结构化需求报告
 * @module components/content-creator/agents/poster/RequirementAgent
 */

import { BaseAgent } from "../base/BaseAgent";
import type {
  AgentInput,
  AgentOutput,
  RequirementAnalysis,
} from "../base/types";

/**
 * 需求分析 Agent
 *
 * 分析用户的设计需求，提取关键信息，生成结构化的需求报告。
 */
export class RequirementAgent extends BaseAgent {
  constructor() {
    super({
      id: "requirement-agent",
      name: "需求分析 Agent",
      description: "分析用户设计需求，生成结构化需求报告",
      temperature: 0.3,
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const prompt = this.buildPrompt(input);
    const response = await this.callLLM(prompt);

    const analysis = response.analysis as RequirementAnalysis;

    return {
      suggestions: [
        {
          id: "requirement-analysis",
          type: "choice",
          title: "需求分析结果",
          description: "基于您的输入，我分析了设计需求",
          content: analysis,
          reason: "基于您的输入，我分析了设计需求",
          confidence: 0.9,
        },
      ],
      metadata: {
        inputSummary: `${input.context.purpose} - ${input.context.platform}`,
      },
    };
  }

  protected buildPrompt(input: AgentInput): string {
    const { purpose, platform, content, style, contentType, tone } =
      input.context as {
        purpose?: string;
        platform?: string;
        content?: string;
        style?: string;
        contentType?: string;
        tone?: string;
      };

    // 平台特性分析
    const platformGuidelines: Record<string, string> = {
      知乎: `
知乎用户特点：
- 重视内容深度和逻辑性
- 喜欢数据支撑和案例分析
- 对专业术语接受度高
- 偏好长文和结构化内容

内容要求：
- 标题：简洁专业，突出核心价值（如"Agent 炒作何时停？3 个关键信号"）
- 结构：清晰的章节层次，使用 H2/H3 标题
- 论证：数据 + 案例 + 逻辑推理
- 语气：专业但不失易懂，避免过度营销`,
      掘金: `
掘金用户特点：
- 以技术开发者为主
- 重视代码示例和实用性
- 喜欢技术深度和最佳实践
- 偏好简洁直接的表达

内容要求：
- 标题：突出技术点和实用价值（如"React 18 并发渲染：性能提升 3 倍的秘密"）
- 结构：问题背景 → 解决方案 → 代码示例 → 最佳实践
- 论证：代码 + 性能数据 + 实际案例
- 语气：技术专业，简洁直接`,
      小红书: `
小红书用户特点：
- 重视视觉冲击力
- 喜欢轻松易懂的内容
- 偏好图文并茂的呈现
- 互动性强

内容要求：
- 标题：吸引眼球，使用 emoji（如"🔥 Agent 炒作何时停？"）
- 结构：图片为主，文字为辅
- 论证：案例 + 体验 + 互动引导
- 语气：轻松有趣，贴近生活`,
    };

    // 内容类型结构建议
    const contentTypeGuidelines: Record<string, string> = {
      技术分享: `
推荐结构：
1. 问题背景（为什么需要这个技术/方案）
2. 核心概念（关键术语解释）
3. 解决方案（具体实现方法）
4. 代码示例（可运行的代码片段）
5. 最佳实践（注意事项和优化建议）
6. 总结（核心要点回顾）`,
      行业洞察: `
推荐结构：
1. 现状分析（描述当前行业现象，使用数据支撑）
2. 趋势预测（分析未来发展趋势，提供论据）
3. 数据支撑（引用权威数据和研究报告）
4. 结论（总结核心观点，提出建议）`,
      产品发布: `
推荐结构：
1. 痛点（用户面临的问题）
2. 功能亮点（3-5 个核心功能）
3. 使用场景（具体应用案例）
4. 行动号召（下载/试用引导）`,
      热点借势: `
推荐结构：
1. 热点事件（简要描述热点）
2. 关联分析（与产品/服务的关联）
3. 观点输出（独特的见解或态度）
4. 互动引导（引发讨论）`,
    };

    const platformGuide =
      platformGuidelines[platform || ""] || "根据平台特性优化内容";
    const contentTypeGuide =
      contentTypeGuidelines[contentType || ""] || "根据内容类型优化结构";

    return `你是一个资深的内容策划专家，擅长为不同平台创作专业内容。

## 用户需求
- 使用场景: ${purpose || "未指定"}
- 目标平台: ${platform || "未指定"}
- 内容类型: ${contentType || "未指定"}
- 核心主题: ${content || "未指定"}
- 风格偏好: ${style || "未指定"}
- 内容调性: ${tone || "未指定"}

## 平台特性分析
${platformGuide}

## 内容类型结构建议
${contentTypeGuide}

## 标题生成
请生成 3-5 个专业标题，参考以下格式：

**技术分享类**：
- "[技术点] + [核心价值] + [数据/结果]"
- 示例："React 18 并发渲染：性能提升 3 倍的秘密"

**行业洞察类**：
- "[行业/技术] + [趋势/现象] + [时间/数据]"
- 示例："Agent 炒作何时停？3 个关键信号"
- 示例："2026 AI Agent 行业：泡沫 落地 现状"

**产品发布类**：
- "[产品名] + [核心功能] + [使用场景]"
- 示例："ProxyCast：创作者的 AI Agent 平台"

**热点借势类**：
- "[热点] + [观点] + [互动]"
- 示例："ChatGPT 爆火背后：AI 创作的下一站"

请输出结构化的需求分析报告，包含：
1. 设计目的（吸引点击/传达信息/品牌展示等）
2. 目标受众分析（人群特征、年龄、兴趣）
3. 关键元素提取（主文案、副文案、行动号召）
4. 标题候选（3-5 个专业标题）
5. 视觉要求（推荐尺寸、色彩氛围、风格）
6. 约束条件（平台规范、品牌要求等）

输出 JSON 格式:
\`\`\`json
{
  "analysis": {
    "purpose": "设计目的",
    "audience": {
      "demographic": "目标人群描述",
      "ageRange": "18-35岁",
      "interests": ["兴趣1", "兴趣2"]
    },
    "keyElements": {
      "primaryText": "主要文案",
      "secondaryText": "次要文案",
      "callToAction": "立即查看"
    },
    "titleCandidates": [
      "标题候选 1",
      "标题候选 2",
      "标题候选 3"
    ],
    "visualRequirements": {
      "recommendedSize": { "width": 1080, "height": 1440 },
      "colorMood": "科技感深色背景",
      "style": "专业简洁"
    },
    "constraints": ["平台规范", "品牌要求"]
  }
}
\`\`\``;
  }
}

export default RequirementAgent;
