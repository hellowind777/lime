import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  GitCompare,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { listDirectory, type DirectoryListing } from "@/lib/api/fileBrowser";
import type { Artifact } from "@/lib/artifact/types";
import type { CanvasStateUnion } from "@/components/content-creator/canvas/canvasUtils";
import type { DocumentVersion } from "@/components/content-creator/canvas/document/types";
import type { TaskFile } from "./TaskFiles";
import type { HarnessFilePreviewResult } from "./HarnessStatusPanel";
import {
  buildArtifactFromWrite,
  formatArtifactWritePhaseLabel,
  resolveArtifactPreviewText,
  resolveArtifactWritePhase,
} from "../utils/messageArtifacts";
import {
  buildCanvasWorkbenchDiff,
  type CanvasWorkbenchDiffLine,
} from "../utils/canvasWorkbenchDiff";

type CanvasWorkbenchTab = "artifacts" | "files" | "changes" | "preview";
export type CanvasWorkbenchLayoutMode = "split" | "stacked";

interface CanvasWorkbenchEntryBase {
  key: string;
  title: string;
  subtitle?: string;
  filePath?: string;
  absolutePath?: string;
  previewText?: string;
  createdAt?: number;
  isCurrent?: boolean;
  badgeLabel?: string;
  kindLabel: string;
}

interface CanvasWorkbenchArtifactEntry extends CanvasWorkbenchEntryBase {
  source: "artifact";
  artifact: Artifact;
}

interface CanvasWorkbenchDocumentVersionEntry extends CanvasWorkbenchEntryBase {
  source: "document-version";
  version: DocumentVersion;
}

interface CanvasWorkbenchTaskFileEntry extends CanvasWorkbenchEntryBase {
  source: "task-file";
  taskFile: TaskFile;
}

type CanvasWorkbenchEntry =
  | CanvasWorkbenchArtifactEntry
  | CanvasWorkbenchDocumentVersionEntry
  | CanvasWorkbenchTaskFileEntry;

export interface CanvasWorkbenchDefaultPreview {
  selectionKey?: string | null;
  title: string;
  content: string;
  filePath?: string;
  absolutePath?: string;
  previousContent?: string | null;
}

export type CanvasWorkbenchPreviewTarget =
  | {
      kind: "default-canvas";
      title: string;
      content: string;
      filePath?: string;
      absolutePath?: string;
    }
  | {
      kind: "artifact";
      title: string;
      artifact: Artifact;
      filePath?: string;
      absolutePath?: string;
    }
  | {
      kind: "synthetic-artifact";
      title: string;
      artifact: Artifact;
      filePath?: string;
      absolutePath?: string;
    }
  | {
      kind: "loading";
      title: string;
      filePath?: string;
      absolutePath?: string;
    }
  | {
      kind: "unsupported";
      title: string;
      reason: string;
      filePath?: string;
      absolutePath?: string;
    }
  | {
      kind: "empty";
      title: string;
    };

interface WorkspaceFileSelection {
  path: string;
  title: string;
  status: "loading" | "ready" | "error" | "binary";
  content?: string;
  error?: string | null;
  size?: number;
}

export interface CanvasWorkbenchLayoutProps {
  artifacts: Artifact[];
  canvasState: CanvasStateUnion | null;
  taskFiles: TaskFile[];
  selectedFileId?: string;
  workspaceRoot?: string | null;
  workspaceUnavailable?: boolean;
  defaultPreview: CanvasWorkbenchDefaultPreview | null;
  loadFilePreview: (path: string) => Promise<HarnessFilePreviewResult>;
  onOpenPath: (path: string) => Promise<void>;
  onRevealPath: (path: string) => Promise<void>;
  renderPreview: (
    target: CanvasWorkbenchPreviewTarget,
    options?: {
      stackedWorkbenchTrigger?: ReactNode;
    },
  ) => ReactNode;
  onLayoutModeChange?: (mode: CanvasWorkbenchLayoutMode) => void;
}

const TAB_META: Array<{ key: CanvasWorkbenchTab; label: string }> = [
  { key: "artifacts", label: "产物" },
  { key: "files", label: "全部文件" },
  { key: "changes", label: "变更" },
  { key: "preview", label: "预览" },
];

const STACKED_LAYOUT_BREAKPOINT = 1040;

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isAbsoluteLikePath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("~/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("\\\\")
  );
}

function joinWorkspacePath(rootPath: string, filePath: string): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/${filePath.replace(/^[\\/]+/, "")}`;
}

function resolveWorkspacePath(
  workspaceRoot: string | null | undefined,
  filePath: string | null | undefined,
): string | undefined {
  const normalized = filePath?.trim();
  if (!normalized) {
    return undefined;
  }
  if (isAbsoluteLikePath(normalized)) {
    return normalized;
  }
  if (!workspaceRoot?.trim()) {
    return normalized;
  }
  return joinWorkspacePath(workspaceRoot.trim(), normalized);
}

function resolveFileName(path: string | null | undefined): string {
  const normalized = normalizePath(path?.trim() || "");
  if (!normalized) {
    return "未命名文件";
  }
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function buildSyntheticArtifact(
  id: string,
  filePath: string,
  content: string,
): Artifact {
  return buildArtifactFromWrite({
    filePath,
    content,
    context: {
      artifactId: id,
      status: "complete",
      metadata: {
        previewText: content,
      },
    },
  });
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function resolvePreviousVersionContent(
  version: DocumentVersion,
  versions: DocumentVersion[],
): string | null {
  const parentVersionId = version.metadata?.parentVersionId?.trim();
  if (parentVersionId) {
    const parentVersion = versions.find((item) => item.id === parentVersionId);
    if (parentVersion) {
      return parentVersion.content;
    }
  }

  const currentIndex = versions.findIndex((item) => item.id === version.id);
  if (currentIndex > 0) {
    return versions[currentIndex - 1]?.content || null;
  }

  return null;
}

function resolvePreviousArtifactContent(
  artifact: Artifact,
  artifacts: Artifact[],
): string | null {
  const currentPath = normalizePath(
    typeof artifact.meta.filePath === "string"
      ? artifact.meta.filePath
      : artifact.meta.filename || artifact.title,
  );

  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    const candidate = artifacts[index];
    if (candidate.id === artifact.id) {
      continue;
    }
    const candidatePath = normalizePath(
      typeof candidate.meta.filePath === "string"
        ? candidate.meta.filePath
        : candidate.meta.filename || candidate.title,
    );
    if (candidatePath === currentPath && candidate.content.trim()) {
      return candidate.content;
    }
  }

  return null;
}

function isDocumentCanvasState(
  state: CanvasStateUnion | null,
): state is Extract<CanvasStateUnion, { type: "document" }> {
  return Boolean(state && state.type === "document");
}

function resolveMappedPreviousContentForPath(
  absolutePath: string,
  canvasState: CanvasStateUnion | null,
  artifacts: Artifact[],
  workspaceRoot?: string | null,
): string | null {
  const normalizedTarget = normalizePath(absolutePath);
  if (isDocumentCanvasState(canvasState)) {
    const matchedVersion = canvasState.versions.find((version) => {
      const versionPath = resolveWorkspacePath(
        workspaceRoot,
        version.metadata?.sourceFileName,
      );
      return versionPath ? normalizePath(versionPath) === normalizedTarget : false;
    });
    if (matchedVersion) {
      return resolvePreviousVersionContent(matchedVersion, canvasState.versions);
    }
  }

  const matchedArtifact = artifacts.find((artifact) => {
    const artifactPath = resolveWorkspacePath(
      workspaceRoot,
      typeof artifact.meta.filePath === "string"
        ? artifact.meta.filePath
        : artifact.meta.filename || artifact.title,
    );
    return artifactPath ? normalizePath(artifactPath) === normalizedTarget : false;
  });

  return matchedArtifact
    ? resolvePreviousArtifactContent(matchedArtifact, artifacts)
    : null;
}

function buildEntries(
  artifacts: Artifact[],
  canvasState: CanvasStateUnion | null,
  taskFiles: TaskFile[],
  workspaceRoot?: string | null,
): CanvasWorkbenchEntry[] {
  const entries: CanvasWorkbenchEntry[] = artifacts
    .slice()
    .reverse()
    .map((artifact) => {
      const filePath =
        typeof artifact.meta.filePath === "string"
          ? artifact.meta.filePath
          : artifact.meta.filename || artifact.title;
      const writePhase = resolveArtifactWritePhase(artifact);
      return {
        key: `artifact:${artifact.id}`,
        source: "artifact",
        artifact,
        title: artifact.title,
        subtitle: filePath,
        filePath,
        absolutePath: resolveWorkspacePath(workspaceRoot, filePath),
        previewText: resolveArtifactPreviewText(artifact),
        createdAt: artifact.updatedAt || artifact.createdAt,
        badgeLabel: writePhase ? formatArtifactWritePhaseLabel(writePhase) : undefined,
        kindLabel: "产物",
      };
    });

  if (isDocumentCanvasState(canvasState)) {
    entries.push(
      ...canvasState.versions
        .slice()
        .reverse()
        .map((version, index) => ({
          key: `version:${version.id}`,
          source: "document-version" as const,
          version,
          title:
            version.description?.trim() ||
            `文稿版本 ${canvasState.versions.length - index}`,
          subtitle: version.metadata?.sourceFileName || "当前文稿",
          filePath: version.metadata?.sourceFileName,
          absolutePath: resolveWorkspacePath(
            workspaceRoot,
            version.metadata?.sourceFileName,
          ),
          previewText: version.content.trim().slice(0, 180),
          createdAt: version.createdAt,
          isCurrent: version.id === canvasState.currentVersionId,
          badgeLabel: version.id === canvasState.currentVersionId ? "当前" : undefined,
          kindLabel: "版本",
        })),
    );
  }

  entries.push(
    ...taskFiles
      .slice()
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((taskFile) => ({
        key: `task:${taskFile.id}`,
        source: "task-file" as const,
        taskFile,
        title: resolveFileName(taskFile.name),
        subtitle: taskFile.name,
        filePath: taskFile.name,
        absolutePath: resolveWorkspacePath(workspaceRoot, taskFile.name),
        previewText: taskFile.content?.trim().slice(0, 180),
        createdAt: taskFile.updatedAt,
        badgeLabel: taskFile.type === "document" ? "文档" : undefined,
        kindLabel: "任务文件",
      })),
  );

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) {
      return false;
    }
    seen.add(entry.key);
    return true;
  });
}

function renderDiffState(
  diffLines: CanvasWorkbenchDiffLine[],
): ReactNode {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="max-h-[28rem] overflow-auto">
        {diffLines.map((line, index) => (
          <div
            key={`${line.type}-${index}`}
            className={cn(
              "grid grid-cols-[20px_1fr] gap-3 px-3 py-2 font-mono text-[12px] leading-6",
              line.type === "add" && "bg-emerald-50 text-emerald-900",
              line.type === "remove" && "bg-rose-50 text-rose-900",
              line.type === "context" && "text-muted-foreground",
            )}
          >
            <span className="select-none text-center">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className="whitespace-pre-wrap break-all">{line.value || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CanvasWorkbenchLayout = memo(function CanvasWorkbenchLayout({
  artifacts,
  canvasState,
  taskFiles,
  selectedFileId,
  workspaceRoot,
  workspaceUnavailable = false,
  defaultPreview,
  loadFilePreview,
  onOpenPath,
  onRevealPath,
  renderPreview,
  onLayoutModeChange,
}: CanvasWorkbenchLayoutProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<CanvasWorkbenchTab>("artifacts");
  const [collapsed, setCollapsed] = useState(false);
  const [isStackedLayout, setIsStackedLayout] = useState(false);
  const [stackedWorkbenchOpen, setStackedWorkbenchOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [directoryCache, setDirectoryCache] = useState<Record<string, DirectoryListing>>(
    {},
  );
  const [loadingDirectories, setLoadingDirectories] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>(
    {},
  );
  const [workspaceFileSelections, setWorkspaceFileSelections] = useState<
    Record<string, WorkspaceFileSelection>
  >({});

  const entries = useMemo(
    () => buildEntries(artifacts, canvasState, taskFiles, workspaceRoot),
    [artifacts, canvasState, taskFiles, workspaceRoot],
  );

  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries],
  );

  const fallbackEntryKey = useMemo(() => {
    if (defaultPreview) {
      if (
        defaultPreview.selectionKey &&
        entryMap.has(defaultPreview.selectionKey)
      ) {
        return defaultPreview.selectionKey;
      }
      return null;
    }

    if (selectedFileId) {
      const selectedTaskKey = `task:${selectedFileId}`;
      if (entryMap.has(selectedTaskKey)) {
        return selectedTaskKey;
      }
    }

    return entries[0]?.key || null;
  }, [defaultPreview, entries, entryMap, selectedFileId]);

  useEffect(() => {
    if (selectedKey && (entryMap.has(selectedKey) || selectedKey.startsWith("workspace-file:"))) {
      return;
    }
    setSelectedKey(fallbackEntryKey);
  }, [entryMap, fallbackEntryKey, selectedKey]);

  const loadDirectory = useCallback(async (path: string) => {
    if (!path.trim()) {
      return;
    }
    setLoadingDirectories((previous) => ({ ...previous, [path]: true }));
    try {
      const listing = await listDirectory(path);
      setDirectoryCache((previous) => ({
        ...previous,
        [path]: listing,
      }));
    } catch (error) {
      toast.error(
        `读取目录失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingDirectories((previous) => ({ ...previous, [path]: false }));
    }
  }, []);

  useEffect(() => {
    if (!workspaceRoot?.trim() || workspaceUnavailable) {
      return;
    }
    if (directoryCache[workspaceRoot]) {
      return;
    }
    void loadDirectory(workspaceRoot);
  }, [
    directoryCache,
    loadDirectory,
    workspaceRoot,
    workspaceUnavailable,
  ]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) {
      return;
    }

    const updateLayout = (width: number) => {
      if (width <= 0) {
        return;
      }
      setIsStackedLayout(width < STACKED_LAYOUT_BREAKPOINT);
    };

    const fallbackWidth =
      node.getBoundingClientRect().width || node.clientWidth || window.innerWidth;
    updateLayout(fallbackWidth);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth =
        entries[0]?.contentRect.width ||
        node.getBoundingClientRect().width ||
        node.clientWidth;
      updateLayout(nextWidth);
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    onLayoutModeChange?.(isStackedLayout ? "stacked" : "split");
  }, [isStackedLayout, onLayoutModeChange]);

  useEffect(() => {
    if (isStackedLayout) {
      setStackedWorkbenchOpen(false);
    }
  }, [isStackedLayout]);

  const handleToggleDirectory = useCallback(
    (path: string) => {
      setExpandedDirectories((previous) => {
        const nextExpanded = !previous[path];
        return {
          ...previous,
          [path]: nextExpanded,
        };
      });
      if (!directoryCache[path]) {
        void loadDirectory(path);
      }
    },
    [directoryCache, loadDirectory],
  );

  const handleSelectWorkspaceFile = useCallback(
    async (path: string) => {
      const title = resolveFileName(path);
      const selectionKey = `workspace-file:${path}`;
      setSelectedKey(selectionKey);
      setWorkspaceFileSelections((previous) => ({
        ...previous,
        [selectionKey]: {
          path,
          title,
          status: "loading",
        },
      }));

      const preview = await loadFilePreview(path);
      setWorkspaceFileSelections((previous) => {
        if (preview.isBinary) {
          return {
            ...previous,
            [selectionKey]: {
              path,
              title,
              status: "binary",
              error: preview.error ?? null,
              size: preview.size,
            },
          };
        }

        if (preview.error) {
          return {
            ...previous,
            [selectionKey]: {
              path,
              title,
              status: "error",
              error: preview.error,
              size: preview.size,
            },
          };
        }

        return {
          ...previous,
          [selectionKey]: {
            path,
            title,
            status: "ready",
            content: preview.content || "",
            size: preview.size,
          },
        };
      });
    },
    [loadFilePreview],
  );

  const effectiveKey = selectedKey || fallbackEntryKey;
  const selectedEntry = effectiveKey ? entryMap.get(effectiveKey) || null : null;
  const selectedWorkspaceFile = effectiveKey?.startsWith("workspace-file:")
    ? workspaceFileSelections[effectiveKey] || null
    : null;

  const currentTarget = useMemo<CanvasWorkbenchPreviewTarget>(() => {
    if (selectedWorkspaceFile) {
      if (selectedWorkspaceFile.status === "loading") {
        return {
          kind: "loading",
          title: selectedWorkspaceFile.title,
          filePath: selectedWorkspaceFile.path,
          absolutePath: selectedWorkspaceFile.path,
        };
      }

      if (selectedWorkspaceFile.status === "binary") {
        return {
          kind: "unsupported",
          title: selectedWorkspaceFile.title,
          reason: "该文件为二进制内容，暂不支持画布文本预览。",
          filePath: selectedWorkspaceFile.path,
          absolutePath: selectedWorkspaceFile.path,
        };
      }

      if (selectedWorkspaceFile.status === "error") {
        return {
          kind: "unsupported",
          title: selectedWorkspaceFile.title,
          reason: selectedWorkspaceFile.error || "读取文件失败",
          filePath: selectedWorkspaceFile.path,
          absolutePath: selectedWorkspaceFile.path,
        };
      }

      return {
        kind: "synthetic-artifact",
        title: selectedWorkspaceFile.title,
        artifact: buildSyntheticArtifact(
          `canvas-workbench:file:${selectedWorkspaceFile.path}`,
          selectedWorkspaceFile.path,
          selectedWorkspaceFile.content || "",
        ),
        filePath: selectedWorkspaceFile.path,
        absolutePath: selectedWorkspaceFile.path,
      };
    }

    if (selectedEntry) {
      if (
        defaultPreview &&
        selectedEntry.key === defaultPreview.selectionKey &&
        defaultPreview.content.trim()
      ) {
        return {
          kind: "default-canvas",
          title: defaultPreview.title,
          content: defaultPreview.content,
          filePath: defaultPreview.filePath,
          absolutePath: defaultPreview.absolutePath,
        };
      }

      if (selectedEntry.source === "artifact") {
        return {
          kind: "artifact",
          title: selectedEntry.title,
          artifact: selectedEntry.artifact,
          filePath: selectedEntry.filePath,
          absolutePath: selectedEntry.absolutePath,
        };
      }

      if (selectedEntry.source === "document-version") {
        return {
          kind: "synthetic-artifact",
          title: selectedEntry.title,
          artifact: buildSyntheticArtifact(
            `canvas-workbench:version:${selectedEntry.version.id}`,
            selectedEntry.filePath || `${selectedEntry.title}.md`,
            selectedEntry.version.content,
          ),
          filePath: selectedEntry.filePath,
          absolutePath: selectedEntry.absolutePath,
        };
      }

      return {
        kind: "synthetic-artifact",
        title: selectedEntry.title,
        artifact: buildSyntheticArtifact(
          `canvas-workbench:task:${selectedEntry.taskFile.id}`,
          selectedEntry.filePath || selectedEntry.title,
          selectedEntry.taskFile.content || "",
        ),
        filePath: selectedEntry.filePath,
        absolutePath: selectedEntry.absolutePath,
      };
    }

    if (defaultPreview) {
      return {
        kind: "default-canvas",
        title: defaultPreview.title,
        content: defaultPreview.content,
        filePath: defaultPreview.filePath,
        absolutePath: defaultPreview.absolutePath,
      };
    }

    return {
      kind: "empty",
      title: "暂无可预览内容",
    };
  }, [defaultPreview, selectedEntry, selectedWorkspaceFile]);

  const currentContent = useMemo(() => {
    if (currentTarget.kind === "default-canvas") {
      return currentTarget.content;
    }
    if (
      currentTarget.kind === "artifact" ||
      currentTarget.kind === "synthetic-artifact"
    ) {
      return currentTarget.artifact.content;
    }
    return "";
  }, [currentTarget]);

  const previousContent = useMemo(() => {
    if (selectedWorkspaceFile?.status === "ready") {
      return resolveMappedPreviousContentForPath(
        selectedWorkspaceFile.path,
        canvasState,
        artifacts,
        workspaceRoot,
      );
    }

    if (!selectedEntry) {
      return defaultPreview?.previousContent || null;
    }

    if (
      defaultPreview &&
      selectedEntry.key === defaultPreview.selectionKey &&
      defaultPreview.content.trim()
    ) {
      return defaultPreview.previousContent || null;
    }

    if (selectedEntry.source === "artifact") {
      return resolvePreviousArtifactContent(selectedEntry.artifact, artifacts);
    }

    if (selectedEntry.source === "document-version" && isDocumentCanvasState(canvasState)) {
      return resolvePreviousVersionContent(selectedEntry.version, canvasState.versions);
    }

    if (selectedEntry.absolutePath) {
      return resolveMappedPreviousContentForPath(
        selectedEntry.absolutePath,
        canvasState,
        artifacts,
        workspaceRoot,
      );
    }

    return null;
  }, [
    artifacts,
    canvasState,
    defaultPreview,
    selectedEntry,
    selectedWorkspaceFile,
    workspaceRoot,
  ]);

  const diffLines = useMemo(
    () =>
      previousContent !== null
        ? buildCanvasWorkbenchDiff(previousContent, currentContent)
        : [],
    [currentContent, previousContent],
  );

  const selectionPath =
    currentTarget.kind === "default-canvas" ||
    currentTarget.kind === "artifact" ||
    currentTarget.kind === "synthetic-artifact" ||
    currentTarget.kind === "loading" ||
    currentTarget.kind === "unsupported"
      ? currentTarget.absolutePath || currentTarget.filePath
      : undefined;

  const handleCopyPath = useCallback(async () => {
    if (!selectionPath) {
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("当前环境不支持剪贴板写入");
      }
      await navigator.clipboard.writeText(selectionPath);
      toast.success("已复制路径");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "复制路径失败",
      );
    }
  }, [selectionPath]);

  const handleDownload = useCallback(() => {
    if (!currentContent.trim()) {
      return;
    }
    const filename = resolveFileName(selectionPath || currentTarget.title);
    downloadText(filename, currentContent);
  }, [currentContent, currentTarget.title, selectionPath]);

  const renderEntriesTab = () => {
    if (entries.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          暂无产物记录，可先生成一份文稿或从文件树中选择已有文件。
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-label={`选择画布产物-${entry.title}`}
            onClick={() => setSelectedKey(entry.key)}
            className={cn(
              "w-full rounded-xl border px-3 py-3 text-left transition-colors",
              effectiveKey === entry.key
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-background hover:bg-muted/60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {entry.kindLabel}
                  </span>
                  {entry.isCurrent ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      当前
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-foreground">
                  {entry.title}
                </div>
                {entry.subtitle ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {entry.subtitle}
                  </div>
                ) : null}
                {entry.previewText ? (
                  <div className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                    {entry.previewText}
                  </div>
                ) : null}
              </div>
              {entry.badgeLabel ? (
                <Badge variant="outline" className="shrink-0">
                  {entry.badgeLabel}
                </Badge>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderDirectoryNode = (path: string, depth = 0): ReactNode => {
    const listing = directoryCache[path];
    if (!listing) {
      return null;
    }

    return listing.entries.map((entry) => {
      const rowKey = entry.path;
      const isDirectory = entry.isDir;
      const isExpanded = Boolean(expandedDirectories[entry.path]);
      const fileSelectionKey = `workspace-file:${entry.path}`;
      const isSelected = effectiveKey === fileSelectionKey;

      return (
        <div key={rowKey}>
          <button
            type="button"
            aria-label={
              isDirectory
                ? `${isExpanded ? "折叠" : "展开"}目录-${entry.name}`
                : `选择工作区文件-${entry.name}`
            }
            onClick={() => {
              if (isDirectory) {
                handleToggleDirectory(entry.path);
                return;
              }
              void handleSelectWorkspaceFile(entry.path);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
              isSelected
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted/60 text-muted-foreground",
            )}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {isDirectory ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {isDirectory ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-amber-600" />
              )
            ) : entry.name.match(/\.(ts|tsx|js|jsx|rs|json|yml|yaml|toml)$/i) ? (
              <FileCode2 className="h-4 w-4 shrink-0 text-sky-600" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
            )}
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            {loadingDirectories[entry.path] ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : null}
          </button>
          {isDirectory && isExpanded ? renderDirectoryNode(entry.path, depth + 1) : null}
        </div>
      );
    });
  };

  const renderFilesTab = () => {
    if (workspaceUnavailable) {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          当前工作区路径不可用，暂时无法浏览全部文件。
        </div>
      );
    }

    if (!workspaceRoot?.trim()) {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          当前会话没有绑定可浏览的工作区目录。
        </div>
      );
    }

    const rootListing = directoryCache[workspaceRoot];
    return (
      <div className="rounded-xl border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Workspace Root
            </div>
            <div className="mt-1 truncate text-sm text-foreground">{workspaceRoot}</div>
          </div>
          <button
            type="button"
            aria-label="刷新工作区文件树"
            onClick={() => void loadDirectory(workspaceRoot)}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[30rem] overflow-auto px-2 py-2">
          {loadingDirectories[workspaceRoot] && !rootListing ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载目录...
            </div>
          ) : rootListing ? (
            renderDirectoryNode(workspaceRoot)
          ) : (
            <div className="px-2 py-4 text-sm text-muted-foreground">
              暂无目录内容。
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChangesTab = () => {
    if (!currentContent.trim()) {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          当前选中项没有可比较的正文内容。
        </div>
      );
    }

    if (previousContent === null) {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          当前选中项没有可用的上一版本，暂时无法展示变更。
        </div>
      );
    }

    return renderDiffState(diffLines);
  };

  const renderPreviewTab = () => {
    if (currentTarget.kind === "loading") {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取文件内容...
        </div>
      );
    }

    if (currentTarget.kind === "unsupported") {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {currentTarget.reason}
        </div>
      );
    }

    if (!currentContent.trim()) {
      return (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          当前选中项暂无可展示内容。
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="max-h-[30rem] overflow-auto px-4 py-4">
          <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-foreground">
            {currentContent}
          </pre>
        </div>
      </div>
    );
  };

  const renderTabButtons = (stacked: boolean) => (
    <div
      className={cn(
        "mt-4 grid gap-2",
        stacked ? "grid-cols-2" : "grid-cols-4",
      )}
    >
      {TAB_META.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-label={`切换画布标签-${tab.label}`}
          onClick={() => setActiveTab(tab.key)}
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
            activeTab === tab.key
              ? "border-primary/30 bg-primary/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderWorkbenchHeader = (
    stacked: boolean,
    options?: {
      showCollapseButton?: boolean;
    },
  ) => (
    <div className={cn("border-b border-border/80", stacked ? "px-3 py-3" : "px-4 py-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Canvas Workbench
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {currentTarget.title}
          </div>
          {selectionPath ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {selectionPath}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="下载当前画布项"
            disabled={!currentContent.trim()}
            onClick={handleDownload}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
          </button>
          {stacked || options?.showCollapseButton ? (
            <button
              type="button"
              aria-label="折叠画布工作台"
              onClick={() => {
                if (stacked) {
                  setStackedWorkbenchOpen(false);
                  return;
                }
                setCollapsed(true);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      {renderTabButtons(stacked)}
    </div>
  );

  const renderWorkbenchFooter = (stacked: boolean) => (
    <div className={cn("border-t border-border/80", stacked ? "px-3 py-3" : "px-4 py-3")}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="复制当前路径"
          disabled={!selectionPath}
          onClick={() => {
            void handleCopyPath();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          复制路径
        </button>
        <button
          type="button"
          aria-label="定位当前文件"
          disabled={!selectionPath}
          onClick={() => {
            if (selectionPath) {
              void onRevealPath(selectionPath);
            }
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          定位
        </button>
        <button
          type="button"
          aria-label="系统打开当前文件"
          disabled={!selectionPath}
          onClick={() => {
            if (selectionPath) {
              void onOpenPath(selectionPath);
            }
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          打开
        </button>
      </div>
      {previousContent !== null ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <GitCompare className="h-3.5 w-3.5" />
          已关联到上一版本，可在“变更”中查看差异。
        </div>
      ) : null}
    </div>
  );

  const renderActiveTab = () =>
    activeTab === "artifacts"
      ? renderEntriesTab()
      : activeTab === "files"
        ? renderFilesTab()
        : activeTab === "changes"
          ? renderChangesTab()
          : renderPreviewTab();

  const stackedWorkbenchTrigger =
    isStackedLayout && !stackedWorkbenchOpen ? (
      <button
        type="button"
        aria-label="展开画布工作台"
        title="工作台"
        onClick={() => setStackedWorkbenchOpen(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-all hover:bg-black/5 hover:text-foreground"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
    ) : undefined;

  return (
    <div
      ref={shellRef}
      data-testid="canvas-workbench-shell"
      data-layout-mode={isStackedLayout ? "stacked" : "split"}
      className={cn(
        "relative h-full min-h-0 overflow-hidden rounded-[14px] border border-border bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.12))]",
        isStackedLayout ? "block" : "flex flex-row",
      )}
    >
      <div
        className={cn(
          "min-w-0 overflow-hidden",
          isStackedLayout ? "h-full" : "flex-1",
        )}
      >
        {renderPreview(currentTarget, {
          stackedWorkbenchTrigger,
        })}
      </div>

      {isStackedLayout ? (
        stackedWorkbenchOpen ? (
          <section
            data-testid="canvas-workbench-layout"
            data-panel-placement="overlay-right"
            className="absolute inset-y-3 right-3 z-10 flex w-[min(25rem,calc(100%-1.5rem))] max-w-full flex-col overflow-hidden rounded-[18px] border border-border/80 bg-background/95 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-md"
          >
            {renderWorkbenchHeader(true)}
            <div className="flex-1 overflow-auto px-3 py-3">{renderActiveTab()}</div>
            {renderWorkbenchFooter(true)}
          </section>
        ) : null
      ) : (
        <aside
          data-testid="canvas-workbench-layout"
          data-panel-placement="side"
          className={cn(
            "relative flex h-full flex-col border-l border-border/80 bg-background/88 backdrop-blur-sm transition-[width] duration-200",
            collapsed ? "w-12" : "w-[360px]",
          )}
        >
          {collapsed ? (
            <div className="flex h-full flex-col items-center gap-3 px-2 py-4">
              <button
                type="button"
                aria-label="展开画布工作台"
                onClick={() => setCollapsed(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
              {TAB_META.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-label={`切换画布标签-${tab.label}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground transition-colors",
                    activeTab === tab.key && "bg-primary/10 text-primary",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              {renderWorkbenchHeader(false, {
                showCollapseButton: true,
              })}
              <div className="flex-1 overflow-auto px-4 py-4">{renderActiveTab()}</div>
              {renderWorkbenchFooter(false)}
            </>
          )}
        </aside>
      )}
    </div>
  );
});

export default CanvasWorkbenchLayout;
