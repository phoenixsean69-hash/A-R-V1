import maplibregl from "maplibre-gl";

import type {
  Map as MapLibreMap,
} from "maplibre-gl";

import {
  AccidentService,
} from "../../services/accidentService";

import {
  JunctionService,
} from "../../services/junctionService";

import {
  RiskAnalysisService,
} from "../../services/riskAnalysisService";

import type {
  AccidentSummary,
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

function formatDate(
  dateValue: string,
): string {
  if (!dateValue) {
    return "No records";
  }

  const date = new Date(
    `${dateValue}T00:00:00`,
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function createMarkerElement(
  junction: Junction,
  risk: JunctionRiskAnalysis,
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
    "3px solid white";

  marker.style.backgroundColor =
    getRiskColour(
      risk.riskLevel,
    );

  marker.style.boxShadow =
    "0 3px 10px rgba(0,0,0,0.45)";

  marker.style.transition =
    "transform 150ms ease";

  button.appendChild(marker);

  button.addEventListener(
    "mouseenter",
    () => {
      marker.style.transform =
        "scale(1.35)";
    },
  );

  button.addEventListener(
    "mouseleave",
    () => {
      marker.style.transform =
        "scale(1)";
    },
  );

  return button;
}

function createRow(
  label: string,
  value: string,
): HTMLDivElement {
  const row =
    document.createElement("div");

  row.style.display = "flex";
  row.style.justifyContent =
    "space-between";
  row.style.gap = "16px";

  const labelElement =
    document.createElement("span");

  labelElement.textContent = label;
  labelElement.style.fontSize =
    "13px";
  labelElement.style.color =
    "#6b7280";

  const valueElement =
    document.createElement("span");

  valueElement.textContent = value;
  valueElement.style.fontSize =
    "13px";
  valueElement.style.fontWeight =
    "700";
  valueElement.style.textAlign =
    "right";
  valueElement.style.color =
    "#111827";

  row.append(
    labelElement,
    valueElement,
  );

  return row;
}

function createStatCard(
  label: string,
  value: number,
): HTMLDivElement {
  const card =
    document.createElement("div");

  card.style.padding = "9px";
  card.style.textAlign = "center";
  card.style.borderRadius = "9px";
  card.style.border =
    "1px solid #e5e7eb";
  card.style.background =
    "#f9fafb";

  const valueElement =
    document.createElement("p");

  valueElement.textContent =
    value.toString();

  valueElement.style.margin = "0";
  valueElement.style.fontSize =
    "19px";
  valueElement.style.fontWeight =
    "800";

  const labelElement =
    document.createElement("p");

  labelElement.textContent = label;

  labelElement.style.margin =
    "2px 0 0";
  labelElement.style.fontSize =
    "11px";
  labelElement.style.color =
    "#6b7280";

  card.append(
    valueElement,
    labelElement,
  );

  return card;
}

function createPopupContent(
  junction: Junction,
  summary: AccidentSummary,
  risk: JunctionRiskAnalysis,
  onViewFullAnalysis?: (
    junctionId: string,
  ) => void,
): HTMLDivElement {
  const container =
    document.createElement("div");

  container.style.minWidth = "290px";
  container.style.maxWidth = "340px";
  container.style.padding = "6px";

  const heading =
    document.createElement("h3");

  heading.textContent =
    junction.name;

  heading.style.margin = "0";
  heading.style.fontSize = "17px";
  heading.style.fontWeight = "800";
  heading.style.color = "#111827";

  const location =
    document.createElement("p");

  location.textContent =
    `${junction.city} • ${junction.roadType}`;

  location.style.margin =
    "4px 0 12px";
  location.style.fontSize = "13px";
  location.style.color = "#6b7280";

  const riskBox =
    document.createElement("div");

  riskBox.style.display = "flex";
  riskBox.style.alignItems = "center";
  riskBox.style.justifyContent =
    "space-between";
  riskBox.style.padding = "10px";
  riskBox.style.borderRadius = "9px";
  riskBox.style.background =
    "#f9fafb";
  riskBox.style.border =
    "1px solid #e5e7eb";

  const riskLabel =
    document.createElement("strong");

  riskLabel.textContent =
    `${risk.riskLevel} Risk`;

  riskLabel.style.color =
    getRiskColour(
      risk.riskLevel,
    );

  const riskScore =
    document.createElement("strong");

  riskScore.textContent =
    `Score: ${risk.riskScore}`;

  riskBox.append(
    riskLabel,
    riskScore,
  );

  const statistics =
    document.createElement("div");

  statistics.style.display = "grid";

  statistics.style.gridTemplateColumns =
    "repeat(3, 1fr)";

  statistics.style.gap = "7px";
  statistics.style.margin =
    "12px 0";

  statistics.append(
    createStatCard(
      "Accidents",
      summary.totalAccidents,
    ),

    createStatCard(
      "Fatalities",
      summary.fatalities,
    ),

    createStatCard(
      "Injuries",
      summary.injuries,
    ),
  );

  const details =
    document.createElement("div");

  details.style.display = "grid";
  details.style.gap = "8px";

  details.append(
    createRow(
      "Common cause",
      summary.commonCause,
    ),

    createRow(
      "Latest record",
      formatDate(
        summary.lastUpdated,
      ),
    ),
  );

  container.append(
    heading,
    location,
    riskBox,
    statistics,
    details,
  );

  if (onViewFullAnalysis) {
    const fullAnalysisButton =
      document.createElement("button");

    fullAnalysisButton.type =
      "button";

    fullAnalysisButton.textContent =
      "View Full Analysis";

    fullAnalysisButton.style.width =
      "100%";

    fullAnalysisButton.style.marginTop =
      "14px";

    fullAnalysisButton.style.padding =
      "10px 14px";

    fullAnalysisButton.style.border =
      "none";

    fullAnalysisButton.style.borderRadius =
      "9px";

    fullAnalysisButton.style.background =
      "#2563eb";

    fullAnalysisButton.style.color =
      "#ffffff";

    fullAnalysisButton.style.fontSize =
      "13px";

    fullAnalysisButton.style.fontWeight =
      "700";

    fullAnalysisButton.style.cursor =
      "pointer";

    fullAnalysisButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        onViewFullAnalysis(
          junction.id,
        );
      },
    );

    container.appendChild(
      fullAnalysisButton,
    );
  }

  return container;
}

export function addJunctionMarkers(
  map: MapLibreMap,
  bounds?: MapBounds,
  onViewFullAnalysis?: (
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
      const summary =
        AccidentService.getSummary(
          junction.id,
        );

      const risk =
        RiskAnalysisService
          .analyseJunction(
            junction.id,
          );

      const popup =
        new maplibregl.Popup({
          offset: 23,
          closeButton: true,
          closeOnClick: true,
          maxWidth: "380px",
        }).setDOMContent(
          createPopupContent(
            junction,
            summary,
            risk,
            onViewFullAnalysis,
          ),
        );

      const marker =
        new maplibregl.Marker({
          element:
            createMarkerElement(
              junction,
              risk,
            ),

          anchor: "center",
        })
          .setLngLat([
            junction.longitude,
            junction.latitude,
          ])
          .setPopup(popup)
          .addTo(map);

      markers.push(marker);
    },
  );

  return () => {
    markers.forEach((marker) => {
      marker.getPopup()?.remove();
      marker.remove();
    });
  };
}