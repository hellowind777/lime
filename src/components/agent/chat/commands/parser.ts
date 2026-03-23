import { CODEX_SLASH_COMMANDS } from "./catalog";
import type {
  CodexSlashCommandDefinition,
  ParsedCodexSlashCommand,
} from "./types";

const SLASH_COMMAND_REGEX = /^\/([a-zA-Z0-9._-]+)(?:\s+([\s\S]*))?$/;

const COMMAND_LOOKUP = new Map<string, CodexSlashCommandDefinition>();

for (const command of CODEX_SLASH_COMMANDS) {
  COMMAND_LOOKUP.set(command.commandName.toLowerCase(), command);
  for (const alias of command.aliases) {
    COMMAND_LOOKUP.set(alias.toLowerCase(), command);
  }
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/^\//, "").toLowerCase();
}

export function resolveCodexSlashCommand(
  commandName: string,
): CodexSlashCommandDefinition | null {
  return COMMAND_LOOKUP.get(commandName.trim().toLowerCase()) ?? null;
}

export function parseCodexSlashCommand(
  content: string,
): ParsedCodexSlashCommand | null {
  const match = content.match(SLASH_COMMAND_REGEX);
  if (!match) {
    return null;
  }

  const [, commandName, userInput] = match;
  const definition = resolveCodexSlashCommand(commandName);
  if (!definition) {
    return null;
  }

  return {
    definition,
    commandName: commandName.toLowerCase(),
    userInput: userInput?.trim() || "",
    rawContent: content,
  };
}

export function filterCodexSlashCommands(
  query: string,
  options: { includeUnsupported?: boolean } = {},
): CodexSlashCommandDefinition[] {
  const { includeUnsupported = true } = options;
  const normalizedQuery = normalizeQuery(query);
  const candidates = includeUnsupported
    ? CODEX_SLASH_COMMANDS
    : CODEX_SLASH_COMMANDS.filter((command) => command.support === "supported");

  if (!normalizedQuery) {
    return candidates;
  }

  return candidates.filter((command) => {
    const haystacks = [
      command.commandName,
      command.commandPrefix,
      command.label,
      command.description,
      ...command.aliases,
    ];
    return haystacks.some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });
}

export function getSupportedCodexSlashCommands() {
  return CODEX_SLASH_COMMANDS.filter(
    (command) => command.support === "supported",
  );
}

export function getUnsupportedCodexSlashCommands() {
  return CODEX_SLASH_COMMANDS.filter(
    (command) => command.support === "unsupported",
  );
}
