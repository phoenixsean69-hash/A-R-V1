export type MappingProvider = "Google" | "Open Map";

export type GoogleMapDisplayType =
  | "Road"
  | "Satellite"
  | "Hybrid"
  | "Terrain";

export interface MappingProviderStatus {
  configured: boolean;
  provider: MappingProvider;
}
