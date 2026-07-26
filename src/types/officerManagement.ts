export type ManagedOfficerRole =
  | "field_officer"
  | "supervisor"
  | "station_admin";

export type ManagedOfficerStatus =
  | "active"
  | "blocked";

export interface ManagedOfficer {
  userId: string;
  membershipId: string;
  teamId: string;
  name: string;
  email: string;
  phone: string;
  serviceNumber: string;
  rank: string;
  role: ManagedOfficerRole;
  roles: string[];
  status: ManagedOfficerStatus;
  joinedAt: string;
  registeredAt: string;
  lastActivityAt: string;
  mustChangePassword: boolean;
  avatarFileId: string;
}

export interface CreateOfficerInput {
  teamId: string;
  name: string;
  email: string;
  phone?: string;
  serviceNumber: string;
  rank: string;
  role: ManagedOfficerRole;
}

export interface TemporaryOfficerCredential {
  officer: ManagedOfficer;
  temporaryPassword: string;
}

export interface OfficerManagementResponse {
  ok: boolean;
  message?: string;
  officers?: ManagedOfficer[];
  officer?: ManagedOfficer;
  temporaryPassword?: string;
}

export const MANAGED_OFFICER_ROLES: Array<{
  value: ManagedOfficerRole;
  label: string;
  description: string;
}> = [
  {
    value: "field_officer",
    label: "Field Officer",
    description:
      "Captures accident scenes, evidence and reconstructions.",
  },
  {
    value: "supervisor",
    label: "Station Supervisor",
    description:
      "Reviews investigations, comments and approves submissions.",
  },
  {
    value: "station_admin",
    label: "Station Administrator",
    description:
      "Manages station users and retains supervisor access.",
  },
];

export const ZIMBABWE_POLICE_RANKS = [
  "Assistant Commissioner",
  "Chief Superintendent",
  "Superintendent",
  "Chief Inspector",
  "Inspector",
  "Assistant Inspector",
  "Sergeant Major",
  "Sergeant",
  "Constable",
  "Detective Inspector",
  "Detective Assistant Inspector",
  "Detective Sergeant",
  "Detective Constable",
] as const;

export function managedOfficerRoleLabel(
  role: ManagedOfficerRole,
): string {
  return (
    MANAGED_OFFICER_ROLES.find(
      (item) => item.value === role,
    )?.label ?? role
  );
}
