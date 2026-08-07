import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  Crosshair,
  Loader2,
  MapPin,
  Search,
  X,
} from "../icons/materialIcons";
import maplibregl from "maplibre-gl";
import type {
  StyleSpecification,
} from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
} from "geojson";

import {
  LocationSearchService,
  type ZimbabweLocationSearchResult,
} from "../../services/locationSearchService";
import { SceneSnapshotService } from "../../services/sceneSnapshotService";
import type {
  RealSceneAreaSelection,
  RealSceneGeometry,
  RealSceneMapMode,
  RealSceneSnapshotReference,
} from "../../types/realSceneGeometry";
import type {
  DetectedRoadFeature,
  DetectedRoadSegment,
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";

export interface RoadLocationMapHandle {
  captureSelectedAreaSnapshot(): Promise<RealSceneSnapshotReference | null>;
  focusCoordinate(
    coordinate: RoadDetectionCoordinate,
    zoom?: number,
  ): void;
}

interface RoadLocationMapProps {
  coordinate: RoadDetectionCoordinate | null;
  currentCoordinate?: RoadDetectionCoordinate | null;
  roads?: DetectedRoadSegment[];
  features?: DetectedRoadFeature[];
  editable?: boolean;
  onCoordinateChange?: (
    coordinate: RoadDetectionCoordinate,
  ) => void;
  areaSelection?: RealSceneAreaSelection | null;
  onAreaSelectionChange?: (
    selection: RealSceneAreaSelection | null,
  ) => void;
  realSceneGeometry?: RealSceneGeometry | null;
  onMapModeChange?: (
    mapMode: RealSceneMapMode,
  ) => void;
  onSearchedLocationChange?: (
    displayName: string,
  ) => void;
}

const STREET_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

const SOURCE_IDS = {
  accuracy: "roadsafe-location-accuracy",
  selection: "roadsafe-scene-area",
  detectedRoads: "roadsafe-detected-roads",
  detectedFeatures: "roadsafe-detected-features",
  realRoads: "roadsafe-real-scene-roads",
  realPaths: "roadsafe-real-scene-paths",
  buildings: "roadsafe-real-scene-buildings",
  barriers: "roadsafe-real-scene-barriers",
  landCover: "roadsafe-real-scene-land-cover",
  vegetation: "roadsafe-real-scene-vegetation",
} as const;

const LAYER_IDS = {
  accuracyFill: "roadsafe-location-accuracy-fill",
  accuracyLine: "roadsafe-location-accuracy-line",
  selectionFill: "roadsafe-scene-area-fill",
  selectionLine: "roadsafe-scene-area-line",
  detectedRoadCasing: "roadsafe-detected-roads-casing",
  detectedRoad: "roadsafe-detected-roads-line",
  detectedFeature: "roadsafe-detected-features-circle",
  realRoadCasing: "roadsafe-real-scene-road-casing",
  realRoad: "roadsafe-real-scene-road",
  realPath: "roadsafe-real-scene-path",
  building: "roadsafe-real-scene-building",
  barrier: "roadsafe-real-scene-barrier",
  landCover: "roadsafe-real-scene-land-cover-fill",
  vegetation: "roadsafe-real-scene-vegetation-circle",
} as const;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createRasterStyle(
  id: string,
  tiles: string[],
  attribution: string,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: {
        type: "raster",
        tiles,
        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,
        attribution,
      },
    },
    layers: [
      {
        id: `${id}-layer`,
        type: "raster",
        source: id,
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
    ],
  };
}

function createHybridStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,
        attribution: "Imagery © Esri",
      },
      labels: {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,
        attribution:
          "Places and boundaries © Esri",
      },
    },
    layers: [
      {
        id: "imagery-layer",
        type: "raster",
        source: "imagery",
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
      {
        id: "labels-layer",
        type: "raster",
        source: "labels",
        paint: {
          "raster-opacity": 0.92,
          "raster-fade-duration": 0,
        },
      },
    ],
  };
}

function getMapStyle(
  mapMode: RealSceneMapMode,
): string | StyleSpecification {
  if (mapMode === "hybrid") {
    return createHybridStyle();
  }

  if (mapMode === "terrain") {
    return createRasterStyle(
      "topographic",
      [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      "Topographic map © Esri",
    );
  }

  return STREET_STYLE;
}

function emptyCollection<
  Geometry extends
    | LineString
    | Point
    | Polygon,
>(): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function accuracyCircle(
  coordinate: RoadDetectionCoordinate,
): Feature<Polygon> {
  const points: Array<
    [number, number]
  > = [];
  const count = 72;
  const latitudeRadians =
    (coordinate.latitude *
      Math.PI) /
    180;
  const latitudeScale =
    1 / 110_540;
  const longitudeScale =
    1 /
    (111_320 *
      Math.max(
        Math.cos(latitudeRadians),
        0.000001,
      ));

  for (
    let index = 0;
    index <= count;
    index += 1
  ) {
    const angle =
      (index / count) *
      Math.PI *
      2;
    const north =
      Math.cos(angle) *
      coordinate.accuracyMetres;
    const east =
      Math.sin(angle) *
      coordinate.accuracyMetres;

    points.push([
      coordinate.longitude +
        east * longitudeScale,
      coordinate.latitude +
        north * latitudeScale,
    ]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [points],
    },
  };
}

function accuracyGeoJson(
  coordinate: RoadDetectionCoordinate | null,
): FeatureCollection<Polygon> {
  return coordinate
    ? {
        type: "FeatureCollection",
        features: [
          accuracyCircle(coordinate),
        ],
      }
    : emptyCollection<Polygon>();
}

function selectionGeoJson(
  selection: RealSceneAreaSelection | null,
): FeatureCollection<Polygon> {
  if (!selection) {
    return emptyCollection<Polygon>();
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: selection.id,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            selection.polygon.map(
              (point) => [
                point.longitude,
                point.latitude,
              ],
            ),
          ],
        },
      },
    ],
  };
}

function detectedRoadsGeoJson(
  roads: DetectedRoadSegment[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: roads
      .filter(
        (road) =>
          road.points.length >= 2,
      )
      .map((road) => ({
        type: "Feature",
        properties: {
          id: road.id,
          name: road.name,
        },
        geometry: {
          type: "LineString",
          coordinates:
            road.points.map(
              (point) => [
                point.longitude,
                point.latitude,
              ],
            ),
        },
      })),
  };
}

function detectedFeaturesGeoJson(
  features: DetectedRoadFeature[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: features.map(
      (feature) => ({
        type: "Feature",
        properties: {
          id: feature.id,
          type: feature.type,
        },
        geometry: {
          type: "Point",
          coordinates: [
            feature.longitude,
            feature.latitude,
          ],
        },
      }),
    ),
  };
}

function realRoadsGeoJson(
  geometry?: RealSceneGeometry | null,
): FeatureCollection<LineString> {
  if (!geometry) {
    return emptyCollection<LineString>();
  }

  return {
    type: "FeatureCollection",
    features: geometry.roads.map(
      (road) => ({
        type: "Feature",
        properties: {
          id: road.id,
          name: road.name,
          widthMetres:
            road.widthMetres,
        },
        geometry: {
          type: "LineString",
          coordinates:
            road.points.map(
              (point) => [
                point.longitude,
                point.latitude,
              ],
            ),
        },
      }),
    ),
  };
}

function realPathsGeoJson(
  geometry?: RealSceneGeometry | null,
): FeatureCollection<LineString> {
  if (!geometry) {
    return emptyCollection<LineString>();
  }

  return {
    type: "FeatureCollection",
    features: geometry.paths.map(
      (path) => ({
        type: "Feature",
        properties: {
          id: path.id,
        },
        geometry: {
          type: "LineString",
          coordinates:
            path.points.map(
              (point) => [
                point.longitude,
                point.latitude,
              ],
            ),
        },
      }),
    ),
  };
}

function buildingsGeoJson(
  geometry?: RealSceneGeometry | null,
): FeatureCollection<Polygon> {
  if (!geometry) {
    return emptyCollection<Polygon>();
  }

  return {
    type: "FeatureCollection",
    features: geometry.buildings
      .filter(
        (building) =>
          building.points.length >= 4,
      )
      .map((building) => ({
        type: "Feature",
        properties: {
          id: building.id,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            building.points.map(
              (point) => [
                point.longitude,
                point.latitude,
              ],
            ),
          ],
        },
      })),
  };
}

function barriersGeoJson(
  geometry?: RealSceneGeometry | null,
): FeatureCollection<LineString> {
  if (!geometry) {
    return emptyCollection<LineString>();
  }

  return {
    type: "FeatureCollection",
    features: geometry.barriers.map(
      (barrier) => ({
        type: "Feature",
        properties: {
          id: barrier.id,
        },
        geometry: {
          type: "LineString",
          coordinates:
            barrier.points.map(
              (point) => [
                point.longitude,
                point.latitude,
              ],
            ),
        },
      }),
    ),
  };
}

function landCoverGeoJson(
  geometry?: RealSceneGeometry | null,
): FeatureCollection<Polygon> {
  if (!geometry) {
    return emptyCollection<Polygon>();
  }

  return {
    type: "FeatureCollection",
    features:
      geometry.landCover
        ?.filter(
          (cover) =>
            cover.points.length >= 4,
        )
        .map((cover) => ({
          type: "Feature",
          properties: {
            id: cover.id,
            type:
              cover.landCoverType,
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              cover.points.map(
                (point) => [
                  point.longitude,
                  point.latitude,
                ],
              ),
            ],
          },
        })) ?? [],
  };
}

function vegetationGeoJson(
  geometry?: RealSceneGeometry | null,
): FeatureCollection<Point> {
  if (!geometry) {
    return emptyCollection<Point>();
  }

  return {
    type: "FeatureCollection",
    features:
      geometry.vegetation?.map(
        (item) => ({
          type: "Feature",
          properties: {
            id: item.id,
            type:
              item.vegetationType,
          },
          geometry: {
            type: "Point",
            coordinates: [
              item.position.longitude,
              item.position.latitude,
            ],
          },
        }),
      ) ?? [],
  };
}

function createSelection(
  first: maplibregl.LngLat,
  second: maplibregl.LngLat,
  map: maplibregl.Map,
  mapMode: RealSceneMapMode,
  accuracyMetres: number,
): RealSceneAreaSelection {
  const north = Math.max(
    first.lat,
    second.lat,
  );
  const south = Math.min(
    first.lat,
    second.lat,
  );
  const east = Math.max(
    first.lng,
    second.lng,
  );
  const west = Math.min(
    first.lng,
    second.lng,
  );
  const selectedAt =
    new Date().toISOString();

  return {
    id: createId("scene-area"),
    bounds: {
      north,
      south,
      east,
      west,
    },
    polygon: [
      {
        latitude: north,
        longitude: west,
      },
      {
        latitude: north,
        longitude: east,
      },
      {
        latitude: south,
        longitude: east,
      },
      {
        latitude: south,
        longitude: west,
      },
      {
        latitude: north,
        longitude: west,
      },
    ],
    centre: {
      latitude:
        (north + south) / 2,
      longitude:
        (east + west) / 2,
      accuracyMetres,
      capturedAt: selectedAt,
    },
    mapMode,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    selectedAt,
  };
}

function selectionDimensions(
  selection: RealSceneAreaSelection | null,
): string {
  if (!selection) {
    return "No scene area selected";
  }

  const latitude =
    (selection.bounds.north +
      selection.bounds.south) /
    2;
  const width =
    (selection.bounds.east -
      selection.bounds.west) *
    111_320 *
    Math.cos(
      (latitude * Math.PI) /
        180,
    );
  const height =
    (selection.bounds.north -
      selection.bounds.south) *
    110_540;

  return `${Math.max(
    0,
    width,
  ).toFixed(1)} × ${Math.max(
    0,
    height,
  ).toFixed(1)} m`;
}

async function waitForMapReady(
  map: maplibregl.Map,
): Promise<void> {
  if (map.areTilesLoaded()) return;

  await Promise.race([
    new Promise<void>((resolve) =>
      map.once("idle", () => resolve()),
    ),
    new Promise<void>((resolve) =>
      window.setTimeout(
        resolve,
        1_700,
      ),
    ),
  ]);
}

const RoadLocationMap = forwardRef<
  RoadLocationMapHandle,
  RoadLocationMapProps
>(function RoadLocationMap(
  {
    coordinate,
    currentCoordinate,
    roads = [],
    features = [],
    editable = false,
    onCoordinateChange,
    areaSelection = null,
    onAreaSelectionChange,
    realSceneGeometry = null,
    onMapModeChange,
    onSearchedLocationChange,
  },
  forwardedRef,
) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const mapRef =
    useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef =
    useRef<maplibregl.Marker | null>(null);
  const currentMarkerRef =
    useRef<maplibregl.Marker | null>(null);
  const drawingStartRef =
    useRef<maplibregl.LngLat | null>(
      null,
    );

  const coordinateRef =
    useRef(coordinate);
  const roadsRef = useRef(roads);
  const featuresRef =
    useRef(features);
  const selectionRef =
    useRef(areaSelection);
  const geometryRef =
    useRef(realSceneGeometry);
  const onCoordinateChangeRef =
    useRef(onCoordinateChange);
  const onAreaSelectionChangeRef =
    useRef(onAreaSelectionChange);
  const editableRef =
    useRef(editable);
  const drawingModeRef =
    useRef(false);
  const mapModeRef =
    useRef<RealSceneMapMode>(
      "street",
    );
  const styleReadyRef =
    useRef(false);

  const [mapMode, setMapMode] =
    useState<RealSceneMapMode>(
      "street",
    );
  const [styleLoading, setStyleLoading] =
    useState(false);
  const [drawingMode, setDrawingMode] =
    useState(false);
  const [captureMessage, setCaptureMessage] =
    useState("");

  const [searchQuery, setSearchQuery] =
    useState("");
  const [searching, setSearching] =
    useState(false);
  const [searchError, setSearchError] =
    useState("");
  const [searchResults, setSearchResults] =
    useState<
      ZimbabweLocationSearchResult[]
    >([]);
  const [searchOpen, setSearchOpen] =
    useState(false);

  useEffect(() => {
    coordinateRef.current =
      coordinate;
    roadsRef.current = roads;
    featuresRef.current =
      features;
    selectionRef.current =
      areaSelection;
    geometryRef.current =
      realSceneGeometry;
    onCoordinateChangeRef.current =
      onCoordinateChange;
    onAreaSelectionChangeRef.current =
      onAreaSelectionChange;
    editableRef.current =
      editable;
  }, [
    coordinate,
    roads,
    features,
    areaSelection,
    realSceneGeometry,
    onCoordinateChange,
    onAreaSelectionChange,
    editable,
  ]);

  useEffect(() => {
    drawingModeRef.current =
      drawingMode;
    mapModeRef.current =
      mapMode;
  }, [drawingMode, mapMode]);

  const setSourceData = <
    Geometry extends
      | LineString
      | Point
      | Polygon,
  >(
    map: maplibregl.Map,
    id: string,
    data: FeatureCollection<Geometry>,
  ) => {
    const source =
      map.getSource(
        id,
      ) as
        | maplibregl.GeoJSONSource
        | undefined;

    source?.setData(data);
  };

  const installSourcesAndLayers = (
    map: maplibregl.Map,
  ) => {
    const addSource = (
      id: string,
      data: FeatureCollection<
        | LineString
        | Point
        | Polygon
      >,
    ) => {
      if (!map.getSource(id)) {
        map.addSource(id, {
          type: "geojson",
          data,
        });
      }
    };

    addSource(
      SOURCE_IDS.landCover,
      landCoverGeoJson(
        geometryRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.buildings,
      buildingsGeoJson(
        geometryRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.realRoads,
      realRoadsGeoJson(
        geometryRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.realPaths,
      realPathsGeoJson(
        geometryRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.barriers,
      barriersGeoJson(
        geometryRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.vegetation,
      vegetationGeoJson(
        geometryRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.detectedRoads,
      detectedRoadsGeoJson(
        roadsRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.detectedFeatures,
      detectedFeaturesGeoJson(
        featuresRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.accuracy,
      accuracyGeoJson(
        coordinateRef.current,
      ),
    );
    addSource(
      SOURCE_IDS.selection,
      selectionGeoJson(
        selectionRef.current,
      ),
    );

    if (
      !map.getLayer(
        LAYER_IDS.landCover,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.landCover,
        type: "fill",
        source:
          SOURCE_IDS.landCover,
        paint: {
          "fill-color": [
            "match",
            ["get", "type"],
            "Water",
            "#3b82a0",
            "Forest",
            "#2f6942",
            "Woodland",
            "#38744a",
            "Scrub",
            "#5f7651",
            "Farmland",
            "#8a7b4f",
            "Park",
            "#57905c",
            "#5c844f",
          ],
          "fill-opacity": 0.3,
          "fill-outline-color":
            "rgba(210,235,208,.45)",
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.building,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.building,
        type: "fill",
        source:
          SOURCE_IDS.buildings,
        paint: {
          "fill-color": "#64748b",
          "fill-opacity": 0.44,
          "fill-outline-color":
            "#e2e8f0",
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.realRoadCasing,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.realRoadCasing,
        type: "line",
        source:
          SOURCE_IDS.realRoads,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#dbeafe",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            3,
            20,
            14,
          ],
          "line-opacity": 0.86,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.realRoad,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.realRoad,
        type: "line",
        source:
          SOURCE_IDS.realRoads,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            1.6,
            20,
            8,
          ],
          "line-opacity": 0.95,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.realPath,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.realPath,
        type: "line",
        source:
          SOURCE_IDS.realPaths,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2.2,
          "line-dasharray": [
            2,
            1.6,
          ],
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.barrier,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.barrier,
        type: "line",
        source:
          SOURCE_IDS.barriers,
        paint: {
          "line-color": "#ef4444",
          "line-width": 2.2,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.vegetation,
      )
    ) {
      map.addLayer({
        id: LAYER_IDS.vegetation,
        type: "circle",
        source:
          SOURCE_IDS.vegetation,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            1.5,
            20,
            4.5,
          ],
          "circle-color": "#2f7045",
          "circle-opacity": 0.82,
          "circle-stroke-color":
            "#173b26",
          "circle-stroke-width": 0.8,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.detectedRoadCasing,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.detectedRoadCasing,
        type: "line",
        source:
          SOURCE_IDS.detectedRoads,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#292929",
          "line-width": 7,
          "line-opacity": 0.5,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.detectedRoad,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.detectedRoad,
        type: "line",
        source:
          SOURCE_IDS.detectedRoads,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.detectedFeature,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.detectedFeature,
        type: "circle",
        source:
          SOURCE_IDS.detectedFeatures,
        paint: {
          "circle-radius": 5,
          "circle-color": "#f59e0b",
          "circle-stroke-color":
            "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.accuracyFill,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.accuracyFill,
        type: "fill",
        source:
          SOURCE_IDS.accuracy,
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.08,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.accuracyLine,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.accuracyLine,
        type: "line",
        source:
          SOURCE_IDS.accuracy,
        paint: {
          "line-color": "#2563eb",
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.selectionFill,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.selectionFill,
        type: "fill",
        source:
          SOURCE_IDS.selection,
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.11,
        },
      });
    }

    if (
      !map.getLayer(
        LAYER_IDS.selectionLine,
      )
    ) {
      map.addLayer({
        id:
          LAYER_IDS.selectionLine,
        type: "line",
        source:
          SOURCE_IDS.selection,
        paint: {
          "line-color": "#60a5fa",
          "line-width": 2.5,
          "line-dasharray": [
            2,
            1.2,
          ],
        },
      });
    }

    styleReadyRef.current = true;
    setStyleLoading(false);
  };

  useImperativeHandle(
    forwardedRef,
    () => ({
      async captureSelectedAreaSnapshot() {
        const map = mapRef.current;
        const selection =
          selectionRef.current;

        if (!map || !selection) {
          return null;
        }

        try {
          await waitForMapReady(map);

          const canvas =
            map.getCanvas();
          const northWest =
            map.project([
              selection.bounds.west,
              selection.bounds.north,
            ]);
          const southEast =
            map.project([
              selection.bounds.east,
              selection.bounds.south,
            ]);

          const scaleX =
            canvas.width /
            Math.max(
              1,
              canvas.clientWidth,
            );
          const scaleY =
            canvas.height /
            Math.max(
              1,
              canvas.clientHeight,
            );

          const sourceX = Math.max(
            0,
            Math.floor(
              northWest.x * scaleX,
            ),
          );
          const sourceY = Math.max(
            0,
            Math.floor(
              northWest.y * scaleY,
            ),
          );
          const sourceRight =
            Math.min(
              canvas.width,
              Math.ceil(
                southEast.x *
                  scaleX,
              ),
            );
          const sourceBottom =
            Math.min(
              canvas.height,
              Math.ceil(
                southEast.y *
                  scaleY,
              ),
            );

          const width =
            sourceRight - sourceX;
          const height =
            sourceBottom - sourceY;

          if (
            width < 2 ||
            height < 2
          ) {
            throw new Error(
              "The selected area is outside the visible map canvas.",
            );
          }

          const snapshotCanvas =
            document.createElement(
              "canvas",
            );
          snapshotCanvas.width =
            width;
          snapshotCanvas.height =
            height;

          const context =
            snapshotCanvas.getContext(
              "2d",
            );

          if (!context) {
            throw new Error(
              "The snapshot canvas could not be created.",
            );
          }

          context.drawImage(
            canvas,
            sourceX,
            sourceY,
            width,
            height,
            0,
            0,
            width,
            height,
          );

          const blob =
            await new Promise<Blob | null>(
              (resolve) =>
                snapshotCanvas.toBlob(
                  resolve,
                  "image/jpeg",
                  0.86,
                ),
            );

          if (!blob) {
            throw new Error(
              "Map snapshot encoding failed.",
            );
          }

          const reference =
            await SceneSnapshotService.save(
              blob,
              {
                bounds:
                  selection.bounds,
                mapMode:
                  mapModeRef.current,
                widthPixels: width,
                heightPixels: height,
              },
            );

          setCaptureMessage(
            "Selected-area snapshot stored.",
          );

          return reference;
        } catch (error) {
          console.warn(
            "Selected map snapshot could not be stored:",
            error,
          );

          setCaptureMessage(
            error instanceof Error
              ? error.message
              : "Selected-area snapshot could not be stored.",
          );

          return null;
        }
      },

      focusCoordinate(
        nextCoordinate: RoadDetectionCoordinate,
        zoom = 17,
      ) {
        mapRef.current?.easeTo({
          center: [
            nextCoordinate.longitude,
            nextCoordinate.latitude,
          ],
          zoom,
          duration: 450,
        });
      },
    }),
    [],
  );

  useEffect(() => {
    if (
      !containerRef.current ||
      mapRef.current
    ) {
      return;
    }

    const centre:
      | [number, number]
      | undefined =
      coordinateRef.current
        ? [
            coordinateRef.current
              .longitude,
            coordinateRef.current
              .latitude,
          ]
        : [
            31.0335,
            -17.8252,
          ];

    const map =
      new maplibregl.Map({
        container:
          containerRef.current,
        style: getMapStyle(
          mapModeRef.current,
        ),
        center: centre,
        zoom: coordinateRef.current ? 17 : 6,
        minZoom: 4,
        maxZoom: 17,
        canvasContextAttributes: {
          preserveDrawingBuffer:
            true,
        },
        attributionControl: false,
      });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "bottom-right",
    );

    map.on("load", () => {
      installSourcesAndLayers(map);
    });

    map.on("styledata", () => {
      if (
        map.isStyleLoaded()
      ) {
        installSourcesAndLayers(map);
      }
    });

    map.on("click", (event) => {
      if (
        !editableRef.current ||
        drawingModeRef.current
      ) {
        return;
      }

      const target =
        event.originalEvent
          .target as HTMLElement | null;

      if (
        target?.closest(
          "[data-map-control='true']",
        )
      ) {
        return;
      }

      onCoordinateChangeRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        accuracyMetres:
          coordinateRef.current
            ?.accuracyMetres ?? 8,
        capturedAt:
          new Date().toISOString(),
      });
    });

    map.on("mousedown", (event) => {
      if (
        !drawingModeRef.current
      ) {
        return;
      }

      event.preventDefault();
      drawingStartRef.current =
        event.lngLat;
      map.dragPan.disable();
      map.getCanvas().style.cursor =
        "crosshair";
    });

    map.on("mousemove", (event) => {
      const start =
        drawingStartRef.current;

      if (
        !drawingModeRef.current ||
        !start
      ) {
        return;
      }

      const preview =
        createSelection(
          start,
          event.lngLat,
          map,
          mapModeRef.current,
          coordinateRef.current
            ?.accuracyMetres ?? 8,
        );

      setSourceData(
        map,
        SOURCE_IDS.selection,
        selectionGeoJson(preview),
      );
    });

    map.on("mouseup", (event) => {
      const start =
        drawingStartRef.current;

      if (
        !drawingModeRef.current ||
        !start
      ) {
        return;
      }

      drawingStartRef.current =
        null;
      map.dragPan.enable();
      map.getCanvas().style.cursor =
        "";

      const selection =
        createSelection(
          start,
          event.lngLat,
          map,
          mapModeRef.current,
          coordinateRef.current
            ?.accuracyMetres ?? 8,
        );

      selectionRef.current =
        selection;
      onAreaSelectionChangeRef.current?.(
        selection,
      );
      setDrawingMode(false);
    });

    mapRef.current = map;

    return () => {
      selectedMarkerRef.current?.remove();
      currentMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      mapModeRef.current ===
        mapMode
    ) {
      return;
    }

    mapModeRef.current = mapMode;
    styleReadyRef.current = false;
    setStyleLoading(true);
    onMapModeChange?.(mapMode);
    map.setStyle(
      getMapStyle(mapMode),
    );

    if (selectionRef.current) {
      const selection = {
        ...selectionRef.current,
        mapMode,
      };

      selectionRef.current =
        selection;
      onAreaSelectionChangeRef.current?.(
        selection,
      );
    }
  }, [mapMode, onMapModeChange]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !coordinate) {
      return;
    }

    if (
      !selectedMarkerRef.current
    ) {
      const element =
        document.createElement("div");
      element.className =
        "roadsafe-scene-map__accident-marker";
      element.title =
        "Exact accident scene anchor";

      selectedMarkerRef.current =
        new maplibregl.Marker({
          element,
          draggable: editable,
        })
          .setLngLat([
            coordinate.longitude,
            coordinate.latitude,
          ])
          .addTo(map);

      selectedMarkerRef.current.on(
        "dragend",
        () => {
          const location =
            selectedMarkerRef.current?.getLngLat();

          if (!location) return;

          onCoordinateChangeRef.current?.({
            latitude: location.lat,
            longitude: location.lng,
            accuracyMetres:
              coordinateRef.current
                ?.accuracyMetres ?? 8,
            capturedAt:
              new Date().toISOString(),
          });
        },
      );
    } else {
      selectedMarkerRef.current.setLngLat(
        [
          coordinate.longitude,
          coordinate.latitude,
        ],
      );
      selectedMarkerRef.current.setDraggable(
        editable,
      );
    }

    if (
      !selectionRef.current
    ) {
      map.easeTo({
        center: [
          coordinate.longitude,
          coordinate.latitude,
        ],
        zoom: Math.max(
          map.getZoom(),
          17.7,
        ),
        duration: 420,
      });
    }
  }, [coordinate, editable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!currentCoordinate) {
      currentMarkerRef.current?.remove();
      currentMarkerRef.current =
        null;
      return;
    }

    if (
      !currentMarkerRef.current
    ) {
      const element =
        document.createElement("div");
      element.className =
        "roadsafe-scene-map__live-marker";
      element.title =
        "Live device position";

      currentMarkerRef.current =
        new maplibregl.Marker({
          element,
        })
          .setLngLat([
            currentCoordinate.longitude,
            currentCoordinate.latitude,
          ])
          .addTo(map);
    } else {
      currentMarkerRef.current.setLngLat(
        [
          currentCoordinate.longitude,
          currentCoordinate.latitude,
        ],
      );
    }
  }, [currentCoordinate]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !styleReadyRef.current
    ) {
      return;
    }

    setSourceData(
      map,
      SOURCE_IDS.detectedRoads,
      detectedRoadsGeoJson(roads),
    );
    setSourceData(
      map,
      SOURCE_IDS.detectedFeatures,
      detectedFeaturesGeoJson(
        features,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.accuracy,
      accuracyGeoJson(coordinate),
    );
    setSourceData(
      map,
      SOURCE_IDS.selection,
      selectionGeoJson(
        areaSelection,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.realRoads,
      realRoadsGeoJson(
        realSceneGeometry,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.realPaths,
      realPathsGeoJson(
        realSceneGeometry,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.buildings,
      buildingsGeoJson(
        realSceneGeometry,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.barriers,
      barriersGeoJson(
        realSceneGeometry,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.landCover,
      landCoverGeoJson(
        realSceneGeometry,
      ),
    );
    setSourceData(
      map,
      SOURCE_IDS.vegetation,
      vegetationGeoJson(
        realSceneGeometry,
      ),
    );
  }, [
    coordinate,
    roads,
    features,
    areaSelection,
    realSceneGeometry,
    mapMode,
  ]);

  const runSearch = async () => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchError(
        "Enter at least two characters.",
      );
      return;
    }

    setSearching(true);
    setSearchError("");
    setSearchOpen(true);

    try {
      const results =
        await LocationSearchService.search(
          query,
        );
      setSearchResults(results);

      if (results.length === 0) {
        setSearchError(
          "No matching Zimbabwe location was found.",
        );
      }
    } catch (error) {
      setSearchResults([]);
      setSearchError(
        error instanceof Error
          ? error.message
          : "Location search failed.",
      );
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (
    result: ZimbabweLocationSearchResult,
  ) => {
    setSearchQuery(
      result.displayName,
    );
    setSearchResults([]);
    setSearchOpen(false);
    setSearchError("");

    onSearchedLocationChange?.(
      result.displayName,
    );
    onCoordinateChangeRef.current?.(
      result.coordinate,
    );

    mapRef.current?.easeTo({
      center: [
        result.coordinate.longitude,
        result.coordinate.latitude,
      ],
      zoom: 17.2,
      duration: 520,
    });
  };

  return (
    <div className="roadsafe-scene-map">
      <div className="roadsafe-scene-map__viewport">
        <div
          ref={containerRef}
          className="h-[520px] w-full"
        />

        <div
          className="roadsafe-scene-map__search"
          data-map-control="true"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
            className="roadsafe-scene-map__search-form"
          >
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(
                  event.target.value,
                );
                setSearchOpen(false);
                setSearchError("");
              }}
              placeholder="Search a Zimbabwe road, junction or place"
              aria-label="Search map location"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchOpen(false);
                  setSearchError("");
                }}
                aria-label="Clear map search"
              >
                <X size={13} />
              </button>
            )}
            <button
              type="submit"
              disabled={searching}
              className="roadsafe-scene-map__search-submit"
            >
              {searching ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                />
              ) : (
                "Find"
              )}
            </button>
          </form>

          {searchOpen && (
            <div className="roadsafe-scene-map__search-results">
              {searchError && (
                <p className="roadsafe-scene-map__search-error">
                  {searchError}
                </p>
              )}

              {searchResults.map(
                (result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() =>
                      selectSearchResult(
                        result,
                      )
                    }
                  >
                    <MapPin size={13} />
                    <span>
                      <strong>
                        {
                          result.displayName.split(
                            ",",
                          )[0]
                        }
                      </strong>
                      <small>
                        {
                          result.displayName
                        }
                      </small>
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        <div
          className="roadsafe-scene-map__modes"
          data-map-control="true"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {(
            [
              "street",
              "hybrid",
              "terrain",
            ] as RealSceneMapMode[]
          ).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                setMapMode(mode)
              }
              className={
                mapMode === mode
                  ? "is-active"
                  : ""
              }
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="roadsafe-scene-map__instruction">
          <Crosshair size={13} />
          <span>
            Search or click to place the
            exact red accident marker,
            then draw the complete blue
            scene boundary.
          </span>
        </div>

        <div
          className="roadsafe-scene-map__area-controls"
          data-map-control="true"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <button
            type="button"
            onClick={() =>
              setDrawingMode(
                (current) =>
                  !current,
              )
            }
            className={
              drawingMode
                ? "is-active"
                : ""
            }
          >
            {drawingMode
              ? "Drag across the exact scene…"
              : "Select exact scene area"}
          </button>

          {areaSelection && (
            <button
              type="button"
              onClick={() => {
                selectionRef.current =
                  null;
                onAreaSelectionChangeRef.current?.(
                  null,
                );
                setCaptureMessage("");
              }}
            >
              Clear area
            </button>
          )}
        </div>

        <div className="roadsafe-scene-map__dimensions">
          {selectionDimensions(
            areaSelection,
          )}
        </div>

        {styleLoading && (
          <div className="roadsafe-scene-map__loading">
            <Loader2
              size={18}
              className="animate-spin"
            />
            Loading {mapMode} map…
          </div>
        )}
      </div>

      <footer className="roadsafe-scene-map__footer">
        <span>
          {drawingMode
            ? "Hold and drag from one corner to the opposite corner."
            : areaSelection
              ? "Only geometry intersecting this exact blue boundary will be reconstructed."
              : "Mark the accident spot first, then select the complete scene."}
        </span>

        <span>
          {captureMessage ||
            (realSceneGeometry
              ? `${realSceneGeometry.roads.length} roads · ${realSceneGeometry.buildings.length} buildings · ${realSceneGeometry.vegetation?.length ?? 0} vegetation`
              : "Map data © OpenStreetMap contributors · imagery © Esri")}
        </span>
      </footer>
    </div>
  );
});

export default RoadLocationMap;
