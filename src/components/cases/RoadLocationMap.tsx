import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
} from "geojson";

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
}

interface RoadLocationMapProps {
  coordinate: RoadDetectionCoordinate | null;
  currentCoordinate?: RoadDetectionCoordinate | null;
  roads?: DetectedRoadSegment[];
  features?: DetectedRoadFeature[];
  editable?: boolean;
  onCoordinateChange?: (coordinate: RoadDetectionCoordinate) => void;
  areaSelection?: RealSceneAreaSelection | null;
  onAreaSelectionChange?: (selection: RealSceneAreaSelection | null) => void;
  realSceneGeometry?: RealSceneGeometry | null;
  onMapModeChange?: (mapMode: RealSceneMapMode) => void;
}

const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const DETECTED_ROAD_SOURCE_ID = "roadsafe-detected-roads";
const DETECTED_ROAD_CASING_LAYER_ID = "roadsafe-detected-roads-casing";
const DETECTED_ROAD_LAYER_ID = "roadsafe-detected-roads-line";
const FEATURE_SOURCE_ID = "roadsafe-detected-features";
const FEATURE_LAYER_ID = "roadsafe-detected-features-circle";
const ACCURACY_SOURCE_ID = "roadsafe-location-accuracy";
const ACCURACY_FILL_LAYER_ID = "roadsafe-location-accuracy-fill";
const ACCURACY_LINE_LAYER_ID = "roadsafe-location-accuracy-line";
const SELECTION_SOURCE_ID = "roadsafe-scene-area";
const SELECTION_FILL_LAYER_ID = "roadsafe-scene-area-fill";
const SELECTION_LINE_LAYER_ID = "roadsafe-scene-area-line";
const REAL_ROAD_SOURCE_ID = "roadsafe-real-scene-roads";
const REAL_ROAD_CASING_LAYER_ID = "roadsafe-real-scene-road-casing";
const REAL_ROAD_LAYER_ID = "roadsafe-real-scene-road";
const REAL_PATH_SOURCE_ID = "roadsafe-real-scene-paths";
const REAL_PATH_LAYER_ID = "roadsafe-real-scene-path";
const REAL_BUILDING_SOURCE_ID = "roadsafe-real-scene-buildings";
const REAL_BUILDING_LAYER_ID = "roadsafe-real-scene-building";
const REAL_BARRIER_SOURCE_ID = "roadsafe-real-scene-barriers";
const REAL_BARRIER_LAYER_ID = "roadsafe-real-scene-barrier";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        maxzoom: 19,
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
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "Imagery © Esri",
      },
      "esri-transportation": {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "Transportation © Esri",
      },
      "esri-places": {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "Places and boundaries © Esri",
      },
    },
    layers: [
      {
        id: "esri-imagery-layer",
        type: "raster",
        source: "esri-imagery",
        paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
      },
      {
        id: "esri-transportation-layer",
        type: "raster",
        source: "esri-transportation",
        paint: { "raster-opacity": 0.92, "raster-fade-duration": 0 },
      },
      {
        id: "esri-places-layer",
        type: "raster",
        source: "esri-places",
        paint: { "raster-opacity": 0.95, "raster-fade-duration": 0 },
      },
    ],
  };
}

function getMapStyle(
  mapMode: RealSceneMapMode,
): string | StyleSpecification {
  if (mapMode === "hybrid") return createHybridStyle();
  if (mapMode === "terrain") {
    return createRasterStyle(
      "esri-topographic",
      [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      "Topographic map © Esri",
    );
  }
  return STREET_STYLE;
}

function createEmptyFeatureCollection<
  TGeometry extends LineString | Point | Polygon,
>(): FeatureCollection<TGeometry> {
  return { type: "FeatureCollection", features: [] };
}

function createAccuracyCircle(
  coordinate: RoadDetectionCoordinate,
): Feature<Polygon> {
  const pointCount = 64;
  const latitudeRadians = (coordinate.latitude * Math.PI) / 180;
  const latitudeScale = 1 / 110_540;
  const longitudeScale =
    1 / (111_320 * Math.max(Math.cos(latitudeRadians), 0.000001));
  const points: Array<[number, number]> = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const north = Math.cos(angle) * coordinate.accuracyMetres;
    const east = Math.sin(angle) * coordinate.accuracyMetres;
    points.push([
      coordinate.longitude + east * longitudeScale,
      coordinate.latitude + north * latitudeScale,
    ]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [points] },
  };
}

function accuracyToGeoJson(
  coordinate: RoadDetectionCoordinate | null,
): FeatureCollection<Polygon> {
  return coordinate
    ? { type: "FeatureCollection", features: [createAccuracyCircle(coordinate)] }
    : createEmptyFeatureCollection<Polygon>();
}

function roadsToGeoJson(
  roads: DetectedRoadSegment[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: roads
      .filter((road) => road.points.length >= 2)
      .map((road) => ({
        type: "Feature",
        properties: {
          id: road.id,
          name: road.name,
          highwayType: road.highwayType,
        },
        geometry: {
          type: "LineString",
          coordinates: road.points.map((point) => [
            point.longitude,
            point.latitude,
          ]),
        },
      })),
  };
}

function featuresToGeoJson(
  features: DetectedRoadFeature[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      properties: { id: feature.id, type: feature.type },
      geometry: {
        type: "Point",
        coordinates: [feature.longitude, feature.latitude],
      },
    })),
  };
}

function selectionToGeoJson(
  selection: RealSceneAreaSelection | null,
): FeatureCollection<Polygon> {
  if (!selection) return createEmptyFeatureCollection<Polygon>();
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: selection.id },
        geometry: {
          type: "Polygon",
          coordinates: [
            selection.polygon.map((point) => [point.longitude, point.latitude]),
          ],
        },
      },
    ],
  };
}

function realRoadsToGeoJson(
  geometry: RealSceneGeometry | null | undefined,
): FeatureCollection<LineString> {
  if (!geometry) return createEmptyFeatureCollection<LineString>();
  return {
    type: "FeatureCollection",
    features: geometry.roads.map((road) => ({
      type: "Feature",
      properties: {
        id: road.id,
        name: road.name,
        widthMetres: road.widthMetres,
      },
      geometry: {
        type: "LineString",
        coordinates: road.points.map((point) => [point.longitude, point.latitude]),
      },
    })),
  };
}

function realPathsToGeoJson(
  geometry: RealSceneGeometry | null | undefined,
): FeatureCollection<LineString> {
  if (!geometry) return createEmptyFeatureCollection<LineString>();
  return {
    type: "FeatureCollection",
    features: geometry.paths.map((path) => ({
      type: "Feature",
      properties: { id: path.id, widthMetres: path.widthMetres },
      geometry: {
        type: "LineString",
        coordinates: path.points.map((point) => [point.longitude, point.latitude]),
      },
    })),
  };
}

function realBuildingsToGeoJson(
  geometry: RealSceneGeometry | null | undefined,
): FeatureCollection<Polygon> {
  if (!geometry) return createEmptyFeatureCollection<Polygon>();
  return {
    type: "FeatureCollection",
    features: geometry.buildings
      .filter((building) => building.points.length >= 4)
      .map((building) => ({
        type: "Feature",
        properties: { id: building.id, name: building.name },
        geometry: {
          type: "Polygon",
          coordinates: [
            building.points.map((point) => [point.longitude, point.latitude]),
          ],
        },
      })),
  };
}

function realBarriersToGeoJson(
  geometry: RealSceneGeometry | null | undefined,
): FeatureCollection<LineString> {
  if (!geometry) return createEmptyFeatureCollection<LineString>();
  return {
    type: "FeatureCollection",
    features: geometry.barriers.map((barrier) => ({
      type: "Feature",
      properties: { id: barrier.id, type: barrier.barrierType },
      geometry: {
        type: "LineString",
        coordinates: barrier.points.map((point) => [
          point.longitude,
          point.latitude,
        ]),
      },
    })),
  };
}

function createSelection(
  first: maplibregl.LngLat,
  second: maplibregl.LngLat,
  map: maplibregl.Map,
  mapMode: RealSceneMapMode,
  accuracyMetres: number,
): RealSceneAreaSelection {
  const west = Math.min(first.lng, second.lng);
  const east = Math.max(first.lng, second.lng);
  const south = Math.min(first.lat, second.lat);
  const north = Math.max(first.lat, second.lat);
  const selectedAt = new Date().toISOString();
  return {
    id: createId("scene-area"),
    bounds: { north, south, east, west },
    polygon: [
      { latitude: north, longitude: west },
      { latitude: north, longitude: east },
      { latitude: south, longitude: east },
      { latitude: south, longitude: west },
      { latitude: north, longitude: west },
    ],
    centre: {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2,
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

function selectionDimensions(selection: RealSceneAreaSelection | null): string {
  if (!selection) return "No scene area selected";
  const latitude = (selection.bounds.north + selection.bounds.south) / 2;
  const width =
    (selection.bounds.east - selection.bounds.west) *
    111_320 *
    Math.cos((latitude * Math.PI) / 180);
  const height = (selection.bounds.north - selection.bounds.south) * 110_540;
  return `${Math.max(0, width).toFixed(1)} × ${Math.max(0, height).toFixed(1)} m`;
}

const RoadLocationMap = forwardRef<RoadLocationMapHandle, RoadLocationMapProps>(
  function RoadLocationMap(
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
    },
    forwardedRef,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
    const currentMarkerRef = useRef<maplibregl.Marker | null>(null);
    const drawingStartRef = useRef<maplibregl.LngLat | null>(null);
    const styleLoadedRef = useRef(false);
    const appliedMapModeRef = useRef<RealSceneMapMode>("street");

    const coordinateRef = useRef(coordinate);
    const roadsRef = useRef(roads);
    const featuresRef = useRef(features);
    const editableRef = useRef(editable);
    const onCoordinateChangeRef = useRef(onCoordinateChange);
    const selectionRef = useRef(areaSelection);
    const onAreaSelectionChangeRef = useRef(onAreaSelectionChange);
    const realGeometryRef = useRef(realSceneGeometry);
    const mapModeRef = useRef<RealSceneMapMode>("street");
    const drawingModeRef = useRef(false);

    const [mapMode, setMapMode] = useState<RealSceneMapMode>("street");
    const [styleLoading, setStyleLoading] = useState(false);
    const [drawingMode, setDrawingMode] = useState(false);
    const [captureMessage, setCaptureMessage] = useState("");

    useEffect(() => {
      coordinateRef.current = coordinate;
      roadsRef.current = roads;
      featuresRef.current = features;
      editableRef.current = editable;
      onCoordinateChangeRef.current = onCoordinateChange;
      selectionRef.current = areaSelection;
      onAreaSelectionChangeRef.current = onAreaSelectionChange;
      realGeometryRef.current = realSceneGeometry;
    }, [
      coordinate,
      roads,
      features,
      editable,
      onCoordinateChange,
      areaSelection,
      onAreaSelectionChange,
      realSceneGeometry,
    ]);

    useEffect(() => {
      mapModeRef.current = mapMode;
      drawingModeRef.current = drawingMode;
    }, [mapMode, drawingMode]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        async captureSelectedAreaSnapshot() {
          const map = mapRef.current;
          const selection = selectionRef.current;
          if (!map || !selection) return null;

          try {
            await new Promise<void>((resolve) => {
              if (map.areTilesLoaded()) resolve();
              else map.once("idle", () => resolve());
            });

            const canvas = map.getCanvas();
            const northWest = map.project([
              selection.bounds.west,
              selection.bounds.north,
            ]);
            const southEast = map.project([
              selection.bounds.east,
              selection.bounds.south,
            ]);
            const scaleX = canvas.width / Math.max(1, canvas.clientWidth);
            const scaleY = canvas.height / Math.max(1, canvas.clientHeight);
            const sourceX = Math.max(0, Math.floor(northWest.x * scaleX));
            const sourceY = Math.max(0, Math.floor(northWest.y * scaleY));
            const sourceRight = Math.min(
              canvas.width,
              Math.ceil(southEast.x * scaleX),
            );
            const sourceBottom = Math.min(
              canvas.height,
              Math.ceil(southEast.y * scaleY),
            );
            const width = sourceRight - sourceX;
            const height = sourceBottom - sourceY;
            if (width < 2 || height < 2) {
              throw new Error("The selected map area is outside the visible canvas.");
            }

            const snapshotCanvas = document.createElement("canvas");
            snapshotCanvas.width = width;
            snapshotCanvas.height = height;
            const context = snapshotCanvas.getContext("2d");
            if (!context) throw new Error("Snapshot canvas could not be created.");
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

            const blob = await new Promise<Blob | null>((resolve) =>
              snapshotCanvas.toBlob(resolve, "image/jpeg", 0.86),
            );
            if (!blob) throw new Error("Map snapshot encoding failed.");

            const reference = await SceneSnapshotService.save(blob, {
              bounds: selection.bounds,
              mapMode: mapModeRef.current,
              widthPixels: width,
              heightPixels: height,
            });
            setCaptureMessage("Selected-area snapshot stored.");
            return reference;
          } catch (error) {
            console.warn("Selected map snapshot could not be stored:", error);
            setCaptureMessage(
              error instanceof Error
                ? error.message
                : "Selected-area snapshot could not be stored.",
            );
            return null;
          }
        },
      }),
      [],
    );

    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      const centre: [number, number] = coordinateRef.current
        ? [
            coordinateRef.current.longitude,
            coordinateRef.current.latitude,
          ]
        : [31.0335, -17.8252];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle(appliedMapModeRef.current),
        center: centre,
        zoom: coordinateRef.current ? 18 : 6,
        minZoom: 4,
        maxZoom: 20,
        attributionControl: { compact: true },
        preserveDrawingBuffer: true,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      const addGeoJsonSource = (
        id: string,
        data: FeatureCollection<LineString | Point | Polygon>,
      ) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
      };

      const restoreLayers = () => {
        styleLoadedRef.current = true;
        setStyleLoading(false);

        addGeoJsonSource(
          ACCURACY_SOURCE_ID,
          accuracyToGeoJson(coordinateRef.current),
        );
        addGeoJsonSource(
          DETECTED_ROAD_SOURCE_ID,
          roadsToGeoJson(roadsRef.current),
        );
        addGeoJsonSource(
          FEATURE_SOURCE_ID,
          featuresToGeoJson(featuresRef.current),
        );
        addGeoJsonSource(
          SELECTION_SOURCE_ID,
          selectionToGeoJson(selectionRef.current),
        );
        addGeoJsonSource(
          REAL_ROAD_SOURCE_ID,
          realRoadsToGeoJson(realGeometryRef.current),
        );
        addGeoJsonSource(
          REAL_PATH_SOURCE_ID,
          realPathsToGeoJson(realGeometryRef.current),
        );
        addGeoJsonSource(
          REAL_BUILDING_SOURCE_ID,
          realBuildingsToGeoJson(realGeometryRef.current),
        );
        addGeoJsonSource(
          REAL_BARRIER_SOURCE_ID,
          realBarriersToGeoJson(realGeometryRef.current),
        );

        if (!map.getLayer(REAL_BUILDING_LAYER_ID)) {
          map.addLayer({
            id: REAL_BUILDING_LAYER_ID,
            type: "fill",
            source: REAL_BUILDING_SOURCE_ID,
            paint: {
              "fill-color": "#475569",
              "fill-opacity": 0.42,
              "fill-outline-color": "#f8fafc",
            },
          });
        }
        if (!map.getLayer(REAL_ROAD_CASING_LAYER_ID)) {
          map.addLayer({
            id: REAL_ROAD_CASING_LAYER_ID,
            type: "line",
            source: REAL_ROAD_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
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
              "line-opacity": 0.82,
            },
          });
        }
        if (!map.getLayer(REAL_ROAD_LAYER_ID)) {
          map.addLayer({
            id: REAL_ROAD_LAYER_ID,
            type: "line",
            source: REAL_ROAD_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
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
              "line-opacity": 0.94,
            },
          });
        }
        if (!map.getLayer(REAL_PATH_LAYER_ID)) {
          map.addLayer({
            id: REAL_PATH_LAYER_ID,
            type: "line",
            source: REAL_PATH_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#f59e0b",
              "line-width": 2.2,
              "line-dasharray": [2, 1.6],
            },
          });
        }
        if (!map.getLayer(REAL_BARRIER_LAYER_ID)) {
          map.addLayer({
            id: REAL_BARRIER_LAYER_ID,
            type: "line",
            source: REAL_BARRIER_SOURCE_ID,
            paint: { "line-color": "#ef4444", "line-width": 2.4 },
          });
        }
        if (!map.getLayer(DETECTED_ROAD_CASING_LAYER_ID)) {
          map.addLayer({
            id: DETECTED_ROAD_CASING_LAYER_ID,
            type: "line",
            source: DETECTED_ROAD_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#ffffff",
              "line-width": 7,
              "line-opacity": 0.68,
            },
          });
        }
        if (!map.getLayer(DETECTED_ROAD_LAYER_ID)) {
          map.addLayer({
            id: DETECTED_ROAD_LAYER_ID,
            type: "line",
            source: DETECTED_ROAD_SOURCE_ID,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#dc2626",
              "line-width": 3.5,
              "line-opacity": 0.8,
            },
          });
        }
        if (!map.getLayer(FEATURE_LAYER_ID)) {
          map.addLayer({
            id: FEATURE_LAYER_ID,
            type: "circle",
            source: FEATURE_SOURCE_ID,
            paint: {
              "circle-radius": 5,
              "circle-color": "#f59e0b",
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });
        }
        if (!map.getLayer(ACCURACY_FILL_LAYER_ID)) {
          map.addLayer({
            id: ACCURACY_FILL_LAYER_ID,
            type: "fill",
            source: ACCURACY_SOURCE_ID,
            paint: { "fill-color": "#2563eb", "fill-opacity": 0.1 },
          });
        }
        if (!map.getLayer(ACCURACY_LINE_LAYER_ID)) {
          map.addLayer({
            id: ACCURACY_LINE_LAYER_ID,
            type: "line",
            source: ACCURACY_SOURCE_ID,
            paint: {
              "line-color": "#2563eb",
              "line-width": 1.5,
              "line-opacity": 0.65,
            },
          });
        }
        if (!map.getLayer(SELECTION_FILL_LAYER_ID)) {
          map.addLayer({
            id: SELECTION_FILL_LAYER_ID,
            type: "fill",
            source: SELECTION_SOURCE_ID,
            paint: { "fill-color": "#38bdf8", "fill-opacity": 0.13 },
          });
        }
        if (!map.getLayer(SELECTION_LINE_LAYER_ID)) {
          map.addLayer({
            id: SELECTION_LINE_LAYER_ID,
            type: "line",
            source: SELECTION_SOURCE_ID,
            paint: {
              "line-color": "#0ea5e9",
              "line-width": 3,
              "line-dasharray": [2, 1.2],
            },
          });
        }
      };

      map.on("style.load", restoreLayers);

      map.on("click", (event) => {
        if (
          drawingModeRef.current ||
          !editableRef.current ||
          !onCoordinateChangeRef.current
        ) {
          return;
        }
        onCoordinateChangeRef.current({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
          accuracyMetres: coordinateRef.current?.accuracyMetres ?? 10,
          capturedAt: new Date().toISOString(),
        });
      });

      map.on("mousedown", (event) => {
        if (!drawingModeRef.current) return;
        event.preventDefault();
        drawingStartRef.current = event.lngLat;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "crosshair";
      });

      map.on("mousemove", (event) => {
        const start = drawingStartRef.current;
        if (!drawingModeRef.current || !start) return;
        const preview = createSelection(
          start,
          event.lngLat,
          map,
          mapModeRef.current,
          coordinateRef.current?.accuracyMetres ?? 10,
        );
        const source = map.getSource(SELECTION_SOURCE_ID) as
          | maplibregl.GeoJSONSource
          | undefined;
        source?.setData(selectionToGeoJson(preview));
      });

      map.on("mouseup", (event) => {
        const start = drawingStartRef.current;
        if (!drawingModeRef.current || !start) return;
        drawingStartRef.current = null;
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
        const selection = createSelection(
          start,
          event.lngLat,
          map,
          mapModeRef.current,
          coordinateRef.current?.accuracyMetres ?? 10,
        );
        selectionRef.current = selection;
        onAreaSelectionChangeRef.current?.(selection);
        setDrawingMode(false);
      });

      mapRef.current = map;
      return () => {
        selectedMarkerRef.current?.remove();
        currentMarkerRef.current?.remove();
        map.remove();
        mapRef.current = null;
        styleLoadedRef.current = false;
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || appliedMapModeRef.current === mapMode) return;
      appliedMapModeRef.current = mapMode;
      styleLoadedRef.current = false;
      setStyleLoading(true);
      onMapModeChange?.(mapMode);
      map.setStyle(getMapStyle(mapMode));
      if (selectionRef.current) {
        const selection = { ...selectionRef.current, mapMode };
        selectionRef.current = selection;
        onAreaSelectionChangeRef.current?.(selection);
      }
    }, [mapMode, onMapModeChange]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !coordinate) return;
      if (!selectedMarkerRef.current) {
        const element = document.createElement("div");
        element.className =
          "h-6 w-6 rounded-full border-4 border-white bg-red-600 shadow-lg";
        element.title = "Accident scene anchor";
        selectedMarkerRef.current = new maplibregl.Marker({
          element,
          draggable: editable,
        })
          .setLngLat([coordinate.longitude, coordinate.latitude])
          .addTo(map);
        selectedMarkerRef.current.on("dragend", () => {
          const location = selectedMarkerRef.current?.getLngLat();
          if (!location || !onCoordinateChangeRef.current) return;
          onCoordinateChangeRef.current({
            latitude: location.lat,
            longitude: location.lng,
            accuracyMetres: coordinateRef.current?.accuracyMetres ?? 10,
            capturedAt: new Date().toISOString(),
          });
        });
      } else {
        selectedMarkerRef.current.setLngLat([
          coordinate.longitude,
          coordinate.latitude,
        ]);
        selectedMarkerRef.current.setDraggable(editable);
      }
      if (!selectionRef.current) {
        map.easeTo({
          center: [coordinate.longitude, coordinate.latitude],
          zoom: Math.max(map.getZoom(), 17.5),
          duration: 500,
        });
      }
    }, [coordinate, editable]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      if (!currentCoordinate) {
        currentMarkerRef.current?.remove();
        currentMarkerRef.current = null;
        return;
      }
      if (!currentMarkerRef.current) {
        const element = document.createElement("div");
        element.className =
          "h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow";
        element.title = "Live device position";
        currentMarkerRef.current = new maplibregl.Marker({ element })
          .setLngLat([
            currentCoordinate.longitude,
            currentCoordinate.latitude,
          ])
          .addTo(map);
      } else {
        currentMarkerRef.current.setLngLat([
          currentCoordinate.longitude,
          currentCoordinate.latitude,
        ]);
      }
    }, [currentCoordinate]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !styleLoadedRef.current) return;
      const update = <T extends LineString | Point | Polygon>(
        id: string,
        data: FeatureCollection<T>,
      ) => {
        const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        source?.setData(data);
      };
      update(DETECTED_ROAD_SOURCE_ID, roadsToGeoJson(roads));
      update(FEATURE_SOURCE_ID, featuresToGeoJson(features));
      update(ACCURACY_SOURCE_ID, accuracyToGeoJson(coordinate));
      update(SELECTION_SOURCE_ID, selectionToGeoJson(areaSelection));
      update(REAL_ROAD_SOURCE_ID, realRoadsToGeoJson(realSceneGeometry));
      update(REAL_PATH_SOURCE_ID, realPathsToGeoJson(realSceneGeometry));
      update(
        REAL_BUILDING_SOURCE_ID,
        realBuildingsToGeoJson(realSceneGeometry),
      );
      update(REAL_BARRIER_SOURCE_ID, realBarriersToGeoJson(realSceneGeometry));
    }, [coordinate, roads, features, areaSelection, realSceneGeometry, mapMode]);

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <div className="relative">
          <div ref={containerRef} className="h-[430px] w-full" />

          <div
            className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-md border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            {(["street", "hybrid", "terrain"] as RealSceneMapMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMapMode(mode)}
                  className={`border-r border-slate-200 px-3 py-2 text-xs font-black capitalize transition last:border-r-0 ${
                    mapMode === mode
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {mode}
                </button>
              ),
            )}
          </div>

          <div
            className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDrawingMode((current) => !current)}
              className={`rounded-md border px-3 py-2 text-xs font-black shadow-lg transition ${
                drawingMode
                  ? "border-sky-300 bg-sky-600 text-white"
                  : "border-slate-200 bg-white/95 text-slate-800 hover:bg-slate-100"
              }`}
            >
              {drawingMode ? "Drag across the map…" : "Select scene area"}
            </button>
            {areaSelection && (
              <button
                type="button"
                onClick={() => {
                  selectionRef.current = null;
                  onAreaSelectionChangeRef.current?.(null);
                  setCaptureMessage("");
                }}
                className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg hover:bg-slate-100"
              >
                Clear area
              </button>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md border border-slate-200 bg-white/92 px-3 py-2 text-xs font-black text-slate-800 shadow-lg backdrop-blur">
            {selectionDimensions(areaSelection)}
          </div>

          {styleLoading && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/25">
              <div className="rounded-md bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-xl">
                Loading {mapMode} map…
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <span>
            {drawingMode
              ? "Hold and drag to draw the exact accident-scene boundary."
              : areaSelection
                ? "The blue boundary is the only area that will be extracted and reconstructed."
                : "Centre with GPS, then manually select the accident-scene area."}
          </span>
          <span>
            {captureMessage ||
              (realSceneGeometry
                ? `${realSceneGeometry.roads.length} roads · ${realSceneGeometry.buildings.length} buildings extracted`
                : "Map data © OpenStreetMap contributors · imagery/topography © Esri")}
          </span>
        </div>
      </div>
    );
  },
);

export default RoadLocationMap;
