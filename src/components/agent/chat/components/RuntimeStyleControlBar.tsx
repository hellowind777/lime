import { useMemo, useState } from "react";
import { CheckCheck, LibraryBig, Palette, RefreshCcw, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { StyleLibraryPickerDialog } from "@/components/style-library/StyleLibraryPickerDialog";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StyleGuidePanel } from "@/components/projects/memory/StyleGuidePanel";
import type { ThemeType } from "@/components/content-creator/types";
import type { StyleGuide } from "@/lib/api/memory";
import {
  DEFAULT_STYLE_PROFILE,
  buildRuntimeStyleOverridePrompt,
  describeRuntimeStyleSelection,
  getAvailableStylePresets,
  getStylePresetById,
  getStyleProfileFromGuide,
  type RuntimeStyleSelection,
} from "@/lib/style-guide";

interface RuntimeStyleControlBarProps {
  projectId: string;
  activeTheme: ThemeType;
  projectStyleGuide?: StyleGuide | null;
  selection: RuntimeStyleSelection;
  onSelectionChange: (selection: RuntimeStyleSelection) => void;
  onRewrite: () => void;
  onAudit: () => void;
  actionsDisabled?: boolean;
}

export function RuntimeStyleControlBar({
  projectId,
  activeTheme,
  projectStyleGuide,
  selection,
  onSelectionChange,
  onRewrite,
  onAudit,
  actionsDisabled = false,
}: RuntimeStyleControlBarProps) {
  const [styleGuideDialogOpen, setStyleGuideDialogOpen] = useState(false);
  const [styleLibraryDialogOpen, setStyleLibraryDialogOpen] = useState(false);
  const presets = useMemo(() => getAvailableStylePresets(activeTheme), [activeTheme]);
  const summary = useMemo(
    () =>
      describeRuntimeStyleSelection({
        projectStyleGuide,
        selection,
      }),
    [projectStyleGuide, selection],
  );
  const previewPrompt = useMemo(
    () =>
      buildRuntimeStyleOverridePrompt({
        projectStyleGuide,
        selection,
        activeTheme,
      }),
    [activeTheme, projectStyleGuide, selection],
  );
  const hasProjectDefaultStyle = Boolean(getStyleProfileFromGuide(projectStyleGuide));

  const handlePresetChange = (value: string) => {
    const nextStrength =
      value === "project-default"
        ? getStyleProfileFromGuide(projectStyleGuide)?.simulationStrength ||
          DEFAULT_STYLE_PROFILE.simulationStrength
        : getStylePresetById(value)?.profile.simulationStrength ||
          selection.strength;

    onSelectionChange({
      ...selection,
      presetId: value,
      strength: nextStrength,
      source: value === "project-default" ? "project-default" : "preset",
      sourceLabel: undefined,
      sourceProfile: null,
    });
  };

  const clearLibrarySelection = () => {
    const fallbackStrength =
      getStyleProfileFromGuide(projectStyleGuide)?.simulationStrength ||
      DEFAULT_STYLE_PROFILE.simulationStrength;

    onSelectionChange({
      ...selection,
      presetId: "project-default",
      strength: fallbackStrength,
      source: "project-default",
      sourceLabel: undefined,
      sourceProfile: null,
    });
  };

  return (
    <Card className="mx-4 mt-3 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.92)_0%,rgba(255,255,255,1)_42%)] shadow-sm shadow-slate-950/5">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
            <Palette className="h-4 w-4 text-slate-700" />
            任务风格
          </div>

          <Select value={selection.presetId} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-9 w-[210px] border-slate-200 bg-white">
              <SelectValue placeholder="选择本次任务风格" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project-default">使用项目默认风格</SelectItem>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                本次模拟说明
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 space-y-3 rounded-[20px] border border-slate-200/80 bg-white shadow-lg shadow-slate-950/10" align="start">
              <div>
                <div className="text-sm font-medium">临时风格备注</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  用来描述这次想模拟的额外风格，例如“更像知识型创作者，但保持克制，不要营销感”。
                </p>
              </div>
              <Textarea
                value={selection.customNotes}
                onChange={(event) =>
                  onSelectionChange({
                    ...selection,
                    customNotes: event.target.value,
                  })
                }
                rows={6}
                placeholder="写下本次风格模拟要求..."
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setStyleLibraryDialogOpen(true)}
          >
            <LibraryBig className="h-4 w-4" />
            从我的风格库选择
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setStyleGuideDialogOpen(true)}
          >
            <Palette className="h-4 w-4" />
            编辑项目风格
          </Button>

          <Button variant="outline" size="sm" className="gap-2" onClick={onAudit} disabled={actionsDisabled}>
            <CheckCheck className="h-4 w-4" />
            检查风格
          </Button>
          <Button size="sm" className="gap-2" onClick={onRewrite} disabled={actionsDisabled}>
            <RefreshCcw className="h-4 w-4" />
            按当前风格重写
          </Button>
        </div>

        <div className="grid gap-3 rounded-[20px] border border-slate-200/80 bg-white/92 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span>{summary}</span>
              {selection.source === "library" && selection.sourceLabel ? (
                <button
                  type="button"
                  onClick={clearLibrarySelection}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  来自我的风格：{selection.sourceLabel}
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
              {previewPrompt || "未设置临时风格覆盖，将沿用项目默认风格与当前创作上下文。"}
            </p>
            {!hasProjectDefaultStyle && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                当前项目还没有默认风格，建议先点“编辑项目风格”配置基线风格。
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>风格强度</span>
              <span>{selection.strength}</span>
            </div>
            <Slider
              value={[selection.strength]}
              onValueChange={([value]) =>
                onSelectionChange({
                  ...selection,
                  strength: value,
                })
              }
              min={0}
              max={100}
              step={1}
            />
          </div>
        </div>
      </CardContent>

      <Dialog open={styleGuideDialogOpen} onOpenChange={setStyleGuideDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>项目默认风格</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <StyleGuidePanel projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>

      <StyleLibraryPickerDialog
        open={styleLibraryDialogOpen}
        onOpenChange={setStyleLibraryDialogOpen}
        onSelect={(entry) =>
          onSelectionChange({
            ...selection,
            presetId: "project-default",
            strength: entry.profile.simulationStrength,
            source: "library",
            sourceLabel: entry.profile.name,
            sourceProfile: entry.profile,
          })
        }
        theme={activeTheme}
        onlyEnabled
        title="选择本次任务要使用的我的风格"
        description="从你上传或保存的风格中选择一条，作为当前任务的临时风格覆盖。"
      />
    </Card>
  );
}
