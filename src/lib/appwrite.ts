import {
  Account,
  Client,
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
  configured: Boolean(endpoint && projectId),
} as const;

/**
 * RoadSafe must use one shared browser Client instance.
 * Appwrite persists the web session for this client automatically.
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
export const tablesDB = new TablesDB(appwriteClient);
export const storage = new Storage(appwriteClient);
