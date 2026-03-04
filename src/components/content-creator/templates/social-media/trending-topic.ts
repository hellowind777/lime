/**
 * @file trending-topic.ts
 * @description 热点分析内容模板（如"Agent 炒作何时停？"）
 * @module components/content-creator/templates/social-media/trending-topic
 */

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  titleFormats: string[];
  titleExamples: string[];
  contentStructure: {
    sections: Array<{
      name: string;
      prompt: string;
      length: string;
      requirements: string[];
    }>;
  };
  visualStyle: {
    coverImage: {
      style: string;
      colors: string[];
      elements: string[];
      layout: string;
    };
  };
  agentPrompt: string;
}

/**
 * 热点分析模板
 */
export const trendingTopicTemplate: ContentTemplate = {
  id: "trending-topic",
  name: "热点分析",
  description: "针对行业热点的深度分析内容",

  titleFormats: [
    "{技术/概念} 炒作何时停？{数字} 个关键信号",
    "{年份} {行业} {现象}：{关键词1} {关键词2} {关键词3}",
    "从 {起点} 到 {终点}：{行业} 的 {变化}",
  ],

  titleExamples: [
    "Agent 炒作何时停？3 个关键信号",
    "2026 AI Agent 行业：泡沫 落地 现状",
    "从 ChatGPT 到 Agent：AI 应用的下一站",
  ],

  contentStructure: {
    sections: [
      {
        name: "现象描述",
        prompt: "描述当前的行业现象和热点话题，使用具体数据",
        length: "150-200字",
        requirements: [
          "引用具体数据（如市场规模、增长率）",
          "提及关键事件或里程碑",
          "使用专业术语但保持易懂",
        ],
      },
      {
        name: "深度分析",
        prompt: "分析现象背后的原因和逻辑",
        length: "300-400字",
        requirements: [
          "多角度分析（技术、市场、用户）",
          "引用行业报告或专家观点",
          "提供数据支撑",
        ],
      },
      {
        name: "趋势预测",
        prompt: "预测未来发展趋势",
        length: "200-300字",
        requirements: [
          "基于数据和逻辑推理",
          "提供 2-3 个可能的发展方向",
          "避免过度乐观或悲观",
        ],
      },
      {
        name: "结论",
        prompt: "总结核心观点",
        length: "100-150字",
        requirements: [
          "提炼 3-5 个核心要点",
          "给出可操作的建议",
          "呼应标题",
        ],
      },
    ],
  },

  visualStyle: {
    coverImage: {
      style: "科技感深色背景",
      colors: ["#0a1929", "#1a237e", "#2196F3"],
      elements: [
        "数字化人物剪影",
        "AI 网络节点",
        "科技光效和粒子",
        "大标题文字（如 AGENT炒作何时停）",
      ],
      layout: "标题居中或左对齐，背景深蓝渐变",
    },
  },

  agentPrompt: `你是一个资深的科技行业分析师，擅长撰写深度热点分析文章。

## 任务
创作一篇关于「{{topic}}」的热点分析内容，适合发布在{{platform}}平台。

## 标题要求
- 格式参考：「Agent 炒作何时停？3 个关键信号」
- 简洁有力，15-25 字
- 包含关键词：{{keywords}}
- 突出核心观点或数据

## 内容结构
1. **现象描述**（150-200字）
   - 描述当前行业现象
   - 引用具体数据（市场规模、增长率等）
   - 提及关键事件

2. **深度分析**（300-400字）
   - 多角度分析（技术、市场、用户）
   - 引用行业报告或专家观点
   - 提供数据支撑

3. **趋势预测**（200-300字）
   - 基于数据和逻辑推理
   - 提供 2-3 个可能的发展方向

4. **结论**（100-150字）
   - 提炼 3-5 个核心要点
   - 给出可操作的建议

## 语气要求
- 专业但不失易懂
- 使用数据和事实，避免情绪化
- 保持客观中立，避免过度营销

## 输出格式
请输出 Markdown 格式的文章，包含：
- H1 标题
- H2 章节标题
- 数据和要点使用列表
- 关键术语使用加粗

开始创作...`,
};

export default trendingTopicTemplate;
