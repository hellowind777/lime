import type { ReactNode } from "react";
import type { LayoutMode } from "@/components/content-creator/types";
import {
  LayoutTransitionRenderGate,
  MainArea,
  ThemeWorkbenchInputOverlay,
  ThemeWorkbenchLayoutShell,
} from "./WorkspaceStyles";

interface WorkspaceMainAreaProps {
  compactChrome: boolean;
  navbarNode: ReactNode;
  contentSyncNoticeNode: ReactNode;
  shellBottomInset: string;
  layoutMode: LayoutMode;
  forceCanvasMode: boolean;
  chatContent: ReactNode;
  canvasContent: ReactNode;
  chatPanelWidth?: string;
  chatPanelMinWidth?: string;
  generalWorkbenchDialog: ReactNode;
  themeWorkbenchHarnessDialog: ReactNode;
  showFloatingInputOverlay: boolean;
  hasPendingA2UIForm: boolean;
  inputbarNode: ReactNode;
}

export function WorkspaceMainArea({
  compactChrome,
  navbarNode,
  contentSyncNoticeNode,
  shellBottomInset,
  layoutMode,
  forceCanvasMode,
  chatContent,
  canvasContent,
  chatPanelWidth,
  chatPanelMinWidth,
  generalWorkbenchDialog,
  themeWorkbenchHarnessDialog,
  showFloatingInputOverlay,
  hasPendingA2UIForm,
  inputbarNode,
}: WorkspaceMainAreaProps) {
  return (
    <MainArea $compact={compactChrome}>
      {navbarNode}
      {contentSyncNoticeNode}
      <ThemeWorkbenchLayoutShell $bottomInset={shellBottomInset}>
        <LayoutTransitionRenderGate
          mode={forceCanvasMode ? "canvas" : layoutMode}
          chatContent={chatContent}
          canvasContent={canvasContent}
          chatPanelWidth={chatPanelWidth}
          chatPanelMinWidth={chatPanelMinWidth}
        />
      </ThemeWorkbenchLayoutShell>
      {generalWorkbenchDialog}
      {themeWorkbenchHarnessDialog}
      {showFloatingInputOverlay ? (
        <ThemeWorkbenchInputOverlay
          $hasPendingA2UIForm={hasPendingA2UIForm}
        >
          {inputbarNode}
        </ThemeWorkbenchInputOverlay>
      ) : null}
    </MainArea>
  );
}
