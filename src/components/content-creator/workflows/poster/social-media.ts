/**
 * @file social-media.ts
 * @description 社交媒体海报工作流
 * @module components/content-creator/workflows/poster/social-media
 */

import type { WorkflowTemplate, WorkflowStep } from "./types";

/**
 * 社交媒体工作流步骤
 */
const socialMediaSteps: WorkflowStep[] = [
  {
    id: "requirement",
    name: "内容策划",
    description: "确定发布平台、内容主题和传播目标",
    agentId: "requirement",
    status: "pending",
    optional: false,
    estimatedDuration: 25,
    inputFields: [
      {
        key: "platform",
        label: "发布平台",
        type: "select",
        options: [
          "小红书",
          "微信公众号",
          "微博",
          "抖音",
          "B站",
          "Instagram",
          "知乎",
          "掘金",
        ],
        required: true,
      },
      {
        key: "contentType",
        label: "内容类型",
        type: "select",
        options: [
          "种草分享",
          "知识干货",
          "日常记录",
          "产品测评",
          "活动宣传",
          "热点借势",
          "技术分享",
          "行业洞察",
          "产品发布",
          "教程指南",
          "案例研究",
        ],
        required: true,
      },
      {
        key: "topic",
        label: "内容主题",
        type: "text",
        placeholder: "简要描述你要发布的内容",
        required: true,
      },
      {
        key: "tone",
        label: "内容调性",
        type: "select",
        options: [
          "专业权威",
          "轻松有趣",
          "温馨治愈",
          "酷炫潮流",
          "简约高级",
          "科技前沿",
          "数据驱动",
          "深度分析",
        ],
        required: false,
      },
    ],
  },
  {
    id: "style",
    name: "风格匹配",
    description: "匹配平台特性和用户偏好的视觉风格",
    agentId: "style",
    status: "pending",
    optional: false,
    estimatedDuration: 20,
    inputFields: [
      {
        key: "visualTrend",
        label: "视觉趋势",
        type: "select",
        options: [
          "杂志感",
          "ins风",
          "小清新",
          "赛博朋克",
          "复古怀旧",
          "极简主义",
        ],
        required: false,
      },
      {
        key: "colorMood",
        label: "色彩情绪",
        type: "select",
        options: ["明亮活泼", "低饱和高级", "黑金质感", "糖果色系", "大地色系"],
        required: false,
      },
    ],
  },
  {
    id: "layout",
    name: "排版布局",
    description: "生成适合社交平台阅读习惯的布局",
    agentId: "layout",
    status: "pending",
    optional: false,
    estimatedDuration: 35,
    inputFields: [
      {
        key: "layoutFormat",
        label: "布局格式",
        type: "select",
        options: ["单图封面", "多图轮播首图", "信息图表", "对比图", "步骤图"],
        required: true,
      },
      {
        key: "textDensity",
        label: "文字密度",
        type: "select",
        options: ["少量标题", "适中图文", "信息丰富"],
        required: false,
      },
    ],
  },
  {
    id: "content",
    name: "内容填充",
    description: "添加图片、文案和互动元素",
    agentId: "content",
    status: "pending",
    optional: false,
    estimatedDuration: 30,
    inputFields: [
      {
        key: "mainImage",
        label: "主图/素材",
        type: "image",
        required: false,
      },
      {
        key: "title",
        label: "标题文案",
        type: "text",
        placeholder: "吸引眼球的标题",
        required: true,
      },
      {
        key: "keyPoints",
        label: "核心要点",
        type: "textarea",
        placeholder: "每行一个要点，会自动排版",
        required: false,
      },
      {
        key: "callToAction",
        label: "互动引导",
        type: "text",
        placeholder: "例如：点赞收藏不迷路",
        required: false,
      },
    ],
  },
  {
    id: "refine",
    name: "细节优化",
    description: "优化可读性和吸引力",
    agentId: "refine",
    status: "pending",
    optional: true,
    estimatedDuration: 15,
    inputFields: [],
  },
  {
    id: "export",
    name: "平台适配",
    description: "导出符合各平台规范的尺寸",
    agentId: "export",
    status: "pending",
    optional: false,
    estimatedDuration: 10,
    inputFields: [
      {
        key: "exportPlatforms",
        label: "导出平台",
        type: "multiselect",
        options: ["小红书", "微信公众号", "微博", "抖音", "B站"],
        required: true,
      },
    ],
  },
];

/**
 * 社交媒体工作流模板
 */
export const socialMediaWorkflow: WorkflowTemplate = {
  id: "social-media",
  name: "社交媒体图文",
  description: "快速制作适合各社交平台的图文内容",
  icon: "share-2",
  category: "social",
  steps: socialMediaSteps,
  defaultContext: {
    industry: "social-media",
    style: "engaging",
    colorTone: "platform-optimized",
  },
  suggestedDimensions: [
    { width: 1080, height: 1440, name: "小红书 3:4" },
    { width: 1080, height: 1080, name: "微信公众号方图" },
    { width: 900, height: 500, name: "微信公众号封面" },
    { width: 1080, height: 1920, name: "抖音/微博故事" },
  ],
  tags: ["社交媒体", "小红书", "公众号", "种草"],
};

export default socialMediaWorkflow;
