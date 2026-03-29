import React from "react";
import {
  Lightbulb,
  Globe,
  Code2,
  Workflow,
} from "lucide-react";
import { Divider, ToolButton } from "../styles";
import { isGeneralResearchTheme } from "../../../utils/generalAgentPrompt";

interface InputbarToolsProps {
  onToolClick?: (tool: string) => void;
  activeTools?: Record<string, boolean>;
  executionStrategy?: "react" | "code_orchestrated" | "auto";
  showExecutionStrategy?: boolean;
  toolMode?: "default" | "attach-only";
  /** 画布是否打开（兼容保留，不再展示画布图标） */
  isCanvasOpen?: boolean;
  activeTheme?: string;
}

export const InputbarTools: React.FC<InputbarToolsProps> = ({
  onToolClick,
  activeTools = {},
  executionStrategy = "react",
  showExecutionStrategy = false,
  toolMode = "default",
  activeTheme,
}) => {
  const strategyEnabled =
    executionStrategy === "code_orchestrated" ||
    activeTools["execution_strategy"];
  const isGeneralTheme = isGeneralResearchTheme(activeTheme);

  return (
    <div className="flex items-center flex-wrap gap-2">
      {toolMode === "default" ? (
        <>
          <ToolButton
            type="button"
            onClick={() => onToolClick?.("thinking")}
            className={activeTools["thinking"] ? "active" : ""}
            aria-pressed={activeTools["thinking"]}
            title={`深度思考${activeTools["thinking"] ? "已开启" : "已关闭"}`}
          >
            <Lightbulb />
            <span>思考</span>
          </ToolButton>

          <ToolButton
            type="button"
            onClick={() => onToolClick?.("web_search")}
            className={activeTools["web_search"] ? "active" : ""}
            aria-pressed={activeTools["web_search"]}
            title={`联网搜索${activeTools["web_search"] ? "已开启" : "已关闭"}`}
          >
            <Globe />
            <span>搜索</span>
          </ToolButton>

          {isGeneralTheme ? (
            <>
              <ToolButton
                type="button"
                onClick={() => onToolClick?.("subagent_mode")}
                className={activeTools["subagent_mode"] ? "active" : ""}
                aria-pressed={activeTools["subagent_mode"]}
                title={`多代理偏好${activeTools["subagent_mode"] ? "已开启" : "已关闭"}`}
              >
                <Workflow />
                <span>多代理</span>
              </ToolButton>
            </>
          ) : null}

          {showExecutionStrategy ? (
            <>
              <Divider />
              <ToolButton
                type="button"
                onClick={() => onToolClick?.("execution_strategy")}
                className={strategyEnabled ? "active" : ""}
                aria-pressed={strategyEnabled}
                title={`Plan 模式${strategyEnabled ? "已开启" : "已关闭"}`}
              >
                <Code2 />
                <span>Plan</span>
              </ToolButton>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
