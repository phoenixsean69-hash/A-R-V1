import {
  ExecutionMethod,
} from "appwrite";

import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";
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

export const RoadSafeCaseFunctionService = {
  async list(
    teamId: string,
  ): Promise<AccidentCase[]> {
    const response =
      await execute({
        action: "list_cases",
        teamId,
      });

    return response.cases ?? [];
  },

  async get(
    teamId: string,
    caseId: string,
  ): Promise<AccidentCase> {
    const response =
      await execute({
        action: "get_case",
        teamId,
        caseId,
      });

    if (!response.case) {
      throw new Error(
        "The shared case record was not returned.",
      );
    }

    return response.case;
  },

  async save(
    teamId: string,
    record: AccidentCase,
    eventType: CaseCloudEventType = "case_updated",
  ): Promise<AccidentCase> {
    const response =
      await execute({
        action: "save_case",
        teamId,
        case: record,
        eventType,
      });

    if (!response.case) {
      throw new Error(
        "The saved shared case record was not returned.",
      );
    }

    return response.case;
  },

  async delete(
    teamId: string,
    caseId: string,
  ): Promise<void> {
    await execute({
      action: "delete_case",
      teamId,
      caseId,
    });
  },

  async importLocalCases(
    teamId: string,
    records: AccidentCase[],
  ): Promise<CaseFunctionResponse> {
    return execute({
      action: "import_local_cases",
      teamId,
      cases: records,
    });
  },
};
