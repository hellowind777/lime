export interface ChatToolPreferences {
  webSearch: boolean;
  thinking: boolean;
}

export const DEFAULT_CHAT_TOOL_PREFERENCES: ChatToolPreferences = {
  webSearch: false,
  thinking: false,
};

const CHAT_TOOL_PREFERENCES_KEY = "proxycast.chat.tool_preferences.v1";

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export function loadChatToolPreferences(): ChatToolPreferences {
  try {
    const raw = localStorage.getItem(CHAT_TOOL_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_CHAT_TOOL_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<ChatToolPreferences>;
    return {
      webSearch: normalizeBoolean(
        parsed.webSearch,
        DEFAULT_CHAT_TOOL_PREFERENCES.webSearch,
      ),
      thinking: normalizeBoolean(
        parsed.thinking,
        DEFAULT_CHAT_TOOL_PREFERENCES.thinking,
      ),
    };
  } catch {
    return DEFAULT_CHAT_TOOL_PREFERENCES;
  }
}

export function saveChatToolPreferences(preferences: ChatToolPreferences): void {
  try {
    localStorage.setItem(
      CHAT_TOOL_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // ignore persistence errors
  }
}
