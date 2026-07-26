import {
  Account,
  Client,
  Functions,
  Storage,
  TablesDB,
  Teams,
} from "appwrite";

const endpoint =
  import.meta.env.VITE_APPWRITE_ENDPOINT?.trim() ?? "";
const projectId =
  import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim() ?? "";

const databaseId =
  import.meta.env.VITE_APPWRITE_DATABASE_ID?.trim() ??
  "6a65ba680015d256c655";

const profilesTableId =
  import.meta.env.VITE_APPWRITE_PROFILES_TABLE_ID?.trim() ??
  "6a65baad0030250bf9b9";

const casesTableId =
  import.meta.env.VITE_APPWRITE_CASES_TABLE_ID?.trim() ??
  "6a65bae000064a38d2d1";

const caseEventsTableId =
  import.meta.env.VITE_APPWRITE_CASE_EVENTS_TABLE_ID?.trim() ??
  "6a65bafc002d192bf43a";

const auditLogsTableId =
  import.meta.env.VITE_APPWRITE_AUDIT_LOGS_TABLE_ID?.trim() ??
  "6a65bb1400100c00ad6f";

const officerAvatarsBucketId =
  import.meta.env.VITE_APPWRITE_OFFICER_AVATARS_BUCKET_ID?.trim() ??
  "";

export const appwriteConfig = {
  endpoint,
  projectId,
  officerAdminFunctionId:
    import.meta.env.VITE_APPWRITE_OFFICER_ADMIN_FUNCTION_ID?.trim() ??
    "roadsafe-officer-admin",

  databaseId,
  profilesTableId,
  casesTableId,
  caseEventsTableId,
  auditLogsTableId,
  officerAvatarsBucketId,

  configured: Boolean(endpoint && projectId),
  databaseConfigured: Boolean(
    databaseId &&
      profilesTableId &&
      casesTableId &&
      caseEventsTableId &&
      auditLogsTableId,
  ),
} as const;

/**
 * RoadSafe uses one shared browser Client instance.
 * Appwrite persists the authenticated web session for this client.
 */
export const appwriteClient = new Client();

if (endpoint) {
  appwriteClient.setEndpoint(endpoint);
}

if (projectId) {
  appwriteClient.setProject(projectId);
}

export const account = new Account(appwriteClient);
export const teams = new Teams(appwriteClient);
export const functions = new Functions(appwriteClient);
export const tablesDB = new TablesDB(appwriteClient);
export const storage = new Storage(appwriteClient);
