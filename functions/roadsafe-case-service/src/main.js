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

const DATABASE_ID =
  process.env.ROADSAFE_DATABASE_ID ||
  "6a65ba680015d256c655";

const PROFILES_TABLE_ID =
  process.env.ROADSAFE_PROFILES_TABLE_ID ||
  "6a65baad0030250bf9b9";

const CASES_TABLE_ID =
  process.env.ROADSAFE_CASES_TABLE_ID ||
  "6a65bade00064a38d2d1";

const CASE_EVENTS_TABLE_ID =
  process.env.ROADSAFE_CASE_EVENTS_TABLE_ID ||
  "6a65bafc002d192bf43a";

const AUDIT_LOGS_TABLE_ID =
  process.env.ROADSAFE_AUDIT_LOGS_TABLE_ID ||
  "6a65bb1400100c00ad6f";

const ROADSAFE_ROLES = new Set([
  "field_officer",
  "supervisor",
  "station_admin",
]);

const CASE_STATUSES = new Set([
  "Open",
  "Under Investigation",
  "Reconstruction Complete",
  "Closed",
  "Archived",
]);

const REVIEW_STATUSES = new Set([
  "draft",
  "in_progress",
  "submitted",
  "changes_requested",
  "approved",
]);

const CASE_EVENT_TYPES = new Set([
  "case_created",
  "case_updated",
  "location_confirmed",
  "road_geometry_detected",
  "scene_generated",
  "evidence_added",
  "evidence_removed",
  "reconstruction_started",
  "reconstruction_saved",
  "footage_recorded",
  "case_submitted",
  "changes_requested",
  "comment_added",
  "case_approved",
  "case_closed",
  "case_archived",
  "officer_assigned",
  "supervisor_assigned",
  "status_changed",
]);

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
    const requestError =
      new Error(
        "The request body must contain valid JSON.",
      );
    requestError.statusCode = 400;
    throw requestError;
  }
}

function cleanText(
  value,
  maximum = 128,
) {
  return String(value ?? "")
    .trim()
    .slice(0, maximum);
}

function normaliseRole(value) {
  return cleanText(value, 40)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function activeMembership(
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
        ROADSAFE_ROLES.has(role),
      ) ?? null
  );
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      note:
        "RoadSafe could not serialize this data.",
    });
  }
}

function parseJson(value) {
  if (!value) return undefined;

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
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

function casePermissions(
  teamId,
  assignedOfficerUserId,
) {
  return Array.from(
    new Set([
      Permission.read(
        Role.user(
          assignedOfficerUserId,
        ),
      ),
      Permission.update(
        Role.user(
          assignedOfficerUserId,
        ),
      ),
      Permission.read(
        Role.team(
          teamId,
          "supervisor",
        ),
      ),
      Permission.update(
        Role.team(
          teamId,
          "supervisor",
        ),
      ),
      Permission.read(
        Role.team(
          teamId,
          "station_admin",
        ),
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
    ]),
  );
}

function eventPermissions(
  teamId,
  assignedOfficerUserId,
) {
  return Array.from(
    new Set([
      Permission.read(
        Role.user(
          assignedOfficerUserId,
        ),
      ),
      Permission.read(
        Role.team(
          teamId,
          "supervisor",
        ),
      ),
      Permission.read(
        Role.team(
          teamId,
          "station_admin",
        ),
      ),
    ]),
  );
}

async function getRowOrNull({
  tablesDB,
  tableId,
  rowId,
}) {
  try {
    return await tablesDB.getRow({
      databaseId:
        DATABASE_ID,
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

async function resolveAccess({
  users,
  teams,
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

  const result =
    await users.listMemberships({
      userId:
        callerId,
      queries: [
        Query.equal(
          "teamId",
          teamId,
        ),
      ],
      total: false,
    });

  const membership =
    result.memberships.find(
      (item) =>
        item.teamId === teamId &&
        activeMembership(item),
    );

  if (!membership) {
    const requestError =
      new Error(
        "The current officer does not belong to this police station.",
      );
    requestError.statusCode = 403;
    throw requestError;
  }

  const role =
    roleFromMembership(
      membership,
    );

  if (!role) {
    const requestError =
      new Error(
        "The current station membership has no recognized RoadSafe role.",
      );
    requestError.statusCode = 403;
    throw requestError;
  }

  const [user, team] =
    await Promise.all([
      users.get({
        userId:
          callerId,
      }),
      teams.get({
        teamId,
      }),
    ]);

  return {
    user,
    team,
    membership,
    role,
  };
}

function canReadCase(
  access,
  row,
) {
  return (
    row.stationTeamId ===
      access.team.$id &&
    (
      access.role ===
        "supervisor" ||
      access.role ===
        "station_admin" ||
      row.assignedOfficerUserId ===
        access.user.$id
    )
  );
}

function canUpdateCase(
  access,
  row,
) {
  if (
    row.stationTeamId !==
    access.team.$id
  ) {
    return false;
  }

  if (
    access.role ===
      "supervisor" ||
    access.role ===
      "station_admin"
  ) {
    return true;
  }

  return (
    access.role ===
      "field_officer" &&
    row.assignedOfficerUserId ===
      access.user.$id &&
    row.status !== "Archived" &&
    row.reviewStatus !==
      "approved"
  );
}

function pointFromInput(
  siteCoordinate,
) {
  const longitude =
    Number(
      siteCoordinate?.longitude,
    );
  const latitude =
    Number(
      siteCoordinate?.latitude,
    );

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return null;
  }

  return [
    longitude,
    latitude,
  ];
}

function coordinateFromRow(row) {
  const point =
    row.siteCoordinate;

  if (
    Array.isArray(point) &&
    point.length >= 2
  ) {
    return {
      longitude:
        Number(point[0]),
      latitude:
        Number(point[1]),
      accuracyMetres:
        Math.max(
          0,
          Number(
            row.siteAccuracyMetres ??
            0,
          ),
        ),
      capturedAt:
        row.siteCapturedAt ||
        row.$updatedAt,
    };
  }

  if (
    point &&
    typeof point ===
      "object" &&
    Array.isArray(
      point.coordinates,
    )
  ) {
    return {
      longitude:
        Number(
          point.coordinates[0],
        ),
      latitude:
        Number(
          point.coordinates[1],
        ),
      accuracyMetres:
        Math.max(
          0,
          Number(
            row.siteAccuracyMetres ??
            0,
          ),
        ),
      capturedAt:
        row.siteCapturedAt ||
        row.$updatedAt,
    };
  }

  return undefined;
}

function rowToCase(row) {
  return {
    id: row.$id,
    caseNumber:
      row.caseNumber,
    title:
      row.title,
    accidentDate:
      row.accidentDate,
    accidentTime:
      row.accidentTime,
    location:
      row.location,
    junctionId:
      row.junctionId ||
      undefined,
    investigatingOfficer:
      row.assignedOfficerName,
    policeStation:
      row.stationName,
    status:
      row.status,
    reconstructionId:
      row.reconstructionId ||
      undefined,
    roadLayoutDetection:
      parseJson(
        row.roadLayoutJson,
      ),
    siteCoordinate:
      coordinateFromRow(row),
    footageIds:
      Array.isArray(
        row.footageIds,
      )
        ? row.footageIds
        : [],
    primaryFootageId:
      row.primaryFootageId ||
      undefined,
    summary:
      row.summary || "",
    createdAt:
      row.$createdAt,
    updatedAt:
      row.$updatedAt,
    stationTeamId:
      row.stationTeamId,
    createdByUserId:
      row.createdByUserId,
    assignedOfficerUserId:
      row.assignedOfficerUserId,
    assignedSupervisorUserId:
      row.assignedSupervisorUserId ||
      undefined,
    reviewStatus:
      row.reviewStatus,
    cloudVersion:
      Number(
        row.version ?? 1,
      ),
    cloudSyncedAt:
      row.$updatedAt,
    cloudSyncState:
      "synced",
  };
}

async function getProfileByUserId({
  tablesDB,
  userId,
  teamId,
}) {
  const profile =
    await getRowOrNull({
      tablesDB,
      tableId:
        PROFILES_TABLE_ID,
      rowId:
        userId,
    });

  if (
    !profile ||
    profile.stationTeamId !==
      teamId ||
    profile.status !==
      "active"
  ) {
    return null;
  }

  return profile;
}

async function findProfileByName({
  tablesDB,
  teamId,
  fullName,
}) {
  if (!fullName) {
    return null;
  }

  const result =
    await tablesDB.listRows({
      databaseId:
        DATABASE_ID,
      tableId:
        PROFILES_TABLE_ID,
      queries: [
        Query.equal(
          "stationTeamId",
          teamId,
        ),
        Query.equal(
          "fullName",
          fullName,
        ),
        Query.equal(
          "status",
          "active",
        ),
        Query.limit(2),
      ],
      total: false,
    });

  return (
    result.rows[0] ??
    null
  );
}

async function resolveAssignedOfficer({
  tablesDB,
  access,
  caseInput,
  existingRow,
}) {
  if (
    access.role ===
    "field_officer"
  ) {
    const ownProfile =
      await getProfileByUserId({
        tablesDB,
        userId:
          access.user.$id,
        teamId:
          access.team.$id,
      });

    return {
      userId:
        access.user.$id,
      name:
        ownProfile?.fullName ||
        access.user.name ||
        access.user.email,
    };
  }

  const requestedUserId =
    cleanText(
      caseInput.assignedOfficerUserId,
      36,
    );

  if (requestedUserId) {
    const profile =
      await getProfileByUserId({
        tablesDB,
        userId:
          requestedUserId,
        teamId:
          access.team.$id,
      });

    if (profile) {
      return {
        userId:
          profile.userId,
        name:
          profile.fullName,
      };
    }
  }

  const requestedName =
    cleanText(
      caseInput.investigatingOfficer ||
      caseInput.assignedOfficerName,
      128,
    );

  const profileByName =
    await findProfileByName({
      tablesDB,
      teamId:
        access.team.$id,
      fullName:
        requestedName,
    });

  if (profileByName) {
    return {
      userId:
        profileByName.userId,
      name:
        profileByName.fullName,
    };
  }

  if (
    existingRow?.assignedOfficerUserId
  ) {
    return {
      userId:
        existingRow.assignedOfficerUserId,
      name:
        existingRow.assignedOfficerName,
    };
  }

  const ownProfile =
    await getProfileByUserId({
      tablesDB,
      userId:
        access.user.$id,
      teamId:
        access.team.$id,
    });

  return {
    userId:
      access.user.$id,
    name:
      ownProfile?.fullName ||
      access.user.name ||
      access.user.email,
  };
}

function validateCaseId(value) {
  const caseId =
    cleanText(value, 36);

  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(
      caseId,
    )
  ) {
    const requestError =
      new Error(
        "The local case ID is not compatible with Appwrite.",
      );
    requestError.statusCode = 400;
    throw requestError;
  }

  return caseId;
}

function validateCaseInput(
  input,
) {
  const caseNumber =
    cleanText(
      input.caseNumber,
      40,
    );
  const title =
    cleanText(
      input.title,
      180,
    );
  const accidentDate =
    cleanText(
      input.accidentDate,
      10,
    );
  const accidentTime =
    cleanText(
      input.accidentTime,
      5,
    );
  const location =
    cleanText(
      input.location,
      512,
    );
  const status =
    cleanText(
      input.status,
      40,
    ) || "Open";

  if (
    !caseNumber ||
    !title ||
    !accidentDate ||
    !accidentTime ||
    !location
  ) {
    const requestError =
      new Error(
        "Case number, title, accident date, accident time and location are required.",
      );
    requestError.statusCode = 400;
    throw requestError;
  }

  if (
    !CASE_STATUSES.has(
      status,
    )
  ) {
    const requestError =
      new Error(
        "The case contains an unsupported investigation status.",
      );
    requestError.statusCode = 400;
    throw requestError;
  }

  return {
    caseNumber,
    title,
    accidentDate,
    accidentTime,
    location,
    status,
  };
}

async function ensureUniqueCaseNumber({
  tablesDB,
  teamId,
  caseNumber,
  excludingRowId,
}) {
  const result =
    await tablesDB.listRows({
      databaseId:
        DATABASE_ID,
      tableId:
        CASES_TABLE_ID,
      queries: [
        Query.equal(
          "stationTeamId",
          teamId,
        ),
        Query.equal(
          "caseNumber",
          caseNumber,
        ),
        Query.limit(2),
      ],
      total: false,
    });

  const duplicate =
    result.rows.find(
      (row) =>
        row.$id !==
        excludingRowId,
    );

  if (duplicate) {
    const requestError =
      new Error(
        `Case number ${caseNumber} already exists in this station.`,
      );
    requestError.statusCode = 409;
    throw requestError;
  }
}

function determineEventType({
  requested,
  existingRow,
  nextStatus,
}) {
  if (!existingRow) {
    return "case_created";
  }

  if (
    nextStatus ===
      "Archived" &&
    existingRow.status !==
      "Archived"
  ) {
    return "case_archived";
  }

  if (
    nextStatus ===
      "Closed" &&
    existingRow.status !==
      "Closed"
  ) {
    return "case_closed";
  }

  if (
    existingRow.status !==
    nextStatus
  ) {
    return "status_changed";
  }

  return CASE_EVENT_TYPES.has(
    requested,
  )
    ? requested
    : "case_updated";
}

async function writeCaseEvent({
  tablesDB,
  access,
  row,
  eventType,
  message,
}) {
  await tablesDB.createRow({
    databaseId:
      DATABASE_ID,
    tableId:
      CASE_EVENTS_TABLE_ID,
    rowId:
      ID.unique(),
    data: {
      stationTeamId:
        access.team.$id,
      caseId:
        row.$id,
      caseNumber:
        row.caseNumber,
      eventType,
      sourceClient:
        access.role ===
        "field_officer"
          ? "field"
          : "station",
      actorUserId:
        access.user.$id,
      actorName:
        access.user.name ||
        access.user.email,
      actorRole:
        access.role,
      title:
        eventType
          .split("_")
          .map(
            (part) =>
              part.charAt(0)
                .toUpperCase() +
              part.slice(1),
          )
          .join(" "),
      message:
        cleanText(
          message,
          4000,
        ),
      payloadJson:
        safeJson({
          status:
            row.status,
          reviewStatus:
            row.reviewStatus,
          assignedOfficerUserId:
            row.assignedOfficerUserId,
        }),
      targetUserId:
        row.assignedOfficerUserId,
      requiresAction:
        eventType ===
          "changes_requested",
      resolved: false,
      caseVersion:
        Number(
          row.version ?? 1,
        ),
      occurredAt:
        new Date().toISOString(),
    },
    permissions:
      eventPermissions(
        access.team.$id,
        row.assignedOfficerUserId,
      ),
  });
}

async function writeAudit({
  tablesDB,
  metadata,
  access,
  action,
  entityId,
  entityLabel,
  targetUserId = "",
  outcome = "success",
  severity = "info",
  details = {},
}) {
  try {
    await tablesDB.createRow({
      databaseId:
        DATABASE_ID,
      tableId:
        AUDIT_LOGS_TABLE_ID,
      rowId:
        ID.unique(),
      data: {
        stationTeamId:
          access.team.$id,
        actorUserId:
          access.user.$id,
        actorName:
          access.user.name ||
          access.user.email,
        actorRole:
          access.role,
        action,
        entityType:
          "case",
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
      "RoadSafe case audit write failed:",
      auditError,
    );
  }
}

async function saveCase({
  tablesDB,
  access,
  caseInput,
  requestedEventType,
  metadata,
  importing = false,
}) {
  const caseId =
    validateCaseId(
      caseInput.id,
    );

  const existingRow =
    await getRowOrNull({
      tablesDB,
      tableId:
        CASES_TABLE_ID,
      rowId:
        caseId,
    });

  if (
    existingRow &&
    !canUpdateCase(
      access,
      existingRow,
    )
  ) {
    const requestError =
      new Error(
        "You do not have permission to update this case.",
      );
    requestError.statusCode = 403;
    throw requestError;
  }

  if (
    !existingRow &&
    access.role ===
      "field_officer" &&
    caseInput.status ===
      "Archived"
  ) {
    const requestError =
      new Error(
        "A Field Officer cannot create an archived case.",
      );
    requestError.statusCode = 403;
    throw requestError;
  }

  const validated =
    validateCaseInput(
      caseInput,
    );

  await ensureUniqueCaseNumber({
    tablesDB,
    teamId:
      access.team.$id,
    caseNumber:
      validated.caseNumber,
    excludingRowId:
      caseId,
  });

  const assignedOfficer =
    await resolveAssignedOfficer({
      tablesDB,
      access,
      caseInput,
      existingRow,
    });

  const incomingReview =
    cleanText(
      caseInput.reviewStatus,
      40,
    );

  const reviewStatus =
    REVIEW_STATUSES.has(
      incomingReview,
    )
      ? incomingReview
      : existingRow?.reviewStatus ||
        "draft";

  const version =
    existingRow
      ? Number(
          existingRow.version ??
          1,
        ) + 1
      : Math.max(
          1,
          Number(
            caseInput.cloudVersion ??
            1,
          ),
        );

  const data = {
    stationTeamId:
      access.team.$id,
    stationName:
      access.team.name ||
      access.team.$id,
    caseNumber:
      validated.caseNumber,
    title:
      validated.title,
    accidentDate:
      validated.accidentDate,
    accidentTime:
      validated.accidentTime,
    location:
      validated.location,
    junctionId:
      cleanText(
        caseInput.junctionId,
        128,
      ),
    createdByUserId:
      existingRow?.createdByUserId ||
      access.user.$id,
    assignedOfficerUserId:
      assignedOfficer.userId,
    assignedOfficerName:
      assignedOfficer.name,
    assignedSupervisorUserId:
      cleanText(
        caseInput.assignedSupervisorUserId ||
        existingRow?.assignedSupervisorUserId,
        36,
      ),
    status:
      validated.status,
    reviewStatus,
    summary:
      cleanText(
        caseInput.summary,
        100000,
      ),
    siteCoordinate:
      pointFromInput(
        caseInput.siteCoordinate,
      ),
    siteAccuracyMetres:
      caseInput.siteCoordinate
        ? Math.max(
            0,
            Number(
              caseInput.siteCoordinate
                .accuracyMetres ??
              0,
            ),
          )
        : null,
    siteCapturedAt:
      caseInput.siteCoordinate
        ?.capturedAt ||
      null,
    roadLayoutJson:
      caseInput.roadLayoutDetection
        ? safeJson(
            caseInput.roadLayoutDetection,
          )
        : "",
    reconstructionId:
      cleanText(
        caseInput.reconstructionId,
        36,
      ),
    footageIds:
      Array.isArray(
        caseInput.footageIds,
      )
        ? caseInput.footageIds
            .map(
              (value) =>
                cleanText(
                  value,
                  36,
                ),
            )
            .filter(Boolean)
        : [],
    primaryFootageId:
      cleanText(
        caseInput.primaryFootageId,
        36,
      ),
    lastUpdatedByUserId:
      access.user.$id,
    version,
  };

  const row =
    existingRow
      ? await tablesDB.updateRow({
          databaseId:
            DATABASE_ID,
          tableId:
            CASES_TABLE_ID,
          rowId:
            caseId,
          data,
          permissions:
            casePermissions(
              access.team.$id,
              assignedOfficer.userId,
            ),
        })
      : await tablesDB.createRow({
          databaseId:
            DATABASE_ID,
          tableId:
            CASES_TABLE_ID,
          rowId:
            caseId,
          data,
          permissions:
            casePermissions(
              access.team.$id,
              assignedOfficer.userId,
            ),
        });

  const eventType =
    determineEventType({
      requested:
        requestedEventType,
      existingRow,
      nextStatus:
        data.status,
    });

  await writeCaseEvent({
    tablesDB,
    access,
    row,
    eventType,
    message:
      importing
        ? "Legacy local RoadSafe case imported into the shared station register."
        : "Shared case metadata synchronized.",
  });

  await writeAudit({
    tablesDB,
    metadata,
    access,
    action:
      existingRow
        ? "case_updated"
        : importing
          ? "case_imported"
          : "case_created",
    entityId:
      row.$id,
    entityLabel:
      row.caseNumber,
    targetUserId:
      row.assignedOfficerUserId,
    details: {
      eventType,
      version:
        row.version,
      status:
        row.status,
      imported:
        importing,
    },
  });

  return row;
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

  let body = {};

  try {
    body =
      parseBody(req);

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
      const requestError =
        new Error(
          "Police-station Team ID is required.",
        );
      requestError.statusCode = 400;
      throw requestError;
    }

    const access =
      await resolveAccess({
        users,
        teams,
        callerId,
        teamId,
      });

    const metadata =
      requestMetadata(req);

    if (
      action ===
      "list_cases"
    ) {
      const queries = [
        Query.equal(
          "stationTeamId",
          teamId,
        ),
        Query.limit(100),
      ];

      if (
        access.role ===
        "field_officer"
      ) {
        queries.push(
          Query.equal(
            "assignedOfficerUserId",
            access.user.$id,
          ),
        );
      }

      const result =
        await tablesDB.listRows({
          databaseId:
            DATABASE_ID,
          tableId:
            CASES_TABLE_ID,
          queries,
          total: false,
        });

      const cases =
        result.rows
          .filter(
            (row) =>
              canReadCase(
                access,
                row,
              ),
          )
          .sort(
            (left, right) =>
              new Date(
                right.$updatedAt,
              ).getTime() -
              new Date(
                left.$updatedAt,
              ).getTime(),
          )
          .map(rowToCase);

      return json(res, {
        ok: true,
        cases,
      });
    }

    if (
      action ===
      "get_case"
    ) {
      const caseId =
        validateCaseId(
          body.caseId,
        );

      const row =
        await getRowOrNull({
          tablesDB,
          tableId:
            CASES_TABLE_ID,
          rowId:
            caseId,
        });

      if (!row) {
        const requestError =
          new Error(
            "The requested case does not exist.",
          );
        requestError.statusCode = 404;
        throw requestError;
      }

      if (
        !canReadCase(
          access,
          row,
        )
      ) {
        const requestError =
          new Error(
            "You do not have permission to view this case.",
          );
        requestError.statusCode = 403;
        throw requestError;
      }

      return json(res, {
        ok: true,
        case:
          rowToCase(row),
      });
    }

    if (
      action ===
      "save_case"
    ) {
      if (
        !body.case ||
        typeof body.case !==
          "object"
      ) {
        const requestError =
          new Error(
            "A complete RoadSafe case record is required.",
          );
        requestError.statusCode = 400;
        throw requestError;
      }

      const row =
        await saveCase({
          tablesDB,
          access,
          caseInput:
            body.case,
          requestedEventType:
            cleanText(
              body.eventType,
              40,
            ),
          metadata,
        });

      log(
        JSON.stringify({
          action:
            "case_saved",
          caseId:
            row.$id,
          caseNumber:
            row.caseNumber,
          actorUserId:
            access.user.$id,
          stationTeamId:
            teamId,
          version:
            row.version,
        }),
      );

      return json(res, {
        ok: true,
        case:
          rowToCase(row),
      });
    }

    if (
      action ===
      "import_local_cases"
    ) {
      if (
        access.role !==
        "station_admin"
      ) {
        const requestError =
          new Error(
            "Only a Station Administrator can import legacy local cases.",
          );
        requestError.statusCode = 403;
        throw requestError;
      }

      const records =
        Array.isArray(
          body.cases,
        )
          ? body.cases.slice(
              0,
              100,
            )
          : [];

      const importedCases = [];
      const skippedCaseNumbers = [];

      for (
        const record
        of records
      ) {
        try {
          const caseNumber =
            cleanText(
              record?.caseNumber,
              40,
            );

          const duplicate =
            await tablesDB.listRows({
              databaseId:
                DATABASE_ID,
              tableId:
                CASES_TABLE_ID,
              queries: [
                Query.equal(
                  "stationTeamId",
                  teamId,
                ),
                Query.equal(
                  "caseNumber",
                  caseNumber,
                ),
                Query.limit(1),
              ],
              total: false,
            });

          if (
            duplicate.rows.length >
            0
          ) {
            skippedCaseNumbers.push(
              caseNumber ||
              "Unknown",
            );
            continue;
          }

          const row =
            await saveCase({
              tablesDB,
              access,
              caseInput:
                record,
              requestedEventType:
                "case_created",
              metadata,
              importing: true,
            });

          importedCases.push(
            rowToCase(row),
          );
        } catch (importError) {
          skippedCaseNumbers.push(
            cleanText(
              record?.caseNumber,
              40,
            ) ||
            "Unknown",
          );

          error(
            importError.stack ||
            importError.message ||
            String(importError),
          );
        }
      }

      return json(res, {
        ok: true,
        message:
          `${importedCases.length} local case(s) imported.`,
        importedCases,
        importedCount:
          importedCases.length,
        skippedCount:
          skippedCaseNumbers.length,
        skippedCaseNumbers,
      });
    }

    if (
      action ===
      "delete_case"
    ) {
      if (
        access.role !==
        "station_admin"
      ) {
        const requestError =
          new Error(
            "Only a Station Administrator can delete a shared case.",
          );
        requestError.statusCode = 403;
        throw requestError;
      }

      const caseId =
        validateCaseId(
          body.caseId,
        );

      const row =
        await getRowOrNull({
          tablesDB,
          tableId:
            CASES_TABLE_ID,
          rowId:
            caseId,
        });

      if (!row) {
        return json(res, {
          ok: true,
          message:
            "The case was already absent.",
        });
      }

      if (
        row.stationTeamId !==
        teamId
      ) {
        const requestError =
          new Error(
            "The selected case belongs to another station.",
          );
        requestError.statusCode = 403;
        throw requestError;
      }

      await tablesDB.deleteRow({
        databaseId:
          DATABASE_ID,
        tableId:
          CASES_TABLE_ID,
        rowId:
          caseId,
      });

      await writeAudit({
        tablesDB,
        metadata,
        access,
        action:
          "case_deleted",
        entityId:
          row.$id,
        entityLabel:
          row.caseNumber,
        targetUserId:
          row.assignedOfficerUserId,
        severity:
          "warning",
        details: {
          title:
            row.title,
          status:
            row.status,
        },
      });

      return json(res, {
        ok: true,
        message:
          "Shared case deleted.",
      });
    }

    return json(
      res,
      {
        ok: false,
        message:
          "Unsupported RoadSafe Case Service action.",
      },
      400,
    );
  } catch (requestError) {
    error(
      requestError.stack ||
      requestError.message ||
      String(requestError),
    );

    const statusCode =
      requestError.statusCode ??
      requestError.code ??
      500;

    return json(
      res,
      {
        ok: false,
        message:
          requestError.message ||
          "RoadSafe Case Service failed.",
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
