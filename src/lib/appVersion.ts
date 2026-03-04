function normalizeVersion(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "unknown") return null;
  return trimmed;
}

export function resolveAppVersion(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const normalized = normalizeVersion(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "unknown";
}

export function getRuntimeAppVersion(explicit?: string): string {
  return resolveAppVersion(
    explicit,
    import.meta.env.VITE_APP_VERSION as string | undefined,
  );
}
