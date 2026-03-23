import { useCallback } from "react";
import type { MessageImage } from "../types";
import type { ChatToolPreferences } from "../utils/chatToolPreferences";
import type { WorkspaceHandleSend } from "./useWorkspaceSendActions";
import { useWorkspaceStyleActionPresentation } from "./useWorkspaceStyleActionPresentation";

type StyleActionPresentationParams = Parameters<
  typeof useWorkspaceStyleActionPresentation
>[0];

interface UseWorkspaceConversationSendRuntimeParams {
  chatToolPreferences: ChatToolPreferences;
  handleSend: WorkspaceHandleSend;
  styleAction: Omit<StyleActionPresentationParams, "onDispatchPrompt">;
}

export function useWorkspaceConversationSendRuntime({
  chatToolPreferences,
  handleSend,
  styleAction,
}: UseWorkspaceConversationSendRuntimeParams) {
  const handleSendFromEmptyState = useCallback(
    (
      text: string,
      sendExecutionStrategy?: "react" | "code_orchestrated" | "auto",
      images?: MessageImage[],
    ) => {
      void handleSend(
        images || [],
        chatToolPreferences.webSearch,
        chatToolPreferences.thinking,
        text,
        sendExecutionStrategy,
      );
    },
    [
      chatToolPreferences.thinking,
      chatToolPreferences.webSearch,
      handleSend,
    ],
  );

  const handleDispatchStylePrompt = useCallback(
    (prompt: string, purpose: "style_rewrite" | "style_audit") => {
      void handleSend(
        [],
        chatToolPreferences.webSearch,
        chatToolPreferences.thinking,
        prompt,
        undefined,
        undefined,
        {
          skipThemeSkillPrefix: true,
          purpose,
        },
      );
    },
    [
      chatToolPreferences.thinking,
      chatToolPreferences.webSearch,
      handleSend,
    ],
  );

  const { runtimeStyleControlBar } = useWorkspaceStyleActionPresentation({
    ...styleAction,
    onDispatchPrompt: handleDispatchStylePrompt,
  });

  return {
    handleSendFromEmptyState,
    runtimeStyleControlBar,
  };
}
