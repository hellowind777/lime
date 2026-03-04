/**
 * @file LayoutAgent.ts
 * @description 布局生成 Agent，生成多个布局方案，输出 Fabric.js 兼容格式
 * @module components/content-creator/agents/poster/LayoutAgent
 */

import { BaseAgent } from "../base/BaseAgent";
import type {
  AgentInput,
  AgentOutput,
  LayoutScheme,
  StyleRecommendation,
  FabricObject,
} from "../base/types";
import {
  generateTechArticleLayout,
  generateIndustryInsightLayout,
  generateDataDrivenLayout,
} from "./ProfessionalLayoutMethods";

/**
 * 布局生成 Agent
 *
 * 基于需求和风格生成多个布局方案，输出 Fabric.js 兼容的 JSON 格式。
 */
export class LayoutAgent extends BaseAgent {
  constructor() {
    super({
      id: "layout-agent",
      name: "布局生成 Agent",
      description: "生成多个布局方案",
      temperature: 0.7,
    });
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { style, canvasSize } = input.context as {
      style?: StyleRecommendation;
      canvasSize?: { width: number; height: number };
    };

    const prompt = this.buildPrompt(input);
    const response = await this.callLLM(prompt);

    const layouts = (response.layouts as Array<Record<string, unknown>>) || [];
    const size = canvasSize || { width: 1080, height: 1440 };

    // 将 AI 输出转换为 Fabric.js 格式
    const fabricLayouts = layouts.map((layout, index) =>
      this.convertToFabricLayout(layout, size, style, index),
    );

    return {
      suggestions: fabricLayouts.map((layout, index) => ({
        id: layout.id,
        type: "layout" as const,
        title: layout.name,
        description: layout.description,
        content: layout,
        reason: layout.description,
        confidence: 1 - index * 0.1,
        preview: layout.thumbnail,
      })),
    };
  }

  /**
   * 转换为 Fabric.js 布局
   */
  private convertToFabricLayout(
    layout: Record<string, unknown>,
    canvasSize: { width: number; height: number },
    style: StyleRecommendation | undefined,
    index: number,
  ): LayoutScheme {
    const { width, height } = canvasSize;
    const objects: FabricObject[] = [];

    const colorPalette = style?.colorPalette || {
      primary: "#FF6B9D",
      secondary: "#FFC0D0",
      accent: "#FF4081",
      background: "#FFFFFF",
      text: "#333333",
    };

    const typography = style?.typography || {
      titleFont: "思源黑体",
      bodyFont: "苹方",
      titleSize: 72,
      bodySize: 24,
    };

    // 背景
    objects.push({
      type: "rect",
      left: 0,
      top: 0,
      width,
      height,
      fill: colorPalette.background,
      name: "background",
    });

    // 根据布局类型生成元素
    const layoutType = (layout.type as string) || "hero-image";

    switch (layoutType) {
      case "hero-image":
        this.generateHeroImageLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
        break;

      case "text-dominant":
        this.generateTextDominantLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
        break;

      case "grid":
        this.generateGridLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
        break;

      case "tech-article":
        generateTechArticleLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
        break;

      case "industry-insight":
        generateIndustryInsightLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
        break;

      case "data-driven":
        generateDataDrivenLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
        break;

      default:
        this.generateHeroImageLayout(
          objects,
          width,
          height,
          layout,
          colorPalette,
          typography,
        );
    }

    return {
      id: `layout-${index}`,
      name: (layout.name as string) || `布局方案 ${index + 1}`,
      description: (layout.description as string) || "自动生成的布局方案",
      fabricJson: {
        version: "5.3.0",
        objects,
      },
      metadata: {
        imageRatio: (layout.imageRatio as number) || 0.5,
        textRatio: (layout.textRatio as number) || 0.3,
        whiteSpace: (layout.whiteSpace as number) || 0.2,
        hierarchy: (layout.hierarchy as string[]) || ["图片", "标题", "副标题"],
      },
    };
  }

  /**
   * 生成大图型布局
   */
  private generateHeroImageLayout(
    objects: FabricObject[],
    width: number,
    height: number,
    layout: Record<string, unknown>,
    colorPalette: StyleRecommendation["colorPalette"],
    typography: StyleRecommendation["typography"],
  ): void {
    // 产品图占位
    objects.push({
      type: "rect",
      left: width * 0.1,
      top: height * 0.1,
      width: width * 0.8,
      height: height * 0.5,
      fill: "#E0E0E0",
      name: "image-placeholder",
    });

    // 主标题
    objects.push({
      type: "textbox",
      left: width * 0.1,
      top: height * 0.65,
      width: width * 0.8,
      text: (layout.primaryText as string) || "主标题文字",
      fontSize: typography.titleSize,
      fontFamily: typography.titleFont,
      fill: colorPalette.text,
      name: "title",
    });

    // 副标题
    objects.push({
      type: "textbox",
      left: width * 0.1,
      top: height * 0.78,
      width: width * 0.8,
      text: (layout.secondaryText as string) || "副标题文字",
      fontSize: typography.bodySize,
      fontFamily: typography.bodyFont,
      fill: colorPalette.secondary,
      name: "subtitle",
    });
  }

  /**
   * 生成文字主导型布局
   */
  private generateTextDominantLayout(
    objects: FabricObject[],
    width: number,
    height: number,
    layout: Record<string, unknown>,
    colorPalette: StyleRecommendation["colorPalette"],
    typography: StyleRecommendation["typography"],
  ): void {
    // 主标题
    objects.push({
      type: "textbox",
      left: width * 0.1,
      top: height * 0.2,
      width: width * 0.8,
      text: (layout.primaryText as string) || "大标题",
      fontSize: typography.titleSize * 1.2,
      fontFamily: typography.titleFont,
      fill: colorPalette.primary,
      name: "title",
    });

    // 副标题
    objects.push({
      type: "textbox",
      left: width * 0.1,
      top: height * 0.45,
      width: width * 0.8,
      text: (layout.secondaryText as string) || "副标题描述文字",
      fontSize: typography.bodySize,
      fontFamily: typography.bodyFont,
      fill: colorPalette.text,
      name: "subtitle",
    });

    // 行动号召按钮背景
    objects.push({
      type: "rect",
      left: width * 0.25,
      top: height * 0.7,
      width: width * 0.5,
      height: 60,
      fill: colorPalette.accent,
      rx: 30,
      ry: 30,
      name: "cta-button",
    });

    // 行动号召文字
    objects.push({
      type: "textbox",
      left: width * 0.25,
      top: height * 0.7 + 15,
      width: width * 0.5,
      text: (layout.callToAction as string) || "立即查看",
      fontSize: 24,
      fontFamily: typography.bodyFont,
      fill: "#FFFFFF",
      textAlign: "center",
      name: "cta-text",
    });
  }

  /**
   * 生成九宫格型布局
   */
  private generateGridLayout(
    objects: FabricObject[],
    width: number,
    height: number,
    layout: Record<string, unknown>,
    colorPalette: StyleRecommendation["colorPalette"],
    typography: StyleRecommendation["typography"],
  ): void {
    const gridSize = 3;
    const cellWidth = width * 0.25;
    const cellHeight = height * 0.25;
    const startX = width * 0.1;
    const startY = height * 0.15;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        objects.push({
          type: "rect",
          left: startX + j * (cellWidth + 10),
          top: startY + i * (cellHeight + 10),
          width: cellWidth,
          height: cellHeight,
          fill: "#E0E0E0",
          rx: 8,
          ry: 8,
          name: `grid-cell-${i}-${j}`,
        });
      }
    }

    // 标题
    objects.push({
      type: "textbox",
      left: width * 0.1,
      top: height * 0.85,
      width: width * 0.8,
      text: (layout.primaryText as string) || "标题",
      fontSize: typography.titleSize * 0.8,
      fontFamily: typography.titleFont,
      fill: colorPalette.text,
      textAlign: "center",
      name: "title",
    });
  }

  protected buildPrompt(input: AgentInput): string {
    const { requirement, style, canvasSize, contentType } = input.context as {
      requirement?: Record<string, unknown>;
      style?: StyleRecommendation;
      canvasSize?: { width: number; height: number };
      contentType?: string;
    };

    const size = canvasSize || { width: 1080, height: 1440 };

    // 根据内容类型推荐布局
    const layoutRecommendations: Record<string, string> = {
      技术分享: `
推荐布局：
1. tech-article: 技术文章型（深色背景 + 大标题 + 要点列表）
2. data-driven: 数据驱动型（数据卡片 + 图表展示）
3. text-dominant: 文字主导型（强调信息传达）`,
      行业洞察: `
推荐布局：
1. industry-insight: 行业洞察型（年份标签 + 关键词标签 + 数据展示）
2. data-driven: 数据驱动型（数据卡片 + 图表展示）
3. tech-article: 技术文章型（深色背景 + 要点列表）`,
      产品发布: `
推荐布局：
1. hero-image: 大图展示型（产品图 + 标题 + 行动号召）
2. text-dominant: 文字主导型（功能亮点 + 行动号召）
3. grid: 九宫格型（多功能展示）`,
      热点借势: `
推荐布局：
1. tech-article: 技术文章型（深色背景 + 大标题 + 要点列表）
2. text-dominant: 文字主导型（强调信息传达）
3. hero-image: 大图展示型（视觉冲击）`,
    };

    const layoutGuide =
      layoutRecommendations[contentType || ""] ||
      `
推荐布局：
1. hero-image: 大图+标题型（突出产品/主视觉）
2. text-dominant: 文字主导型（强调信息传达）
3. grid: 九宫格型（展示多个元素）`;

    return `你是一个专业的海报设计师。请基于以下需求生成 3 个不同的布局方案：

设计需求:
${JSON.stringify(requirement, null, 2)}

内容类型: ${contentType || "未指定"}
设计风格: ${style?.name || "简约现代"}
画布尺寸: ${size.width}×${size.height}

${layoutGuide}

每个布局包含：
- 布局类型和名称
- 元素位置和大小比例
- 视觉层次顺序
- 图片/文字/留白占比

## 专业布局类型说明

**tech-article**: 技术文章型
- 深色背景（#0a1929）
- 大标题 + 副标题
- 要点列表（带序号）
- 科技感装饰元素
- 适合：技术分享、热点分析

**industry-insight**: 行业洞察型
- 深色背景（#1a1a2e）
- 年份标签
- 关键词标签（如"泡沫"、"落地"、"现状"）
- 数据展示区域
- 适合：行业分析、趋势预测

**data-driven**: 数据驱动型
- 浅色背景 + 顶部色块
- 数据卡片（用户增长、市场份额等）
- 图表占位区域
- 适合：数据报告、成果展示

输出 JSON 格式:
\`\`\`json
{
  "layouts": [
    {
      "type": "tech-article",
      "name": "技术文章型",
      "description": "深色背景，大标题，要点列表，科技感强",
      "primaryText": "主标题",
      "secondaryText": "副标题",
      "callToAction": "了解更多",
      "imageRatio": 0.2,
      "textRatio": 0.6,
      "whiteSpace": 0.2,
      "hierarchy": ["主标题", "副标题", "要点列表"]
    }
  ]
}
\`\`\``;
  }
}

export default LayoutAgent;
