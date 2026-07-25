import type { RoadDetectionCoordinate } from "../types/roadLayoutDetection";

const NOMINATIM_SEARCH_URL =
  import.meta.env.VITE_NOMINATIM_SEARCH_URL ??
  "https://nominatim.openstreetmap.org/search";

const SEARCH_CACHE_KEY = "roadsafe-zimbabwe-location-search-v1";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

export interface ZimbabweLocationSearchResult {
  id: string;
  displayName: string;
  type: string;
  coordinate: RoadDetectionCoordinate;
  boundingBox?: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
}

interface NominatimSearchItem {
  place_id?: number;
  display_name?: string;
  type?: string;
  class?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
}

interface CachedSearch {
  storedAt: number;
  results: ZimbabweLocationSearchResult[];
}

function readCache(query: string): ZimbabweLocationSearchResult[] | null {
  try {
    const stored = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!stored) return null;

    const cache = JSON.parse(stored) as Record<string, CachedSearch>;
    const item = cache[query];

    if (!item || Date.now() - item.storedAt > CACHE_MAX_AGE_MS) {
      return null;
    }

    return item.results;
  } catch {
    return null;
  }
}

function writeCache(
  query: string,
  results: ZimbabweLocationSearchResult[],
): void {
  try {
    const stored = sessionStorage.getItem(SEARCH_CACHE_KEY);
    const cache = stored
      ? (JSON.parse(stored) as Record<string, CachedSearch>)
      : {};

    cache[query] = {
      storedAt: Date.now(),
      results,
    };

    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A search cache failure must never block map use.
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  timeoutMilliseconds: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    timeoutMilliseconds,
  );

  try {
    return await fetch(input, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export const LocationSearchService = {
  async search(
    rawQuery: string,
  ): Promise<ZimbabweLocationSearchResult[]> {
    const query = rawQuery.trim();
    if (query.length < 2) return [];

    const cacheKey = query.toLowerCase();
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const url = new URL(NOMINATIM_SEARCH_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", `${query}, Zimbabwe`);
    url.searchParams.set("countrycodes", "zw");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "7");
    url.searchParams.set("viewbox", "25.2,-15.5,33.2,-22.5");
    url.searchParams.set("bounded", "1");

    const contactEmail = import.meta.env.VITE_NOMINATIM_EMAIL;
    if (contactEmail) {
      url.searchParams.set("email", contactEmail);
    }

    const response = await fetchWithTimeout(url, 8_000);

    if (!response.ok) {
      throw new Error(
        `Location search returned HTTP ${response.status}.`,
      );
    }

    const data = (await response.json()) as NominatimSearchItem[];

    const results = data.flatMap((item, index) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return [];
      }

      const box = item.boundingbox?.map(Number);
      const boundingBox =
        box?.length === 4 && box.every(Number.isFinite)
          ? {
              south: box[0],
              north: box[1],
              west: box[2],
              east: box[3],
            }
          : undefined;

      return [
        {
          id: String(item.place_id ?? `${latitude}:${longitude}:${index}`),
          displayName:
            item.display_name?.trim() ||
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          type: item.type ?? item.class ?? "location",
          coordinate: {
            latitude,
            longitude,
            accuracyMetres: 12,
            capturedAt: new Date().toISOString(),
          },
          boundingBox,
        } satisfies ZimbabweLocationSearchResult,
      ];
    });

    writeCache(cacheKey, results);
    return results;
  },
};
