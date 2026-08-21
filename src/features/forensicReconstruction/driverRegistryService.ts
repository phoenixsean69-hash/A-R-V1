import type {
  ForensicDriverRegistryCheck,
} from "./forensicInvestigationTypes";

interface DriverRegistryLookupInput {
  caseId: string;
  caseNumber: string;
  investigatingOfficer: string;
  policeStation: string;
  personLabel: string;
  fullName: string;
  identityNumber: string;
  licenceNumber: string;
}

interface RegistryGatewayResponse {
  status?: string;
  registryReference?: string;
  fullName?: string;
  licenceNumber?: string;
  licenceCodes?: string[];
  issueDate?: string;
  expiryDate?: string;
  penaltyPoints?: number;
  restrictionSummary?: string;
  message?: string;
}

const PROVIDER =
  "CVR / ZIMTIS" as const;

function envString(
  key: string,
): string {
  const env =
    import.meta.env as Record<
      string,
      string | boolean | undefined
    >;

  const value =
    env[key];

  return typeof value === "string"
    ? value.trim()
    : "";
}

function maskIdentity(
  value: string,
): string {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= 4) {
    return "•".repeat(
      trimmed.length,
    );
  }

  return `${"•".repeat(
    Math.max(4, trimmed.length - 4),
  )}${trimmed.slice(-4)}`;
}

function normaliseGatewayStatus(
  value: string | undefined,
): ForensicDriverRegistryCheck["status"] {
  const normalised =
    (value ?? "")
      .trim()
      .toLowerCase();

  if (
    [
      "valid",
      "registered_valid",
      "registered / valid",
      "active",
    ].includes(normalised)
  ) {
    return "Registered / valid";
  }

  if (
    [
      "expired",
      "registered_expired",
      "registered / expired",
    ].includes(normalised)
  ) {
    return "Registered / expired";
  }

  if (
    [
      "suspended",
      "disqualified",
      "suspended_disqualified",
      "suspended / disqualified",
    ].includes(normalised)
  ) {
    return "Suspended / disqualified";
  }

  if (
    [
      "not_found",
      "not found",
      "unregistered",
    ].includes(normalised)
  ) {
    return "Not found";
  }

  if (
    [
      "identity_mismatch",
      "identity mismatch",
      "mismatch",
    ].includes(normalised)
  ) {
    return "Identity mismatch";
  }

  return "Check failed";
}

function makeBase(
  input: DriverRegistryLookupInput,
): Pick<
  ForensicDriverRegistryCheck,
  | "provider"
  | "checkedAt"
  | "checkedBy"
  | "purpose"
  | "queriedLicenceNumber"
  | "queriedIdentityMasked"
> {
  return {
    provider: PROVIDER,
    checkedAt:
      new Date().toISOString(),
    checkedBy:
      input.investigatingOfficer ||
      "Unassigned officer",
    purpose:
      "Road traffic accident investigation",
    queriedLicenceNumber:
      input.licenceNumber.trim(),
    queriedIdentityMasked:
      maskIdentity(
        input.identityNumber,
      ),
  };
}

function demoResult(
  input: DriverRegistryLookupInput,
): ForensicDriverRegistryCheck {
  const key =
    `${input.licenceNumber} ${input.identityNumber}`
      .toUpperCase();

  let status:
    ForensicDriverRegistryCheck["status"] =
      "Registered / valid";

  if (key.includes("404")) {
    status =
      "Not found";
  } else if (
    key.includes("SUSP") ||
    key.includes("DISQ")
  ) {
    status =
      "Suspended / disqualified";
  } else if (
    key.includes("EXP")
  ) {
    status =
      "Registered / expired";
  }

  return {
    ...makeBase(input),
    source:
      "Demo registry",
    status,
    registryReference:
      `DEMO-${Math.abs(
        Array.from(key).reduce(
          (sum, char) =>
            sum + char.charCodeAt(0),
          0,
        ),
      )}`,
    matchedFullName:
      input.fullName.trim() ||
      "Demo driver record",
    matchedLicenceNumber:
      input.licenceNumber.trim(),
    licenceCodes:
      status === "Not found"
        ? []
        : ["B"],
    issueDate:
      status === "Not found"
        ? undefined
        : "2024-06-01",
    expiryDate:
      status === "Registered / expired"
        ? "2025-06-01"
        : status === "Not found"
          ? undefined
          : "2029-06-01",
    penaltyPoints:
      status === "Suspended / disqualified"
        ? 12
        : 0,
    restrictionSummary:
      status === "Suspended / disqualified"
        ? "Demo restriction: driving privilege suspended."
        : undefined,
    message:
      "DEMO ONLY — this result was not obtained from the national registry.",
  };
}

export const DriverRegistryService = {
  getConnectionMode():
    | "official"
    | "demo"
    | "unconfigured" {
    if (
      envString(
        "VITE_DRIVER_REGISTRY_PROXY_URL",
      )
    ) {
      return "official";
    }

    if (
      envString(
        "VITE_DRIVER_REGISTRY_DEMO",
      ).toLowerCase() ===
      "true"
    ) {
      return "demo";
    }

    return "unconfigured";
  },

  async checkDriver(
    input: DriverRegistryLookupInput,
  ): Promise<ForensicDriverRegistryCheck> {
    if (
      !input.licenceNumber.trim() &&
      !input.identityNumber.trim()
    ) {
      throw new Error(
        "Enter a driver licence number or National ID before checking the registry.",
      );
    }

    const endpoint =
      envString(
        "VITE_DRIVER_REGISTRY_PROXY_URL",
      );

    if (!endpoint) {
      if (
        this.getConnectionMode() ===
        "demo"
      ) {
        return demoResult(
          input,
        );
      }

      return {
        ...makeBase(input),
        source:
          "Official registry gateway",
        status:
          "Registry unavailable",
        licenceCodes: [],
        message:
          "RoadSafe has no authorised CVR / ZIMTIS gateway configured on this installation.",
      };
    }

    try {
      const response =
        await fetch(
          endpoint,
          {
            method:
              "POST",
            credentials:
              "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                caseId:
                  input.caseId,
                caseNumber:
                  input.caseNumber,
                purpose:
                  "Road traffic accident investigation",
                investigatingOfficer:
                  input.investigatingOfficer,
                policeStation:
                  input.policeStation,
                personLabel:
                  input.personLabel,
                fullName:
                  input.fullName,
                identityNumber:
                  input.identityNumber,
                licenceNumber:
                  input.licenceNumber,
              }),
          },
        );

      if (!response.ok) {
        return {
          ...makeBase(input),
          source:
            "Official registry gateway",
          status:
            "Check failed",
          licenceCodes: [],
          message:
            `Registry gateway returned HTTP ${response.status}.`,
        };
      }

      const body =
        (await response.json()) as
          RegistryGatewayResponse;

      return {
        ...makeBase(input),
        source:
          "Official registry gateway",
        status:
          normaliseGatewayStatus(
            body.status,
          ),
        registryReference:
          body.registryReference,
        matchedFullName:
          body.fullName,
        matchedLicenceNumber:
          body.licenceNumber,
        licenceCodes:
          Array.isArray(
            body.licenceCodes,
          )
            ? body.licenceCodes
                .filter(
                  (value): value is string =>
                    typeof value === "string",
                )
                .slice(0, 20)
            : [],
        issueDate:
          body.issueDate,
        expiryDate:
          body.expiryDate,
        penaltyPoints:
          typeof body.penaltyPoints ===
          "number"
            ? body.penaltyPoints
            : undefined,
        restrictionSummary:
          body.restrictionSummary,
        message:
          body.message ||
          "National driver registry check completed.",
      };
    } catch (error) {
      return {
        ...makeBase(input),
        source:
          "Official registry gateway",
        status:
          "Check failed",
        licenceCodes: [],
        message:
          error instanceof Error
            ? error.message
            : "The driver registry could not be reached.",
      };
    }
  },
};
