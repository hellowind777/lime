import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Boxes, Globe, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyStateQuickActions } from "../components/EmptyStateQuickActions";
import { resolveServiceSkillEntryDescription } from "./entryAdapter";
import type {
  ServiceSkillCatalogMeta,
  ServiceSkillGroup,
  ServiceSkillHomeItem,
} from "./types";

interface ServiceSkillHomePanelProps {
  skills: ServiceSkillHomeItem[];
  groups?: ServiceSkillGroup[];
  catalogMeta?: ServiceSkillCatalogMeta | null;
  loading?: boolean;
  onSelect: (skill: ServiceSkillHomeItem) => void | Promise<void>;
  onOpenAutomationJob?: (skill: ServiceSkillHomeItem) => void | Promise<void>;
}

interface ServiceSkillGroupView extends ServiceSkillGroup {
  skills: ServiceSkillHomeItem[];
}

const GROUP_CARD_CLASSNAMES: Record<string, string> = {
  github:
    "border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.96)_0%,rgba(255,255,255,1)_100%)]",
  zhihu:
    "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(255,255,255,1)_100%)]",
  "linux-do":
    "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.96)_0%,rgba(255,255,255,1)_100%)]",
  bilibili:
    "border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96)_0%,rgba(255,255,255,1)_100%)]",
  "36kr":
    "border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96)_0%,rgba(255,255,255,1)_100%)]",
  smzdm:
    "border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,1)_100%)]",
  "yahoo-finance":
    "border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.96)_0%,rgba(255,255,255,1)_100%)]",
  general:
    "border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,1)_100%)]",
};

const GROUP_BADGE_CLASSNAMES: Record<string, string> = {
  github: "border-sky-200 bg-sky-50 text-sky-700",
  zhihu: "border-amber-200 bg-amber-50 text-amber-700",
  "linux-do": "border-emerald-200 bg-emerald-50 text-emerald-700",
  bilibili: "border-rose-200 bg-rose-50 text-rose-700",
  "36kr": "border-cyan-200 bg-cyan-50 text-cyan-700",
  smzdm: "border-orange-200 bg-orange-50 text-orange-700",
  "yahoo-finance": "border-violet-200 bg-violet-50 text-violet-700",
  general: "border-slate-200 bg-slate-50 text-slate-700",
};

function resolveSkillGroupKey(skill: ServiceSkillHomeItem): string {
  return skill.groupKey?.trim() || "general";
}

function resolveGroupCardClassName(groupKey: string): string {
  return GROUP_CARD_CLASSNAMES[groupKey] ?? GROUP_CARD_CLASSNAMES.general;
}

function resolveGroupBadgeClassName(groupKey: string): string {
  return GROUP_BADGE_CLASSNAMES[groupKey] ?? GROUP_BADGE_CLASSNAMES.general;
}

function resolveGroupBadgeLabel(groupKey: string): string {
  return groupKey === "general" ? "通用能力组" : "站点技能组";
}

function resolveGroupIcon(groupKey: string) {
  if (groupKey === "general") {
    return Sparkles;
  }
  if (groupKey) {
    return Globe;
  }
  return Boxes;
}

function normalizeGroupViews(
  groups: ServiceSkillGroup[],
  skills: ServiceSkillHomeItem[],
): ServiceSkillGroupView[] {
  const skillMap = new Map<string, ServiceSkillHomeItem[]>();

  for (const skill of skills) {
    const groupKey = resolveSkillGroupKey(skill);
    const current = skillMap.get(groupKey) ?? [];
    current.push(skill);
    skillMap.set(groupKey, current);
  }

  return groups
    .map((group) => ({
      ...group,
      itemCount: skillMap.get(group.key)?.length ?? group.itemCount ?? 0,
      skills: skillMap.get(group.key) ?? [],
    }))
    .filter((group) => group.skills.length > 0)
    .sort((left, right) => left.sort - right.sort);
}

function buildSyncedAtLabel(syncedAt?: string | null): string | null {
  if (!syncedAt) {
    return null;
  }

  const parsed = new Date(syncedAt);
  if (Number.isNaN(parsed.getTime())) {
    return syncedAt;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function ServiceSkillHomePanel({
  skills,
  groups = [],
  catalogMeta = null,
  loading = false,
  onSelect,
  onOpenAutomationJob,
}: ServiceSkillHomePanelProps) {
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const cloudSkills = useMemo(
    () => skills.filter((skill) => skill.source === "cloud_catalog"),
    [skills],
  );
  const localSkills = useMemo(
    () => skills.filter((skill) => skill.source === "local_custom"),
    [skills],
  );
  const syncedAtLabel = useMemo(
    () => buildSyncedAtLabel(catalogMeta?.syncedAt),
    [catalogMeta?.syncedAt],
  );
  const groupViews = useMemo(
    () => normalizeGroupViews(groups, cloudSkills),
    [cloudSkills, groups],
  );
  const supportsGroupFlow = groupViews.length > 0;
  const selectedGroup = useMemo(
    () => groupViews.find((group) => group.key === selectedGroupKey) ?? null,
    [groupViews, selectedGroupKey],
  );

  useEffect(() => {
    if (!selectedGroupKey) {
      return;
    }
    if (!selectedGroup) {
      setSelectedGroupKey(null);
    }
  }, [selectedGroup, selectedGroupKey]);

  const buildQuickActionItems = useMemo(
    () =>
      (sectionSkills: ServiceSkillHomeItem[]) =>
        sectionSkills.map((skill) => {
          const secondaryStatus = skill.automationStatus
            ? {
                label: `本地任务 · ${skill.automationStatus.statusLabel}`,
                tone: skill.automationStatus.tone,
                description: skill.automationStatus.detail ?? undefined,
                actionable: true,
              }
            : skill.cloudStatus
              ? {
                  label: `云端状态 · ${skill.cloudStatus.statusLabel}`,
                  tone: skill.cloudStatus.tone,
                  description: skill.cloudStatus.detail ?? undefined,
                  actionable: false,
                }
              : null;

          return {
            key: skill.id,
            title: skill.title,
            description: resolveServiceSkillEntryDescription(skill),
            badge: skill.badge,
            prompt: "",
            actionLabel: skill.actionLabel,
            outputHint: skill.outputHint,
            secondaryStatusLabel: secondaryStatus?.label,
            secondaryStatusTone: secondaryStatus?.tone,
            secondaryStatusDescription: secondaryStatus?.description,
            secondaryStatusActionable: secondaryStatus?.actionable,
            statusLabel: skill.runnerLabel,
            statusTone: skill.runnerTone,
            statusDescription: skill.runnerDescription,
            testId: `service-skill-${skill.id}`,
          };
        }),
    [],
  );
  const selectedGroupItems = useMemo(
    () =>
      selectedGroup ? buildQuickActionItems(selectedGroup.skills) : [],
    [buildQuickActionItems, selectedGroup],
  );
  const cloudItems = useMemo(
    () => buildQuickActionItems(cloudSkills),
    [buildQuickActionItems, cloudSkills],
  );
  const localItems = useMemo(
    () => buildQuickActionItems(localSkills),
    [buildQuickActionItems, localSkills],
  );
  const resolveSkillById = useMemo(
    () =>
      (skillId: string) =>
        skills.find((candidate) => candidate.id === skillId) ?? null,
    [skills],
  );

  if (!supportsGroupFlow) {
    return (
      <div className="space-y-4">
        <EmptyStateQuickActions
          title="技能入口"
          description="先选一个结果导向入口，补齐关键参数后直接进入对应工作模式。"
          headerAddon={
            catalogMeta && (cloudItems.length > 0 || loading) ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-slate-500">
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  {catalogMeta.sourceLabel}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  Tenant · {catalogMeta.tenantId}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  Version · {catalogMeta.version}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  云目录 {cloudItems.length} 项
                </span>
                {localItems.length ? (
                  <span className="rounded-full border border-amber-200/90 bg-amber-50/92 px-2.5 py-1 text-amber-700">
                    本地补充 {localItems.length} 项
                  </span>
                ) : null}
                {syncedAtLabel ? (
                  <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                    同步于 {syncedAtLabel}
                  </span>
                ) : null}
              </div>
            ) : null
          }
          items={cloudItems}
          embedded
          loading={loading}
          onSecondaryStatusAction={
            onOpenAutomationJob
              ? (item) => {
                  const skill = resolveSkillById(item.key);
                  if (skill?.automationStatus) {
                    void onOpenAutomationJob(skill);
                  }
                }
              : undefined
          }
          onAction={(item) => {
            const skill = resolveSkillById(item.key);
            if (skill) {
              void onSelect(skill);
            }
          }}
        />
        {localItems.length ? (
          <EmptyStateQuickActions
            title="本地技能 / 自定义技能"
            description="保留离线或项目级补充入口，但不覆盖 OEM 云目录中的正式服务项。"
            headerAddon={
              <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-slate-500">
                <span className="rounded-full border border-amber-200/90 bg-amber-50/92 px-2.5 py-1 font-medium text-amber-700">
                  本地补充目录
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  {localItems.length} 项
                </span>
              </div>
            }
            items={localItems}
            embedded
            onSecondaryStatusAction={
              onOpenAutomationJob
                ? (item) => {
                    const skill = resolveSkillById(item.key);
                    if (skill?.automationStatus) {
                      void onOpenAutomationJob(skill);
                    }
                  }
                : undefined
            }
            onAction={(item) => {
              const skill = resolveSkillById(item.key);
              if (skill) {
                void onSelect(skill);
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-950/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                Claw 技能入口
              </span>
              {selectedGroup ? (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    resolveGroupBadgeClassName(selectedGroup.key),
                  )}
                >
                  {resolveGroupBadgeLabel(selectedGroup.key)}
                </span>
              ) : null}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedGroup ? `${selectedGroup.title} 技能组` : "技能组"}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
                {selectedGroup
                  ? selectedGroup.entryHint || selectedGroup.summary
                  : "先选技能组，再进入真正可执行的技能项。站点技能和通用业务技能统一收口到同一条入口。"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-slate-500">
            {catalogMeta ? (
              <>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  {catalogMeta.sourceLabel}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  Tenant · {catalogMeta.tenantId}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  分组 {groupViews.length}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                  云目录 {cloudItems.length} 项
                </span>
                {localItems.length ? (
                  <span className="rounded-full border border-amber-200/90 bg-amber-50/92 px-2.5 py-1 text-amber-700">
                    本地补充 {localItems.length} 项
                  </span>
                ) : null}
                {syncedAtLabel ? (
                  <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                    同步于 {syncedAtLabel}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {selectedGroup ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-slate-200"
              data-testid="service-skill-group-back"
              onClick={() => setSelectedGroupKey(null)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回技能组
            </Button>
            <div className="text-xs leading-5 text-slate-500">
              当前进入 {selectedGroup.title}，直接选择一个技能项继续。
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {groupViews.map((group) => {
              const Icon = resolveGroupIcon(group.key);
              const sampleTitles = group.skills.slice(0, 2).map((skill) => skill.title);

              return (
                <button
                  key={group.key}
                  type="button"
                  data-testid={`service-skill-group-${group.key}`}
                  className={cn(
                    "group flex h-full flex-col rounded-[24px] border p-4 text-left shadow-sm shadow-slate-950/5 transition hover:-translate-y-0.5 hover:shadow-md",
                    resolveGroupCardClassName(group.key),
                  )}
                  onClick={() => setSelectedGroupKey(group.key)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/85 text-slate-700",
                        resolveGroupBadgeClassName(group.key),
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        resolveGroupBadgeClassName(group.key),
                      )}
                    >
                      {resolveGroupBadgeLabel(group.key)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-semibold text-slate-900">
                        {group.title}
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {group.skills.length} 项
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">
                      {group.summary}
                    </p>
                  </div>

                  {sampleTitles.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {sampleTitles.map((title) => (
                        <span
                          key={title}
                          className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <div className="text-xs leading-5 text-slate-500">
                      {group.entryHint || "进入技能组后再选择具体技能项。"}
                    </div>
                    <span className="inline-flex items-center text-xs font-medium text-slate-700">
                      进入
                      <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedGroup ? (
        <EmptyStateQuickActions
          title="可执行技能"
          description="补齐关键参数后直接进入对应工作模式，结果继续回流到当前工作区。"
          headerAddon={
            <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-slate-500">
              <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                {selectedGroup.title}
              </span>
              <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                {selectedGroupItems.length} 项
              </span>
            </div>
          }
          items={selectedGroupItems}
          embedded
          loading={loading}
          onSecondaryStatusAction={
            onOpenAutomationJob
              ? (item) => {
                  const skill = resolveSkillById(item.key);
                  if (skill?.automationStatus) {
                    void onOpenAutomationJob(skill);
                  }
                }
              : undefined
          }
          onAction={(item) => {
            const skill = resolveSkillById(item.key);
            if (skill) {
              void onSelect(skill);
            }
          }}
        />
      ) : null}

      {localItems.length ? (
        <EmptyStateQuickActions
          title="本地技能 / 自定义技能"
          description="本地和项目级补充技能仍保留，但不再充当 Claw 首页的默认主入口。"
          headerAddon={
            <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-slate-500">
              <span className="rounded-full border border-amber-200/90 bg-amber-50/92 px-2.5 py-1 font-medium text-amber-700">
                本地补充目录
              </span>
              <span className="rounded-full border border-slate-200/90 bg-slate-50/92 px-2.5 py-1">
                {localItems.length} 项
              </span>
            </div>
          }
          items={localItems}
          embedded
          onSecondaryStatusAction={
            onOpenAutomationJob
              ? (item) => {
                  const skill = resolveSkillById(item.key);
                  if (skill?.automationStatus) {
                    void onOpenAutomationJob(skill);
                  }
                }
              : undefined
          }
          onAction={(item) => {
            const skill = resolveSkillById(item.key);
            if (skill) {
              void onSelect(skill);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export default ServiceSkillHomePanel;
