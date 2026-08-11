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
import type { AccidentCase } from "../types/accidentCase";
import type {
  CaseCloudEventType,
  CaseFunctionResponse,
} from "../types/caseCloud";

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
    | "list_cases"
    | "get_case"
    | "save_case"
    | "delete_case"
    | "import_local_cases";
  teamId: string;
  caseId?: string;
  case?: AccidentCase;
  cases?: AccidentCase[];
  eventType?: CaseCloudEventType;
}

function parseFunctionResponse(
  execution: unknown,
): CaseFunctionResponse {
  const result =
    execution as FunctionExecutionShape;

  const responseText =
    result.responseBody ??
    result.response ??
    "";

  let payload: CaseFunctionResponse;

  try {
    payload = responseText
      ? (JSON.parse(
          responseText,
        ) as CaseFunctionResponse)
      : {
          ok: false,
          message:
            result.errors ||
            "The RoadSafe Case Service returned no response.",
        };
  } catch {
    payload = {
      ok: false,
      message:
        result.errors ||
        responseText ||
        "The RoadSafe Case Service returned an invalid response.",
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
        `Case synchronization failed with status ${statusCode}.`,
    );
  }

  return payload;
}

async function execute(
  payload: FunctionPayload,
): Promise<CaseFunctionResponse> {
  const functionId =
    appwriteConfig.caseServiceFunctionId;

  if (!functionId) {
    throw new Error(
      "VITE_APPWRITE_CASE_SERVICE_FUNCTION_ID is not configured.",
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
 * Cloud case reads are network-first and cached per Team.
 * Writes remain real server writes; CaseCloudBridge keeps failed writes queued
 * locally until they can be sent successfully.
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
    readCachedCloudCases(teamId) ??
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
    next[index] =
      record;
  } else {
    next.push(
      record,
    );
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
        case: record,
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
