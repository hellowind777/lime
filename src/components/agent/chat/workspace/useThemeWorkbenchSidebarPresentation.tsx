import { useCallback, type ComponentProps, type ReactNode } from "react";
import { WorkspaceThemeSidebar } from "./WorkspaceThemeSidebar";
import { ThemeWorkbenchHarnessDialogSection } from "./WorkspaceHarnessDialogs";

type WorkspaceThemeSidebarProps = ComponentProps<typeof WorkspaceThemeSidebar>;

type ThemeWorkbenchSidebarWorkflowParams = Omit<
  WorkspaceThemeSidebarProps["workflow"],
  "onDeleteTopic"
>;

interface UseThemeWorkbenchSidebarPresentationParams {
  showChatPanel: boolean;
  showSidebar: boolean;
  hasPendingA2UIForm: boolean;
  isThemeWorkbench: boolean;
  shouldUseCompactThemeWorkbench: boolean;
  enablePanelCollapse: boolean;
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
  sidebar: Omit<
    WorkspaceThemeSidebarProps,
    "visible" | "isThemeWorkbench" | "enablePanelCollapse" | "onRequestCollapse" | "workflow"
  > & {
    workflow: ThemeWorkbenchSidebarWorkflowParams;
  };
  harnessDialog: ComponentProps<typeof ThemeWorkbenchHarnessDialogSection>;
}

interface ThemeWorkbenchSidebarPresentationResult {
  themeWorkbenchHarnessDialog: ReactNode;
  themeWorkbenchSidebarNode: ReactNode;
  showThemeWorkbenchLeftExpandButton: boolean;
  onExpandThemeWorkbenchSidebar: () => void;
}

export function useThemeWorkbenchSidebarPresentation({
  showChatPanel,
  showSidebar,
  hasPendingA2UIForm,
  isThemeWorkbench,
  shouldUseCompactThemeWorkbench,
  enablePanelCollapse,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  sidebar,
  harnessDialog,
}: UseThemeWorkbenchSidebarPresentationParams): ThemeWorkbenchSidebarPresentationResult {
  const shouldShowThemeWorkbenchSidebarForTheme =
    !shouldUseCompactThemeWorkbench;
  const showThemeWorkbenchSidebar =
    showChatPanel &&
    showSidebar &&
    !hasPendingA2UIForm &&
    isThemeWorkbench &&
    shouldShowThemeWorkbenchSidebarForTheme &&
    (!enablePanelCollapse || !sidebarCollapsed);
  const showThemeWorkbenchLeftExpandButton =
    showChatPanel &&
    showSidebar &&
    !hasPendingA2UIForm &&
    isThemeWorkbench &&
    shouldShowThemeWorkbenchSidebarForTheme &&
    enablePanelCollapse &&
    sidebarCollapsed;

  const handleThemeWorkbenchDeleteTopic = useCallback(() => undefined, []);
  const handleThemeWorkbenchSidebarCollapse = useCallback(() => {
    onSidebarCollapsedChange(true);
  }, [onSidebarCollapsedChange]);
  const handleExpandThemeWorkbenchSidebar = useCallback(() => {
    onSidebarCollapsedChange(false);
  }, [onSidebarCollapsedChange]);

  return {
    themeWorkbenchHarnessDialog: <ThemeWorkbenchHarnessDialogSection {...harnessDialog} />,
    themeWorkbenchSidebarNode: (
      <WorkspaceThemeSidebar
        {...sidebar}
        visible={showThemeWorkbenchSidebar}
        isThemeWorkbench={isThemeWorkbench}
        enablePanelCollapse={enablePanelCollapse}
        onRequestCollapse={handleThemeWorkbenchSidebarCollapse}
        workflow={{
          ...sidebar.workflow,
          onDeleteTopic: handleThemeWorkbenchDeleteTopic,
        }}
      />
    ),
    showThemeWorkbenchLeftExpandButton,
    onExpandThemeWorkbenchSidebar: handleExpandThemeWorkbenchSidebar,
  };
}
