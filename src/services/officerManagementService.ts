import {
  ExecutionMethod,
} from "appwrite";

import {
  appwriteConfig,
  functions,
} from "../lib/appwrite";
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

export const OfficerManagementService = {
  async list(
    teamId: string,
  ): Promise<ManagedOfficer[]> {
    const response = await execute({
      action: "list_officers",
      teamId,
    });

    return response.officers ?? [];
  },

  async create(
    input: CreateOfficerInput,
  ): Promise<TemporaryOfficerCredential> {
    const response = await execute({
      action: "create_officer",
      teamId: input.teamId,
      officer: input,
    });

    if (
      !response.officer ||
      !response.temporaryPassword
    ) {
      throw new Error(
        "The officer account was created without temporary credentials.",
      );
    }

    return {
      officer: response.officer,
      temporaryPassword:
        response.temporaryPassword,
    };
  },

  async updateRole(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      | "userId"
      | "membershipId"
    >,
    role: ManagedOfficerRole,
  ): Promise<ManagedOfficer> {
    const response = await execute({
      action: "update_role",
      teamId,
      userId: officer.userId,
      membershipId:
        officer.membershipId,
      role,
    });

    if (!response.officer) {
      throw new Error(
        "The updated officer record was not returned.",
      );
    }

    return response.officer;
  },

  async setStatus(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      | "userId"
      | "membershipId"
    >,
    status: boolean,
  ): Promise<ManagedOfficer> {
    const response = await execute({
      action: "set_status",
      teamId,
      userId: officer.userId,
      membershipId:
        officer.membershipId,
      status,
    });

    if (!response.officer) {
      throw new Error(
        "The updated officer record was not returned.",
      );
    }

    return response.officer;
  },

  async resetPassword(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      | "userId"
      | "membershipId"
    >,
  ): Promise<TemporaryOfficerCredential> {
    const response = await execute({
      action: "reset_password",
      teamId,
      userId: officer.userId,
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

    return {
      officer: response.officer,
      temporaryPassword:
        response.temporaryPassword,
    };
  },

  async remove(
    teamId: string,
    officer: Pick<
      ManagedOfficer,
      | "userId"
      | "membershipId"
    >,
  ): Promise<void> {
    await execute({
      action: "remove_officer",
      teamId,
      userId: officer.userId,
      membershipId:
        officer.membershipId,
    });
  },
};
