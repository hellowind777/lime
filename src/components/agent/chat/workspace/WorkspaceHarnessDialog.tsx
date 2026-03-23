import type { ComponentProps } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { HarnessStatusPanel } from "../components/HarnessStatusPanel";

interface WorkspaceHarnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxWidth: string;
  panelProps: ComponentProps<typeof HarnessStatusPanel>;
}

export function WorkspaceHarnessDialog({
  open,
  onOpenChange,
  maxWidth,
  panelProps,
}: WorkspaceHarnessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        maxWidth={maxWidth}
        className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0"
        draggable={true}
        dragHandleSelector='[data-harness-drag-handle="true"]'
      >
        <HarnessStatusPanel {...panelProps} />
      </DialogContent>
    </Dialog>
  );
}
