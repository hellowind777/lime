/**
 * 大纲管理面板
 *
 * 显示和编辑项目大纲，支持树形结构和拖拽排序
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  CreateOutlineNodeRequest,
  OutlineNode,
  OutlineTreeNode,
  UpdateOutlineNodeRequest,
  buildOutlineTree,
  createOutlineNode,
  deleteOutlineNode,
  listOutlineNodes,
  updateOutlineNode,
} from "@/lib/api/memory";
import { toast } from "sonner";

interface OutlinePanelProps {
  projectId: string;
}

interface NodeFormData {
  title: string;
  content: string;
  parent_id: string | null;
}

const emptyFormData: NodeFormData = {
  title: "",
  content: "",
  parent_id: null,
};

export function OutlinePanel({ projectId }: OutlinePanelProps) {
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [tree, setTree] = useState<OutlineTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [formData, setFormData] = useState<NodeFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listOutlineNodes(projectId);
      setNodes(list);
      setTree(buildOutlineTree(list));
      // 默认展开所有节点
      const allIds = new Set(list.map((n) => n.id));
      setExpandedNodes(allIds);
    } catch (error) {
      console.error("加载大纲失败:", error);
      toast.error("加载大纲失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleOpenCreate = (parentId: string | null = null) => {
    setEditingNode(null);
    setFormData({ ...emptyFormData, parent_id: parentId });
    setDialogOpen(true);
  };

  const handleOpenEdit = (node: OutlineNode) => {
    setEditingNode(node);
    setFormData({
      title: node.title,
      content: node.content || "",
      parent_id: node.parent_id || null,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("请输入节点标题");
      return;
    }

    setSaving(true);
    try {
      if (editingNode) {
        const request: UpdateOutlineNodeRequest = {
          title: formData.title,
          content: formData.content || undefined,
        };
        await updateOutlineNode(editingNode.id, request);
        toast.success("节点已更新");
      } else {
        const request: CreateOutlineNodeRequest = {
          project_id: projectId,
          parent_id: formData.parent_id || undefined,
          title: formData.title,
          content: formData.content || undefined,
        };
        await createOutlineNode(request);
        toast.success("节点已创建");
      }
      setDialogOpen(false);
      loadNodes();
    } catch (error) {
      console.error("保存节点失败:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: OutlineNode) => {
    // 检查是否有子节点
    const hasChildren = nodes.some((n) => n.parent_id === node.id);
    const message = hasChildren
      ? `确定要删除 "${node.title}" 及其所有子节点吗？`
      : `确定要删除 "${node.title}" 吗？`;

    if (!confirm(message)) {
      return;
    }

    try {
      await deleteOutlineNode(node.id);
      toast.success("节点已删除");
      loadNodes();
    } catch (error) {
      console.error("删除节点失败:", error);
      toast.error("删除失败");
    }
  };

  const handleMoveUp = async (node: OutlineNode) => {
    // 找到同级节点
    const siblings = nodes
      .filter((n) => n.parent_id === node.parent_id)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((n) => n.id === node.id);

    if (index <= 0) return;

    const prevNode = siblings[index - 1];
    try {
      await Promise.all([
        updateOutlineNode(node.id, { order: prevNode.order }),
        updateOutlineNode(prevNode.id, { order: node.order }),
      ]);
      loadNodes();
    } catch (error) {
      console.error("移动节点失败:", error);
      toast.error("移动失败");
    }
  };

  const handleMoveDown = async (node: OutlineNode) => {
    // 找到同级节点
    const siblings = nodes
      .filter((n) => n.parent_id === node.parent_id)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((n) => n.id === node.id);

    if (index >= siblings.length - 1) return;

    const nextNode = siblings[index + 1];
    try {
      await Promise.all([
        updateOutlineNode(node.id, { order: nextNode.order }),
        updateOutlineNode(nextNode.id, { order: node.order }),
      ]);
      loadNodes();
    } catch (error) {
      console.error("移动节点失败:", error);
      toast.error("移动失败");
    }
  };
  const rootNodeCount = nodes.filter((node) => !node.parent_id).length;
  const leafNodeCount = nodes.filter(
    (node) => !nodes.some((candidate) => candidate.parent_id === node.id),
  ).length;
  const topBadges = [
    nodes.length > 0 ? `${nodes.length} 个大纲节点` : "待建立结构骨架",
    rootNodeCount > 0 ? `${rootNodeCount} 个一级节点` : "暂无一级节点",
    expandedNodes.size > 0 ? `已展开 ${expandedNodes.size} 个节点` : "未展开节点",
  ];
  const summaryCards = [
    {
      label: "节点总数",
      value: String(nodes.length),
      description: "当前项目已经建立的结构节点总量",
    },
    {
      label: "一级节点",
      value: String(rootNodeCount),
      description:
        rootNodeCount > 0 ? "顶层章节或结构块已建立" : "还没有主结构节点",
    },
    {
      label: "叶子节点",
      value: String(leafNodeCount),
      description:
        leafNodeCount > 0 ? "已有可继续扩写的末端节点" : "当前还没有叶子节点",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98)_0%,rgba(255,255,255,0.98)_44%,rgba(254,249,195,0.85)_100%)] shadow-sm shadow-slate-950/5">
        <div className="pointer-events-none absolute -left-14 top-[-42px] h-44 w-44 rounded-full bg-slate-200/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-46px] top-[-16px] h-44 w-44 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-6 lg:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-2 text-slate-500">
                <FileText className="h-4 w-4" />
                <span className="text-sm">项目结构骨架</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  大纲层级与章节骨架
                </div>
                <div className="text-sm leading-6 text-slate-600">
                  先把顶层结构和子节点关系搭出来，再让具体内容沿着同一棵树扩写，避免章节散掉。
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {topBadges.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/90 bg-white/85 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:min-w-[420px] xl:items-end">
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadNodes}
                  disabled={loading}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", loading && "animate-spin")}
                  />
                </Button>
                <Button onClick={() => handleOpenCreate(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建节点
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-full">
                {summaryCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-white/90 bg-white/88 p-4 shadow-sm shadow-slate-950/5"
                  >
                    <div className="text-sm font-semibold text-slate-800">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {item.description}
                    </div>
                    <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/92 shadow-sm shadow-slate-950/5">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : tree.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300/80 bg-white/92 px-6 text-center text-slate-500 shadow-sm shadow-slate-950/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-7 w-7" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="text-base font-medium text-slate-800">
              还没有大纲节点
            </div>
            <p className="max-w-md text-sm leading-6">
              先建立一级节点，再逐步补出子节点和节点内容，项目结构会更容易持续扩写。
            </p>
          </div>
          <Button onClick={() => handleOpenCreate(null)} className="mt-5">
            创建第一个节点
          </Button>
        </div>
      ) : (
        <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                结构树
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                支持继续加子节点、调整顺序和修改节点内容；缩进层级会直接反映父子关系。
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-slate-200/80 bg-slate-50 text-slate-600"
            >
              结构视图
            </Badge>
          </div>
          <div className="space-y-3">
            {tree.map((node) => (
              <OutlineTreeItem
                key={node.id}
                node={node}
                level={0}
                expandedNodes={expandedNodes}
                onToggleExpand={toggleExpand}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onAddChild={(parentId) => handleOpenCreate(parentId)}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </div>
        </section>
      )}

      {/* 新建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,0.98)_38%,rgba(255,251,235,0.92)_100%)] p-0">
          <DialogHeader className="border-b border-white/80 px-6 py-5">
            <DialogTitle className="text-left text-lg text-slate-900">
              {editingNode ? "编辑节点" : "新建节点"}
            </DialogTitle>
            <p className="text-sm leading-6 text-slate-600">
              节点标题负责表达结构，节点内容负责补充章节目标、冲突或场景说明。
            </p>
          </DialogHeader>

          <div className="grid max-h-[70vh] gap-5 overflow-auto p-5">
            <div className="rounded-[24px] border border-white/90 bg-white/88 p-5 shadow-sm shadow-slate-950/5">
              <div className="space-y-2">
                <Label htmlFor="title">节点标题 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="输入节点标题"
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="content">节点内容</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="输入节点内容或描述"
                  rows={8}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88)_0%,rgba(255,255,255,0.98)_100%)] p-5 shadow-sm shadow-slate-950/5">
              <div className="text-sm font-semibold text-slate-900">
                录入建议
              </div>
              <div className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
                <p>标题尽量写成章节动作或结构目的，而不是笼统名词。</p>
                <p>节点内容适合记录冲突、目标、节奏点或关键转折。</p>
                <p>子节点应该比父节点更具体，避免层级看起来一样平。</p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-white/80 px-6 py-4">
            <Button
              variant="outline"
              className="border-slate-200/80 bg-white"
              onClick={() => setDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 大纲树节点组件
interface OutlineTreeItemProps {
  node: OutlineTreeNode;
  level: number;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onEdit: (node: OutlineNode) => void;
  onDelete: (node: OutlineNode) => void;
  onAddChild: (parentId: string) => void;
  onMoveUp: (node: OutlineNode) => void;
  onMoveDown: (node: OutlineNode) => void;
}

function OutlineTreeItem({
  node,
  level,
  expandedNodes,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
}: OutlineTreeItemProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "group rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.95)_100%)] p-3 shadow-sm shadow-slate-950/5 transition hover:shadow-md",
          level > 0 && "bg-slate-50/80",
        )}
        style={{ marginLeft: `${level * 18}px` }}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => {
              if (hasChildren) {
                onToggleExpand(node.id);
              }
            }}
            className={cn(
              "mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 transition hover:bg-slate-50",
              !hasChildren && "cursor-default opacity-60",
            )}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <GripVertical className="h-4 w-4" />
            )}
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-slate-200/80 bg-slate-50 text-slate-600">
            <FileText className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">
                {node.title}
              </span>
              <Badge
                variant="outline"
                className="border-slate-200/80 bg-white text-[10px] text-slate-600"
              >
                层级 {level + 1}
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-200/80 bg-white text-[10px] text-slate-600"
              >
                {hasChildren ? `${node.children.length} 个子节点` : "叶子节点"}
              </Badge>
            </div>
            {node.content ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                {node.content}
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-400">
                暂无节点内容，可补充章节目标、冲突或关键说明。
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-slate-500"
              onClick={() => onMoveUp(node)}
              title="上移"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-slate-500"
              onClick={() => onMoveDown(node)}
              title="下移"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-slate-500"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(node)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddChild(node.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加子节点
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(node)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-3">
          {node.children.map((child) => (
            <OutlineTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}
