const LEGACY_DECISION_PREFIX_RE = /^已决定[:：]\s*/;

export function normalizeLegacyRuntimeStatusTitle(title: string): string {
  return title.replace(LEGACY_DECISION_PREFIX_RE, "").trim();
}

export function normalizeLegacyTurnSummaryText(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return "";
  }

  const [firstLine = "", ...rest] = normalized.split(/\r?\n/);
  const normalizedFirstLine = normalizeLegacyRuntimeStatusTitle(firstLine);

  if (rest.length === 0) {
    return normalizedFirstLine;
  }

  return [normalizedFirstLine, ...rest].filter((line, index) => index > 0 || line).join("\n");
}

export function normalizeLegacyThreadItem<T extends { type?: unknown; text?: unknown }>(
  item: T,
): T {
  if (item.type !== "turn_summary" || typeof item.text !== "string") {
    return item;
  }

  return {
    ...item,
    text: normalizeLegacyTurnSummaryText(item.text),
  };
}

export function normalizeLegacyThreadItems<
  T extends { type?: unknown; text?: unknown },
>(items: T[]): T[] {
  return items.map((item) => normalizeLegacyThreadItem(item));
}
