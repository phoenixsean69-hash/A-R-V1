import { AccidentService } from "../../services/accidentService";
import { JunctionService } from "../../services/junctionService";
import { RiskAnalysisService } from "../../services/riskAnalysisService";
import type { AccidentSummary, Junction } from "../../types/junction";
import type { MapBounds } from "../../types/map";
import type { JunctionRiskAnalysis, RiskLevel } from "../../types/risk";

export interface JunctionMapRecord {
  junction: Junction;
  summary: AccidentSummary;
  risk: JunctionRiskAnalysis;
}

function isInsideBounds(junction: Junction, bounds?: MapBounds): boolean {
  if (!bounds) return true;
  return (
    junction.latitude >= bounds.south &&
    junction.latitude <= bounds.north &&
    junction.longitude >= bounds.west &&
    junction.longitude <= bounds.east
  );
}

export function getRiskColour(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "High":
      return "#dc2626";
    case "Medium":
      return "#f59e0b";
    case "Low":
      return "#16a34a";
  }
}

function formatDate(dateValue: string): string {
  if (!dateValue) return "No records";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getJunctionMapRecords(bounds?: MapBounds): JunctionMapRecord[] {
  return JunctionService.getAll()
    .filter((junction) => isInsideBounds(junction, bounds))
    .map((junction) => ({
      junction,
      summary: AccidentService.getSummary(junction.id),
      risk: RiskAnalysisService.analyseJunction(junction.id),
    }));
}

export function createJunctionMarkerElement(
  record: JunctionMapRecord,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.title = `${record.junction.name} — ${record.risk.riskLevel} risk`;
  button.setAttribute(
    "aria-label",
    `${record.junction.name}, ${record.risk.riskLevel} risk`,
  );
  button.className = "roadsafe-google-junction-marker";

  const dot = document.createElement("span");
  dot.className = "roadsafe-google-junction-marker__dot";
  dot.style.backgroundColor = getRiskColour(record.risk.riskLevel);
  button.appendChild(dot);
  return button;
}

function createRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.gap = "16px";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  labelElement.style.fontSize = "12px";
  labelElement.style.color = "#64748b";

  const valueElement = document.createElement("span");
  valueElement.textContent = value;
  valueElement.style.fontSize = "12px";
  valueElement.style.fontWeight = "700";
  valueElement.style.textAlign = "right";
  valueElement.style.color = "#0f172a";

  row.append(labelElement, valueElement);
  return row;
}

function createStatCard(label: string, value: number): HTMLDivElement {
  const card = document.createElement("div");
  card.style.padding = "9px";
  card.style.textAlign = "center";
  card.style.borderRadius = "9px";
  card.style.border = "1px solid #dbe3ef";
  card.style.background = "#f8fafc";

  const valueElement = document.createElement("p");
  valueElement.textContent = value.toString();
  valueElement.style.margin = "0";
  valueElement.style.fontSize = "18px";
  valueElement.style.fontWeight = "800";
  valueElement.style.color = "#0f172a";

  const labelElement = document.createElement("p");
  labelElement.textContent = label;
  labelElement.style.margin = "2px 0 0";
  labelElement.style.fontSize = "10px";
  labelElement.style.color = "#64748b";

  card.append(valueElement, labelElement);
  return card;
}

export function createJunctionInfoContent(
  record: JunctionMapRecord,
  onViewFullAnalysis?: (junctionId: string) => void,
): HTMLDivElement {
  const { junction, summary, risk } = record;
  const container = document.createElement("div");
  container.style.minWidth = "280px";
  container.style.maxWidth = "340px";
  container.style.padding = "8px";
  container.style.fontFamily = "Inter, ui-sans-serif, system-ui, sans-serif";

  const heading = document.createElement("h3");
  heading.textContent = junction.name;
  heading.style.margin = "0";
  heading.style.fontSize = "16px";
  heading.style.fontWeight = "800";
  heading.style.color = "#0f172a";

  const location = document.createElement("p");
  location.textContent = `${junction.city} • ${junction.roadType}`;
  location.style.margin = "4px 0 12px";
  location.style.fontSize = "12px";
  location.style.color = "#64748b";

  const riskBox = document.createElement("div");
  riskBox.style.display = "flex";
  riskBox.style.alignItems = "center";
  riskBox.style.justifyContent = "space-between";
  riskBox.style.padding = "10px";
  riskBox.style.borderRadius = "9px";
  riskBox.style.background = "#f8fafc";
  riskBox.style.border = "1px solid #dbe3ef";

  const riskLabel = document.createElement("strong");
  riskLabel.textContent = `${risk.riskLevel} risk`;
  riskLabel.style.color = getRiskColour(risk.riskLevel);

  const riskScore = document.createElement("strong");
  riskScore.textContent = `Score ${risk.riskScore}`;
  riskScore.style.color = "#0f172a";
  riskBox.append(riskLabel, riskScore);

  const statistics = document.createElement("div");
  statistics.style.display = "grid";
  statistics.style.gridTemplateColumns = "repeat(3, 1fr)";
  statistics.style.gap = "7px";
  statistics.style.margin = "12px 0";
  statistics.append(
    createStatCard("Accidents", summary.totalAccidents),
    createStatCard("Fatalities", summary.fatalities),
    createStatCard("Injuries", summary.injuries),
  );

  const details = document.createElement("div");
  details.style.display = "grid";
  details.style.gap = "8px";
  details.append(
    createRow("Common cause", summary.commonCause),
    createRow("Latest record", formatDate(summary.lastUpdated)),
  );

  container.append(heading, location, riskBox, statistics, details);

  if (onViewFullAnalysis) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "View full analysis";
    button.style.width = "100%";
    button.style.marginTop = "14px";
    button.style.padding = "10px 14px";
    button.style.border = "none";
    button.style.borderRadius = "9px";
    button.style.background = "#1d4ed8";
    button.style.color = "#ffffff";
    button.style.fontSize = "12px";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onViewFullAnalysis(junction.id);
    });
    container.appendChild(button);
  }

  return container;
}
