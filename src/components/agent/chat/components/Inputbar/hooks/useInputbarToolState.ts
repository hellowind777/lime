import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export interface InputbarToolStates {
  webSearch: boolean;
  thinking: boolean;
  task: boolean;
  subagent: boolean;
}

interface UseInputbarToolStateParams {
  toolStates?: Partial<InputbarToolStates>;
  onToolStatesChange?: (states: InputbarToolStates) => void;
  executionStrategy?: "react" | "code_orchestrated" | "auto";
  setExecutionStrategy?: (
    strategy: "react" | "code_orchestrated" | "auto",
  ) => void;
  setInput: (value: string) => void;
  onClearMessages?: () => void;
  onToggleCanvas?: () => void;
  clearPendingImages: () => void;
  openFileDialog: () => void;
}

const DEFAULT_INPUTBAR_TOOL_STATES: InputbarToolStates = {
  webSearch: false,
  thinking: false,
  task: false,
  subagent: false,
};

export function useInputbarToolState({
  toolStates,
  onToolStatesChange,
  executionStrategy,
  setExecutionStrategy,
  setInput,
  onClearMessages,
  onToggleCanvas,
  clearPendingImages,
  openFileDialog,
}: UseInputbarToolStateParams) {
  const [localActiveTools, setLocalActiveTools] = useState<
    Record<string, boolean>
  >({});
  const [localToolStates, setLocalToolStates] = useState<InputbarToolStates>(
    DEFAULT_INPUTBAR_TOOL_STATES,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const webSearchEnabled =
    toolStates?.webSearch ?? localToolStates.webSearch;
  const thinkingEnabled = toolStates?.thinking ?? localToolStates.thinking;
  const taskEnabled = toolStates?.task ?? localToolStates.task;
  const subagentEnabled = toolStates?.subagent ?? localToolStates.subagent;

  const activeTools = useMemo<Record<string, boolean>>(
    () => ({
      ...localActiveTools,
      web_search: webSearchEnabled,
      thinking: thinkingEnabled,
      subagent_mode: subagentEnabled,
    }),
    [localActiveTools, thinkingEnabled, webSearchEnabled, subagentEnabled],
  );

  const updateToolStates = useCallback(
    (next: InputbarToolStates) => {
      setLocalToolStates((prev) => ({
        webSearch: toolStates?.webSearch ?? next.webSearch ?? prev.webSearch,
        thinking: toolStates?.thinking ?? next.thinking ?? prev.thinking,
        task: toolStates?.task ?? next.task ?? prev.task,
        subagent: toolStates?.subagent ?? next.subagent ?? prev.subagent,
      }));
      onToolStatesChange?.(next);
      return next;
    },
    [
      onToolStatesChange,
      toolStates?.subagent,
      toolStates?.task,
      toolStates?.thinking,
      toolStates?.webSearch,
    ],
  );

  const handleToolClick = useCallback(
    (tool: string) => {
      switch (tool) {
        case "thinking": {
          const nextThinking = !thinkingEnabled;
          updateToolStates({
            webSearch: webSearchEnabled,
            thinking: nextThinking,
            task: taskEnabled,
            subagent: subagentEnabled,
          });
          toast.info(`深度思考${nextThinking ? "已开启" : "已关闭"}`);
          break;
        }
        case "web_search": {
          const nextWebSearch = !webSearchEnabled;
          updateToolStates({
            webSearch: nextWebSearch,
            thinking: thinkingEnabled,
            task: taskEnabled,
            subagent: subagentEnabled,
          });
          toast.info(`联网搜索${nextWebSearch ? "已开启" : "已关闭"}`);
          break;
        }
        case "subagent_mode": {
          const nextSubagent = !subagentEnabled;
          updateToolStates({
            webSearch: webSearchEnabled,
            thinking: thinkingEnabled,
            task: taskEnabled,
            subagent: nextSubagent,
          });
          toast.info(`多代理${nextSubagent ? "偏好已开启" : "偏好已关闭"}`);
          break;
        }
        case "execution_strategy":
          if (setExecutionStrategy) {
            const nextStrategy =
              executionStrategy === "code_orchestrated"
                ? "react"
                : "code_orchestrated";
            setExecutionStrategy(nextStrategy);
            toast.info(
              `Plan 模式${nextStrategy === "code_orchestrated" ? "已开启" : "已关闭"}`,
            );
            break;
          }
          setLocalActiveTools((prev) => {
            const enabled = !prev["execution_strategy"];
            toast.info(`Plan 模式${enabled ? "已开启" : "已关闭"}`);
            return { ...prev, execution_strategy: enabled };
          });
          break;
        case "clear":
          setInput("");
          clearPendingImages();
          toast.success("已清除输入");
          break;
        case "new_topic":
          onClearMessages?.();
          setInput("");
          clearPendingImages();
          break;
        case "attach":
          openFileDialog();
          break;
        case "quick_action":
          toast.info("快捷操作开发中...");
          break;
        case "fullscreen":
          setIsFullscreen((prev) => !prev);
          toast.info(isFullscreen ? "已退出全屏" : "已进入全屏编辑");
          break;
        case "canvas":
          onToggleCanvas?.();
          break;
        default:
          break;
      }
    },
    [
      clearPendingImages,
      executionStrategy,
      isFullscreen,
      onClearMessages,
      onToggleCanvas,
      openFileDialog,
      setExecutionStrategy,
      setInput,
      thinkingEnabled,
      subagentEnabled,
      taskEnabled,
      updateToolStates,
      webSearchEnabled,
    ],
  );

  const setSubagentEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled === subagentEnabled) {
        return;
      }
      updateToolStates({
        webSearch: webSearchEnabled,
        thinking: thinkingEnabled,
        task: taskEnabled,
        subagent: enabled,
      });
      toast.info(`多代理${enabled ? "偏好已开启" : "偏好已关闭"}`);
    },
    [
      subagentEnabled,
      taskEnabled,
      thinkingEnabled,
      updateToolStates,
      webSearchEnabled,
    ],
  );

  return {
    activeTools,
    handleToolClick,
    setSubagentEnabled,
    isFullscreen,
    thinkingEnabled,
    taskEnabled,
    subagentEnabled,
    webSearchEnabled,
  };
}
