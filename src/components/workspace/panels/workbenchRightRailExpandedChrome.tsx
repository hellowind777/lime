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
    <div className="px-1 py-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {eyebrow ?? "独立右栏"}
      </div>
      <div className="mt-1.5 text-[15px] font-semibold text-foreground tracking-tight">{heading}</div>
      {subheading ? (
        <div className="mt-1 text-[13px] text-muted-foreground">{subheading}</div>
      ) : null}
    </div>
  );
}

import { Sparkles } from "lucide-react";

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
    <div className="group relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,250,240,0.92)_0%,rgba(255,255,255,1)_46%,rgba(241,246,255,0.92)_100%)] px-4 py-4 shadow-sm shadow-slate-950/5 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-violet-900/60 dark:from-violet-950/20 dark:to-background">
      <div className="absolute -right-6 -top-6 opacity-[0.08] transition-opacity group-hover:opacity-[0.12]">
        <Sparkles className="h-24 w-24 text-amber-500 dark:text-violet-400" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-violet-400">
          <Sparkles className="h-3.5 w-3.5" />
          风格策略
        </div>
        <div className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
          统一管理项目默认风格，并作为当前创作的风格基线。
        </div>
        <div className="mt-3">
          <Button size="sm" variant="outline" className="h-7 border-slate-200/80 bg-white/80 text-[11px] hover:bg-slate-50 hover:text-slate-900 dark:border-violet-900/60 dark:bg-black/50 dark:hover:bg-violet-900/30 dark:hover:text-violet-300" onClick={onOpen}>
            编辑项目风格
          </Button>
        </div>
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
        <DialogHeader className="sr-only">
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
