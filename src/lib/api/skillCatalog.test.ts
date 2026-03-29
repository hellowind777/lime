import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { siteListAdaptersMock } = vi.hoisted(() => ({
  siteListAdaptersMock: vi.fn(),
}));

vi.mock("../webview-api", () => ({
  siteListAdapters: siteListAdaptersMock,
}));

import { clearSkillCatalogCache, getSkillCatalog } from "./skillCatalog";

describe("skillCatalog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    siteListAdaptersMock.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
    clearSkillCatalogCache();
    vi.restoreAllMocks();
  });

  it("应把运行时站点 adapter 合并为技能目录项，并为新站点补齐分组", async () => {
    siteListAdaptersMock.mockResolvedValue([
      {
        name: "bilibili/search",
        domain: "search.bilibili.com",
        description: "按关键词采集 B 站视频搜索结果。",
        read_only: true,
        capabilities: ["search", "video", "research"],
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "搜索关键词",
              example: "AI Agent",
            },
            limit: {
              type: "integer",
              description: "返回条目数量上限",
              example: 5,
            },
          },
          required: ["query"],
          additionalProperties: true,
        },
        example_args: {
          query: "AI Agent",
          limit: 5,
        },
        example: 'bilibili/search {"query":"AI Agent","limit":5}',
        source_kind: "bundled",
        source_version: "2026-03-25",
      },
      {
        name: "github/search",
        domain: "github.com",
        description: "按关键词采集 GitHub 仓库搜索结果。",
        read_only: true,
        capabilities: ["search", "repository", "research"],
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "搜索关键词",
              example: "AI Agent",
            },
          },
          required: ["query"],
          additionalProperties: true,
        },
        example_args: {
          query: "AI Agent",
        },
        example: 'github/search {"query":"AI Agent"}',
        source_kind: "bundled",
        source_version: "2026-03-25",
      },
    ]);

    const catalog = await getSkillCatalog();
    const bilibiliSkill = catalog.items.find(
      (item) => item.id === "site-adapter-bilibili-search",
    );

    expect(bilibiliSkill).toEqual(
      expect.objectContaining({
        title: "Bilibili 视频检索",
        groupKey: "bilibili",
        skillType: "site",
        themeTarget: "video",
        siteCapabilityBinding: expect.objectContaining({
          adapterName: "bilibili/search",
          autoRun: true,
          requireAttachedSession: true,
          saveMode: "current_content",
        }),
        execution: expect.objectContaining({
          kind: "site_adapter",
        }),
      }),
    );
    expect(bilibiliSkill?.slotSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "query",
          label: "检索词",
          required: true,
          defaultValue: "AI Agent",
        }),
        expect.objectContaining({
          key: "limit",
          label: "条目上限",
          required: false,
          defaultValue: "5",
        }),
      ]),
    );
    expect(
      catalog.groups.find((group) => group.key === "bilibili"),
    ).toEqual(
      expect.objectContaining({
        title: "Bilibili",
        itemCount: expect.any(Number),
      }),
    );
    expect(
      catalog.items.some((item) => item.id === "site-adapter-github-search"),
    ).toBe(false);
    expect(
      catalog.items.some(
        (item) => item.siteCapabilityBinding?.adapterName === "github/search",
      ),
    ).toBe(true);
  });

  it("站点 adapter 读取失败时应回退到原有 seeded 目录", async () => {
    siteListAdaptersMock.mockRejectedValue(new Error("bridge unavailable"));

    const catalog = await getSkillCatalog();

    expect(catalog.items.some((item) => item.id === "github-repo-radar")).toBe(
      true,
    );
    expect(
      catalog.items.some((item) => item.id === "site-adapter-bilibili-search"),
    ).toBe(false);
  });
});
