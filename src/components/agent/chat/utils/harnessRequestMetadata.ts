import type { CreationMode } from "../components/types";
import type { BrowserTaskRequirement } from "../types";
import type { TeamRoleDefinition, TeamDefinitionSource } from "./teamDefinitions";

export interface BuildHarnessRequestMetadataOptions {
  base?: Record<string, unknown>;
  theme: string;
  creationMode: CreationMode;
  chatMode: "agent" | "general" | "creator";
  webSearchEnabled: boolean;
  thinkingEnabled: boolean;
  taskModeEnabled: boolean;
  subagentModeEnabled: boolean;
  sessionMode: "default" | "theme_workbench";
  gateKey?: string | null;
  runTitle?: string | null;
  contentId?: string | null;
  browserRequirement?: BrowserTaskRequirement | null;
  browserRequirementReason?: string | null;
  browserLaunchUrl?: string | null;
  browserAssistProfileKey?: string | null;
  preferredTeamPresetId?: string | null;
  selectedTeamId?: string | null;
  selectedTeamSource?: TeamDefinitionSource | null;
  selectedTeamLabel?: string | null;
  selectedTeamSummary?: string | null;
  selectedTeamRoles?: TeamRoleDefinition[] | null;
}

export function extractExistingHarnessMetadata(
  requestMetadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const harnessValue = requestMetadata?.harness;
  if (
    typeof harnessValue !== "object" ||
    harnessValue === null ||
    Array.isArray(harnessValue)
  ) {
    return undefined;
  }

  return harnessValue as Record<string, unknown>;
}

export function buildHarnessRequestMetadata(
  options: BuildHarnessRequestMetadataOptions,
): Record<string, unknown> {
  const {
    base,
    theme,
    creationMode,
    chatMode,
    webSearchEnabled,
    thinkingEnabled,
    taskModeEnabled,
    subagentModeEnabled,
    sessionMode,
    gateKey,
    runTitle,
    contentId,
    browserRequirement,
    browserRequirementReason,
    browserLaunchUrl,
    browserAssistProfileKey,
    preferredTeamPresetId,
    selectedTeamId,
    selectedTeamSource,
    selectedTeamLabel,
    selectedTeamSummary,
    selectedTeamRoles,
  } = options;

  return {
    ...(base || {}),
    theme,
    creation_mode: creationMode,
    chat_mode: chatMode,
    web_search_enabled: webSearchEnabled,
    thinking_enabled: thinkingEnabled,
    task_mode_enabled: taskModeEnabled,
    subagent_mode_enabled: subagentModeEnabled,
    session_mode: sessionMode,
    gate_key:
      sessionMode === "theme_workbench" ? gateKey || undefined : undefined,
    run_title: runTitle || undefined,
    content_id: contentId || undefined,
    preferred_team_preset_id: preferredTeamPresetId || undefined,
    selected_team_id: selectedTeamId || undefined,
    selected_team_source: selectedTeamSource || undefined,
    selected_team_label: selectedTeamLabel || undefined,
    selected_team_summary: selectedTeamSummary || undefined,
    selected_team_roles:
      selectedTeamRoles && selectedTeamRoles.length > 0
        ? selectedTeamRoles.map((role) => ({
            id: role.id,
            label: role.label,
            summary: role.summary,
            profile_id: role.profileId || undefined,
            role_key: role.roleKey || undefined,
            skill_ids:
              role.skillIds && role.skillIds.length > 0
                ? [...role.skillIds]
                : undefined,
          }))
        : undefined,
    browser_requirement: browserRequirement || undefined,
    browser_requirement_reason: browserRequirementReason || undefined,
    browser_launch_url: browserLaunchUrl || undefined,
    browser_user_step_required:
      browserRequirement === "required_with_user_step",
    browser_assist: browserAssistProfileKey
      ? {
          enabled: true,
          profile_key: browserAssistProfileKey,
          preferred_backend: "cdp_direct",
          auto_launch: true,
          stream_mode: "both",
        }
      : undefined,
  };
}
