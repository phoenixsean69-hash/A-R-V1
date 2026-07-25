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

export const appwriteConfig = {
  endpoint,
  projectId,
  officerAdminFunctionId:
    import.meta.env.VITE_APPWRITE_OFFICER_ADMIN_FUNCTION_ID?.trim() ??
    "roadsafe-officer-admin",
  configured: Boolean(endpoint && projectId),
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
