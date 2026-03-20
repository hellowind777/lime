import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Zap } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Skill } from "@/lib/api/skills";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { scheduleIdleModulePreload } from "./scheduleIdleModulePreload";

const preloadSkillSelectorPanel = () => import("./SkillSelectorPanel");

const SkillSelectorPanel = lazy(async () => {
  const module = await preloadSkillSelectorPanel();
  return { default: module.SkillSelectorPanel };
});

interface SkillSelectorProps {
  skills?: Skill[];
  activeSkill?: Skill | null;
  isLoading?: boolean;
  onSelectSkill: (skill: Skill) => void;
  onClearSkill?: () => void;
  onNavigateToSettings?: () => void;
  onImportSkill?: () => void | Promise<void>;
  onRefreshSkills?: () => void | Promise<void>;
  triggerLabel?: string;
  className?: string;
}

function matchesSkillQuery(skill: Skill, query: string): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return (
    skill.name.toLowerCase().includes(normalizedQuery) ||
    skill.key.toLowerCase().includes(normalizedQuery) ||
    skill.description?.toLowerCase().includes(normalizedQuery) === true
  );
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  skills = [],
  activeSkill = null,
  isLoading = false,
  onSelectSkill,
  onClearSkill,
  onNavigateToSettings,
  onImportSkill,
  onRefreshSkills,
  triggerLabel = "技能",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshTriggered, setAutoRefreshTriggered] = useState(false);

  useEffect(() => {
    return scheduleIdleModulePreload(() => {
      void preloadSkillSelectorPanel();
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setAutoRefreshTriggered(false);
    }
  }, [open]);

  const installedSkills = useMemo(
    () =>
      skills.filter(
        (skill) => skill.installed && matchesSkillQuery(skill, query),
      ),
    [query, skills],
  );

  const availableSkills = useMemo(
    () =>
      skills.filter(
        (skill) => !skill.installed && matchesSkillQuery(skill, query),
      ),
    [query, skills],
  );

  const hasResults =
    installedSkills.length > 0 ||
    availableSkills.length > 0 ||
    Boolean(activeSkill && onClearSkill);
  const canImport = Boolean(onImportSkill || onNavigateToSettings);
  const canRefresh = Boolean(onRefreshSkills);
  const refreshBusy = isLoading || refreshing;

  const handleRefresh = useCallback(async () => {
    if (!onRefreshSkills || refreshBusy) {
      return;
    }

    try {
      setRefreshing(true);
      await onRefreshSkills();
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshSkills, refreshBusy]);

  useEffect(() => {
    if (
      !open ||
      autoRefreshTriggered ||
      !onRefreshSkills ||
      refreshBusy ||
      skills.length > 0
    ) {
      return;
    }

    setAutoRefreshTriggered(true);
    void handleRefresh();
  }, [
    autoRefreshTriggered,
    handleRefresh,
    onRefreshSkills,
    open,
    refreshBusy,
    skills.length,
  ]);

  const handleSelectInstalledSkill = (skill: Skill) => {
    onSelectSkill(skill);
    setOpen(false);
  };

  const handleClearSkill = () => {
    onClearSkill?.();
    setOpen(false);
  };

  const handleSelectAvailableSkill = (skill: Skill) => {
    setOpen(false);
    toast.info(`技能「${skill.name}」尚未安装`, {
      action: onNavigateToSettings
        ? {
            label: "去安装",
            onClick: onNavigateToSettings,
          }
        : undefined,
    });
  };

  const handleImport = async () => {
    if (!canImport || importing) {
      return;
    }

    setOpen(false);

    if (!onImportSkill) {
      onNavigateToSettings?.();
      return;
    }

    try {
      setImporting(true);
      await onImportSkill();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="skill-selector-trigger"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-none transition-colors",
            activeSkill
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              : "border-slate-200/80 bg-white/92 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900",
            className,
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-0 shadow-xl shadow-slate-950/8 opacity-100"
        side="top"
        align="start"
        sideOffset={8}
      >
        {open ? (
          <Suspense
            fallback={
              <div className="px-4 py-7 text-center text-sm text-slate-500">
                加载中...
              </div>
            }
          >
            <SkillSelectorPanel
              activeSkill={activeSkill}
              installedSkills={installedSkills}
              availableSkills={availableSkills}
              query={query}
              canRefresh={canRefresh}
              refreshBusy={refreshBusy}
              canImport={canImport}
              importing={importing}
              hasResults={hasResults}
              onQueryChange={setQuery}
              onRefresh={() => void handleRefresh()}
              onSelectInstalledSkill={handleSelectInstalledSkill}
              onSelectAvailableSkill={handleSelectAvailableSkill}
              onClearSkill={handleClearSkill}
              onNavigateToSettings={
                onNavigateToSettings
                  ? () => {
                      setOpen(false);
                      onNavigateToSettings();
                    }
                  : undefined
              }
              onImport={() => void handleImport()}
            />
          </Suspense>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
