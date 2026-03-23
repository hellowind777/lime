import type { ComponentProps, ReactNode } from "react";
import { PanelLeftOpen } from "lucide-react";
import { ChatSidebar } from "../components/ChatSidebar";
import { PageContainer, ThemeWorkbenchLeftExpandButton } from "./WorkspaceStyles";

interface WorkspacePageShellProps {
  compactChrome: boolean;
  isThemeWorkbench: boolean;
  themeWorkbenchSidebarNode: ReactNode;
  showChatPanel: boolean;
  showSidebar: boolean;
  chatSidebarProps: ComponentProps<typeof ChatSidebar> | null;
  showThemeWorkbenchLeftExpandButton: boolean;
  onExpandThemeWorkbenchSidebar: () => void;
  mainAreaNode: ReactNode;
}

export function WorkspacePageShell({
  compactChrome,
  isThemeWorkbench,
  themeWorkbenchSidebarNode,
  showChatPanel,
  showSidebar,
  chatSidebarProps,
  showThemeWorkbenchLeftExpandButton,
  onExpandThemeWorkbenchSidebar,
  mainAreaNode,
}: WorkspacePageShellProps) {
  return (
    <PageContainer $compact={compactChrome}>
      {isThemeWorkbench ? (
        themeWorkbenchSidebarNode
      ) : showChatPanel && showSidebar && chatSidebarProps ? (
        <ChatSidebar {...chatSidebarProps} />
      ) : null}
      {showThemeWorkbenchLeftExpandButton ? (
        <ThemeWorkbenchLeftExpandButton
          type="button"
          aria-label="展开上下文侧栏"
          onClick={onExpandThemeWorkbenchSidebar}
          title="展开上下文侧栏"
        >
          <PanelLeftOpen size={14} />
        </ThemeWorkbenchLeftExpandButton>
      ) : null}

      {mainAreaNode}
    </PageContainer>
  );
}
