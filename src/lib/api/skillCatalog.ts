import {
  hasOemCloudSession,
  resolveOemCloudRuntimeContext,
} from "./oemCloudRuntime";
import {
  getSeededServiceSkillCatalog,
  parseServiceSkillCatalog,
  type ServiceSkillExecutorBinding,
  type ServiceSkillItem,
  type ServiceSkillSiteCapabilityBinding,
  type ServiceSkillSlotDefinition,
} from "./serviceSkills";
import {
  siteListAdapters,
  type SiteAdapterDefinition,
} from "../webview-api";

export type SkillCatalogExecutionKind =
  | "native_skill"
  | "agent_turn"
  | "automation_job"
  | "cloud_scene"
  | "site_adapter";

export interface SkillCatalogExecution {
  kind: SkillCatalogExecutionKind;
  siteAdapterBinding?: ServiceSkillSiteCapabilityBinding;
}

export interface SkillCatalogGroup {
  key: string;
  title: string;
  summary: string;
  entryHint?: string;
  themeTarget?: string;
  sort: number;
  itemCount: number;
}

export interface SkillCatalogItem extends ServiceSkillItem {
  groupKey: string;
  execution: SkillCatalogExecution;
}

export interface SkillCatalog {
  version: string;
  tenantId: string;
  syncedAt: string;
  groups: SkillCatalogGroup[];
  items: SkillCatalogItem[];
}

export type SkillCatalogChangeSource =
  | "seeded_fallback"
  | "bootstrap_sync"
  | "manual_override"
  | "cache_clear";

interface SkillCatalogResponseEnvelope {
  code?: number;
  message?: string;
  data?: unknown;
}

const SKILL_CATALOG_STORAGE_KEY = "lime:skill-catalog:v1";
export const SKILL_CATALOG_CHANGED_EVENT = "lime:skill-catalog-changed";
const SEEDED_SKILL_GROUP_PRESETS = [
  {
    key: "github",
    title: "GitHub",
    summary: "围绕仓库与 Issue 的只读研究技能，直接复用真实登录态抓线索。",
    entryHint: "先选一个 GitHub 技能，再补关键词或仓库名，结果会直接回流到当前工作区。",
    themeTarget: "knowledge",
    sort: 10,
  },
  {
    key: "zhihu",
    title: "知乎",
    summary: "围绕热榜与内容检索的只读研究技能，适合快速做选题与观点线索扫描。",
    entryHint: "从热榜或关键词入口开始，先抓一轮线索，再回到 Claw 继续整理。",
    themeTarget: "knowledge",
    sort: 20,
  },
  {
    key: "linux-do",
    title: "Linux.do",
    summary: "围绕社区分类与热门讨论的只读研究技能，适合跟踪开发者社区动态。",
    entryHint: "先确定是看分类还是看热门，再直接在真实社区页面采集结果。",
    themeTarget: "knowledge",
    sort: 30,
  },
  {
    key: "bilibili",
    title: "Bilibili",
    summary: "围绕视频检索的只读站点技能，适合快速抓视频线索并回流到当前工作区。",
    entryHint: "先给检索词，再直接复用当前浏览器页面做一轮视频线索采集。",
    themeTarget: "video",
    sort: 40,
  },
  {
    key: "36kr",
    title: "36Kr",
    summary: "围绕快讯和资讯流的只读站点技能，适合快速收集行业动态和新闻线索。",
    entryHint: "先确定主题范围，再直接采集快讯结果回到 Claw 继续整理。",
    themeTarget: "knowledge",
    sort: 50,
  },
  {
    key: "smzdm",
    title: "什么值得买",
    summary: "围绕消费和商品检索的只读站点技能，适合快速抓价格、优惠与选品线索。",
    entryHint: "输入商品关键词后直接采集结果，再回到 Claw 做整理和对比。",
    themeTarget: "knowledge",
    sort: 60,
  },
  {
    key: "yahoo-finance",
    title: "Yahoo Finance",
    summary: "围绕股票与行情摘要的只读站点技能，适合快速拉一轮金融研究线索。",
    entryHint: "输入股票代码后直接抓取行情摘要，再在工作区继续分析。",
    themeTarget: "knowledge",
    sort: 70,
  },
  {
    key: "general",
    title: "通用技能",
    summary: "保留现有写作、调研、趋势与持续跟踪能力，作为站点组之外的业务技能入口。",
    entryHint: "如果任务不依赖站点登录态，直接从这里选一个通用技能进入工作模式。",
    themeTarget: "general",
    sort: 90,
  },
] as const;
const SEEDED_SKILL_CATALOG_VERSION = "client-seed-skill-catalog-2026-03-29";
const SITE_ADAPTER_TITLE_OVERRIDES: Record<string, string> = {
  "36kr/newsflash": "36Kr 快讯追踪",
  "bilibili/search": "Bilibili 视频检索",
  "github/issues": "GitHub Issue 检索",
  "github/search": "GitHub 仓库检索",
  "linux-do/categories": "Linux.do 分类扫描",
  "linux-do/hot": "Linux.do 热门话题",
  "smzdm/search": "什么值得买线索检索",
  "yahoo-finance/quote": "Yahoo Finance 行情摘要",
};
const SITE_ADAPTER_ARG_LABEL_OVERRIDES: Record<string, string> = {
  query: "检索词",
  limit: "条目上限",
  repo: "仓库",
  state: "状态",
  symbol: "股票代码",
  period: "时间周期",
};
const SITE_GROUP_TITLE_OVERRIDES: Record<string, string> = {
  github: "GitHub",
  zhihu: "知乎",
  "linux-do": "Linux.do",
  bilibili: "Bilibili",
  "36kr": "36Kr",
  smzdm: "什么值得买",
  "yahoo-finance": "Yahoo Finance",
  general: "通用技能",
};

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSkillCatalog(catalog: SkillCatalog): SkillCatalog {
  return {
    ...catalog,
    groups: catalog.groups.map((group) => ({ ...group })),
    items: catalog.items.map((item) => ({
      ...cloneJsonValue(item),
      execution: {
        ...item.execution,
        siteAdapterBinding: item.execution.siteAdapterBinding
          ? cloneJsonValue(item.execution.siteAdapterBinding)
          : undefined,
      },
    })),
  };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveSkillCatalogExecutionKind(
  binding: ServiceSkillExecutorBinding,
  siteBinding?: ServiceSkillSiteCapabilityBinding,
): SkillCatalogExecutionKind {
  if (siteBinding || binding === "browser_assist") {
    return "site_adapter";
  }
  switch (binding) {
    case "native_skill":
      return "native_skill";
    case "automation_job":
      return "automation_job";
    case "cloud_scene":
      return "cloud_scene";
    default:
      return "agent_turn";
  }
}

function resolveSeededSkillGroupKey(item: ServiceSkillItem): string {
  return resolveAdapterGroupKey(item.siteCapabilityBinding?.adapterName);
}

function buildSeededSkillCatalog(): SkillCatalog {
  const seeded = getSeededServiceSkillCatalog();
  const items: SkillCatalogItem[] = seeded.items.map((item) => {
    const clonedItem = cloneJsonValue(item);
    const groupKey = resolveSeededSkillGroupKey(clonedItem);
    const execution: SkillCatalogExecution = {
      kind: resolveSkillCatalogExecutionKind(
        clonedItem.defaultExecutorBinding,
        clonedItem.siteCapabilityBinding,
      ),
      siteAdapterBinding: clonedItem.siteCapabilityBinding
        ? cloneJsonValue(clonedItem.siteCapabilityBinding)
        : undefined,
    };

    return {
      ...clonedItem,
      groupKey,
      execution,
    };
  });

  const itemCountByGroup = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.groupKey] = (acc[item.groupKey] ?? 0) + 1;
    return acc;
  }, {});

  const groups = SEEDED_SKILL_GROUP_PRESETS.filter(
    (preset) => itemCountByGroup[preset.key] > 0,
  ).map((preset) => ({
    ...preset,
    itemCount: itemCountByGroup[preset.key] ?? 0,
  }));

  return {
    version: SEEDED_SKILL_CATALOG_VERSION,
    tenantId: seeded.tenantId,
    syncedAt: seeded.syncedAt,
    groups,
    items,
  };
}

const SEEDED_SKILL_CATALOG = buildSeededSkillCatalog();

function resolveAdapterGroupKey(adapterName?: string | null): string {
  const normalized = normalizeText(adapterName)?.toLowerCase();
  if (!normalized) {
    return "general";
  }

  const [prefix] = normalized.split("/");
  return prefix || "general";
}

function normalizeSiteAdapterId(adapterName: string): string {
  return `site-adapter-${adapterName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function titleCaseSegment(value: string): string {
  if (!value) {
    return value;
  }
  return value[0]!.toUpperCase() + value.slice(1);
}

function resolveGroupTitle(groupKey: string): string {
  const normalized = groupKey.trim().toLowerCase();
  if (SITE_GROUP_TITLE_OVERRIDES[normalized]) {
    return SITE_GROUP_TITLE_OVERRIDES[normalized]!;
  }
  return normalized
    .split(/[-_]/)
    .map(titleCaseSegment)
    .join(" ");
}

function resolveKnownGroupPreset(groupKey: string) {
  return SEEDED_SKILL_GROUP_PRESETS.find((preset) => preset.key === groupKey);
}

function sanitizeSentence(value: string, fallback: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }
  return /[。！？.!?]$/.test(normalized) ? normalized : `${normalized}。`;
}

function resolveSiteAdapterTitle(adapter: SiteAdapterDefinition): string {
  const normalizedName = adapter.name.trim().toLowerCase();
  if (SITE_ADAPTER_TITLE_OVERRIDES[normalizedName]) {
    return SITE_ADAPTER_TITLE_OVERRIDES[normalizedName]!;
  }

  const groupTitle = resolveGroupTitle(resolveAdapterGroupKey(adapter.name));
  const action = normalizedName.split("/")[1] ?? normalizedName;
  return `${groupTitle} ${action
    .split(/[-_]/)
    .map(titleCaseSegment)
    .join(" ")}`;
}

function resolveSiteAdapterCategory(adapter: SiteAdapterDefinition): string {
  const capabilities = adapter.capabilities.map((item) => item.toLowerCase());
  if (capabilities.includes("video")) {
    return "视频研究";
  }
  if (capabilities.includes("finance") || capabilities.includes("quote")) {
    return "财经研究";
  }
  if (capabilities.includes("shopping") || capabilities.includes("deals")) {
    return "消费研究";
  }
  if (capabilities.includes("community") || capabilities.includes("topics")) {
    return "社区研究";
  }
  return "情报研究";
}

function resolveSiteAdapterOutputHint(adapter: SiteAdapterDefinition): string {
  const capabilities = adapter.capabilities.map((item) => item.toLowerCase());
  if (capabilities.includes("video")) {
    return "视频线索 + 结构化结果";
  }
  if (capabilities.includes("finance") || capabilities.includes("quote")) {
    return "行情摘要 + 结构化结果";
  }
  if (capabilities.includes("newsflash")) {
    return "快讯列表 + 结构化结果";
  }
  if (capabilities.includes("categories")) {
    return "分类列表 + 结构化结果";
  }
  if (capabilities.includes("topics") || capabilities.includes("hot")) {
    return "热门话题 + 结构化结果";
  }
  return "结构化线索";
}

function resolveSiteAdapterThemeTarget(adapter: SiteAdapterDefinition): string {
  const capabilities = adapter.capabilities.map((item) => item.toLowerCase());
  if (capabilities.includes("video")) {
    return "video";
  }
  return "knowledge";
}

function resolveSiteAdapterAliases(adapter: SiteAdapterDefinition): string[] {
  const siteTitle = resolveGroupTitle(resolveAdapterGroupKey(adapter.name));
  return [
    adapter.name,
    adapter.domain,
    siteTitle,
    ...adapter.capabilities,
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function resolveSiteAdapterEntryHint(adapter: SiteAdapterDefinition): string {
  const siteTitle = resolveGroupTitle(resolveAdapterGroupKey(adapter.name));
  const authHint = normalizeText(adapter.auth_hint);
  if (authHint) {
    return authHint;
  }
  return sanitizeSentence(
    `复用你当前浏览器里的 ${siteTitle} 上下文，直接执行一轮站点采集并把结果回流到当前工作区`,
    `复用你当前浏览器里的 ${siteTitle} 上下文，直接执行一轮站点采集并把结果回流到当前工作区。`,
  );
}

function resolveSiteAdapterSetupRequirements(
  adapter: SiteAdapterDefinition,
): string[] {
  const siteTitle = resolveGroupTitle(resolveAdapterGroupKey(adapter.name));
  const requirements = [
    `需要浏览器里已有 ${siteTitle} 可用会话。`,
    "建议在目标项目内启动，方便采集结果继续沉淀到当前工作区。",
  ];
  const authHint = normalizeText(adapter.auth_hint);
  if (authHint) {
    requirements.unshift(sanitizeSentence(authHint, authHint));
  }
  return requirements.filter(
    (value, index, array) => array.indexOf(value) === index,
  );
}

function resolveSiteAdapterUsageGuidelines(
  adapter: SiteAdapterDefinition,
): string[] {
  return [
    sanitizeSentence(adapter.description, "适合先采集一轮站点结果。"),
    "优先补齐最关键的检索参数，再进入当前工作区继续分析和整理。",
  ];
}

function resolveSiteAdapterExamples(adapter: SiteAdapterDefinition): string[] {
  const example = normalizeText(adapter.example);
  return example ? [example] : [];
}

function resolveSiteAdapterOutputDestination(): string {
  return "结果会优先写回当前内容；如果当前内容不可用，再沉淀为项目资源。";
}

function resolveSiteAdapterArgLabel(argName: string, description?: string): string {
  if (SITE_ADAPTER_ARG_LABEL_OVERRIDES[argName]) {
    return SITE_ADAPTER_ARG_LABEL_OVERRIDES[argName]!;
  }
  const normalizedDescription = normalizeText(description);
  if (normalizedDescription && normalizedDescription.length <= 12) {
    return normalizedDescription;
  }
  return argName
    .split(/[_-]/)
    .map(titleCaseSegment)
    .join(" ");
}

function stringifySiteAdapterDefaultValue(value: unknown): string | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return undefined;
}

function buildSiteAdapterSlotSchema(
  adapter: SiteAdapterDefinition,
): ServiceSkillSlotDefinition[] {
  const schema = isPlainRecord(adapter.input_schema) ? adapter.input_schema : null;
  const properties = isPlainRecord(schema?.properties) ? schema.properties : null;
  const requiredSet = new Set(
    Array.isArray(schema?.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [],
  );
  const exampleArgs = isPlainRecord(adapter.example_args) ? adapter.example_args : {};
  const keys = properties
    ? Object.keys(properties)
    : Object.keys(exampleArgs);

  return keys.map((key) => {
    const property = properties && isPlainRecord(properties[key]) ? properties[key] : null;
    const description = normalizeText(property?.description);
    const example =
      property?.example !== undefined ? property.example : exampleArgs[key];
    const slotType =
      /url|link/i.test(key) || /链接|地址/.test(description ?? "")
        ? "url"
        : "text";

    return {
      key,
      label: resolveSiteAdapterArgLabel(key, description ?? undefined),
      type: slotType,
      required: requiredSet.has(key),
      placeholder:
        description ?? `输入${resolveSiteAdapterArgLabel(key, description ?? undefined)}`,
      defaultValue: stringifySiteAdapterDefaultValue(example),
      helpText: description ?? undefined,
    };
  });
}

function buildSiteAdapterSlotArgMap(
  slotSchema: ServiceSkillSlotDefinition[],
): Record<string, string> | undefined {
  if (slotSchema.length === 0) {
    return undefined;
  }

  return slotSchema.reduce<Record<string, string>>((acc, slot) => {
    acc[slot.key] = slot.key;
    return acc;
  }, {});
}

function buildSiteAdapterSkillItem(
  adapter: SiteAdapterDefinition,
): SkillCatalogItem {
  const id = normalizeSiteAdapterId(adapter.name);
  const slotSchema = buildSiteAdapterSlotSchema(adapter);
  const groupKey = resolveAdapterGroupKey(adapter.name);
  const summary = sanitizeSentence(adapter.description, "站点采集技能。");

  return {
    id,
    skillKey: id,
    skillType: "site",
    title: resolveSiteAdapterTitle(adapter),
    summary,
    entryHint: resolveSiteAdapterEntryHint(adapter),
    aliases: resolveSiteAdapterAliases(adapter),
    category: resolveSiteAdapterCategory(adapter),
    outputHint: resolveSiteAdapterOutputHint(adapter),
    triggerHints: [
      sanitizeSentence(adapter.description, "需要站点采集时使用。"),
      "适合复用当前浏览器里的真实登录态直接抓一轮结构化结果。",
    ],
    source: "cloud_catalog",
    runnerType: "instant",
    defaultExecutorBinding: "browser_assist",
    executionLocation: "client_default",
    defaultArtifactKind: "analysis",
    readinessRequirements: {
      requiresBrowser: true,
      requiresProject: true,
    },
    usageGuidelines: resolveSiteAdapterUsageGuidelines(adapter),
    setupRequirements: resolveSiteAdapterSetupRequirements(adapter),
    examples: resolveSiteAdapterExamples(adapter),
    outputDestination: resolveSiteAdapterOutputDestination(),
    siteCapabilityBinding: {
      adapterName: adapter.name,
      autoRun: true,
      requireAttachedSession: true,
      saveMode: "current_content",
      slotArgMap: buildSiteAdapterSlotArgMap(slotSchema),
    },
    slotSchema,
    surfaceScopes: ["home", "mention", "workspace"],
    themeTarget: resolveSiteAdapterThemeTarget(adapter),
    version: adapter.source_version || SEEDED_SKILL_CATALOG_VERSION,
    groupKey,
    execution: {
      kind: "site_adapter",
      siteAdapterBinding: {
        adapterName: adapter.name,
        autoRun: true,
        requireAttachedSession: true,
        saveMode: "current_content",
        slotArgMap: buildSiteAdapterSlotArgMap(slotSchema),
      },
    },
  };
}

function buildFallbackGroupPreset(groupKey: string): Omit<SkillCatalogGroup, "itemCount"> {
  const title = resolveGroupTitle(groupKey);
  return {
    key: groupKey,
    title,
    summary: `围绕 ${title} 的只读站点技能入口，适合直接复用真实页面上下文采集结果。`,
    entryHint: `先进入 ${title} 技能组，再选择具体技能项开始采集。`,
    themeTarget: "knowledge",
    sort: 80,
  };
}

function mergeCatalogGroups(
  currentGroups: SkillCatalogGroup[],
  items: SkillCatalogItem[],
): SkillCatalogGroup[] {
  const itemCountByGroup = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.groupKey] = (acc[item.groupKey] ?? 0) + 1;
    return acc;
  }, {});
  const groupsByKey = new Map<string, SkillCatalogGroup>();

  for (const group of currentGroups) {
    groupsByKey.set(group.key, {
      ...group,
      itemCount: itemCountByGroup[group.key] ?? group.itemCount ?? 0,
    });
  }

  for (const groupKey of Object.keys(itemCountByGroup)) {
    if (groupsByKey.has(groupKey)) {
      continue;
    }

    const preset =
      resolveKnownGroupPreset(groupKey) ?? buildFallbackGroupPreset(groupKey);
    groupsByKey.set(groupKey, {
      ...preset,
      itemCount: itemCountByGroup[groupKey] ?? 0,
    });
  }

  return Array.from(groupsByKey.values())
    .filter((group) => group.itemCount > 0)
    .sort((left, right) => left.sort - right.sort);
}

async function mergeRuntimeSiteAdaptersIntoCatalog(
  catalog: SkillCatalog,
): Promise<SkillCatalog> {
  try {
    const adapters = await siteListAdapters();
    const existingAdapterNames = new Set(
      catalog.items
        .map((item) => normalizeText(item.siteCapabilityBinding?.adapterName))
        .filter((item): item is string => Boolean(item))
        .map((item) => item.toLowerCase()),
    );

    const synthesizedItems = adapters
      .filter((adapter) => {
        const normalizedName = adapter.name.trim().toLowerCase();
        return !existingAdapterNames.has(normalizedName);
      })
      .map((adapter) => buildSiteAdapterSkillItem(adapter));

    if (synthesizedItems.length === 0) {
      return catalog;
    }

    const mergedItems = [...catalog.items, ...synthesizedItems];
    const mergedGroups = mergeCatalogGroups(catalog.groups, mergedItems);

    return cloneSkillCatalog({
      ...catalog,
      groups: mergedGroups,
      items: mergedItems,
    });
  } catch {
    return catalog;
  }
}

function parseSkillCatalogExecution(value: unknown): SkillCatalogExecution | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const kind = normalizeText(value.kind);
  if (
    kind !== "native_skill" &&
    kind !== "agent_turn" &&
    kind !== "automation_job" &&
    kind !== "cloud_scene" &&
    kind !== "site_adapter"
  ) {
    return null;
  }

  const siteAdapterBindingEnvelope =
    value.siteAdapterBinding === undefined
      ? undefined
      : parseServiceSkillCatalog({
          version: "__internal__",
          tenantId: "__internal__",
          syncedAt: "__internal__",
          items: [
            {
              id: "__internal__",
              title: "__internal__",
              summary: "__internal__",
              category: "__internal__",
              outputHint: "__internal__",
              source: "cloud_catalog",
              runnerType: "instant",
              defaultExecutorBinding: "browser_assist",
              executionLocation: "client_default",
              slotSchema: [],
              siteCapabilityBinding: value.siteAdapterBinding,
              version: "__internal__",
            },
          ],
        });

  return {
    kind,
    siteAdapterBinding: siteAdapterBindingEnvelope?.items[0]?.siteCapabilityBinding,
  };
}

function parseSkillCatalogItem(value: unknown): SkillCatalogItem | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const groupKey = normalizeText(value.groupKey);
  if (!groupKey) {
    return null;
  }
  const execution = parseSkillCatalogExecution(value.execution);
  if (!execution) {
    return null;
  }

  const serviceSkillCandidate = {
    ...value,
  };
  delete (serviceSkillCandidate as Record<string, unknown>).groupKey;
  delete (serviceSkillCandidate as Record<string, unknown>).execution;

  const parsed = parseServiceSkillCatalog({
    version: "__internal__",
    tenantId: "__internal__",
    syncedAt: "__internal__",
    items: [serviceSkillCandidate],
  });
  const item = parsed?.items[0];
  if (!item) {
    return null;
  }

  return {
    ...item,
    groupKey,
    execution,
  };
}

function parseSkillCatalogGroup(value: unknown): SkillCatalogGroup | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const key = normalizeText(value.key);
  const title = normalizeText(value.title);
  const summary = normalizeText(value.summary);
  if (!key || !title || !summary || typeof value.sort !== "number") {
    return null;
  }

  return {
    key,
    title,
    summary,
    entryHint: normalizeText(value.entryHint) ?? undefined,
    themeTarget: normalizeText(value.themeTarget) ?? undefined,
    sort: value.sort,
    itemCount:
      typeof value.itemCount === "number" && Number.isFinite(value.itemCount)
        ? value.itemCount
        : 0,
  };
}

export function parseSkillCatalog(value: unknown): SkillCatalog | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const version = normalizeText(value.version);
  const tenantId = normalizeText(value.tenantId);
  const syncedAt = normalizeText(value.syncedAt);
  if (!version || !tenantId || !syncedAt) {
    return null;
  }
  if (!Array.isArray(value.groups) || !Array.isArray(value.items)) {
    return null;
  }

  const groups: SkillCatalogGroup[] = [];
  for (const item of value.groups) {
    const parsed = parseSkillCatalogGroup(item);
    if (!parsed) {
      return null;
    }
    groups.push(parsed);
  }

  const items: SkillCatalogItem[] = [];
  for (const item of value.items) {
    const parsed = parseSkillCatalogItem(item);
    if (!parsed) {
      return null;
    }
    items.push(parsed);
  }

  return cloneSkillCatalog({
    version,
    tenantId,
    syncedAt,
    groups,
    items,
  });
}

function persistSkillCatalog(catalog: SkillCatalog): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SKILL_CATALOG_STORAGE_KEY,
      JSON.stringify(catalog),
    );
  } catch {
    // ignore local cache errors
  }
}

function readCachedSkillCatalog(): SkillCatalog | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SKILL_CATALOG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseSkillCatalog(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isSameSkillCatalog(left: SkillCatalog, right: SkillCatalog): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseCatalogSyncedAt(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareCatalogVersion(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isSeededCatalogCompatibleWithActiveTenant(catalog: SkillCatalog): boolean {
  if (isSeededSkillCatalog(catalog)) {
    return true;
  }

  const runtime = resolveOemCloudRuntimeContext();
  if (!runtime) {
    return true;
  }

  return catalog.tenantId === runtime.tenantId;
}

function shouldRefreshSeededSkillCatalog(
  cached: SkillCatalog,
  seeded: SkillCatalog,
): boolean {
  if (cached.tenantId !== seeded.tenantId) {
    return false;
  }

  for (const seededGroup of seeded.groups) {
    const cachedGroup = cached.groups.find((group) => group.key === seededGroup.key);
    if (!cachedGroup || JSON.stringify(cachedGroup) !== JSON.stringify(seededGroup)) {
      return true;
    }
  }

  for (const seededItem of seeded.items) {
    const cachedItem = cached.items.find((item) => item.id === seededItem.id);
    if (!cachedItem || JSON.stringify(cachedItem) !== JSON.stringify(seededItem)) {
      return true;
    }
  }

  return false;
}

function shouldIgnoreServerSyncedCatalog(
  current: SkillCatalog | null,
  incoming: SkillCatalog,
): boolean {
  const runtime = resolveOemCloudRuntimeContext();
  if (runtime && incoming.tenantId !== runtime.tenantId) {
    return true;
  }

  if (!current || current.tenantId !== incoming.tenantId) {
    return false;
  }

  const currentSyncedAt = parseCatalogSyncedAt(current.syncedAt);
  const incomingSyncedAt = parseCatalogSyncedAt(incoming.syncedAt);

  if (currentSyncedAt > 0 && incomingSyncedAt > 0) {
    if (incomingSyncedAt < currentSyncedAt) {
      return true;
    }
    if (incomingSyncedAt > currentSyncedAt) {
      return false;
    }
  }

  return compareCatalogVersion(incoming.version, current.version) < 0;
}

function emitSkillCatalogChanged(source: SkillCatalogChangeSource): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ source: SkillCatalogChangeSource; timestamp: number }>(
      SKILL_CATALOG_CHANGED_EVENT,
      {
        detail: {
          source,
          timestamp: Date.now(),
        },
      },
    ),
  );
}

export function getSeededSkillCatalog(): SkillCatalog {
  return cloneSkillCatalog(SEEDED_SKILL_CATALOG);
}

export function isSeededSkillCatalog(catalog: SkillCatalog): boolean {
  return (
    catalog.tenantId === SEEDED_SKILL_CATALOG.tenantId &&
    catalog.version === SEEDED_SKILL_CATALOG.version
  );
}

export function saveSkillCatalog(
  catalog: SkillCatalog,
  source: Exclude<SkillCatalogChangeSource, "seeded_fallback" | "cache_clear"> = "manual_override",
): SkillCatalog {
  const normalized = parseSkillCatalog(catalog);
  if (!normalized) {
    throw new Error("invalid skill catalog");
  }
  const current = readCachedSkillCatalog();
  if (current && isSameSkillCatalog(current, normalized)) {
    persistSkillCatalog(normalized);
    return normalized;
  }
  persistSkillCatalog(normalized);
  emitSkillCatalogChanged(source);
  return normalized;
}

export function applyServerSyncedSkillCatalog(
  catalog: SkillCatalog,
  source: "bootstrap_sync",
): SkillCatalog {
  const current = readCachedSkillCatalog();
  if (shouldIgnoreServerSyncedCatalog(current, catalog)) {
    return current && isSeededCatalogCompatibleWithActiveTenant(current)
      ? current
      : getSeededSkillCatalog();
  }

  if (current && isSameSkillCatalog(current, catalog)) {
    persistSkillCatalog(catalog);
    return catalog;
  }

  persistSkillCatalog(catalog);
  emitSkillCatalogChanged(source);
  return catalog;
}

export function clearSkillCatalogCache(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SKILL_CATALOG_STORAGE_KEY);
    } catch {
      // ignore local cache errors
    }
  }

  emitSkillCatalogChanged("cache_clear");
}

export function subscribeSkillCatalogChanged(
  callback: (source: SkillCatalogChangeSource) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const customEventHandler = (event: Event) => {
    const customEvent = event as CustomEvent<{
      source?: SkillCatalogChangeSource;
    }>;
    const source = customEvent.detail?.source;
    if (source) {
      callback(source);
    }
  };

  const storageHandler = (event: StorageEvent) => {
    if (event.key !== SKILL_CATALOG_STORAGE_KEY) {
      return;
    }
    callback(event.newValue ? "manual_override" : "cache_clear");
  };

  window.addEventListener(SKILL_CATALOG_CHANGED_EVENT, customEventHandler);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(SKILL_CATALOG_CHANGED_EVENT, customEventHandler);
    window.removeEventListener("storage", storageHandler);
  };
}

async function requestRemoteSkillCatalog(): Promise<SkillCatalog> {
  const runtime = resolveOemCloudRuntimeContext();
  if (!runtime) {
    throw new Error("缺少 OEM 云端配置，请先注入 base_url 与 tenant_id。");
  }
  if (!hasOemCloudSession(runtime)) {
    throw new Error("缺少 OEM 云端 Session Token，请先完成登录或注入会话。");
  }

  const response = await fetch(
    `${runtime.controlPlaneBaseUrl}/v1/public/tenants/${encodeURIComponent(runtime.tenantId)}/client/skills`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${runtime.sessionToken}`,
      },
    },
  );

  let payload: SkillCatalogResponseEnvelope | null = null;
  try {
    payload = (await response.json()) as SkillCatalogResponseEnvelope;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message?.trim() || `请求失败 (${response.status})`);
  }

  const catalog = parseSkillCatalog(payload?.data);
  if (!catalog) {
    throw new Error(payload?.message?.trim() || "服务端返回的技能目录格式非法");
  }

  return catalog;
}

export async function getSkillCatalog(): Promise<SkillCatalog> {
  const seeded = await mergeRuntimeSiteAdaptersIntoCatalog(getSeededSkillCatalog());
  const cached = readCachedSkillCatalog();
  if (cached) {
    if (!isSeededCatalogCompatibleWithActiveTenant(cached)) {
      return seeded;
    }

    if (shouldRefreshSeededSkillCatalog(cached, seeded)) {
      persistSkillCatalog(seeded);
      return seeded;
    }

    const mergedCached = await mergeRuntimeSiteAdaptersIntoCatalog(cached);
    if (!isSameSkillCatalog(cached, mergedCached)) {
      persistSkillCatalog(mergedCached);
    }
    return mergedCached;
  }

  persistSkillCatalog(seeded);
  return seeded;
}

export async function refreshSkillCatalogFromRemote(): Promise<SkillCatalog | null> {
  const runtime = resolveOemCloudRuntimeContext();
  if (!runtime || !hasOemCloudSession(runtime)) {
    return null;
  }

  const catalog = await requestRemoteSkillCatalog();
  const mergedCatalog = await mergeRuntimeSiteAdaptersIntoCatalog(catalog);
  return applyServerSyncedSkillCatalog(mergedCatalog, "bootstrap_sync");
}
