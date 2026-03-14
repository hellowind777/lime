/**
 * 快捷键设置页面
 *
 * 汇总当前版本已实现的快捷键，并标明作用范围与配置来源。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Keyboard,
  Mic,
  ScanText,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getExperimentalConfig } from "@/lib/api/experimentalFeatures";
import {
  getVoiceInputConfig,
  type VoiceInputConfig,
} from "@/lib/api/asrProvider";

interface HotkeyConfig {
  id: string;
  label: string;
  description: string;
  keys: string[];
  enabled: boolean;
  source: string;
  scope: "global" | "local";
}

interface HotkeyState {
  globalHotkeys: HotkeyConfig[];
  localHotkeys: HotkeyConfig[];
}

interface HotkeySectionMeta {
  title: string;
  description: string;
  hotkeys: HotkeyConfig[];
}

interface HotkeyPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}

interface SummaryStatProps {
  label: string;
  value: string;
  description: string;
}

const HOTKEY_ICON_MAP: Record<string, LucideIcon> = {
  "screenshot-chat": ScanText,
  "voice-input": Mic,
  "voice-translate": Sparkles,
  "terminal-search": TerminalSquare,
  "terminal-font-plus": TerminalSquare,
  "terminal-font-minus": TerminalSquare,
  "terminal-font-reset": TerminalSquare,
};

function formatShortcutKeys(shortcut?: string): string[] {
  if (!shortcut?.trim()) {
    return ["未设置"];
  }

  const map: Record<string, string> = {
    CommandOrControl: "⌘/Ctrl",
    Command: "⌘",
    Control: "Ctrl",
    Ctrl: "Ctrl",
    Alt: "Alt",
    Option: "⌥",
    Shift: "⇧",
    Super: "Super",
    Space: "Space",
  };

  const keys = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => map[part] ?? part);

  return keys.length > 0 ? keys : ["未设置"];
}

function buildHotkeys(
  screenshotEnabled: boolean,
  screenshotShortcut: string | undefined,
  voiceConfig: Partial<VoiceInputConfig>,
): HotkeyState {
  const voiceShortcut = formatShortcutKeys(voiceConfig.shortcut);
  const translateShortcut = formatShortcutKeys(voiceConfig.translate_shortcut);
  const voiceEnabled = voiceConfig.enabled ?? false;
  const translateEnabled =
    voiceEnabled && Boolean(voiceConfig.translate_shortcut?.trim());
  const translateInstructionId = voiceConfig.translate_instruction_id?.trim();

  const globalHotkeys: HotkeyConfig[] = [
    {
      id: "screenshot-chat",
      label: "截图对话",
      description: "触发全局截图并打开截图对话窗口。",
      keys: formatShortcutKeys(screenshotShortcut),
      enabled: screenshotEnabled,
      source: "实验功能 → 截图对话",
      scope: "global",
    },
    {
      id: "voice-input",
      label: "语音输入",
      description: "按下开始录音，松开后识别并输出。",
      keys: voiceShortcut,
      enabled: voiceEnabled,
      source: "语音服务",
      scope: "global",
    },
    {
      id: "voice-translate",
      label: "语音翻译模式",
      description: "独立快捷键触发语音识别并执行翻译指令。",
      keys: translateShortcut,
      enabled: translateEnabled,
      source: translateInstructionId
        ? `语音服务 → 指令 ${translateInstructionId}`
        : "语音服务 → 翻译指令未绑定",
      scope: "global",
    },
  ];

  const localHotkeys: HotkeyConfig[] = [
    {
      id: "terminal-search",
      label: "终端搜索",
      description: "在终端页面打开搜索框。",
      keys: ["⌘/Ctrl", "F"],
      enabled: true,
      source: "终端页面",
      scope: "local",
    },
    {
      id: "terminal-font-plus",
      label: "终端字体放大",
      description: "在终端页面增大字体。",
      keys: ["⌘/Ctrl", "+"],
      enabled: true,
      source: "终端页面",
      scope: "local",
    },
    {
      id: "terminal-font-minus",
      label: "终端字体缩小",
      description: "在终端页面减小字体。",
      keys: ["⌘/Ctrl", "-"],
      enabled: true,
      source: "终端页面",
      scope: "local",
    },
    {
      id: "terminal-font-reset",
      label: "终端字体重置",
      description: "在终端页面重置字体大小。",
      keys: ["⌘/Ctrl", "0"],
      enabled: true,
      source: "终端页面",
      scope: "local",
    },
  ];

  return { globalHotkeys, localHotkeys };
}

function HotkeyPanel({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: HotkeyPanelProps) {
  return (
    <article className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-950/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-sky-600" />
            {title}
          </div>
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {aside ? (
          <div className="flex flex-wrap items-center gap-2">{aside}</div>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </article>
  );
}

function SummaryStat({ label, value, description }: SummaryStatProps) {
  return (
    <div className="rounded-[22px] border border-white/90 bg-white/88 p-4 shadow-sm">
      <p className="text-xs font-medium tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <div className="h-[228px] animate-pulse rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(244,251,248,0.98)_0%,rgba(248,250,252,0.98)_45%,rgba(241,246,255,0.96)_100%)]" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[360px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
        <div className="h-[360px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
      </div>
    </div>
  );
}

function HotkeyCard({ hotkey }: { hotkey: HotkeyConfig }) {
  const Icon = HOTKEY_ICON_MAP[hotkey.id] || Keyboard;

  return (
    <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {hotkey.label}
              </p>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  hotkey.enabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-500",
                )}
              >
                {hotkey.enabled ? "已启用" : "未启用"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                {hotkey.scope === "global" ? "全局" : "页面内"}
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-500">
              {hotkey.description}
            </p>
            <p className="text-xs leading-5 text-slate-400">{hotkey.source}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:max-w-[280px] lg:justify-end">
          {hotkey.keys.map((key) => (
            <span
              key={`${hotkey.id}-${key}`}
              className={cn(
                "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[14px] border px-3 text-sm shadow-sm",
                key === "未设置"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {key}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function HotkeySection({ title, description, hotkeys }: HotkeySectionMeta) {
  const enabledCount = hotkeys.filter((item) => item.enabled).length;

  return (
    <HotkeyPanel
      icon={title === "全局快捷键" ? Sparkles : TerminalSquare}
      title={title}
      description={description}
      aside={
        <>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            共 {hotkeys.length} 项
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            已启用 {enabledCount} 项
          </span>
        </>
      }
    >
      <div className="space-y-3">
        {hotkeys.map((hotkey) => (
          <HotkeyCard key={hotkey.id} hotkey={hotkey} />
        ))}
      </div>
    </HotkeyPanel>
  );
}

export function HotkeysSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalHotkeys, setGlobalHotkeys] = useState<HotkeyConfig[]>([]);
  const [localHotkeys, setLocalHotkeys] = useState<HotkeyConfig[]>([]);

  const loadHotkeys = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [experimentalConfig, voiceConfig] = await Promise.all([
        getExperimentalConfig(),
        getVoiceInputConfig(),
      ]);

      const built = buildHotkeys(
        experimentalConfig?.screenshot_chat?.enabled ?? false,
        experimentalConfig?.screenshot_chat?.shortcut,
        voiceConfig,
      );

      setGlobalHotkeys(built.globalHotkeys);
      setLocalHotkeys(built.localHotkeys);
    } catch (loadError) {
      console.error("加载快捷键信息失败:", loadError);
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHotkeys();
  }, [loadHotkeys]);

  const summary = useMemo(() => {
    const allHotkeys = [...globalHotkeys, ...localHotkeys];
    const enabledHotkeys = allHotkeys.filter((item) => item.enabled);

    return {
      total: allHotkeys.length,
      enabled: enabledHotkeys.length,
      disabled: allHotkeys.length - enabledHotkeys.length,
      globalEnabled: globalHotkeys.filter((item) => item.enabled).length,
      localEnabled: localHotkeys.filter((item) => item.enabled).length,
    };
  }, [globalHotkeys, localHotkeys]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 pb-8">
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-[20px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 shadow-sm shadow-slate-950/5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>加载快捷键失败：{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadHotkeys()}
            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
          >
            重试
          </button>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[30px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(244,251,248,0.98)_0%,rgba(248,250,252,0.98)_45%,rgba(241,246,255,0.96)_100%)] shadow-sm shadow-slate-950/5">
        <div className="pointer-events-none absolute -left-20 top-[-72px] h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="pointer-events-none absolute right-[-76px] top-[-24px] h-56 w-56 rounded-full bg-sky-200/28 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 lg:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] xl:items-stretch">
            <div className="max-w-3xl space-y-5">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-emerald-700 shadow-sm">
                HOTKEY MAP
              </span>
              <div className="space-y-2">
                <p className="text-[28px] font-semibold tracking-tight text-slate-900">
                  把全局快捷键和页面内快捷键放到同一个清单里查看
                </p>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  这里展示当前版本已经实现的快捷键，包含作用范围、来源和启用状态。
                  在 macOS 中会显示 <span className="font-medium">⌘</span>， 在
                  Windows 中对应 <span className="font-medium">Ctrl</span>。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  全局快捷键会随语音服务和实验功能配置同步更新
                </span>
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  页面内快捷键当前主要作用于终端页面
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 xl:content-start">
              <SummaryStat
                label="快捷键总数"
                value={summary.total.toString()}
                description="当前设置页已归档的快捷键数量。"
              />
              <SummaryStat
                label="已启用"
                value={summary.enabled.toString()}
                description="当前可直接使用的快捷键数量。"
              />
              <SummaryStat
                label="待配置"
                value={summary.disabled.toString()}
                description="依赖功能开关、权限或尚未设置快捷键的项目。"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(320px,0.86fr)]">
        <div className="space-y-6">
          <HotkeySection
            title="全局快捷键"
            description="可在任意页面触发，但依赖语音服务或实验功能已开启。"
            hotkeys={globalHotkeys}
          />
          <HotkeySection
            title="页面内快捷键"
            description="仅在对应页面激活，目前主要覆盖终端场景。"
            hotkeys={localHotkeys}
          />
        </div>

        <div className="space-y-6">
          <HotkeyPanel
            icon={Keyboard}
            title="使用提示"
            description="先确认作用范围，再去对应模块启用功能，避免以为快捷键失效。"
          >
            <div className="space-y-3">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  跨平台差异
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  列表里的{" "}
                  <span className="font-medium text-slate-700">⌘/Ctrl</span>
                  表示 macOS 使用 Command，Windows 使用 Ctrl。
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  全局快捷键生效条件
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  截图对话依赖实验功能配置，语音输入和翻译模式依赖语音服务已经启用，
                  且系统允许应用注册全局快捷键。
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  页面内快捷键
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  终端类快捷键只在终端页面聚焦时有效，不会影响其他工作区输入体验。
                </p>
              </div>
            </div>
          </HotkeyPanel>

          <HotkeyPanel
            icon={Sparkles}
            title="快捷状态概览"
            description="帮助你快速判断当前哪些快捷键可直接用、哪些还需要配置。"
          >
            <div className="grid gap-3">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    全局快捷键
                  </p>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    已启用 {summary.globalEnabled} / {globalHotkeys.length}
                  </span>
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    页面内快捷键
                  </p>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    已启用 {summary.localEnabled} / {localHotkeys.length}
                  </span>
                </div>
              </div>
            </div>
          </HotkeyPanel>
        </div>
      </div>
    </div>
  );
}

export default HotkeysSettings;
