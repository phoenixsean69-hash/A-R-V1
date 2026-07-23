import type {
  GoogleMapDisplayType,
  MappingProvider,
} from "../types/mapping";

const PROVIDER_KEY = "roadsafe.mapping.provider.v1";
const GOOGLE_MAP_TYPE_KEY = "roadsafe.mapping.google-map-type.v1";
const PROVIDER_EVENT = "roadsafe:mapping-provider-change";

export function isGoogleMapsConfigured(): boolean {
  return Boolean(String(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? "").trim());
}

export function getGoogleMapsBrowserKey(): string {
  return String(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? "").trim();
}

export function getGoogleMapsMapId(): string | undefined {
  const value = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
  return value || undefined;
}

export function getPreferredMappingProvider(): MappingProvider {
  const stored = window.localStorage.getItem(PROVIDER_KEY);
  if (stored === "Google" && isGoogleMapsConfigured()) return "Google";
  if (stored === "Open Map") return "Open Map";
  return isGoogleMapsConfigured() ? "Google" : "Open Map";
}

export function setPreferredMappingProvider(provider: MappingProvider): void {
  const safeProvider =
    provider === "Google" && !isGoogleMapsConfigured()
      ? "Open Map"
      : provider;
  window.localStorage.setItem(PROVIDER_KEY, safeProvider);
  window.dispatchEvent(
    new CustomEvent<MappingProvider>(PROVIDER_EVENT, {
      detail: safeProvider,
    }),
  );
}

export function subscribeToMappingProvider(
  listener: (provider: MappingProvider) => void,
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<MappingProvider>;
    listener(customEvent.detail ?? getPreferredMappingProvider());
  };
  window.addEventListener(PROVIDER_EVENT, handler);
  return () => window.removeEventListener(PROVIDER_EVENT, handler);
}

export function getPreferredGoogleMapType(): GoogleMapDisplayType {
  const stored = window.localStorage.getItem(GOOGLE_MAP_TYPE_KEY);
  if (
    stored === "Road" ||
    stored === "Satellite" ||
    stored === "Hybrid" ||
    stored === "Terrain"
  ) {
    return stored;
  }
  return "Hybrid";
}

export function setPreferredGoogleMapType(type: GoogleMapDisplayType): void {
  window.localStorage.setItem(GOOGLE_MAP_TYPE_KEY, type);
}
