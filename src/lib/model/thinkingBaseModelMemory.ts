type ThinkingMemoryScope = "aster" | "general";

const STORAGE_KEY = "proxycast.thinking.base_model_memory.v1";

type ThinkingBaseModelMap = Record<string, string>;

const readMemoryMap = (): ThinkingBaseModelMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ThinkingBaseModelMap;
  } catch {
    return {};
  }
};

const writeMemoryMap = (memoryMap: ThinkingBaseModelMap): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryMap));
  } catch {
    // ignore persistence errors
  }
};

const normalizeSegment = (value?: string | null): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "__none__";
};

const buildMemoryKey = (
  scope: ThinkingMemoryScope,
  workspaceId: string | null | undefined,
  sessionId: string | null | undefined,
  providerKey: string | null | undefined,
): string => {
  return [
    scope,
    normalizeSegment(workspaceId),
    normalizeSegment(sessionId),
    normalizeSegment(providerKey),
  ].join("|");
};

export function loadRememberedBaseModel(params: {
  scope: ThinkingMemoryScope;
  workspaceId?: string | null;
  sessionId?: string | null;
  providerKey?: string | null;
}): string | null {
  const memoryMap = readMemoryMap();
  const key = buildMemoryKey(
    params.scope,
    params.workspaceId,
    params.sessionId,
    params.providerKey,
  );
  const value = memoryMap[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function saveRememberedBaseModel(params: {
  scope: ThinkingMemoryScope;
  workspaceId?: string | null;
  sessionId?: string | null;
  providerKey?: string | null;
  modelId: string;
}): void {
  const normalizedModelId = params.modelId.trim();
  if (!normalizedModelId) return;
  const memoryMap = readMemoryMap();
  const key = buildMemoryKey(
    params.scope,
    params.workspaceId,
    params.sessionId,
    params.providerKey,
  );
  memoryMap[key] = normalizedModelId;
  writeMemoryMap(memoryMap);
}

export function clearRememberedBaseModel(params: {
  scope: ThinkingMemoryScope;
  workspaceId?: string | null;
  sessionId?: string | null;
  providerKey?: string | null;
}): void {
  const memoryMap = readMemoryMap();
  const key = buildMemoryKey(
    params.scope,
    params.workspaceId,
    params.sessionId,
    params.providerKey,
  );
  if (!(key in memoryMap)) return;
  delete memoryMap[key];
  writeMemoryMap(memoryMap);
}
