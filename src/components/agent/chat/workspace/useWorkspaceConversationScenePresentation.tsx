import type { ComponentProps, ReactNode } from "react";
import { StepProgress } from "@/components/content-creator/core/StepGuide/StepProgress";
import { WorkspaceConversationScene } from "./WorkspaceConversationScene";
import { MessageList } from "../components/MessageList";
import { RuntimeStyleControlBar } from "../components/RuntimeStyleControlBar";
import { TeamWorkspaceDock } from "../components/TeamWorkspaceDock";
import {
  buildRuntimeStyleControlBarProps,
  buildStepProgressProps,
  buildTeamWorkspaceDockProps,
  buildWorkspaceMessageListProps,
} from "./chatSurfaceProps";
import type { TeamWorkbenchSurfaceProps } from "./teamWorkbenchPresentation";

type WorkspaceConversationSceneProps = ComponentProps<
  typeof WorkspaceConversationScene
>;
type CanvasWorkbenchLayoutProps = NonNullable<
  WorkspaceConversationSceneProps["canvasWorkbenchLayoutProps"]
>;
type NovelCanvasControls = NonNullable<
  WorkspaceConversationSceneProps["novelCanvasControls"]
>;

interface UseWorkspaceConversationScenePresentationParams {
  scene: Omit<
    WorkspaceConversationSceneProps,
    | "workspaceAlertVisible"
    | "projectId"
    | "novelCanvasControls"
    | "canvasWorkbenchLayoutProps"
    | "stepProgressProps"
    | "runtimeStyleControlBarProps"
    | "messageListProps"
    | "teamWorkspaceDockProps"
  > & {
    projectId: string | null | undefined;
  };
  stepProgress: {
    hidden: boolean;
    isContentCreationMode: boolean;
    hasMessages: boolean;
    steps: ComponentProps<typeof StepProgress>["steps"];
    currentIndex: ComponentProps<typeof StepProgress>["currentIndex"];
    onStepClick: NonNullable<ComponentProps<typeof StepProgress>["onStepClick"]>;
  };
  runtimeStyleControlBar: {
    enabled: boolean;
    projectId: string | null | undefined;
    activeTheme: ComponentProps<typeof RuntimeStyleControlBar>["activeTheme"];
    projectStyleGuide: ComponentProps<
      typeof RuntimeStyleControlBar
    >["projectStyleGuide"];
    selection: ComponentProps<typeof RuntimeStyleControlBar>["selection"];
    onSelectionChange: ComponentProps<
      typeof RuntimeStyleControlBar
    >["onSelectionChange"];
    onRewrite: NonNullable<ComponentProps<typeof RuntimeStyleControlBar>["onRewrite"]>;
    onAudit: NonNullable<ComponentProps<typeof RuntimeStyleControlBar>["onAudit"]>;
    actionsDisabled: boolean;
  };
  messageList: ComponentProps<typeof MessageList>;
  teamWorkspaceDock: {
    enabled: boolean;
    shouldShowFloatingInputOverlay: boolean;
    layoutMode: "chat" | "chat-canvas";
    onActivateWorkbench: NonNullable<
      ComponentProps<typeof TeamWorkspaceDock>["onActivateWorkbench"]
    >;
    withBottomOverlay: boolean;
    surfaceProps: TeamWorkbenchSurfaceProps;
  };
  workspaceAlert: {
    workspacePathMissing: boolean;
    workspaceHealthError: boolean;
  };
  novelCanvas: {
    visible: boolean;
    chapterListCollapsed: NovelCanvasControls["chapterListCollapsed"];
    onToggleChapterList: NovelCanvasControls["onToggleChapterList"];
    onAddChapter: NovelCanvasControls["onAddChapter"];
    onCloseCanvas: NovelCanvasControls["onCloseCanvas"];
  };
  canvasWorkbenchLayout: Omit<CanvasWorkbenchLayoutProps, "workspaceUnavailable">;
}

interface WorkspaceConversationScenePresentationResult {
  workspaceAlertVisible: boolean;
  mainAreaNode: ReactNode;
}

export function useWorkspaceConversationScenePresentation({
  scene,
  stepProgress,
  runtimeStyleControlBar,
  messageList,
  teamWorkspaceDock,
  workspaceAlert,
  novelCanvas,
  canvasWorkbenchLayout,
}: UseWorkspaceConversationScenePresentationParams): WorkspaceConversationScenePresentationResult {
  const stepProgressProps = buildStepProgressProps(stepProgress);
  const runtimeStyleControlBarProps =
    buildRuntimeStyleControlBarProps(runtimeStyleControlBar);
  const messageListProps = buildWorkspaceMessageListProps(messageList);
  const teamWorkspaceDockProps = buildTeamWorkspaceDockProps(teamWorkspaceDock);
  const workspaceAlertVisible = Boolean(
    workspaceAlert.workspacePathMissing || workspaceAlert.workspaceHealthError,
  );

  const novelCanvasControls = novelCanvas.visible
    ? {
        chapterListCollapsed: novelCanvas.chapterListCollapsed,
        onToggleChapterList: novelCanvas.onToggleChapterList,
        onAddChapter: novelCanvas.onAddChapter,
        onCloseCanvas: novelCanvas.onCloseCanvas,
      }
    : null;

  const canvasWorkbenchLayoutProps: CanvasWorkbenchLayoutProps = {
    ...canvasWorkbenchLayout,
    workspaceUnavailable: workspaceAlertVisible,
  };

  return {
    workspaceAlertVisible,
    mainAreaNode: (
      <WorkspaceConversationScene
        {...scene}
        stepProgressProps={stepProgressProps}
        runtimeStyleControlBarProps={runtimeStyleControlBarProps}
        messageListProps={messageListProps}
        teamWorkspaceDockProps={teamWorkspaceDockProps}
        workspaceAlertVisible={workspaceAlertVisible}
        projectId={scene.projectId ?? null}
        novelCanvasControls={novelCanvasControls}
        canvasWorkbenchLayoutProps={canvasWorkbenchLayoutProps}
      />
    ),
  };
}
