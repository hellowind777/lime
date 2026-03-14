import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Clock3,
  FolderKanban,
  Lightbulb,
  Palette,
  PanelsTopLeft,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type {
  Page,
  PageParams,
  StylePageParams,
  StylePageSection,
} from "@/types/page";
import {
  getStoredResourceProjectId,
  onResourceProjectChange,
} from "@/lib/resourceProjectSelection";
import { getStyleGuide, type StyleGuide } from "@/lib/api/memory";
import {
  getProject,
  getProjectTypeLabel,
  listProjects,
  type Project,
} from "@/lib/api/project";
import {
  buildStyleSummary,
  hasStyleGuideContent,
  resolveTextStylizeSourceLabel,
} from "@/lib/style-guide";
import { useStyleLibrary } from "@/hooks/useStyleLibrary";
import {
  getStyleLibraryApplicationHistory,
  setActiveStyleLibraryEntry,
  setStyleLibraryEnabled,
  type StyleLibraryEntry,
  type StyleLibraryProjectApplication,
} from "@/lib/style-library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StyleLibraryPanel } from "@/components/memory/StyleLibraryPanel";
import { cn } from "@/lib/utils";

interface StylePageProps {
  onNavigate?: (page: Page, params?: PageParams) => void;
  pageParams?: StylePageParams;
}

interface ResolvedApplicationHistoryItem
  extends StyleLibraryProjectApplication {
  projectName: string;
  workspaceLabel: string | null;
}

const SECTION_META: Record<
  StylePageSection,
  { eyebrow: string; title: string; description: string }
> = {
  overview: {
    eyebrow: "风格资产中心",
    title: "我的风格",
    description: "先确认状态与下一步动作，再进入具体工作台。",
  },
  library: {
    eyebrow: "风格库工作台",
    title: "管理风格资产",
    description: "左侧选择资产，中间编辑，右侧预览与应用。",
  },
};

function resolveStyleSection(
  section?: StylePageParams["section"],
): StylePageSection {
  return section === "library" ? "library" : "overview";
}

function SectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: StylePageSection;
  onChange: (section: StylePageSection) => void;
}) {
  const tabs: Array<{ key: StylePageSection; label: string }> = [
    { key: "overview", label: "总览" },
    { key: "library", label: "风格库工作台" },
  ];

  return (
    <div className="inline-flex rounded-2xl border border-white/85 bg-white/85 p-1 shadow-sm shadow-slate-950/5 backdrop-blur">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            activeSection === tab.key
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OverviewMetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/90 bg-white/88 p-4 shadow-sm shadow-slate-950/5">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function OverviewFeatureCard({
  icon: Icon,
  title,
  description,
  accentClassName,
  badge,
  children,
  actionLabel,
  onAction,
  actionVariant = "outline",
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accentClassName: string;
  badge: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  actionVariant?: "default" | "outline";
  disabled?: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${accentClassName}`}
      />
      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/90 bg-white/90 text-slate-700 shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {badge}
          </span>
        </div>

        <div className="mt-5 flex flex-1 flex-col gap-4">
          <div className="rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-4 text-sm text-slate-600">
            {children}
          </div>

          <Button
            className="mt-auto w-full"
            variant={actionVariant}
            onClick={onAction}
            disabled={disabled}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

function RecentEntryCard({
  entry,
  onOpen,
}: {
  entry: StyleLibraryEntry;
  onOpen: (entry: StyleLibraryEntry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] px-4 py-4 text-left shadow-sm shadow-slate-950/5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-100 text-sky-700">
              <Palette className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {entry.profile.name}
                </div>
                <Badge variant="outline">{entry.sourceLabel}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                {entry.profile.description || "尚未补充风格定位"}
              </p>
            </div>
          </div>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.profile.toneKeywords.slice(0, 3).map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          最近更新 {formatDateTimeLabel(entry.updatedAt)}
        </span>
        <span>
          {entry.sourceFiles.length > 0
            ? `${entry.sourceFiles.length} 个样本`
            : "手动资产"}
        </span>
      </div>
    </button>
  );
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function RecentApplicationCard({
  item,
  isCurrentProject,
  onOpenProject,
  onOpenEntry,
}: {
  item: ResolvedApplicationHistoryItem;
  isCurrentProject: boolean;
  onOpenProject: (projectId: string) => void;
  onOpenEntry: (entryId: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-4 shadow-sm shadow-slate-950/5",
        isCurrentProject
          ? "border-emerald-300 bg-emerald-50/80"
          : "border-slate-200/80 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-slate-900">
          {item.projectName}
        </div>
        {isCurrentProject ? <Badge variant="secondary">当前项目</Badge> : null}
      </div>

      <div className="mt-2 text-sm text-slate-600">
        关联风格：{item.entryName}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {item.workspaceLabel ? `${item.workspaceLabel} · ` : ""}
        应用于 {formatDateTimeLabel(item.appliedAt)}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onOpenProject(item.projectId)}
        >
          查看项目风格
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onOpenEntry(item.entryId)}
        >
          查看资产
        </Button>
      </div>
    </div>
  );
}

function RecommendedActions({
  items,
}: {
  items: Array<{
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
    disabled?: boolean;
  }>;
}) {
  return (
    <Card className="relative overflow-hidden rounded-[26px] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.82)_0%,rgba(255,255,255,0.98)_36%,rgba(255,255,255,1)_100%)] shadow-sm shadow-slate-950/5">
      <div className="pointer-events-none absolute right-[-54px] top-[-24px] h-36 w-36 rounded-full bg-amber-200/40 blur-3xl" />
      <CardHeader className="relative pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <Lightbulb className="h-4 w-4" />
          推荐下一步
        </CardTitle>
        <CardDescription className="text-slate-600">
          根据当前状态，只展示最值得先做的动作。
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-[20px] border border-white/90 bg-white/90 px-4 py-4"
          >
            <div className="text-sm font-semibold text-slate-900">
              {item.title}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-500">
              {item.description}
            </div>
            <Button
              className="mt-4 w-full"
              variant={item.disabled ? "outline" : "default"}
              disabled={item.disabled}
              onClick={item.onAction}
            >
              {item.actionLabel}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OverviewSection({
  enabled,
  activeEntryName,
  entryCount,
  recentEntries,
  project,
  projectId,
  projectStyleGuide,
  recentApplications,
  onEnableChange,
  onEnterLibrary,
  onOpenProjectStyleGuide,
  onOpenAppliedProject,
  onOpenAppliedEntry,
  onOpenProjects,
  onOpenRecentEntry,
}: {
  enabled: boolean;
  activeEntryName: string;
  entryCount: number;
  recentEntries: StyleLibraryEntry[];
  project: Project | null;
  projectId: string | null;
  projectStyleGuide: StyleGuide | null;
  recentApplications: ResolvedApplicationHistoryItem[];
  onEnableChange: (checked: boolean) => void;
  onEnterLibrary: () => void;
  onOpenProjectStyleGuide: () => void;
  onOpenAppliedProject: (projectId: string, entryId: string) => void;
  onOpenAppliedEntry: (entryId: string) => void;
  onOpenProjects: () => void;
  onOpenRecentEntry: (entry: StyleLibraryEntry) => void;
}) {
  const projectStyleSummary = buildStyleSummary(projectStyleGuide);
  const textStylizeSourceLabel = resolveTextStylizeSourceLabel({
    projectId,
    projectStyleGuide,
  });

  const recommendedActions = useMemo(() => {
    if (entryCount === 0) {
      return [
        {
          title: "创建第一条风格资产",
          description:
            "先上传代表作或新建手动风格，建立一条可复用的个人风格基线。",
          actionLabel: "进入工作台开始创建",
          onAction: onEnterLibrary,
        },
      ];
    }

    if (!enabled) {
      return [
        {
          title: "启用我的风格",
          description:
            "先打开全局开关，否则风格资产不会出现在创作任务选择器中。",
          actionLabel: "立即启用",
          onAction: () => onEnableChange(true),
        },
      ];
    }

    if (!projectId) {
      return [
        {
          title: "选择一个项目",
          description:
            "选择项目后，才能把风格资产应用成项目默认风格，并被画布即时风格化消费。",
          actionLabel: "去选择项目",
          onAction: onOpenProjects,
        },
      ];
    }

    if (!hasStyleGuideContent(projectStyleGuide)) {
      return [
        {
          title: "为当前项目设置默认风格",
          description:
            "当前项目还没有默认风格。建议先在工作台选中一条资产，再应用到项目。",
          actionLabel: "进入工作台设置",
          onAction: onEnterLibrary,
        },
        {
          title: "直接打开项目风格策略",
          description: "如果你想先手动补策略，也可以直接进入项目风格编辑器。",
          actionLabel: "打开项目风格策略",
          onAction: onOpenProjectStyleGuide,
        },
      ];
    }

    return [
      {
        title: "继续完善项目风格策略",
        description: "当前项目已经有默认风格，可以继续微调规则和约束。",
        actionLabel: "打开项目风格策略",
        onAction: onOpenProjectStyleGuide,
      },
      {
        title: "继续沉淀风格资产",
        description:
          "如果项目风格已稳定，下一步适合回到工作台补充更多可复用资产。",
        actionLabel: "进入风格库工作台",
        onAction: onEnterLibrary,
      },
    ];
  }, [
    enabled,
    entryCount,
    onEnableChange,
    onEnterLibrary,
    onOpenProjectStyleGuide,
    onOpenProjects,
    projectId,
    projectStyleGuide,
  ]);

  return (
    <div className="space-y-6">
      {entryCount === 0 ? (
        <Card className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,1)_55%,rgba(239,246,255,0.92)_100%)] shadow-sm shadow-slate-950/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-slate-900">
              还没有风格资产
            </CardTitle>
            <CardDescription className="text-slate-600">
              总览页先帮你判断下一步，不需要一上来就进入复杂工作台。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={onEnterLibrary}>进入工作台开始创建</Button>
            <Button variant="outline" onClick={onOpenProjects}>
              先去选择项目
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <OverviewFeatureCard
          icon={FolderKanban}
          title="管理风格资产"
          description={`当前已沉淀 ${entryCount} 条风格资产，活跃风格为 ${activeEntryName}。`}
          accentClassName="from-sky-200/65 via-white to-white"
          badge={`${entryCount} 条`}
          actionLabel="进入风格库工作台"
          onAction={onEnterLibrary}
          actionVariant="default"
        >
          <div className="space-y-3">
            <div>在工作台中完成上传、编辑、预设导入和条目维护。</div>
            <div className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs text-slate-500">
              优先在这里沉淀可复用的个人风格基线
            </div>
          </div>
        </OverviewFeatureCard>

        <OverviewFeatureCard
          icon={Palette}
          title="项目默认风格"
          description={
            projectId
              ? `当前项目：${project?.name || "正在加载项目..."}`
              : "当前未选择项目"
          }
          accentClassName="from-emerald-200/65 via-white to-white"
          badge={projectId ? "项目已绑定" : "等待项目"}
          actionLabel="打开项目风格策略"
          onAction={onOpenProjectStyleGuide}
          disabled={!projectId}
        >
          {hasStyleGuideContent(projectStyleGuide) ? (
            <div className="space-y-2">
              {projectStyleSummary.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : (
            <div>
              {projectId
                ? "当前项目还没有默认风格，建议先从风格库选择一条资产应用到项目。"
                : "选择项目后，可以把某条风格资产设为该项目的默认风格基线。"}
            </div>
          )}
        </OverviewFeatureCard>

        <OverviewFeatureCard
          icon={Wand2}
          title="画布即时风格化"
          description="文本风格化会优先读取项目默认风格，再回退到通用润色。"
          accentClassName="from-amber-200/60 via-white to-white"
          badge={textStylizeSourceLabel}
          actionLabel="进入风格库工作台"
          onAction={onEnterLibrary}
        >
          <div className="space-y-3">
            <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              当前来源：{textStylizeSourceLabel}
            </div>
            <div>
              总览页负责建立心智模型；真正的资产编辑和应用操作放在工作台中完成。
            </div>
          </div>
        </OverviewFeatureCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Sparkles className="h-4 w-4" />
              最近使用的风格
            </CardTitle>
            <CardDescription className="text-slate-600">
              从最近资产继续编辑，比直接进入完整工作台更轻量。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentEntries.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {recentEntries.map((entry) => (
                  <RecentEntryCard
                    key={entry.id}
                    entry={entry}
                    onOpen={onOpenRecentEntry}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-6 py-10 text-center">
                <div className="text-sm font-medium text-slate-900">
                  还没有风格资产
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  先上传样本或新建一条手动风格，再进入工作台继续维护。
                </p>
                <Button className="mt-4" onClick={onEnterLibrary}>
                  进入工作台开始创建
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.92)_0%,rgba(255,255,255,1)_40%)] shadow-sm shadow-slate-950/5">
            <div className="pointer-events-none absolute left-[-48px] top-[-32px] h-36 w-36 rounded-full bg-sky-200/25 blur-3xl" />
            <CardHeader className="relative pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                <PanelsTopLeft className="h-4 w-4" />
                入口与状态
              </CardTitle>
              <CardDescription className="text-slate-600">
                总览页只保留状态感知与入口，不与编辑表单混排。
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-5">
              <div className="flex items-center justify-between rounded-[20px] border border-slate-200/80 bg-white/92 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    启用我的风格
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    开启后，我的风格会出现在创作任务风格选择器中。
                  </div>
                </div>
                <Switch checked={enabled} onCheckedChange={onEnableChange} />
              </div>

              <div className="rounded-[20px] border border-slate-200/80 bg-white/92 px-4 py-4">
                <div className="text-sm font-medium text-slate-900">
                  建议使用路径
                </div>
                <div className="mt-3 space-y-3">
                  {[
                    "进入工作台沉淀或整理风格资产",
                    "将风格资产应用到当前项目默认风格",
                    "在画布上通过文本风格化消费项目风格基线",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-3 text-sm text-slate-600">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={onEnterLibrary}>
                进入风格库工作台
              </Button>
            </CardContent>
          </Card>

          <RecommendedActions items={recommendedActions} />
        </div>
      </div>

      <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-900">
            最近应用到的项目
          </CardTitle>
          <CardDescription className="text-slate-600">
            帮你快速回忆最近哪些项目已经接入了风格资产。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentApplications.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentApplications.map((item) => (
                <RecentApplicationCard
                  key={`${item.projectId}:${item.entryId}:${item.appliedAt}`}
                  item={item}
                  isCurrentProject={projectId === item.projectId}
                  onOpenProject={(nextProjectId) =>
                    onOpenAppliedProject(nextProjectId, item.entryId)
                  }
                  onOpenEntry={onOpenAppliedEntry}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-300 px-6 py-10 text-center">
              <div className="text-sm font-medium text-slate-900">
                还没有应用记录
              </div>
              <p className="mt-2 text-sm text-slate-500">
                当你把风格资产设为项目默认风格后，这里会显示最近接入过的项目。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StylePage({ onNavigate, pageParams }: StylePageProps) {
  const activeSection = resolveStyleSection(pageParams?.section);
  const [projectId, setProjectId] = useState<string | null>(() =>
    getStoredResourceProjectId({ includeLegacy: true }),
  );
  const [project, setProject] = useState<Project | null>(null);
  const [projectStyleGuide, setProjectStyleGuide] = useState<StyleGuide | null>(
    null,
  );
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const { entries, enabled, activeEntry } = useStyleLibrary();

  useEffect(() => {
    return onResourceProjectChange((detail) => {
      setProjectId(detail.projectId);
    });
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setProjectStyleGuide(null);
      return;
    }

    let disposed = false;

    Promise.all([
      getProject(projectId).catch((error) => {
        console.warn("加载风格页当前项目失败:", error);
        return null;
      }),
      getStyleGuide(projectId).catch((error) => {
        console.warn("加载风格页项目风格失败:", error);
        return null;
      }),
    ]).then(([nextProject, nextStyleGuide]) => {
      if (disposed) {
        return;
      }
      setProject(nextProject);
      setProjectStyleGuide(nextStyleGuide);
    });

    return () => {
      disposed = true;
    };
  }, [projectId]);

  const applicationHistory = getStyleLibraryApplicationHistory();
  const applicationHistoryKey = useMemo(
    () =>
      applicationHistory
        .map((item) => `${item.projectId}:${item.entryId}:${item.appliedAt}`)
        .join("|"),
    [applicationHistory],
  );

  useEffect(() => {
    if (!applicationHistoryKey) {
      setRecentProjects([]);
      return;
    }

    let disposed = false;

    listProjects()
      .then((projects) => {
        if (!disposed) {
          setRecentProjects(projects);
        }
      })
      .catch((error) => {
        console.warn("加载风格应用项目列表失败:", error);
        if (!disposed) {
          setRecentProjects([]);
        }
      });

    return () => {
      disposed = true;
    };
  }, [applicationHistoryKey]);

  const sectionMeta = SECTION_META[activeSection];
  const recentEntries = useMemo(() => entries.slice(0, 3), [entries]);
  const recentApplications = useMemo<ResolvedApplicationHistoryItem[]>(
    () =>
      applicationHistory.slice(0, 6).map((item) => {
        const matchedProject = recentProjects.find(
          (project) => project.id === item.projectId,
        );
        return {
          ...item,
          projectName: matchedProject?.name || item.projectId,
          workspaceLabel: matchedProject
            ? getProjectTypeLabel(matchedProject.workspaceType)
            : null,
        };
      }),
    [applicationHistory, recentProjects],
  );
  const connectedProjectCount = useMemo(
    () => new Set(recentApplications.map((item) => item.projectId)).size,
    [recentApplications],
  );
  const overviewStats = useMemo(
    () => [
      {
        label: "风格资产数",
        value: String(entries.length),
        description:
          entries.length > 0
            ? `当前活跃风格：${activeEntry?.profile.name || "未命名风格"}`
            : "先建立第一条可复用的风格资产",
      },
      {
        label: "接入项目",
        value: String(connectedProjectCount),
        description:
          connectedProjectCount > 0
            ? "已有项目接入我的风格基线"
            : "还没有项目使用风格资产",
      },
      {
        label: "当前状态",
        value: enabled ? "已启用" : "已停用",
        description: projectId
          ? hasStyleGuideContent(projectStyleGuide)
            ? "当前项目已建立默认风格"
            : "当前项目等待设置默认风格"
          : "还未选择当前工作项目",
      },
    ],
    [
      activeEntry?.profile.name,
      connectedProjectCount,
      enabled,
      entries.length,
      projectId,
      projectStyleGuide,
    ],
  );
  const overviewBadges = useMemo(
    () =>
      [
        enabled ? "全局开关已启用" : "全局开关未启用",
        `活跃风格：${activeEntry?.profile.name || "暂无"}`,
        projectId
          ? `当前项目：${project?.name || "正在加载项目..."}`
          : "当前项目：未选择",
      ].filter(Boolean),
    [activeEntry?.profile.name, enabled, project?.name, projectId],
  );

  const navigateSection = useCallback(
    (section: StylePageSection) => {
      onNavigate?.("style", { section });
    },
    [onNavigate],
  );

  const handleOpenProjectStyleGuide = useCallback(() => {
    if (!projectId) {
      return;
    }

    onNavigate?.("project-detail", {
      projectId,
      openProjectStyleGuide: true,
    });
  }, [onNavigate, projectId]);

  const handleOpenSpecificProjectStyleGuide = useCallback(
    (targetProjectId: string, sourceEntryId: string) => {
      if (!targetProjectId) {
        return;
      }

      onNavigate?.("project-detail", {
        projectId: targetProjectId,
        openProjectStyleGuide: true,
        openProjectStyleGuideSourceEntryId: sourceEntryId,
      });
    },
    [onNavigate],
  );

  const handleOpenProjects = useCallback(() => {
    onNavigate?.("projects");
  }, [onNavigate]);

  const handleOpenRecentEntry = useCallback(
    (entry: StyleLibraryEntry) => {
      setActiveStyleLibraryEntry(entry.id);
      navigateSection("library");
    },
    [navigateSection],
  );

  const handleOpenAppliedEntry = useCallback(
    (entryId: string) => {
      if (!entryId) {
        return;
      }
      setActiveStyleLibraryEntry(entryId);
      navigateSection("library");
    },
    [navigateSection],
  );

  return (
    <div
      className={cn(
        "h-full overflow-y-auto",
        activeSection === "overview"
          ? "bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(246,250,248,1)_44%,rgba(255,255,255,1)_100%)]"
          : "bg-background",
      )}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6">
        {activeSection === "overview" ? (
          <section className="relative overflow-hidden rounded-[30px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(244,251,248,0.98)_0%,rgba(248,250,252,0.98)_45%,rgba(241,246,255,0.96)_100%)] shadow-sm shadow-slate-950/5">
            <div className="pointer-events-none absolute -left-20 top-[-72px] h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
            <div className="pointer-events-none absolute right-[-76px] top-[-24px] h-56 w-56 rounded-full bg-sky-200/28 blur-3xl" />
            <div className="relative flex flex-col gap-6 p-6 lg:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl space-y-4">
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-emerald-700 shadow-sm">
                    STYLE OVERVIEW
                  </span>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-500">
                      {sectionMeta.eyebrow}
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                      {sectionMeta.title}
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600">
                      {sectionMeta.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {overviewBadges.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/90 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button onClick={() => navigateSection("library")}>
                      进入风格库工作台
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenProjectStyleGuide}
                      disabled={!projectId}
                    >
                      打开项目风格策略
                    </Button>
                    <Button variant="ghost" onClick={handleOpenProjects}>
                      查看项目列表
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 xl:min-w-[430px] xl:items-end">
                  <SectionTabs
                    activeSection={activeSection}
                    onChange={navigateSection}
                  />
                  <div className="grid gap-3 sm:grid-cols-3 xl:w-full">
                    {overviewStats.map((item) => (
                      <OverviewMetricCard
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        description={item.description}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[26px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-sm text-slate-500">{sectionMeta.eyebrow}</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  {sectionMeta.title}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {sectionMeta.description}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <SectionTabs
                  activeSection={activeSection}
                  onChange={navigateSection}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  {overviewBadges.slice(0, 2).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "overview" ? (
          <OverviewSection
            enabled={enabled}
            activeEntryName={activeEntry?.profile.name || "暂无"}
            entryCount={entries.length}
            recentEntries={recentEntries}
            project={project}
            projectId={projectId}
            projectStyleGuide={projectStyleGuide}
            recentApplications={recentApplications}
            onEnableChange={setStyleLibraryEnabled}
            onEnterLibrary={() => navigateSection("library")}
            onOpenProjectStyleGuide={handleOpenProjectStyleGuide}
            onOpenAppliedProject={handleOpenSpecificProjectStyleGuide}
            onOpenAppliedEntry={handleOpenAppliedEntry}
            onOpenProjects={handleOpenProjects}
            onOpenRecentEntry={handleOpenRecentEntry}
          />
        ) : (
          <StyleLibraryPanel
            projectId={projectId}
            onOpenProjectStyleGuide={handleOpenProjectStyleGuide}
            compactHeader
          />
        )}
      </div>
    </div>
  );
}

export default StylePage;
