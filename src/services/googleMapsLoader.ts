import { getGoogleMapsBrowserKey } from "./mapPreferencesService";

export interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

export interface GooglePoint {
  x: number;
  y: number;
}

export interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

export interface GoogleMapsListener {
  remove(): void;
}

export interface GoogleLatLngBounds {
  extend(position: GoogleLatLngLiteral | GoogleLatLng): GoogleLatLngBounds;
  getNorthEast(): GoogleLatLng;
  getSouthWest(): GoogleLatLng;
  isEmpty(): boolean;
}

export interface GoogleMapsMap {
  fitBounds(bounds: GoogleLatLngBounds | unknown, padding?: number | Record<string, number>): void;
  getBounds(): GoogleLatLngBounds | null | undefined;
  getCenter(): GoogleLatLng | null;
  getDiv(): HTMLElement;
  getHeading(): number | undefined;
  getMapTypeId(): string | undefined;
  getStreetView(): GoogleStreetViewPanorama;
  getZoom(): number | undefined;
  panTo(position: GoogleLatLngLiteral): void;
  setCenter(position: GoogleLatLngLiteral): void;
  setHeading(heading: number): void;
  setMapTypeId(mapTypeId: string): void;
  setOptions(options: Record<string, unknown>): void;
  setZoom(zoom: number): void;
  addListener(eventName: string, handler: (...args: unknown[]) => void): GoogleMapsListener;
}

export interface GoogleDataFeature {
  getProperty(name: string): unknown;
}

export interface GoogleDataLayer {
  addGeoJson(geoJson: GeoJSON.GeoJSON): GoogleDataFeature[];
  forEach(callback: (feature: GoogleDataFeature) => void): void;
  remove(feature: GoogleDataFeature): void;
  setMap(map: GoogleMapsMap | null): void;
  setStyle(
    style:
      | Record<string, unknown>
      | ((feature: GoogleDataFeature) => Record<string, unknown>),
  ): void;
}

export interface GoogleStreetViewPanorama {
  getPosition(): GoogleLatLng | null;
  setPosition(position: GoogleLatLngLiteral): void;
  setPov(pov: { heading: number; pitch: number }): void;
  setVisible(visible: boolean): void;
}

export interface GoogleStreetViewService {
  getPanorama(
    request: Record<string, unknown>,
    callback: (data: GoogleStreetViewPanoramaData | null, status: string) => void,
  ): void;
}

export interface GoogleStreetViewPanoramaData {
  location?: {
    latLng?: GoogleLatLng;
    description?: string;
  };
}

export interface GoogleMaxZoomService {
  getMaxZoomAtLatLng(
    position: GoogleLatLngLiteral,
    callback: (result: { zoom?: number } | null, status: string) => void,
  ): void;
}

export interface GoogleRectangle {
  getBounds(): GoogleLatLngBounds | null;
  setBounds(bounds: Record<string, number> | GoogleLatLngBounds): void;
  setMap(map: GoogleMapsMap | null): void;
  setOptions(options: Record<string, unknown>): void;
  addListener(eventName: string, handler: (...args: unknown[]) => void): GoogleMapsListener;
}

export interface GoogleInfoWindow {
  close(): void;
  open(options: Record<string, unknown>): void;
  setContent(content: string | Element): void;
  setPosition(position: GoogleLatLngLiteral): void;
}

export interface GoogleMapPanes {
  overlayLayer: HTMLElement;
  overlayMouseTarget: HTMLElement;
}

export interface GoogleMapCanvasProjection {
  fromLatLngToDivPixel(position: GoogleLatLng): GooglePoint | null;
}

export interface GoogleOverlayView {
  draw: () => void;
  onAdd: () => void;
  onRemove: () => void;
  getMap(): GoogleMapsMap | null;
  getPanes(): GoogleMapPanes | null;
  getProjection(): GoogleMapCanvasProjection;
  setMap(map: GoogleMapsMap | null): void;
}

export interface GoogleGeocoderResult {
  formatted_address?: string;
  types?: string[];
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry?: {
    location?: GoogleLatLng;
    viewport?: GoogleLatLngBounds;
  };
}

export interface GoogleGeocoder {
  geocode(
    request: Record<string, unknown>,
  ): Promise<{ results: GoogleGeocoderResult[] }>;
}

export interface GoogleMapsNamespace {
  Data: new (options?: Record<string, unknown>) => GoogleDataLayer;
  Geocoder: new () => GoogleGeocoder;
  InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindow;
  LatLng: new (lat: number, lng: number) => GoogleLatLng;
  LatLngBounds: new () => GoogleLatLngBounds;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapsMap;
  MaxZoomService: new () => GoogleMaxZoomService;
  OverlayView: new () => GoogleOverlayView;
  Rectangle: new (options?: Record<string, unknown>) => GoogleRectangle;
  StreetViewPanorama: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => GoogleStreetViewPanorama;
  StreetViewService: new () => GoogleStreetViewService;
  SymbolPath: { CIRCLE: unknown };
  event: {
    clearInstanceListeners(instance: object): void;
  };
  importLibrary(name: string): Promise<Record<string, unknown>>;
}

interface GoogleGlobal {
  maps: GoogleMapsNamespace;
}

interface GoogleMapsBootstrapNamespace {
  importLibrary?: (name: string, ...args: unknown[]) => Promise<Record<string, unknown>>;
  __ib__?: () => void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    google?: GoogleGlobal;
    gm_authFailure?: () => void;
    __roadsafeGoogleMapsLoader?: Promise<GoogleMapsNamespace>;
  }
}

const AUTH_FAILURE_EVENT = "roadsafe:google-maps-auth-failure";
const SCRIPT_SELECTOR = 'script[data-roadsafe-google-maps="true"]';

export const GOOGLE_MAPS_AUTHENTICATION_MESSAGE =
  "Google Maps rejected the browser key. Confirm billing is active, Maps JavaScript API is enabled, and the current website origin is allowed by the key restrictions.";

function normaliseGoogleMapsError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (
    lower.includes("authentication") ||
    lower.includes("api key") ||
    lower.includes("billing") ||
    lower.includes("referer") ||
    lower.includes("reading 'keys'") ||
    lower.includes('reading "keys"')
  ) {
    return new Error(GOOGLE_MAPS_AUTHENTICATION_MESSAGE);
  }

  return error instanceof Error
    ? error
    : new Error("Google Maps JavaScript API could not be loaded.");
}

function installGoogleMapsDynamicLoader(apiKey: string): GoogleMapsNamespace {
  const googleGlobal = (window.google ??= {} as GoogleGlobal);
  const bootstrapMaps = (googleGlobal.maps ??= {} as GoogleMapsNamespace) as unknown as GoogleMapsBootstrapNamespace;

  if (typeof bootstrapMaps.importLibrary === "function") {
    return bootstrapMaps as unknown as GoogleMapsNamespace;
  }

  let scriptPromise: Promise<void> | null = null;
  const requestedLibraries = new Set<string>();

  const importLibrary = (
    libraryName: string,
    ...args: unknown[]
  ): Promise<Record<string, unknown>> => {
    requestedLibraries.add(libraryName);

    if (!scriptPromise) {
      scriptPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
        existingScript?.remove();

        const script = document.createElement("script");
        const params = new URLSearchParams({
          key: apiKey,
          v: "weekly",
          loading: "async",
          callback: "google.maps.__ib__",
        });
        params.set("libraries", [...requestedLibraries].join(","));

        bootstrapMaps.__ib__ = () => resolve();
        window.gm_authFailure = () => {
          const authError = new Error(GOOGLE_MAPS_AUTHENTICATION_MESSAGE);
          window.dispatchEvent(
            new CustomEvent(AUTH_FAILURE_EVENT, { detail: authError.message }),
          );
          reject(authError);
        };

        script.async = true;
        script.defer = true;
        script.dataset.roadsafeGoogleMaps = "true";
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.onerror = () =>
          reject(new Error("Google Maps JavaScript API could not be downloaded."));
        script.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
        document.head.append(script);
      });
    }

    return scriptPromise
      .then(() => {
        const realImportLibrary = (
          window.google?.maps as unknown as GoogleMapsBootstrapNamespace | undefined
        )?.importLibrary;
        if (
          typeof realImportLibrary !== "function" ||
          realImportLibrary === importLibrary
        ) {
          throw new Error("Google Maps loaded without the dynamic library importer.");
        }
        return realImportLibrary(libraryName, ...args);
      })
      .catch((error: unknown) => {
        throw normaliseGoogleMapsError(error);
      });
  };

  bootstrapMaps.importLibrary = importLibrary;
  return bootstrapMaps as unknown as GoogleMapsNamespace;
}

export function subscribeGoogleMapsAuthenticationFailure(
  handler: (message: string) => void,
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    handler(customEvent.detail || GOOGLE_MAPS_AUTHENTICATION_MESSAGE);
  };
  window.addEventListener(AUTH_FAILURE_EVENT, listener);
  return () => window.removeEventListener(AUTH_FAILURE_EVENT, listener);
}

export async function loadGoogleMaps(): Promise<GoogleMapsNamespace> {
  const apiKey = getGoogleMapsBrowserKey();
  if (!apiKey) {
    throw new Error(
      "Google Maps is not configured. Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env.local.",
    );
  }

  if (!window.__roadsafeGoogleMapsLoader) {
    const maps = installGoogleMapsDynamicLoader(apiKey);
    window.__roadsafeGoogleMapsLoader = maps
      .importLibrary("maps")
      .then(() => {
        const loadedMaps = window.google?.maps;
        if (!loadedMaps?.Map) {
          throw new Error("Google Maps loaded without the Map constructor.");
        }
        return loadedMaps;
      })
      .catch((error: unknown) => {
        window.__roadsafeGoogleMapsLoader = undefined;
        throw normaliseGoogleMapsError(error);
      });
  }

  return window.__roadsafeGoogleMapsLoader;
}

export function latLngLiteral(
  coordinate: Pick<{ latitude: number; longitude: number }, "latitude" | "longitude">,
): GoogleLatLngLiteral {
  return { lat: coordinate.latitude, lng: coordinate.longitude };
}

export function mapCenterLiteral(map: GoogleMapsMap): GoogleLatLngLiteral | null {
  const center = map.getCenter();
  return center ? { lat: center.lat(), lng: center.lng() } : null;
}

export function googleBoundsToLiteral(bounds: GoogleLatLngBounds): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  return {
    north: northEast.lat(),
    east: northEast.lng(),
    south: southWest.lat(),
    west: southWest.lng(),
  };
}
