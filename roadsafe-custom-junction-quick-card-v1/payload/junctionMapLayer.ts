import maplibregl from "maplibre-gl";

import type {
  Map as MapLibreMap,
} from "maplibre-gl";

import {
  JunctionService,
} from "../../services/junctionService";

import {
  RiskAnalysisService,
} from "../../services/riskAnalysisService";

import type {
  Junction,
} from "../../types/junction";

import type {
  MapBounds,
} from "../../types/map";

import type {
  JunctionRiskAnalysis,
  RiskLevel,
} from "../../types/risk";

function isJunctionInsideBounds(
  junction: Junction,
  bounds?: MapBounds,
): boolean {
  if (!bounds) {
    return true;
  }

  return (
    junction.latitude >= bounds.south &&
    junction.latitude <= bounds.north &&
    junction.longitude >= bounds.west &&
    junction.longitude <= bounds.east
  );
}

function getRiskColour(
  riskLevel: RiskLevel,
): string {
  switch (riskLevel) {
    case "High":
      return "#dc2626";

    case "Medium":
      return "#f59e0b";

    case "Low":
      return "#16a34a";
  }
}

function createMarkerElement(
  junction: Junction,
  risk: JunctionRiskAnalysis,
  onJunctionSelect?: (
    junctionId: string,
  ) => void,
): HTMLButtonElement {
  const button =
    document.createElement("button");

  button.type = "button";

  button.title =
    `${junction.name} — ${risk.riskLevel} Risk`;

  button.setAttribute(
    "aria-label",
    `${junction.name}, ${risk.riskLevel} risk`,
  );

  button.style.width = "42px";
  button.style.height = "42px";
  button.style.padding = "0";
  button.style.border = "none";
  button.style.background =
    "transparent";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent =
    "center";
  button.style.cursor = "pointer";

  const marker =
    document.createElement("span");

  marker.style.width = "27px";
  marker.style.height = "27px";
  marker.style.borderRadius =
    "9999px";
  marker.style.border =
    "3px solid #f8fafc";

  marker.style.backgroundColor =
    getRiskColour(
      risk.riskLevel,
    );

  marker.style.boxShadow =
    "0 4px 14px rgba(0,0,0,0.55)";

  marker.style.transition =
    "transform 150ms ease, box-shadow 150ms ease";

  button.appendChild(marker);

  button.addEventListener(
    "mouseenter",
    () => {
      marker.style.transform =
        "scale(1.28)";
      marker.style.boxShadow =
        "0 6px 18px rgba(0,0,0,0.68)";
    },
  );

  button.addEventListener(
    "mouseleave",
    () => {
      marker.style.transform =
        "scale(1)";
      marker.style.boxShadow =
        "0 4px 14px rgba(0,0,0,0.55)";
    },
  );

  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      onJunctionSelect?.(
        junction.id,
      );
    },
  );

  return button;
}

export function addJunctionMarkers(
  map: MapLibreMap,
  bounds?: MapBounds,
  onJunctionSelect?: (
    junctionId: string,
  ) => void,
): () => void {
  const junctions =
    JunctionService
      .getAll()
      .filter((junction) =>
        isJunctionInsideBounds(
          junction,
          bounds,
        ),
      );

  const markers:
    maplibregl.Marker[] = [];

  junctions.forEach(
    (junction) => {
      const risk =
        RiskAnalysisService
          .analyseJunction(
            junction.id,
          );

      const marker =
        new maplibregl.Marker({
          element:
            createMarkerElement(
              junction,
              risk,
              onJunctionSelect,
            ),

          anchor: "center",
        })
          .setLngLat([
            junction.longitude,
            junction.latitude,
          ])
          .addTo(map);

      markers.push(marker);
    },
  );

  return () => {
    markers.forEach((marker) => {
      marker.remove();
    });
  };
}
