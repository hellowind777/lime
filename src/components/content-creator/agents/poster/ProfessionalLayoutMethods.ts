/**
 * @file ProfessionalLayoutMethods.ts
 * @description 专业排版布局方法（技术文章、行业洞察、数据驱动）
 * @module components/content-creator/agents/poster/ProfessionalLayoutMethods
 */

import type {
  FabricObject,
  StyleRecommendation,
} from "../base/types";

/**
 * 生成技术文章型布局（类似"Agent 炒作何时停？"）
 */
export function generateTechArticleLayout(
  objects: FabricObject[],
  width: number,
  height: number,
  layout: Record<string, unknown>,
  colorPalette: StyleRecommendation["colorPalette"],
  typography: StyleRecommendation["typography"],
): void {
  // 深色背景渐变
  objects[0] = {
    type: "rect",
    left: 0,
    top: 0,
    width,
    height,
    fill: "#0a1929",
    name: "dark-background",
  };

  // 科技感装饰元素 - 左上角
  objects.push({
    type: "circle",
    left: -50,
    top: -50,
    radius: 150,
    fill: "rgba(33, 150, 243, 0.1)",
    name: "decoration-circle-1",
  });

  // 科技感装饰元素 - 右下角
  objects.push({
    type: "circle",
    left: width - 100,
    top: height - 100,
    radius: 200,
    fill: "rgba(33, 150, 243, 0.05)",
    name: "decoration-circle-2",
  });

  // 主标题 - 大字号，居中或左对齐
  objects.push({
    type: "textbox",
    left: width * 0.08,
    top: height * 0.25,
    width: width * 0.84,
    text: (layout.primaryText as string) || "AGENT 炒作何时停",
    fontSize: typography.titleSize * 1.3,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#FFFFFF",
    lineHeight: 1.2,
    name: "main-title",
  });

  // 副标题 - 关键信号/要点
  objects.push({
    type: "textbox",
    left: width * 0.08,
    top: height * 0.45,
    width: width * 0.84,
    text: (layout.secondaryText as string) || "3 个关键信号",
    fontSize: typography.bodySize * 1.5,
    fontFamily: typography.bodyFont,
    fill: "#2196F3",
    name: "subtitle",
  });

  // 要点列表区域背景
  objects.push({
    type: "rect",
    left: width * 0.08,
    top: height * 0.58,
    width: width * 0.84,
    height: height * 0.28,
    fill: "rgba(255, 255, 255, 0.05)",
    rx: 12,
    ry: 12,
    name: "content-box",
  });

  // 要点 1
  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.62,
    width: width * 0.76,
    text: "① 市场热度持续下降",
    fontSize: typography.bodySize,
    fontFamily: typography.bodyFont,
    fill: "#E0E0E0",
    name: "point-1",
  });

  // 要点 2
  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.70,
    width: width * 0.76,
    text: "② 实际落地案例减少",
    fontSize: typography.bodySize,
    fontFamily: typography.bodyFont,
    fill: "#E0E0E0",
    name: "point-2",
  });

  // 要点 3
  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.78,
    width: width * 0.76,
    text: "③ 投资回报率不及预期",
    fontSize: typography.bodySize,
    fontFamily: typography.bodyFont,
    fill: "#E0E0E0",
    name: "point-3",
  });
}

/**
 * 生成行业洞察型布局（类似"2026 AI Agent 行业"）
 */
export function generateIndustryInsightLayout(
  objects: FabricObject[],
  width: number,
  height: number,
  layout: Record<string, unknown>,
  colorPalette: StyleRecommendation["colorPalette"],
  typography: StyleRecommendation["typography"],
): void {
  // 深色背景
  objects[0] = {
    type: "rect",
    left: 0,
    top: 0,
    width,
    height,
    fill: "#1a1a2e",
    name: "dark-background",
  };

  // 年份标签
  objects.push({
    type: "textbox",
    left: width * 0.08,
    top: height * 0.12,
    width: width * 0.3,
    text: "2026",
    fontSize: typography.titleSize * 0.8,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#53a8b6",
    name: "year-label",
  });

  // 主标题
  objects.push({
    type: "textbox",
    left: width * 0.08,
    top: height * 0.22,
    width: width * 0.84,
    text: (layout.primaryText as string) || "AI Agent 行业",
    fontSize: typography.titleSize * 1.2,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#FFFFFF",
    lineHeight: 1.3,
    name: "main-title",
  });

  // 关键词标签区域
  const keywords = ["泡沫", "落地", "现状"];
  keywords.forEach((keyword, index) => {
    // 标签背景
    objects.push({
      type: "rect",
      left: width * 0.08 + index * (width * 0.25),
      top: height * 0.42,
      width: width * 0.22,
      height: 50,
      fill: "rgba(83, 168, 182, 0.2)",
      rx: 8,
      ry: 8,
      name: `keyword-bg-${index}`,
    });

    // 标签文字
    objects.push({
      type: "textbox",
      left: width * 0.08 + index * (width * 0.25),
      top: height * 0.42 + 12,
      width: width * 0.22,
      text: keyword,
      fontSize: typography.bodySize,
      fontFamily: typography.bodyFont,
      fill: "#53a8b6",
      textAlign: "center",
      name: `keyword-${index}`,
    });
  });

  // 数据展示区域
  objects.push({
    type: "rect",
    left: width * 0.08,
    top: height * 0.58,
    width: width * 0.84,
    height: height * 0.28,
    fill: "rgba(255, 255, 255, 0.03)",
    rx: 12,
    ry: 12,
    name: "data-box",
  });

  // 数据标题
  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.62,
    width: width * 0.76,
    text: "市场规模预测",
    fontSize: typography.bodySize * 0.9,
    fontFamily: typography.bodyFont,
    fill: "#999999",
    name: "data-title",
  });

  // 数据内容
  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.68,
    width: width * 0.76,
    text: "500 亿美元",
    fontSize: typography.titleSize * 0.9,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#53a8b6",
    name: "data-value",
  });

  // 趋势说明
  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.78,
    width: width * 0.76,
    text: "同比增长 45%",
    fontSize: typography.bodySize,
    fontFamily: typography.bodyFont,
    fill: "#E0E0E0",
    name: "trend-text",
  });
}

/**
 * 生成数据驱动型布局
 */
export function generateDataDrivenLayout(
  objects: FabricObject[],
  width: number,
  height: number,
  layout: Record<string, unknown>,
  colorPalette: StyleRecommendation["colorPalette"],
  typography: StyleRecommendation["typography"],
): void {
  // 浅色背景
  objects[0] = {
    type: "rect",
    left: 0,
    top: 0,
    width,
    height,
    fill: "#f5f5f5",
    name: "light-background",
  };

  // 顶部色块
  objects.push({
    type: "rect",
    left: 0,
    top: 0,
    width,
    height: height * 0.35,
    fill: "#2196F3",
    name: "header-block",
  });

  // 主标题
  objects.push({
    type: "textbox",
    left: width * 0.08,
    top: height * 0.12,
    width: width * 0.84,
    text: (layout.primaryText as string) || "数据洞察报告",
    fontSize: typography.titleSize,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#FFFFFF",
    name: "main-title",
  });

  // 副标题
  objects.push({
    type: "textbox",
    left: width * 0.08,
    top: height * 0.24,
    width: width * 0.84,
    text: (layout.secondaryText as string) || "基于 10,000+ 样本分析",
    fontSize: typography.bodySize,
    fontFamily: typography.bodyFont,
    fill: "rgba(255, 255, 255, 0.9)",
    name: "subtitle",
  });

  // 数据卡片 1
  objects.push({
    type: "rect",
    left: width * 0.08,
    top: height * 0.42,
    width: width * 0.4,
    height: height * 0.18,
    fill: "#FFFFFF",
    rx: 12,
    ry: 12,
    shadow: {
      color: "rgba(0, 0, 0, 0.1)",
      blur: 10,
      offsetX: 0,
      offsetY: 4,
    },
    name: "data-card-1",
  });

  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.46,
    width: width * 0.32,
    text: "用户增长",
    fontSize: typography.bodySize * 0.8,
    fontFamily: typography.bodyFont,
    fill: "#666666",
    name: "card-1-label",
  });

  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.51,
    width: width * 0.32,
    text: "+127%",
    fontSize: typography.titleSize * 0.7,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#4CAF50",
    name: "card-1-value",
  });

  // 数据卡片 2
  objects.push({
    type: "rect",
    left: width * 0.52,
    top: height * 0.42,
    width: width * 0.4,
    height: height * 0.18,
    fill: "#FFFFFF",
    rx: 12,
    ry: 12,
    shadow: {
      color: "rgba(0, 0, 0, 0.1)",
      blur: 10,
      offsetX: 0,
      offsetY: 4,
    },
    name: "data-card-2",
  });

  objects.push({
    type: "textbox",
    left: width * 0.56,
    top: height * 0.46,
    width: width * 0.32,
    text: "市场份额",
    fontSize: typography.bodySize * 0.8,
    fontFamily: typography.bodyFont,
    fill: "#666666",
    name: "card-2-label",
  });

  objects.push({
    type: "textbox",
    left: width * 0.56,
    top: height * 0.51,
    width: width * 0.32,
    text: "32.5%",
    fontSize: typography.titleSize * 0.7,
    fontFamily: typography.titleFont,
    fontWeight: 700,
    fill: "#2196F3",
    name: "card-2-value",
  });

  // 趋势图占位
  objects.push({
    type: "rect",
    left: width * 0.08,
    top: height * 0.68,
    width: width * 0.84,
    height: height * 0.22,
    fill: "#FFFFFF",
    rx: 12,
    ry: 12,
    shadow: {
      color: "rgba(0, 0, 0, 0.1)",
      blur: 10,
      offsetX: 0,
      offsetY: 4,
    },
    name: "chart-placeholder",
  });

  objects.push({
    type: "textbox",
    left: width * 0.12,
    top: height * 0.72,
    width: width * 0.76,
    text: "📈 趋势图表",
    fontSize: typography.bodySize,
    fontFamily: typography.bodyFont,
    fill: "#999999",
    textAlign: "center",
    name: "chart-label",
  });
}
