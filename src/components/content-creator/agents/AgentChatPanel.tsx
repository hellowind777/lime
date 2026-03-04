/**
 * @file AgentChatPanel.tsx
 * @description AI Agent 对话面板组件
 * @module components/content-creator/agents/AgentChatPanel
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wand2,
  Layout,
  Palette,
  Type,
  Download,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  posterAgentScheduler,
  type AgentInput,
  type AgentSuggestion,
  type PosterAgentId,
} from "./index";
import { ActivityLogList } from "../components/ActivityLog";

/**
 * 消息类型
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 消息
 */
export interface ChatMessage {
  /** 消息 ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 内容 */
  content: string;
  /** 时间戳 */
  timestamp: Date;
  /** Agent ID */
  agentId?: PosterAgentId;
  /** 建议列表 */
  suggestions?: AgentSuggestion[];
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 快捷指令
 */
export interface QuickCommand {
  /** 指令 ID */
  id: string;
  /** 指令名称 */
  name: string;
  /** 指令描述 */
  description: string;
  /** 图标 */
  icon: React.ReactNode;
  /** Agent ID */
  agentId: PosterAgentId;
  /** 预设提示词 */
  prompt?: string;
}

/**
 * 对话面板属性
 */
export interface AgentChatPanelProps {
  /** 项目 ID */
  projectId?: string;
  /** 品牌人设 ID */
  brandPersonaId?: string;
  /** 画布 JSON */
  canvasJson?: Record<string, unknown>;
  /** 建议应用回调 */
  onSuggestionApply?: (suggestion: AgentSuggestion) => void;
  /** 布局应用回调 */
  onLayoutApply?: (layoutJson: Record<string, unknown>) => void;
  /** 类名 */
  className?: string;
}

/**
 * 快捷指令列表
 */
const quickCommands: QuickCommand[] = [
  {
    id: "analyze",
    name: "分析需求",
    description: "分析设计需求，提取关键信息",
    icon: <Sparkles className="h-4 w-4" />,
    agentId: "requirement",
    prompt: "请分析我的设计需求",
  },
  {
    id: "style",
    name: "推荐风格",
    description: "根据需求推荐合适的视觉风格",
    icon: <Palette className="h-4 w-4" />,
    agentId: "style",
    prompt: "请推荐适合的视觉风格",
  },
  {
    id: "layout",
    name: "生成布局",
    description: "生成海报布局方案",
    icon: <Layout className="h-4 w-4" />,
    agentId: "layout",
    prompt: "请生成一个布局方案",
  },
  {
    id: "content",
    name: "填充内容",
    description: "为布局填充文案和图片",
    icon: <Type className="h-4 w-4" />,
    agentId: "content",
    prompt: "请为当前布局填充内容",
  },
  {
    id: "refine",
    name: "优化建议",
    description: "分析并提供优化建议",
    icon: <Wand2 className="h-4 w-4" />,
    agentId: "refine",
    prompt: "请分析当前设计并提供优化建议",
  },
  {
    id: "export",
    name: "导出建议",
    description: "提供多平台导出建议",
    icon: <Download className="h-4 w-4" />,
    agentId: "export",
    prompt: "请提供导出建议",
  },
];

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 消息气泡组件
 */
function MessageBubble({
  message,
  onSuggestionApply,
  onRetry,
}: {
  message: ChatMessage;
  onSuggestionApply?: (suggestion: AgentSuggestion) => void;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser && "flex-row-reverse",
        isSystem && "justify-center",
      )}
    >
      {/* 头像 */}
      {!isSystem && (
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      )}

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col max-w-[80%]",
          isUser && "items-end",
          isSystem && "items-center",
        )}
      >
        {/* Agent 标签 */}
        {message.agentId && !isUser && (
          <Badge variant="outline" className="mb-1 text-xs">
            {getAgentName(message.agentId)}
          </Badge>
        )}

        {/* 消息气泡 */}
        <div
          className={cn(
            "rounded-lg px-4 py-2",
            isUser && "bg-primary text-primary-foreground",
            !isUser && !isSystem && "bg-muted",
            isSystem && "bg-yellow-100 text-yellow-800 text-sm",
          )}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>思考中...</span>
            </div>
          ) : message.error ? (
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-4 w-4" />
              <span>{message.error}</span>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  className="ml-2"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  重试
                </Button>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* 建议列表 */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 space-y-2 w-full">
            {message.suggestions.map((suggestion, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{suggestion.title}</p>
                    {suggestion.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {suggestion.description}
                      </p>
                    )}
                  </div>
                  {onSuggestionApply && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSuggestionApply(suggestion)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      应用
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 时间戳 */}
        <span className="text-xs text-muted-foreground mt-1">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

/**
 * 获取 Agent 名称
 */
function getAgentName(agentId: PosterAgentId): string {
  const names: Record<PosterAgentId, string> = {
    requirement: "需求分析",
    style: "风格推荐",
    layout: "布局生成",
    content: "内容填充",
    refine: "优化建议",
    export: "导出处理",
  };
  return names[agentId] || agentId;
}

/**
 * AI Agent 对话面板
 */
export function AgentChatPanel({
  projectId,
  brandPersonaId,
  canvasJson,
  onSuggestionApply,
  onLayoutApply,
  className,
}: AgentChatPanelProps) {
  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      role: "system",
      content:
        "你好！我是海报设计助手，可以帮你分析需求、推荐风格、生成布局。试试下面的快捷指令开始吧！",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<PosterAgentId | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 消息变化时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string, agentId?: PosterAgentId) => {
      if (!content.trim() || isProcessing) return;

      const targetAgent = agentId || activeAgent || "requirement";

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsProcessing(true);

      // 添加加载消息
      const loadingMessageId = generateId();
      const loadingMessage: ChatMessage = {
        id: loadingMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        agentId: targetAgent,
        isLoading: true,
      };
      setMessages((prev) => [...prev, loadingMessage]);

      try {
        // 构建 Agent 输入
        const agentInput: AgentInput = {
          userInput: content,
          context: {
            projectId,
            brandPersonaId,
            canvasJson,
            conversationHistory: messages
              .filter((m) => m.role !== "system")
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
          },
        };

        // 执行 Agent
        const output = await posterAgentScheduler.runAgent(
          targetAgent,
          agentInput,
        );

        // 更新消息
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: output?.summary || "处理完成",
                  suggestions: output?.suggestions,
                  isLoading: false,
                }
              : msg,
          ),
        );

        // 如果是布局 Agent，触发布局应用回调
        if (targetAgent === "layout" && output?.suggestions?.[0]?.content) {
          const layoutContent = output.suggestions[0].content;
          if (
            typeof layoutContent === "object" &&
            layoutContent !== null &&
            "fabricJson" in layoutContent
          ) {
            onLayoutApply?.(
              (layoutContent as { fabricJson: Record<string, unknown> })
                .fabricJson,
            );
          }
        }
      } catch (error) {
        // 更新错误消息
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  isLoading: false,
                  error:
                    error instanceof Error ? error.message : "处理失败，请重试",
                }
              : msg,
          ),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      isProcessing,
      activeAgent,
      projectId,
      brandPersonaId,
      canvasJson,
      messages,
      onLayoutApply,
    ],
  );

  // 处理快捷指令
  const handleQuickCommand = useCallback(
    (command: QuickCommand) => {
      setActiveAgent(command.agentId);
      if (command.prompt) {
        sendMessage(command.prompt, command.agentId);
      }
    },
    [sendMessage],
  );

  // 处理建议应用
  const handleSuggestionApply = useCallback(
    (suggestion: AgentSuggestion) => {
      onSuggestionApply?.(suggestion);

      // 添加系统消息
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "system",
          content: `已应用: ${suggestion.title}`,
          timestamp: new Date(),
        },
      ]);
    },
    [onSuggestionApply],
  );

  // 处理重试
  const handleRetry = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message?.agentId) {
        // 找到对应的用户消息
        const messageIndex = messages.findIndex((m) => m.id === messageId);
        const userMessage = messages
          .slice(0, messageIndex)
          .reverse()
          .find((m) => m.role === "user");
        if (userMessage) {
          // 移除错误消息
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
          // 重新发送
          sendMessage(userMessage.content, message.agentId);
        }
      }
    },
    [messages, sendMessage],
  );

  // 处理输入提交
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(inputValue);
    },
    [inputValue, sendMessage],
  );

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* 主对话面板 */}
      <Card className={cn("flex flex-col flex-1", showActivityLog && "max-w-[60%]")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI 设计助手
              {activeAgent && (
                <Badge variant="secondary">{getAgentName(activeAgent)}</Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActivityLog(!showActivityLog)}
            >
              <FileText className="h-4 w-4 mr-1" />
              {showActivityLog ? '隐藏日志' : '活动日志'}
            </Button>
          </div>
        </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* 快捷指令 */}
        <div className="px-4 py-2 border-b">
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              {quickCommands.map((command) => (
                <Tooltip key={command.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeAgent === command.agentId ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleQuickCommand(command)}
                      disabled={isProcessing}
                    >
                      {command.icon}
                      <span className="ml-1">{command.name}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{command.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>

        {/* 消息列表 */}
        <ScrollArea className="flex-1 px-4 py-2" ref={scrollRef}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSuggestionApply={handleSuggestionApply}
              onRetry={
                message.error ? () => handleRetry(message.id) : undefined
              }
            />
          ))}
        </ScrollArea>

        <Separator />

        {/* 输入区域 */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="描述你的设计需求..."
              disabled={isProcessing}
              className="flex-1"
            />
            <Button type="submit" disabled={isProcessing || !inputValue.trim()}>
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    {/* 活动日志面板 */}
    {showActivityLog && (
      <Card className="flex-1 max-w-[40%] h-full">
        <ActivityLogList />
      </Card>
    )}
  </div>
  );
}

export default AgentChatPanel;
