/**
 * @file industry-analysis.ts
 * @description 行业分析内容模板（如"2026 AI Agent 行业"）
 * @module components/content-creator/templates/social-media/industry-analysis
 */

import type { ContentTemplate } from "./trending-topic";

/**
 * 行业分析模板
 */
export const industryAnalysisTemplate: ContentTemplate = {
  id: "industry-analysis",
  name: "行业分析",
  description: "数据驱动的行业深度分析内容",

  titleFormats: [
    "{年份} {行业} {关键词1} {关键词2} {关键词3}",
    "{行业} 市场规模达 {数字}：{趋势分析}",
    "{技术/产品} 渗透率突破 {百分比}：{影响分析}",
  ],

  titleExamples: [
    "2026 AI Agent 行业：泡沫 落地 现状",
    "AI 创作工具市场规模达 500 亿：3 大趋势预测",
    "Agent 技术渗透率突破 30%：对创作行业的影响",
  ],

  contentStructure: {
    sections: [
      {
        name: "市场现状",
        prompt: "描述当前市场规模、主要玩家、竞争格局",
        length: "200-300字",
        requirements: [
          "引用权威市场数据",
          "列举主要企业和产品",
          "分析市场份额分布",
        ],
      },
      {
        name: "关键趋势",
        prompt: "分析 3-5 个关键发展趋势",
        length: "400-500字",
        requirements: [
          "每个趋势配数据支撑",
          "分析趋势背后的驱动因素",
          "预测趋势的持续性",
        ],
      },
      {
        name: "挑战与机遇",
        prompt: "分析行业面临的挑战和潜在机遇",
        length: "300-400字",
        requirements: [
          "客观分析挑战",
          "识别潜在机遇",
          "提供应对建议",
        ],
      },
      {
        name: "未来展望",
        prompt: "预测未来 1-3 年的发展方向",
        length: "200-300字",
        requirements: [
          "基于数据和逻辑",
          "提供时间线",
          "保持客观理性",
        ],
      },
    ],
  },

  visualStyle: {
    coverImage: {
      style: "数据可视化风格",
      colors: ["#1a1a2e", "#16213e", "#0f3460", "#53a8b6"],
      elements: [
        "数据图表（柱状图、折线图）",
        "趋势线和增长曲线",
        "关键数据标注",
        "专业排版",
      ],
      layout: "数据图表为主，标题简洁醒目",
    },
  },

  agentPrompt: `你是一个资深的行业分析师，擅长撰写数据驱动的行业报告。

## 任务
创作一篇关于「{{topic}}」的行业分析报告，适合发布在{{platform}}平台。

## 标题要求
- 格式参考：「2026 AI Agent 行业：泡沫 落地 现状」
- 包含年份、行业、关键词
- 15-30 字

## 内容结构
1. **市场现状**（200-300字）
   - 市场规模和增长率
   - 主要玩家和产品
   - 竞争格局分析

2. **关键趋势**（400-500字）
   - 3-5 个关键趋势
   - 每个趋势配数据支撑
   - 分析驱动因素

3. **挑战与机遇**（300-400字）
   - 行业面临的挑战
   - 潜在的发展机遇
   - 应对建议

4. **未来展望**（200-300字）
   - 1-3 年发展预测
   - 关键里程碑
   - 投资建议

## 数据要求
- 引用权威数据源（如 Gartner、IDC、艾瑞咨询）
- 提供具体数字和百分比
- 使用图表辅助说明

## 语气要求
- 专业客观，数据驱动
- 避免情绪化表达
- 保持中立立场

## 输出格式
请输出 Markdown 格式的报告，包含：
- H1 标题
- H2 章节标题
- 数据表格和列表
- 关键数据加粗

开始创作...`,
};

export default industryAnalysisTemplate;
