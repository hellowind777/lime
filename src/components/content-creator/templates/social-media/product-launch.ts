/**
 * @file product-launch.ts
 * @description 产品发布内容模板
 * @module components/content-creator/templates/social-media/product-launch
 */

import type { ContentTemplate } from "./trending-topic";

/**
 * 产品发布模板
 */
export const productLaunchTemplate: ContentTemplate = {
  id: "product-launch",
  name: "产品发布",
  description: "突出痛点和解决方案的产品发布内容",

  titleFormats: [
    "{产品名}：{核心功能} + {使用场景}",
    "告别 {痛点}，{解决方案}",
    "支持 {数字} 大 {功能}的 {产品类型}",
  ],

  titleExamples: [
    "ProxyCast：创作者的 AI Agent 平台",
    "告别低效创作，一个工具搞定全流程",
    "支持 9 大创作主题的 AI 内容平台",
  ],

  contentStructure: {
    sections: [
      {
        name: "痛点",
        prompt: "描述用户面临的问题和痛点",
        length: "150-200字",
        requirements: [
          "描述具体的使用场景",
          "突出现有方案的不足",
          "引发用户共鸣",
        ],
      },
      {
        name: "功能亮点",
        prompt: "介绍 3-5 个核心功能",
        length: "300-400字",
        requirements: [
          "每个功能配具体数据",
          "突出差异化优势",
          "使用简洁的语言",
        ],
      },
      {
        name: "使用场景",
        prompt: "展示具体的应用案例",
        length: "200-300字",
        requirements: [
          "提供 2-3 个典型场景",
          "说明如何解决问题",
          "展示实际效果",
        ],
      },
      {
        name: "行动号召",
        prompt: "引导用户下载/试用",
        length: "100-150字",
        requirements: [
          "明确的行动指引",
          "提供优惠或福利",
          "降低试用门槛",
        ],
      },
    ],
  },

  visualStyle: {
    coverImage: {
      style: "产品展示风格",
      colors: ["#ffffff", "#f5f5f5", "#2196F3", "#4CAF50"],
      elements: [
        "产品截图或界面",
        "功能演示动图",
        "核心数据可视化",
        "行动号召按钮",
      ],
      layout: "产品为主，功能点清晰，视觉吸引",
    },
  },

  agentPrompt: `你是一个资深的产品经理，擅长撰写吸引用户的产品发布文案。

## 任务
创作一篇关于「{{product}}」的产品发布内容，适合发布在{{platform}}平台。

## 标题要求
- 格式参考：「ProxyCast：创作者的 AI Agent 平台」
- 突出产品名和核心价值
- 20-30 字

## 内容结构
1. **痛点**（150-200字）
   - 描述用户的具体问题
   - 现有方案的不足
   - 引发共鸣

2. **功能亮点**（300-400字）
   - 3-5 个核心功能
   - 每个功能配数据
   - 突出差异化

示例：
✅ "支持 9 大创作主题，覆盖社媒、短视频、小说等场景"
✅ "项目化管理，历史版本和素材自动沉淀"
✅ "一键适配小红书、知乎等 6 大平台规范"

3. **使用场景**（200-300字）
   - 2-3 个典型场景
   - 如何解决问题
   - 实际效果展示

4. **行动号召**（100-150字）
   - 明确的行动指引
   - 优惠或福利
   - 降低试用门槛

## 语气要求
- 突出用户价值
- 避免过度营销
- 数据支撑观点

## 输出格式
请输出 Markdown 格式的文案，包含：
- H1 标题
- H2 章节标题
- 功能点使用列表
- 关键数据加粗

开始创作...`,
};

export default productLaunchTemplate;
