import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AppwriteException,
  Query,
  type Models,
} from "appwrite";

import {
  account,
  appwriteConfig,
  teams,
} from "../lib/appwrite";
import type {
  AuthStatus,
  RoadSafeIdentity,
  RoadSafeRole,
} from "../types/auth";

interface SignInValues {
  email: string;
  password: string;
}

interface AuthContextValue {
  status: AuthStatus;
  identity: RoadSafeIdentity | null;
  error: string;
  configured: boolean;
  signIn(values: SignInValues): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

interface TeamAccess {
  team: Models.Team<Models.Preferences>;
  membership: Models.Membership;
  role: Exclude<RoadSafeRole, "unassigned">;
}

const AuthContext =
  createContext<AuthContextValue | null>(null);

const ROLE_PRIORITY: Record<
  Exclude<RoadSafeRole, "unassigned">,
  number
> = {
  field_officer: 1,
  supervisor: 2,
  station_admin: 3,
};

function normaliseRole(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function recognisedRole(
  roles: readonly string[] | undefined,
): Exclude<RoadSafeRole, "unassigned"> | null {
  const recognised = (roles ?? [])
    .map(normaliseRole)
    .filter(
      (
        role,
      ): role is Exclude<RoadSafeRole, "unassigned"> =>
        role === "field_officer" ||
        role === "supervisor" ||
        role === "station_admin",
    )
    .sort(
      (first, second) =>
        ROLE_PRIORITY[second] -
        ROLE_PRIORITY[first],
    );

  return recognised[0] ?? null;
}

function membershipIsActive(
  membership: Models.Membership,
): boolean {
  return (
    membership.confirm === true ||
    Boolean(membership.joined?.trim())
  );
}

async function getCurrentUserMembership(
  teamId: string,
  user: Models.User<Models.Preferences>,
): Promise<Models.Membership | null> {
  /*
   * Ask Appwrite to return only the current account's membership.
   * Once Appwrite applies the userId filter, the first result is already
   * the correct membership and does not need a fragile second comparison.
   */
  const directResult =
    await teams.listMemberships({
      teamId,
      queries: [
        Query.equal("userId", user.$id),
      ],
      total: false,
    });

  const directMembership =
    directResult.memberships[0];

  if (directMembership) {
    return directMembership;
  }

  /*
   * Defensive fallback for response-format or privacy differences.
   * userId is the primary match; email is only used when Appwrite returns it.
   */
  const allResult =
    await teams.listMemberships({
      teamId,
      queries: [],
      total: false,
    });

  const exactMembership =
    allResult.memberships.find(
      (membership) =>
        membership.userId === user.$id ||
        Boolean(
          membership.userEmail &&
            user.email &&
            membership.userEmail
              .trim()
              .toLowerCase() ===
              user.email
                .trim()
                .toLowerCase(),
        ),
    );

  if (exactMembership) {
    return exactMembership;
  }

  /*
   * A team returned by teams.list() already belongs to the authenticated
   * user. This final fallback is safe only when the team has exactly one
   * membership, which is common during the first-station bootstrap.
   */
  if (allResult.memberships.length === 1) {
    return allResult.memberships[0];
  }

  return null;
}

async function resolveTeamAccess(
  user: Models.User<Models.Preferences>,
): Promise<TeamAccess | null> {
  const teamList = await teams.list({
    queries: [],
    total: false,
  });

  const resolved: TeamAccess[] = [];

  for (const team of teamList.teams) {
    try {
      const membership =
        await getCurrentUserMembership(
          team.$id,
          user,
        );

      if (!membership) {
        console.info(
          `RoadSafe found team ${team.$id}, but could not resolve the current user's membership.`,
        );
        continue;
      }

      if (!membershipIsActive(membership)) {
        console.info(
          `RoadSafe membership ${membership.$id} is still pending.`,
        );
        continue;
      }

      const role = recognisedRole(
        membership.roles,
      );

      if (!role) {
        console.info(
          `RoadSafe membership ${membership.$id} has no recognised application role.`,
          membership.roles,
        );
        continue;
      }

      resolved.push({
        team,
        membership,
        role,
      });
    } catch (teamError) {
      console.error(
        `RoadSafe could not inspect membership for team ${team.$id}.`,
        teamError,
      );
    }
  }

  return (
    resolved.sort(
      (first, second) =>
        ROLE_PRIORITY[second.role] -
        ROLE_PRIORITY[first.role],
    )[0] ?? null
  );
}

function errorMessage(
  error: unknown,
): string {
  if (
    error instanceof AppwriteException
  ) {
    return (
      error.message ||
      "Appwrite rejected the request."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected authentication error occurred.";
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] =
    useState<AuthStatus>("loading");
  const [identity, setIdentity] =
    useState<RoadSafeIdentity | null>(
      null,
    );
  const [error, setError] =
    useState("");

  const refresh =
    useCallback(async () => {
      if (
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
      setError("");

      try {
        const user =
          await account.get();

        const access =
          await resolveTeamAccess(user);

        setIdentity({
          user,
          role:
            access?.role ??
            "unassigned",
          stationTeam:
            access?.team ?? null,
          membership:
            access?.membership ??
            null,
        });

        setStatus("authenticated");
      } catch (requestError) {
        if (
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
          errorMessage(requestError),
        );
      }
    }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async ({
      email,
      password,
    }: SignInValues) => {
      if (
        !appwriteConfig.configured
      ) {
        throw new Error(
          "Appwrite is not configured. Complete the .env file first.",
        );
      }

      setError("");

      try {
        await account.createEmailPasswordSession(
          {
            email: email
              .trim()
              .toLowerCase(),
            password,
          },
        );

        await refresh();
      } catch (requestError) {
        const message =
          errorMessage(requestError);

        setError(message);
        throw new Error(message);
      }
    },
    [refresh],
  );

  const signOut =
    useCallback(async () => {
      try {
        await account.deleteSession({
          sessionId: "current",
        });
      } catch (requestError) {
        console.warn(
          "RoadSafe could not close the Appwrite session cleanly.",
          requestError,
        );
      } finally {
        setIdentity(null);
        setStatus(
          "unauthenticated",
        );
        setError("");
      }
    }, []);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        status,
        identity,
        error,
        configured:
          appwriteConfig.configured,
        signIn,
        signOut,
        refresh,
      }),
      [
        error,
        identity,
        refresh,
        signIn,
        signOut,
        status,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}
