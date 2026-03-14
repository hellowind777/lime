import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupMountedRoots,
  flushEffects,
  mountHarness,
  setupReactActEnvironment,
  type MountedRoot,
} from "@/components/workspace/hooks/testUtils";
import { CharacterPanel } from "./CharacterPanel";
import { WorldBuildingPanel } from "./WorldBuildingPanel";
import { OutlinePanel } from "./OutlinePanel";

type OutlineTreeNodeMock = {
  id?: string;
  parent_id?: string;
  children: OutlineTreeNodeMock[];
  [key: string]: unknown;
};

const {
  mockListCharacters,
  mockCreateCharacter,
  mockUpdateCharacter,
  mockDeleteCharacter,
  mockGetWorldBuilding,
  mockUpdateWorldBuilding,
  mockListOutlineNodes,
  mockCreateOutlineNode,
  mockUpdateOutlineNode,
  mockDeleteOutlineNode,
} = vi.hoisted(() => ({
  mockListCharacters: vi.fn(),
  mockCreateCharacter: vi.fn(),
  mockUpdateCharacter: vi.fn(),
  mockDeleteCharacter: vi.fn(),
  mockGetWorldBuilding: vi.fn(),
  mockUpdateWorldBuilding: vi.fn(),
  mockListOutlineNodes: vi.fn(),
  mockCreateOutlineNode: vi.fn(),
  mockUpdateOutlineNode: vi.fn(),
  mockDeleteOutlineNode: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/memory", () => ({
  listCharacters: mockListCharacters,
  createCharacter: mockCreateCharacter,
  updateCharacter: mockUpdateCharacter,
  deleteCharacter: mockDeleteCharacter,
  getWorldBuilding: mockGetWorldBuilding,
  updateWorldBuilding: mockUpdateWorldBuilding,
  listOutlineNodes: mockListOutlineNodes,
  createOutlineNode: mockCreateOutlineNode,
  updateOutlineNode: mockUpdateOutlineNode,
  deleteOutlineNode: mockDeleteOutlineNode,
  buildOutlineTree: vi.fn((nodes: Array<Record<string, unknown>>) => {
    const byId = new Map(
      nodes.map((node) => [
        String(node.id),
        { ...node, children: [] } as OutlineTreeNodeMock,
      ]),
    );

    const roots: OutlineTreeNodeMock[] = [];
    byId.forEach((node) => {
      const parentId =
        typeof node.parent_id === "string" ? node.parent_id : undefined;
      if (parentId && byId.has(parentId)) {
        const parent = byId.get(parentId);
        parent?.children.push(node);
        return;
      }
      roots.push(node);
    });

    return roots;
  }),
}));

setupReactActEnvironment();

const mountedRoots: MountedRoot[] = [];

describe("ProjectMemoryPanels", () => {
  beforeEach(() => {
    mockListCharacters.mockResolvedValue([
      {
        id: "character-1",
        project_id: "project-1",
        name: "林岚",
        aliases: ["岚姐"],
        description: "冷静的调查记者，负责追查主线事件。",
        personality: "克制、敏锐、有压迫感",
        background: "曾在地方报社工作，后独立调查。",
        appearance: "短发，常穿深色风衣。",
        relationships: [],
        is_main: true,
        order: 0,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ]);

    mockGetWorldBuilding.mockResolvedValue({
      project_id: "project-1",
      description: "一座依靠旧工业遗迹维持运转的沿海城市。",
      era: "近未来工业衰退期",
      locations: "旧港区、地下档案库",
      rules: "能源与媒体都被少数财团垄断。",
      updated_at: "2026-03-01T00:00:00.000Z",
    });

    mockListOutlineNodes.mockResolvedValue([
      {
        id: "node-1",
        project_id: "project-1",
        title: "第一幕",
        content: "建立主角与核心冲突。",
        order: 0,
        expanded: true,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "node-2",
        project_id: "project-1",
        parent_id: "node-1",
        title: "冲突升级",
        content: "主角发现媒体造假与能源事故有关。",
        order: 1,
        expanded: true,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ]);

    mockCreateCharacter.mockResolvedValue(undefined);
    mockUpdateCharacter.mockResolvedValue(undefined);
    mockDeleteCharacter.mockResolvedValue(undefined);
    mockUpdateWorldBuilding.mockResolvedValue(undefined);
    mockCreateOutlineNode.mockResolvedValue(undefined);
    mockUpdateOutlineNode.mockResolvedValue(undefined);
    mockDeleteOutlineNode.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanupMountedRoots(mountedRoots);
    vi.clearAllMocks();
  });

  it("CharacterPanel 应渲染新的角色工作台摘要", async () => {
    const { container } = mountHarness(
      CharacterPanel,
      { projectId: "project-1" },
      mountedRoots,
    );

    await flushEffects();

    const text = container.textContent ?? "";
    expect(text).toContain("角色、关系与叙事职能");
    expect(text).toContain("主要角色");
    expect(text).toContain("林岚");
  });

  it("WorldBuildingPanel 应渲染新的世界观工作台摘要", async () => {
    const { container } = mountHarness(
      WorldBuildingPanel,
      { projectId: "project-1" },
      mountedRoots,
    );

    await flushEffects();

    const text = container.textContent ?? "";
    expect(text).toContain("世界观、时代与运行规则");
    expect(text).toContain("已填写模块");
    expect(text).toContain("沿海城市");
  });

  it("OutlinePanel 应渲染新的大纲结构工作台", async () => {
    const { container } = mountHarness(
      OutlinePanel,
      { projectId: "project-1" },
      mountedRoots,
    );

    await flushEffects();

    const text = container.textContent ?? "";
    expect(text).toContain("大纲层级与章节骨架");
    expect(text).toContain("结构树");
    expect(text).toContain("第一幕");
    expect(text).toContain("冲突升级");
  });
});
