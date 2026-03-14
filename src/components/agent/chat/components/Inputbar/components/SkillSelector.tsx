import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  FolderOpen,
  Loader2,
  RefreshCw,
  Settings2,
  X,
  Zap,
} from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Skill } from "@/lib/api/skills";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  triggerLabel = "Skills",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshTriggered, setAutoRefreshTriggered] = useState(false);

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
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            activeSkill
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/70 bg-background/95 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            className,
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        side="top"
        align="start"
        sideOffset={8}
      >
        <Command shouldFilter={false} className="bg-background">
          <div className="relative">
            <CommandInput
              className={canRefresh ? "pr-12" : undefined}
              placeholder="搜索技能"
              value={query}
              onValueChange={setQuery}
            />
            {canRefresh ? (
              <button
                type="button"
                data-testid="skill-selector-refresh"
                onClick={() => void handleRefresh()}
                disabled={refreshBusy}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={refreshBusy ? "技能加载中" : "刷新技能"}
                title={refreshBusy ? "技能加载中" : "刷新技能"}
              >
                {refreshBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
          <CommandList>
            {activeSkill && onClearSkill ? (
              <CommandGroup heading="当前技能">
                <CommandItem
                  value="__clear_skill__"
                  onSelect={handleClearSkill}
                  className="cursor-pointer"
                >
                  <X className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">不使用技能</div>
                    <div className="text-xs text-muted-foreground">
                      当前已选：{activeSkill.name}
                    </div>
                  </div>
                </CommandItem>
              </CommandGroup>
            ) : null}

            {installedSkills.length > 0 ? (
              <CommandGroup heading="可用技能">
                {installedSkills.map((skill) => {
                  const selected = activeSkill?.key === skill.key;
                  return (
                    <CommandItem
                      key={skill.directory}
                      value={`${skill.name} ${skill.key} ${skill.description || ""}`}
                      onSelect={() => handleSelectInstalledSkill(skill)}
                      className="cursor-pointer"
                    >
                      <Zap
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {skill.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            /{skill.key}
                          </span>
                        </div>
                        {skill.description ? (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {skill.description}
                          </div>
                        ) : null}
                      </div>
                      {selected ? (
                        <Check className="ml-2 h-4 w-4 text-primary" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {availableSkills.length > 0 ? (
              <CommandGroup heading="未安装技能">
                {availableSkills.map((skill) => (
                  <CommandItem
                    key={skill.directory}
                    value={`${skill.name} ${skill.key} ${skill.description || ""}`}
                    onSelect={() => handleSelectAvailableSkill(skill)}
                    className="cursor-pointer opacity-70"
                  >
                    <Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {skill.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          /{skill.key}
                        </span>
                      </div>
                      {skill.description ? (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {skill.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!hasResults ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {refreshBusy ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <div>技能加载中...</div>
                  </div>
                ) : (
                  <>
                    <div>暂无可用技能</div>
                    {onNavigateToSettings ? (
                      <button
                        type="button"
                        className="mt-2 text-primary hover:underline"
                        onClick={() => {
                          setOpen(false);
                          onNavigateToSettings();
                        }}
                      >
                        去技能设置
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </CommandList>
          {canImport ? (
            <div className="border-t border-border/70 p-1.5">
              <button
                type="button"
                data-testid="skill-selector-import"
                onClick={() => void handleImport()}
                disabled={importing}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
                <span>{importing ? "导入中..." : "导入技能"}</span>
              </button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
