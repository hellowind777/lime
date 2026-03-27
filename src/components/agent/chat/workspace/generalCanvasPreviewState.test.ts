import { describe, expect, it } from "vitest";
import { hasRenderableGeneralCanvasPreview } from "./generalCanvasPreviewState";

describe("hasRenderableGeneralCanvasPreview", () => {
  it("关闭状态或空白内容不应视为真实预览", () => {
    expect(
      hasRenderableGeneralCanvasPreview({
        isOpen: false,
        content: "# 草稿",
      }),
    ).toBe(false);

    expect(
      hasRenderableGeneralCanvasPreview({
        isOpen: true,
        content: "   ",
      }),
    ).toBe(false);
  });

  it("打开且有正文时应视为真实预览", () => {
    expect(
      hasRenderableGeneralCanvasPreview({
        isOpen: true,
        content: "# 草稿\n\n这里有内容",
      }),
    ).toBe(true);
  });
});
