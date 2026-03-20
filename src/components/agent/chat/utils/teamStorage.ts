import type { TeamDefinition } from "./teamDefinitions";
import {
  buildTeamSelectionReference,
  normalizeTeamDefinition,
  type TeamSelectionReference,
} from "./teamDefinitions";

const CUSTOM_TEAM_STORAGE_KEY = "lime.chat.custom_teams.v1";
const TEAM_SELECTION_STORAGE_KEY_PREFIX = "lime.chat.team_selection.v1";

function normalizeThemeScope(theme?: string | null): string {
  const normalized = theme?.trim().toLowerCase();
  return normalized || "general";
}

function getTeamSelectionStorageKey(theme?: string | null): string {
  return `${TEAM_SELECTION_STORAGE_KEY_PREFIX}.${normalizeThemeScope(theme)}`;
}

export function loadCustomTeams(): TeamDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEAM_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Array<Partial<TeamDefinition>>;
    return parsed
      .map((team) => normalizeTeamDefinition(team))
      .filter((team): team is TeamDefinition => Boolean(team))
      .filter((team) => team.source === "custom");
  } catch {
    return [];
  }
}

export function saveCustomTeams(teams: TeamDefinition[]): void {
  try {
    localStorage.setItem(CUSTOM_TEAM_STORAGE_KEY, JSON.stringify(teams));
  } catch {
    // ignore persistence errors
  }
}

export function persistSelectedTeam(
  team: TeamDefinition | null,
  theme?: string | null,
): void {
  try {
    const key = getTeamSelectionStorageKey(theme);
    if (!team) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(
      key,
      JSON.stringify(buildTeamSelectionReference(team)),
    );
  } catch {
    // ignore persistence errors
  }
}

export function loadSelectedTeamReference(
  theme?: string | null,
): TeamSelectionReference | null {
  try {
    const raw = localStorage.getItem(getTeamSelectionStorageKey(theme));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<TeamSelectionReference>;
    if (
      typeof parsed?.id !== "string" ||
      !parsed.id.trim() ||
      (parsed.source !== "builtin" && parsed.source !== "custom")
    ) {
      return null;
    }
    return {
      id: parsed.id.trim(),
      source: parsed.source,
    };
  } catch {
    return null;
  }
}
