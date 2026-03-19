import { useEffect, useRef } from "react";
import { safeListen } from "@/lib/dev-bridge";
import {
  TRAY_MODEL_SELECTED_EVENT,
  type SyncTrayModelShortcutsPayload,
  type TrayModelSelectedPayload,
  type TrayQuickModelGroup,
} from "@/lib/api/tray";
import {
  apiKeyProviderApi,
  type ProviderWithKeysDisplay,
} from "@/lib/api/apiKeyProvider";
import {
  providerPoolApi,
  type ProviderPoolOverview,
} from "@/lib/api/providerPool";
import { modelRegistryApi } from "@/lib/api/modelRegistry";
import { trayApi } from "@/lib/api/tray";
import {
  getAliasConfigKey,
  getProviderLabel,
  getRegistryIdFromType,
  isAliasProvider,
} from "@/lib/constants/providerMappings";
import type {
  EnhancedModelMetadata,
  ProviderAliasConfig,
} from "@/lib/types/modelRegistry";
import { filterModelsByTheme } from "../utils/modelThemePolicy";
import { getProviderModelCompatibilityIssue } from "../utils/providerModelCompatibility";

interface UseTrayModelShortcutsOptions {
  providerType: string;
  setProviderType: (type: string) => void;
  model: string;
  setModel: (model: string) => void;
  activeTheme?: string;
  deferInitialSync?: boolean;
}

interface ConfiguredProvider {
  key: string;
  label: string;
  registryId: string;
  fallbackRegistryId?: string;
  type: string;
  providerId?: string;
  customModels?: string[];
}

const MAX_TRAY_MODELS_PER_PROVIDER = 8;
const TRAY_PAYLOAD_CACHE_TTL_MS = 3_000;
const TRAY_SYNC_IDLE_TIMEOUT_MS = 1_500;
const TRAY_SYNC_FALLBACK_DELAY_MS = 180;

interface TrayPayloadCacheEntry {
  signature: string;
  expiresAt: number;
  payload: SyncTrayModelShortcutsPayload;
}

interface TrayPayloadInFlight {
  signature: string;
  promise: Promise<SyncTrayModelShortcutsPayload>;
}

let trayPayloadCache: TrayPayloadCacheEntry | null = null;
let trayPayloadInFlight: TrayPayloadInFlight | null = null;
let lastSyncedTrayPayloadFingerprint: string | null = null;

const THEME_LABEL_MAP: Record<string, string> = {
  general: "通用对话",
  "social-media": "社媒内容",
  poster: "图文海报",
  knowledge: "知识探索",
  planning: "计划规划",
  document: "办公文档",
  video: "短视频",
  music: "歌词曲谱",
  novel: "小说创作",
};

function sortModels(models: EnhancedModelMetadata[]): EnhancedModelMetadata[] {
  return [...models].sort((a, b) => {
    if (a.is_latest && !b.is_latest) return -1;
    if (!a.is_latest && b.is_latest) return 1;

    if (a.release_date && b.release_date) {
      return b.release_date.localeCompare(a.release_date);
    }
    if (a.release_date && !b.release_date) return -1;
    if (!a.release_date && b.release_date) return 1;

    return a.display_name.localeCompare(b.display_name);
  });
}

function convertCustomModelsToMetadata(
  models: string[],
  providerId: string,
  providerName: string,
): EnhancedModelMetadata[] {
  const now = Date.now() / 1000;
  return models.map((modelName) => ({
    id: modelName,
    display_name: modelName,
    provider_id: providerId,
    provider_name: providerName,
    family: null,
    tier: "pro",
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
    status: "active",
    release_date: null,
    is_latest: false,
    description: `自定义模型: ${modelName}`,
    source: "custom",
    created_at: now,
    updated_at: now,
  }));
}

function convertAliasModelsToMetadata(
  models: string[],
  aliasConfig: ProviderAliasConfig,
  providerId: string,
  providerName: string,
): EnhancedModelMetadata[] {
  const now = Date.now() / 1000;
  return models.map((modelName) => {
    const aliasInfo = aliasConfig.aliases[modelName];
    return {
      id: modelName,
      display_name: modelName,
      provider_id: providerId,
      provider_name: providerName,
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
      description: aliasInfo?.description || aliasInfo?.actual || modelName,
      source: "custom" as const,
      created_at: now,
      updated_at: now,
    };
  });
}

function buildConfiguredProviders(
  oauthCredentials: ProviderPoolOverview[],
  apiKeyProviders: ProviderWithKeysDisplay[],
): ConfiguredProvider[] {
  const providerMap = new Map<string, ConfiguredProvider>();

  oauthCredentials.forEach((overview) => {
    if (overview.credentials.length === 0) {
      return;
    }

    const key = overview.provider_type;
    if (providerMap.has(key)) {
      return;
    }

    providerMap.set(key, {
      key,
      label: getProviderLabel(key),
      registryId: getRegistryIdFromType(key),
      type: key,
    });
  });

  apiKeyProviders
    .filter((provider) => provider.api_key_count > 0 && provider.enabled)
    .forEach((provider) => {
      let key = provider.id;
      let label = provider.name;

      if (providerMap.has(key)) {
        key = `${provider.id}_api_key`;
        label = `${provider.name} API Key`;
      }

      if (providerMap.has(key)) {
        return;
      }

      providerMap.set(key, {
        key,
        label,
        registryId: provider.id,
        fallbackRegistryId: getRegistryIdFromType(provider.type),
        type: provider.type,
        providerId: provider.id,
        customModels: provider.custom_models,
      });
    });

  return Array.from(providerMap.values());
}

function dedupeModels(
  models: EnhancedModelMetadata[],
): EnhancedModelMetadata[] {
  const seen = new Set<string>();
  const result: EnhancedModelMetadata[] = [];

  models.forEach((model) => {
    const normalized = model.id.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(model);
  });

  return result;
}

function getTrayPayloadSignature(
  providerType: string,
  model: string,
  activeTheme?: string,
): string {
  return [providerType.trim(), model.trim(), activeTheme?.trim() || ""].join(
    "|",
  );
}

export function invalidateTrayPayloadCache(): void {
  trayPayloadCache = null;
  trayPayloadInFlight = null;
  lastSyncedTrayPayloadFingerprint = null;
}

function getTrayPayloadFingerprint(
  payload: SyncTrayModelShortcutsPayload,
): string {
  return JSON.stringify(payload);
}

function scheduleTrayModelSync(task: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(() => task(), {
      timeout: TRAY_SYNC_IDLE_TIMEOUT_MS,
    });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }

  const timeoutId = window.setTimeout(task, TRAY_SYNC_FALLBACK_DELAY_MS);
  return () => {
    window.clearTimeout(timeoutId);
  };
}

function resolveProviderModels(
  provider: ConfiguredProvider,
  registryModels: EnhancedModelMetadata[],
  aliasConfigs: Record<string, ProviderAliasConfig>,
): EnhancedModelMetadata[] {
  const combined: EnhancedModelMetadata[] = [];

  if (provider.customModels?.length) {
    combined.push(
      ...convertCustomModelsToMetadata(
        provider.customModels,
        provider.key,
        provider.label,
      ),
    );
  }

  if (isAliasProvider(provider.key)) {
    const aliasConfig = aliasConfigs[getAliasConfigKey(provider.key)];
    if (aliasConfig) {
      combined.push(
        ...convertAliasModelsToMetadata(
          aliasConfig.models,
          aliasConfig,
          provider.key,
          provider.label,
        ),
      );
    }
    return dedupeModels(combined);
  }

  const registryMatches = sortModels(
    registryModels.filter((item) => item.provider_id === provider.registryId),
  );
  if (registryMatches.length > 0) {
    combined.push(...registryMatches);
    return dedupeModels(combined);
  }

  if (provider.fallbackRegistryId) {
    combined.push(
      ...sortModels(
        registryModels.filter(
          (item) => item.provider_id === provider.fallbackRegistryId,
        ),
      ),
    );
  }

  return dedupeModels(combined);
}

function resolveThemeLabel(theme?: string): string {
  const normalizedTheme = theme?.trim().toLowerCase() || "";
  return THEME_LABEL_MAP[normalizedTheme] || "";
}

function buildQuickModelGroups(
  providers: ConfiguredProvider[],
  registryModels: EnhancedModelMetadata[],
  aliasConfigs: Record<string, ProviderAliasConfig>,
  providerType: string,
  model: string,
  activeTheme?: string,
): TrayQuickModelGroup[] {
  const groups: TrayQuickModelGroup[] = [];
  const currentProviderKey = providerType.trim();
  const currentModel = model.trim();

  providers.forEach((provider) => {
    const resolvedModels = resolveProviderModels(
      provider,
      registryModels,
      aliasConfigs,
    );
    const filteredModels = filterModelsByTheme(
      activeTheme,
      resolvedModels,
    ).models;

    const compatibleModels = filteredModels
      .filter(
        (item) =>
          !getProviderModelCompatibilityIssue({
            providerType: provider.key,
            configuredProviderType: provider.type,
            model: item.id,
          }),
      )
      .map((item) => item.id);

    const prioritizedModels = compatibleModels.filter(Boolean);
    if (
      provider.key === currentProviderKey &&
      currentModel &&
      !prioritizedModels.includes(currentModel)
    ) {
      prioritizedModels.unshift(currentModel);
    }

    const uniqueModels = Array.from(new Set(prioritizedModels)).slice(
      0,
      MAX_TRAY_MODELS_PER_PROVIDER,
    );

    if (uniqueModels.length === 0) {
      return;
    }

    groups.push({
      provider_type: provider.key,
      provider_label: provider.label,
      models: uniqueModels.map((item) => ({
        provider_type: provider.key,
        provider_label: provider.label,
        model: item,
      })),
    });
  });

  if (
    currentProviderKey &&
    currentModel &&
    !groups.some((group) => group.provider_type === currentProviderKey)
  ) {
    groups.unshift({
      provider_type: currentProviderKey,
      provider_label: getProviderLabel(currentProviderKey),
      models: [
        {
          provider_type: currentProviderKey,
          provider_label: getProviderLabel(currentProviderKey),
          model: currentModel,
        },
      ],
    });
  }

  return groups;
}

async function loadTraySource<T>(
  loader: () => Promise<T>,
  fallbackValue: T,
  label: string,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.warn(`[TrayModelShortcuts] 加载${label}失败:`, error);
    return fallbackValue;
  }
}

export async function buildTrayPayload(
  providerType: string,
  model: string,
  activeTheme?: string,
  options?: {
    forceRefresh?: boolean;
  },
): Promise<SyncTrayModelShortcutsPayload> {
  const signature = getTrayPayloadSignature(providerType, model, activeTheme);
  const now = Date.now();
  const forceRefresh = options?.forceRefresh ?? false;

  if (
    !forceRefresh &&
    trayPayloadCache &&
    trayPayloadCache.signature === signature &&
    trayPayloadCache.expiresAt > now
  ) {
    return trayPayloadCache.payload;
  }

  if (
    !forceRefresh &&
    trayPayloadInFlight &&
    trayPayloadInFlight.signature === signature
  ) {
    return trayPayloadInFlight.promise;
  }

  const payloadPromise = (async () => {
    const sourceOptions = forceRefresh ? { forceRefresh: true } : undefined;
    const [oauthCredentials, apiKeyProviders, registryModels, aliasConfigs] =
      await Promise.all([
        loadTraySource(
          () => providerPoolApi.getOverview(sourceOptions),
          [] as ProviderPoolOverview[],
          "OAuth Provider 概览",
        ),
        loadTraySource(
          () => apiKeyProviderApi.getProviders(sourceOptions),
          [] as ProviderWithKeysDisplay[],
          "API Key Provider 列表",
        ),
        loadTraySource(
          () => modelRegistryApi.getModelRegistry(sourceOptions),
          [] as EnhancedModelMetadata[],
          "模型注册表",
        ),
        loadTraySource(
          () => modelRegistryApi.getAllAliasConfigs(sourceOptions),
          {} as Record<string, ProviderAliasConfig>,
          "别名模型配置",
        ),
      ]);

    const providers = buildConfiguredProviders(
      oauthCredentials,
      apiKeyProviders,
    );
    const currentProvider =
      providers.find((item) => item.key === providerType) || null;

    return {
      current_model_provider_type: providerType,
      current_model_provider_label:
        currentProvider?.label || getProviderLabel(providerType),
      current_model: model,
      current_theme_label: resolveThemeLabel(activeTheme),
      quick_model_groups: buildQuickModelGroups(
        providers,
        registryModels,
        aliasConfigs,
        providerType,
        model,
        activeTheme,
      ),
    };
  })();

  trayPayloadInFlight = {
    signature,
    promise: payloadPromise,
  };

  try {
    const payload = await payloadPromise;

    if (trayPayloadInFlight?.promise === payloadPromise) {
      trayPayloadCache = {
        signature,
        expiresAt: Date.now() + TRAY_PAYLOAD_CACHE_TTL_MS,
        payload,
      };
    }

    return payload;
  } finally {
    if (trayPayloadInFlight?.promise === payloadPromise) {
      trayPayloadInFlight = null;
    }
  }
}

export async function syncTrayModelShortcutsState(
  providerType: string,
  model: string,
  activeTheme?: string,
  options?: {
    forceRefresh?: boolean;
  },
): Promise<void> {
  const payload = await buildTrayPayload(
    providerType,
    model,
    activeTheme,
    options,
  );
  const fingerprint = getTrayPayloadFingerprint(payload);

  if (
    !options?.forceRefresh &&
    fingerprint === lastSyncedTrayPayloadFingerprint
  ) {
    return;
  }

  await trayApi.syncTrayModelShortcuts(payload);
  lastSyncedTrayPayloadFingerprint = fingerprint;
}

export function useTrayModelShortcuts({
  providerType,
  setProviderType,
  model,
  setModel,
  activeTheme,
  deferInitialSync = false,
}: UseTrayModelShortcutsOptions) {
  const lastSyncedSignatureRef = useRef<string>("");
  const initialSyncHandledRef = useRef(false);

  useEffect(() => {
    const normalizedProviderType = providerType.trim();
    const normalizedModel = model.trim();
    const normalizedTheme = activeTheme?.trim() || "";

    if (!normalizedProviderType || !normalizedModel) {
      return;
    }

    const signature = [
      normalizedProviderType,
      normalizedModel,
      normalizedTheme,
    ].join("|");
    if (signature === lastSyncedSignatureRef.current) {
      return;
    }
    lastSyncedSignatureRef.current = signature;

    let cancelled = false;
    const runSync = () => {
      void syncTrayModelShortcutsState(
        normalizedProviderType,
        normalizedModel,
        normalizedTheme || undefined,
      ).catch((error) => {
        if (!cancelled) {
          console.warn("[TrayModelShortcuts] 同步托盘模型状态失败:", error);
        }
      });
    };
    let cleanupScheduledTask: (() => void) | null = null;

    if (!initialSyncHandledRef.current && deferInitialSync) {
      initialSyncHandledRef.current = true;
      cleanupScheduledTask = scheduleTrayModelSync(() => {
        if (!cancelled) {
          runSync();
        }
      });
    } else {
      initialSyncHandledRef.current = true;
      runSync();
    }

    return () => {
      cancelled = true;
      cleanupScheduledTask?.();
    };
  }, [activeTheme, deferInitialSync, model, providerType]);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | null = null;

    safeListen<TrayModelSelectedPayload>(TRAY_MODEL_SELECTED_EVENT, (event) => {
      if (cancelled) {
        return;
      }

      const nextProviderType = event.payload?.providerType?.trim() || "";
      const nextModel = event.payload?.model?.trim() || "";

      if (!nextModel) {
        return;
      }

      if (nextProviderType && nextProviderType !== providerType) {
        setProviderType(nextProviderType);
      }

      if (nextModel !== model) {
        setModel(nextModel);
      }
    })
      .then((unlisten) => {
        if (cancelled) {
          void unlisten();
          return;
        }
        dispose = unlisten;
      })
      .catch((error) => {
        console.warn("[TrayModelShortcuts] 监听托盘模型切换失败:", error);
      });

    return () => {
      cancelled = true;
      if (dispose) {
        dispose();
      }
    };
  }, [model, providerType, setModel, setProviderType]);
}
