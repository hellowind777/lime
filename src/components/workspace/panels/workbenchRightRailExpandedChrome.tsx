import { PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StyleGuidePanel } from "@/components/projects/memory/StyleGuidePanel";

export function WorkbenchRightRailCollapseBar({
  onCollapse,
}: {
  onCollapse: () => void;
}) {
  return (
    <div className="flex items-center justify-end border-b bg-background/96 px-3 py-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={onCollapse}
              title="折叠能力面板"
            >
              <PanelRightClose size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>折叠能力面板</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function WorkbenchRightRailHeadingCard({
  eyebrow,
  heading,
  subheading,
}: {
  eyebrow?: string;
  heading?: string | null;
  subheading?: string | null;
}) {
  if (!heading) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {eyebrow ?? "独立右栏"}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{heading}</div>
      {subheading ? (
        <div className="mt-1 text-xs text-muted-foreground">{subheading}</div>
      ) : null}
    </div>
  );
}

export function WorkbenchRightRailStyleGuideCard({
  projectId,
  onOpen,
}: {
  projectId?: string | null;
  onOpen: () => void;
}) {
  if (!projectId) {
    return null;
  }

  return (
    <div className="rounded-xl border border-violet-200/70 bg-violet-50/60 px-3 py-3 dark:border-violet-900/60 dark:bg-violet-950/20">
      <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">
        风格策略
      </div>
      <div className="mt-1 text-sm text-foreground">
        统一管理项目默认风格，并作为当前创作的风格基线。
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="h-8" onClick={onOpen}>
          编辑项目风格
        </Button>
      </div>
    </div>
  );
}

export function WorkbenchRightRailStyleGuideDialog({
  open,
  projectId,
  sourceEntryId,
  onOpenChange,
}: {
  open: boolean;
  projectId?: string | null;
  sourceEntryId?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>项目默认风格</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {projectId ? (
            <StyleGuidePanel
              projectId={projectId}
              highlightSourceEntryId={sourceEntryId}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
