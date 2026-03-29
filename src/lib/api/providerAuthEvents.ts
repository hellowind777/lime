import { safeListen } from "@/lib/dev-bridge";
import type { UnlistenFn } from "@tauri-apps/api/event";

export interface OAuthUrlEventPayload {
  auth_url: string;
}

export interface GeminiOAuthUrlEventPayload extends OAuthUrlEventPayload {
  session_id: string;
}

export const ANTIGRAVITY_AUTH_URL_EVENT = "antigravity-auth-url";
export const CLAUDE_OAUTH_AUTH_URL_EVENT = "claude-oauth-auth-url";
export const CODEX_AUTH_URL_EVENT = "codex-auth-url";
export const GEMINI_AUTH_URL_EVENT = "gemini-auth-url";

async function onProviderAuthEvent<TPayload>(
  eventName: string,
  callback: (payload: TPayload) => void,
): Promise<UnlistenFn> {
  return safeListen<TPayload>(eventName, (event) => {
    callback(event.payload);
  });
}

export async function onAntigravityAuthUrl(
  callback: (payload: OAuthUrlEventPayload) => void,
): Promise<UnlistenFn> {
  return onProviderAuthEvent(ANTIGRAVITY_AUTH_URL_EVENT, callback);
}

export async function onClaudeOAuthAuthUrl(
  callback: (payload: OAuthUrlEventPayload) => void,
): Promise<UnlistenFn> {
  return onProviderAuthEvent(CLAUDE_OAUTH_AUTH_URL_EVENT, callback);
}

export async function onCodexAuthUrl(
  callback: (payload: OAuthUrlEventPayload) => void,
): Promise<UnlistenFn> {
  return onProviderAuthEvent(CODEX_AUTH_URL_EVENT, callback);
}

export async function onGeminiAuthUrl(
  callback: (payload: GeminiOAuthUrlEventPayload) => void,
): Promise<UnlistenFn> {
  return onProviderAuthEvent(GEMINI_AUTH_URL_EVENT, callback);
}
