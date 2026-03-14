import { describe, expect, it } from "vitest";
import { collectConversationSkillNames } from "./harnessSkills";
import type { Message } from "../types";

function createMessage(
  overrides: Partial<Message> & Pick<Message, "role" | "content">,
): Message {
  return {
    id: `${overrides.role}-${overrides.content}`,
    timestamp: new Date("2026-03-14T09:00:00.000Z"),
    ...overrides,
  };
}

describe("collectConversationSkillNames", () => {
  it("应提取用户消息中显式引用的 slash skill", () => {
    const messages: Message[] = [
      createMessage({
        role: "user",
        content: "/research 帮我整理这个主题",
      }),
      createMessage({
        role: "assistant",
        content: "好的，我先开始处理。",
      }),
      createMessage({
        role: "user",
        content: "/typesetting 输出可发布版本",
      }),
    ];

    expect(collectConversationSkillNames(messages)).toEqual([
      "research",
      "typesetting",
    ]);
  });

  it("应忽略普通消息、助手消息与重复 skill", () => {
    const messages: Message[] = [
      createMessage({
        role: "user",
        content: "先帮我看一下当前稿子",
      }),
      createMessage({
        role: "assistant",
        content: "/research 这不是用户消息，不应计入",
      }),
      createMessage({
        role: "user",
        content: "/research 第一轮",
      }),
      createMessage({
        role: "user",
        content: "/research 第二轮",
      }),
    ];

    expect(collectConversationSkillNames(messages)).toEqual(["research"]);
  });
});
