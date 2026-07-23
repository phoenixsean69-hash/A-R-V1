import type { GoogleMapDisplayType } from "../types/mapping";

const GOOGLE_MAP_TYPE_KEY = "roadsafe.mapping.google-map-type.v2";

function environmentValue(name: "key" | "mapId"): string {
  const value =
    name === "key"
      ? import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
      : import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
  return String(value ?? "").trim();
}

function isPlaceholder(value: string): boolean {
  const normalised = value.toLowerCase();
  return (
    !value ||
    normalised.includes("your_real") ||
    normalised.includes("your_actual") ||
    normalised.includes("your_browser") ||
    normalised.includes("exampleonly") ||
    normalised === "8f4c123456789abc"
  );
}

export function isGoogleMapsConfigured(): boolean {
  return !isPlaceholder(environmentValue("key"));
}

export function getGoogleMapsBrowserKey(): string {
  const value = environmentValue("key");
  return isPlaceholder(value) ? "" : value;
}

export function getGoogleMapsMapId(): string | undefined {
  const value = environmentValue("mapId");
  return isPlaceholder(value) ? undefined : value;
}

export function getGoogleMapsRuntimeMapId(): string {
  return getGoogleMapsMapId() ?? "DEMO_MAP_ID";
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
