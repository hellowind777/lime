/**
 * @file ProjectSelector.tsx
 * @description 项目选择器组件，用于在聊天入口和侧边栏选择项目
 * @module components/projects/ProjectSelector
 * @requirements 4.1, 4.2, 4.3, 4.5
 */

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  FolderIcon,
  Pencil,
  Plus,
  Search,
  StarIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjects } from "@/hooks/useProjects";
import type { ProjectType } from "@/lib/api/project";
import { USER_PROJECT_TYPES } from "@/lib/api/project";
import { WorkspaceTypeLabels } from "@/types/workspace";
import { cn } from "@/lib/utils";
import { CreateProjectDialog } from "./CreateProjectDialog";
import {
  canDeleteProject,
  canRenameProject,
  getAvailableProjects,
  resolveProjectDeletionFallback,
  resolveSelectedProject,
} from "./projectSelectorUtils";

export interface ProjectSelectorProps {
  /** 当前选中的项目 ID */
  value: string | null;
  /** 选择变化回调 */
  onChange: (projectId: string) => void;
  /** 按主题类型筛选（可选，不传则显示所有项目） */
  workspaceType?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 下拉方向 */
  dropdownSide?: "top" | "bottom";
  /** 下拉对齐 */
  dropdownAlign?: "start" | "end";
  /** 是否启用项目管理 */
  enableManagement?: boolean;
}

function resolveDefaultProjectType(workspaceType?: string): ProjectType {
  if (
    workspaceType &&
    USER_PROJECT_TYPES.includes(
      workspaceType as (typeof USER_PROJECT_TYPES)[number],
    )
  ) {
    return workspaceType as ProjectType;
  }

  return "general";
}

/**
 * 项目选择器组件
 *
 * 通用对话默认会启用搜索和轻量项目管理。
 */
export function ProjectSelector({
  value,
  onChange,
  workspaceType,
  placeholder = "选择项目",
  disabled = false,
  className,
  dropdownSide = "top",
  dropdownAlign = "start",
  enableManagement = false,
}: ProjectSelectorProps) {
  const {
    projects,
    generalProjects,
    defaultProject,
    loading,
    create,
    rename,
    remove,
    getOrCreateDefault,
  } = useProjects();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const projectSource =
    workspaceType === "general" ? generalProjects : projects;

  const availableProjects = useMemo(
    () => getAvailableProjects(projectSource, workspaceType),
    [projectSource, workspaceType],
  );

  const selectedProject = useMemo(
    () => resolveSelectedProject(availableProjects, value, defaultProject),
    [availableProjects, defaultProject, value],
  );

  const renameTarget = useMemo(
    () =>
      renameTargetId
        ? availableProjects.find((project) => project.id === renameTargetId) || null
        : null,
    [availableProjects, renameTargetId],
  );

  const deleteTarget = useMemo(
    () =>
      deleteTargetId
        ? availableProjects.find((project) => project.id === deleteTargetId) || null
        : null,
    [availableProjects, deleteTargetId],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableProjects;
    }

    return availableProjects.filter(
      (project) =>
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
    );
  }, [availableProjects, searchQuery]);

  const defaultProjectType = useMemo(
    () => resolveDefaultProjectType(workspaceType),
    [workspaceType],
  );

  useEffect(() => {
    if (open) {
      return;
    }

    setSearchQuery("");
  }, [open]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (value && availableProjects.some((project) => project.id === value)) {
      return;
    }

    let cancelled = false;

    const ensureSelection = async () => {
      const fallbackProjectId = resolveProjectDeletionFallback(
        availableProjects,
        defaultProject,
        null,
      );

      if (fallbackProjectId) {
        if (!cancelled && fallbackProjectId !== value) {
          onChange(fallbackProjectId);
        }
        return;
      }

      try {
        const createdDefault = await getOrCreateDefault();
        if (!cancelled && createdDefault.id && createdDefault.id !== value) {
          onChange(createdDefault.id);
        }
      } catch (error) {
        console.error("创建默认项目失败:", error);
      }
    };

    void ensureSelection();

    return () => {
      cancelled = true;
    };
  }, [availableProjects, defaultProject, getOrCreateDefault, loading, onChange, value]);

  const handleSelect = (projectId: string) => {
    if (projectId !== value) {
      onChange(projectId);
    }
    setOpen(false);
  };

  const handleCreateProject = async (name: string, type: ProjectType) => {
    const project = await create({
      name,
      workspaceType: type,
    });
    onChange(project.id);
    setOpen(false);
    toast.success("项目已创建");
  };

  const handleOpenRename = () => {
    const currentSelectedProject = selectedProject;
    if (
      !currentSelectedProject ||
      !canRenameProject(currentSelectedProject)
    ) {
      return;
    }

    setRenameTargetId(currentSelectedProject.id);
    setRenameName(currentSelectedProject.name);
    setOpen(false);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !canRenameProject(renameTarget)) {
      return;
    }

    const nextName = renameName.trim();
    if (!nextName) {
      toast.error("项目名称不能为空");
      return;
    }

    setIsRenaming(true);
    try {
      await rename(renameTarget.id, nextName);
      setRenameDialogOpen(false);
      setRenameTargetId(null);
      toast.success("项目名称已更新");
    } catch (error) {
      toast.error(
        `重命名失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const handleOpenDelete = () => {
    const currentSelectedProject = selectedProject;
    if (
      !currentSelectedProject ||
      !canDeleteProject(currentSelectedProject)
    ) {
      return;
    }

    setDeleteTargetId(currentSelectedProject.id);
    setOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDeleteProject(deleteTarget)) {
      return;
    }

    setIsDeleting(true);
    try {
      const deletedProjectId = deleteTarget.id;
      await remove(deletedProjectId);

      if (value === deletedProjectId) {
        const fallbackProjectId =
          resolveProjectDeletionFallback(
            availableProjects,
            defaultProject,
            deletedProjectId,
          ) || (await getOrCreateDefault()).id;

        if (fallbackProjectId) {
          onChange(fallbackProjectId);
        }
      }

      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      toast.success("项目已删除，本地目录未删除");
    } catch (error) {
      toast.error(
        `删除失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const managementHint =
    selectedProject && !canRenameProject(selectedProject)
      ? "默认项目不可重命名或删除"
      : null;
  const projectSummaryBadges = [
    selectedProject?.isDefault ? "默认项目" : "普通项目",
    selectedProject
      ? WorkspaceTypeLabels[selectedProject.workspaceType]
      : "待选择",
  ];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-auto min-w-[220px] max-w-[300px] justify-between gap-3 rounded-full border-slate-200/80 bg-white/88 px-3 py-2 text-left shadow-sm shadow-slate-950/5 hover:bg-white",
              className,
            )}
            disabled={disabled || loading}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-600">
                {selectedProject?.icon ? (
                  <span className="text-base">{selectedProject.icon}</span>
                ) : (
                  <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {selectedProject?.name || placeholder}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {selectedProject?.rootPath || "选择项目后在这里查看目录"}
                </span>
              </span>
              {selectedProject?.isDefault ? (
                <StarIcon className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
              ) : (
                <span className="sr-only">普通项目</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side={dropdownSide}
          align={dropdownAlign}
          className="w-[420px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,0.98)_36%,rgba(240,249,255,0.94)_100%)] p-0 shadow-lg shadow-slate-950/10"
        >
          <div className="flex flex-col">
            <div className="relative border-b border-white/80 px-4 py-4">
              <div className="pointer-events-none absolute -left-10 top-[-24px] h-24 w-24 rounded-full bg-sky-200/20 blur-3xl" />
              <div className="pointer-events-none absolute right-[-20px] top-0 h-20 w-20 rounded-full bg-emerald-200/20 blur-3xl" />
              <div className="relative space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      选择项目
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      在同一处切换项目、搜索项目，并管理当前可见项目列表。
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-200/80 bg-white/85 text-slate-600"
                  >
                    {filteredProjects.length} 个项目
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {projectSummaryBadges.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/90 bg-white/85 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索项目"
                    className="h-10 border-slate-200/80 bg-white/85 pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-4">
              <ScrollArea className="max-h-[320px]">
                <div className="space-y-3 pr-2">
                {filteredProjects.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-300/80 bg-white/80 px-4 py-8 text-center text-sm text-slate-500">
                    未找到匹配项目
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const isSelected = project.id === selectedProject?.id;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleSelect(project.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition",
                          isSelected
                            ? "border-slate-900/20 bg-slate-900/5 shadow-sm shadow-slate-950/5"
                            : "border-slate-200/80 bg-white/85 hover:border-slate-300 hover:bg-white",
                        )}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-slate-50 text-slate-600">
                          {project.icon ? (
                            <span className="text-base">{project.icon}</span>
                          ) : (
                            <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-slate-900">
                              {project.name}
                            </span>
                            {project.isDefault ? (
                              <StarIcon className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-slate-200/80 bg-white/80 text-[10px] text-slate-600"
                            >
                              {WorkspaceTypeLabels[project.workspaceType]}
                            </Badge>
                            {project.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="border-slate-200/80 bg-white/70 text-[10px] text-slate-500"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-2 truncate text-xs text-muted-foreground">
                            {project.rootPath}
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
                </div>
              </ScrollArea>
            </div>

            {enableManagement ? (
              <div className="border-t border-white/80 px-4 py-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-slate-900">
                    项目管理
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    当前只管理可见项目，不影响本地目录与已有文件。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800"
                    onClick={() => {
                      setOpen(false);
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新建项目
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full border-slate-200/80 bg-white"
                    onClick={handleOpenRename}
                    disabled={!canRenameProject(selectedProject)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    重命名
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full border-rose-200/80 bg-rose-50/80 text-destructive hover:text-destructive"
                    onClick={handleOpenDelete}
                    disabled={!canDeleteProject(selectedProject)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
                {managementHint ? (
                  <p className="mt-3 text-xs text-slate-500">
                    {managementHint}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateProject}
        defaultType={defaultProjectType}
        allowedTypes={enableManagement ? [defaultProjectType] : undefined}
      />

      <Dialog
        open={renameDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isRenaming) {
            setRenameDialogOpen(nextOpen);
            if (!nextOpen) {
              setRenameTargetId(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px] overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,0.98)_100%)] p-0">
          <DialogHeader className="border-b border-white/80 px-6 py-5">
            <DialogTitle>重命名项目</DialogTitle>
            <DialogDescription>
              更新项目名称，不会修改本地目录路径。
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <Input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="输入新的项目名称"
              autoFocus
            />
          </div>
          <DialogFooter className="border-t border-white/80 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200/80 bg-white"
              onClick={() => {
                if (!isRenaming) {
                  setRenameDialogOpen(false);
                  setRenameTargetId(null);
                }
              }}
              disabled={isRenaming}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmRename()}
              disabled={isRenaming}
            >
              {isRenaming ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isDeleting) {
            setDeleteDialogOpen(nextOpen);
            if (!nextOpen) {
              setDeleteTargetId(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] overflow-hidden border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.96)_0%,rgba(255,255,255,0.98)_100%)] p-0">
          <DialogHeader className="border-b border-white/80 px-6 py-5">
            <DialogTitle className="text-destructive">删除项目</DialogTitle>
            <DialogDescription>
              确定要删除项目
              {deleteTarget ? `「${deleteTarget.name}」` : ""}
              吗？
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <div className="rounded-[22px] border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm">
            <p className="font-medium text-destructive">此操作不可恢复</p>
            <p className="mt-1 text-muted-foreground">
              仅删除项目记录，不删除本地目录和已有文件。
            </p>
            </div>
          </div>
          <DialogFooter className="border-t border-white/80 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200/80 bg-white"
              onClick={() => {
                if (!isDeleting) {
                  setDeleteDialogOpen(false);
                  setDeleteTargetId(null);
                }
              }}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "删除项目"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProjectSelector;
