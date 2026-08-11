/*
 * [RoadSafe:DevOfflineCacheV1Exact]
 *
 * Development-only persistence/fallback layer.
 *
 * Security boundary:
 * - passwords are never cached
 * - Appwrite session secrets/tokens are never cached
 * - only already-resolved application identity and application data are cached
 * - enabled automatically in Vite development mode
 *
 * This is a development resilience feature, not production authentication.
 */

const PREFIX =
  "roadsafe:dev-offline:v1:";

const explicitFlag =
  String(
    import.meta.env
      .VITE_ROADSAFE_DEV_OFFLINE_CACHE ??
      "",
  )
    .trim()
    .toLowerCase();

const enabled =
  import.meta.env.DEV ||
  explicitFlag === "true";

interface CacheEnvelope<T> {
  version: 1;
  savedAt: string;
  value: T;
}

function storageAvailable(): boolean {
  return (
    enabled &&
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function fullKey(
  key: string,
): string {
  return `${PREFIX}${key}`;
}

function read<T>(
  key: string,
): T | null {
  if (!storageAvailable()) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        fullKey(key),
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as
        CacheEnvelope<T>;

    if (
      !parsed ||
      parsed.version !== 1 ||
      !("value" in parsed)
    ) {
      return null;
    }

    return parsed.value;
  } catch (error) {
    console.warn(
      `RoadSafe DEV cache could not read "${key}".`,
      error,
    );

    return null;
  }
}

function write<T>(
  key: string,
  value: T,
): void {
  if (!storageAvailable()) {
    return;
  }

  try {
    const envelope:
      CacheEnvelope<T> = {
        version: 1,
        savedAt:
          new Date().toISOString(),
        value,
      };

    window.localStorage.setItem(
      fullKey(key),
      JSON.stringify(envelope),
    );
  } catch (error) {
    console.warn(
      `RoadSafe DEV cache could not write "${key}".`,
      error,
    );
  }
}

function remove(
  key: string,
): void {
  if (!storageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(
      fullKey(key),
    );
  } catch {
    // Cache cleanup must never block the app.
  }
}

function scoped(
  base: string,
  scope: string,
): string {
  return (
    `${base}:` +
    encodeURIComponent(
      scope.trim() || "default",
    )
  );
}

function canFallback(
  error: unknown,
): boolean {
  if (!enabled) {
    return false;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    return true;
  }

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error);

  const normalised =
    message.toLowerCase();

  if (
    normalised.includes("failed to fetch") ||
    normalised.includes("fetch failed") ||
    normalised.includes("networkerror") ||
    normalised.includes("network error") ||
    normalised.includes("load failed") ||
    normalised.includes("offline") ||
    normalised.includes("connection") ||
    normalised.includes("timed out") ||
    normalised.includes("timeout") ||
    /status\s+5\d\d/.test(normalised)
  ) {
    return true;
  }

  const maybeCode =
    Number(
      (
        error as {
          code?: unknown;
        }
      )?.code,
    );

  return (
    maybeCode === 0 ||
    maybeCode >= 500
  );
}

function clearAll(): void {
  if (!storageAvailable()) {
    return;
  }

  const keys: string[] = [];

  for (
    let index = 0;
    index <
    window.localStorage.length;
    index += 1
  ) {
    const key =
      window.localStorage.key(
        index,
      );

    if (
      key?.startsWith(PREFIX)
    ) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    window.localStorage.removeItem(
      key,
    );
  }
}

export const DEV_OFFLINE_CACHE_KEYS = {
  authIdentity:
    "auth:identity",
  officerList:
    "officers:list",
  cloudCaseList:
    "cases:cloud-list",
  pendingCaseQueue:
    "cases:pending-queue",
} as const;

export const DevOfflineCache = {
  enabled,
  read,
  write,
  remove,
  scoped,
  canFallback,
  clearAll,
} as const;
