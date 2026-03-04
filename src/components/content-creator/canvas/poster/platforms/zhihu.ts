/**
 * @file zhihu.ts
 * @description 知乎平台规范
 * @module components/content-creator/canvas/poster/platforms/zhihu
 */

import type { PlatformSpec } from "./types";

/**
 * 知乎平台规范
 */
export const zhihuSpec: PlatformSpec = {
  id: "custom",
  name: "知乎",
  icon: "zhihu",
  description: "知乎文章封面和回答配图规范",
  sizes: [
    {
      name: "文章封面",
      width: 1200,
      height: 500,
      aspectRatio: "12:5",
      usage: "知乎文章封面图，显示在文章顶部",
      recommended: true,
    },
    {
      name: "回答配图",
      width: 800,
      height: 600,
      aspectRatio: "4:3",
      usage: "回答中的配图，适合图文混排",
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
    top: 60,
    bottom: 60,
    left: 80,
    right: 80,
    description: "预留边距，确保文字和关键元素不被裁切",
  },
  fileSpec: {
    formats: ["jpg", "png", "gif"],
    maxSizeKB: 5120, // 5MB
    recommendedDPI: 72,
    colorMode: "RGB",
  },
  textSpec: {
    minFontSize: 16,
    recommendedTitleSize: 36,
    recommendedBodySize: 18,
    lineHeightRatio: 1.6,
  },
  notes: [
    "知乎用户重视内容深度和逻辑性，标题要简洁专业",
    "文章封面建议使用科技感或专业感的设计风格",
    "避免过度营销化的设计，保持专业和克制",
    "配图要与内容相关，避免纯装饰性图片",
    "标题字号不宜过大，保持专业感",
    "推荐使用深色背景 + 浅色文字，或浅色背景 + 深色文字的高对比度设计",
  ],
  guideUrl: "https://www.zhihu.com/creator",
};

export default zhihuSpec;
