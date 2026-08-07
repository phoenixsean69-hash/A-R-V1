import type { ForensicAreaSnapshot, ForensicTerrainGrid } from "../types/forensicScenePipeline";

interface ElevationResponse {
  elevation?: number[];
  error?: boolean;
  reason?: string;
}

export interface ElevationAcquisition {
  terrain: ForensicTerrainGrid;
  rawResponses: ElevationResponse[];
}

const ENDPOINT = "https://api.open-meteo.com/v1/elevation";

async function fetchBatch(latitudes: number[], longitudes: number[]): Promise<ElevationResponse> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", latitudes.map((v) => v.toFixed(7)).join(","));
  url.searchParams.set("longitude", longitudes.map((v) => v.toFixed(7)).join(","));
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = (await response.json()) as ElevationResponse;
  if (!response.ok || payload.error) throw new Error(payload.reason || `Elevation provider returned HTTP ${response.status}.`);
  return payload;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export const ForensicElevationService = {
  async acquire(area: ForensicAreaSnapshot, rows = 11, columns = 11): Promise<ElevationAcquisition> {
    const bounds = area.coreArea.bounds;
    const safeRows = Math.max(3, Math.min(17, Math.round(rows)));
    const safeColumns = Math.max(3, Math.min(17, Math.round(columns)));
    const latitudes: number[] = [];
    const longitudes: number[] = [];

    for (let row = 0; row < safeRows; row += 1) {
      const lat = bounds.south + (bounds.north - bounds.south) * (row / (safeRows - 1));
      for (let column = 0; column < safeColumns; column += 1) {
        const lon = bounds.west + (bounds.east - bounds.west) * (column / (safeColumns - 1));
        latitudes.push(lat);
        longitudes.push(lon);
      }
    }

    const rawResponses: ElevationResponse[] = [];
    const elevations: number[] = [];
    for (let offset = 0; offset < latitudes.length; offset += 100) {
      const payload = await fetchBatch(latitudes.slice(offset, offset + 100), longitudes.slice(offset, offset + 100));
      rawResponses.push(payload);
      elevations.push(...(payload.elevation ?? []));
    }

    if (elevations.length !== latitudes.length || elevations.some((value) => !Number.isFinite(value))) {
      throw new Error("Elevation provider returned an incomplete terrain grid.");
    }

    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    const anchorX = Math.round(((area.accidentAnchor.longitude - bounds.west) / Math.max(1e-12, bounds.east - bounds.west)) * (safeColumns - 1));
    const anchorY = Math.round(((area.accidentAnchor.latitude - bounds.south) / Math.max(1e-12, bounds.north - bounds.south)) * (safeRows - 1));
    const anchorIndex = Math.max(0, Math.min(elevations.length - 1, anchorY * safeColumns + anchorX));

    return {
      rawResponses,
      terrain: {
        schemaVersion: "RoadSafe Terrain Grid V1",
        status: "ready",
        bounds: { ...bounds },
        rows: safeRows,
        columns: safeColumns,
        elevationsMetres: elevations.map((value) => Number(value.toFixed(3))),
        minimumElevationMetres: Number(min.toFixed(3)),
        maximumElevationMetres: Number(max.toFixed(3)),
        meanElevationMetres: Number(mean(elevations).toFixed(3)),
        originElevationMetres: Number(elevations[anchorIndex].toFixed(3)),
        reliefMetres: Number((max - min).toFixed(3)),
        nominalResolutionMetres: 90,
        provider: "Open-Meteo Elevation API / Copernicus DEM",
        classification: "Source-reported",
        confidence: 0.72,
        capturedAt: new Date().toISOString(),
        attribution: "Elevation via Open-Meteo; Copernicus DEM.",
        notes: [
          "Macro terrain only: nominal DEM resolution is approximately 90 m.",
          "Potholes, kerbs, humps, local crown/camber, drains and small surface defects require field measurement or investigator correction.",
        ],
      },
    };
  },

  flatFallback(area: ForensicAreaSnapshot, reason: string): ForensicTerrainGrid {
    return {
      schemaVersion: "RoadSafe Terrain Grid V1",
      status: "fallback-flat",
      bounds: { ...area.coreArea.bounds },
      rows: 3,
      columns: 3,
      elevationsMetres: Array(9).fill(0) as number[],
      minimumElevationMetres: 0,
      maximumElevationMetres: 0,
      meanElevationMetres: 0,
      originElevationMetres: 0,
      reliefMetres: 0,
      nominalResolutionMetres: 0,
      provider: "Flat low-confidence fallback",
      classification: "Unknown",
      confidence: 0.1,
      capturedAt: new Date().toISOString(),
      attribution: "No elevation source available.",
      notes: [`Elevation acquisition failed: ${reason}`, "Flat terrain is an explicit low-confidence fallback."],
    };
  },
};
