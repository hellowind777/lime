import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Users } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { scheduleIdleModulePreload } from "./scheduleIdleModulePreload";
import type { TeamDefinition } from "../../../utils/teamDefinitions";

const preloadTeamSelectorPanel = () => import("./TeamSelectorPanel");

const TeamSelectorPanel = lazy(async () => {
  const module = await preloadTeamSelectorPanel();
  return { default: module.TeamSelectorPanel };
});

interface TeamSelectorProps {
  activeTheme?: string;
  input?: string;
  selectedTeam?: TeamDefinition | null;
  onSelectTeam: (team: TeamDefinition | null) => void;
  triggerLabel?: string;
  className?: string;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({
  activeTheme,
  input,
  selectedTeam = null,
  onSelectTeam,
  triggerLabel = "Team",
  className,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return scheduleIdleModulePreload(() => {
      void preloadTeamSelectorPanel();
    });
  }, []);

  const resolvedLabel = useMemo(() => {
    if (!selectedTeam?.label?.trim()) {
      return triggerLabel;
    }
    return `Team · ${selectedTeam.label.trim()}`;
  }, [selectedTeam?.label, triggerLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="team-selector-trigger"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-none transition-colors",
            selectedTeam
              ? "border-sky-300 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              : "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900",
            className,
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span className="max-w-[180px] truncate">{resolvedLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-0 shadow-xl shadow-slate-950/8 opacity-100"
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
            <TeamSelectorPanel
              activeTheme={activeTheme}
              input={input}
              selectedTeam={selectedTeam}
              onSelectTeam={(team) => {
                onSelectTeam(team);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
