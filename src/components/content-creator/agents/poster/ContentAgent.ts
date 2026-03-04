/**
 * @file ContentAgent.ts
 * @description 内容填充 Agent，基于布局和素材生成具体的设计元素
 * @module components/content-creator/agents/poster/ContentAgent
 */

import { BaseAgent } from "../base/BaseAgent";
import type {
  AgentInput,
  AgentOutput,
  LayoutScheme,
  StyleRecommendation,
  FabricObject,
} from "../base/types";
import type { Material } from "@/types/material";

/**
 * 内容填充 Agent
 *
 * 基于布局方案和素材库，生成具体的设计元素内容。
 */
export class ContentAgent extends BaseAgent {
  constructor() {
    super({
      id: "content-agent",
      name: "内容填充 Agent",
      description: "生成具体的设计元素内容",
      temperature: 0.7,
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { layout } = input.context as {
      layout?: LayoutScheme;
    };
    const materials = input.materials || [];

    const prompt = this.buildPrompt(input);
    const response = await this.callLLM(prompt);

    const content = response.content as {
      text?: {
        title?: string;
        subtitle?: string;
        callToAction?: string;
      };
      images?: Array<{
        type: string;
        description: string;
        position: string;
      }>;
    };

    // 填充布局中的占位元素
    const filledLayout = layout
      ? this.fillLayoutContent(layout, content, materials)
      : null;

    return {
      suggestions: [
        {
          id: "filled-content",
          type: "element",
          title: "内容填充完成",
          description: "基于您的需求和素材生成了设计内容",
          content: filledLayout,
          reason: "基于您的需求和素材生成了设计内容",
          confidence: 0.85,
        },
      ],
      metadata: {
        textContent: content?.text,
        imageRecommendations: content?.images,
      },
    };
  }

  /**
   * 填充布局内容
   */
  private fillLayoutContent(
    layout: LayoutScheme,
    content: {
      text?: {
        title?: string;
        subtitle?: string;
        callToAction?: string;
      };
      images?: Array<{
        type: string;
        description: string;
        position: string;
      }>;
    },
    materials: Material[],
  ): LayoutScheme {
    const filledObjects = layout.fabricJson.objects.map((obj) => {
      // 填充文字内容
      if (obj.type === "textbox") {
        if (
          obj.name === "title" ||
          obj.text === "主标题文字" ||
          obj.text === "大标题"
        ) {
          return { ...obj, text: content?.text?.title || obj.text };
        }
        if (
          obj.name === "subtitle" ||
          obj.text === "副标题文字" ||
          obj.text === "副标题描述文字"
        ) {
          return { ...obj, text: content?.text?.subtitle || obj.text };
        }
        if (
          obj.name === "cta-text" ||
          obj.text === "立即查看" ||
          obj.text === "立即购买"
        ) {
          return { ...obj, text: content?.text?.callToAction || obj.text };
        }
      }

      // 标记图片占位区域
      if (
        obj.type === "rect" &&
        obj.fill === "#E0E0E0" &&
        obj.name?.includes("image")
      ) {
        // 如果有匹配的素材，添加图片 URL
        const matchedMaterial = materials.find((m) => m.type === "image");
        if (matchedMaterial?.content) {
          return {
            type: "image",
            left: obj.left,
            top: obj.top,
            width: obj.width,
            height: obj.height,
            src: matchedMaterial.content,
            name: obj.name,
          };
        }
      }

      return obj;
    });

    return {
      ...layout,
      fabricJson: {
        ...layout.fabricJson,
        objects: filledObjects as FabricObject[],
      },
    };
  }

  protected buildPrompt(input: AgentInput): string {
    const { layout, requirement, style, contentType, platform } =
      input.context as {
        layout?: LayoutScheme;
        requirement?: Record<string, unknown>;
        style?: StyleRecommendation;
        contentType?: string;
        platform?: string;
      };

    // 内容类型特定的提示词
    const contentTypePrompts: Record<string, string> = {
      技术分享: `
## 标题生成规则
- 格式：[技术点] + [核心价值] + [数据/结果]
- 示例：
  * "React 18 并发渲染：性能提升 3 倍的秘密"
  * "从 0 到 1 搭建 AI Agent 平台：我踩过的 5 个坑"
  * "TypeScript 5.0 新特性：让代码更安全的 3 个技巧"
- 要求：
  * 简洁有力，控制在 20-30 字
  * 突出技术点和实际价值
  * 避免标题党，确保内容匹配

## 内容要点提炼
要求：
- 每个要点 15-30 字
- 使用数字增强说服力（如"性能提升 3 倍"、"节省 50% 时间"）
- 突出差异化和核心价值
- 使用专业术语但保持易懂`,
      行业洞察: `
## 标题生成规则
- 格式：[行业/技术] + [趋势/现象] + [时间/数据]
- 示例：
  * "Agent 炒作何时停？3 个关键信号"
  * "2026 AI Agent 行业：泡沫 落地 现状"
  * "从 ChatGPT 到 Agent：AI 应用的下一站"
- 要求：
  * 简洁专业，控制在 15-25 字
  * 包含关键词和数据
  * 突出核心观点

## 内容要点提炼
要求：
- 基于数据和事实
- 多角度分析（技术、市场、用户）
- 提供趋势预测
- 保持客观中立`,
      产品发布: `
## 标题生成规则
- 格式：[产品名] + [核心功能] + [使用场景]
- 示例：
  * "ProxyCast：创作者的 AI Agent 平台"
  * "告别低效创作，一个工具搞定全流程"
  * "支持 9 大创作主题的 AI 内容平台"
- 要求：
  * 突出痛点和解决方案
  * 控制在 20-30 字
  * 强调核心价值

## 内容要点提炼
要求：
- 痛点 → 功能亮点 → 使用场景
- 每个功能点配数据支撑
- 突出差异化优势
- 包含行动号召`,
    };

    // 平台特定的行动号召
    const platformCTA: Record<string, string> = {
      小红书: "点赞收藏不迷路 / 评论区见 / 关注我了解更多",
      知乎: "关注专栏获取更多内容 / 点赞支持 / 评论交流",
      掘金: "Star 项目 / 阅读完整文档 / 评论讨论",
      微信公众号: "点击阅读原文 / 分享给朋友 / 在看支持",
    };

    const contentTypePrompt =
      contentTypePrompts[contentType || ""] ||
      `
## 标题生成规则
- 简洁有力，8-15 字
- 突出核心价值
- 吸引目标受众

## 内容要点提炼
- 每个要点清晰明确
- 使用数据支撑
- 突出差异化`;

    const cta =
      platformCTA[platform || ""] || "立即查看 / 了解更多 / 点击关注";

    return `你是一个专业的内容创作专家，擅长为${platform || "社交媒体"}平台创作${contentType || "图文"}内容。

## 设计需求
${JSON.stringify(requirement, null, 2)}

## 布局类型
${layout?.name || "未指定"}

## 设计风格
${style?.name || "未指定"}

${contentTypePrompt}

## 行动号召建议
${cta}

## 内容要点示例
✅ "支持 9 大创作主题，覆盖社媒、短视频、小说等场景"
✅ "项目化管理，历史版本和素材自动沉淀"
✅ "一键适配小红书、知乎等 6 大平台规范"

❌ "功能很强大"（过于笼统）
❌ "用户体验很好"（缺少具体说明）

请生成以下内容：
1. 主标题（简洁有力，15-25 字，参考上述规则）
2. 副标题（补充说明，20-40 字，提供更多细节）
3. 行动号召（引导用户，2-8 字，根据平台特性）
4. 图片建议（需要什么类型的图片）

输出 JSON 格式:
\`\`\`json
{
  "content": {
    "text": {
      "title": "主标题内容",
      "subtitle": "副标题内容",
      "callToAction": "立即查看"
    },
    "images": [
      {
        "type": "product",
        "description": "产品主图，白底高清",
        "position": "center"
      }
    ]
  }
}
\`\`\``;
  }
}

export default ContentAgent;
