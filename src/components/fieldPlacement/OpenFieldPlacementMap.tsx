import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Focus,
  MapPinned,
  Navigation,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";

import type {
  FieldCaptureMode,
  FieldPlacementRecord,
  FieldSceneCalibration,
  GeoCoordinate,
  RejectedGeoCoordinate,
} from "../../types/fieldPlacement";
import { createAccuracyCircleGeoJson } from "../../utils/geographicCoordinates";

interface FieldPlacementMapProps {
  current: GeoCoordinate | null;
  calibration?: FieldSceneCalibration;
  placements: FieldPlacementRecord[];
  rawTraceCoordinates?: GeoCoordinate[];
  processedTraceCoordinates?: GeoCoordinate[];
  rejectedTraceCoordinates?: RejectedGeoCoordinate[];
  pendingCoordinate?: GeoCoordinate | null;
  captureMode?: FieldCaptureMode;
  guidancePlacementId: string | null;
}

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function pointFeature(
  coordinate: Pick<GeoCoordinate, "latitude" | "longitude">,
  properties: Record<string, string | number>,
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: [coordinate.longitude, coordinate.latitude],
    },
  };
}

function lineFeature(
  coordinates: GeoCoordinate[],
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: coordinates.map((coordinate) => [
        coordinate.longitude,
        coordinate.latitude,
      ]),
    },
  };
}

function polygonFeature(
  coordinates: GeoCoordinate[],
): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        coordinates.map((coordinate) => [
          coordinate.longitude,
          coordinate.latitude,
        ]),
      ],
    },
  };
}

function allCoordinates(input: {
  current: GeoCoordinate | null;
  calibration?: FieldSceneCalibration;
  placements: FieldPlacementRecord[];
  raw: GeoCoordinate[];
  processed: GeoCoordinate[];
  pending?: GeoCoordinate | null;
}): GeoCoordinate[] {
  const coordinates: GeoCoordinate[] = [];
  if (input.current) coordinates.push(input.current);
  if (input.pending) coordinates.push(input.pending);
  if (input.calibration) {
    coordinates.push(
      input.calibration.origin,
      input.calibration.directionReference,
    );
    if (input.calibration.widthReference) {
      coordinates.push(input.calibration.widthReference);
    }
  }
  coordinates.push(...input.placements.map((placement) => placement.coordinate));
  coordinates.push(...input.raw, ...input.processed);
  return coordinates;
}

export default function OpenFieldPlacementMap({
  current,
  calibration,
  placements,
  rawTraceCoordinates = [],
  processedTraceCoordinates = [],
  rejectedTraceCoordinates = [],
  pendingCoordinate = null,
  captureMode = "Point",
  guidancePlacementId,
}: FieldPlacementMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentMarkerRef = useRef<MapLibreMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [followOfficer, setFollowOfficer] = useState(true);
  const [initialCoordinate] = useState(() => current ?? calibration?.origin ?? null);

  const captureCoordinates = useMemo(
    () =>
      processedTraceCoordinates.length > 0
        ? processedTraceCoordinates
        : rawTraceCoordinates,
    [processedTraceCoordinates, rawTraceCoordinates],
  );

  const fitCoordinates = useCallback((coordinates: GeoCoordinate[]) => {
    const map = mapRef.current;
    if (!map || coordinates.length === 0) return;
    if (coordinates.length === 1) {
      map.easeTo({
        center: [coordinates[0].longitude, coordinates[0].latitude],
        zoom: Math.max(18, map.getZoom()),
        duration: 450,
      });
      return;
    }

    const bounds = coordinates.reduce(
      (result, coordinate) =>
        result.extend([coordinate.longitude, coordinate.latitude]),
      new maplibregl.LngLatBounds(
        [coordinates[0].longitude, coordinates[0].latitude],
        [coordinates[0].longitude, coordinates[0].latitude],
      ),
    );
    map.fitBounds(bounds, {
      padding: 56,
      maxZoom: 19.5,
      duration: 500,
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initial = initialCoordinate;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: initial
        ? [initial.longitude, initial.latitude]
        : [31.336976, -17.311182],
      zoom: initial ? 18 : 14,
      maxZoom: 21,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("dragstart", (event) => {
      if (event.originalEvent) setFollowOfficer(false);
    });
    map.on("zoomstart", (event) => {
      if (event.originalEvent) setFollowOfficer(false);
    });

    map.on("load", () => {
      map.addSource("field-accuracy", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-accuracy-fill",
        type: "fill",
        source: "field-accuracy",
        paint: { "fill-color": "#0284c7", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "field-accuracy-outline",
        type: "line",
        source: "field-accuracy",
        paint: {
          "line-color": "#0284c7",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      map.addSource("field-calibration", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-calibration-points",
        type: "circle",
        source: "field-calibration",
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "match",
            ["get", "kind"],
            "origin",
            "#16a34a",
            "direction",
            "#2563eb",
            "#0891b2",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addSource("field-placements", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-placement-points",
        type: "circle",
        source: "field-placements",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "selected"], 1],
            9,
            6,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#f59e0b",
            "#1d4ed8",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addSource("field-raw-trace", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-raw-trace-line",
        type: "line",
        source: "field-raw-trace",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
          "line-opacity": 0.8,
          "line-dasharray": [2, 1.5],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.addSource("field-processed-trace", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-processed-boundary-fill",
        type: "fill",
        source: "field-processed-trace",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "field-processed-trace-line",
        type: "line",
        source: "field-processed-trace",
        paint: {
          "line-color": "#0284c7",
          "line-width": 5,
          "line-opacity": 0.95,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.addSource("field-rejected-trace", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-rejected-points",
        type: "circle",
        source: "field-rejected-trace",
        paint: {
          "circle-radius": 5,
          "circle-color": "#64748b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      map.addSource("field-pending-point", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-pending-point",
        type: "circle",
        source: "field-pending-point",
        paint: {
          "circle-radius": 9,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      setReady(true);
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      currentMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [initialCoordinate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    (map.getSource("field-accuracy") as GeoJSONSource | undefined)?.setData(
      current
        ? {
            type: "FeatureCollection",
            features: [createAccuracyCircleGeoJson(current)],
          }
        : EMPTY_FEATURE_COLLECTION,
    );

    if (current) {
      if (!currentMarkerRef.current) {
        const element = document.createElement("div");
        element.className =
          "h-5 w-5 rounded-full border-[3px] border-white bg-sky-600 shadow-lg";
        currentMarkerRef.current = new maplibregl.Marker({ element })
          .setLngLat([current.longitude, current.latitude])
          .addTo(map);
      } else {
        currentMarkerRef.current.setLngLat([
          current.longitude,
          current.latitude,
        ]);
      }
    }

    const calibrationFeatures = calibration
      ? [
          pointFeature(calibration.origin, { kind: "origin" }),
          pointFeature(calibration.directionReference, { kind: "direction" }),
          ...(calibration.widthReference
            ? [pointFeature(calibration.widthReference, { kind: "width" })]
            : []),
        ]
      : [];
    (map.getSource("field-calibration") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: calibrationFeatures,
    });

    (map.getSource("field-placements") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: placements.map((placement) =>
        pointFeature(placement.coordinate, {
          selected: placement.id === guidancePlacementId ? 1 : 0,
          label: placement.targetLabel,
        }),
      ),
    });

    (map.getSource("field-raw-trace") as GeoJSONSource | undefined)?.setData(
      rawTraceCoordinates.length >= 2
        ? {
            type: "FeatureCollection",
            features: [lineFeature(rawTraceCoordinates)],
          }
        : EMPTY_FEATURE_COLLECTION,
    );

    const processedFeature =
      processedTraceCoordinates.length >= 2
        ? captureMode === "Boundary" && processedTraceCoordinates.length >= 4
          ? polygonFeature(processedTraceCoordinates)
          : lineFeature(processedTraceCoordinates)
        : null;
    (
      map.getSource("field-processed-trace") as GeoJSONSource | undefined
    )?.setData(
      processedFeature
        ? { type: "FeatureCollection", features: [processedFeature] }
        : EMPTY_FEATURE_COLLECTION,
    );

    (
      map.getSource("field-rejected-trace") as GeoJSONSource | undefined
    )?.setData({
      type: "FeatureCollection",
      features: rejectedTraceCoordinates.map((sample) =>
        pointFeature(sample.coordinate, { reason: sample.reason }),
      ),
    });

    (map.getSource("field-pending-point") as GeoJSONSource | undefined)?.setData(
      pendingCoordinate
        ? {
            type: "FeatureCollection",
            features: [pointFeature(pendingCoordinate, { kind: "pending" })],
          }
        : EMPTY_FEATURE_COLLECTION,
    );
  }, [
    calibration,
    captureMode,
    current,
    guidancePlacementId,
    pendingCoordinate,
    placements,
    processedTraceCoordinates,
    rawTraceCoordinates,
    ready,
    rejectedTraceCoordinates,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !current || !followOfficer) return;
    map.easeTo({
      center: [current.longitude, current.latitude],
      duration: 350,
    });
  }, [current, followOfficer, ready]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setFollowOfficer((value) => !value);
            if (!followOfficer && current) fitCoordinates([current]);
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black ${
            followOfficer
              ? "border-sky-400 bg-sky-500 text-slate-950"
              : "border-slate-600 bg-slate-800 text-slate-200"
          }`}
          title="Keep the map centred on the officer. Manual panning turns this off."
        >
          <Navigation size={14} />
          {followOfficer ? "Following" : "Follow Officer"}
        </button>
        <button
          type="button"
          onClick={() => fitCoordinates(captureCoordinates)}
          disabled={captureCoordinates.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-40"
          title="Fit the current line or boundary capture in the map."
        >
          <Focus size={14} /> Fit Capture
        </button>
        <button
          type="button"
          onClick={() =>
            fitCoordinates(
              allCoordinates({
                current,
                calibration,
                placements,
                raw: rawTraceCoordinates,
                processed: processedTraceCoordinates,
                pending: pendingCoordinate,
              }),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200"
          title="Fit calibration points, confirmed items, officer position and current capture."
        >
          <MapPinned size={14} /> Fit All
        </button>
        <button
          type="button"
          onClick={() => current && fitCoordinates([current])}
          disabled={!current}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-40"
          title="Return the map to the officer without enabling continuous follow."
        >
          <Crosshair size={14} /> Officer
        </button>
      </div>

      <div className="relative">
        <div ref={containerRef} className="h-[390px] w-full" />
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl bg-slate-950/90 px-3 py-2 text-[10px] font-bold text-slate-200 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span><b className="text-sky-400">●</b> Officer</span>
            <span><b className="text-amber-400">━</b> Raw capture</span>
            <span><b className="text-sky-500">━</b> Processed geometry</span>
            <span><b className="text-slate-400">●</b> Rejected sample</span>
          </div>
        </div>
      </div>
    </>
  );
}
