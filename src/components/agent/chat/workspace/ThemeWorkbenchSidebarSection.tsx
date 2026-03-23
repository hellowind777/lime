import type { SkillDetailInfo } from "@/lib/api/skill-execution";
import { ThemeWorkbenchSidebar } from "../components/ThemeWorkbenchSidebar";
import type {
  ThemeWorkbenchSidebarExecLogContract,
  ThemeWorkbenchSidebarProps,
} from "../components/themeWorkbenchSidebarContract";
import type { Message } from "../types";

type ThemeWorkbenchWorkflowProps = Pick<
  ThemeWorkbenchSidebarProps,
  | "branchMode"
  | "onNewTopic"
  | "onSwitchTopic"
  | "onDeleteTopic"
  | "branchItems"
  | "onSetBranchStatus"
  | "workflowSteps"
  | "onAddImage"
  | "onImportDocument"
  | "activityLogs"
  | "creationTaskEvents"
  | "onViewRunDetail"
  | "activeRunDetail"
  | "activeRunDetailLoading"
>;

type ThemeWorkbenchContextWorkspaceProps = {
  contextSearchQuery: ThemeWorkbenchSidebarProps["contextSearchQuery"];
  setContextSearchQuery: ThemeWorkbenchSidebarProps["onContextSearchQueryChange"];
  contextSearchMode: ThemeWorkbenchSidebarProps["contextSearchMode"];
  setContextSearchMode: ThemeWorkbenchSidebarProps["onContextSearchModeChange"];
  contextSearchLoading: ThemeWorkbenchSidebarProps["contextSearchLoading"];
  contextSearchError?: ThemeWorkbenchSidebarProps["contextSearchError"];
  contextSearchBlockedReason?: ThemeWorkbenchSidebarProps["contextSearchBlockedReason"];
  submitContextSearch: ThemeWorkbenchSidebarProps["onSubmitContextSearch"];
  addTextContext?: ThemeWorkbenchSidebarProps["onAddTextContext"];
  addLinkContext?: ThemeWorkbenchSidebarProps["onAddLinkContext"];
  addFileContext?: ThemeWorkbenchSidebarProps["onAddFileContext"];
  sidebarContextItems: ThemeWorkbenchSidebarProps["contextItems"];
  toggleContextActive: ThemeWorkbenchSidebarProps["onToggleContextActive"];
  contextBudget: ThemeWorkbenchSidebarProps["contextBudget"];
};

interface ThemeWorkbenchHistoryProps {
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: ThemeWorkbenchSidebarExecLogContract["onLoadMoreHistory"];
  skillDetailMap?: Record<string, SkillDetailInfo | null>;
  messages?: Message[];
}

interface ThemeWorkbenchSidebarSectionProps {
  visible: boolean;
  workflowProps: ThemeWorkbenchWorkflowProps;
  contextWorkspace: ThemeWorkbenchContextWorkspaceProps;
  onViewContextDetail?: ThemeWorkbenchSidebarProps["onViewContextDetail"];
  onRequestCollapse?: ThemeWorkbenchSidebarProps["onRequestCollapse"];
  headerActionSlot?: ThemeWorkbenchSidebarProps["headerActionSlot"];
  topSlot?: ThemeWorkbenchSidebarProps["topSlot"];
  historyProps?: ThemeWorkbenchHistoryProps;
}

export function ThemeWorkbenchSidebarSection({
  visible,
  workflowProps,
  contextWorkspace,
  onViewContextDetail,
  onRequestCollapse,
  headerActionSlot,
  topSlot,
  historyProps,
}: ThemeWorkbenchSidebarSectionProps) {
  if (!visible) {
    return null;
  }

  return (
    <ThemeWorkbenchSidebar
      {...workflowProps}
      branchMode={workflowProps.branchMode ?? "version"}
      contextSearchQuery={contextWorkspace.contextSearchQuery}
      onContextSearchQueryChange={contextWorkspace.setContextSearchQuery}
      contextSearchMode={contextWorkspace.contextSearchMode}
      onContextSearchModeChange={contextWorkspace.setContextSearchMode}
      contextSearchLoading={contextWorkspace.contextSearchLoading}
      contextSearchError={contextWorkspace.contextSearchError}
      contextSearchBlockedReason={contextWorkspace.contextSearchBlockedReason}
      onSubmitContextSearch={contextWorkspace.submitContextSearch}
      onAddTextContext={contextWorkspace.addTextContext}
      onAddLinkContext={contextWorkspace.addLinkContext}
      onAddFileContext={contextWorkspace.addFileContext}
      contextItems={contextWorkspace.sidebarContextItems}
      onToggleContextActive={contextWorkspace.toggleContextActive}
      onViewContextDetail={onViewContextDetail}
      contextBudget={contextWorkspace.contextBudget}
      onRequestCollapse={onRequestCollapse}
      headerActionSlot={headerActionSlot}
      topSlot={topSlot}
      historyHasMore={historyProps?.hasMore}
      historyLoading={historyProps?.loading}
      onLoadMoreHistory={historyProps?.onLoadMore}
      skillDetailMap={historyProps?.skillDetailMap}
      messages={historyProps?.messages}
    />
  );
}
