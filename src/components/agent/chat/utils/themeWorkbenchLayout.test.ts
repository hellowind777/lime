import { describe, expect, it } from "vitest";
import {
  resolveThemeWorkbenchFloatingChromeInset,
  resolveThemeWorkbenchLayoutBottomSpacing,
} from "./themeWorkbenchLayout";

describe("themeWorkbenchLayout", () => {
  it("存在浮动输入区时应按运行态返回 chrome inset", () => {
    expect(
      resolveThemeWorkbenchFloatingChromeInset({
        showFloatingInputOverlay: true,
        hasCanvasContent: false,
        themeWorkbenchRunState: "idle",
        gateStatus: "idle",
      }),
    ).toBe("88px");

    expect(
      resolveThemeWorkbenchFloatingChromeInset({
        showFloatingInputOverlay: true,
        hasCanvasContent: false,
        themeWorkbenchRunState: "auto_running",
        gateStatus: "idle",
      }),
    ).toBe("168px");

    expect(
      resolveThemeWorkbenchFloatingChromeInset({
        showFloatingInputOverlay: true,
        hasCanvasContent: true,
        themeWorkbenchRunState: "await_user_decision",
        gateStatus: "waiting",
      }),
    ).toBe("12px");
  });

  it("context workspace 启用时不应再与 shell 底部 inset 叠加占位", () => {
    expect(
      resolveThemeWorkbenchLayoutBottomSpacing({
        contextWorkspaceEnabled: true,
        showFloatingInputOverlay: true,
        hasCanvasContent: false,
        themeWorkbenchRunState: "idle",
        gateStatus: "idle",
      }),
    ).toEqual({
      shellBottomInset: "0",
      messageViewportBottomPadding: "88px",
    });
  });

  it("非 context workspace 模式应继续由 shell 承担底部留白", () => {
    expect(
      resolveThemeWorkbenchLayoutBottomSpacing({
        contextWorkspaceEnabled: false,
        showFloatingInputOverlay: true,
        hasCanvasContent: false,
        themeWorkbenchRunState: "idle",
        gateStatus: "idle",
      }),
    ).toEqual({
      shellBottomInset: "88px",
      messageViewportBottomPadding: "128px",
    });
  });
});
