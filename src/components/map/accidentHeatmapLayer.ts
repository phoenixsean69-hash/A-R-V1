import type {
  GeoJSONSource,
  HeatmapLayerSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";

import {
  AccidentService,
} from "../../services/accidentService";

import {
  AccidentFilterService,
} from "../../services/accidentFilterService";

import {
  JunctionService,
} from "../../services/junctionService";

import type {
  Accident,
} from "../../types/accident";

import type {
  AccidentHeatmapFilters,
} from "../../types/heatmap";

import {
  createDefaultHeatmapFilters,
} from "../../types/heatmap";

import type {
  Junction,
} from "../../types/junction";

import type {
  MapBounds,
} from "../../types/map";

const ACCIDENT_HEATMAP_SOURCE_ID =
  "accident-heatmap-source";

const ACCIDENT_HEATMAP_LAYER_ID =
  "accident-heatmap-layer";

export interface AccidentHeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

interface AccidentHeatmapProperties {
  accidentId: string;
  junctionId: string;
  junctionName: string;
  severity: Accident["severity"];
  fatalities: number;
  injuries: number;
  cause: string;
  weather: string;
  date: string;
  weight: number;
}

interface AccidentHeatmapFeatureCollection {
  type: "FeatureCollection";

  features: Array<{
    type: "Feature";

    properties:
      AccidentHeatmapProperties;

    geometry: {
      type: "Point";

      coordinates: [
        number,
        number,
      ];
    };
  }>;
}

function isJunctionInsideBounds(
  junction: Junction,
  bounds?: MapBounds,
): boolean {
  if (!bounds) {
    return true;
  }

  return (
    junction.latitude >=
      bounds.south &&
    junction.latitude <=
      bounds.north &&
    junction.longitude >=
      bounds.west &&
    junction.longitude <=
      bounds.east
  );
}

function calculateAccidentWeight(
  accident: Accident,
): number {
  let severityWeight = 2;

  if (
    accident.severity ===
    "Serious"
  ) {
    severityWeight = 5;
  }

  if (
    accident.severity ===
    "Fatal"
  ) {
    severityWeight = 9;
  }

  const calculatedWeight =
    severityWeight +
    accident.fatalities * 5 +
    accident.injuries * 1.5 +
    accident.vehiclesInvolved *
      0.5;

  return Math.min(
    Number(
      calculatedWeight.toFixed(
        2,
      ),
    ),
    20,
  );
}

function createHeatmapData(
  bounds?: MapBounds,
  filters: AccidentHeatmapFilters =
    createDefaultHeatmapFilters(),
): AccidentHeatmapFeatureCollection {
  const filteredAccidents =
    AccidentFilterService.filter(
      AccidentService.getAll(),
      filters,
    );

  const features:
    AccidentHeatmapFeatureCollection["features"] =
      [];

  filteredAccidents.forEach(
    (accident) => {
      const junction =
        JunctionService.getById(
          accident.junctionId,
        );

      if (!junction) {
        return;
      }

      if (
        !isJunctionInsideBounds(
          junction,
          bounds,
        )
      ) {
        return;
      }

      features.push({
        type: "Feature",

        properties: {
          accidentId:
            accident.id,

          junctionId:
            junction.id,

          junctionName:
            junction.name,

          severity:
            accident.severity,

          fatalities:
            accident.fatalities,

          injuries:
            accident.injuries,

          cause:
            accident.cause,

          weather:
            accident.weather,

          date:
            accident.date,

          weight:
            calculateAccidentWeight(
              accident,
            ),
        },

        geometry: {
          type: "Point",

          coordinates: [
            junction.longitude,
            junction.latitude,
          ],
        },
      });
    },
  );

  return {
    type: "FeatureCollection",
    features,
  };
}

function createHeatmapLayer():
  HeatmapLayerSpecification {
  return {
    id:
      ACCIDENT_HEATMAP_LAYER_ID,

    type: "heatmap",

    source:
      ACCIDENT_HEATMAP_SOURCE_ID,

    minzoom: 5,

    maxzoom: 19,

    layout: {
      visibility: "none",
    },

    paint: {
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "weight"],

        0,
        0,

        5,
        0.35,

        10,
        0.7,

        20,
        1,
      ],

      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],

        5,
        0.5,

        12,
        1,

        15,
        1.5,

        18,
        2.3,
      ],

      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],

        5,
        10,

        12,
        22,

        15,
        35,

        18,
        55,
      ],

      "heatmap-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],

        5,
        0.65,

        12,
        0.78,

        18,
        0.9,
      ],

      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],

        0,
        "rgba(33, 102, 172, 0)",

        0.15,
        "rgb(103, 169, 207)",

        0.3,
        "rgb(50, 205, 170)",

        0.5,
        "rgb(255, 255, 0)",

        0.7,
        "rgb(255, 165, 0)",

        0.85,
        "rgb(239, 68, 68)",

        1,
        "rgb(127, 29, 29)",
      ],
    },
  };
}

export function ensureAccidentHeatmapLayers(
  map: MapLibreMap,
  bounds?: MapBounds,
  filters: AccidentHeatmapFilters =
    createDefaultHeatmapFilters(),
  beforeLayerId?: string,
): void {
  if (!map.isStyleLoaded()) {
    return;
  }

  const data =
    createHeatmapData(
      bounds,
      filters,
    );

  const existingSource =
    map.getSource(
      ACCIDENT_HEATMAP_SOURCE_ID,
    ) as
      | GeoJSONSource
      | undefined;

  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(
      ACCIDENT_HEATMAP_SOURCE_ID,
      {
        type: "geojson",
        data,
      },
    );
  }

  if (
    map.getLayer(
      ACCIDENT_HEATMAP_LAYER_ID,
    )
  ) {
    return;
  }

  const heatmapLayer =
    createHeatmapLayer();

  if (
    beforeLayerId &&
    map.getLayer(beforeLayerId)
  ) {
    map.addLayer(
      heatmapLayer,
      beforeLayerId,
    );

    return;
  }

  map.addLayer(
    heatmapLayer,
  );
}

export function setAccidentHeatmapVisibility(
  map: MapLibreMap,
  visible: boolean,
): void {
  if (
    !map.getLayer(
      ACCIDENT_HEATMAP_LAYER_ID,
    )
  ) {
    return;
  }

  map.setLayoutProperty(
    ACCIDENT_HEATMAP_LAYER_ID,
    "visibility",
    visible
      ? "visible"
      : "none",
  );
}