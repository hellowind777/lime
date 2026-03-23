import type { ComponentProps, ReactNode } from "react";
import { CanvasWorkbenchLayout } from "../components/CanvasWorkbenchLayout";

interface WorkspaceCanvasContentProps {
  liveCanvasPreview: ReactNode;
  currentImageWorkbenchActive: boolean;
  shouldShowCanvasLoadingState: boolean;
  isBrowserAssistCanvasVisible: boolean;
  teamWorkbenchView: ComponentProps<typeof CanvasWorkbenchLayout>["teamView"];
  canvasWorkbenchLayoutProps: Omit<
    ComponentProps<typeof CanvasWorkbenchLayout>,
    "teamView"
  >;
}

export function WorkspaceCanvasContent({
  liveCanvasPreview,
  currentImageWorkbenchActive,
  shouldShowCanvasLoadingState,
  isBrowserAssistCanvasVisible,
  teamWorkbenchView,
  canvasWorkbenchLayoutProps,
}: WorkspaceCanvasContentProps) {
  if (!liveCanvasPreview && !teamWorkbenchView) {
    return null;
  }

  if (currentImageWorkbenchActive) {
    return liveCanvasPreview;
  }

  if (
    !teamWorkbenchView &&
    (shouldShowCanvasLoadingState || isBrowserAssistCanvasVisible)
  ) {
    return liveCanvasPreview;
  }

  return (
    <CanvasWorkbenchLayout
      {...canvasWorkbenchLayoutProps}
      teamView={teamWorkbenchView}
    />
  );
}
