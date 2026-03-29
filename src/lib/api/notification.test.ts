import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationService } from "@/lib/notificationService";
import { showSystemNotification } from "./notification";

vi.mock("@/lib/notificationService", () => ({
  notificationService: {
    notify: vi.fn(),
  },
}));

describe("notification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应代理系统通知命令", async () => {
    vi.mocked(notificationService.notify).mockResolvedValueOnce(undefined);

    await expect(
      showSystemNotification({
        title: "title",
        body: "body",
        icon: "icon",
      }),
    ).resolves.toBeUndefined();
    expect(notificationService.notify).toHaveBeenCalledWith({
      title: "title",
      body: "body",
      type: "info",
    });
  });
});
