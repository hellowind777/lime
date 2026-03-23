import { WorkspaceShellScene } from "./WorkspaceShellScene";
import { useWorkspaceConversationSceneRuntime } from "./useWorkspaceConversationSceneRuntime";
import { useWorkspaceThemeWorkbenchShellRuntime } from "./useWorkspaceThemeWorkbenchShellRuntime";

type ThemeWorkbenchShellRuntime = ReturnType<
  typeof useWorkspaceThemeWorkbenchShellRuntime
>;
type ConversationSceneRuntime = ReturnType<
  typeof useWorkspaceConversationSceneRuntime
>;

interface UseWorkspaceShellSceneRuntimeParams {
  compactChrome: boolean;
  isThemeWorkbench: boolean;
  showChatPanel: boolean;
  showSidebar: boolean;
  themeWorkbenchShellRuntime: ThemeWorkbenchShellRuntime;
  conversationSceneRuntime: ConversationSceneRuntime;
  sessionId?: string;
  topics: Array<{ id: string; title: string }>;
  handleBackHome: () => void;
  switchTopic: (topicId: string) => Promise<void> | void;
  handleResumeSidebarTask: (taskId: string) => void;
  deleteTopic: (topicId: string) => Promise<void> | void;
  renameTopic: (topicId: string, title: string) => Promise<void> | void;
  displayMessages: Array<unknown>;
  isSending: boolean;
  pendingActionCount: number;
  queuedTurnCount: number;
  childSubagentSessions: Array<unknown>;
  subagentParentContext: unknown;
  handleOpenSubagentSession: (sessionId: string) => void;
  handleReturnToParentSession: () => void;
}

export function useWorkspaceShellSceneRuntime({
  compactChrome,
  isThemeWorkbench,
  showChatPanel,
  showSidebar,
  themeWorkbenchShellRuntime,
  conversationSceneRuntime,
  sessionId,
  topics,
  handleBackHome,
  switchTopic,
  handleResumeSidebarTask,
  deleteTopic,
  renameTopic,
  displayMessages,
  isSending,
  pendingActionCount,
  queuedTurnCount,
  childSubagentSessions,
  subagentParentContext,
  handleOpenSubagentSession,
  handleReturnToParentSession,
}: UseWorkspaceShellSceneRuntimeParams) {
  return {
    shellSceneNode: (
      <WorkspaceShellScene
        compactChrome={compactChrome}
        isThemeWorkbench={isThemeWorkbench}
        themeWorkbenchSidebarNode={themeWorkbenchShellRuntime.themeWorkbenchSidebarNode}
        showChatPanel={showChatPanel}
        showSidebar={showSidebar}
        showThemeWorkbenchLeftExpandButton={
          themeWorkbenchShellRuntime.showThemeWorkbenchLeftExpandButton
        }
        onExpandThemeWorkbenchSidebar={
          themeWorkbenchShellRuntime.onExpandThemeWorkbenchSidebar
        }
        mainAreaNode={conversationSceneRuntime.mainAreaNode}
        currentTopicId={sessionId}
        topics={topics}
        onNewChat={handleBackHome}
        onSwitchTopic={switchTopic}
        onResumeTask={handleResumeSidebarTask}
        onDeleteTopic={deleteTopic}
        onRenameTopic={renameTopic}
        currentMessages={displayMessages}
        isSending={isSending}
        pendingActionCount={pendingActionCount}
        queuedTurnCount={queuedTurnCount}
        workspaceError={conversationSceneRuntime.workspaceAlertVisible}
        childSubagentSessions={childSubagentSessions}
        subagentParentContext={subagentParentContext}
        onOpenSubagentSession={handleOpenSubagentSession}
        onReturnToParentSession={handleReturnToParentSession}
      />
    ),
  };
}
