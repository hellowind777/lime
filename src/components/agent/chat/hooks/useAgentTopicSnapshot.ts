import { useEffect, useRef } from "react";
import { logAgentDebug } from "@/lib/agentDebug";
import { buildLiveTaskSnapshot } from "./agentChatShared";
import type { Message } from "../types";
import type { Topic } from "./agentChatShared";

interface UseAgentTopicSnapshotOptions {
  sessionId: string | null;
  hasActiveTopic: boolean;
  messages: Message[];
  isSending: boolean;
  pendingActionCount: number;
  queuedTurnCount: number;
  workspaceId: string;
  workspacePathMissing: boolean;
  topicsCount: number;
  updateTopicSnapshot: (
    targetSessionId: string,
    snapshot: Partial<
      Pick<
        Topic,
        | "updatedAt"
        | "messagesCount"
        | "status"
        | "statusReason"
        | "lastPreview"
        | "hasUnread"
      >
    >,
  ) => void;
}

export function useAgentTopicSnapshot(options: UseAgentTopicSnapshotOptions) {
  const {
    sessionId,
    hasActiveTopic,
    messages,
    isSending,
    pendingActionCount,
    queuedTurnCount,
    workspaceId,
    workspacePathMissing,
    topicsCount,
    updateTopicSnapshot,
  } = options;
  const lastTopicSnapshotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || !hasActiveTopic) {
      if (sessionId && !hasActiveTopic) {
        logAgentDebug(
          "useAgentTopicSnapshot",
          "skipWithoutActiveTopic",
          {
            activeSessionId: sessionId,
            topicsCount,
            workspaceId,
          },
          { level: "warn", throttleMs: 1000 },
        );
      }
      lastTopicSnapshotKeyRef.current = null;
      return;
    }

    const snapshot = buildLiveTaskSnapshot({
      messages,
      isSending,
      pendingActionCount,
      queuedTurnCount,
      workspaceError: workspacePathMissing,
    });

    const snapshotKey = JSON.stringify({
      sessionId,
      updatedAt: snapshot.updatedAt?.getTime() ?? null,
      messagesCount: snapshot.messagesCount,
      status: snapshot.status,
      statusReason: snapshot.statusReason ?? null,
      lastPreview: snapshot.lastPreview,
      hasUnread: snapshot.hasUnread,
    });

    if (lastTopicSnapshotKeyRef.current === snapshotKey) {
      logAgentDebug(
        "useAgentTopicSnapshot",
        "skipDuplicate",
        {
          activeSessionId: sessionId,
          snapshotKey,
        },
        { throttleMs: 1200 },
      );
      return;
    }

    lastTopicSnapshotKeyRef.current = snapshotKey;
    logAgentDebug("useAgentTopicSnapshot", "apply", {
      activeSessionId: sessionId,
      hasUnread: snapshot.hasUnread,
      messagesCount: snapshot.messagesCount,
      status: snapshot.status,
      statusReason: snapshot.statusReason ?? null,
      updatedAt: snapshot.updatedAt?.toISOString() ?? null,
    });
    updateTopicSnapshot(sessionId, snapshot);
  }, [
    hasActiveTopic,
    isSending,
    messages,
    pendingActionCount,
    queuedTurnCount,
    sessionId,
    topicsCount,
    updateTopicSnapshot,
    workspaceId,
    workspacePathMissing,
  ]);
}
