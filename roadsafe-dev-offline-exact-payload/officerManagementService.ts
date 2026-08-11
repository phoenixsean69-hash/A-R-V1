import {
  ExecutionMethod,
} from "appwrite";

import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";
import {
  DEV_OFFLINE_CACHE_KEYS,
  DevOfflineCache,
} from "./devOfflineCache";
import type {
  CreateOfficerInput,
  ManagedOfficer,
  ManagedOfficerRole,
  OfficerManagementResponse,
  TemporaryOfficerCredential,
} from "../types/officerManagement";

interface FunctionExecutionShape {
  status?: string;
  responseBody?: string;
  response?: string;
  responseStatusCode?: number;
  statusCode?: number;
  errors?: string;
}

interface FunctionPayload {
  action:
    | "list_officers"
    | "create_officer"
    | "update_role"
    | "set_status"
    | "reset_password"
    | "remove_officer";
  teamId: string;
  officer?: CreateOfficerInput;
  userId?: string;
  membershipId?: string;
  role?: ManagedOfficerRole;
  status?: boolean;
}

function parseFunctionResponse(
  execution: unknown,
): OfficerManagementResponse {
  const result =
    execution as FunctionExecutionShape;

  const responseText =
    result.responseBody ??
    result.response ??
    "";

  let payload: OfficerManagementResponse;

  try {
    payload = responseText
      ? (JSON.parse(
          responseText,
        ) as OfficerManagementResponse)
      : {
          ok: false,
          message:
            result.errors ||
            "The officer-management function returned no response.",
        };
  } catch {
    payload = {
      ok: false,
      message:
        result.errors ||
        responseText ||
        "The officer-management function returned an invalid response.",
    };
  }

  const statusCode =
    result.responseStatusCode ??
    result.statusCode ??
    500;

  if (
    result.status === "failed" ||
    statusCode >= 400 ||
    payload.ok === false
  ) {
    throw new Error(
      payload.message ||
        `Officer management failed with status ${statusCode}.`,
    );
  }

  return payload;
}

async function execute(
  payload: FunctionPayload,
): Promise<OfficerManagementResponse> {
  const functionId =
    appwriteConfig.officerAdminFunctionId;

  if (!functionId) {
    throw new Error(
      "VITE_APPWRITE_OFFICER_ADMIN_FUNCTION_ID is not configured.",
    );
  }

  const execution =
    await functions.createExecution({
      functionId,
      body: JSON.stringify(payload),
      async: false,
      xpath: "/",
      method: ExecutionMethod.POST,
      headers: {
        "content-type":
          "application/json",
      },
    });

  return parseFunctionResponse(
    execution,
  );
}

/*
 * [RoadSafe:DevOfflineCacheV1Exact]
 *
 * Officer reads are network-first and cached per station Team.
 * In DEV only, network-unavailable mutations can be simulated locally.
 * Simulated officer writes do not create or modify Appwrite accounts.
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
    next[index] =
      officer;
  } else {
    next.push(
      officer,
    );
  }

  writeCachedOfficers(
    teamId,
    next,
  );
}

function findCachedOfficer(
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
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

  const officer:
    ManagedOfficer = {
      userId:
        `dev-offline-user-${suffix}`,
      membershipId:
        `dev-offline-membership-${suffix}`,
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
      `DEV-OFFLINE-${Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase()}`,
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
        findCachedOfficer(
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
        findCachedOfficer(
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
        findCachedOfficer(
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
            `DEV-OFFLINE-RESET-${Math.random()
              .toString(36)
              .slice(2, 8)
              .toUpperCase()}`,
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

      if (
        exists &&
        DevOfflineCache.canFallback(
          requestError,
        )
      ) {
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
