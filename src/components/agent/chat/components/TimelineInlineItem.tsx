import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Loader2,
  Search,
  TerminalSquare,
  Edit3,
  FileEdit,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type {
  AgentThreadItem,
  AgentThreadToolCallItem,
  AgentThreadCommandExecutionItem,
  AgentThreadWebSearchItem,
} from "@/lib/api/agentProtocol";

interface TimelineInlineItemProps {
  item: AgentThreadItem;
  isLast?: boolean;
}

/**
 * 类型守卫：检查是否为工具调用类型
 */
function isToolCallItem(item: AgentThreadItem): item is AgentThreadToolCallItem {
  return item.type === "tool_call";
}

function isCommandExecutionItem(item: AgentThreadItem): item is AgentThreadCommandExecutionItem {
  return item.type === "command_execution";
}

function isWebSearchItem(item: AgentThreadItem): item is AgentThreadWebSearchItem {
  return item.type === "web_search";
}

/**
 * 获取工具调用的图标
 */
function getToolIcon(toolName: string) {
  const normalized = toolName.toLowerCase();

  if (normalized.includes("read") || normalized.includes("file")) {
    return FileText;
  }
  if (normalized.includes("bash") || normalized.includes("command")) {
    return TerminalSquare;
  }
  if (normalized.includes("web") || normalized.includes("fetch")) {
    return Globe;
  }
  if (normalized.includes("search") || normalized.includes("grep")) {
    return Search;
  }
  if (normalized.includes("edit")) {
    return Edit3;
  }
  if (normalized.includes("write")) {
    return FileEdit;
  }

  return TerminalSquare;
}

/**
 * 获取状态图标
 */
function getStatusIcon(status: string) {
  if (status === "running" || status === "pending") {
    return Loader2;
  }
  if (status === "completed" || status === "success") {
    return CheckCircle2;
  }
  if (status === "failed" || status === "error") {
    return XCircle;
  }
  return CheckCircle2;
}

/**
 * 格式化工具调用的标题
 */
function formatToolCallTitle(item: AgentThreadItem): string {
  // 命令执行
  if (isCommandExecutionItem(item)) {
    const cmd = item.command.trim();
    const shortCmd = cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd;
    return `执行命令 ${shortCmd}`;
  }

  // Web 搜索
  if (isWebSearchItem(item)) {
    return item.query ? `搜索 ${item.query}` : "Web 搜索";
  }

  // 工具调用
  if (isToolCallItem(item)) {
    const toolName = item.tool_name || "操作";
    const args = item.arguments;

    // 尝试提取有意义的参数
    if (args && typeof args === "object" && args !== null) {
      // Read 工具：显示文件路径
      if ("file_path" in args && typeof args.file_path === "string") {
        const fileName = args.file_path.split("/").pop() || args.file_path;
        return `查看 ${fileName}`;
      }

      // Bash 工具：显示命令
      if ("command" in args && typeof args.command === "string") {
        const cmd = args.command.trim();
        const shortCmd = cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd;
        return `执行命令 ${shortCmd}`;
      }

      // WebFetch 工具：显示 URL
      if ("url" in args && typeof args.url === "string") {
        return `访问 ${args.url}`;
      }

      // Grep 工具：显示搜索模式
      if ("pattern" in args && typeof args.pattern === "string") {
        return `搜索 ${args.pattern}`;
      }

      // Edit 工具：显示文件路径
      if ("file_path" in args && typeof args.file_path === "string") {
        const fileName = args.file_path.split("/").pop() || args.file_path;
        return `编辑 ${fileName}`;
      }

      // Write 工具：显示文件路径
      if ("file_path" in args && typeof args.file_path === "string") {
        const fileName = args.file_path.split("/").pop() || args.file_path;
        return `写入 ${fileName}`;
      }
    }

    return toolName;
  }

  return "操作";
}

/**
 * 截断长文本
 */
function truncateText(text: string, maxLines: number = 3): { preview: string; hasMore: boolean } {
  const lines = text.split("\n");

  if (lines.length <= maxLines) {
    return { preview: text, hasMore: false };
  }

  const preview = lines.slice(0, maxLines).join("\n");
  return { preview, hasMore: true };
}

export function TimelineInlineItem({ item, isLast }: TimelineInlineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 获取工具名称
  let toolName = "";
  if (isToolCallItem(item)) {
    toolName = item.tool_name;
  } else if (isCommandExecutionItem(item)) {
    toolName = "Bash";
  } else if (isWebSearchItem(item)) {
    toolName = "WebSearch";
  }

  const ToolIcon = getToolIcon(toolName);
  const StatusIcon = getStatusIcon(item.status);
  const title = formatToolCallTitle(item);

  const isRunning = item.status === "in_progress";
  const isFailed = item.status === "failed";

  // 获取输出内容
  let output = "";
  if (isToolCallItem(item)) {
    output = item.output || item.error || "";
  } else if (isCommandExecutionItem(item)) {
    output = item.aggregated_output || item.error || "";
  } else if (isWebSearchItem(item)) {
    output = item.output || "";
  }

  const { preview, hasMore } = truncateText(output, 3);

  // 默认展开失败的工具调用
  const shouldDefaultExpand = isFailed;

  return (
    <div className="relative flex gap-3">
      {/* 左侧时间线 */}
      <div className="relative flex flex-col items-center">
        {/* 状态图标 */}
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2",
            isRunning && "border-sky-300 bg-sky-50",
            isFailed && "border-rose-300 bg-rose-50",
            !isRunning && !isFailed && "border-slate-300 bg-white"
          )}
        >
          <StatusIcon
            className={cn(
              "h-3.5 w-3.5",
              isRunning && "animate-spin text-sky-600",
              isFailed && "text-rose-600",
              !isRunning && !isFailed && "text-emerald-600"
            )}
          />
        </div>

        {/* 连接线 */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
        )}
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 pb-4">
        <Collapsible
          open={shouldDefaultExpand || isExpanded}
          onOpenChange={setIsExpanded}
        >
          {/* 标题行 */}
          <div className="flex items-center gap-2 text-sm">
            <ToolIcon className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-700">{title}</span>

            {isRunning && (
              <span className="text-xs text-slate-500">正在执行...</span>
            )}
          </div>

          {/* 输出内容 */}
          {output && (
            <div className="mt-2">
              {/* 预览 */}
              <div className={cn(
                "rounded-md border px-3 py-2 text-xs font-mono",
                isFailed ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-slate-50 text-slate-700"
              )}>
                <pre className="whitespace-pre-wrap break-words">
                  {shouldDefaultExpand || isExpanded ? output : preview}
                </pre>
              </div>

              {/* 展开/收起按钮 */}
              {hasMore && !shouldDefaultExpand && (
                <CollapsibleTrigger asChild>
                  <button
                    className="mt-2 flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        查看完整输出
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>
              )}
            </div>
          )}
        </Collapsible>
      </div>
    </div>
  );
}
