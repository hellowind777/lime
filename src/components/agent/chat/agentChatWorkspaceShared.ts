import type { ThemeType } from "@/components/content-creator/types";
import type { AsterSubagentSessionInfo } from "@/lib/api/agentRuntime";
import type { ProjectType } from "@/lib/api/project";

const SUPPORTED_ENTRY_THEMES: ThemeType[] = [
  "general",
  "social-media",
  "poster",
  "music",
  "knowledge",
  "planning",
  "document",
  "video",
  "novel",
];

export function normalizeInitialTheme(value?: string): ThemeType {
  if (!value) {
    return "general";
  }
  if (SUPPORTED_ENTRY_THEMES.includes(value as ThemeType)) {
    return value as ThemeType;
  }
  return "general";
}

export function deriveCurrentSessionRuntimeStatus(params: {
  isSending: boolean;
  queuedTurnCount: number;
  turns: Array<{ status: string }>;
}): AsterSubagentSessionInfo["runtime_status"] | undefined {
  if (
    params.isSending ||
    params.turns.some((turn) => turn.status === "running")
  ) {
    return "running";
  }
  if (params.queuedTurnCount > 0) {
    return "queued";
  }

  const latestStatus = params.turns[params.turns.length - 1]?.status;
  switch (latestStatus) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "aborted":
      return "aborted";
    default:
      return undefined;
  }
}

export function deriveLatestTurnRuntimeStatus(
  turns: Array<{ status: string }>,
): AsterSubagentSessionInfo["runtime_status"] | undefined {
  switch (turns[turns.length - 1]?.status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "aborted":
      return "aborted";
    default:
      return undefined;
  }
}

export function projectTypeToTheme(projectType: ProjectType): ThemeType {
  if (projectType === "persistent" || projectType === "temporary") {
    return "general";
  }
  return projectType as ThemeType;
}
