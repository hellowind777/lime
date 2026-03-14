import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import type { ThemeType } from "@/components/content-creator/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStyleLibrary } from "@/hooks/useStyleLibrary";
import {
  STYLE_PRESETS,
  buildStyleGuideUpdateFromProfile,
  buildStylePromptFromProfile,
  cloneStyleProfile,
  mergeStyleProfiles,
  type StyleProfile,
} from "@/lib/style-guide";
import {
  analyzeStyleSample,
  createEmptyStyleLibraryEntry,
  createStyleLibraryEntryFromPreset,
  createStyleLibraryEntryFromSample,
  deleteStyleLibraryEntry,
  recordStyleLibraryApplication,
  saveStyleLibraryEntry,
  setActiveStyleLibraryEntry,
  setStyleLibraryEnabled,
  updateStyleLibraryEntry,
  type StyleLibraryEntry,
  type StyleLibrarySourceFile,
} from "@/lib/style-library";
import {
  getProject,
  getProjectTypeLabel,
  type Project,
} from "@/lib/api/project";
import { getStyleGuide, updateStyleGuide } from "@/lib/api/memory";
import { cn } from "@/lib/utils";

interface StyleLibraryPanelProps {
  projectId?: string | null;
  onOpenProjectStyleGuide?: () => void;
  compactHeader?: boolean;
}

interface EntryEditorState {
  name: string;
  description: string;
  targetAudience: string;
  toneKeywords: string;
  customInstruction: string;
  simulationStrength: number;
  applicableThemes: ThemeType[];
  sampleText: string;
}

const THEME_OPTIONS: Array<{ value: ThemeType; label: string }> = [
  { value: "general", label: "通用" },
  { value: "social-media", label: "社媒" },
  { value: "knowledge", label: "知识" },
  { value: "planning", label: "计划" },
  { value: "document", label: "文档" },
  { value: "video", label: "视频" },
  { value: "novel", label: "小说" },
  { value: "poster", label: "海报" },
  { value: "music", label: "音乐" },
];

function formatTimeLabel(value?: string): string {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function buildEditorState(entry: StyleLibraryEntry | null): EntryEditorState {
  const profile = entry?.profile || cloneStyleProfile();

  return {
    name: profile.name,
    description: profile.description,
    targetAudience: profile.targetAudience,
    toneKeywords: profile.toneKeywords.join("、"),
    customInstruction: profile.customInstruction,
    simulationStrength: profile.simulationStrength,
    applicableThemes: profile.applicableThemes,
    sampleText: entry?.sampleText || "",
  };
}

function parseKeywordInput(value: string): string[] {
  return value
    .split(/[、,，\n/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function buildProfileFromEditor(
  entry: StyleLibraryEntry | null,
  editor: EntryEditorState,
): StyleProfile {
  return cloneStyleProfile({
    ...(entry?.profile || {}),
    name: editor.name || entry?.profile.name || "我的风格",
    description: editor.description,
    targetAudience: editor.targetAudience,
    toneKeywords: parseKeywordInput(editor.toneKeywords),
    customInstruction: editor.customInstruction,
    simulationStrength: editor.simulationStrength,
    applicableThemes: editor.applicableThemes,
  });
}

function StyleAssetListItem({
  entry,
  active,
  onSelect,
}: {
  entry: StyleLibraryEntry;
  active: boolean;
  onSelect: (entryId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={cn(
        "w-full rounded-[20px] border px-4 py-3 text-left shadow-sm shadow-slate-950/5 transition",
        active
          ? "border-sky-300 bg-sky-50/90"
          : "border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-900">
          {entry.profile.name}
        </span>
        <Badge variant="outline">{entry.sourceLabel}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
        {entry.profile.description || "暂无风格说明"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span>
          关键词：
          {entry.profile.toneKeywords.slice(0, 4).join(" / ") || "待补充"}
        </span>
        <span>更新于 {formatTimeLabel(entry.updatedAt)}</span>
      </div>
    </button>
  );
}

function EmptyWorkspaceState({
  onUpload,
  onCreateManual,
}: {
  onUpload: () => void;
  onCreateManual: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <div className="rounded-full bg-white p-4 text-slate-500 shadow-sm">
        <FileUp className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">还没有风格资产</div>
        <p className="text-sm text-slate-500">
          先上传样本或新建一套手动风格，再进入结构化编辑和项目应用流程。
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" />
          上传样本
        </Button>
        <Button variant="outline" onClick={onCreateManual}>
          <Plus className="mr-2 h-4 w-4" />
          新建风格
        </Button>
      </div>
    </div>
  );
}

export function StyleLibraryPanel({
  projectId,
  onOpenProjectStyleGuide,
  compactHeader = false,
}: StyleLibraryPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { entries, enabled, activeEntryId } = useStyleLibrary();
  const [project, setProject] = useState<Project | null>(null);
  const [assetSearchKeyword, setAssetSearchKeyword] = useState("");
  const [presetShelfOpen, setPresetShelfOpen] = useState(entries.length === 0);
  const [editor, setEditor] = useState<EntryEditorState>(() =>
    buildEditorState(null),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredEntries = useMemo(() => {
    const normalizedKeyword = assetSearchKeyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return entries;
    }

    return entries.filter((entry) => {
      const haystack = [
        entry.profile.name,
        entry.profile.description,
        entry.profile.toneKeywords.join(" "),
        entry.sourceLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }, [assetSearchKeyword, entries]);

  const selectedEntry = useMemo(() => {
    if (activeEntryId) {
      return entries.find((entry) => entry.id === activeEntryId) || null;
    }
    return entries[0] || null;
  }, [activeEntryId, entries]);

  useEffect(() => {
    setEditor(buildEditorState(selectedEntry));
  }, [selectedEntry]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }

    let disposed = false;

    getProject(projectId)
      .then((nextProject) => {
        if (!disposed) {
          setProject(nextProject);
        }
      })
      .catch((error) => {
        console.warn("加载当前项目失败:", error);
        if (!disposed) {
          setProject(null);
        }
      });

    return () => {
      disposed = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!selectedEntry && entries[0]) {
      setActiveStyleLibraryEntry(entries[0].id);
    }
  }, [entries, selectedEntry]);

  const currentProfile = useMemo(
    () => buildProfileFromEditor(selectedEntry, editor),
    [editor, selectedEntry],
  );
  const currentPreviewPrompt = useMemo(
    () =>
      buildStylePromptFromProfile(currentProfile, {
        title: "### 我的风格预览",
        includeExamples: true,
      }),
    [currentProfile],
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedEntry) {
      return false;
    }
    return (
      JSON.stringify(editor) !== JSON.stringify(buildEditorState(selectedEntry))
    );
  }, [editor, selectedEntry]);
  const headerBadges = useMemo(
    () =>
      [
        `${entries.length} 条资产`,
        `当前条目：${selectedEntry?.profile.name || "未选择"}`,
        projectId
          ? `当前项目：${project?.name || "正在加载项目..."}`
          : "当前项目：未选择",
      ].filter(Boolean),
    [entries.length, project?.name, projectId, selectedEntry?.profile.name],
  );

  const toggleTheme = useCallback((theme: ThemeType) => {
    setEditor((previous) => ({
      ...previous,
      applicableThemes: previous.applicableThemes.includes(theme)
        ? previous.applicableThemes.filter((item) => item !== theme)
        : [...previous.applicableThemes, theme],
    }));
  }, []);

  const handleSaveCurrentEntry = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }

    setSaving(true);
    try {
      updateStyleLibraryEntry(selectedEntry.id, {
        profile: currentProfile,
        sampleText: editor.sampleText,
      });
      toast.success("风格条目已保存");
    } catch (error) {
      console.error("保存风格条目失败:", error);
      toast.error("保存风格条目失败");
    } finally {
      setSaving(false);
    }
  }, [currentProfile, editor.sampleText, selectedEntry]);

  const handleReanalyze = useCallback(async () => {
    if (!selectedEntry) {
      toast.error("请先选择一个风格条目");
      return;
    }
    if (!editor.sampleText.trim()) {
      toast.error("请先补充样本文本，再更新风格");
      return;
    }

    setReanalyzing(true);
    try {
      const analyzedProfile = analyzeStyleSample(editor.sampleText, {
        name: editor.name || selectedEntry.profile.name,
      });
      const nextProfile = mergeStyleProfiles(analyzedProfile, {
        name: editor.name || analyzedProfile.name,
        description: editor.description,
        targetAudience: editor.targetAudience,
        toneKeywords: parseKeywordInput(editor.toneKeywords),
        customInstruction: editor.customInstruction,
        simulationStrength: editor.simulationStrength,
        applicableThemes:
          editor.applicableThemes.length > 0
            ? editor.applicableThemes
            : analyzedProfile.applicableThemes,
      });

      updateStyleLibraryEntry(selectedEntry.id, {
        profile: nextProfile,
        sampleText: editor.sampleText,
      });
      toast.success("已根据样本重新解析风格");
    } catch (error) {
      console.error("更新风格失败:", error);
      toast.error("更新风格失败");
    } finally {
      setReanalyzing(false);
    }
  }, [editor, selectedEntry]);

  const handleCreateManualStyle = useCallback(() => {
    const entry = createEmptyStyleLibraryEntry();
    saveStyleLibraryEntry(entry);
    setActiveStyleLibraryEntry(entry.id);
    toast.success("已创建自定义风格");
  }, []);

  const handleAddPreset = useCallback((presetId: string) => {
    const preset = STYLE_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const entry = createStyleLibraryEntryFromPreset(preset);
    saveStyleLibraryEntry(entry);
    setActiveStyleLibraryEntry(entry.id);
    toast.success(`已加入我的风格：${preset.name}`);
  }, []);

  const handleUploadFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    try {
      const createdEntries = await Promise.all(
        Array.from(files).map(async (file) => {
          const text = await file.text();
          const sourceFiles: StyleLibrarySourceFile[] = [
            {
              name: file.name,
              size: file.size,
              type: file.type,
              uploadedAt: new Date().toISOString(),
            },
          ];

          const entry = createStyleLibraryEntryFromSample({
            name: file.name.replace(/\.[^.]+$/, ""),
            sampleText: text,
            sourceType: "upload",
            sourceLabel: file.name,
            sourceFiles,
          });

          return saveStyleLibraryEntry(entry);
        }),
      );

      const firstEntry = createdEntries[0];
      if (firstEntry) {
        setActiveStyleLibraryEntry(firstEntry.id);
      }
      toast.success(`已解析 ${createdEntries.length} 个风格样本`);
    } catch (error) {
      console.error("上传风格样本失败:", error);
      toast.error("上传失败，请确认文件是可读取的文本内容");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const handleApplyToProject = useCallback(async () => {
    if (!projectId) {
      toast.error("当前还没有选中的项目");
      return;
    }

    const profileToApply = currentProfile;
    setApplying(true);
    try {
      const currentGuide = await getStyleGuide(projectId);
      if (selectedEntry) {
        updateStyleLibraryEntry(selectedEntry.id, {
          profile: profileToApply,
          sampleText: editor.sampleText,
        });
      }

      await updateStyleGuide(
        projectId,
        buildStyleGuideUpdateFromProfile(profileToApply, {
          previousExtra: currentGuide?.extra as
            | Record<string, unknown>
            | undefined,
        }),
      );
      if (selectedEntry) {
        recordStyleLibraryApplication({
          projectId,
          entryId: selectedEntry.id,
          entryName: profileToApply.name,
        });
      }
      toast.success("已设为当前项目默认风格");
    } catch (error) {
      console.error("应用到项目失败:", error);
      toast.error("应用失败，请稍后重试");
    } finally {
      setApplying(false);
    }
  }, [currentProfile, editor.sampleText, projectId, selectedEntry]);

  const handleDeleteEntry = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }

    setDeleting(true);
    try {
      deleteStyleLibraryEntry(selectedEntry.id);
      toast.success("已删除风格条目");
    } catch (error) {
      console.error("删除风格条目失败:", error);
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  }, [selectedEntry]);
  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-sm shadow-slate-950/5",
          compactHeader
            ? "border-slate-200/80 bg-white/92"
            : "border-slate-200/80 bg-white",
        )}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900">启用我的风格</div>
          <div className="text-xs text-slate-500">
            决定风格资产是否出现在创作任务选择器中。
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setStyleLibraryEnabled}
        />
      </div>

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            上传中...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            上传样本
          </>
        )}
      </Button>

      <Button variant="outline" onClick={handleCreateManualStyle}>
        <Plus className="mr-2 h-4 w-4" />
        新建风格
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.markdown,.text,.csv,.json,.srt,.vtt"
        className="hidden"
        onChange={(event) => {
          void handleUploadFiles(event.target.files);
        }}
      />

      {compactHeader ? (
        <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,1)_55%,rgba(239,246,255,0.92)_100%)] p-5 shadow-sm shadow-slate-950/5">
          <div className="pointer-events-none absolute right-[-56px] top-[-28px] h-36 w-36 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {headerBadges.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/90 bg-white/85 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                在这里完成资产整理、结构化编辑、Prompt 预览与项目默认风格应用。
              </p>
            </div>

            {headerActions}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">风格库工作台</div>
            <h2 className="mt-1 text-xl font-semibold">管理风格资产</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              左侧选择资产，中间做结构化编辑，右侧查看预览并应用到项目。
            </p>
          </div>

          {headerActions}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">资产列表</CardTitle>
              <CardDescription>
                在这里搜索、切换和浏览你的风格资产。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={assetSearchKeyword}
                  onChange={(event) =>
                    setAssetSearchKeyword(event.target.value)
                  }
                  className="pl-9"
                  placeholder="搜索风格名称、说明或关键词"
                />
              </label>

              {entries.length === 0 ? (
                <EmptyWorkspaceState
                  onUpload={() => fileInputRef.current?.click()}
                  onCreateManual={handleCreateManualStyle}
                />
              ) : filteredEntries.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  没有匹配的风格资产，试试换个关键词。
                </div>
              ) : (
                <ScrollArea className="h-[560px] pr-3">
                  <div className="space-y-3">
                    {filteredEntries.map((entry) => (
                      <StyleAssetListItem
                        key={entry.id}
                        entry={entry}
                        active={selectedEntry?.id === entry.id}
                        onSelect={setActiveStyleLibraryEntry}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    快速加入预设
                  </CardTitle>
                  <CardDescription className="mt-1">
                    预设放到次级区域，避免与真实资产编辑抢注意力。
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setPresetShelfOpen((previous) => !previous)}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  {presetShelfOpen ? (
                    <>
                      收起
                      <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      展开
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </CardHeader>
            {presetShelfOpen ? (
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                {STYLE_PRESETS.slice(0, 6).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAddPreset(preset.id)}
                    className="rounded-[20px] border border-slate-200/80 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{preset.name}</div>
                      <Wand2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-xs leading-5 text-muted-foreground">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </CardContent>
            ) : null}
          </Card>
        </div>

        <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">结构化编辑</CardTitle>
            <CardDescription>
              将一条风格资产整理成稳定、可复用的结构化表达。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEntry ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">风格名称</label>
                    <Input
                      value={editor.name}
                      onChange={(event) =>
                        setEditor((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="例如：克制但有判断力的技术表达"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">适用对象</label>
                    <Input
                      value={editor.targetAudience}
                      onChange={(event) =>
                        setEditor((previous) => ({
                          ...previous,
                          targetAudience: event.target.value,
                        }))
                      }
                      placeholder="例如：知识创作者 / 产品经理 / 品牌运营"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">整体风格定位</label>
                  <Textarea
                    value={editor.description}
                    onChange={(event) =>
                      setEditor((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="描述这套风格最核心的表达感觉、语气和适用场景..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">语气关键词</label>
                  <Input
                    value={editor.toneKeywords}
                    onChange={(event) =>
                      setEditor((previous) => ({
                        ...previous,
                        toneKeywords: event.target.value,
                      }))
                    }
                    placeholder="例如：克制、温和、有判断力"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">适用主题</label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_OPTIONS.map((option) => {
                      const active = editor.applicableThemes.includes(
                        option.value,
                      );
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleTheme(option.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/40",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <label className="font-medium">模拟强度</label>
                    <span className="text-muted-foreground">
                      {editor.simulationStrength}
                    </span>
                  </div>
                  <Slider
                    value={[editor.simulationStrength]}
                    onValueChange={([value]) =>
                      setEditor((previous) => ({
                        ...previous,
                        simulationStrength: value,
                      }))
                    }
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">补充说明</label>
                  <Textarea
                    value={editor.customInstruction}
                    onChange={(event) =>
                      setEditor((previous) => ({
                        ...previous,
                        customInstruction: event.target.value,
                      }))
                    }
                    placeholder="补充这套风格必须保留或必须避免的表达倾向..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">样本文本</label>
                  <Textarea
                    value={editor.sampleText}
                    onChange={(event) =>
                      setEditor((previous) => ({
                        ...previous,
                        sampleText: event.target.value,
                      }))
                    }
                    placeholder="补充更多样本文本后，点击“重新解析风格”即可刷新结构化结果。"
                    rows={12}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => void handleSaveCurrentEntry()}
                    disabled={saving || !hasUnsavedChanges}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        保存条目
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleReanalyze()}
                    disabled={reanalyzing}
                  >
                    {reanalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重新解析风格
                      </>
                    )}
                  </Button>
                  {hasUnsavedChanges ? (
                    <span className="text-xs text-muted-foreground">
                      当前有未保存的编辑内容
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <EmptyWorkspaceState
                onUpload={() => fileInputRef.current?.click()}
                onCreateManual={handleCreateManualStyle}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4" />
                项目应用
              </CardTitle>
              <CardDescription>
                将当前资产设为项目默认风格，供画布与创作任务统一消费。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {projectId ? (
                  <>
                    当前项目：
                    <span className="ml-1 font-medium text-foreground">
                      {project?.name || "正在加载项目..."}
                    </span>
                    {project
                      ? ` · ${getProjectTypeLabel(project.workspaceType)}`
                      : ""}
                  </>
                ) : (
                  "当前未选择项目，仍可先整理风格资产；选择项目后即可设为默认风格。"
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  void handleApplyToProject();
                }}
                disabled={!projectId || !selectedEntry || applying}
              >
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    应用中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    设为当前项目默认风格
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={onOpenProjectStyleGuide}
                disabled={!projectId || !onOpenProjectStyleGuide}
              >
                前往项目风格策略
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">风格摘要</CardTitle>
              <CardDescription>
                先看结构化摘要，再决定是否继续编辑或应用到项目。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEntry ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.toneKeywords.length > 0 ? (
                      currentProfile.toneKeywords.map((item) => (
                        <Badge key={item} variant="secondary">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">待补充关键词</Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      适用主题：
                      {currentProfile.applicableThemes.length > 0
                        ? currentProfile.applicableThemes.join(" / ")
                        : "通用"}
                    </div>
                    {currentProfile.description ? (
                      <div>{currentProfile.description}</div>
                    ) : null}
                    {currentProfile.structureRules.length > 0 ? (
                      <div>
                        结构：{currentProfile.structureRules.join("；")}
                      </div>
                    ) : null}
                    {currentProfile.languageFeatures.length > 0 ? (
                      <div>
                        语言：{currentProfile.languageFeatures.join("；")}
                      </div>
                    ) : null}
                    {currentProfile.donts.length > 0 ? (
                      <div>避免事项：{currentProfile.donts.join("；")}</div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  选择左侧任意资产后，这里会显示结构化风格摘要。
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prompt 预览</CardTitle>
              <CardDescription>
                用于检查这条风格资产最终会如何被注入到生成链路中。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEntry ? (
                <div className="rounded-xl bg-black/95 p-4 text-xs leading-6 text-green-100 dark:bg-black">
                  <ScrollArea className="max-h-[420px]">
                    <pre className="whitespace-pre-wrap break-words font-mono">
                      {currentPreviewPrompt}
                    </pre>
                  </ScrollArea>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  当前还没有可预览的风格 Prompt。
                </div>
              )}
            </CardContent>
          </Card>

          {selectedEntry ? (
            <Card className="rounded-[26px] border border-red-200 bg-white shadow-sm shadow-slate-950/5 dark:border-red-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">条目管理</CardTitle>
                <CardDescription>
                  删除属于高风险操作，请仅在确认不再使用时执行。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => void handleDeleteEntry()}
                  disabled={deleting}
                  className="w-full"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除当前条目
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StyleLibraryPanel;
