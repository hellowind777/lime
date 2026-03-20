import { describe, expect, it } from "vitest";

import {
  buildRecommendationPrompt,
  getContextualRecommendations,
  isTeamRuntimeRecommendation,
} from "./contextualRecommendations";

describe("getContextualRecommendations", () => {
  it("社媒空白场景应返回起稿类推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "social-media",
      input: "",
      creationMode: "guided",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: true,
      selectedText: "",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("选题");
  });

  it("社媒有正文时应优先返回改写类推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "social-media",
      input: "",
      creationMode: "hybrid",
      entryTaskType: "rewrite",
      platform: "wechat",
      hasCanvasContent: true,
      hasContentId: true,
      selectedText: "",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("润色");
  });

  it("社媒有输入时应返回输入相关推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "social-media",
      input: "春季敏感肌修护",
      creationMode: "fast",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: false,
      selectedText: "",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[1]).toContain("春季敏感肌修护");
  });

  it("非社媒主题应走主题兜底推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "planning",
      input: "",
      creationMode: "guided",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: false,
      selectedText: "",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("计划");
  });

  it("通用主题应返回通用对话推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "general",
      input: "",
      creationMode: "guided",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: false,
      selectedText: "",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("Team");
  });

  it("开启多代理偏好后应优先返回 team runtime 测试提示词", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "general",
      input: "实现 team workspace UI 和实时订阅",
      creationMode: "guided",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: false,
      selectedText: "",
      subagentEnabled: true,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("Team");
    expect(recommendations[0]?.[1]).toContain("team runtime");
  });

  it("未开启多代理偏好时也应给出 team 测试入口，并提示先开启开关", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "general",
      input: "",
      creationMode: "guided",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: false,
      selectedText: "",
      subagentEnabled: false,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("Team");
    expect(recommendations[0]?.[1]).toContain("多代理");
  });

  it("文档主题应返回办公文档推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "document",
      input: "",
      creationMode: "guided",
      entryTaskType: "direct",
      platform: "xiaohongshu",
      hasCanvasContent: false,
      hasContentId: false,
      selectedText: "",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("公文");
  });

  it("社媒有选中文本时应优先返回选区改写推荐", () => {
    const recommendations = getContextualRecommendations({
      activeTheme: "social-media",
      input: "",
      creationMode: "guided",
      entryTaskType: "rewrite",
      platform: "wechat",
      hasCanvasContent: true,
      hasContentId: true,
      selectedText: "这是一段待优化的原文内容。",
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.[0]).toContain("选中");
  });

  it("构建推荐提示词时应注入选中文本上下文", () => {
    const prompt = buildRecommendationPrompt("请帮我改写内容。", "这是原文。");
    expect(prompt).toContain("请帮我改写内容。");
    expect(prompt).toContain("[参考选中内容]");
    expect(prompt).toContain("这是原文。");
  });

  it("无选中文本时应保持原始提示词", () => {
    const prompt = buildRecommendationPrompt("请帮我润色。", "");
    expect(prompt).toBe("请帮我润色。");
  });

  it("选中文本过长时应截断注入", () => {
    const longSelectedText = "a".repeat(380);
    const prompt = buildRecommendationPrompt("请总结。", longSelectedText);
    expect(prompt).toContain("[参考选中内容]");
    expect(prompt).toContain("…");
  });

  it("关闭附带选区开关时应忽略选中文本", () => {
    const prompt = buildRecommendationPrompt(
      "请润色文稿。",
      "这是一段选中的文稿内容。",
      false,
    );
    expect(prompt).toBe("请润色文稿。");
  });

  it("应识别 team runtime 类推荐", () => {
    expect(
      isTeamRuntimeRecommendation(
        "Team 冒烟测试",
        "请按 team runtime 方式做一次冒烟测试：创建 explorer 与 executor 两个子代理并行处理。",
      ),
    ).toBe(true);
  });

  it("普通推荐不应被识别为 team runtime", () => {
    expect(
      isTeamRuntimeRecommendation(
        "需求澄清助手",
        "请先帮我澄清当前问题：目标是什么、已知条件是什么、缺失信息是什么。",
      ),
    ).toBe(false);
  });
});
