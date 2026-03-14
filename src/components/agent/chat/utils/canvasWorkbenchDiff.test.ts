import { describe, expect, it } from "vitest";
import { buildCanvasWorkbenchDiff } from "./canvasWorkbenchDiff";

describe("buildCanvasWorkbenchDiff", () => {
  it("应标记新增、删除与上下文行", () => {
    expect(
      buildCanvasWorkbenchDiff(
        ["标题", "旧段落", "结尾"].join("\n"),
        ["标题", "新段落", "结尾", "附录"].join("\n"),
      ),
    ).toEqual([
      { type: "context", value: "标题" },
      { type: "remove", value: "旧段落" },
      { type: "add", value: "新段落" },
      { type: "context", value: "结尾" },
      { type: "add", value: "附录" },
    ]);
  });

  it("空内容比较应返回纯新增或纯删除", () => {
    expect(buildCanvasWorkbenchDiff("", "第一行\n第二行")).toEqual([
      { type: "add", value: "第一行" },
      { type: "add", value: "第二行" },
    ]);

    expect(buildCanvasWorkbenchDiff("仅一行", "")).toEqual([
      { type: "remove", value: "仅一行" },
    ]);
  });
});
