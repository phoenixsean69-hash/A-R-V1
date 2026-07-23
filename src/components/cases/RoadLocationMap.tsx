import {
  useEffect,
  useRef,
  useState,
} from "react";

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

import type {
  DetectedRoadFeature,
  DetectedRoadSegment,
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";

interface RoadLocationMapProps {
  coordinate: RoadDetectionCoordinate | null;
  currentCoordinate?: RoadDetectionCoordinate | null;
  roads?: DetectedRoadSegment[];
  features?: DetectedRoadFeature[];
  editable?: boolean;
  onCoordinateChange?: (coordinate: RoadDetectionCoordinate) => void;
}

type LocationMapType = "street" | "hybrid";

const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const ROAD_SOURCE_ID = "roadsafe-detected-roads";
const ROAD_CASING_LAYER_ID = "roadsafe-detected-roads-casing";
const ROAD_LAYER_ID = "roadsafe-detected-roads-line";

const FEATURE_SOURCE_ID = "roadsafe-detected-features";
const FEATURE_LAYER_ID = "roadsafe-detected-features-circle";

const ACCURACY_SOURCE_ID = "roadsafe-location-accuracy";
const ACCURACY_FILL_LAYER_ID = "roadsafe-location-accuracy-fill";
const ACCURACY_LINE_LAYER_ID = "roadsafe-location-accuracy-line";

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
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
      {
        id: "esri-transportation-layer",
        type: "raster",
        source: "esri-transportation",
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
      {
        id: "esri-places-layer",
        type: "raster",
        source: "esri-places",
        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
    ],
  };
}

function getMapStyle(
  mapType: LocationMapType,
): string | StyleSpecification {
  return mapType === "hybrid"
    ? createHybridStyle()
    : STREET_STYLE;
}

function createEmptyFeatureCollection<
  TGeometry extends LineString | Point | Polygon,
>(): FeatureCollection<TGeometry> {
  return {
    type: "FeatureCollection",
    features: [],
  };
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
    geometry: {
      type: "Polygon",
      coordinates: [points],
    },
  };
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
      properties: {
        id: feature.id,
        type: feature.type,
      },
      geometry: {
        type: "Point",
        coordinates: [feature.longitude, feature.latitude],
      },
    })),
  };
}

function accuracyToGeoJson(
  coordinate: RoadDetectionCoordinate | null,
): FeatureCollection<Polygon> {
  return coordinate
    ? {
        type: "FeatureCollection",
        features: [createAccuracyCircle(coordinate)],
      }
    : createEmptyFeatureCollection<Polygon>();
}

export default function RoadLocationMap({
  coordinate,
  currentCoordinate,
  roads = [],
  features = [],
  editable = false,
  onCoordinateChange,
}: RoadLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null);

  const styleLoadedRef = useRef(false);
  const appliedMapTypeRef = useRef<LocationMapType>("street");

  const editableRef = useRef(editable);
  const onCoordinateChangeRef = useRef(onCoordinateChange);
  const coordinateRef = useRef(coordinate);
  const roadsRef = useRef(roads);
  const featuresRef = useRef(features);

  const [mapType, setMapType] = useState<LocationMapType>("street");
  const [styleLoading, setStyleLoading] = useState(false);

  useEffect(() => {
    editableRef.current = editable;
    onCoordinateChangeRef.current = onCoordinateChange;
    coordinateRef.current = coordinate;
    roadsRef.current = roads;
    featuresRef.current = features;
  }, [
    editable,
    onCoordinateChange,
    coordinate,
    roads,
    features,
  ]);

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
      style: getMapStyle(appliedMapTypeRef.current),
      center: centre,
      zoom: coordinateRef.current ? 18 : 6,
      minZoom: 4,
      maxZoom: 20,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right",
    );

    const addOrRestoreOperationalLayers = () => {
      styleLoadedRef.current = true;
      setStyleLoading(false);

      if (!map.getSource(ACCURACY_SOURCE_ID)) {
        map.addSource(ACCURACY_SOURCE_ID, {
          type: "geojson",
          data: accuracyToGeoJson(coordinateRef.current),
        });
      }

      if (!map.getLayer(ACCURACY_FILL_LAYER_ID)) {
        map.addLayer({
          id: ACCURACY_FILL_LAYER_ID,
          type: "fill",
          source: ACCURACY_SOURCE_ID,
          paint: {
            "fill-color": "#2563eb",
            "fill-opacity": 0.12,
          },
        });
      }

      if (!map.getSource(ROAD_SOURCE_ID)) {
        map.addSource(ROAD_SOURCE_ID, {
          type: "geojson",
          data: roadsToGeoJson(roadsRef.current),
        });
      }

      if (!map.getLayer(ROAD_CASING_LAYER_ID)) {
        map.addLayer({
          id: ROAD_CASING_LAYER_ID,
          type: "line",
          source: ROAD_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": 8,
            "line-opacity": 0.88,
          },
        });
      }

      if (!map.getLayer(ROAD_LAYER_ID)) {
        map.addLayer({
          id: ROAD_LAYER_ID,
          type: "line",
          source: ROAD_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#dc2626",
            "line-width": 4.5,
            "line-opacity": 0.95,
          },
        });
      }

      if (!map.getSource(FEATURE_SOURCE_ID)) {
        map.addSource(FEATURE_SOURCE_ID, {
          type: "geojson",
          data: featuresToGeoJson(featuresRef.current),
        });
      }

      if (!map.getLayer(FEATURE_LAYER_ID)) {
        map.addLayer({
          id: FEATURE_LAYER_ID,
          type: "circle",
          source: FEATURE_SOURCE_ID,
          paint: {
            "circle-radius": 6,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      }

      if (!map.getLayer(ACCURACY_LINE_LAYER_ID)) {
        map.addLayer({
          id: ACCURACY_LINE_LAYER_ID,
          type: "line",
          source: ACCURACY_SOURCE_ID,
          paint: {
            "line-color": "#2563eb",
            "line-width": 2,
            "line-opacity": 0.75,
          },
        });
      }
    };

    map.on("style.load", addOrRestoreOperationalLayers);

    map.on("click", (event) => {
      if (
        !editableRef.current ||
        !onCoordinateChangeRef.current
      ) {
        return;
      }

      onCoordinateChangeRef.current({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        accuracyMetres:
          coordinateRef.current?.accuracyMetres ?? 10,
        capturedAt: new Date().toISOString(),
      });
    });

    mapRef.current = map;

    return () => {
      selectedMarkerRef.current?.remove();
      currentMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      currentMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedMapTypeRef.current === mapType) return;

    appliedMapTypeRef.current = mapType;
    styleLoadedRef.current = false;
    setStyleLoading(true);
    map.setStyle(getMapStyle(mapType));
  }, [mapType]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coordinate) return;

    if (!selectedMarkerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.className =
        "h-6 w-6 rounded-full border-4 border-white bg-red-600 shadow-lg";
      markerElement.title = "Selected accident location";

      selectedMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
        draggable: editable,
      })
        .setLngLat([
          coordinate.longitude,
          coordinate.latitude,
        ])
        .addTo(map);

      selectedMarkerRef.current.on("dragend", () => {
        const location =
          selectedMarkerRef.current?.getLngLat();

        if (!location || !onCoordinateChangeRef.current) {
          return;
        }

        onCoordinateChangeRef.current({
          latitude: location.lat,
          longitude: location.lng,
          accuracyMetres:
            coordinateRef.current?.accuracyMetres ?? 10,
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

    map.easeTo({
      center: [coordinate.longitude, coordinate.latitude],
      zoom: Math.max(map.getZoom(), 17.5),
      duration: 500,
    });
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
      const markerElement = document.createElement("div");
      markerElement.className =
        "h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow";
      markerElement.title = "Live device position";

      currentMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
      })
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

    const roadSource = map.getSource(ROAD_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    const featureSource = map.getSource(FEATURE_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    roadSource?.setData(roadsToGeoJson(roads));
    featureSource?.setData(featuresToGeoJson(features));

    if (roads.length > 0) {
      const bounds = new maplibregl.LngLatBounds();

      roads.forEach((road) => {
        road.points.forEach((point) => {
          bounds.extend([
            point.longitude,
            point.latitude,
          ]);
        });
      });

      if (coordinate) {
        bounds.extend([
          coordinate.longitude,
          coordinate.latitude,
        ]);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 55,
          maxZoom: 19,
          duration: 600,
        });
      }
    }
  }, [coordinate, roads, features, mapType]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const source = map.getSource(ACCURACY_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    source?.setData(accuracyToGeoJson(coordinate));
  }, [coordinate, mapType]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="relative">
        <div ref={containerRef} className="h-[360px] w-full" />

        <div
          className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-sm border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setMapType("street")}
            className={`px-4 py-2 text-xs font-black transition sm:text-sm ${
              mapType === "street"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Street
          </button>

          <button
            type="button"
            onClick={() => setMapType("hybrid")}
            className={`border-l border-slate-200 px-4 py-2 text-xs font-black transition sm:text-sm ${
              mapType === "hybrid"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Hybrid
          </button>
        </div>

        {styleLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/25">
            <div className="rounded-sm bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-xl">
              Loading {mapType} map…
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span>
          {editable
            ? "Drag the red marker or click the map to correct the accident position."
            : "Red lines show the road geometry returned for the selected location."}
        </span>

        <span>
          {mapType === "hybrid"
            ? "Imagery © Esri · road data © OpenStreetMap contributors"
            : "© OpenStreetMap contributors"}
        </span>
      </div>
    </div>
  );
}