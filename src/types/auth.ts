import type { Models } from "appwrite";

export type RoadSafeRole =
  | "field_officer"
  | "supervisor"
  | "station_admin"
  | "unassigned";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "configuration-error";

export interface RoadSafeIdentity {
  user: Models.User<Models.Preferences>;
  role: RoadSafeRole;
  stationTeam: Models.Team<Models.Preferences> | null;
  membership: Models.Membership | null;
}

export function isStationRole(
  role: RoadSafeRole,
): role is "supervisor" | "station_admin" {
  return role === "supervisor" || role === "station_admin";
}

export function roleLabel(role: RoadSafeRole): string {
  switch (role) {
    case "field_officer":
      return "Field Officer";
    case "supervisor":
      return "Station Supervisor";
    case "station_admin":
      return "Station Administrator";
    case "unassigned":
      return "Access Pending";
  }
}
