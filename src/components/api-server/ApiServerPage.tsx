import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Globe2,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { LogsTab } from "./LogsTab";
import { ProviderIcon } from "@/icons/providers";
import { cn } from "@/lib/utils";
import { reloadCredentials } from "@/lib/api/providerRuntime";
import { revealPathInFinder } from "@/lib/api/fileSystem";
import {
  getNetworkInfo,
  testApi,
  type NetworkInfo,
  type TestResult,
} from "@/lib/api/serverTools";
import {
  getConfig,
  getDefaultProvider,
  saveConfig,
  setDefaultProvider,
  updateProviderEnvVars,
  type Config,
} from "@/lib/api/appConfig";
import {
  exportSupportBundle,
  getServerDiagnostics,
  getServerStatus,
  startServer,
  stopServer,
  type ServerDiagnostics,
  type ServerStatus,
  type SupportBundleExportResult,
} from "@/lib/api/serverRuntime";
import { providerPoolApi, ProviderPoolOverview } from "@/lib/api/providerPool";
import {
  apiKeyProviderApi,
  ProviderWithKeysDisplay,
} from "@/lib/api/apiKeyProvider";
import {
  fetchProviderModelsAuto,
  getModelRegistry,
  getModelsForProvider,
  getProviderAliasConfig,
} from "@/lib/api/modelRegistry";
import type { EnhancedModelMetadata } from "@/lib/types/modelRegistry";

interface TestState {
  endpoint: string;
  status: "idle" | "loading" | "success" | "error";
  response?: string;
  time?: number;
  httpStatus?: number;
  responseHeaders?: Record<string, string>;
}

type TabId = "server" | "logs";

interface ApiServerPageProps {
  hideHeader?: boolean;
}

type GatewayMode = "local" | "lan";

interface GatewayPanelProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface GatewayStatCardProps {
  label: string;
  value: string;
  description: string;
}

const PANEL_CLASS_NAME =
  "rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-950/5";
const INPUT_CLASS_NAME =
  "h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:text-slate-400";
const BUTTON_SECONDARY_CLASS_NAME =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_PRIMARY_CLASS_NAME =
  "inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

function GatewayPanel({
  icon: Icon,
  title,
  description,
  aside,
  children,
  className,
}: GatewayPanelProps) {
  return (
    <article className={cn(PANEL_CLASS_NAME, className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-sky-600" />
            {title}
          </div>
          {description ? (
            <p className="text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {aside ? (
          <div className="flex flex-wrap items-center gap-2">{aside}</div>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </article>
  );
}

function GatewayStatCard({ label, value, description }: GatewayStatCardProps) {
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

const getGatewayModeByHost = (host?: string | null): GatewayMode => {
  const normalized = (host || "").trim().toLowerCase();
  if (!normalized) return "local";
  if (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  ) {
    return "local";
  }
  return "lan";
};

// Provider 到 API 类型的映射
type ApiType = "openai" | "anthropic" | "gemini";
const getProviderApiType = (provider: string): ApiType => {
  // 转换为小写以便匹配
  const p = provider.toLowerCase();

  // OpenAI 兼容类型
  if (
    p === "codex" ||
    p === "codex_oauth" ||
    p === "openai" ||
    p === "openai-response" ||
    p === "azure_openai" ||
    p === "azure-openai" ||
    p === "qwen" ||
    p === "iflow"
  ) {
    return "openai";
  }

  // Anthropic 类型
  if (
    p === "anthropic" ||
    p === "anthropic-compatible" ||
    p === "claude" ||
    p === "claude_oauth" ||
    p === "kiro"
  ) {
    return "anthropic";
  }

  // Gemini 类型
  if (
    p === "gemini" ||
    p === "gemini_api_key" ||
    p === "antigravity" ||
    p === "vertex" ||
    p === "vertexai"
  ) {
    return "gemini";
  }

  // 默认返回 openai
  return "openai";
};

// 需要使用别名配置的 Provider 列表
const ALIAS_PROVIDERS = [
  "antigravity",
  "kiro",
  "codex",
  "codex_oauth",
  "gemini",
  "gemini_api_key",
];

// 别名配置文件名映射（某些 Provider 共享同一个别名配置）
const ALIAS_CONFIG_MAPPING: Record<string, string> = {
  gemini_api_key: "gemini",
  codex_oauth: "codex",
};

// 可用的 Provider 信息（合并 OAuth 凭证池和 API Key Provider）
interface AvailableProvider {
  id: string;
  label: string;
  iconType: string;
  source: "oauth" | "api_key" | "both";
  oauthCount: number;
  apiKeyCount: number;
  totalCount: number;
}

export function ApiServerPage({ hideHeader = false }: ApiServerPageProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<ServerDiagnostics | null>(
    null,
  );
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [supportBundleLoading, setSupportBundleLoading] = useState(false);
  const [supportBundleResult, setSupportBundleResult] =
    useState<SupportBundleExportResult | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestState>>({});
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("server");

  // Config editing
  const [editPort, setEditPort] = useState<string>("");
  const [editHost, setEditHost] = useState<string>("");
  const [editApiKey, setEditApiKey] = useState<string>("");
  const [defaultProvider, setDefaultProviderState] = useState<string>("kiro");

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 网络信息
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // 模型库状态
  const [allModels, setAllModels] = useState<EnhancedModelMetadata[]>([]);
  const [testModel, setTestModel] = useState<string>("");
  const [_modelsLoading, setModelsLoading] = useState(false);

  // 自动清除消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const canExportSupportBundle =
    typeof window !== "undefined" &&
    Boolean(
      (window as any).__TAURI__?.core?.invoke ||
      (window as any).__TAURI__?.invoke,
    );

  const fetchStatus = async () => {
    try {
      const s = await getServerStatus();
      setStatus(s);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const detail = await getServerDiagnostics();
      setDiagnostics(detail);
      setMessage({ type: "success", text: "诊断数据已刷新" });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessage({ type: "error", text: `诊断拉取失败: ${errMsg}` });
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const copyDiagnostics = async () => {
    if (!diagnostics) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setDiagnosticsCopied(true);
      setTimeout(() => setDiagnosticsCopied(false), 1500);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessage({ type: "error", text: `复制失败: ${errMsg}` });
    }
  };

  const handleExportSupportBundle = async () => {
    setSupportBundleLoading(true);
    try {
      const result = await exportSupportBundle();
      setSupportBundleResult(result);
      setMessage({
        type: "success",
        text: `支持包已导出到：${result.bundle_path}`,
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessage({ type: "error", text: `导出支持包失败: ${errMsg}` });
    } finally {
      setSupportBundleLoading(false);
    }
  };

  const handleRevealSupportBundle = async () => {
    if (!supportBundleResult?.bundle_path) return;
    try {
      await revealPathInFinder(supportBundleResult.bundle_path);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessage({ type: "error", text: `打开支持包目录失败: ${errMsg}` });
    }
  };

  const fetchConfig = async () => {
    try {
      const c = await getConfig();
      console.log(
        "[DEBUG] fetchConfig - loaded config.server.host:",
        c.server.host,
      );
      setConfig(c);
      setEditPort(c.server.port.toString());
      setEditHost(c.server.host);
      console.log("[DEBUG] fetchConfig - setEditHost to:", c.server.host);
      setEditApiKey(c.server.api_key);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchDiagnostics();
    fetchConfig();
    loadDefaultProvider();
    loadNetworkInfo();

    const statusInterval = setInterval(fetchStatus, 3000);
    return () => clearInterval(statusInterval);
  }, []);

  const loadNetworkInfo = async () => {
    try {
      const info = await getNetworkInfo();
      setNetworkInfo(info);
    } catch (e) {
      console.error("Failed to get network info:", e);
    }
  };

  const loadDefaultProvider = async () => {
    try {
      const dp = await getDefaultProvider();
      setDefaultProviderState(dp);
    } catch (e) {
      console.error("Failed to get default provider:", e);
    }
  };

  // 加载模型库
  const loadModels = async (
    provider?: string,
    providers?: ProviderWithKeysDisplay[],
    resetSelection: boolean = false,
  ) => {
    setModelsLoading(true);
    try {
      let models: EnhancedModelMetadata[];

      if (provider) {
        // 检查是否是别名 Provider
        const providerLower = provider.toLowerCase();
        if (ALIAS_PROVIDERS.includes(providerLower)) {
          // 使用别名配置
          const aliasConfigKey =
            ALIAS_CONFIG_MAPPING[providerLower] || providerLower;
          const aliasConfig = await getProviderAliasConfig(aliasConfigKey);

          if (aliasConfig && aliasConfig.models.length > 0) {
            // 将别名配置中的模型转换为 EnhancedModelMetadata 格式
            models = aliasConfig.models.map(
              (modelName): EnhancedModelMetadata => {
                const aliasInfo = aliasConfig.aliases[modelName];
                return {
                  id: modelName,
                  display_name: modelName,
                  provider_id: providerLower,
                  provider_name: provider,
                  family: aliasInfo?.provider || null,
                  tier: "pro" as const,
                  capabilities: {
                    vision: false,
                    tools: true,
                    streaming: true,
                    json_mode: true,
                    function_calling: true,
                    reasoning: modelName.includes("thinking"),
                  },
                  pricing: null,
                  limits: {
                    context_length: null,
                    max_output_tokens: null,
                    requests_per_minute: null,
                    tokens_per_minute: null,
                  },
                  status: "active" as const,
                  release_date: null,
                  is_latest: false,
                  description:
                    aliasInfo?.description ||
                    `${aliasInfo?.actual || modelName}`,
                  source: "custom" as const,
                  created_at: Date.now() / 1000,
                  updated_at: Date.now() / 1000,
                };
              },
            );
          } else {
            models = [];
          }
        } else {
          // 非别名 Provider，使用模型注册表
          // 首先检查是否是自定义 API Key Provider
          // 如果是，优先使用其 custom_models 字段
          let customModels: string[] | undefined;
          let registryId = provider; // 默认使用 provider ID 作为 registryId
          let fallbackRegistryId: string | undefined;

          if (providers) {
            const customProvider = providers.find((p) => p.id === provider);
            if (customProvider) {
              // 获取自定义模型列表
              customModels = customProvider.custom_models;
              // 使用 provider.id 作为 registryId（适用于系统预设的 Provider，如 deepseek, moonshot）
              // 如果模型注册表中没有该 id 的模型，则回退到使用 type 映射
              registryId = customProvider.id;
              // 根据 type 获取回退的 registryId
              const typeToRegistryMap: Record<string, string> = {
                openai: "openai",
                anthropic: "anthropic",
                "anthropic-compatible": "anthropic",
                gemini: "gemini",
                "azure-openai": "openai",
                vertexai: "google",
                ollama: "ollama",
              };
              fallbackRegistryId =
                typeToRegistryMap[customProvider.type.toLowerCase()] ||
                customProvider.type.toLowerCase();
            }
          }

          // 收集所有模型
          let allModels: EnhancedModelMetadata[] = [];
          const existingIds = new Set<string>();

          // 1. 首先添加自定义模型（排在最前面）
          if (customModels && customModels.length > 0) {
            const customModelList = customModels.map(
              (modelName): EnhancedModelMetadata => ({
                id: modelName,
                display_name: modelName,
                provider_id: provider,
                provider_name: provider,
                family: null,
                tier: "pro" as const,
                capabilities: {
                  vision: false,
                  tools: true,
                  streaming: true,
                  json_mode: true,
                  function_calling: true,
                  reasoning: modelName.includes("thinking"),
                },
                pricing: null,
                limits: {
                  context_length: null,
                  max_output_tokens: null,
                  requests_per_minute: null,
                  tokens_per_minute: null,
                },
                status: "active" as const,
                release_date: null,
                is_latest: false,
                description: `自定义模型: ${modelName}`,
                source: "custom" as const,
                created_at: Date.now() / 1000,
                updated_at: Date.now() / 1000,
              }),
            );
            allModels = [...customModelList];
            customModels.forEach((id) => existingIds.add(id));
          }

          // 2. 添加模型注册表中的模型
          // 优先使用 registryId，如果没有模型则尝试从 API 获取，最后才回退到 fallbackRegistryId
          let registryModels = await getModelsForProvider(registryId);

          // 3. 如果本地模型注册表没有模型，优先尝试从 Provider API 获取
          if (registryModels.length === 0) {
            try {
              const result = await fetchProviderModelsAuto(provider);
              if (result?.error && result.should_prompt_error) {
                const diagnostics = [
                  result.error,
                  result.request_url ? `请求地址：${result.request_url}` : null,
                  result.diagnostic_hint ?? null,
                ]
                  .filter((line): line is string =>
                    Boolean(line && line.trim()),
                  )
                  .join(" | ");
                setMessage({
                  type: "error",
                  text:
                    diagnostics ||
                    "模型列表接口配置异常，请检查 Provider Base URL",
                });
              }
              if (result && result.models && result.models.length > 0) {
                registryModels = result.models;
              }
            } catch {
              // API 获取失败，继续尝试 fallback
            }
          }

          // 4. 如果 API 也没有获取到模型，回退到 fallbackRegistryId
          if (
            registryModels.length === 0 &&
            fallbackRegistryId &&
            fallbackRegistryId !== registryId
          ) {
            registryModels = await getModelsForProvider(fallbackRegistryId);
          }

          // 过滤掉已存在的模型
          const newModels = registryModels.filter(
            (m) => !existingIds.has(m.id),
          );
          allModels = [...allModels, ...newModels];

          models = allModels;
        }
      } else {
        models = await getModelRegistry();
      }

      setAllModels(models);

      // 只在需要重置选择时，或当前选择的模型不在新列表中时，才重置测试模型选择
      if (resetSelection || !models.find((m) => m.id === testModel)) {
        if (models.length > 0) {
          const defaultModel =
            models.find((m) => m.tier === "pro") || models[0];
          if (defaultModel) {
            setTestModel(defaultModel.id);
          }
        } else {
          setTestModel("");
        }
      }
    } catch (e) {
      console.error("Failed to load models:", e);
    }
    setModelsLoading(false);
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await reloadCredentials();
      await startServer();
      await fetchStatus();
      setMessage({ type: "success", text: "共享网关已开启" });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(errMsg);
      setMessage({ type: "error", text: `开启失败: ${errMsg}` });
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopServer();
      await fetchStatus();
      setMessage({ type: "success", text: "共享网关已关闭" });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(errMsg);
      setMessage({ type: "error", text: `关闭失败: ${errMsg}` });
    }
    setLoading(false);
  };

  // 自动保存监听地址
  const handleHostChange = async (newHost: string): Promise<boolean> => {
    setEditHost(newHost);

    // 如果配置已加载，自动保存
    if (config) {
      try {
        const newConfig = {
          ...config,
          server: {
            ...config.server,
            host: newHost,
          },
        };
        await saveConfig(newConfig);
        setConfig(newConfig);
        console.log("[DEBUG] handleHostChange - 自动保存地址:", newHost);
        return true;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[DEBUG] handleHostChange - 保存失败:", errMsg);
        setMessage({ type: "error", text: `保存地址失败: ${errMsg}` });
        return false;
      }
    }
    return true;
  };

  const handleSaveServerConfig = async () => {
    if (!config) return;
    setLoading(true);
    try {
      // 调试日志：确认保存时的值
      console.log("[DEBUG] handleSaveServerConfig - editHost:", editHost);
      console.log(
        "[DEBUG] handleSaveServerConfig - config.server.host:",
        config.server.host,
      );

      const newConfig = {
        ...config,
        server: {
          ...config.server,
          host: editHost,
          port: parseInt(editPort) || 8999,
          api_key: editApiKey,
        },
      };

      console.log(
        "[DEBUG] handleSaveServerConfig - newConfig.server.host:",
        newConfig.server.host,
      );

      await saveConfig(newConfig);

      console.log("[DEBUG] handleSaveServerConfig - saveConfig completed");

      await fetchConfig();
      setMessage({ type: "success", text: "网关配置已保存" });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[DEBUG] handleSaveServerConfig - error:", errMsg);
      setMessage({ type: "error", text: `保存失败: ${errMsg}` });
    }
    setLoading(false);
  };

  const providerLabels: Record<string, string> = {
    // OAuth 凭证池类型
    kiro: "Kiro",
    gemini: "Gemini",
    qwen: "Qwen",
    antigravity: "Antigravity",
    claude: "Claude",
    codex: "Codex API",
    codex_oauth: "Codex OAuth",
    iflow: "iFlow",
    claude_oauth: "Claude OAuth",
    vertex: "Vertex AI",
    gemini_api_key: "Gemini API Key",
    // API Key Provider 类型
    openai: "OpenAI",
    anthropic: "Anthropic",
    azure_openai: "Azure OpenAI",
    aws_bedrock: "AWS Bedrock",
    ollama: "Ollama",
  };

  // Provider ID 到图标类型的映射
  const providerIconMap: Record<string, string> = {
    // OAuth 凭证池类型
    kiro: "kiro",
    gemini: "gemini",
    qwen: "qwen",
    antigravity: "gemini",
    claude: "claude",
    codex: "openai",
    codex_oauth: "openai",
    iflow: "iflow",
    claude_oauth: "claude",
    vertex: "gemini",
    gemini_api_key: "gemini",
    // API Key Provider 类型
    openai: "openai",
    anthropic: "claude",
    azure_openai: "openai",
    aws_bedrock: "claude",
    ollama: "ollama",
  };

  // 根据 Provider type 获取图标类型（用于自定义 Provider）
  const getIconTypeFromProviderType = (providerType: string): string => {
    const typeIconMap: Record<string, string> = {
      openai: "openai",
      anthropic: "claude",
      "anthropic-compatible": "claude",
      gemini: "gemini",
      "azure-openai": "openai",
      vertexai: "gemini",
      ollama: "ollama",
    };
    return typeIconMap[providerType.toLowerCase()] || "openai";
  };

  const [poolOverview, setPoolOverview] = useState<ProviderPoolOverview[]>([]);
  const [apiKeyProviders, setApiKeyProviders] = useState<
    ProviderWithKeysDisplay[]
  >([]);
  const [availableProviders, setAvailableProviders] = useState<
    AvailableProvider[]
  >([]);
  const [providerSwitchMsg, setProviderSwitchMsg] = useState<string | null>(
    null,
  );

  // 当 defaultProvider 变化时，重新加载模型并重置选择
  useEffect(() => {
    loadModels(defaultProvider, apiKeyProviders, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProvider]);

  // 当 apiKeyProviders 首次加载时，重新加载模型（不重置选择）
  // 这是为了确保自定义 Provider 的 type 能被正确识别
  const [apiKeyProvidersLoaded, setApiKeyProvidersLoaded] = useState(false);
  useEffect(() => {
    if (apiKeyProviders.length > 0 && !apiKeyProvidersLoaded) {
      setApiKeyProvidersLoaded(true);
      loadModels(defaultProvider, apiKeyProviders, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyProviders]);

  // 加载凭证池概览
  const loadPoolOverview = async () => {
    try {
      const overview = await providerPoolApi.getOverview();
      setPoolOverview(overview);
    } catch (e) {
      console.error("Failed to load pool overview:", e);
    }
  };

  // 加载 API Key Provider 数据
  const loadApiKeyProviders = async () => {
    try {
      const providers = await apiKeyProviderApi.getProviders();
      setApiKeyProviders(providers);
    } catch (e) {
      console.error("Failed to load API Key providers:", e);
    }
  };

  // 合并 OAuth 凭证池和 API Key Provider，生成可用 Provider 列表
  // 注意：Codex 需要特殊处理，OAuth 和 API Key 分开显示
  const buildAvailableProviders = () => {
    const providerMap = new Map<string, AvailableProvider>();

    // 添加 OAuth 凭证池中有凭证的 Provider
    poolOverview.forEach((overview) => {
      const enabledCredentials = overview.credentials.filter(
        (c) => !c.is_disabled,
      );
      if (enabledCredentials.length > 0) {
        // Codex OAuth 使用特殊 ID，与 API Key 分开
        const id =
          overview.provider_type === "codex"
            ? "codex_oauth"
            : overview.provider_type;
        const existing = providerMap.get(id);
        if (existing) {
          existing.oauthCount = enabledCredentials.length;
          existing.totalCount = existing.oauthCount + existing.apiKeyCount;
          existing.source =
            existing.apiKeyCount > 0 && existing.oauthCount > 0
              ? "both"
              : "oauth";
        } else {
          // Codex OAuth 使用特殊标签
          const label =
            overview.provider_type === "codex"
              ? "Codex OAuth"
              : providerLabels[overview.provider_type] ||
                overview.provider_type;
          providerMap.set(id, {
            id,
            label,
            iconType: providerIconMap[overview.provider_type] || "openai",
            source: "oauth",
            oauthCount: enabledCredentials.length,
            apiKeyCount: 0,
            totalCount: enabledCredentials.length,
          });
        }
      }
    });

    // 添加 API Key Provider 中有 API Key 的 Provider
    // 使用 provider.id 作为 key，确保每个 Provider 单独显示
    apiKeyProviders.forEach((provider) => {
      const enabledKeys = provider.api_keys.filter((k) => k.enabled);
      if (enabledKeys.length > 0 && provider.enabled) {
        // 使用 provider.id 而不是 type 映射，确保自定义 Provider 单独显示
        const id = provider.id;
        const existing = providerMap.get(id);
        if (existing) {
          existing.apiKeyCount = enabledKeys.length;
          existing.totalCount = existing.oauthCount + existing.apiKeyCount;
          existing.source =
            existing.oauthCount > 0 && existing.apiKeyCount > 0
              ? "both"
              : "api_key";
        } else {
          // 根据 provider.type 确定图标类型（优先使用 id 映射，否则使用 type 映射）
          const iconType =
            providerIconMap[id] ||
            providerIconMap[provider.type] ||
            getIconTypeFromProviderType(provider.type);
          providerMap.set(id, {
            id,
            label: providerLabels[id] || provider.name,
            iconType,
            source: "api_key",
            oauthCount: 0,
            apiKeyCount: enabledKeys.length,
            totalCount: enabledKeys.length,
          });
        }
      }
    });

    // 转换为数组并按凭证数量排序，Qwen 排到最后
    const providers = Array.from(providerMap.values()).sort((a, b) => {
      // Qwen 排到最后
      if (a.id === "qwen" && b.id !== "qwen") return 1;
      if (b.id === "qwen" && a.id !== "qwen") return -1;
      // 其他按凭证数量排序
      return b.totalCount - a.totalCount;
    });
    setAvailableProviders(providers);
  };

  // 将 API Key Provider 类型映射到 Provider ID
  // API Key Provider 类型直接使用自己的 ID，不合并到 OAuth 凭证池类型
  const mapApiKeyProviderToId = (providerType: string): string => {
    switch (providerType.toLowerCase()) {
      case "openai":
      case "openai-response":
        return "openai";
      case "anthropic":
        return "anthropic";
      case "gemini":
        return "gemini_api_key";
      case "azure-openai":
        return "azure_openai";
      case "vertexai":
        return "vertex";
      case "aws-bedrock":
        return "aws_bedrock";
      case "ollama":
        return "ollama";
      default:
        return providerType.toLowerCase();
    }
  };

  // 当 poolOverview 或 apiKeyProviders 变化时，重新构建可用 Provider 列表
  useEffect(() => {
    buildAvailableProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolOverview, apiKeyProviders]);

  useEffect(() => {
    loadPoolOverview();
    loadApiKeyProviders();
    // 定时刷新凭证池数据，以便使用次数能够更新
    const poolInterval = setInterval(() => {
      loadPoolOverview();
      loadApiKeyProviders();
    }, 5000);
    return () => clearInterval(poolInterval);
  }, []);

  // 自动清除 provider 切换提示
  useEffect(() => {
    if (providerSwitchMsg) {
      const timer = setTimeout(() => setProviderSwitchMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [providerSwitchMsg]);

  // 当切换功能 Tab 时，重置所有测试状态
  useEffect(() => {
    if (activeTab !== "server") {
      setTestResults({});
      setExpandedTest(null);
    }
  }, [activeTab]);

  const handleSetDefaultProvider = async (providerId: string) => {
    try {
      // codex_oauth 在后端映射到 codex 凭证池
      const backendProviderId =
        providerId === "codex_oauth" ? "codex" : providerId;
      await setDefaultProvider(backendProviderId);
      setDefaultProviderState(providerId);

      // 获取最新的凭证池数据
      const freshOverview = await providerPoolApi.getOverview();
      setPoolOverview(freshOverview);

      // 如果是 API Key Provider，更新对应的环境变量
      const apiKeyProvider = apiKeyProviders.find((p) => p.id === providerId);
      if (apiKeyProvider && apiKeyProvider.api_host) {
        // 根据 provider.type 更新对应的环境变量
        await updateProviderEnvVars(
          apiKeyProvider.type,
          apiKeyProvider.api_host,
        );
      }

      // 获取该 Provider 的凭证信息
      const provider = availableProviders.find((p) => p.id === providerId);
      const label = providerLabels[providerId] || providerId;

      if (provider) {
        const parts = [];
        if (provider.oauthCount > 0) {
          parts.push(`${provider.oauthCount} OAuth`);
        }
        if (provider.apiKeyCount > 0) {
          parts.push(`${provider.apiKeyCount} API Key`);
        }
        setProviderSwitchMsg(
          `已切换到 ${label}` +
            (parts.length > 0 ? `（${parts.join(", ")}）` : ""),
        );
      } else {
        setProviderSwitchMsg(`已切换到 ${label}`);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setProviderSwitchMsg(`切换失败: ${errMsg}`);
    }
  };

  // 根据监听地址智能选择测试 URL
  // - 127.0.0.1: 使用 127.0.0.1（仅本机）
  // - 0.0.0.0: 使用 127.0.0.1（本机访问所有接口）
  // - 局域网 IP: 使用该 IP（允许局域网测试）
  const getTestUrl = (host: string, port: number) => {
    if (host === "0.0.0.0" || !host) {
      return `http://127.0.0.1:${port}`;
    }
    return `http://${host}:${port}`;
  };

  // 获取当前有效的监听地址
  // 优先使用服务器运行时的实际地址，否则使用编辑中的地址
  const currentHost = status?.running ? status.host : editHost || "127.0.0.1";
  const currentPort = status?.running
    ? status.port
    : parseInt(editPort) || 8999;
  const serverUrl = getTestUrl(currentHost, currentPort);
  const apiKey = config?.server.api_key ?? "";

  // 检测是否发生了地址自动切换
  // 只有当配置的地址是一个不可用的局域网 IP（不在当前网卡列表中）时才显示提示
  // 127.0.0.1, 0.0.0.0 等特殊地址不会触发自动切换
  const hostMismatch = useMemo(() => {
    if (!status?.running || !config?.server.host) return false;

    const configuredHost = config.server.host;
    const actualHost = status.host;

    // 如果地址相同，没有切换
    if (configuredHost === actualHost) return false;

    // 如果配置的是特殊地址，不显示提示（这些地址不会被自动切换）
    if (
      ["127.0.0.1", "localhost", "0.0.0.0", "::", "::1"].includes(
        configuredHost,
      )
    ) {
      return false;
    }

    // 配置的是局域网 IP，但实际运行地址不同，说明发生了自动切换
    return true;
  }, [status, config]);

  // 计算 Select 组件的可用选项
  // 包括固定选项 + 网络接口 IP + 当前配置的地址（如果不在列表中）+ 实际运行地址
  const hostOptions = useMemo(() => {
    const options = new Set<string>(["127.0.0.1", "0.0.0.0"]);
    // 添加网络接口 IP
    networkInfo?.all_ips.forEach((ip) => options.add(ip));
    // 如果当前配置的地址不在列表中，也添加进去
    if (editHost && !options.has(editHost)) {
      options.add(editHost);
    }
    // 如果服务器运行中且实际地址不在列表中，也添加进去
    if (status?.running && status.host && !options.has(status.host)) {
      options.add(status.host);
    }
    return Array.from(options);
  }, [networkInfo, editHost, status]);

  const gatewayMode = useMemo(
    () =>
      getGatewayModeByHost(
        status?.running ? status.host : editHost || "127.0.0.1",
      ),
    [status, editHost],
  );
  const cacheHitRate = useMemo(() => {
    const hits = status?.response_cache?.hits ?? 0;
    const misses = status?.response_cache?.misses ?? 0;
    const total = hits + misses;
    if (total === 0) return 0;
    return (hits / total) * 100;
  }, [status]);
  const capabilityExcludedReasonTotal = useMemo(() => {
    const capability = status?.capability_routing;
    if (!capability) return 0;
    return (
      capability.filter_excluded_tools_total +
      capability.filter_excluded_vision_total +
      capability.filter_excluded_context_total
    );
  }, [status]);
  const requestDedupReplayRate = useMemo(() => {
    const dedup = status?.request_dedup;
    if (!dedup) return 0;
    const totalChecks =
      dedup.check_new_total +
      dedup.check_in_progress_total +
      dedup.check_completed_total;
    const replayCount = dedup.check_completed_total + dedup.wait_success_total;
    if (totalChecks === 0) return 0;
    return (replayCount / totalChecks) * 100;
  }, [status]);
  const idempotencyReplayRate = useMemo(() => {
    const idempotency = status?.idempotency;
    if (!idempotency) return 0;
    const totalChecks =
      idempotency.check_new_total +
      idempotency.check_in_progress_total +
      idempotency.check_completed_total;
    if (totalChecks === 0) return 0;
    return (idempotency.check_completed_total / totalChecks) * 100;
  }, [status]);
  const diagnosticsJson = useMemo(() => {
    if (!diagnostics) return "";
    return JSON.stringify(diagnostics, null, 2);
  }, [diagnostics]);

  const handleGatewayModeChange = async (mode: GatewayMode) => {
    const nextHost = mode === "local" ? "127.0.0.1" : "0.0.0.0";
    if (nextHost === editHost) return;
    const saved = await handleHostChange(nextHost);
    if (!saved) return;
    setMessage({
      type: "success",
      text: mode === "local" ? "已切换为仅本机模式" : "已切换为内网共享模式",
    });
  };

  // 动态生成测试端点
  const testEndpoints = useMemo(() => {
    if (!testModel) return [];

    // 首先检查是否是自定义 API Key Provider
    // 如果是，使用其 type 字段来确定 API 类型
    let effectiveProvider = defaultProvider;
    const customProvider = apiKeyProviders.find(
      (p) => p.id === defaultProvider,
    );
    if (customProvider) {
      effectiveProvider = customProvider.type;
    }

    const apiType = getProviderApiType(effectiveProvider);

    switch (apiType) {
      case "openai":
        return [
          {
            id: "chat",
            name: "OpenAI Chat",
            method: "POST",
            path: "/v1/chat/completions",
            needsAuth: true,
            body: JSON.stringify({
              model: testModel,
              messages: [{ role: "user", content: "Say hi in one word" }],
            }),
          },
        ];

      case "anthropic":
        return [
          {
            id: "anthropic",
            name: "Anthropic Messages",
            method: "POST",
            path: "/v1/messages",
            needsAuth: true,
            body: JSON.stringify({
              model: testModel,
              max_tokens: 100,
              messages: [
                {
                  role: "user",
                  content: "What is 1+1? Answer with just the number.",
                },
              ],
            }),
          },
        ];

      case "gemini":
        return [
          {
            id: "gemini",
            name: `Gemini ${testModel}`,
            method: "POST",
            path: `/v1/gemini/${testModel}:generateContent`,
            needsAuth: true,
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: "What is 2+2? Answer with just the number." },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 100,
              },
            }),
          },
        ];

      default:
        return [];
    }
  }, [defaultProvider, testModel, apiKeyProviders]);

  const runTest = async (endpoint: (typeof testEndpoints)[0]) => {
    setTestResults((prev) => ({
      ...prev,
      [endpoint.id]: { endpoint: endpoint.path, status: "loading" },
    }));

    try {
      const result: TestResult = await testApi(
        endpoint.method,
        endpoint.path,
        endpoint.body,
        endpoint.needsAuth,
      );

      setTestResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          endpoint: endpoint.path,
          status: result.success ? "success" : "error",
          response: result.body || `HTTP ${result.status}: 无响应内容`,
          time: result.time_ms,
          httpStatus: result.status,
          responseHeaders: result.response_headers || {},
        },
      }));

      // 测试成功后立即刷新凭证池数据，更新使用次数
      if (result.success) {
        await loadPoolOverview();
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setTestResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          endpoint: endpoint.path,
          status: "error",
          response: `请求失败: ${errMsg}`,
        },
      }));
    }
  };

  const runAllTests = async () => {
    for (const endpoint of testEndpoints) {
      await runTest(endpoint);
    }
  };

  const getCurlCommand = (endpoint: (typeof testEndpoints)[0]) => {
    let cmd = `curl -s ${serverUrl}${endpoint.path}`;
    if (endpoint.needsAuth) {
      cmd += ` \\\n  -H "Authorization: Bearer ${apiKey}"`;
    }
    if (endpoint.body) {
      cmd += ` \\\n  -H "Content-Type: application/json"`;
      cmd += ` \\\n  -d '${endpoint.body}'`;
    }
    return cmd;
  };

  const copyCommand = (id: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const getStatusBadge = (result?: TestState) => {
    if (!result || result.status === "idle") {
      return (
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          未测试
        </span>
      );
    }
    if (result.status === "loading") {
      return (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
          测试中...
        </span>
      );
    }
    if (result.status === "success") {
      return (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          {result.time}ms
        </span>
      );
    }
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        失败 {result.httpStatus ? `(${result.httpStatus})` : ""}
      </span>
    );
  };

  const activeProviderLabel =
    availableProviders.find((provider) => provider.id === defaultProvider)
      ?.label ||
    providerLabels[defaultProvider] ||
    defaultProvider;
  const gatewayModeLabel = gatewayMode === "local" ? "仅本机" : "内网共享";
  const gatewayStatusLabel = status?.running ? "运行中" : "已停止";

  return (
    <div className="space-y-6 pb-8">
      {message ? (
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-sm shadow-sm shadow-slate-950/5",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50/90 text-emerald-700"
              : "border-rose-200 bg-rose-50/90 text-rose-700",
          )}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={fetchDiagnostics}
            disabled={diagnosticsLoading}
            className="rounded-full border border-current/15 bg-white/80 px-3 py-1.5 text-xs font-medium transition hover:bg-white disabled:opacity-50"
          >
            {diagnosticsLoading ? "刷新中..." : "刷新诊断"}
          </button>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[30px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(244,251,248,0.98)_0%,rgba(248,250,252,0.98)_45%,rgba(241,246,255,0.96)_100%)] shadow-sm shadow-slate-950/5">
        <div className="pointer-events-none absolute -left-20 top-[-72px] h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="pointer-events-none absolute right-[-76px] top-[-24px] h-56 w-56 rounded-full bg-sky-200/28 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 lg:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] xl:items-stretch">
            <div className="max-w-3xl space-y-5">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-emerald-700 shadow-sm">
                GATEWAY CONTROL
              </span>
              <div className="space-y-2">
                <p className="text-[28px] font-semibold tracking-tight text-slate-900">
                  {hideHeader
                    ? "统一控制内网共享、默认 Provider 与兼容性测试"
                    : "团队共享网关（内网）"}
                </p>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  Agent 默认直连 Provider。只有在需要让同网段设备复用这套服务、
                  默认模型和兼容接口时，再开启共享网关即可。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
                    status?.running
                      ? "border-emerald-200 bg-white/90 text-emerald-700"
                      : "border-slate-200 bg-white/88 text-slate-600",
                  )}
                >
                  共享状态：{gatewayStatusLabel}
                </span>
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  共享模式：{gatewayModeLabel}
                </span>
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  默认 Provider：{activeProviderLabel}
                </span>
                <span className="rounded-full border border-white/90 bg-white/88 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  测试地址：{serverUrl}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 xl:content-start">
              <GatewayStatCard
                label="共享状态"
                value={gatewayStatusLabel}
                description={
                  status?.running
                    ? "网关正在对外提供兼容接口。"
                    : "当前未对外开放，可先完成配置再启动。"
                }
              />
              <GatewayStatCard
                label="累计请求"
                value={(status?.requests ?? 0).toString()}
                description="用于快速观察当前网关是否处于活跃使用状态。"
              />
              <GatewayStatCard
                label="可测端点"
                value={testEndpoints.length.toString()}
                description="会随默认 Provider 和模型协议类型自动切换。"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="inline-flex flex-wrap gap-1 rounded-[20px] border border-slate-200/80 bg-white p-1 shadow-sm shadow-slate-950/5">
        {[
          { id: "server" as TabId, name: "网关控制" },
          { id: "logs" as TabId, name: "网关日志" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              activeTab === tab.id
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {activeTab === "server" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
          <div className="space-y-6">
            <GatewayPanel
              icon={Server}
              title="网关控制"
              description="把启动、共享模式、监听地址和鉴权配置集中在同一个控制区。"
              aside={
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    status?.running
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-600",
                  )}
                >
                  {status?.running ? "已对外共享" : "待启动"}
                </span>
              }
            >
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50",
                      status?.running
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-emerald-600 hover:bg-emerald-700",
                    )}
                    onClick={status?.running ? handleStop : handleStart}
                    disabled={loading}
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : null}
                    {loading
                      ? "处理中..."
                      : status?.running
                        ? "关闭共享"
                        : "开启共享"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveServerConfig}
                    disabled={loading || status?.running}
                    className={BUTTON_SECONDARY_CLASS_NAME}
                    title={status?.running ? "请先关闭共享再修改配置" : ""}
                  >
                    保存配置
                  </button>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    当前测试地址：{serverUrl}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          共享模式
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          仅本机适合本地调试，内网共享适合同网段协作接入。
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                        当前：{gatewayModeLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleGatewayModeChange("local");
                        }}
                        disabled={status?.running}
                        className={cn(
                          "rounded-[18px] border px-4 py-3 text-left transition",
                          gatewayMode === "local"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                          status?.running && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <p className="text-sm font-semibold">仅本机</p>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-5",
                            gatewayMode === "local"
                              ? "text-white/70"
                              : "text-slate-500",
                          )}
                        >
                          只允许当前设备访问网关。
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleGatewayModeChange("lan");
                        }}
                        disabled={status?.running}
                        className={cn(
                          "rounded-[18px] border px-4 py-3 text-left transition",
                          gatewayMode === "lan"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                          status?.running && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <p className="text-sm font-semibold">内网共享</p>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-5",
                            gatewayMode === "lan"
                              ? "text-white/70"
                              : "text-slate-500",
                          )}
                        >
                          对同网段设备暴露兼容接口。
                        </p>
                      </button>
                    </div>
                  </article>

                  <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        网关地址与鉴权
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        运行中会锁定配置，避免协作接入过程中误改监听地址。
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">
                          共享地址
                        </label>
                        <Select.Root
                          value={
                            status?.running
                              ? status.host
                              : editHost || "127.0.0.1"
                          }
                          onValueChange={handleHostChange}
                          disabled={status?.running}
                        >
                          <Select.Trigger
                            className={cn(
                              INPUT_CLASS_NAME,
                              "inline-flex w-full items-center justify-between gap-2",
                            )}
                          >
                            <Select.Value />
                            <Select.Icon>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </Select.Icon>
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Content
                              position="popper"
                              side="bottom"
                              align="start"
                              sideOffset={4}
                              className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[18px] border border-slate-200 bg-white text-slate-700 shadow-lg"
                            >
                              <Select.Viewport className="p-1">
                                {hostOptions.map((ip) => {
                                  let label = "(局域网)";
                                  if (ip === "127.0.0.1") {
                                    label = "(仅本机)";
                                  } else if (ip === "0.0.0.0") {
                                    label = "(所有接口)";
                                  } else if (
                                    !networkInfo?.all_ips.includes(ip)
                                  ) {
                                    label = "(已配置)";
                                  }

                                  return (
                                    <Select.Item
                                      key={ip}
                                      value={ip}
                                      className="relative flex cursor-pointer select-none items-center rounded-[14px] px-8 py-2.5 text-sm outline-none transition hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    >
                                      <Select.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                        <Check className="h-4 w-4" />
                                      </Select.ItemIndicator>
                                      <Select.ItemText>
                                        <span className="flex items-center gap-2">
                                          <span className="font-mono">
                                            {ip}
                                          </span>
                                          <span className="text-xs text-slate-500">
                                            {label}
                                          </span>
                                        </span>
                                      </Select.ItemText>
                                    </Select.Item>
                                  );
                                })}
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">
                            端口
                          </label>
                          <input
                            type="number"
                            value={editPort}
                            onChange={(e) => setEditPort(e.target.value)}
                            className={INPUT_CLASS_NAME}
                            disabled={status?.running}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">
                            API Key
                          </label>
                          <input
                            type="text"
                            value={editApiKey}
                            onChange={(e) => setEditApiKey(e.target.value)}
                            className={INPUT_CLASS_NAME}
                            disabled={status?.running}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-500">
                    {!status?.running
                      ? "仅本机模式只允许当前设备访问；内网共享模式会对同网段设备开放。建议完成地址与 API Key 配置后再开启共享。"
                      : `当前处于${gatewayModeLabel}模式。为了避免影响协作者访问，修改配置前请先关闭共享。`}
                  </div>
                  {hostMismatch ? (
                    <div className="rounded-[18px] border border-sky-200 bg-sky-50/80 px-4 py-3 text-xs leading-5 text-sky-700">
                      配置的共享地址 {config?.server.host}{" "}
                      当前不可用，运行时已自动切换到
                      {status?.host}。关闭共享后可更新为新的可用地址。
                    </div>
                  ) : null}
                </div>
              </div>
            </GatewayPanel>

            <GatewayPanel
              icon={ShieldCheck}
              title="默认 Provider"
              description="选择网关默认转发的服务来源，并直接查看当前可用凭证。"
              aside={
                providerSwitchMsg ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <Check className="h-3 w-3" />
                    {providerSwitchMsg}
                  </span>
                ) : null
              }
            >
              {availableProviders.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  暂无可用凭证，请先在凭证池或 API Key 设置中添加凭证。
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2.5">
                    {availableProviders.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSetDefaultProvider(p.id)}
                        disabled={loading}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition shadow-sm",
                          defaultProvider === p.id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                          loading && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <ProviderIcon
                          providerType={
                            p.iconType as Parameters<
                              typeof ProviderIcon
                            >[0]["providerType"]
                          }
                          size={14}
                        />
                        {p.label}
                        <span
                          className={cn(
                            "text-xs",
                            defaultProvider === p.id
                              ? "text-white/70"
                              : "text-slate-400",
                          )}
                        >
                          {p.totalCount}
                          {p.source === "both"
                            ? " 混合"
                            : p.source === "api_key"
                              ? " Key"
                              : ""}
                        </span>
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const poolProviderType =
                      defaultProvider === "codex_oauth"
                        ? "codex"
                        : defaultProvider;
                    const currentOverview = poolOverview.find(
                      (o) => o.provider_type === poolProviderType,
                    );
                    const oauthCredentials = (
                      currentOverview?.credentials || []
                    ).filter((cred) => !cred.is_disabled);
                    const matchingApiKeyProviders =
                      defaultProvider === "codex_oauth"
                        ? []
                        : apiKeyProviders.filter((p) => {
                            if (p.id === defaultProvider && p.enabled) {
                              return true;
                            }
                            const mappedId = mapApiKeyProviderToId(p.type);
                            return mappedId === defaultProvider && p.enabled;
                          });
                    const apiKeys = matchingApiKeyProviders.flatMap((p) =>
                      p.api_keys.filter((k) => k.enabled),
                    );

                    if (oauthCredentials.length === 0 && apiKeys.length === 0) {
                      return (
                        <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                          当前 Provider 暂无可用凭证，请先补充账号或 API Key。
                        </div>
                      );
                    }

                    return (
                      <div className="grid gap-4 xl:grid-cols-2">
                        {oauthCredentials.length > 0 ? (
                          <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">
                                OAuth 凭证
                              </p>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                {oauthCredentials.length} 个
                              </span>
                            </div>
                            <div className="mt-4 space-y-2">
                              {oauthCredentials.map((cred) => (
                                <div
                                  key={cred.uuid}
                                  className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "h-2.5 w-2.5 rounded-full",
                                        cred.is_healthy
                                          ? "bg-emerald-500"
                                          : "bg-amber-400",
                                      )}
                                    />
                                    <span className="text-slate-700">
                                      {cred.name || cred.uuid.slice(0, 8)}
                                    </span>
                                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                                      OAuth
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500">
                                    使用 {cred.usage_count} 次
                                  </span>
                                </div>
                              ))}
                            </div>
                          </article>
                        ) : null}

                        {apiKeys.length > 0 ? (
                          <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">
                                API Key
                              </p>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                {apiKeys.length} 个
                              </span>
                            </div>
                            <div className="mt-4 space-y-2">
                              {apiKeys.map((key) => (
                                <div
                                  key={key.id}
                                  className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    <span className="text-slate-700">
                                      {key.alias || key.api_key_masked}
                                    </span>
                                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                                      API Key
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500">
                                    使用 {key.usage_count} 次
                                  </span>
                                </div>
                              ))}
                            </div>
                          </article>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              )}
            </GatewayPanel>

            <GatewayPanel
              icon={Zap}
              title="网关 API 测试"
              description="根据默认 Provider 自动切换协议与端点，直接验证当前网关是否可用。"
              aside={
                <button
                  type="button"
                  onClick={runAllTests}
                  disabled={!status?.running || testEndpoints.length === 0}
                  className={BUTTON_PRIMARY_CLASS_NAME}
                >
                  <Play className="h-4 w-4" />
                  测试全部
                </button>
              }
            >
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <span className="text-sm font-medium text-slate-500">
                    测试模型
                  </span>
                  <Select.Root value={testModel} onValueChange={setTestModel}>
                    <Select.Trigger
                      className={cn(
                        INPUT_CLASS_NAME,
                        "inline-flex min-w-[320px] items-center justify-between gap-2",
                      )}
                    >
                      <Select.Value placeholder="选择模型..." />
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="z-50 max-h-[300px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[18px] border border-slate-200 bg-white text-slate-700 shadow-lg"
                      >
                        <Select.Viewport className="p-1">
                          {allModels.map((model) => (
                            <Select.Item
                              key={model.id}
                              value={model.id}
                              className="relative flex cursor-pointer select-none items-center rounded-[14px] px-8 py-2.5 text-sm outline-none transition hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                              <Select.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                <Check className="h-4 w-4" />
                              </Select.ItemIndicator>
                              <Select.ItemText>
                                <span className="flex items-center gap-2">
                                  <span>{model.display_name}</span>
                                  <span className="text-xs text-slate-400">
                                    {model.provider_name}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                      model.tier === "max"
                                        ? "bg-violet-100 text-violet-700"
                                        : model.tier === "pro"
                                          ? "bg-sky-100 text-sky-700"
                                          : "bg-slate-100 text-slate-600",
                                    )}
                                  >
                                    {model.tier}
                                  </span>
                                </span>
                              </Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>

                <div className="space-y-3">
                  {testEndpoints.map((endpoint) => {
                    const result = testResults[endpoint.id];
                    const isExpanded = expandedTest === endpoint.id;
                    const curlCmd = getCurlCommand(endpoint);
                    const limeDebugHeaders = Object.entries(
                      result?.responseHeaders || {},
                    ).filter(([key]) =>
                      key.toLowerCase().startsWith("x-lime-"),
                    );

                    return (
                      <article
                        key={endpoint.id}
                        className="rounded-[22px] border border-slate-200/80 bg-slate-50/60"
                      >
                        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium",
                                endpoint.method === "GET"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-sky-100 text-sky-700",
                              )}
                            >
                              {endpoint.method}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {endpoint.name}
                            </span>
                            <code className="text-xs text-slate-500">
                              {endpoint.path}
                            </code>
                            {getStatusBadge(result)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyCommand(endpoint.id, curlCmd)}
                              className={cn(
                                BUTTON_SECONDARY_CLASS_NAME,
                                "h-10 rounded-full px-3",
                              )}
                              title="复制 curl 命令"
                            >
                              {copiedCmd === endpoint.id ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => runTest(endpoint)}
                              disabled={
                                !status?.running || result?.status === "loading"
                              }
                              className={BUTTON_PRIMARY_CLASS_NAME}
                            >
                              测试
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTest(isExpanded ? null : endpoint.id)
                              }
                              className={cn(
                                BUTTON_SECONDARY_CLASS_NAME,
                                "h-10 rounded-full px-3",
                              )}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="border-t border-slate-200/80 p-4">
                            <div className="space-y-3">
                              <div>
                                <p className="mb-1 text-xs font-medium text-slate-500">
                                  curl 命令
                                </p>
                                <pre className="overflow-x-auto rounded-[18px] bg-white p-3 text-xs text-slate-700">
                                  {curlCmd}
                                </pre>
                              </div>
                              {result?.response ? (
                                <div>
                                  <p className="mb-1 text-xs font-medium text-slate-500">
                                    响应{" "}
                                    {result.httpStatus &&
                                      `(HTTP ${result.httpStatus})`}
                                  </p>
                                  <pre
                                    className={cn(
                                      "max-h-40 overflow-x-auto rounded-[18px] p-3 text-xs",
                                      result.status === "success"
                                        ? "bg-emerald-50 text-emerald-900"
                                        : "bg-rose-50 text-rose-900",
                                    )}
                                  >
                                    {(() => {
                                      try {
                                        return JSON.stringify(
                                          JSON.parse(result.response),
                                          null,
                                          2,
                                        );
                                      } catch {
                                        return result.response || "(空响应)";
                                      }
                                    })()}
                                  </pre>
                                </div>
                              ) : null}
                              {limeDebugHeaders.length > 0 ? (
                                <div>
                                  <p className="mb-1 text-xs font-medium text-slate-500">
                                    调试头（x-lime-*）
                                  </p>
                                  <div className="space-y-1 rounded-[18px] bg-white p-3 text-xs">
                                    {limeDebugHeaders.map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className="flex items-start justify-between gap-3"
                                        >
                                          <code className="text-slate-500">
                                            {key}
                                          </code>
                                          <code className="break-all text-right text-slate-700">
                                            {value}
                                          </code>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            </GatewayPanel>
          </div>

          <div className="space-y-6">
            <GatewayPanel
              icon={Activity}
              title="观测面板"
              description="按分钟观察错误率、延迟、缓存与能力路由状态，便于判断网关是否健康。"
              aside={
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  每 3 秒刷新
                </span>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-4">
                    <p className="text-xs font-medium text-slate-500">
                      最近 1 分钟错误率
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {((status?.error_rate_1m ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-4">
                    <p className="text-xs font-medium text-slate-500">
                      最近 1 分钟 P95 延迟
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {status?.p95_latency_ms_1m != null
                        ? `${status.p95_latency_ms_1m}ms`
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-4">
                    <p className="text-xs font-medium text-slate-500">
                      活跃请求
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {status?.active_requests ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-4">
                    <p className="text-xs font-medium text-slate-500">
                      熔断上游
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {status?.open_circuit_count ?? 0}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      响应缓存
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>命中：{status?.response_cache?.hits ?? 0}</div>
                      <div>未命中：{status?.response_cache?.misses ?? 0}</div>
                      <div>缓存条目：{status?.response_cache?.size ?? 0}</div>
                      <div>
                        淘汰次数：{status?.response_cache?.evictions ?? 0}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      缓存命中率：{cacheHitRate.toFixed(1)}%
                    </p>
                  </article>

                  <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      请求去重
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>
                        新请求：{status?.request_dedup?.check_new_total ?? 0}
                      </div>
                      <div>
                        In-Flight 等待：
                        {status?.request_dedup?.check_in_progress_total ?? 0}
                      </div>
                      <div>
                        直接回放：
                        {status?.request_dedup?.check_completed_total ?? 0}
                      </div>
                      <div>
                        等待回放成功：
                        {status?.request_dedup?.wait_success_total ?? 0}
                      </div>
                      <div>
                        等待超时：
                        {status?.request_dedup?.wait_timeout_total ?? 0}
                      </div>
                      <div>
                        当前 In-Flight：
                        {status?.request_dedup?.inflight_size ?? 0}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      去重回放率：{requestDedupReplayRate.toFixed(1)}%
                    </p>
                  </article>

                  <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      幂等闭环
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>
                        新键：{status?.idempotency?.check_new_total ?? 0}
                      </div>
                      <div>
                        处理中冲突：
                        {status?.idempotency?.check_in_progress_total ?? 0}
                      </div>
                      <div>
                        已完成回放：
                        {status?.idempotency?.check_completed_total ?? 0}
                      </div>
                      <div>
                        完成写入：
                        {status?.idempotency?.complete_total ?? 0}
                      </div>
                      <div>
                        当前 In-Progress：
                        {status?.idempotency?.in_progress_size ?? 0}
                      </div>
                      <div>
                        当前 Completed：
                        {status?.idempotency?.completed_size ?? 0}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      幂等回放率：{idempotencyReplayRate.toFixed(1)}%
                    </p>
                  </article>

                  <article className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      能力路由与回退
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div>
                        过滤评估：
                        {status?.capability_routing?.filter_eval_total ?? 0}
                      </div>
                      <div>
                        过滤排除：
                        {status?.capability_routing?.filter_excluded_total ?? 0}
                      </div>
                      <div>
                        Provider 回退：
                        {status?.capability_routing?.provider_fallback_total ??
                          0}
                      </div>
                      <div>
                        模型回退：
                        {status?.capability_routing?.model_fallback_total ?? 0}
                      </div>
                      <div>
                        候选全排空：
                        {status?.capability_routing
                          ?.all_candidates_excluded_total ?? 0}
                      </div>
                      <div>原因样本：{capabilityExcludedReasonTotal}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>
                        tools：
                        {status?.capability_routing
                          ?.filter_excluded_tools_total ?? 0}
                      </span>
                      <span>
                        vision：
                        {status?.capability_routing
                          ?.filter_excluded_vision_total ?? 0}
                      </span>
                      <span>
                        context：
                        {status?.capability_routing
                          ?.filter_excluded_context_total ?? 0}
                      </span>
                    </div>
                  </article>
                </div>
              </div>
            </GatewayPanel>

            <GatewayPanel
              icon={Globe2}
              title="诊断与支持包"
              description="统一查看诊断 JSON，并在需要时导出支持包协助排障。"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchDiagnostics}
                    disabled={diagnosticsLoading}
                    className={BUTTON_SECONDARY_CLASS_NAME}
                  >
                    {diagnosticsLoading ? "拉取中..." : "拉取诊断"}
                  </button>
                  <button
                    type="button"
                    onClick={copyDiagnostics}
                    disabled={!diagnostics}
                    className={BUTTON_SECONDARY_CLASS_NAME}
                  >
                    {diagnosticsCopied ? "已复制" : "复制 JSON"}
                  </button>
                  {canExportSupportBundle ? (
                    <>
                      <button
                        type="button"
                        onClick={handleExportSupportBundle}
                        disabled={supportBundleLoading}
                        className={BUTTON_SECONDARY_CLASS_NAME}
                      >
                        {supportBundleLoading ? "导出中..." : "导出支持包"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealSupportBundle}
                        disabled={!supportBundleResult?.bundle_path}
                        className={BUTTON_SECONDARY_CLASS_NAME}
                      >
                        打开目录
                      </button>
                    </>
                  ) : null}
                </div>

                <pre className="max-h-[360px] overflow-auto rounded-[22px] bg-slate-50/80 p-4 text-xs text-slate-700">
                  {diagnosticsJson || "点击“拉取诊断”获取当前服务诊断 JSON。"}
                </pre>

                <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-500">
                  {canExportSupportBundle
                    ? supportBundleResult?.bundle_path
                      ? `最近一次支持包：${supportBundleResult.bundle_path}`
                      : "支持包默认导出到桌面；若桌面不可用，则回退到下载目录或系统临时目录。"
                    : "支持包导出仅在桌面端可用。"}
                </div>
              </div>
            </GatewayPanel>
          </div>
        </div>
      ) : (
        <GatewayPanel
          icon={Activity}
          title="网关日志"
          description="查看网关与系统日志流，导出或清空当前记录。"
        >
          <LogsTab />
        </GatewayPanel>
      )}
    </div>
  );
}
