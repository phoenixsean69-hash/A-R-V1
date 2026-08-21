import type {
  ForensicVehicleRegistryCheck,
} from "./forensicInvestigationTypes";

interface VehicleRegistryLookupInput {
  caseId: string;
  caseNumber: string;
  investigatingOfficer: string;
  policeStation: string;
  personLabel: string;
  registration: string;
}

interface VehicleRegistryGatewayResponse {
  status?: string;
  registryReference?: string;
  registration?: string;
  makeModel?: string;
  vehicleClass?: string;
  registrationStatus?: string;
  registeredOwnerName?: string;
  registeredOwnerIdentityNumber?: string;
  registeredOwnerType?: string;
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

function normaliseRegistration(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
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

function normaliseOwnerType(
  value: string | undefined,
):
  | "Individual"
  | "Organisation"
  | "Unknown" {
  const normalised =
    (value ?? "")
      .trim()
      .toLowerCase();

  if (
    [
      "individual",
      "person",
      "private",
    ].includes(normalised)
  ) {
    return "Individual";
  }

  if (
    [
      "organisation",
      "organization",
      "company",
      "business",
      "institution",
      "government",
    ].includes(normalised)
  ) {
    return "Organisation";
  }

  return "Unknown";
}

function normaliseGatewayStatus(
  value: string | undefined,
): ForensicVehicleRegistryCheck["status"] {
  const normalised =
    (value ?? "")
      .trim()
      .toLowerCase();

  if (
    [
      "active",
      "valid",
      "registered",
      "vehicle_found_active",
      "vehicle found / active",
    ].includes(normalised)
  ) {
    return "Vehicle found / active";
  }

  if (
    [
      "inactive",
      "expired",
      "suspended",
      "vehicle_found_inactive",
      "vehicle found / inactive",
    ].includes(normalised)
  ) {
    return "Vehicle found / inactive";
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

  return "Check failed";
}

function makeBase(
  input: VehicleRegistryLookupInput,
): Pick<
  ForensicVehicleRegistryCheck,
  | "provider"
  | "checkedAt"
  | "checkedBy"
  | "purpose"
  | "queriedRegistration"
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
    queriedRegistration:
      normaliseRegistration(
        input.registration,
      ),
  };
}

function demoResult(
  input: VehicleRegistryLookupInput,
): ForensicVehicleRegistryCheck {
  const registration =
    normaliseRegistration(
      input.registration,
    );

  const key =
    registration.replace(
      /[^A-Z0-9]/g,
      "",
    );

  if (key.includes("404")) {
    return {
      ...makeBase(input),
      source:
        "Demo registry",
      status:
        "Not found",
      message:
        "DEMO ONLY — no vehicle record was returned for this registration.",
    };
  }

  const inactive =
    key.includes("INACT") ||
    key.includes("EXP");

  const organisation =
    key.includes("ORG");

  const seed =
    Math.abs(
      Array.from(key).reduce(
        (sum, char) =>
          sum + char.charCodeAt(0),
        0,
      ),
    );

  const models = [
    "Toyota Corolla",
    "Honda Fit",
    "Nissan AD Van",
    "Toyota Hilux",
  ];

  const ownerIdentity =
    organisation
      ? ""
      : `DEMO-ID-${String(seed).padStart(6, "0")}`;

  return {
    ...makeBase(input),
    source:
      "Demo registry",
    status:
      inactive
        ? "Vehicle found / inactive"
        : "Vehicle found / active",
    registryReference:
      `DEMO-VEH-${seed}`,
    matchedRegistration:
      registration,
    makeModel:
      models[seed % models.length],
    vehicleClass:
      seed % 3 === 0
        ? "Light motor vehicle"
        : "Passenger vehicle",
    registrationStatus:
      inactive
        ? "Inactive / requires review"
        : "Active",
    registeredOwnerName:
      organisation
        ? "Demo Logistics (Pvt) Ltd"
        : `Demo Registered Owner ${seed % 97}`,
    registeredOwnerIdentityNumber:
      ownerIdentity ||
      undefined,
    registeredOwnerIdentityMasked:
      ownerIdentity
        ? maskIdentity(
            ownerIdentity,
          )
        : undefined,
    registeredOwnerType:
      organisation
        ? "Organisation"
        : "Individual",
    message:
      "DEMO ONLY — this vehicle/owner result was not obtained from the national vehicle registry.",
  };
}

export const VehicleRegistryService = {
  getConnectionMode():
    | "official"
    | "demo"
    | "unconfigured" {
    if (
      envString(
        "VITE_VEHICLE_REGISTRY_PROXY_URL",
      )
    ) {
      return "official";
    }

    if (
      envString(
        "VITE_VEHICLE_REGISTRY_DEMO",
      ).toLowerCase() ===
      "true"
    ) {
      return "demo";
    }

    return "unconfigured";
  },

  async checkVehicle(
    input: VehicleRegistryLookupInput,
  ): Promise<ForensicVehicleRegistryCheck> {
    if (!input.registration.trim()) {
      throw new Error(
        "Enter the vehicle registration number before searching the vehicle registry.",
      );
    }

    const endpoint =
      envString(
        "VITE_VEHICLE_REGISTRY_PROXY_URL",
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
        message:
          "RoadSafe has no authorised vehicle-registry gateway configured on this installation.",
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
                registration:
                  normaliseRegistration(
                    input.registration,
                  ),
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
          message:
            `Vehicle-registry gateway returned HTTP ${response.status}.`,
        };
      }

      const body =
        (await response.json()) as
          VehicleRegistryGatewayResponse;

      const ownerIdentity =
        body.registeredOwnerIdentityNumber?.trim() ??
        "";

      return {
        ...makeBase(input),
        source:
          "Official registry gateway",
        status:
          normaliseGatewayStatus(
            body.status,
          ),
        registryReference:
          body.registryReference?.trim() ||
          undefined,
        matchedRegistration:
          body.registration?.trim() ||
          normaliseRegistration(
            input.registration,
          ),
        makeModel:
          body.makeModel?.trim() ||
          undefined,
        vehicleClass:
          body.vehicleClass?.trim() ||
          undefined,
        registrationStatus:
          body.registrationStatus?.trim() ||
          undefined,
        registeredOwnerName:
          body.registeredOwnerName?.trim() ||
          undefined,
        registeredOwnerIdentityNumber:
          ownerIdentity ||
          undefined,
        registeredOwnerIdentityMasked:
          ownerIdentity
            ? maskIdentity(
                ownerIdentity,
              )
            : undefined,
        registeredOwnerType:
          normaliseOwnerType(
            body.registeredOwnerType,
          ),
        message:
          body.message?.trim() ||
          "Vehicle-registry lookup completed.",
      };
    } catch (error) {
      return {
        ...makeBase(input),
        source:
          "Official registry gateway",
        status:
          "Registry unavailable",
        message:
          error instanceof Error
            ? `Vehicle-registry gateway unavailable: ${error.message}`
            : "Vehicle-registry gateway unavailable.",
      };
    }
  },
};
