import { Bot, FileText, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityLogList } from "@/components/content-creator/components/ActivityLog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface WorkbenchQuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

export interface WorkbenchRightRailProps {
  shouldRender: boolean;
  isCreateWorkspaceView: boolean;
  activeRightDrawer: "activity-log" | null;
  showChatPanel: boolean;
  onToggleChatPanel: () => void;
  onToggleActivityLogDrawer: () => void;
  onBackToCreateView: () => void;
  activityLogWorkspaceId: string | null;
  activityLogSessionId: string | null;
}

export function WorkbenchRightRail({
  shouldRender,
  isCreateWorkspaceView,
  activeRightDrawer,
  showChatPanel,
  onToggleChatPanel,
  onToggleActivityLogDrawer,
  onBackToCreateView,
  activityLogWorkspaceId,
  activityLogSessionId,
}: WorkbenchRightRailProps) {
  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {activeRightDrawer === "activity-log" && isCreateWorkspaceView && (
        <aside className="w-[260px] min-w-[260px] border-l bg-muted/10">
          <ActivityLogList
            workspaceId={activityLogWorkspaceId ?? undefined}
            sessionId={activityLogSessionId}
          />
        </aside>
      )}
      <aside className="w-14 min-w-14 border-l bg-background/95 flex flex-col items-center py-3 gap-2">
        <TooltipProvider>
          {isCreateWorkspaceView ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9",
                      showChatPanel && "bg-accent text-accent-foreground",
                    )}
                    onClick={onToggleChatPanel}
                    title={showChatPanel ? "隐藏 AI 对话" : "显示 AI 对话"}
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{showChatPanel ? "隐藏 AI 对话" : "显示 AI 对话"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9",
                      activeRightDrawer === "activity-log" &&
                        "bg-accent text-accent-foreground",
                    )}
                    onClick={onToggleActivityLogDrawer}
                    title={
                      activeRightDrawer === "activity-log"
                        ? "收起活动日志"
                        : "展开活动日志"
                    }
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>
                    {activeRightDrawer === "activity-log"
                      ? "收起活动日志"
                      : "展开活动日志"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={onBackToCreateView}
                    title="返回创作视图"
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>返回创作视图</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>
      </aside>
    </>
  );
}

export default WorkbenchRightRail;
