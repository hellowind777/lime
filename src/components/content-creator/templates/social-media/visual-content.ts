/**
 * @file visual-content.ts
 * @description 图文排版内容模板（如"Agent 炒作 图文排版"）
 * @module components/content-creator/templates/social-media/visual-content
 */

import type { ContentTemplate } from "./trending-topic";

/**
 * 图文排版模板
 */
export const visualContentTemplate: ContentTemplate = {
  id: "visual-content",
  name: "图文排版",
  description: "视觉优先的图文内容",

  titleFormats: [
    "{主题} 一图看懂",
    "{数字} 个 {主题} 的关键要点",
    "{主题} 完全指南",
  ],

  titleExamples: [
    "Agent 炒作 一图看懂",
    "5 个 AI 创作工具的关键差异",
    "ProxyCast 完全使用指南",
  ],

  contentStructure: {
    sections: [
      {
        name: "标题",
        prompt: "简洁有力的大标题",
        length: "8-15字",
        requirements: [
          "突出核心主题",
          "使用大字号",
          "视觉冲击力强",
        ],
      },
      {
        name: "核心要点",
        prompt: "3-5 个关键要点",
        length: "每个 15-30字",
        requirements: [
          "使用数字或图标",
          "简洁明了",
          "视觉层次清晰",
        ],
      },
      {
        name: "视觉元素",
        prompt: "配图和图标",
        length: "适量",
        requirements: [
          "与内容相关",
          "风格统一",
          "提升可读性",
        ],
      },
      {
        name: "行动号召",
        prompt: "互动引导",
        length: "5-10字",
        requirements: [
          "明确的行动指引",
          "视觉突出",
          "易于执行",
        ],
      },
    ],
  },

  visualStyle: {
    coverImage: {
      style: "图文并茂，视觉优先",
      colors: ["#ffffff", "#f5f5f5", "#2196F3", "#FF5722"],
      elements: [
        "大标题文字",
        "图标和插图",
        "数据可视化",
        "色块分隔",
      ],
      layout: "标题 + 要点 + 配图，层次清晰",
    },
  },

  agentPrompt: `你是一个资深的视觉设计师，擅长创作视觉优先的图文内容。

## 任务
创作一篇关于「{{topic}}」的图文排版内容，适合发布在{{platform}}平台。

## 标题要求
- 格式参考：「Agent 炒作 一图看懂」
- 简洁有力，8-15 字
- 视觉冲击力强

## 内容结构
1. **大标题**（8-15字）
   - 突出核心主题
   - 使用大字号
   - 居中或左对齐

2. **核心要点**（3-5 个，每个 15-30字）
   - 使用数字或图标
   - 简洁明了
   - 视觉层次清晰

示例：
✅ "① 支持 9 大创作主题"
✅ "② 项目化管理，素材自动沉淀"
✅ "③ 一键适配 6 大平台"

3. **视觉元素**
   - 配图和图标
   - 数据可视化
   - 色块分隔

4. **行动号召**（5-10字）
   - 明确的行动指引
   - 视觉突出

## 设计要求
- 视觉优先，文字为辅
- 色彩搭配和谐
- 层次清晰易读
- 适合快速浏览

## 输出格式
请输出 Markdown 格式的内容，包含：
- H1 大标题
- 要点列表（使用数字或图标）
- 简短的说明文字
- 行动号召

开始创作...`,
};

export default visualContentTemplate;
