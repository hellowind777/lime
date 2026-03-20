export interface TeamPresetOption {
  id: string;
  label: string;
  description: string;
  theme: string;
  profileLabels: string[];
  profileIds: string[];
  roles: Array<{
    id: string;
    label: string;
    summary: string;
    profileId?: string;
    roleKey?: string;
    skillIds?: string[];
  }>;
}

export const TEAM_PRESET_OPTIONS: TeamPresetOption[] = [
  {
    id: "code-triage-team",
    label: "代码排障团队",
    description: "分析、实现、验证三段式闭环，适合工程问题与多文件改动。",
    theme: "engineering",
    profileLabels: ["分析", "执行", "验证"],
    profileIds: ["code-explorer", "code-executor", "code-verifier"],
    roles: [
      {
        id: "explorer",
        label: "分析",
        summary: "先收敛问题边界、事实证据与影响范围，再给实现建议。",
        profileId: "code-explorer",
        roleKey: "explorer",
        skillIds: ["repo-exploration", "source-grounding"],
      },
      {
        id: "executor",
        label: "执行",
        summary: "在明确边界内落地改动，并说明实现点与验证结果。",
        profileId: "code-executor",
        roleKey: "executor",
        skillIds: ["bounded-implementation", "verification-report"],
      },
      {
        id: "verifier",
        label: "验证",
        summary: "补测试、做回归和风险复核，负责最终收口。",
        profileId: "code-verifier",
        roleKey: "verifier",
        skillIds: ["verification-report", "source-grounding"],
      },
    ],
  },
  {
    id: "research-team",
    label: "研究团队",
    description: "适合多源调研、事实归并、方案沉淀与文档汇总。",
    theme: "research",
    profileLabels: ["调研", "写作", "复核"],
    profileIds: ["research-analyst", "doc-writer", "code-verifier"],
    roles: [
      {
        id: "researcher",
        label: "调研",
        summary: "负责搜集来源、比对差异并抽取可支撑的事实结论。",
        profileId: "research-analyst",
        roleKey: "researcher",
        skillIds: ["source-grounding", "structured-writing"],
      },
      {
        id: "writer",
        label: "写作",
        summary: "把研究结果整理成可评审、可执行的方案或文档。",
        profileId: "doc-writer",
        roleKey: "writer",
        skillIds: ["structured-writing"],
      },
      {
        id: "reviewer",
        label: "复核",
        summary: "检查事实口径、逻辑闭环与待验证项，避免结论失真。",
        profileId: "code-verifier",
        roleKey: "reviewer",
        skillIds: ["verification-report", "source-grounding"],
      },
    ],
  },
  {
    id: "content-creation-team",
    label: "内容创作团队",
    description: "适合创意拆分、内容起草、发布前复核。",
    theme: "content",
    profileLabels: ["创意", "起草", "复核"],
    profileIds: ["content-ideator", "doc-writer", "content-reviewer"],
    roles: [
      {
        id: "ideator",
        label: "创意",
        summary: "产出多个有区分度的创意方向，并说明适用场景。",
        profileId: "content-ideator",
        roleKey: "ideator",
        skillIds: ["structured-writing"],
      },
      {
        id: "writer",
        label: "起草",
        summary: "将创意方向扩成首版内容结构与文稿。",
        profileId: "doc-writer",
        roleKey: "writer",
        skillIds: ["structured-writing"],
      },
      {
        id: "reviewer",
        label: "复核",
        summary: "负责风格一致性、表达质量与发布风险检查。",
        profileId: "content-reviewer",
        roleKey: "reviewer",
        skillIds: ["verification-report", "structured-writing"],
      },
    ],
  },
];

export function getTeamPresetOption(
  presetId?: string | null,
): TeamPresetOption | undefined {
  if (!presetId) {
    return undefined;
  }
  return TEAM_PRESET_OPTIONS.find((option) => option.id === presetId.trim());
}

export function resolveDefaultTeamPresetId(theme?: string | null): string {
  switch (theme?.trim().toLowerCase()) {
    case "knowledge":
    case "planning":
    case "document":
      return "research-team";
    case "social-media":
    case "poster":
    case "music":
    case "video":
    case "novel":
      return "content-creation-team";
    case "general":
    default:
      return "code-triage-team";
  }
}
