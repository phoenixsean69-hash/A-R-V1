import crypto from "node:crypto";

import {
  AppwriteException,
  Client,
  ID,
  Query,
  Teams,
  Users,
} from "node-appwrite";

const ROLES = new Set([
  "field_officer",
  "supervisor",
  "station_admin",
]);

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
  const role = normaliseRole(value);

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

async function requireStationAdmin({
  users,
  callerId,
  teamId,
}) {
  if (!callerId) {
    const error =
      new Error(
        "An authenticated RoadSafe account is required.",
      );
    error.statusCode = 401;
    throw error;
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
    const error =
      new Error(
        "The caller does not belong to this police station.",
      );
    error.statusCode = 403;
    throw error;
  }

  const roles =
    (membership.roles ?? []).map(
      normaliseRole,
    );

  if (
    !roles.includes(
      "station_admin",
    )
  ) {
    const error =
      new Error(
        "Only a Station Administrator can manage police officers.",
      );
    error.statusCode = 403;
    throw error;
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
      membership.userId !== userId
    ) {
      const error =
        new Error(
          "The selected membership does not belong to the selected officer.",
        );
      error.statusCode = 400;
      throw error;
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
    const error =
      new Error(
        "The officer is not a member of this police station.",
      );
    error.statusCode = 404;
    throw error;
  }

  return membership;
}

function buildManagedOfficer({
  membership,
  user,
}) {
  const prefs = user?.prefs ?? {};

  return {
    userId: user?.$id ?? membership.userId,
    membershipId: membership.$id,
    teamId: membership.teamId,
    name:
      user?.name ||
      membership.userName ||
      "Unnamed officer",
    email:
      user?.email ||
      membership.userEmail ||
      "",
    phone: user?.phone || "",
    serviceNumber: String(prefs.serviceNumber ?? ""),
    rank: String(prefs.rank ?? ""),
    role: roleFromMembership(membership),
    roles: membership.roles ?? [],
    status: user?.status === false ? "blocked" : "active",
    joinedAt:
      membership.joined || membership.invited || "",
    registeredAt: user?.registration || "",
    lastActivityAt: user?.accessedAt || "",
    mustChangePassword:
      prefs.mustChangePassword === true,
  };
}

async function managedOfficer({
  users,
  membership,
  user,
}) {
  const resolvedUser =
    user ??
    (await users.get({
      userId: membership.userId,
    }));

  return buildManagedOfficer({
    membership,
    user: resolvedUser,
  });
}

async function listStationOfficers({
  users,
  teams,
  teamId,
}) {
  const result =
    await teams.listMemberships({
      teamId,
      queries: [Query.limit(100)],
      total: false,
    });

  const activeMemberships =
    result.memberships.filter(membershipActive);

  try {
    const officers = await Promise.all(
      activeMemberships.map((membership) =>
        managedOfficer({
          users,
          membership,
        }),
      ),
    );

    return officers.sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  } catch (readError) {
    const scopeError = new Error(
      `RoadSafe found ${activeMemberships.length} active station membership(s), but could not read their Appwrite user records. Enable users.read, users.write, teams.read and teams.write in the Function Auth scopes. Original error: ${readError.message ?? String(readError)}`,
    );
    scopeError.statusCode =
      Number.isInteger(readError.code) && readError.code >= 400
        ? readError.code
        : 500;
    throw scopeError;
  }
}

async function countActiveAdmins({
  users,
  teams,
  teamId,
}) {
  const officers =
    await listStationOfficers({
      users,
      teams,
      teamId,
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
  callerId,
  teamId,
  targetUserId,
  targetMembership,
  operation,
  nextRole,
  nextStatus,
}) {
  if (
    callerId === targetUserId
  ) {
    const error =
      new Error(
        "A Station Administrator cannot change, block or remove their own account.",
      );
    error.statusCode = 400;
    throw error;
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

  if (!removesAdmin) return;

  const adminCount =
    await countActiveAdmins({
      users,
      teams,
      teamId,
    });

  if (adminCount <= 1) {
    const error =
      new Error(
        "RoadSafe cannot remove or block the station's last active administrator.",
      );
    error.statusCode = 400;
    throw error;
  }
}

async function uniqueOfficerCheck({
  users,
  teams,
  teamId,
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
    const error =
      new Error(
        "An Appwrite account already exists with that email address.",
      );
    error.statusCode = 409;
    throw error;
  }

  const officers =
    await listStationOfficers({
      users,
      teams,
      teamId,
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
    const error =
      new Error(
        "That police service number is already registered at this station.",
      );
    error.statusCode = 409;
    throw error;
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
    ];
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

  let body;

  try {
    body = parseBody(req);
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

  try {
    await requireStationAdmin({
      users,
      callerId,
      teamId,
    });

    if (
      action ===
      "list_officers"
    ) {
      const officers =
        await listStationOfficers({
          users,
          teams,
          teamId,
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
        teamId,
        email,
        serviceNumber,
      });

      const temporaryPassword =
        generateTemporaryPassword();

      let user = null;
      let membership = null;

      try {
        user =
          await users.create({
            userId: ID.unique(),
            email,
            phone:
              phone || undefined,
            password:
              temporaryPassword,
            name,
          });

        const updatedUser =
          await users.updatePrefs({
          userId: user.$id,
          prefs: {
            serviceNumber,
            rank,
            roadSafeRole: role,
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
            userId: user.$id,
            name,
          });

        const officer =
          buildManagedOfficer({
            membership,
            user: updatedUser,
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
        if (membership?.$id) {
          try {
            await teams.deleteMembership({
              teamId,
              membershipId: membership.$id,
            });
          } catch (rollbackError) {
            error(
              `Membership rollback failed: ${rollbackError.message}`,
            );
          }
        }

        if (user?.$id) {
          try {
            await users.delete({
              userId: user.$id,
            });
          } catch (
            rollbackError
          ) {
            error(
              `Officer rollback failed: ${rollbackError.message}`,
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
        validRole(body.role);

      await protectAdministrator({
        users,
        teams,
        callerId,
        teamId,
        targetUserId,
        targetMembership,
        operation: action,
        nextRole: role,
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

      await users.updatePrefs({
        userId:
          targetUserId,
        prefs: mergePrefs(
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

      const officer =
        await managedOfficer({
          users,
          membership,
        });

      log(
        JSON.stringify({
          audit:
            "officer_role_changed",
          callerId,
          teamId,
          targetUserId,
          role,
        }),
      );

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
        callerId,
        teamId,
        targetUserId,
        targetMembership,
        operation: action,
        nextStatus: status,
      });

      const user =
        await users.updateStatus({
          userId:
            targetUserId,
          status,
        });

      await users.updatePrefs({
        userId:
          targetUserId,
        prefs: mergePrefs(
          user.prefs,
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

      const officer =
        await managedOfficer({
          users,
          membership:
            targetMembership,
        });

      log(
        JSON.stringify({
          audit:
            status
              ? "officer_reactivated"
              : "officer_blocked",
          callerId,
          teamId,
          targetUserId,
        }),
      );

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
        callerId,
        teamId,
        targetUserId,
        targetMembership,
        operation: action,
      });

      const temporaryPassword =
        generateTemporaryPassword();

      const user =
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
        prefs: mergePrefs(
          user.prefs,
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

      const officer =
        buildManagedOfficer({
          membership:
            targetMembership,
          user: updatedUser,
        });

      log(
        JSON.stringify({
          audit:
            "officer_password_reset",
          callerId,
          teamId,
          targetUserId,
        }),
      );

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
        callerId,
        teamId,
        targetUserId,
        targetMembership,
        operation: action,
      });

      const user =
        await users.get({
          userId:
            targetUserId,
        });

      await teams.deleteMembership({
        teamId,
        membershipId:
          targetMembership.$id,
      });

      await users.updateStatus({
        userId:
          targetUserId,
        status: false,
      });

      await users.updatePrefs({
        userId:
          targetUserId,
        prefs: mergePrefs(
          user.prefs,
          {
            stationTeamId: "",
            accountStatus:
              "removed",
            removedBy:
              callerId,
            removedAt:
              new Date().toISOString(),
          },
        ),
      });

      log(
        JSON.stringify({
          audit:
            "officer_removed",
          callerId,
          teamId,
          targetUserId,
        }),
      );

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
