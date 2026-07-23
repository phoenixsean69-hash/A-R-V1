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

declare global {
  interface Window {
    google?: GoogleGlobal;
    __roadsafeGoogleMapsLoader?: Promise<GoogleMapsNamespace>;
    __roadsafeGoogleMapsReady?: () => void;
  }
}

function createLoaderPromise(apiKey: string): Promise<GoogleMapsNamespace> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve(window.google.maps);
      return;
    }

    const callbackName = "__roadsafeGoogleMapsReady";
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback: callbackName,
    });

    window[callbackName] = () => {
      delete window[callbackName];
      if (!window.google?.maps) {
        reject(new Error("Google Maps loaded without the maps namespace."));
        return;
      }
      resolve(window.google.maps);
    };

    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error("Google Maps JavaScript API could not be loaded."));
    };
    document.head.append(script);
  });
}

export async function loadGoogleMaps(): Promise<GoogleMapsNamespace> {
  const apiKey = getGoogleMapsBrowserKey();
  if (!apiKey) {
    throw new Error(
      "Google Maps is not configured. Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env.local.",
    );
  }

  if (!window.__roadsafeGoogleMapsLoader) {
    window.__roadsafeGoogleMapsLoader = createLoaderPromise(apiKey);
  }

  const maps = await window.__roadsafeGoogleMapsLoader;
  await Promise.all([
    maps.importLibrary("maps"),
    maps.importLibrary("marker"),
    maps.importLibrary("places"),
    maps.importLibrary("streetView"),
    maps.importLibrary("geocoding"),
  ]);
  return maps;
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
