/**
 * @file tech-sharing.ts
 * @description 技术分享内容模板
 * @module components/content-creator/templates/social-media/tech-sharing
 */

import type { ContentTemplate } from "./trending-topic";

/**
 * 技术分享模板
 */
export const techSharingTemplate: ContentTemplate = {
  id: "tech-sharing",
  name: "技术分享",
  description: "技术深度和实用性并重的技术内容",

  titleFormats: [
    "{技术点} + {核心价值} + {数据/结果}",
    "从 0 到 1 {实现目标}：{关键要点}",
    "{技术} {版本} 新特性：{核心亮点}",
  ],

  titleExamples: [
    "React 18 并发渲染：性能提升 3 倍的秘密",
    "从 0 到 1 搭建 AI Agent 平台：我踩过的 5 个坑",
    "TypeScript 5.0 新特性：让代码更安全的 3 个技巧",
  ],

  contentStructure: {
    sections: [
      {
        name: "问题背景",
        prompt: "说明为什么需要这个技术/方案",
        length: "150-200字",
        requirements: [
          "描述遇到的问题或痛点",
          "说明现有方案的不足",
          "引出新技术/方案的必要性",
        ],
      },
      {
        name: "核心概念",
        prompt: "解释关键术语和核心原理",
        length: "200-300字",
        requirements: [
          "用简单语言解释复杂概念",
          "提供类比和示例",
          "突出核心优势",
        ],
      },
      {
        name: "解决方案",
        prompt: "详细说明具体实现方法",
        length: "400-500字",
        requirements: [
          "提供完整的实现步骤",
          "包含可运行的代码示例",
          "说明关键配置和参数",
        ],
      },
      {
        name: "最佳实践",
        prompt: "分享注意事项和优化建议",
        length: "200-300字",
        requirements: [
          "列举常见坑点",
          "提供优化建议",
          "分享实战经验",
        ],
      },
      {
        name: "总结",
        prompt: "回顾核心要点",
        length: "100-150字",
        requirements: [
          "总结 3-5 个关键要点",
          "提供进一步学习资源",
          "鼓励读者实践",
        ],
      },
    ],
  },

  visualStyle: {
    coverImage: {
      style: "代码编辑器风格",
      colors: ["#1e1e1e", "#282c34", "#1e80ff", "#98c379"],
      elements: [
        "代码片段截图",
        "技术架构图",
        "性能对比图表",
        "技术标签和关键词",
      ],
      layout: "代码为主，标题简洁，技术感强",
    },
  },

  agentPrompt: `你是一个资深的技术专家，擅长撰写技术深度和实用性并重的技术文章。

## 任务
创作一篇关于「{{topic}}」的技术分享文章，适合发布在{{platform}}平台。

## 标题要求
- 格式参考：「React 18 并发渲染：性能提升 3 倍的秘密」
- 突出技术点和实际价值
- 20-30 字

## 内容结构
1. **问题背景**（150-200字）
   - 描述遇到的问题
   - 现有方案的不足
   - 新技术的必要性

2. **核心概念**（200-300字）
   - 解释关键术语
   - 提供类比和示例
   - 突出核心优势

3. **解决方案**（400-500字）
   - 完整的实现步骤
   - 可运行的代码示例
   - 关键配置说明

4. **最佳实践**（200-300字）
   - 常见坑点
   - 优化建议
   - 实战经验

5. **总结**（100-150字）
   - 核心要点回顾
   - 进一步学习资源

## 代码要求
- 提供完整可运行的代码
- 添加必要的注释
- 使用 Markdown 代码块
- 标注语言类型

## 语气要求
- 技术专业但易懂
- 避免过度炫技
- 注重实用性

## 输出格式
请输出 Markdown 格式的文章，包含：
- H1 标题
- H2 章节标题
- 代码块（带语言标注）
- 关键术语加粗

开始创作...`,
};

export default techSharingTemplate;
