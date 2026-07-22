import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

import type {
  FieldPlacementRecord,
  FieldSceneCalibration,
  GeoCoordinate,
} from "../../types/fieldPlacement";
import { createAccuracyCircleGeoJson } from "../../utils/geographicCoordinates";

interface FieldPlacementMapProps {
  current: GeoCoordinate | null;
  calibration?: FieldSceneCalibration;
  placements: FieldPlacementRecord[];
  traceCoordinates: GeoCoordinate[];
  guidancePlacementId: string | null;
}

const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [],
};

function pointFeature(
  coordinate: Pick<GeoCoordinate, "latitude" | "longitude">,
  properties: Record<string, string | number>,
) {
  return {
    type: "Feature" as const,
    properties,
    geometry: {
      type: "Point" as const,
      coordinates: [coordinate.longitude, coordinate.latitude],
    },
  };
}

export default function FieldPlacementMap({
  current,
  calibration,
  placements,
  traceCoordinates,
  guidancePlacementId,
}: FieldPlacementMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentMarkerRef = useRef<MapLibreMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initial = current ?? calibration?.origin;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: initial
        ? [initial.longitude, initial.latitude]
        : [31.336976, -17.311182],
      zoom: initial ? 18 : 14,
      maxZoom: 20,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("field-accuracy", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-accuracy-fill",
        type: "fill",
        source: "field-accuracy",
        paint: {
          "fill-color": "#0ea5e9",
          "fill-opacity": 0.14,
        },
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
            "#9333ea",
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
            "#dc2626",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addSource("field-trace", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "field-trace-line",
        type: "line",
        source: "field-trace",
        paint: {
          "line-color": "#7c3aed",
          "line-width": 5,
          "line-opacity": 0.85,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      });
    });

    mapRef.current = map;

    return () => {
      currentMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const accuracySource = map.getSource(
      "field-accuracy",
    ) as GeoJSONSource | undefined;
    accuracySource?.setData(
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

    (
      map.getSource("field-calibration") as
        | GeoJSONSource
        | undefined
    )?.setData({
      type: "FeatureCollection",
      features: calibrationFeatures,
    });

    (
      map.getSource("field-placements") as
        | GeoJSONSource
        | undefined
    )?.setData({
      type: "FeatureCollection",
      features: placements.map((placement) =>
        pointFeature(placement.coordinate, {
          selected: placement.id === guidancePlacementId ? 1 : 0,
          label: placement.targetLabel,
        }),
      ),
    });

    (
      map.getSource("field-trace") as GeoJSONSource | undefined
    )?.setData(
      traceCoordinates.length >= 2
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: traceCoordinates.map((coordinate) => [
                    coordinate.longitude,
                    coordinate.latitude,
                  ]),
                },
              },
            ],
          }
        : EMPTY_FEATURE_COLLECTION,
    );

    if (current) {
      map.easeTo({
        center: [current.longitude, current.latitude],
        zoom: Math.max(map.getZoom(), 18),
        duration: 500,
      });
    }
  }, [
    calibration,
    current,
    guidancePlacementId,
    placements,
    traceCoordinates,
  ]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
      <div ref={containerRef} className="h-[320px] w-full" />
    </div>
  );
}
