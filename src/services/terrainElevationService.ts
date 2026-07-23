import * as THREE from "three";

import type { GeoCoordinate } from "../types/fieldPlacement";
import type { AccidentReconstruction } from "../types/reconstruction";

const TERRARIUM_TILE_SIZE = 256;
const EARTH_RADIUS_METRES = 6_378_137;
const TERRAIN_CACHE_NAME = "roadsafe-terrain-tiles-v1";
const TERRAIN_TILE_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

interface TerrainTilePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface TerrainSampleLocation {
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
}

export interface TerrainElevationGrid {
  latitude: number;
  longitude: number;
  areaMetres: number;
  resolution: number;
  zoom: number;
  elevations: Float32Array;
  centreElevationMetres: number;
  minimumElevationMetres: number;
  maximumElevationMetres: number;
  source: "Mapzen Terrarium / AWS Terrain Tiles";
}

export interface TerrainSurface {
  grid: TerrainElevationGrid;
  exaggeration: number;
  rotationDegrees: number;
  heightAt: (x: number, z: number) => number;
}

const tilePromiseCache = new Map<string, Promise<TerrainTilePixels>>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function wrapTileX(tileX: number, zoom: number): number {
  const count = 2 ** zoom;
  return ((tileX % count) + count) % count;
}

function tileUrl(zoom: number, tileX: number, tileY: number): string {
  return TERRAIN_TILE_URL
    .replace("{z}", String(zoom))
    .replace("{x}", String(wrapTileX(tileX, zoom)))
    .replace("{y}", String(tileY));
}

function chooseTerrainZoom(
  latitude: number,
  areaMetres: number,
  resolution: number,
): number {
  const targetMetresPerPixel = Math.max(1, areaMetres / Math.max(1, resolution - 1));
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const numerator = Math.cos(latitudeRadians) * 2 * Math.PI * EARTH_RADIUS_METRES;
  const zoom = Math.log2(numerator / (TERRARIUM_TILE_SIZE * targetMetresPerPixel));
  return clamp(Math.round(zoom), 10, 15);
}

function coordinateToGlobalPixel(
  latitude: number,
  longitude: number,
  zoom: number,
): { x: number; y: number } {
  const latitudeRadians = THREE.MathUtils.degToRad(clamp(latitude, -85.05112878, 85.05112878));
  const scale = 2 ** zoom * TERRARIUM_TILE_SIZE;
  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) /
      2 *
      scale,
  };
}

function localOffsetToCoordinate(
  origin: GeoCoordinate,
  eastMetres: number,
  northMetres: number,
): { latitude: number; longitude: number } {
  const latitudeRadians = THREE.MathUtils.degToRad(origin.latitude);
  return {
    latitude: origin.latitude + northMetres / 111_320,
    longitude:
      origin.longitude +
      eastMetres / Math.max(1, 111_320 * Math.cos(latitudeRadians)),
  };
}

function terrainSampleLocation(
  latitude: number,
  longitude: number,
  zoom: number,
): TerrainSampleLocation {
  const pixel = coordinateToGlobalPixel(latitude, longitude, zoom);
  const tileX = Math.floor(pixel.x / TERRARIUM_TILE_SIZE);
  const tileY = Math.floor(pixel.y / TERRARIUM_TILE_SIZE);
  return {
    tileX,
    tileY,
    pixelX: pixel.x - tileX * TERRARIUM_TILE_SIZE,
    pixelY: pixel.y - tileY * TERRARIUM_TILE_SIZE,
  };
}

async function responseForTile(url: string, signal?: AbortSignal): Promise<Response> {
  const request = new Request(url, { mode: "cors" });
  if (typeof caches !== "undefined") {
    const cache = await caches.open(TERRAIN_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request, { signal });
    if (!response.ok) {
      throw new Error(`Terrain tile request failed (${response.status}).`);
    }
    try {
      await cache.put(request, response.clone());
    } catch (error) {
      console.warn("Terrain tile could not be cached:", error);
    }
    return response;
  }

  const response = await fetch(request, { signal });
  if (!response.ok) {
    throw new Error(`Terrain tile request failed (${response.status}).`);
  }
  return response;
}

async function decodeTile(response: Response): Promise<TerrainTilePixels> {
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Terrain tile canvas could not be created.");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: imageData.data,
  };
}

async function loadTile(
  zoom: number,
  tileX: number,
  tileY: number,
  signal?: AbortSignal,
): Promise<TerrainTilePixels> {
  const url = tileUrl(zoom, tileX, tileY);
  const existing = tilePromiseCache.get(url);
  if (existing) return existing;

  const promise = responseForTile(url, signal).then(decodeTile);
  tilePromiseCache.set(url, promise);
  try {
    return await promise;
  } catch (error) {
    tilePromiseCache.delete(url);
    throw error;
  }
}

function decodeTerrariumElevation(
  tile: TerrainTilePixels,
  pixelX: number,
  pixelY: number,
): number {
  const x = clamp(Math.round(pixelX), 0, tile.width - 1);
  const y = clamp(Math.round(pixelY), 0, tile.height - 1);
  const offset = (y * tile.width + x) * 4;
  const red = tile.data[offset];
  const green = tile.data[offset + 1];
  const blue = tile.data[offset + 2];
  return red * 256 + green + blue / 256 - 32_768;
}

function smoothGrid(
  source: Float32Array,
  resolution: number,
  passes = 2,
): Float32Array {
  let current = source;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(current.length);
    for (let row = 0; row < resolution; row += 1) {
      for (let column = 0; column < resolution; column += 1) {
        let total = 0;
        let weight = 0;
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
            const sampleRow = clamp(row + rowOffset, 0, resolution - 1);
            const sampleColumn = clamp(column + columnOffset, 0, resolution - 1);
            const sampleWeight = rowOffset === 0 && columnOffset === 0 ? 4 : 1;
            total += current[sampleRow * resolution + sampleColumn] * sampleWeight;
            weight += sampleWeight;
          }
        }
        next[row * resolution + column] = total / weight;
      }
    }
    current = next;
  }
  return current;
}

function rotateSceneOffset(
  x: number,
  z: number,
  rotationDegrees: number,
): { east: number; north: number } {
  const radians = THREE.MathUtils.degToRad(rotationDegrees);
  const east = x * Math.cos(radians) + z * Math.sin(radians);
  const north = x * Math.sin(radians) - z * Math.cos(radians);
  return { east, north };
}

export function getTerrainOrigin(
  reconstruction: AccidentReconstruction,
): GeoCoordinate | null {
  if (reconstruction.fieldCalibration?.origin) {
    return reconstruction.fieldCalibration.origin;
  }

  if (reconstruction.roadLayoutDetection?.coordinate) {
    const coordinate = reconstruction.roadLayoutDetection.coordinate;
    return {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      accuracyMetres: coordinate.accuracyMetres,
      capturedAt: coordinate.capturedAt,
    };
  }

  const placementCoordinate = reconstruction.fieldPlacements[0]?.coordinate;
  if (placementCoordinate) return placementCoordinate;

  const photoCoordinate = reconstruction.photos.find(
    (photo) => photo.geoCoordinate,
  )?.geoCoordinate;
  return photoCoordinate ?? null;
}

export async function loadTerrainElevationGrid(
  origin: GeoCoordinate,
  areaMetres: number,
  resolution = 65,
  signal?: AbortSignal,
): Promise<TerrainElevationGrid> {
  const safeArea = clamp(areaMetres, 100, 3_000);
  const safeResolution = Math.max(17, Math.min(129, Math.round(resolution) | 1));
  const zoom = chooseTerrainZoom(origin.latitude, safeArea, safeResolution);
  const samples: TerrainSampleLocation[] = [];
  const tileKeys = new Map<string, { tileX: number; tileY: number }>();

  for (let row = 0; row < safeResolution; row += 1) {
    const z = (row / (safeResolution - 1) - 0.5) * safeArea;
    for (let column = 0; column < safeResolution; column += 1) {
      const x = (column / (safeResolution - 1) - 0.5) * safeArea;
      const coordinate = localOffsetToCoordinate(origin, x, -z);
      const sample = terrainSampleLocation(
        coordinate.latitude,
        coordinate.longitude,
        zoom,
      );
      samples.push(sample);
      tileKeys.set(`${sample.tileX}:${sample.tileY}`, {
        tileX: sample.tileX,
        tileY: sample.tileY,
      });
    }
  }

  const loadedTiles = new Map<string, TerrainTilePixels>();
  await Promise.all(
    [...tileKeys.entries()].map(async ([key, tile]) => {
      loadedTiles.set(
        key,
        await loadTile(zoom, tile.tileX, tile.tileY, signal),
      );
    }),
  );

  const elevations = new Float32Array(samples.length);
  samples.forEach((sample, index) => {
    const tile = loadedTiles.get(`${sample.tileX}:${sample.tileY}`);
    if (!tile) throw new Error("Terrain tile was not available after loading.");
    elevations[index] = decodeTerrariumElevation(
      tile,
      sample.pixelX,
      sample.pixelY,
    );
  });

  const smoothed = smoothGrid(elevations, safeResolution, 2);
  const centreIndex =
    Math.floor(safeResolution / 2) * safeResolution +
    Math.floor(safeResolution / 2);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  smoothed.forEach((value) => {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  });

  return {
    latitude: origin.latitude,
    longitude: origin.longitude,
    areaMetres: safeArea,
    resolution: safeResolution,
    zoom,
    elevations: smoothed,
    centreElevationMetres: smoothed[centreIndex],
    minimumElevationMetres: minimum,
    maximumElevationMetres: maximum,
    source: "Mapzen Terrarium / AWS Terrain Tiles",
  };
}

function gridElevationAt(
  grid: TerrainElevationGrid,
  eastMetres: number,
  northMetres: number,
): number {
  const normalisedX = clamp(eastMetres / grid.areaMetres + 0.5, 0, 1);
  const normalisedY = clamp(0.5 - northMetres / grid.areaMetres, 0, 1);
  const gridX = normalisedX * (grid.resolution - 1);
  const gridY = normalisedY * (grid.resolution - 1);
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = Math.min(grid.resolution - 1, x0 + 1);
  const y1 = Math.min(grid.resolution - 1, y0 + 1);
  const tx = gridX - x0;
  const ty = gridY - y0;
  const topLeft = grid.elevations[y0 * grid.resolution + x0];
  const topRight = grid.elevations[y0 * grid.resolution + x1];
  const bottomLeft = grid.elevations[y1 * grid.resolution + x0];
  const bottomRight = grid.elevations[y1 * grid.resolution + x1];
  const top = THREE.MathUtils.lerp(topLeft, topRight, tx);
  const bottom = THREE.MathUtils.lerp(bottomLeft, bottomRight, tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

export function createTerrainSurface(
  grid: TerrainElevationGrid,
  exaggeration: number,
  rotationDegrees: number,
): TerrainSurface {
  const safeExaggeration = clamp(exaggeration, 0.25, 3);
  const heightAt = (x: number, z: number) => {
    const offset = rotateSceneOffset(x, z, rotationDegrees);
    const elevation = gridElevationAt(grid, offset.east, offset.north);
    return clamp(
      (elevation - grid.centreElevationMetres) * safeExaggeration,
      -120,
      120,
    );
  };
  return {
    grid,
    exaggeration: safeExaggeration,
    rotationDegrees,
    heightAt,
  };
}

export function createTerrainGeometry(surface: TerrainSurface): THREE.PlaneGeometry {
  const { areaMetres, resolution } = surface.grid;
  const geometry = new THREE.PlaneGeometry(
    areaMetres,
    areaMetres,
    resolution - 1,
    resolution - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    position.setY(index, surface.heightAt(x, z));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
