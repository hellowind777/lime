import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Topic, TaskStatus } from "../hooks/agentChatShared";
import type { Message } from "../types";

const RECENT_TASK_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;
const OLDER_TASKS_INITIAL_COUNT = 8;
const PINNED_TASK_IDS_STORAGE_KEY = "proxycast_task_sidebar_pinned_ids";

const STATUS_META: Record<
  TaskStatus,
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  draft: {
    label: "待补充",
    badgeClassName:
      "border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    dotClassName: "bg-slate-400",
  },
  running: {
    label: "进行中",
    badgeClassName:
      "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
    dotClassName: "bg-sky-500",
  },
  waiting: {
    label: "待处理",
    badgeClassName:
      "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },
  done: {
    label: "已完成",
    badgeClassName:
      "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
  },
  failed: {
    label: "异常中断",
    badgeClassName:
      "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    dotClassName: "bg-rose-500",
  },
};

type TaskSectionKey = "running" | "waiting" | "recent" | "older";

interface TaskCardViewModel {
  id: string;
  title: string;
  updatedAt: Date;
  messagesCount: number;
  status: TaskStatus;
  statusLabel: string;
  lastPreview: string;
  isCurrent: boolean;
  isPinned: boolean;
  hasUnread: boolean;
}

interface TaskSection {
  key: TaskSectionKey;
  title: string;
  items: TaskCardViewModel[];
}

interface ChatSidebarProps {
  onNewChat: () => void;
  topics: Topic[];
  currentTopicId: string | null;
  onSwitchTopic: (topicId: string) => void;
  onDeleteTopic: (topicId: string) => void;
  onRenameTopic?: (topicId: string, newTitle: string) => void;
  currentMessages?: Message[];
  isSending?: boolean;
  pendingActionCount?: number;
  workspaceError?: boolean;
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}天前`;
  }

  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

function normalizePreviewText(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 72);
}

function resolveCurrentTaskPreview(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const content = normalizePreviewText(
      message.content ||
        message.contentParts
          ?.filter(
            (part): part is Extract<(typeof message.contentParts)[number], { type: "text" | "thinking" }> =>
              part.type === "text" || part.type === "thinking",
          )
          .map((part) => part.text)
          .join(" ") ||
        "",
    );
    if (content) {
      return content;
    }
  }

  return "";
}

function sortTaskItems(items: TaskCardViewModel[]) {
  return [...items].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function loadPinnedTaskIds() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(PINNED_TASK_IDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function resolveCurrentStatusPreview(
  status: TaskStatus,
  fallbackPreview: string,
  pendingActionCount: number,
  workspaceError: boolean,
) {
  if (workspaceError && status === "failed") {
    return "工作区异常，等待你重新选择本地目录后继续。";
  }
  if (status === "running") {
    return "正在生成回复或执行工具，请稍候。";
  }
  if (status === "waiting" && pendingActionCount > 0) {
    return "等待你确认或补充信息后继续执行。";
  }
  if (status === "draft") {
    return "等待你补充任务需求后开始执行。";
  }
  return fallbackPreview;
}

function resolveTaskStatus(params: {
  topic: Topic;
  currentTopicId: string | null;
  isSending: boolean;
  pendingActionCount: number;
  workspaceError: boolean;
}) {
  const { topic, currentTopicId, isSending, pendingActionCount, workspaceError } =
    params;

  if (topic.id === currentTopicId) {
    if (workspaceError) {
      return "failed" as const;
    }
    if (isSending) {
      return "running" as const;
    }
    if (pendingActionCount > 0) {
      return "waiting" as const;
    }
  }

  return topic.status;
}

function buildTaskSections(items: TaskCardViewModel[]) {
  const now = Date.now();
  const running: TaskCardViewModel[] = [];
  const waiting: TaskCardViewModel[] = [];
  const recent: TaskCardViewModel[] = [];
  const older: TaskCardViewModel[] = [];

  for (const item of items) {
    if (item.status === "running") {
      running.push(item);
      continue;
    }

    if (
      item.status === "waiting" ||
      item.status === "draft" ||
      item.status === "failed"
    ) {
      waiting.push(item);
      continue;
    }

    if (now - item.updatedAt.getTime() <= RECENT_TASK_WINDOW_MS) {
      recent.push(item);
      continue;
    }

    older.push(item);
  }

  return [
    { key: "running", title: "进行中", items: sortTaskItems(running) },
    { key: "waiting", title: "待处理", items: sortTaskItems(waiting) },
    { key: "recent", title: "最近完成", items: sortTaskItems(recent) },
    { key: "older", title: "更早任务", items: sortTaskItems(older) },
  ] satisfies TaskSection[];
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  onNewChat,
  topics,
  currentTopicId,
  onSwitchTopic,
  onDeleteTopic,
  onRenameTopic,
  currentMessages = [],
  isSending = false,
  pendingActionCount = 0,
  workspaceError = false,
}) => {
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");
  const [showAllOlder, setShowAllOlder] = useState(false);
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>(() =>
    loadPinnedTaskIds(),
  );
  const [collapsedSections, setCollapsedSections] = useState<
    Record<TaskSectionKey, boolean>
  >({
    running: false,
    waiting: false,
    recent: false,
    older: false,
  });
  const editInputRef = useRef<HTMLInputElement>(null);

  const currentTaskPreview = useMemo(
    () => resolveCurrentTaskPreview(currentMessages),
    [currentMessages],
  );
  const pinnedTaskIdSet = useMemo(
    () => new Set(pinnedTaskIds),
    [pinnedTaskIds],
  );

  const taskItems = useMemo(() => {
    return topics.map((topic) => {
      const status = resolveTaskStatus({
        topic,
        currentTopicId,
        isSending,
        pendingActionCount,
        workspaceError,
      });

      const statusLabel = STATUS_META[status].label;
      const isCurrent = topic.id === currentTopicId;
      const fallbackPreview = normalizePreviewText(topic.lastPreview);
      const preview = isCurrent
        ? resolveCurrentStatusPreview(
            status,
            currentTaskPreview || fallbackPreview,
            pendingActionCount,
            workspaceError,
          )
        : fallbackPreview;

      return {
        id: topic.id,
        title: topic.title || "未命名任务",
        updatedAt: topic.updatedAt || topic.createdAt,
        messagesCount: topic.messagesCount,
        status,
        statusLabel,
        lastPreview: preview || "等待你补充任务需求后开始执行。",
        isCurrent,
        isPinned: topic.isPinned || pinnedTaskIdSet.has(topic.id),
        hasUnread: topic.hasUnread,
      } satisfies TaskCardViewModel;
    });
  }, [
    currentTaskPreview,
    currentTopicId,
    isSending,
    pendingActionCount,
    pinnedTaskIdSet,
    topics,
    workspaceError,
  ]);

  const filteredTaskItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return taskItems.filter((item) => {
      if (
        statusFilter === "active" &&
        item.status !== "running" &&
        item.status !== "waiting"
      ) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return `${item.title} ${item.lastPreview} ${item.statusLabel}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [searchKeyword, statusFilter, taskItems]);

  const sections = useMemo(
    () => buildTaskSections(filteredTaskItems),
    [filteredTaskItems],
  );

  const hasAnyTasks = topics.length > 0;
  const hasFilteredResults = filteredTaskItems.length > 0;

  useEffect(() => {
    if (editingTopicId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTopicId]);

  useEffect(() => {
    setShowAllOlder(false);
  }, [searchKeyword, statusFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      PINNED_TASK_IDS_STORAGE_KEY,
      JSON.stringify(pinnedTaskIds),
    );
  }, [pinnedTaskIds]);

  const handleDeleteClick = (topicId: string) => {
    onDeleteTopic(topicId);
  };

  const handleStartEdit = (topicId: string, currentTitle: string) => {
    setEditingTopicId(topicId);
    setEditTitle(currentTitle);
  };

  const handleTogglePinned = (topicId: string) => {
    setPinnedTaskIds((current) =>
      current.includes(topicId)
        ? current.filter((item) => item !== topicId)
        : [...current, topicId],
    );
  };

  const handleSaveEdit = () => {
    if (editingTopicId && editTitle.trim() && onRenameTopic) {
      onRenameTopic(editingTopicId, editTitle.trim());
    }
    setEditingTopicId(null);
    setEditTitle("");
  };

  const handleCancelEdit = () => {
    setEditingTopicId(null);
    setEditTitle("");
  };

  const handleEditKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSaveEdit();
    } else if (event.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <aside
      className="w-[296px] shrink-0 border-r border-slate-200/80 bg-slate-50/88 backdrop-blur dark:border-white/10 dark:bg-[#111318]"
      data-testid="chat-sidebar"
    >
      <div className="flex h-full min-h-0 flex-col gap-4 p-3">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="搜索任务标题或摘要"
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-white/20 dark:focus:ring-white/10"
            />
          </div>

          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" />
            新建任务
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "inline-flex h-9 flex-1 items-center justify-center rounded-xl border text-xs font-medium transition",
                statusFilter === "all"
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
              )}
            >
              全部任务
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={cn(
                "inline-flex h-9 flex-1 items-center justify-center rounded-xl border text-xs font-medium transition",
                statusFilter === "active"
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
              )}
            >
              仅看进行中
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">
            任务
          </div>
          <div className="text-xs text-slate-400">
            {searchKeyword.trim()
              ? `${filteredTaskItems.length} 条结果`
              : `${topics.length} 条`}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {!hasAnyTasks ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                还没有任务
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                从“新建任务”开始输入需求，创建后会出现在这里。
              </p>
            </div>
          ) : !hasFilteredResults ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                没有匹配的任务
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                试试搜索标题、执行摘要或状态关键词。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => {
                const isOlderSection = section.key === "older";
                const visibleItems =
                  isOlderSection && !showAllOlder
                    ? section.items.slice(0, OLDER_TASKS_INITIAL_COUNT)
                    : section.items;

                if (section.items.length === 0) {
                  return null;
                }

                return (
                  <section key={section.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          [section.key]: !prev[section.key],
                        }))
                      }
                      className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-left transition hover:bg-white/70 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-slate-400 transition-transform",
                            collapsedSections[section.key] ? "-rotate-90" : "",
                          )}
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {section.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {section.items.length}
                      </span>
                    </button>

                    {collapsedSections[section.key] ? null : (
                      <div className="space-y-2">
                        {visibleItems.map((item) => {
                          const statusMeta = STATUS_META[item.status];

                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (editingTopicId !== item.id) {
                                  onSwitchTopic(item.id);
                                }
                              }}
                              onDoubleClick={() =>
                                handleStartEdit(item.id, item.title)
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  if (editingTopicId !== item.id) {
                                    onSwitchTopic(item.id);
                                  }
                                }
                              }}
                              className={cn(
                                "group rounded-[20px] border p-3 text-left transition",
                                item.isCurrent
                                  ? "border-slate-300 bg-white shadow-sm shadow-slate-950/5 dark:border-white/15 dark:bg-white/10"
                                  : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white/82 dark:hover:border-white/10 dark:hover:bg-white/5",
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={cn(
                                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                                    statusMeta.dotClassName,
                                  )}
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start gap-2">
                                    {editingTopicId === item.id ? (
                                      <input
                                        ref={editInputRef}
                                        type="text"
                                        value={editTitle}
                                        onChange={(event) =>
                                          setEditTitle(event.target.value)
                                        }
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={handleSaveEdit}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        className="h-8 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-400 dark:border-white/10 dark:bg-[#17191f] dark:text-slate-100"
                                      />
                                    ) : (
                                      <>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                              {item.title || "未命名任务"}
                                            </div>
                                            {item.isPinned ? (
                                              <Pin className="h-3.5 w-3.5 text-slate-400" />
                                            ) : null}
                                            {item.hasUnread ? (
                                              <span className="h-2 w-2 rounded-full bg-sky-500" />
                                            ) : null}
                                          </div>
                                        </div>
                                        <div className="shrink-0 pt-0.5 text-[11px] text-slate-400">
                                          {formatRelativeTime(item.updatedAt)}
                                        </div>
                                      </>
                                    )}

                                    {editingTopicId === item.id ? null : (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            type="button"
                                            aria-label="任务操作"
                                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-slate-100"
                                            onClick={(event) =>
                                              event.stopPropagation()
                                            }
                                          >
                                            <MoreHorizontal className="h-4 w-4" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleStartEdit(item.id, item.title)
                                            }
                                          >
                                            <PencilLine className="h-4 w-4" />
                                            重命名任务
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleTogglePinned(item.id)
                                            }
                                          >
                                            {item.isPinned ? (
                                              <PinOff className="h-4 w-4" />
                                            ) : (
                                              <Pin className="h-4 w-4" />
                                            )}
                                            {item.isPinned ? "取消固定" : "固定任务"}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-rose-600"
                                            onClick={() =>
                                              handleDeleteClick(item.id)
                                            }
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            删除任务
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>

                                  <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    {item.lastPreview}
                                  </div>

                                  <div className="mt-3 flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "px-2.5 py-1 text-[11px] font-medium",
                                        statusMeta.badgeClassName,
                                      )}
                                    >
                                      {item.status === "running" ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      ) : null}
                                      {statusMeta.label}
                                    </Badge>
                                    <span className="text-[11px] text-slate-400">
                                      {item.messagesCount > 0
                                        ? `${item.messagesCount} 条消息`
                                        : "尚未开始执行"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {isOlderSection &&
                        section.items.length > OLDER_TASKS_INITIAL_COUNT &&
                        !showAllOlder ? (
                          <button
                            type="button"
                            onClick={() => setShowAllOlder(true)}
                            className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/75 px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                          >
                            查看更多历史任务
                          </button>
                        ) : null}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
