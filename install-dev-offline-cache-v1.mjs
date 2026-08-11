import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const FILES = {
  auth: "src/context/AuthContext.tsx",
  officers: "src/services/officerManagementService.ts",
  cases: "src/services/roadSafeCaseFunctionService.ts",
  bridge: "src/services/caseCloudBridge.ts",
  cache: "src/services/devOfflineCache.ts",
};

const MARKER = "[RoadSafe:DevOfflineCacheV1]";

function abs(rel) {
  return path.join(ROOT, ...rel.split("/"));
}

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) {
    return source;
  }

  const first = source.indexOf(before);

  if (first < 0) {
    fail(`Could not locate ${label}. No files were changed.`);
  }

  const second = source.indexOf(before, first + before.length);

  if (second >= 0) {
    fail(`${label} is ambiguous. No files were changed.`);
  }

  return (
    source.slice(0, first) +
    after +
    source.slice(first + before.length)
  );
}

for (const rel of [
  FILES.auth,
  FILES.officers,
  FILES.cases,
  FILES.bridge,
]) {
  if (!fs.existsSync(abs(rel))) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }
}

const originals = new Map();

for (const rel of Object.values(FILES)) {
  if (fs.existsSync(abs(rel))) {
    originals.set(rel, fs.readFileSync(abs(rel), "utf8"));
  }
}

let auth = fs.readFileSync(abs(FILES.auth), "utf8");
let officers = fs.readFileSync(abs(FILES.officers), "utf8");
let cases = fs.readFileSync(abs(FILES.cases), "utf8");
let bridge = fs.readFileSync(abs(FILES.bridge), "utf8");

if (
  auth.includes(MARKER) &&
  officers.includes(MARKER) &&
  cases.includes(MARKER) &&
  bridge.includes(MARKER) &&
  fs.existsSync(abs(FILES.cache))
) {
  console.log("");
  console.log("[RoadSafe] Dev Offline Cache V1 is already installed.");
  process.exit(0);
}

/* ========================================================================== */
/* New generic dev cache service                                              */
/* ========================================================================== */

const cacheService = `/*
 * ${MARKER}
 *
 * Development-only persistence/fallback layer.
 *
 * Security boundary:
 * - never stores passwords
 * - never stores Appwrite session secrets/tokens
 * - caches only already-resolved application identity/data
 * - enabled automatically by Vite DEV mode
 * - production can opt in only with VITE_ROADSAFE_DEV_OFFLINE_CACHE=true
 *
 * This is intentionally a development resilience feature, not a production
 * authentication mechanism.
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
    typeof window.localStorage !==
      "undefined"
  );
}

function fullKey(
  key: string,
): string {
  return \`\${PREFIX}\${key}\`;
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
      \`RoadSafe DEV cache could not read "\${key}".\`,
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
      \`RoadSafe DEV cache could not write "\${key}".\`,
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
    // Development cache cleanup must never block the app.
  }
}

function scoped(
  base: string,
  scope: string,
): string {
  return (
    \`\${base}:\` +
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
      ? \`\${error.name} \${error.message}\`
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
    /status\\s+5\\d\\d/.test(normalised)
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
`;

/* ========================================================================== */
/* AuthContext                                                                */
/* ========================================================================== */

if (!auth.includes(MARKER)) {
  auth = replaceOnce(
    auth,
`import type {
  AuthStatus,
  RoadSafeIdentity,
  RoadSafeRole,
} from "../types/auth";`,
`import type {
  AuthStatus,
  RoadSafeIdentity,
  RoadSafeRole,
} from "../types/auth";

import {
  DEV_OFFLINE_CACHE_KEYS,
  DevOfflineCache,
} from "../services/devOfflineCache";`,
    "AuthContext cache import",
  );

  auth = replaceOnce(
    auth,
`  const [status, setStatus] =
    useState<AuthStatus>("loading");
  const [identity, setIdentity] =
    useState<RoadSafeIdentity | null>(
      null,
    );`,
`  /*
   * ${MARKER}
   *
   * Hydrate the last successfully-resolved application identity immediately.
   * No password or Appwrite session token is cached.
   */
  const [identity, setIdentity] =
    useState<RoadSafeIdentity | null>(
      () =>
        DevOfflineCache.read<RoadSafeIdentity>(
          DEV_OFFLINE_CACHE_KEYS.authIdentity,
        ),
    );

  const [status, setStatus] =
    useState<AuthStatus>(
      () =>
        DevOfflineCache.read<RoadSafeIdentity>(
          DEV_OFFLINE_CACHE_KEYS.authIdentity,
        )
          ? "authenticated"
          : "loading",
    );`,
    "AuthContext initial auth state",
  );

  auth = replaceOnce(
    auth,
`      if (
        !appwriteConfig.configured
      ) {
        setIdentity(null);
        setStatus(
          "configuration-error",
        );
        setError(
          "Appwrite is not configured. Add VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID to the .env file.",
        );
        return;
      }

      setStatus("loading");
      setError("");`,
`      const cachedIdentity =
        DevOfflineCache.read<RoadSafeIdentity>(
          DEV_OFFLINE_CACHE_KEYS.authIdentity,
        );

      if (
        !appwriteConfig.configured
      ) {
        if (
          DevOfflineCache.enabled &&
          cachedIdentity
        ) {
          setIdentity(
            cachedIdentity,
          );
          setStatus(
            "authenticated",
          );
          setError("");

          console.warn(
            "RoadSafe DEV offline auth: Appwrite is not configured; using the cached identity.",
          );

          return;
        }

        setIdentity(null);
        setStatus(
          "configuration-error",
        );
        setError(
          "Appwrite is not configured. Add VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID to the .env file.",
        );
        return;
      }

      if (!cachedIdentity) {
        setStatus("loading");
      }

      setError("");`,
    "AuthContext refresh setup",
  );

  auth = replaceOnce(
    auth,
`        setIdentity({
          user: resolved.user,
          role:
            resolved.access?.role ??
            "unassigned",
          stationTeam:
            resolved.access?.team ??
            null,
          membership:
            resolved.access
              ?.membership ??
            null,
        });

        setStatus(
          "authenticated",
        );`,
`        const nextIdentity:
          RoadSafeIdentity = {
            user: resolved.user,
            role:
              resolved.access?.role ??
              "unassigned",
            stationTeam:
              resolved.access?.team ??
              null,
            membership:
              resolved.access
                ?.membership ??
              null,
          };

        setIdentity(
          nextIdentity,
        );

        DevOfflineCache.write(
          DEV_OFFLINE_CACHE_KEYS.authIdentity,
          nextIdentity,
        );

        setStatus(
          "authenticated",
        );`,
    "AuthContext successful identity cache",
  );

  auth = replaceOnce(
    auth,
`        if (
          requestError instanceof
            AppwriteException &&
          requestError.code === 401
        ) {
          setIdentity(null);
          setStatus(
            "unauthenticated",
          );
          setError("");
          return;
        }

        setIdentity(null);
        setStatus(
          "unauthenticated",
        );
        setError(
          errorMessage(
            requestError,
          ),
        );`,
`        if (
          requestError instanceof
            AppwriteException &&
          requestError.code === 401
        ) {
          DevOfflineCache.remove(
            DEV_OFFLINE_CACHE_KEYS.authIdentity,
          );

          setIdentity(null);
          setStatus(
            "unauthenticated",
          );
          setError("");
          return;
        }

        const offlineIdentity =
          DevOfflineCache.read<RoadSafeIdentity>(
            DEV_OFFLINE_CACHE_KEYS.authIdentity,
          );

        if (
          offlineIdentity &&
          DevOfflineCache.canFallback(
            requestError,
          )
        ) {
          setIdentity(
            offlineIdentity,
          );
          setStatus(
            "authenticated",
          );
          setError("");

          console.warn(
            "RoadSafe DEV offline auth: live identity refresh failed; continuing with cached identity.",
            requestError,
          );

          return;
        }

        setIdentity(null);
        setStatus(
          "unauthenticated",
        );
        setError(
          errorMessage(
            requestError,
          ),
        );`,
    "AuthContext offline fallback",
  );

  auth = replaceOnce(
    auth,
`      } finally {
        setIdentity(null);
        setStatus(
          "unauthenticated",
        );
        setError("");
      }`,
`      } finally {
        DevOfflineCache.remove(
          DEV_OFFLINE_CACHE_KEYS.authIdentity,
        );

        setIdentity(null);
        setStatus(
          "unauthenticated",
        );
        setError("");
      }`,
    "AuthContext sign-out cache cleanup",
  );

  auth = replaceOnce(
    auth,
`        configured:
          appwriteConfig.configured,`,
`        configured:
          appwriteConfig.configured ||
          (
            DevOfflineCache.enabled &&
            Boolean(identity)
          ),`,
    "AuthContext configured flag",
  );
}

/* ========================================================================== */
/* Managed officer cache + DEV offline simulation                             */
/* ========================================================================== */

if (!officers.includes(MARKER)) {
  officers = replaceOnce(
    officers,
`import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";`,
`import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";

import {
  DEV_OFFLINE_CACHE_KEYS,
  DevOfflineCache,
} from "./devOfflineCache";`,
    "OfficerManagementService cache import",
  );

  const exportStart =
    officers.indexOf(
      "export const OfficerManagementService = {",
    );

  if (exportStart < 0) {
    fail(
      "Could not locate OfficerManagementService export. No files were changed.",
    );
  }

  const officerReplacement = `/*
 * ${MARKER}
 *
 * Managed-officer reads are network-first and cached per Team.
 * In DEV only, failed network mutations can be simulated against the local
 * cached list so the management workspace remains testable offline.
 *
 * Those simulated mutations do NOT create/update a real Appwrite account.
 */
function officerCacheKey(
  teamId: string,
): string {
  return DevOfflineCache.scoped(
    DEV_OFFLINE_CACHE_KEYS.officerList,
    teamId,
  );
}

function readCachedOfficers(
  teamId: string,
): ManagedOfficer[] | null {
  return DevOfflineCache.read<ManagedOfficer[]>(
    officerCacheKey(teamId),
  );
}

function writeCachedOfficers(
  teamId: string,
  officers: ManagedOfficer[],
): void {
  DevOfflineCache.write(
    officerCacheKey(teamId),
    officers,
  );
}

function upsertCachedOfficer(
  teamId: string,
  officer: ManagedOfficer,
): void {
  const current =
    readCachedOfficers(teamId) ??
    [];

  const index =
    current.findIndex(
      (candidate) =>
        candidate.userId ===
        officer.userId,
    );

  const next =
    [...current];

  if (index >= 0) {
    next[index] = officer;
  } else {
    next.push(officer);
  }

  writeCachedOfficers(
    teamId,
    next,
  );
}

function requireCachedOfficer(
  teamId: string,
  officer: Pick<
    ManagedOfficer,
    "userId" | "membershipId"
  >,
): ManagedOfficer | null {
  return (
    readCachedOfficers(teamId)
      ?.find(
        (candidate) =>
          candidate.userId ===
            officer.userId ||
          candidate.membershipId ===
            officer.membershipId,
      ) ??
    null
  );
}

function createDevOfficer(
  input: CreateOfficerInput,
): TemporaryOfficerCredential {
  const now =
    new Date().toISOString();

  const suffix =
    \`\${Date.now()}-\${Math.random()
      .toString(36)
      .slice(2, 7)}\`;

  const officer:
    ManagedOfficer = {
      userId:
        \`dev-offline-user-\${suffix}\`,
      membershipId:
        \`dev-offline-membership-\${suffix}\`,
      teamId:
        input.teamId,
      name:
        input.name.trim(),
      email:
        input.email
          .trim()
          .toLowerCase(),
      phone:
        input.phone?.trim() ??
        "",
      serviceNumber:
        input.serviceNumber.trim(),
      rank:
        input.rank,
      role:
        input.role,
      roles: [
        input.role,
      ],
      status:
        "active",
      joinedAt:
        now,
      registeredAt:
        now,
      lastActivityAt:
        now,
      mustChangePassword:
        true,
      avatarFileId:
        "",
    };

  upsertCachedOfficer(
    input.teamId,
    officer,
  );

  return {
    officer,
    temporaryPassword:
      \`DEV-OFFLINE-\${Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase()}\`,
  };
}

export const OfficerManagementService = {
  async list(
    teamId: string,
  ): Promise<ManagedOfficer[]> {
    try {
      const response =
        await execute({
          action:
            "list_officers",
          teamId,
        });

      const live =
        response.officers ??
        [];

      /*
       * Preserve intentionally-created DEV-only mock officers across a later
       * live list refresh. They are clearly identified by their local ID.
       */
      const cachedDevOnly =
        (
          readCachedOfficers(
            teamId,
          ) ??
          []
        ).filter(
          (officer) =>
            officer.userId.startsWith(
              "dev-offline-user-",
            ),
        );

      const liveIds =
        new Set(
          live.map(
            (officer) =>
              officer.userId,
          ),
        );

      const merged = [
        ...live,
        ...cachedDevOnly.filter(
          (officer) =>
            !liveIds.has(
              officer.userId,
            ),
        ),
      ];

      writeCachedOfficers(
        teamId,
        merged,
      );

      return merged;
    } catch (requestError) {
      const cached =
        readCachedOfficers(
          teamId,
        );

      if (
        cached &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        console.warn(
          "RoadSafe DEV offline officers: returning cached officer list.",
          requestError,
        );

        return cached;
      }

      throw requestError;
    }
  },

  async create(
    input: CreateOfficerInput,
  ): Promise<TemporaryOfficerCredential> {
    try {
      const response =
        await execute({
          action:
            "create_officer",
          teamId:
            input.teamId,
          officer:
            input,
        });

      if (!response.officer) {
        throw new Error(
          "The Function did not return the newly created officer.",
        );
      }

      if (
        response.temporaryPassword
      ) {
        upsertCachedOfficer(
          input.teamId,
          response.officer,
        );

        return {
          officer:
            response.officer,
          temporaryPassword:
            response.temporaryPassword,
        };
      }

      const recovery =
        await execute({
          action:
            "reset_password",
          teamId:
            input.teamId,
          userId:
            response.officer.userId,
          membershipId:
            response.officer
              .membershipId,
        });

      if (
        !recovery.officer ||
        !recovery.temporaryPassword
      ) {
        throw new Error(
          "The officer was created, but RoadSafe could not issue recoverable temporary credentials.",
        );
      }

      upsertCachedOfficer(
        input.teamId,
        recovery.officer,
      );

      return {
        officer:
          recovery.officer,
        temporaryPassword:
          recovery.temporaryPassword,
      };
    } catch (requestError) {
      if (
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        console.warn(
          "RoadSafe DEV offline officers: simulating officer creation locally. No Appwrite user was created.",
          requestError,
        );

        return createDevOfficer(
          input,
        );
      }

      throw requestError;
    }
  },

  async updateRole(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      "userId" | "membershipId"
    >,
    role: ManagedOfficerRole,
  ): Promise<ManagedOfficer> {
    try {
      const response =
        await execute({
          action:
            "update_role",
          teamId,
          userId:
            officer.userId,
          membershipId:
            officer.membershipId,
          role,
        });

      if (!response.officer) {
        throw new Error(
          "The updated officer record was not returned.",
        );
      }

      upsertCachedOfficer(
        teamId,
        response.officer,
      );

      return response.officer;
    } catch (requestError) {
      const cached =
        requireCachedOfficer(
          teamId,
          officer,
        );

      if (
        cached &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        const updated:
          ManagedOfficer = {
            ...cached,
            role,
            roles: [
              role,
            ],
            lastActivityAt:
              new Date().toISOString(),
          };

        upsertCachedOfficer(
          teamId,
          updated,
        );

        console.warn(
          "RoadSafe DEV offline officers: role update is local simulation only.",
        );

        return updated;
      }

      throw requestError;
    }
  },

  async setStatus(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      "userId" | "membershipId"
    >,
    status: boolean,
  ): Promise<ManagedOfficer> {
    try {
      const response =
        await execute({
          action:
            "set_status",
          teamId,
          userId:
            officer.userId,
          membershipId:
            officer.membershipId,
          status,
        });

      if (!response.officer) {
        throw new Error(
          "The updated officer record was not returned.",
        );
      }

      upsertCachedOfficer(
        teamId,
        response.officer,
      );

      return response.officer;
    } catch (requestError) {
      const cached =
        requireCachedOfficer(
          teamId,
          officer,
        );

      if (
        cached &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        const updated:
          ManagedOfficer = {
            ...cached,
            status:
              status
                ? "active"
                : "blocked",
            lastActivityAt:
              new Date().toISOString(),
          };

        upsertCachedOfficer(
          teamId,
          updated,
        );

        console.warn(
          "RoadSafe DEV offline officers: status update is local simulation only.",
        );

        return updated;
      }

      throw requestError;
    }
  },

  async resetPassword(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      "userId" | "membershipId"
    >,
  ): Promise<TemporaryOfficerCredential> {
    try {
      const response =
        await execute({
          action:
            "reset_password",
          teamId,
          userId:
            officer.userId,
          membershipId:
            officer.membershipId,
        });

      if (
        !response.officer ||
        !response.temporaryPassword
      ) {
        throw new Error(
          "The password was reset without returning temporary credentials.",
        );
      }

      upsertCachedOfficer(
        teamId,
        response.officer,
      );

      return {
        officer:
          response.officer,
        temporaryPassword:
          response.temporaryPassword,
      };
    } catch (requestError) {
      const cached =
        requireCachedOfficer(
          teamId,
          officer,
        );

      if (
        cached &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        console.warn(
          "RoadSafe DEV offline officers: password reset is simulated and does not change Appwrite credentials.",
        );

        return {
          officer:
            cached,
          temporaryPassword:
            \`DEV-OFFLINE-RESET-\${Math.random()
              .toString(36)
              .slice(2, 8)
              .toUpperCase()}\`,
        };
      }

      throw requestError;
    }
  },

  async remove(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      "userId" | "membershipId"
    >,
  ): Promise<void> {
    try {
      await execute({
        action:
          "remove_officer",
        teamId,
        userId:
          officer.userId,
        membershipId:
          officer.membershipId,
      });

      const next =
        (
          readCachedOfficers(
            teamId,
          ) ??
          []
        ).filter(
          (candidate) =>
            candidate.userId !==
              officer.userId &&
            candidate.membershipId !==
              officer.membershipId,
        );

      writeCachedOfficers(
        teamId,
        next,
      );
    } catch (requestError) {
      if (
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        const cached =
          readCachedOfficers(
            teamId,
          ) ??
          [];

        const exists =
          cached.some(
            (candidate) =>
              candidate.userId ===
                officer.userId ||
              candidate.membershipId ===
                officer.membershipId,
          );

        if (!exists) {
          throw requestError;
        }

        writeCachedOfficers(
          teamId,
          cached.filter(
            (candidate) =>
              candidate.userId !==
                officer.userId &&
              candidate.membershipId !==
                officer.membershipId,
          ),
        );

        console.warn(
          "RoadSafe DEV offline officers: removal is local simulation only.",
        );

        return;
      }

      throw requestError;
    }
  },
};
`;

  officers =
    officers.slice(
      0,
      exportStart,
    ) +
    officerReplacement;
}

/* ========================================================================== */
/* Cloud case reads cached; cloud writes remain real writes                   */
/* ========================================================================== */

if (!cases.includes(MARKER)) {
  cases = replaceOnce(
    cases,
`import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";`,
`import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";

import {
  DEV_OFFLINE_CACHE_KEYS,
  DevOfflineCache,
} from "./devOfflineCache";`,
    "RoadSafeCaseFunctionService cache import",
  );

  const exportStart =
    cases.indexOf(
      "export const RoadSafeCaseFunctionService = {",
    );

  if (exportStart < 0) {
    fail(
      "Could not locate RoadSafeCaseFunctionService export. No files were changed.",
    );
  }

  const caseReplacement = `/*
 * ${MARKER}
 *
 * Cloud-case reads use the last successful Team snapshot while offline.
 * Writes deliberately do NOT pretend to succeed: CaseCloudBridge keeps them
 * queued until a real server write succeeds.
 */
function cloudCaseCacheKey(
  teamId: string,
): string {
  return DevOfflineCache.scoped(
    DEV_OFFLINE_CACHE_KEYS.cloudCaseList,
    teamId,
  );
}

function readCachedCloudCases(
  teamId: string,
): AccidentCase[] | null {
  return DevOfflineCache.read<AccidentCase[]>(
    cloudCaseCacheKey(teamId),
  );
}

function writeCachedCloudCases(
  teamId: string,
  records: AccidentCase[],
): void {
  DevOfflineCache.write(
    cloudCaseCacheKey(teamId),
    records,
  );
}

function upsertCachedCloudCase(
  teamId: string,
  record: AccidentCase,
): void {
  const current =
    readCachedCloudCases(
      teamId,
    ) ??
    [];

  const index =
    current.findIndex(
      (candidate) =>
        candidate.id ===
        record.id,
    );

  const next =
    [...current];

  if (index >= 0) {
    next[index] = record;
  } else {
    next.push(record);
  }

  writeCachedCloudCases(
    teamId,
    next,
  );
}

export const RoadSafeCaseFunctionService = {
  async list(
    teamId: string,
  ): Promise<AccidentCase[]> {
    try {
      const response =
        await execute({
          action:
            "list_cases",
          teamId,
        });

      const records =
        response.cases ??
        [];

      writeCachedCloudCases(
        teamId,
        records,
      );

      return records;
    } catch (requestError) {
      const cached =
        readCachedCloudCases(
          teamId,
        );

      if (
        cached &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        console.warn(
          "RoadSafe DEV offline cases: using the last cloud-case snapshot.",
          requestError,
        );

        return cached;
      }

      throw requestError;
    }
  },

  async get(
    teamId: string,
    caseId: string,
  ): Promise<AccidentCase> {
    try {
      const response =
        await execute({
          action:
            "get_case",
          teamId,
          caseId,
        });

      if (!response.case) {
        throw new Error(
          "The shared case record was not returned.",
        );
      }

      upsertCachedCloudCase(
        teamId,
        response.case,
      );

      return response.case;
    } catch (requestError) {
      const cached =
        readCachedCloudCases(
          teamId,
        )?.find(
          (record) =>
            record.id ===
            caseId,
        );

      if (
        cached &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
        console.warn(
          "RoadSafe DEV offline cases: returning cached cloud case.",
          requestError,
        );

        return cached;
      }

      throw requestError;
    }
  },

  async save(
    teamId: string,
    record: AccidentCase,
    eventType: CaseCloudEventType = "case_updated",
  ): Promise<AccidentCase> {
    const response =
      await execute({
        action:
          "save_case",
        teamId,
        case:
          record,
        eventType,
      });

    if (!response.case) {
      throw new Error(
        "The saved shared case record was not returned.",
      );
    }

    upsertCachedCloudCase(
      teamId,
      response.case,
    );

    return response.case;
  },

  async delete(
    teamId: string,
    caseId: string,
  ): Promise<void> {
    await execute({
      action:
        "delete_case",
      teamId,
      caseId,
    });

    const cached =
      readCachedCloudCases(
        teamId,
      );

    if (cached) {
      writeCachedCloudCases(
        teamId,
        cached.filter(
          (record) =>
            record.id !==
            caseId,
        ),
      );
    }
  },

  async importLocalCases(
    teamId: string,
    records: AccidentCase[],
  ): Promise<CaseFunctionResponse> {
    const response =
      await execute({
        action:
          "import_local_cases",
        teamId,
        cases:
          records,
      });

    for (
      const record
      of response.importedCases ??
      []
    ) {
      upsertCachedCloudCase(
        teamId,
        record,
      );
    }

    return response;
  },
};
`;

  cases =
    cases.slice(
      0,
      exportStart,
    ) +
    caseReplacement;
}

/* ========================================================================== */
/* Persist CaseCloudBridge pending queue across refresh/restart                */
/* ========================================================================== */

if (!bridge.includes(MARKER)) {
  bridge = replaceOnce(
    bridge,
`import { RoadSafeCaseFunctionService } from "./roadSafeCaseFunctionService";`,
`import { RoadSafeCaseFunctionService } from "./roadSafeCaseFunctionService";

import {
  DEV_OFFLINE_CACHE_KEYS,
  DevOfflineCache,
} from "./devOfflineCache";`,
    "CaseCloudBridge cache import",
  );

  bridge = replaceOnce(
    bridge,
`let flushing = false;

function emit<RecordDetail>(`,
`let flushing = false;

/*
 * ${MARKER}
 *
 * Persist the local-first cloud write queue. Previously pending case saves and
 * deletes lived only in module memory, so a browser refresh while offline could
 * silently discard the pending server sync operation.
 */
interface PersistedCaseQueue {
  saves: Array<
    [
      string,
      PendingSave,
    ]
  >;
  deletes: string[];
}

function persistPendingQueue(): void {
  DevOfflineCache.write<PersistedCaseQueue>(
    DEV_OFFLINE_CACHE_KEYS.pendingCaseQueue,
    {
      saves:
        Array.from(
          pendingSaves.entries(),
        ),
      deletes:
        Array.from(
          pendingDeletes,
        ),
    },
  );
}

function hydratePendingQueue(): void {
  const stored =
    DevOfflineCache.read<PersistedCaseQueue>(
      DEV_OFFLINE_CACHE_KEYS.pendingCaseQueue,
    );

  if (!stored) {
    return;
  }

  for (
    const [
      caseId,
      pending,
    ]
    of stored.saves ?? []
  ) {
    if (
      caseId &&
      pending?.record
    ) {
      pendingSaves.set(
        caseId,
        pending,
      );
    }
  }

  for (
    const caseId
    of stored.deletes ?? []
  ) {
    if (caseId) {
      pendingDeletes.add(
        caseId,
      );
      pendingSaves.delete(
        caseId,
      );
    }
  }
}

hydratePendingQueue();

function emit<RecordDetail>(`,
    "CaseCloudBridge persistent queue",
  );

  bridge = replaceOnce(
    bridge,
`        pendingDeletes.delete(
          caseId,
        );`,
`        pendingDeletes.delete(
          caseId,
        );

        persistPendingQueue();`,
    "CaseCloudBridge successful delete persistence",
  );

  bridge = replaceOnce(
    bridge,
`        if (
          latest === pending
        ) {
          pendingSaves.delete(
            caseId,
          );
        }

        emit<CaseCloudRecordEventDetail>(`,
`        if (
          latest === pending
        ) {
          pendingSaves.delete(
            caseId,
          );
        }

        persistPendingQueue();

        emit<CaseCloudRecordEventDetail>(`,
    "CaseCloudBridge successful save persistence",
  );

  bridge = replaceOnce(
    bridge,
`    pendingSaves.set(
      record.id,
      {
        record,
        eventType,
      },
    );

    emit<CaseCloudPendingEventDetail>(`,
`    pendingSaves.set(
      record.id,
      {
        record,
        eventType,
      },
    );

    persistPendingQueue();

    emit<CaseCloudPendingEventDetail>(`,
    "CaseCloudBridge queued save persistence",
  );

  bridge = replaceOnce(
    bridge,
`    pendingSaves.delete(caseId);
    pendingDeletes.add(caseId);

    emit<CaseCloudPendingEventDetail>(`,
`    pendingSaves.delete(caseId);
    pendingDeletes.add(caseId);

    persistPendingQueue();

    emit<CaseCloudPendingEventDetail>(`,
    "CaseCloudBridge queued delete persistence",
  );

  bridge = replaceOnce(
    bridge,
`export const CaseCloudBridge = {`,
`if (
  typeof window !== "undefined" &&
  DevOfflineCache.enabled
) {
  window.addEventListener(
    "online",
    () => {
      void flush();
    },
  );
}

export const CaseCloudBridge = {`,
    "CaseCloudBridge online retry hook",
  );
}

/* ========================================================================== */
/* Preflight complete -> backup -> write                                      */
/* ========================================================================== */

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `dev-offline-cache-v1-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

for (
  const [rel, content]
  of originals.entries()
) {
  const target =
    path.join(
      backupDir,
      ...rel.split("/"),
    );

  fs.mkdirSync(
    path.dirname(target),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );
}

fs.mkdirSync(
  path.dirname(
    abs(FILES.cache),
  ),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  abs(FILES.cache),
  cacheService,
  "utf8",
);

fs.writeFileSync(
  abs(FILES.auth),
  auth,
  "utf8",
);

fs.writeFileSync(
  abs(FILES.officers),
  officers,
  "utf8",
);

fs.writeFileSync(
  abs(FILES.cases),
  cases,
  "utf8",
);

fs.writeFileSync(
  abs(FILES.bridge),
  bridge,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe DEV Offline Cache V1",
);
console.log(
  "=============================",
);
console.log(
  "[OK] Cached resolved auth identity survives refresh/restart in DEV.",
);
console.log(
  "[OK] No password or Appwrite session token is cached.",
);
console.log(
  "[OK] A real online 401 still clears cached authentication.",
);
console.log(
  "[OK] Managed officer lists are cached per station/team.",
);
console.log(
  "[OK] Officer management has DEV-only offline local simulation fallback.",
);
console.log(
  "[OK] Last successful cloud-case snapshot is cached per station/team.",
);
console.log(
  "[OK] Pending case saves/deletes now survive browser refresh/restart.",
);
console.log(
  "[OK] Pending case sync automatically retries when the browser comes online.",
);
console.log(
  "[INFO] Cases/reconstructions were already localStorage-backed.");
console.log(
  "[INFO] Recorded footage was already local metadata + IndexedDB-backed.");
console.log(
  "[INFO] Stations/accidents/junctions are bundled source data and already offline.");
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* ========================================================================== */
/* Build verification + automatic rollback                                    */
/* ========================================================================== */

const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log(
  "Verifying production build...",
);

const result =
  spawnSync(
    npmCommand,
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell:
        process.platform ===
        "win32",
    },
  );

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  result.error ||
  result.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling DEV offline-cache changes back automatically...",
  );

  for (const rel of [
    FILES.auth,
    FILES.officers,
    FILES.cases,
    FILES.bridge,
  ]) {
    const content =
      originals.get(rel);

    if (
      typeof content ===
      "string"
    ) {
      fs.writeFileSync(
        abs(rel),
        content,
        "utf8",
      );
    }
  }

  const previousCache =
    originals.get(
      FILES.cache,
    );

  if (
    typeof previousCache ===
    "string"
  ) {
    fs.writeFileSync(
      abs(FILES.cache),
      previousCache,
      "utf8",
    );
  } else if (
    fs.existsSync(
      abs(FILES.cache),
    )
  ) {
    fs.unlinkSync(
      abs(FILES.cache),
    );
  }

  console.error(
    "[RoadSafe] Rollback complete.",
  );
  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run dev",
);
console.log("");
console.log(
  "DEV offline cache is enabled automatically by Vite development mode.",
);
