import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Square } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ThemeWorkspaceRendererProps } from "@/features/themes/types";
import {
  videoGenerationApi,
  type VideoGenerationTask,
  type VideoTaskStatus,
} from "@/lib/api/videoGeneration";

const STATUS_META: Record<
  VideoTaskStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "排队中",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  processing: {
    label: "生成中",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  success: {
    label: "已完成",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  error: {
    label: "失败",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  cancelled: {
    label: "已取消",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function summarizeTasks(tasks: VideoGenerationTask[]) {
  return tasks.reduce(
    (summary, task) => {
      summary.total += 1;
      if (task.status === "pending" || task.status === "processing") {
        summary.running += 1;
      } else if (task.status === "success") {
        summary.success += 1;
      } else if (task.status === "error") {
        summary.error += 1;
      }
      return summary;
    },
    { total: 0, running: 0, success: 0, error: 0 },
  );
}

export function VideoTasksPanel({
  projectId,
}: ThemeWorkspaceRendererProps) {
  const [tasks, setTasks] = useState<VideoGenerationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!projectId) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const taskList = await videoGenerationApi.listTasks(projectId, {
          limit: 50,
        });
        setTasks(
          [...taskList].sort((left, right) => right.createdAt - left.createdAt),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`加载视频任务失败：${message}`);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const hasRunningTask = useMemo(
    () =>
      tasks.some(
        (task) => task.status === "pending" || task.status === "processing",
      ),
    [tasks],
  );

  useEffect(() => {
    if (!hasRunningTask) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadTasks({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasRunningTask, loadTasks]);

  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);

  const handleCancelTask = useCallback(
    async (taskId: string) => {
      setCancellingTaskId(taskId);
      try {
        await videoGenerationApi.cancelTask(taskId);
        toast.success("任务已取消");
        await loadTasks({ silent: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`取消任务失败：${message}`);
      } finally {
        setCancellingTaskId(null);
      }
    },
    [loadTasks],
  );

  if (!projectId) {
    return null;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-xl">视频任务</CardTitle>
              <CardDescription>
                集中查看当前项目的视频生成进度、结果与异常状态。
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadTasks({ silent: true });
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-xs text-muted-foreground">总任务</div>
              <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
            </div>
            <div className="rounded-xl border bg-blue-50 p-3">
              <div className="text-xs text-muted-foreground">进行中</div>
              <div className="mt-1 text-2xl font-semibold">{summary.running}</div>
            </div>
            <div className="rounded-xl border bg-emerald-50 p-3">
              <div className="text-xs text-muted-foreground">已完成</div>
              <div className="mt-1 text-2xl font-semibold">{summary.success}</div>
            </div>
            <div className="rounded-xl border bg-red-50 p-3">
              <div className="text-xs text-muted-foreground">失败</div>
              <div className="mt-1 text-2xl font-semibold">{summary.error}</div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              正在加载视频任务...
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="text-base font-medium text-foreground">
                暂无视频任务
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                请先回到「创作」视图提交视频生成，结果会自动沉淀到这里。
              </div>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const meta = STATUS_META[task.status];
            const canCancel =
              task.status === "pending" || task.status === "processing";

            return (
              <Card key={task.id} data-testid={`video-task-${task.id}`}>
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={meta.className}
                      >
                        {meta.label}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {task.providerId} · {task.model}
                      </span>
                    </div>
                    <CardDescription className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {task.prompt || "未提供提示词"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {task.resultUrl ? (
                      <a
                        href={task.resultUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          查看结果
                        </Button>
                      </a>
                    ) : null}
                    {canCancel ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void handleCancelTask(task.id);
                        }}
                        disabled={cancellingTaskId === task.id}
                      >
                        <Square className="mr-2 h-3.5 w-3.5" />
                        取消任务
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-4">
                  <div>
                    <div className="text-xs">创建时间</div>
                    <div className="mt-1 text-foreground">
                      {formatTime(task.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs">更新时间</div>
                    <div className="mt-1 text-foreground">
                      {formatTime(task.updatedAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs">完成时间</div>
                    <div className="mt-1 text-foreground">
                      {formatTime(task.finishedAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs">任务 ID</div>
                    <div className="mt-1 break-all font-mono text-xs text-foreground">
                      {task.id}
                    </div>
                  </div>
                  {task.errorMessage ? (
                    <div className="sm:col-span-4">
                      <div className="text-xs text-red-600">失败原因</div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-red-600">
                        {task.errorMessage}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
