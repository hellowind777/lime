import { describe, expect, it } from "vitest";
import { resolveAppVersion } from "./appVersion";

describe("appVersion", () => {
  it("优先返回首个有效版本号", () => {
    expect(resolveAppVersion("0.79.1", "0.79.0")).toBe("0.79.1");
    expect(resolveAppVersion("unknown", "0.79.0")).toBe("0.79.0");
    expect(resolveAppVersion("", "  ", "0.79.0")).toBe("0.79.0");
  });

  it("无候选值时回退 unknown", () => {
    expect(resolveAppVersion(undefined, null, "unknown")).toBe("unknown");
  });
});
