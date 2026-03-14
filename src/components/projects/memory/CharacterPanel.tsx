/**
 * 角色管理面板
 *
 * 显示角色卡片列表，支持新建、编辑、删除角色
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Edit2,
  Trash2,
  Star,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Character,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "@/lib/api/memory";
import { toast } from "sonner";

interface CharacterPanelProps {
  projectId: string;
}

interface CharacterFormData {
  name: string;
  aliases: string;
  description: string;
  personality: string;
  background: string;
  appearance: string;
  is_main: boolean;
}

const emptyFormData: CharacterFormData = {
  name: "",
  aliases: "",
  description: "",
  personality: "",
  background: "",
  appearance: "",
  is_main: false,
};

export function CharacterPanel({ projectId }: CharacterPanelProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  );
  const [formData, setFormData] = useState<CharacterFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCharacters(projectId);
      setCharacters(list);
    } catch (error) {
      console.error("加载角色失败:", error);
      toast.error("加载角色失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleOpenCreate = () => {
    setEditingCharacter(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (character: Character) => {
    setEditingCharacter(character);
    setFormData({
      name: character.name,
      aliases: character.aliases.join(", "),
      description: character.description || "",
      personality: character.personality || "",
      background: character.background || "",
      appearance: character.appearance || "",
      is_main: character.is_main,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("请输入角色名称");
      return;
    }

    setSaving(true);
    try {
      const aliases = formData.aliases
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingCharacter) {
        const request: UpdateCharacterRequest = {
          name: formData.name,
          aliases,
          description: formData.description || undefined,
          personality: formData.personality || undefined,
          background: formData.background || undefined,
          appearance: formData.appearance || undefined,
          is_main: formData.is_main,
        };
        await updateCharacter(editingCharacter.id, request);
        toast.success("角色已更新");
      } else {
        const request: CreateCharacterRequest = {
          project_id: projectId,
          name: formData.name,
          aliases,
          description: formData.description || undefined,
          personality: formData.personality || undefined,
          background: formData.background || undefined,
          appearance: formData.appearance || undefined,
          is_main: formData.is_main,
        };
        await createCharacter(request);
        toast.success("角色已创建");
      }
      setDialogOpen(false);
      loadCharacters();
    } catch (error) {
      console.error("保存角色失败:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (character: Character) => {
    if (!confirm(`确定要删除角色 "${character.name}" 吗？`)) {
      return;
    }

    try {
      await deleteCharacter(character.id);
      toast.success("角色已删除");
      loadCharacters();
    } catch (error) {
      console.error("删除角色失败:", error);
      toast.error("删除失败");
    }
  };

  // 分离主角和配角
  const mainCharacters = characters.filter((c) => c.is_main);
  const sideCharacters = characters.filter((c) => !c.is_main);
  const describedCharacters = characters.filter((c) =>
    Boolean(c.description?.trim()),
  ).length;
  const summaryCards = [
    {
      label: "角色总数",
      value: String(characters.length),
      description: "项目内已经建立的角色资料卡",
    },
    {
      label: "主要角色",
      value: String(mainCharacters.length),
      description:
        mainCharacters.length > 0 ? "剧情主线已有核心角色" : "还没有标记主要角色",
    },
    {
      label: "已写简介",
      value: String(describedCharacters),
      description:
        describedCharacters > 0 ? "已有角色具备基础人物描述" : "建议先补角色简介与定位",
    },
  ];
  const topBadges = [
    characters.length > 0 ? "角色库已建立" : "待建立角色库",
    mainCharacters.length > 0 ? `${mainCharacters.length} 位主角` : "暂无主角",
    sideCharacters.length > 0 ? `${sideCharacters.length} 位配角` : "暂无配角",
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-[30px] border border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.95)_0%,rgba(255,255,255,0.98)_42%,rgba(239,246,255,0.96)_100%)] shadow-sm shadow-slate-950/5">
        <div className="pointer-events-none absolute -left-14 top-[-44px] h-44 w-44 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-52px] top-[-16px] h-44 w-44 rounded-full bg-sky-200/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-6 lg:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-2 text-slate-500">
                <User className="h-4 w-4" />
                <span className="text-sm">项目角色系统</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  角色、关系与叙事职能
                </div>
                <div className="text-sm leading-6 text-slate-600">
                  先建立角色档案，再逐步补全性格、背景与外貌，避免人物信息散落在章节正文里。
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
                  onClick={loadCharacters}
                  disabled={loading}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", loading && "animate-spin")}
                  />
                </Button>
                <Button onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建角色
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
      ) : characters.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300/80 bg-white/92 px-6 text-center text-slate-500 shadow-sm shadow-slate-950/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <User className="h-7 w-7" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="text-base font-medium text-slate-800">
              还没有角色档案
            </div>
            <p className="max-w-md text-sm leading-6">
              先创建主要角色，再把配角、别名和人物设定逐步补齐，后续章节创作会更稳定。
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="mt-5">
            创建第一个角色
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {mainCharacters.length > 0 && (
            <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Star className="h-4 w-4 text-amber-500" />
                    主要角色
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    承担主线叙事、关键冲突或视角输出的核心人物。
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-200/80 bg-amber-50 text-amber-700"
                >
                  {mainCharacters.length} 位
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {mainCharacters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    onEdit={() => handleOpenEdit(character)}
                    onDelete={() => handleDelete(character)}
                  />
                ))}
              </div>
            </section>
          )}

          {sideCharacters.length > 0 && (
            <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <User className="h-4 w-4 text-sky-500" />
                    次要角色
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    补充世界关系、推进局部情节和丰富人物网络的辅助角色。
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-sky-200/80 bg-sky-50 text-sky-700"
                >
                  {sideCharacters.length} 位
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sideCharacters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    onEdit={() => handleOpenEdit(character)}
                    onDelete={() => handleDelete(character)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 新建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.92)_0%,rgba(255,255,255,0.98)_34%,rgba(248,250,252,0.96)_100%)] p-0">
          <DialogHeader className="border-b border-white/80 px-6 py-5">
            <DialogTitle className="text-left text-lg text-slate-900">
              {editingCharacter ? "编辑角色" : "新建角色"}
            </DialogTitle>
            <p className="text-sm leading-6 text-slate-600">
              用统一的人物卡结构补齐名称、人物定位与背景信息，后续章节与风格生成会直接消费这些事实。
            </p>
          </DialogHeader>

          <div className="grid max-h-[72vh] gap-5 overflow-auto p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-white/90 bg-white/88 p-5 shadow-sm shadow-slate-950/5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">角色名称 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="输入角色名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aliases">别名（逗号分隔）</Label>
                    <Input
                      id="aliases"
                      value={formData.aliases}
                      onChange={(e) =>
                        setFormData({ ...formData, aliases: e.target.value })
                      }
                      placeholder="小明, 阿明"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        角色定位
                      </div>
                      <div className="text-xs leading-5 text-slate-500">
                        主要角色通常会出现在主线冲突、关键视角或章节推进中。
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_main"
                        checked={formData.is_main}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_main: checked })
                        }
                      />
                      <Label htmlFor="is_main">主要角色</Label>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="description">角色简介</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="简要描述这个角色"
                    rows={3}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="background">背景故事</Label>
                  <Textarea
                    id="background"
                    value={formData.background}
                    onChange={(e) =>
                      setFormData({ ...formData, background: e.target.value })
                    }
                    placeholder="角色的背景故事"
                    rows={5}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-white/90 bg-white/88 p-5 shadow-sm shadow-slate-950/5">
                <div className="space-y-2">
                  <Label htmlFor="personality">性格特点</Label>
                  <Textarea
                    id="personality"
                    value={formData.personality}
                    onChange={(e) =>
                      setFormData({ ...formData, personality: e.target.value })
                    }
                    placeholder="描述角色的性格特点"
                    rows={4}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="appearance">外貌描述</Label>
                  <Textarea
                    id="appearance"
                    value={formData.appearance}
                    onChange={(e) =>
                      setFormData({ ...formData, appearance: e.target.value })
                    }
                    placeholder="角色的外貌特征"
                    rows={4}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.98)_100%)] p-5 shadow-sm shadow-slate-950/5">
                <div className="text-sm font-semibold text-slate-900">
                  录入建议
                </div>
                <div className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
                  <p>角色简介写清人物在故事中的作用，而不是只写情绪词。</p>
                  <p>背景故事尽量保留事实信息，避免把剧情评价混进角色档案。</p>
                  <p>别名用于统一称呼和检索，建议控制在常用称呼范围内。</p>
                </div>
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

// 角色卡片组件
interface CharacterCardProps {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

function CharacterCard({ character, onEdit, onDelete }: CharacterCardProps) {
  return (
    <div className="group h-full rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-4 shadow-sm shadow-slate-950/5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-slate-200/80 bg-slate-50 text-slate-600">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="flex items-center gap-1 text-sm font-semibold text-slate-900">
              {character.name}
              {character.is_main && (
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              )}
            </h4>
            {character.aliases.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {character.aliases.slice(0, 3).map((alias) => (
                  <Badge
                    key={alias}
                    variant="outline"
                    className="border-slate-200/80 bg-white text-[10px] text-slate-600"
                  >
                    {alias}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
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
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {character.description && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
          {character.description}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {character.personality && (
          <div className="rounded-[18px] border border-slate-200/80 bg-white/90 px-3 py-2">
            <span className="text-[11px] font-medium text-slate-400">性格</span>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
              {character.personality}
            </p>
          </div>
        )}
        {character.background && (
          <div className="rounded-[18px] border border-slate-200/80 bg-white/90 px-3 py-2">
            <span className="text-[11px] font-medium text-slate-400">背景</span>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
              {character.background}
            </p>
          </div>
        )}
        {character.appearance && (
          <div className="rounded-[18px] border border-slate-200/80 bg-white/90 px-3 py-2">
            <span className="text-[11px] font-medium text-slate-400">外貌</span>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
              {character.appearance}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
