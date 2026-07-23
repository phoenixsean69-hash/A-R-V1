import type { GoogleMapDisplayType } from "../types/mapping";

const GOOGLE_MAP_TYPE_KEY = "roadsafe.mapping.google-map-type.v2";

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
