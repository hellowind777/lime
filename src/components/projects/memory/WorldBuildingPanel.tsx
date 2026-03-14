/**
 * 世界观编辑面板
 *
 * 编辑项目的世界观设定
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  WorldBuilding,
  UpdateWorldBuildingRequest,
  getWorldBuilding,
  updateWorldBuilding,
} from "@/lib/api/memory";
import { toast } from "sonner";

interface WorldBuildingPanelProps {
  projectId: string;
}

interface FormData {
  description: string;
  era: string;
  locations: string;
  rules: string;
}

const emptyFormData: FormData = {
  description: "",
  era: "",
  locations: "",
  rules: "",
};

export function WorldBuildingPanel({ projectId }: WorldBuildingPanelProps) {
  const [_worldBuilding, setWorldBuilding] = useState<WorldBuilding | null>(
    null,
  );
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadWorldBuilding = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWorldBuilding(projectId);
      setWorldBuilding(data);
      if (data) {
        setFormData({
          description: data.description || "",
          era: data.era || "",
          locations: data.locations || "",
          rules: data.rules || "",
        });
      } else {
        setFormData(emptyFormData);
      }
      setHasChanges(false);
    } catch (error) {
      console.error("加载世界观失败:", error);
      toast.error("加载世界观失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorldBuilding();
  }, [loadWorldBuilding]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const request: UpdateWorldBuildingRequest = {
        description: formData.description || undefined,
        era: formData.era || undefined,
        locations: formData.locations || undefined,
        rules: formData.rules || undefined,
      };
      const updated = await updateWorldBuilding(projectId, request);
      setWorldBuilding(updated);
      setHasChanges(false);
      toast.success("世界观已保存");
    } catch (error) {
      console.error("保存世界观失败:", error);
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };
  const filledSections = [
    formData.description,
    formData.era,
    formData.locations,
    formData.rules,
  ].filter((value) => value.trim().length > 0).length;
  const locationCount = formData.locations
    .split(/\n|、|,|，/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  const topBadges = [
    hasChanges ? "未保存变更" : "已同步",
    formData.era.trim() || "未设时代背景",
    filledSections > 0 ? `已填写 ${filledSections}/4` : "待填写世界设定",
  ];
  const summaryCards = [
    {
      label: "已填写模块",
      value: `${filledSections}/4`,
      description: "世界观、时代、地点与规则四个核心维度",
    },
    {
      label: "地点线索",
      value: String(locationCount),
      description:
        locationCount > 0 ? "已录入主要地点或场景线索" : "还没有整理地点设定",
    },
    {
      label: "当前状态",
      value: hasChanges ? "待保存" : "已同步",
      description: hasChanges ? "页面中仍有未落库的世界观调整" : "当前内容已与存储同步",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/92 shadow-sm shadow-slate-950/5">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-[30px] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.95)_0%,rgba(255,255,255,0.98)_48%,rgba(236,253,245,0.95)_100%)] shadow-sm shadow-slate-950/5">
        <div className="pointer-events-none absolute -left-14 top-[-44px] h-44 w-44 rounded-full bg-sky-200/25 blur-3xl" />
        <div className="pointer-events-none absolute right-[-52px] top-[-18px] h-44 w-44 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-6 lg:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Globe className="h-4 w-4" />
                <span className="text-sm">项目世界规则板</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  世界观、时代与运行规则
                </div>
                <div className="text-sm leading-6 text-slate-600">
                  先把世界背景和运行逻辑写清，再让角色和大纲在同一套世界事实里推进，减少设定冲突。
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
                  onClick={loadWorldBuilding}
                  disabled={loading}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", loading && "animate-spin")}
                  />
                </Button>
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "保存中..." : "保存"}
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

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">
              核心世界设定
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              先写高层世界背景与时代定位，确保后续内容创作有统一边界。
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="description">世界观描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="描述故事发生的世界背景..."
                rows={6}
              />
              <p className="text-xs leading-5 text-slate-500">
                整体描述故事发生的世界，包括基本设定和核心概念。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="era">时代背景</Label>
              <Textarea
                id="era"
                value={formData.era}
                onChange={(e) => handleChange("era", e.target.value)}
                placeholder="故事发生的时代..."
                rows={4}
              />
              <p className="text-xs leading-5 text-slate-500">
                描述故事发生的时代，如现代、古代、未来等。
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-900">
                地点与场景
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                用地点、城市和关键场景整理故事发生的空间骨架。
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locations">地点设定</Label>
              <Textarea
                id="locations"
                value={formData.locations}
                onChange={(e) => handleChange("locations", e.target.value)}
                placeholder="主要地点和场景..."
                rows={6}
              />
              <p className="text-xs leading-5 text-slate-500">
                描述故事中的主要地点、城市、场景等。
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-sm shadow-slate-950/5">
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-900">
                规则与限制
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                把魔法体系、科技能力或社会制度写成可复用的世界规则。
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules">规则/设定</Label>
              <Textarea
                id="rules"
                value={formData.rules}
                onChange={(e) => handleChange("rules", e.target.value)}
                placeholder="世界运行的规则..."
                rows={6}
              />
              <p className="text-xs leading-5 text-slate-500">
                描述世界运行的规则，如魔法体系、科技水平、社会制度等。
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.98)_100%)] p-5 shadow-sm shadow-slate-950/5">
            <div className="text-sm font-semibold text-slate-900">
              写作建议
            </div>
            <div className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
              <p>世界观描述负责总览，不要把具体剧情事件塞进这里。</p>
              <p>地点设定尽量写场景功能，例如权力中心、冲突边界或资源来源。</p>
              <p>规则区优先写明确限制，这能显著降低后续剧情跑偏。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
