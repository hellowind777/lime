import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Gauge,
  Link2,
  MessageSquareMore,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  getConversationConfig,
  getHintRoutes,
  getPairingConfig,
  getRateLimitConfig,
  updateConversationConfig,
  updateHintRoutes,
  updatePairingConfig,
  updateRateLimitConfig,
  type ConversationConfig,
  type HintRouteEntry,
  type PairingConfig,
  type RateLimitConfig,
} from "@/lib/api/securityPerformance";

interface SurfacePanelProps {
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

interface FieldBlockProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  enabled: false,
  requests_per_minute: 60,
  window_secs: 60,
};

const DEFAULT_CONVERSATION: ConversationConfig = {
  trim_enabled: false,
  max_messages: 50,
  summary_enabled: false,
};

const DEFAULT_PAIRING: PairingConfig = { enabled: false };

const INPUT_CLASS_NAME =
  "w-full rounded-[16px] border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";
const SECONDARY_BUTTON_CLASS_NAME =
  "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

function SurfacePanel({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: SurfacePanelProps) {
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

function FieldBlock({ label, htmlFor, hint, children }: FieldBlockProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <div className="h-[228px] animate-pulse rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(244,251,248,0.98)_0%,rgba(248,250,252,0.98)_45%,rgba(241,246,255,0.96)_100%)]" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(320px,0.86fr)]">
        <div className="space-y-6">
          <div className="h-[320px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
          <div className="h-[320px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-[220px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
          <div className="h-[220px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500",
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function SecurityPerformanceSettings() {
  const [rateLimit, setRateLimit] = useState<RateLimitConfig>(DEFAULT_RATE_LIMIT);
  const [conversation, setConversation] =
    useState<ConversationConfig>(DEFAULT_CONVERSATION);
  const [hintRoutes, setHintRoutes] = useState<HintRouteEntry[]>([]);
  const [pairing, setPairing] = useState<PairingConfig>(DEFAULT_PAIRING);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rl, conv, routes, pair] = await Promise.all([
        getRateLimitConfig().catch(() => DEFAULT_RATE_LIMIT),
        getConversationConfig().catch(() => DEFAULT_CONVERSATION),
        getHintRoutes().catch(() => []),
        getPairingConfig().catch(() => DEFAULT_PAIRING),
      ]);
      setRateLimit(rl);
      setConversation(conv);
      setHintRoutes(routes);
      setPairing(pair);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveRateLimit = async (config: RateLimitConfig) => {
    setRateLimit(config);
    try {
      await updateRateLimitConfig(config);
      toast.success("速率限制已更新");
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : error}`);
    }
  };

  const saveConversation = async (config: ConversationConfig) => {
    setConversation(config);
    try {
      await updateConversationConfig(config);
      toast.success("对话管理已更新");
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : error}`);
    }
  };

  const saveHintRoutes = async (routes: HintRouteEntry[]) => {
    setHintRoutes(routes);
    try {
      await updateHintRoutes(routes);
      toast.success("提示路由已更新");
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : error}`);
    }
  };

  const savePairing = async (config: PairingConfig) => {
    setPairing(config);
    try {
      await updatePairingConfig(config);
      toast.success("配对认证已更新");
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : error}`);
    }
  };

  const summary = useMemo(() => {
    const enabledPolicies = [
      rateLimit.enabled,
      conversation.trim_enabled,
      conversation.summary_enabled,
      pairing.enabled,
    ].filter(Boolean).length;

    return {
      enabledPolicies,
      routeCount: hintRoutes.length,
      rateLimitLabel: rateLimit.enabled
        ? `${rateLimit.requests_per_minute}/分`
        : "未启用",
      conversationLabel: conversation.trim_enabled
        ? `${conversation.max_messages} 条`
        : "未修剪",
    };
  }, [
    conversation.max_messages,
    conversation.summary_enabled,
    conversation.trim_enabled,
    hintRoutes.length,
    pairing.enabled,
    rateLimit.enabled,
    rateLimit.requests_per_minute,
  ]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(244,251,248,0.98)_0%,rgba(248,250,252,0.98)_45%,rgba(241,246,255,0.96)_100%)] shadow-sm shadow-slate-950/5">
        <div className="pointer-events-none absolute -left-20 top-[-72px] h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="pointer-events-none absolute right-[-76px] top-[-24px] h-56 w-56 rounded-full bg-sky-200/28 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 lg:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <div className="max-w-3xl space-y-5">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-emerald-700 shadow-sm">
                SECURITY CONTROL
              </span>
              <div className="space-y-2">
                <p className="text-[28px] font-semibold tracking-tight text-slate-900">
                  把安全开关、对话约束和提示路由放到同一个治理面板里
                </p>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  这里的配置以“自动保存”为主，适合快速调整防护强度和对话运行策略。
                  重点不在堆更多表单，而是在一眼看清当前哪些保护已经打开。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  开关和下拉选择会立即保存
                </span>
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  提示路由输入框在失焦后保存
                </span>
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  适合桌面端持续调参
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 xl:content-start">
              <SummaryStat
                label="已启用策略"
                value={summary.enabledPolicies.toString()}
                description="速率限制、对话管理和配对认证中当前已打开的保护项数量。"
              />
              <SummaryStat
                label="提示路由"
                value={summary.routeCount.toString()}
                description="当前按关键词进行模型路由的规则数量。"
              />
              <SummaryStat
                label="速率限制"
                value={summary.rateLimitLabel}
                description="如果已启用，这里显示当前每分钟的请求阈值。"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[24px] border border-white/90 bg-white/80 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  active={rateLimit.enabled}
                  activeLabel="速率限制已启用"
                  inactiveLabel="速率限制未启用"
                />
                <StatusPill
                  active={pairing.enabled}
                  activeLabel="配对认证已启用"
                  inactiveLabel="配对认证未启用"
                />
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                  对话修剪 {summary.conversationLabel}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                建议先打开速率限制和配对认证，再根据实际上下文长度调节对话修剪。
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadAll()}
              className={SECONDARY_BUTTON_CLASS_NAME}
            >
              <RefreshCw className="h-4 w-4" />
              重新加载
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(320px,0.86fr)]">
        <div className="space-y-6">
          <SurfacePanel
            icon={Gauge}
            title="速率限制"
            description="限制 API 请求频率，减少滥用或异常高频请求带来的压力。"
            aside={
              <StatusPill
                active={rateLimit.enabled}
                activeLabel="已启用"
                inactiveLabel="未启用"
              />
            }
          >
            <div className="space-y-4">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      启用速率限制
                    </p>
                    <p className="text-sm leading-6 text-slate-500">
                      超出阈值后可提前拦截请求，适合公开入口或多人共享环境。
                    </p>
                  </div>
                  <Switch
                    aria-label="启用速率限制"
                    checked={rateLimit.enabled}
                    onCheckedChange={(checked) =>
                      void saveRateLimit({ ...rateLimit, enabled: checked })
                    }
                  />
                </div>
              </div>

              {rateLimit.enabled ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-[22px] border border-slate-200/80 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          每分钟请求数
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          调高能减少误拦截，调低能更积极地控制频率。
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {rateLimit.requests_per_minute}
                      </span>
                    </div>
                    <div className="mt-5 px-1">
                      <Slider
                        aria-label="每分钟请求数"
                        value={[rateLimit.requests_per_minute]}
                        min={10}
                        max={200}
                        step={10}
                        onValueChange={([value]) =>
                          setRateLimit({
                            ...rateLimit,
                            requests_per_minute: value,
                          })
                        }
                        onValueCommit={([value]) =>
                          void saveRateLimit({
                            ...rateLimit,
                            requests_per_minute: value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200/80 bg-white p-4">
                    <FieldBlock
                      label="窗口大小"
                      htmlFor="security-performance-rate-window"
                      hint="窗口越大，限流判断越平滑，但恢复速度也更慢。"
                    >
                      <select
                        id="security-performance-rate-window"
                        value={String(rateLimit.window_secs)}
                        onChange={(event) =>
                          void saveRateLimit({
                            ...rateLimit,
                            window_secs: Number(event.target.value),
                          })
                        }
                        className={INPUT_CLASS_NAME}
                      >
                        <option value="30">30 秒</option>
                        <option value="60">60 秒</option>
                        <option value="120">120 秒</option>
                      </select>
                    </FieldBlock>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    当前未启用速率限制
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    如果当前服务对外暴露或多人共享，建议先打开限流，再逐步微调阈值。
                  </p>
                </div>
              )}
            </div>
          </SurfacePanel>

          <SurfacePanel
            icon={MessageSquareMore}
            title="对话管理"
            description="控制上下文裁剪和摘要策略，减少长对话拖慢响应或增加不必要成本。"
          >
            <div className="space-y-4">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      消息修剪
                    </p>
                    <p className="text-sm leading-6 text-slate-500">
                      自动裁掉超出上限的历史消息，避免上下文无限增长。
                    </p>
                  </div>
                  <Switch
                    aria-label="启用消息修剪"
                    checked={conversation.trim_enabled}
                    onCheckedChange={(checked) =>
                      void saveConversation({
                        ...conversation,
                        trim_enabled: checked,
                      })
                    }
                  />
                </div>
              </div>

              {conversation.trim_enabled ? (
                <div className="rounded-[22px] border border-slate-200/80 bg-white p-4">
                  <FieldBlock
                    label="最大消息数"
                    htmlFor="security-performance-max-messages"
                    hint="输入完成后离开焦点即保存。建议根据模型上下文容量调节。"
                  >
                    <input
                      id="security-performance-max-messages"
                      type="number"
                      min={10}
                      max={500}
                      value={conversation.max_messages}
                      onChange={(event) =>
                        setConversation({
                          ...conversation,
                          max_messages:
                            Number.parseInt(event.target.value, 10) || 50,
                        })
                      }
                      onBlur={() => void saveConversation(conversation)}
                      className={INPUT_CLASS_NAME}
                    />
                  </FieldBlock>
                </div>
              ) : null}

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      摘要生成
                    </p>
                    <p className="text-sm leading-6 text-slate-500">
                      在修剪时自动生成摘要，帮助后续轮次保留关键上下文。
                    </p>
                  </div>
                  <Switch
                    aria-label="启用摘要生成"
                    checked={conversation.summary_enabled}
                    onCheckedChange={(checked) =>
                      void saveConversation({
                        ...conversation,
                        summary_enabled: checked,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel
            icon={Route}
            title="提示路由"
            description="按关键词把请求定向到指定 Provider 和模型，适合做轻量规则分流。"
            aside={
              <button
                type="button"
                onClick={() =>
                  setHintRoutes([
                    ...hintRoutes,
                    { hint: "", provider: "", model: "" },
                  ])
                }
                className={SECONDARY_BUTTON_CLASS_NAME}
              >
                <Plus className="h-4 w-4" />
                添加规则
              </button>
            }
          >
            <div className="space-y-4">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4 text-sm leading-6 text-slate-500">
                输入框在失焦后自动保存，删除规则会立即同步。适合把稳定命中的关键词放在这里，
                不适合维护大量复杂分支逻辑。
              </div>

              {hintRoutes.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    暂无提示路由规则
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    点击“添加规则”创建简单的关键词分流策略。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hintRoutes.map((route, index) => (
                    <article
                      key={`hint-route-${index}`}
                      className="rounded-[22px] border border-slate-200/80 bg-white p-4"
                    >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_56px]">
                        <FieldBlock
                          label="关键词"
                          htmlFor={`security-performance-route-hint-${index}`}
                        >
                          <input
                            id={`security-performance-route-hint-${index}`}
                            type="text"
                            value={route.hint}
                            placeholder="例如 translate"
                            onChange={(event) => {
                              const next = [...hintRoutes];
                              next[index] = {
                                ...route,
                                hint: event.target.value,
                              };
                              setHintRoutes(next);
                            }}
                            onBlur={() => void saveHintRoutes(hintRoutes)}
                            className={INPUT_CLASS_NAME}
                          />
                        </FieldBlock>

                        <FieldBlock
                          label="Provider"
                          htmlFor={`security-performance-route-provider-${index}`}
                        >
                          <input
                            id={`security-performance-route-provider-${index}`}
                            type="text"
                            value={route.provider}
                            placeholder="例如 openai"
                            onChange={(event) => {
                              const next = [...hintRoutes];
                              next[index] = {
                                ...route,
                                provider: event.target.value,
                              };
                              setHintRoutes(next);
                            }}
                            onBlur={() => void saveHintRoutes(hintRoutes)}
                            className={INPUT_CLASS_NAME}
                          />
                        </FieldBlock>

                        <FieldBlock
                          label="模型"
                          htmlFor={`security-performance-route-model-${index}`}
                        >
                          <input
                            id={`security-performance-route-model-${index}`}
                            type="text"
                            value={route.model}
                            placeholder="例如 gpt-4.1"
                            onChange={(event) => {
                              const next = [...hintRoutes];
                              next[index] = {
                                ...route,
                                model: event.target.value,
                              };
                              setHintRoutes(next);
                            }}
                            onBlur={() => void saveHintRoutes(hintRoutes)}
                            className={INPUT_CLASS_NAME}
                          />
                        </FieldBlock>

                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              void saveHintRoutes(
                                hintRoutes.filter((_, idx) => idx !== index),
                              )
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            title="删除规则"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </SurfacePanel>
        </div>

        <div className="space-y-6">
          <SurfacePanel
            icon={ShieldCheck}
            title="配对认证"
            description="对客户端接入增加额外认证步骤，适合共享或受控环境。"
            aside={
              <StatusPill
                active={pairing.enabled}
                activeLabel="已启用"
                inactiveLabel="未启用"
              />
            }
          >
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    启用客户端配对认证
                  </p>
                  <p className="text-sm leading-6 text-slate-500">
                    开启后，未完成配对的客户端不能直接接入，能显著降低误接入风险。
                  </p>
                </div>
                <Switch
                  aria-label="启用配对认证"
                  checked={pairing.enabled}
                  onCheckedChange={(checked) =>
                    void savePairing({ enabled: checked })
                  }
                />
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel
            icon={Sparkles}
            title="治理建议"
            description="用最少的开关覆盖最常见的安全和性能问题，不引入多余复杂度。"
          >
            <div className="space-y-3">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Gauge className="h-4 w-4 text-sky-600" />
                  共享入口优先打开限流
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  如果服务提供给多个终端或团队成员，先开启速率限制，再观察是否需要上调阈值。
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageSquareMore className="h-4 w-4 text-sky-600" />
                  长对话场景打开修剪
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  对连续长会话工作流，消息修剪和摘要生成可以一起启用，减轻上下文膨胀。
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Link2 className="h-4 w-4 text-sky-600" />
                  提示路由保持简单
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  更适合稳定关键词和固定模型映射。复杂策略应放到更专门的调度层，而不是继续堆表单。
                </p>
              </div>
            </div>
          </SurfacePanel>
        </div>
      </div>
    </div>
  );
}
