/**
 * @file index.ts
 * @description 社媒内容模板索引
 * @module components/content-creator/templates/social-media
 */

export { trendingTopicTemplate } from "./trending-topic";
export { industryAnalysisTemplate } from "./industry-analysis";
export { techSharingTemplate } from "./tech-sharing";
export { productLaunchTemplate } from "./product-launch";
export { visualContentTemplate } from "./visual-content";

export type { ContentTemplate } from "./trending-topic";

/**
 * 所有社媒内容模板
 */
export const socialMediaTemplates = {
  "trending-topic": () => import("./trending-topic"),
  "industry-analysis": () => import("./industry-analysis"),
  "tech-sharing": () => import("./tech-sharing"),
  "product-launch": () => import("./product-launch"),
  "visual-content": () => import("./visual-content"),
};

/**
 * 根据内容类型获取推荐模板
 */
export function getRecommendedTemplate(contentType: string): string | null {
  const templateMap: Record<string, string> = {
    热点借势: "trending-topic",
    行业洞察: "industry-analysis",
    技术分享: "tech-sharing",
    产品发布: "product-launch",
    知识干货: "visual-content",
  };

  return templateMap[contentType] || null;
}
