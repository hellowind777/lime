/**
 * @file juejin.ts
 * @description 掘金平台规范
 * @module components/content-creator/canvas/poster/platforms/juejin
 */

import type { PlatformSpec } from "./types";

/**
 * 掘金平台规范
 */
export const juejinSpec: PlatformSpec = {
  id: "custom",
  name: "掘金",
  icon: "juejin",
  description: "掘金文章封面和配图规范",
  sizes: [
    {
      name: "文章封面",
      width: 1200,
      height: 630,
      aspectRatio: "1.91:1",
      usage: "掘金文章封面图，显示在文章列表和详情页",
      recommended: true,
    },
    {
      name: "文章配图",
      width: 800,
      height: 450,
      aspectRatio: "16:9",
      usage: "文章内容配图，适合代码示例和技术图解",
    },
    {
      name: "专栏封面",
      width: 1080,
      height: 608,
      aspectRatio: "16:9",
      usage: "专栏封面图，显示在专栏列表",
    },
  ],
  safeZone: {
    top: 80,
    bottom: 80,
    left: 100,
    right: 100,
    description: "预留边距，确保标题和关键信息清晰可见",
  },
  fileSpec: {
    formats: ["jpg", "png", "webp"],
    maxSizeKB: 5120, // 5MB
    recommendedDPI: 72,
    colorMode: "RGB",
  },
  textSpec: {
    minFontSize: 18,
    recommendedTitleSize: 42,
    recommendedBodySize: 20,
    lineHeightRatio: 1.5,
  },
  notes: [
    "掘金用户以技术开发者为主，封面设计要体现技术感",
    "推荐使用代码编辑器风格的配色（如 VS Code 主题色）",
    "标题要突出技术关键词和实用价值",
    "可以在封面中展示代码片段或技术架构图",
    "避免过于花哨的设计，保持简洁专业",
    "推荐使用深色背景（#1e1e1e、#282c34）+ 亮色文字",
    "技术标签和关键词可以使用品牌色（#1e80ff）高亮",
  ],
  guideUrl: "https://juejin.cn/creator",
};

export default juejinSpec;
