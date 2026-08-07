import crypto from "node:crypto";

import {
  AppwriteException,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Teams,
  Users,
} from "node-appwrite";

const ROLES = new Set([
  "field_officer",
  "supervisor",
  "station_admin",
]);

const ROADSAFE_DATABASE_ID =
  process.env.ROADSAFE_DATABASE_ID ||
  "6a65ba680015d256c655";

const OFFICER_PROFILES_TABLE_ID =
  process.env.ROADSAFE_PROFILES_TABLE_ID ||
  "6a65baad0030250bf9b9";

const AUDIT_LOGS_TABLE_ID =
  process.env.ROADSAFE_AUDIT_LOGS_TABLE_ID ||
  "6a65bb1400100c00ad6f";

function normaliseRole(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function json(res, body, status = 200) {
  return res.json(body, status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
}

function parseBody(req) {
  if (
    req.bodyJson &&
    typeof req.bodyJson === "object"
  ) {
    return req.bodyJson;
  }

  if (!req.bodyText) {
    return {};
  }

  try {
    return JSON.parse(req.bodyText);
  } catch {
    throw new Error(
      "The request body must contain valid JSON.",
    );
  }
}

function generateTemporaryPassword() {
  const random = crypto
    .randomBytes(15)
    .toString("base64url");

  return `RS!${random}9a`;
}

function cleanText(
  value,
  maximum = 128,
) {
  return String(value ?? "")
    .trim()
    .slice(0, maximum);
}

function validatePhone(value) {
  const phone = cleanText(value, 15);

  if (!phone) return "";

  if (!/^\+\d{7,14}$/.test(phone)) {
    throw new Error(
      "Phone numbers must use international format, for example +263771234567.",
    );
  }

  return phone;
}

function validRole(value) {
  const role =
    normaliseRole(value);

  if (!ROLES.has(role)) {
    throw new Error(
      "RoadSafe role must be field_officer, supervisor or station_admin.",
    );
  }

  return role;
}

function membershipActive(
  membership,
) {
  return (
    membership.confirm === true ||
    Boolean(membership.joined)
  );
}

function roleFromMembership(
  membership,
) {
  return (
    (membership.roles ?? [])
      .map(normaliseRole)
      .find((role) =>
        ROLES.has(role),
      ) ?? "field_officer"
  );
}

function requestMetadata(req) {
  const forwarded =
    cleanText(
      req.headers["x-forwarded-for"],
      256,
    );

  return {
    requestId:
      cleanText(
        req.headers[
          "x-appwrite-execution-id"
        ],
        64,
      ) ||
      crypto.randomUUID(),
    ipAddress:
      forwarded
        .split(",")[0]
        ?.trim()
        .slice(0, 45) || "",
    userAgent:
      cleanText(
        req.headers["user-agent"],
        512,
      ),
  };
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      note:
        "RoadSafe could not serialize audit details.",
    });
  }
}

function profilePermissions(
  teamId,
) {
  return [
    Permission.read(
      Role.team(teamId),
    ),
    Permission.update(
      Role.team(
        teamId,
        "station_admin",
      ),
    ),
    Permission.delete(
      Role.team(
        teamId,
        "station_admin",
      ),
    ),
  ];
}

function fallbackServiceNumber(
  userId,
) {
  return `PENDING-${String(
    userId,
  )
    .slice(-8)
    .toUpperCase()}`;
}

function profileData({
  user,
  membership,
  teamName,
  existingProfile,
  statusOverride,
}) {
  const prefs =
    user.prefs ?? {};

  const role =
    roleFromMembership(
      membership,
    );

  const accountStatus =
    statusOverride ??
    (prefs.accountStatus ===
    "removed"
      ? "removed"
      : user.status === false
        ? "blocked"
        : "active");

  return {
    userId: user.$id,
    stationTeamId:
      membership.teamId,
    stationName:
      teamName,
    fullName:
      user.name ||
      membership.userName ||
      "Unnamed officer",
    email:
      user.email ||
      membership.userEmail ||
      "",
    phone:
      user.phone || "",
    serviceNumber:
      cleanText(
        prefs.serviceNumber,
        40,
      ) ||
      existingProfile?.serviceNumber ||
      fallbackServiceNumber(
        user.$id,
      ),
    rank:
      cleanText(
        prefs.rank,
        80,
      ) ||
      existingProfile?.rank ||
      "Unspecified",
    role,
    status:
      accountStatus,
    mustChangePassword:
      prefs.mustChangePassword ===
      true,
    avatarFileId:
      cleanText(
        existingProfile?.avatarFileId,
        36,
      ),
  };
}

async function getRowOrNull({
  tablesDB,
  tableId,
  rowId,
}) {
  try {
    return await tablesDB.getRow({
      databaseId:
        ROADSAFE_DATABASE_ID,
      tableId,
      rowId,
    });
  } catch (requestError) {
    if (
      requestError instanceof
        AppwriteException &&
      requestError.code === 404
    ) {
      return null;
    }

    throw requestError;
  }
}

async function upsertOfficerProfile({
  tablesDB,
  user,
  membership,
  teamName,
  statusOverride,
}) {
  /*
   * Officer Management can request a list automatically while an administrator
   * also presses Refresh. Those executions may overlap. A separate
   * "get, then create" flow is therefore unsafe because both executions can
   * observe a missing profile before one creates it.
   *
   * Appwrite upsertRow performs the create-or-update operation atomically, so
   * repeated and concurrent refreshes remain idempotent.
   */
  const existingProfile =
    await getRowOrNull({
      tablesDB,
      tableId:
        OFFICER_PROFILES_TABLE_ID,
      rowId: user.$id,
    });

  const data =
    profileData({
      user,
      membership,
      teamName,
      existingProfile,
      statusOverride,
    });

  return tablesDB.upsertRow({
    databaseId:
      ROADSAFE_DATABASE_ID,
    tableId:
      OFFICER_PROFILES_TABLE_ID,
    rowId:
      user.$id,
    data,
    permissions:
      profilePermissions(
        membership.teamId,
      ),
  });
}

async function writeAudit({
  tablesDB,
  metadata,
  stationTeamId,
  actor,
  actorRole,
  action,
  entityType,
  entityId = "",
  entityLabel = "",
  targetUserId = "",
  outcome = "success",
  severity = "info",
  details = {},
}) {
  try {
    await tablesDB.createRow({
      databaseId:
        ROADSAFE_DATABASE_ID,
      tableId:
        AUDIT_LOGS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        stationTeamId,
        actorUserId:
          actor?.$id || "system",
        actorName:
          actor?.name ||
          actor?.email ||
          "RoadSafe System",
        actorRole:
          actorRole ||
          "system",
        action,
        entityType,
        entityId,
        entityLabel,
        targetUserId,
        outcome,
        severity,
        sourceClient:
          "function",
        requestId:
          metadata.requestId,
        ipAddress:
          metadata.ipAddress,
        userAgent:
          metadata.userAgent,
        detailsJson:
          safeJson(details),
        occurredAt:
          new Date().toISOString(),
      },
      permissions: [],
    });
  } catch (auditError) {
    console.error(
      "RoadSafe audit write failed:",
      auditError,
    );
  }
}

async function requireStationAdmin({
  users,
  callerId,
  teamId,
}) {
  if (!callerId) {
    const requestError =
      new Error(
        "An authenticated RoadSafe account is required.",
      );
    requestError.statusCode = 401;
    throw requestError;
  }

  const memberships =
    await users.listMemberships({
      userId: callerId,
      queries: [
        Query.equal(
          "teamId",
          teamId,
        ),
      ],
      total: false,
    });

  const membership =
    memberships.memberships.find(
      (item) =>
        item.teamId === teamId &&
        membershipActive(item),
    );

  if (!membership) {
    const requestError =
      new Error(
        "The caller does not belong to this police station.",
      );
    requestError.statusCode = 403;
    throw requestError;
  }

  const roles =
    (membership.roles ?? [])
      .map(normaliseRole);

  if (
    !roles.includes(
      "station_admin",
    )
  ) {
    const requestError =
      new Error(
        "Only a Station Administrator can manage police officers.",
      );
    requestError.statusCode = 403;
    throw requestError;
  }

  return membership;
}

async function getMembership({
  teams,
  teamId,
  membershipId,
  userId,
}) {
  if (membershipId) {
    const membership =
      await teams.getMembership({
        teamId,
        membershipId,
      });

    if (
      membership.userId !==
      userId
    ) {
      const requestError =
        new Error(
          "The selected membership does not belong to the selected officer.",
        );
      requestError.statusCode = 400;
      throw requestError;
    }

    return membership;
  }

  const result =
    await teams.listMemberships({
      teamId,
      queries: [
        Query.equal(
          "userId",
          userId,
        ),
      ],
      total: false,
    });

  const membership =
    result.memberships[0];

  if (!membership) {
    const requestError =
      new Error(
        "The officer is not a member of this police station.",
      );
    requestError.statusCode = 404;
    throw requestError;
  }

  return membership;
}

function buildManagedOfficer({
  membership,
  user,
  profile,
}) {
  const prefs =
    user?.prefs ?? {};

  return {
    userId:
      user?.$id ??
      membership.userId,
    membershipId:
      membership.$id,
    teamId:
      membership.teamId,
    name:
      profile?.fullName ||
      user?.name ||
      membership.userName ||
      "Unnamed officer",
    email:
      profile?.email ||
      user?.email ||
      membership.userEmail ||
      "",
    phone:
      profile?.phone ||
      user?.phone ||
      "",
    serviceNumber:
      profile?.serviceNumber ||
      String(
        prefs.serviceNumber ??
          "",
      ),
    rank:
      profile?.rank ||
      String(
        prefs.rank ?? "",
      ),
    role:
      profile?.role ||
      roleFromMembership(
        membership,
      ),
    roles:
      membership.roles ?? [],
    status:
      profile?.status ===
      "blocked"
        ? "blocked"
        : user?.status === false
          ? "blocked"
          : "active",
    joinedAt:
      membership.joined ||
      membership.invited ||
      "",
    registeredAt:
      user?.registration || "",
    lastActivityAt:
      user?.accessedAt || "",
    mustChangePassword:
      profile?.mustChangePassword ===
        true ||
      prefs.mustChangePassword ===
        true,
    avatarFileId:
      profile?.avatarFileId ||
      "",
  };
}

async function managedOfficer({
  users,
  tablesDB,
  membership,
  teamName,
  user,
  statusOverride,
}) {
  const resolvedUser =
    user ??
    (await users.get({
      userId:
        membership.userId,
    }));

  const profile =
    await upsertOfficerProfile({
      tablesDB,
      user: resolvedUser,
      membership,
      teamName,
      statusOverride,
    });

  return buildManagedOfficer({
    membership,
    user: resolvedUser,
    profile,
  });
}

async function listStationOfficers({
  users,
  teams,
  tablesDB,
  teamId,
  teamName,
}) {
  const result =
    await teams.listMemberships({
      teamId,
      queries: [
        Query.limit(100),
      ],
      total: false,
    });

  const activeMemberships =
    result.memberships.filter(
      membershipActive,
    );

  try {
    const officers =
      await Promise.all(
        activeMemberships.map(
          (membership) =>
            managedOfficer({
              users,
              tablesDB,
              membership,
              teamName,
            }),
        ),
      );

    return officers.sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
        ),
    );
  } catch (readError) {
    const scopeError =
      new Error(
        `RoadSafe found ${activeMemberships.length} active station membership(s), but could not synchronize officer profiles. Enable users.read, users.write, teams.read, teams.write, rows.read and rows.write in the Function scopes. Original error: ${
          readError.message ??
          String(readError)
        }`,
      );

    scopeError.statusCode =
      Number.isInteger(
        readError.code,
      ) &&
      readError.code >= 400
        ? readError.code
        : 500;

    throw scopeError;
  }
}

async function countActiveAdmins({
  users,
  teams,
  tablesDB,
  teamId,
  teamName,
}) {
  const officers =
    await listStationOfficers({
      users,
      teams,
      tablesDB,
      teamId,
      teamName,
    });

  return officers.filter(
    (officer) =>
      officer.role ===
        "station_admin" &&
      officer.status ===
        "active",
  ).length;
}

async function protectAdministrator({
  users,
  teams,
  tablesDB,
  callerId,
  teamId,
  teamName,
  targetUserId,
  targetMembership,
  operation,
  nextRole,
  nextStatus,
}) {
  if (
    callerId ===
    targetUserId
  ) {
    const requestError =
      new Error(
        "A Station Administrator cannot change, block or remove their own account.",
      );
    requestError.statusCode = 400;
    throw requestError;
  }

  const targetRole =
    roleFromMembership(
      targetMembership,
    );

  const removesAdmin =
    targetRole ===
      "station_admin" &&
    (operation ===
      "remove_officer" ||
      (operation ===
        "update_role" &&
        nextRole !==
          "station_admin") ||
      (operation ===
        "set_status" &&
        nextStatus === false));

  if (!removesAdmin) {
    return;
  }

  const adminCount =
    await countActiveAdmins({
      users,
      teams,
      tablesDB,
      teamId,
      teamName,
    });

  if (adminCount <= 1) {
    const requestError =
      new Error(
        "RoadSafe cannot remove or block the station's last active administrator.",
      );
    requestError.statusCode = 400;
    throw requestError;
  }
}

async function uniqueOfficerCheck({
  users,
  teams,
  tablesDB,
  teamId,
  teamName,
  email,
  serviceNumber,
}) {
  const emailResults =
    await users.list({
      queries: [
        Query.equal(
          "email",
          email,
        ),
        Query.limit(1),
      ],
      total: false,
    });

  if (
    emailResults.users.length >
    0
  ) {
    const requestError =
      new Error(
        "An Appwrite account already exists with that email address.",
      );
    requestError.statusCode = 409;
    throw requestError;
  }

  const officers =
    await listStationOfficers({
      users,
      teams,
      tablesDB,
      teamId,
      teamName,
    });

  if (
    officers.some(
      (officer) =>
        officer.serviceNumber
          .trim()
          .toUpperCase() ===
        serviceNumber,
    )
  ) {
    const requestError =
      new Error(
        "That police service number is already registered at this station.",
      );
    requestError.statusCode = 409;
    throw requestError;
  }
}

function mergePrefs(
  current,
  updates,
) {
  return {
    ...(current ?? {}),
    ...updates,
  };
}

export default async function ({
  req,
  res,
  log,
  error,
}) {
  if (
    req.method !== "POST"
  ) {
    return json(
      res,
      {
        ok: false,
        message:
          "Use a POST request.",
      },
      405,
    );
  }

  const endpoint =
    process.env
      .APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId =
    process.env
      .APPWRITE_FUNCTION_PROJECT_ID;
  const apiKey =
    req.headers[
      "x-appwrite-key"
    ] ||
    process.env
      .APPWRITE_FUNCTION_API_KEY;
  const callerId =
    req.headers[
      "x-appwrite-user-id"
    ];

  if (
    !endpoint ||
    !projectId ||
    !apiKey
  ) {
    return json(
      res,
      {
        ok: false,
        message:
          "The Appwrite Function runtime is missing its dynamic API credentials.",
      },
      500,
    );
  }

  const client =
    new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

  const users =
    new Users(client);
  const teams =
    new Teams(client);
  const tablesDB =
    new TablesDB(client);

  let body;

  try {
    body =
      parseBody(req);
  } catch (parseError) {
    return json(
      res,
      {
        ok: false,
        message:
          parseError.message,
      },
      400,
    );
  }

  const action =
    cleanText(
      body.action,
      40,
    );
  const teamId =
    cleanText(
      body.teamId,
      36,
    );

  if (!teamId) {
    return json(
      res,
      {
        ok: false,
        message:
          "Police-station Team ID is required.",
      },
      400,
    );
  }

  const metadata =
    requestMetadata(req);

  let actor = null;
  let actorMembership = null;
  let actorRole =
    "system";
  let teamName =
    teamId;

  try {
    actorMembership =
      await requireStationAdmin({
        users,
        callerId,
        teamId,
      });

    actorRole =
      roleFromMembership(
        actorMembership,
      );

    actor =
      await users.get({
        userId:
          callerId,
      });

    const team =
      await teams.get({
        teamId,
      });

    teamName =
      team.name || teamId;

    /*
     * Opening Officer Management automatically backfills the bootstrap
     * administrator and all existing station members into officer_profiles.
     */
    if (
      action ===
      "list_officers"
    ) {
      const officers =
        await listStationOfficers({
          users,
          teams,
          tablesDB,
          teamId,
          teamName,
        });

      return json(res, {
        ok: true,
        officers,
      });
    }

    if (
      action ===
      "create_officer"
    ) {
      const input =
        body.officer ?? {};

      const name =
        cleanText(
          input.name,
          128,
        );
      const email =
        cleanText(
          input.email,
          320,
        ).toLowerCase();
      const phone =
        validatePhone(
          input.phone,
        );
      const serviceNumber =
        cleanText(
          input.serviceNumber,
          40,
        ).toUpperCase();
      const rank =
        cleanText(
          input.rank,
          80,
        );
      const role =
        validRole(
          input.role,
        );

      if (
        !name ||
        !email ||
        !serviceNumber ||
        !rank
      ) {
        const validationError =
          new Error(
            "Name, email, service number and rank are required.",
          );
        validationError.statusCode = 400;
        throw validationError;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email,
        )
      ) {
        const validationError =
          new Error(
            "Enter a valid official email address.",
          );
        validationError.statusCode = 400;
        throw validationError;
      }

      await uniqueOfficerCheck({
        users,
        teams,
        tablesDB,
        teamId,
        teamName,
        email,
        serviceNumber,
      });

      const temporaryPassword =
        generateTemporaryPassword();

      let user = null;
      let membership = null;
      let profile = null;

      try {
        user =
          await users.create({
            userId:
              ID.unique(),
            email,
            phone:
              phone || undefined,
            password:
              temporaryPassword,
            name,
          });

        const updatedUser =
          await users.updatePrefs({
            userId:
              user.$id,
            prefs: {
              serviceNumber,
              rank,
              roadSafeRole:
                role,
              stationTeamId:
                teamId,
              mustChangePassword:
                true,
              accountStatus:
                "active",
              createdBy:
                callerId,
              createdAt:
                new Date().toISOString(),
            },
          });

        membership =
          await teams.createMembership({
            teamId,
            roles: [role],
            userId:
              user.$id,
            name,
          });

        profile =
          await upsertOfficerProfile({
            tablesDB,
            user: updatedUser,
            membership,
            teamName,
          });

        const officer =
          buildManagedOfficer({
            membership,
            user:
              updatedUser,
            profile,
          });

        await writeAudit({
          tablesDB,
          metadata,
          stationTeamId:
            teamId,
          actor,
          actorRole,
          action:
            "officer_created",
          entityType:
            "officer_profile",
          entityId:
            user.$id,
          entityLabel:
            name,
          targetUserId:
            user.$id,
          details: {
            serviceNumber,
            rank,
            role,
            email,
          },
        });

        log(
          JSON.stringify({
            audit:
              "officer_created",
            callerId,
            teamId,
            targetUserId:
              user.$id,
            role,
            serviceNumber,
          }),
        );

        return json(
          res,
          {
            ok: true,
            message:
              "Officer account created.",
            officer,
            temporaryPassword,
          },
          201,
        );
      } catch (creationError) {
        if (profile?.$id) {
          try {
            await tablesDB.deleteRow({
              databaseId:
                ROADSAFE_DATABASE_ID,
              tableId:
                OFFICER_PROFILES_TABLE_ID,
              rowId:
                profile.$id,
            });
          } catch (rollbackError) {
            error(
              `Profile rollback failed: ${
                rollbackError.message
              }`,
            );
          }
        }

        if (membership?.$id) {
          try {
            await teams.deleteMembership({
              teamId,
              membershipId:
                membership.$id,
            });
          } catch (rollbackError) {
            error(
              `Membership rollback failed: ${
                rollbackError.message
              }`,
            );
          }
        }

        if (user?.$id) {
          try {
            await users.delete({
              userId:
                user.$id,
            });
          } catch (rollbackError) {
            error(
              `Officer rollback failed: ${
                rollbackError.message
              }`,
            );
          }
        }

        throw creationError;
      }
    }

    const targetUserId =
      cleanText(
        body.userId,
        36,
      );
    const membershipId =
      cleanText(
        body.membershipId,
        36,
      );

    if (!targetUserId) {
      const validationError =
        new Error(
          "Target officer user ID is required.",
        );
      validationError.statusCode = 400;
      throw validationError;
    }

    const targetMembership =
      await getMembership({
        teams,
        teamId,
        membershipId,
        userId:
          targetUserId,
      });

    if (
      action ===
      "update_role"
    ) {
      const role =
        validRole(
          body.role,
        );

      await protectAdministrator({
        users,
        teams,
        tablesDB,
        callerId,
        teamId,
        teamName,
        targetUserId,
        targetMembership,
        operation:
          action,
        nextRole:
          role,
      });

      const membership =
        await teams.updateMembership({
          teamId,
          membershipId:
            targetMembership.$id,
          roles: [role],
        });

      const user =
        await users.get({
          userId:
            targetUserId,
        });

      const updatedUser =
        await users.updatePrefs({
          userId:
            targetUserId,
          prefs:
            mergePrefs(
              user.prefs,
              {
                roadSafeRole:
                  role,
                roleUpdatedBy:
                  callerId,
                roleUpdatedAt:
                  new Date().toISOString(),
              },
            ),
        });

      const profile =
        await upsertOfficerProfile({
          tablesDB,
          user:
            updatedUser,
          membership,
          teamName,
        });

      const officer =
        buildManagedOfficer({
          membership,
          user:
            updatedUser,
          profile,
        });

      await writeAudit({
        tablesDB,
        metadata,
        stationTeamId:
          teamId,
        actor,
        actorRole,
        action:
          "officer_role_changed",
        entityType:
          "officer_profile",
        entityId:
          targetUserId,
        entityLabel:
          officer.name,
        targetUserId,
        details: {
          previousRole:
            roleFromMembership(
              targetMembership,
            ),
          newRole: role,
        },
      });

      return json(res, {
        ok: true,
        officer,
      });
    }

    if (
      action ===
      "set_status"
    ) {
      const status =
        body.status === true;

      await protectAdministrator({
        users,
        teams,
        tablesDB,
        callerId,
        teamId,
        teamName,
        targetUserId,
        targetMembership,
        operation:
          action,
        nextStatus:
          status,
      });

      const statusUser =
        await users.updateStatus({
          userId:
            targetUserId,
          status,
        });

      const updatedUser =
        await users.updatePrefs({
          userId:
            targetUserId,
          prefs:
            mergePrefs(
              statusUser.prefs,
              {
                accountStatus:
                  status
                    ? "active"
                    : "blocked",
                statusUpdatedBy:
                  callerId,
                statusUpdatedAt:
                  new Date().toISOString(),
              },
            ),
        });

      const profile =
        await upsertOfficerProfile({
          tablesDB,
          user:
            updatedUser,
          membership:
            targetMembership,
          teamName,
          statusOverride:
            status
              ? "active"
              : "blocked",
        });

      const officer =
        buildManagedOfficer({
          membership:
            targetMembership,
          user:
            updatedUser,
          profile,
        });

      await writeAudit({
        tablesDB,
        metadata,
        stationTeamId:
          teamId,
        actor,
        actorRole,
        action:
          status
            ? "officer_reactivated"
            : "officer_blocked",
        entityType:
          "officer_profile",
        entityId:
          targetUserId,
        entityLabel:
          officer.name,
        targetUserId,
        severity:
          status
            ? "info"
            : "warning",
        details: {
          status:
            status
              ? "active"
              : "blocked",
        },
      });

      return json(res, {
        ok: true,
        officer,
      });
    }

    if (
      action ===
      "reset_password"
    ) {
      await protectAdministrator({
        users,
        teams,
        tablesDB,
        callerId,
        teamId,
        teamName,
        targetUserId,
        targetMembership,
        operation:
          action,
      });

      const temporaryPassword =
        generateTemporaryPassword();

      const passwordUser =
        await users.updatePassword({
          userId:
            targetUserId,
          password:
            temporaryPassword,
        });

      await users.updateStatus({
        userId:
          targetUserId,
        status: true,
      });

      const updatedUser =
        await users.updatePrefs({
          userId:
            targetUserId,
          prefs:
            mergePrefs(
              passwordUser.prefs,
              {
                mustChangePassword:
                  true,
                accountStatus:
                  "active",
                passwordResetBy:
                  callerId,
                passwordResetAt:
                  new Date().toISOString(),
              },
            ),
        });

      const profile =
        await upsertOfficerProfile({
          tablesDB,
          user:
            updatedUser,
          membership:
            targetMembership,
          teamName,
          statusOverride:
            "active",
        });

      const officer =
        buildManagedOfficer({
          membership:
            targetMembership,
          user:
            updatedUser,
          profile,
        });

      await writeAudit({
        tablesDB,
        metadata,
        stationTeamId:
          teamId,
        actor,
        actorRole,
        action:
          "password_reset",
        entityType:
          "authentication",
        entityId:
          targetUserId,
        entityLabel:
          officer.name,
        targetUserId,
        severity:
          "warning",
        details: {
          mustChangePassword:
            true,
        },
      });

      return json(res, {
        ok: true,
        officer,
        temporaryPassword,
      });
    }

    if (
      action ===
      "remove_officer"
    ) {
      await protectAdministrator({
        users,
        teams,
        tablesDB,
        callerId,
        teamId,
        teamName,
        targetUserId,
        targetMembership,
        operation:
          action,
      });

      const user =
        await users.get({
          userId:
            targetUserId,
        });

      const existingProfile =
        await getRowOrNull({
          tablesDB,
          tableId:
            OFFICER_PROFILES_TABLE_ID,
          rowId:
            targetUserId,
        });

      await teams.deleteMembership({
        teamId,
        membershipId:
          targetMembership.$id,
      });

      const blockedUser =
        await users.updateStatus({
          userId:
            targetUserId,
          status:
            false,
        });

      await users.updatePrefs({
        userId:
          targetUserId,
        prefs:
          mergePrefs(
            blockedUser.prefs,
            {
              stationTeamId:
                "",
              accountStatus:
                "removed",
              removedBy:
                callerId,
              removedAt:
                new Date().toISOString(),
            },
          ),
      });

      if (existingProfile) {
        await tablesDB.updateRow({
          databaseId:
            ROADSAFE_DATABASE_ID,
          tableId:
            OFFICER_PROFILES_TABLE_ID,
          rowId:
            targetUserId,
          data: {
            status:
              "removed",
            mustChangePassword:
              false,
          },
          permissions:
            profilePermissions(
              teamId,
            ),
        });
      }

      await writeAudit({
        tablesDB,
        metadata,
        stationTeamId:
          teamId,
        actor,
        actorRole,
        action:
          "officer_removed",
        entityType:
          "officer_profile",
        entityId:
          targetUserId,
        entityLabel:
          user.name ||
          user.email,
        targetUserId,
        severity:
          "warning",
        details: {
          previousRole:
            roleFromMembership(
              targetMembership,
            ),
          accountBlocked:
            true,
          membershipRemoved:
            true,
        },
      });

      return json(res, {
        ok: true,
        message:
          "Officer removed from station.",
      });
    }

    return json(
      res,
      {
        ok: false,
        message:
          "Unsupported officer-management action.",
      },
      400,
    );
  } catch (requestError) {
    const statusCode =
      requestError.statusCode ??
      requestError.code ??
      (requestError instanceof
      AppwriteException
        ? requestError.code
        : 500);

    if (actor && teamId) {
      await writeAudit({
        tablesDB,
        metadata,
        stationTeamId:
          teamId,
        actor,
        actorRole,
        action:
          `${action || "officer_management"}_failed`,
        entityType:
          "system",
        entityId:
          cleanText(
            body.userId,
            128,
          ),
        targetUserId:
          cleanText(
            body.userId,
            36,
          ),
        outcome:
          statusCode === 401 ||
          statusCode === 403
            ? "denied"
            : "failed",
        severity:
          statusCode === 401 ||
          statusCode === 403
            ? "warning"
            : "critical",
        details: {
          message:
            requestError.message ??
            "Unknown failure",
        },
      });
    }

    error(
      requestError.stack ??
        requestError.message ??
        String(requestError),
    );

    return json(
      res,
      {
        ok: false,
        message:
          requestError.message ??
          "Officer management failed.",
      },
      Number.isInteger(
        statusCode,
      ) &&
        statusCode >= 400 &&
        statusCode <= 599
        ? statusCode
        : 500,
    );
  }
}
