import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { CanvasStateUnion } from "@/components/content-creator/canvas/canvasUtils";
import type { ThemeType } from "@/components/content-creator/types";
import type { CanvasState as GeneralCanvasState } from "@/components/general-chat/bridge";
import {
  buildStyleAuditPrompt,
  buildStyleRewritePrompt,
} from "@/lib/style-guide";
import type { TaskFile } from "../components/TaskFiles";
import {
  extractStyleActionContent,
  resolveStyleActionFileName,
} from "../utils/styleRuntime";
import { buildRuntimeStyleControlBarProps } from "./chatSurfaceProps";

type RuntimeStyleControlBarParams = Parameters<
  typeof buildRuntimeStyleControlBarProps
>[0];

interface UseWorkspaceStyleActionPresentationParams {
  enabled: RuntimeStyleControlBarParams["enabled"];
  projectId: RuntimeStyleControlBarParams["projectId"];
  activeTheme: ThemeType;
  projectStyleGuide: RuntimeStyleControlBarParams["projectStyleGuide"];
  selection: RuntimeStyleControlBarParams["selection"];
  onSelectionChange: RuntimeStyleControlBarParams["onSelectionChange"];
  generalCanvasState: GeneralCanvasState;
  resolvedCanvasState: CanvasStateUnion | null;
  taskFiles: TaskFile[];
  selectedFileId?: string;
  runtimeStylePrompt: string;
  onDispatchPrompt: (
    prompt: string,
    purpose: "style_rewrite" | "style_audit",
  ) => void;
}

interface WorkspaceStyleActionPresentationResult {
  runtimeStyleControlBar: RuntimeStyleControlBarParams;
}

export function useWorkspaceStyleActionPresentation({
  enabled,
  projectId,
  activeTheme,
  projectStyleGuide,
  selection,
  onSelectionChange,
  generalCanvasState,
  resolvedCanvasState,
  taskFiles,
  selectedFileId,
  runtimeStylePrompt,
  onDispatchPrompt,
}: UseWorkspaceStyleActionPresentationParams): WorkspaceStyleActionPresentationResult {
  const styleActionContent = useMemo(
    () =>
      extractStyleActionContent({
        activeTheme,
        generalCanvasState,
        resolvedCanvasState,
        taskFiles,
        selectedFileId,
      }),
    [
      activeTheme,
      generalCanvasState,
      resolvedCanvasState,
      selectedFileId,
      taskFiles,
    ],
  );

  const styleActionFileName = useMemo(
    () =>
      resolveStyleActionFileName({
        activeTheme,
        generalCanvasState,
        resolvedCanvasState,
        taskFiles,
        selectedFileId,
      }),
    [
      activeTheme,
      generalCanvasState,
      resolvedCanvasState,
      selectedFileId,
      taskFiles,
    ],
  );

  const actionsDisabled =
    !projectId || !runtimeStylePrompt || !styleActionContent.trim();

  const handleRewrite = useCallback(() => {
    if (!styleActionContent.trim()) {
      toast.error("当前画布还没有可重写的正文内容");
      return;
    }

    if (!runtimeStylePrompt) {
      toast.error("请先选择项目默认风格或任务风格");
      return;
    }

    onDispatchPrompt(
      buildStyleRewritePrompt({
        content: styleActionContent,
        stylePrompt: runtimeStylePrompt,
        fileName: styleActionFileName,
      }),
      "style_rewrite",
    );
  }, [
    onDispatchPrompt,
    runtimeStylePrompt,
    styleActionContent,
    styleActionFileName,
  ]);

  const handleAudit = useCallback(() => {
    if (!styleActionContent.trim()) {
      toast.error("当前画布还没有可检查的正文内容");
      return;
    }

    if (!runtimeStylePrompt) {
      toast.error("请先选择项目默认风格或任务风格");
      return;
    }

    onDispatchPrompt(
      buildStyleAuditPrompt({
        content: styleActionContent,
        stylePrompt: runtimeStylePrompt,
      }),
      "style_audit",
    );
  }, [onDispatchPrompt, runtimeStylePrompt, styleActionContent]);

  return {
    runtimeStyleControlBar: {
      enabled,
      projectId,
      activeTheme,
      projectStyleGuide,
      selection,
      onSelectionChange,
      onRewrite: handleRewrite,
      onAudit: handleAudit,
      actionsDisabled,
    },
  };
}
