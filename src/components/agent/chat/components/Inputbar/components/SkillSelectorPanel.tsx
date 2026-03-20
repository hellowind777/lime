import React from "react";
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
import type { Skill } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

interface SkillSelectorPanelProps {
  activeSkill: Skill | null;
  installedSkills: Skill[];
  availableSkills: Skill[];
  query: string;
  canRefresh: boolean;
  refreshBusy: boolean;
  canImport: boolean;
  importing: boolean;
  hasResults: boolean;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onSelectInstalledSkill: (skill: Skill) => void;
  onSelectAvailableSkill: (skill: Skill) => void;
  onClearSkill?: () => void;
  onNavigateToSettings?: () => void;
  onImport: () => void;
}

export const SkillSelectorPanel: React.FC<SkillSelectorPanelProps> = ({
  activeSkill,
  installedSkills,
  availableSkills,
  query,
  canRefresh,
  refreshBusy,
  canImport,
  importing,
  hasResults,
  onQueryChange,
  onRefresh,
  onSelectInstalledSkill,
  onSelectAvailableSkill,
  onClearSkill,
  onNavigateToSettings,
  onImport,
}) => (
  <Command shouldFilter={false} className="bg-white">
    <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(248,250,252)_100%)] px-4 py-3">
      <div className="text-[11px] font-semibold tracking-[0.08em] text-slate-500">
        技能能力
      </div>
      <div className="mt-1 text-sm text-slate-700">
        {activeSkill ? `当前已启用 ${activeSkill.name}` : "为当前任务挂载额外能力"}
      </div>
    </div>
    <div className="relative">
      <CommandInput
        className={cn(
          "border-b-0 px-4 text-sm placeholder:text-slate-400",
          canRefresh ? "pr-12" : undefined,
        )}
        placeholder="搜索技能或命令"
        value={query}
        onValueChange={onQueryChange}
      />
      {canRefresh ? (
        <button
          type="button"
          data-testid="skill-selector-refresh"
          onClick={onRefresh}
          disabled={refreshBusy}
          className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        <CommandGroup heading="当前已选">
          <CommandItem
            value="__clear_skill__"
            onSelect={onClearSkill}
            className="cursor-pointer rounded-xl border border-transparent px-3 py-2.5 data-[selected=true]:border-slate-200 data-[selected=true]:bg-slate-50"
          >
            <X className="mr-2 h-4 w-4 text-slate-400" />
            <div className="flex-1">
              <div className="font-medium text-slate-900">不使用技能</div>
              <div className="text-xs text-slate-500">
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
                onSelect={() => onSelectInstalledSkill(skill)}
                className="cursor-pointer rounded-xl border border-transparent px-3 py-2.5 data-[selected=true]:border-slate-200 data-[selected=true]:bg-slate-50"
              >
                <Zap
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected ? "text-emerald-600" : "text-slate-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">
                      {skill.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      /{skill.key}
                    </span>
                  </div>
                  {skill.description ? (
                    <div className="line-clamp-1 text-xs text-slate-500">
                      {skill.description}
                    </div>
                  ) : null}
                </div>
                {selected ? (
                  <Check className="ml-2 h-4 w-4 text-emerald-600" />
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
              onSelect={() => onSelectAvailableSkill(skill)}
              className="cursor-pointer rounded-xl border border-transparent px-3 py-2.5 opacity-80 data-[selected=true]:border-slate-200 data-[selected=true]:bg-slate-50"
            >
              <Settings2 className="mr-2 h-4 w-4 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-900">
                    {skill.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    /{skill.key}
                  </span>
                </div>
                {skill.description ? (
                  <div className="line-clamp-1 text-xs text-slate-500">
                    {skill.description}
                  </div>
                ) : null}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {!hasResults ? (
        <div className="px-4 py-7 text-center text-sm text-slate-500">
          {refreshBusy ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <div>技能加载中...</div>
            </div>
          ) : (
            <>
              <div>暂无可用技能</div>
              {onNavigateToSettings ? (
                <button
                  type="button"
                  className="mt-2 text-slate-900 hover:underline"
                  onClick={onNavigateToSettings}
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
      <div className="border-t border-slate-200/80 p-1.5">
        <button
          type="button"
          data-testid="skill-selector-import"
          onClick={onImport}
          disabled={importing}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          <span>{importing ? "导入中..." : "导入本地技能"}</span>
        </button>
      </div>
    ) : null}
  </Command>
);
