import type { AccidentCase } from "../types/accidentCase";
import type { ReconstructionFootage } from "../types/reconstructionFootage";
import { ReconstructionFootageService } from "./reconstructionFootageService";
import type {
  AccidentReconstruction,
  AccidentTimelineEvent,
  MovementPathPoint,
  ReconstructionVehicle,
} from "../types/reconstruction";

export interface ReportTimelineEntry {
  id: string;
  timeSeconds: number;
  title: string;
  description: string;
  source: "Movement" | "Manual";
}

export interface AccidentReportModel {
  accidentCase: AccidentCase;
  reconstruction: AccidentReconstruction | null;
  footage: ReconstructionFootage[];
  narrative: string[];
  timeline: ReportTimelineEntry[];
  findings: string[];
  recommendations: string[];
  limitations: string[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSeconds(value: number): string {
  return `${Number(value.toFixed(2))} seconds`;
}

function describeMovementPoint(
  participant: ReconstructionVehicle,
  point: MovementPathPoint,
): string {
  const speedText =
    point.speedKmh > 0
      ? ` at an estimated ${Number(point.speedKmh.toFixed(1))} km/h`
      : "";

  const noteText = point.notes?.trim() ? ` ${point.notes.trim()}` : "";

  return `${participant.name} performed the action “${point.action}” at approximately ${formatSeconds(
    point.timeSeconds,
  )}${speedText}.${noteText}`;
}

function buildNarrative(reconstruction: AccidentReconstruction | null): string[] {
  if (!reconstruction) {
    return ["No reconstruction has been linked to this accident case."];
  }

  const paragraphs: string[] = [];

  reconstruction.vehicles.forEach((participant) => {
    const origin = participant.originLocation.trim() || "an unspecified origin";
    const destination =
      participant.destinationLocation.trim() || "an unspecified destination";

    paragraphs.push(
      `${participant.name}, recorded as a ${participant.type.toLowerCase()}, came from ${origin} and was heading towards ${destination}. The participant's default estimated speed was ${participant.estimatedSpeedKmh} km/h.`,
    );

    [...participant.pathPoints]
      .sort((left, right) => left.timeSeconds - right.timeSeconds)
      .forEach((point) => paragraphs.push(describeMovementPoint(participant, point)));
  });

  if (reconstruction.timelineEvents.length > 0) {
    paragraphs.push(
      "The investigator also recorded manual accident-sequence events which are listed in the complete timeline below.",
    );
  }

  return paragraphs;
}

function getTimeline(
  reconstruction: AccidentReconstruction | null,
): ReportTimelineEntry[] {
  if (!reconstruction) return [];

  const movementEntries: ReportTimelineEntry[] = reconstruction.vehicles.flatMap(
    (participant) =>
      participant.pathPoints.map((point) => ({
        id: `movement-${participant.id}-${point.id}`,
        timeSeconds: point.timeSeconds,
        title: `${participant.name}: ${point.action}`,
        description: point.label || point.notes || "Participant movement point",
        source: "Movement" as const,
      })),
  );

  const manualEntries: ReportTimelineEntry[] = reconstruction.timelineEvents.map(
    (event: AccidentTimelineEvent) => ({
      id: `manual-${event.id}`,
      timeSeconds: event.timeSeconds,
      title: event.title,
      description: event.description,
      source: "Manual" as const,
    }),
  );

  return [...movementEntries, ...manualEntries].sort(
    (left, right) => left.timeSeconds - right.timeSeconds,
  );
}

function getFindings(reconstruction: AccidentReconstruction | null): string[] {
  if (!reconstruction) return ["The reconstruction has not yet been created."];

  const findings: string[] = [];
  const impactPoints = reconstruction.vehicles.flatMap((participant) =>
    participant.pathPoints.filter((point) => point.action === "Impact"),
  );

  findings.push(
    `${reconstruction.vehicles.length} participant(s), ${reconstruction.sceneObjects.length} scene object(s), ${reconstruction.evidenceRecords.length} evidence record(s), and ${reconstruction.measurements.length} measurement(s) were documented.`,
  );

  if (reconstruction.fieldCalibration) {
    findings.push(
      `The physical scene was GPS-calibrated at a road bearing of ${reconstruction.fieldCalibration.rotationDegrees.toFixed(1)} degrees using a ${reconstruction.fieldCalibration.directionReferenceDistanceMetres.toFixed(1)} metre direction reference.`,
    );
  }

  if (reconstruction.fieldPlacements.length > 0) {
    findings.push(
      `${reconstruction.fieldPlacements.length} participant, object, evidence or measurement position(s) were confirmed on site using field GPS placement.`,
    );
  }

  if (reconstruction.fieldWalkingTracks.length > 0) {
    findings.push(
      `${reconstruction.fieldWalkingTracks.length} route or evidence trace(s) were recorded by walking the physical scene.`,
    );
  }

  if (impactPoints.length > 0) {
    const earliestImpact = Math.min(...impactPoints.map((point) => point.timeSeconds));
    findings.push(
      `The earliest explicitly recorded impact occurred at approximately ${formatSeconds(
        earliestImpact,
      )}.`,
    );
  }

  const hazards = reconstruction.sceneObjects.filter((object) =>
    [
      "Pothole",
      "Road Crack",
      "Puddle",
      "Oil Spill",
      "Loose Gravel",
      "Debris",
      "Fallen Branch",
    ].includes(object.type),
  );

  if (hazards.length > 0) {
    findings.push(
      `${hazards.length} road hazard(s) were represented in the reconstructed scene: ${hazards
        .map((object) => object.label)
        .join(", ")}.`,
    );
  }

  const aboveLimit = reconstruction.vehicles.filter((participant) =>
    participant.pathPoints.some(
      (point) => point.speedKmh > reconstruction.scene.speedLimitKmh,
    ),
  );

  if (aboveLimit.length > 0) {
    findings.push(
      `${aboveLimit.map((participant) => participant.name).join(", ")} had at least one movement point above the configured ${reconstruction.scene.speedLimitKmh} km/h speed limit.`,
    );
  }

  return findings;
}

function getRecommendations(
  reconstruction: AccidentReconstruction | null,
): string[] {
  if (!reconstruction) {
    return ["Complete the reconstruction before producing intervention advice."];
  }

  const recommendations = new Set<string>();
  const types = new Set(reconstruction.sceneObjects.map((object) => object.type));

  if (types.has("Pothole") || types.has("Road Crack")) {
    recommendations.add(
      "Repair documented potholes and damaged road surfaces, then verify the repaired area through a follow-up inspection.",
    );
  }

  if (
    reconstruction.scene.weather === "Rain" ||
    reconstruction.scene.roadSurface === "Wet" ||
    types.has("Puddle")
  ) {
    recommendations.add(
      "Inspect drainage and road-surface friction, especially around water-collection and braking areas.",
    );
  }

  if (
    reconstruction.scene.timeOfDay === "Night" ||
    reconstruction.scene.visibility !== "Good"
  ) {
    recommendations.add(
      "Improve lighting, visibility and warning signage at the accident location.",
    );
  }

  if (
    reconstruction.vehicles.some((participant) =>
      participant.pathPoints.some(
        (point) => point.speedKmh > reconstruction.scene.speedLimitKmh,
      ),
    )
  ) {
    recommendations.add(
      "Review speed management measures, including visible speed-limit signs, traffic calming and enforcement.",
    );
  }

  if (
    reconstruction.vehicles.some(
      (participant) => participant.type === "Pedestrian",
    )
  ) {
    recommendations.add(
      "Review pedestrian crossing facilities, warning signs, pavement continuity and protection from vehicle movements.",
    );
  }

  if (recommendations.size === 0) {
    recommendations.add(
      "Conduct an on-site engineering inspection before selecting a permanent road-safety intervention.",
    );
  }

  return Array.from(recommendations);
}

function getLimitations(): string[] {
  return [
    "This report is generated from investigator-entered data and does not independently prove the exact accident sequence.",
    "Estimated speeds, timing, positions and movement paths should be verified against physical evidence, witness accounts and official records.",
    "The current two-dimensional reconstruction does not yet run a validated collision-physics model.",
    "Browser local storage is suitable for prototype testing but not for production evidence custody or long-term police records.",
    "Phone GPS accuracy varies with the device, satellite visibility and surrounding buildings. Every field placement must be interpreted together with its recorded accuracy radius and sample count.",
  ];
}

function downloadBlob(filename: string, content: BlobPart, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildWordHtml(report: AccidentReportModel): string {
  const { accidentCase, reconstruction, footage } = report;

  const list = (items: string[]) =>
    `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

  const participantRows = reconstruction?.vehicles
    .map(
      (participant) => `<tr>
        <td>${escapeHtml(participant.name)}</td>
        <td>${escapeHtml(participant.type)}</td>
        <td>${escapeHtml(participant.originLocation || "Not recorded")}</td>
        <td>${escapeHtml(participant.destinationLocation || "Not recorded")}</td>
        <td>${participant.estimatedSpeedKmh} km/h</td>
      </tr>`,
    )
    .join("") ?? "";

  const timelineRows = report.timeline
    .map(
      (entry) => `<tr>
        <td>${entry.timeSeconds.toFixed(2)}s</td>
        <td>${escapeHtml(entry.title)}</td>
        <td>${escapeHtml(entry.description)}</td>
      </tr>`,
    )
    .join("");

  const fieldPlacementRows = reconstruction?.fieldPlacements
    .map(
      (placement) => `<tr>
        <td>${escapeHtml(placement.targetLabel)}</td>
        <td>${placement.coordinate.latitude.toFixed(7)}, ${placement.coordinate.longitude.toFixed(7)}</td>
        <td>±${(placement.estimatedUncertaintyMetres ?? placement.averageAccuracyMetres).toFixed(1)}m${placement.observedSpreadMetres === undefined ? "" : `; spread ${placement.observedSpreadMetres.toFixed(1)}m`}</td>
        <td>${escapeHtml(placement.method)}${placement.rejectedSamples?.length ? `; ${placement.rejectedSamples.length} rejected sample(s)` : ""}${placement.acceptedPoorAccuracy ? " (poor accuracy accepted)" : ""}</td>
        <td>${escapeHtml(placement.confirmedBy || "Not recorded")}</td>
      </tr>`,
    )
    .join("") ?? "";

  const walkingTrackRows = reconstruction?.fieldWalkingTracks
    .map(
      (track) => `<tr>
        <td>${escapeHtml(track.targetLabel)}</td>
        <td>${escapeHtml(track.captureMode ?? "Line")} · ${track.coordinates.length} processed${track.rejectedCoordinates?.length ? ` · ${track.rejectedCoordinates.length} rejected` : ""}</td>
        <td>${track.distanceMetres.toFixed(2)}m${track.areaSquareMetres === undefined ? "" : `; ${track.areaSquareMetres.toFixed(2)}m²`}</td>
        <td>±${(track.estimatedUncertaintyMetres ?? track.averageAccuracyMetres).toFixed(1)}m</td>
        <td>${escapeHtml(track.recordedBy || "Not recorded")}</td>
      </tr>`,
    )
    .join("") ?? "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(accidentCase.caseNumber)} Accident Report</title>
<style>
body { font-family: Rubik, Arial, sans-serif; color: #111827; line-height: 1.5; }
h1, h2 { color: #1e3a8a; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; }
th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
th { background: #eff6ff; }
.meta { background: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; }
</style>
</head>
<body>
<h1>RoadSafe AR Accident Reconstruction Report</h1>
<div class="meta">
<p><strong>Case Number:</strong> ${escapeHtml(accidentCase.caseNumber)}</p>
<p><strong>Title:</strong> ${escapeHtml(accidentCase.title)}</p>
<p><strong>Date and Time:</strong> ${escapeHtml(accidentCase.accidentDate)} ${escapeHtml(accidentCase.accidentTime)}</p>
<p><strong>Location:</strong> ${escapeHtml(accidentCase.location)}</p>
<p><strong>Investigating Officer:</strong> ${escapeHtml(accidentCase.investigatingOfficer || "Not recorded")}</p>
<p><strong>Police Station:</strong> ${escapeHtml(accidentCase.policeStation || "Not recorded")}</p>
<p><strong>Status:</strong> ${escapeHtml(accidentCase.status)}</p>
</div>
<h2>Case Summary</h2>
<p>${escapeHtml(accidentCase.summary || "No case summary recorded.")}</p>
<h2>Scene Conditions</h2>
<p>${reconstruction ? `${escapeHtml(reconstruction.scene.roadLayout)}, ${reconstruction.scene.laneCount} lane(s), ${escapeHtml(reconstruction.scene.drivingSide)}-hand driving, ${escapeHtml(reconstruction.scene.weather)} weather, ${escapeHtml(reconstruction.scene.roadSurface)} road surface, ${escapeHtml(reconstruction.scene.visibility)} visibility.` : "No reconstruction available."}</p>
<h2>Participants</h2>
<table><thead><tr><th>Name</th><th>Type</th><th>Came From</th><th>Heading To</th><th>Default Speed</th></tr></thead><tbody>${participantRows}</tbody></table>
<h2>Generated Accident Narrative</h2>
${report.narrative.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
<h2>Accident Timeline</h2>
<table><thead><tr><th>Time</th><th>Event</th><th>Description</th></tr></thead><tbody>${timelineRows}</tbody></table>
<h2>Reconstruction Footage</h2>
${footage.length > 0 ? `<ul>${footage.map((item) => `<li>${escapeHtml(item.title)} — ${item.durationSeconds.toFixed(2)} seconds; ${escapeHtml(item.fileName)}${item.isPrimary ? " (Primary)" : ""}</li>`).join("")}</ul>` : "<p>No reconstruction footage recorded.</p>"}
<h2>Field GPS Placement Audit</h2>
${fieldPlacementRows ? `<table><thead><tr><th>Target</th><th>Coordinate</th><th>Accuracy</th><th>Method</th><th>Officer</th></tr></thead><tbody>${fieldPlacementRows}</tbody></table>` : "<p>No GPS field positions were recorded.</p>"}
<h2>Walking Traces and Boundaries</h2>
${walkingTrackRows ? `<table><thead><tr><th>Target</th><th>Capture</th><th>Distance / Area</th><th>Estimated Uncertainty</th><th>Officer</th></tr></thead><tbody>${walkingTrackRows}</tbody></table>` : "<p>No walking traces were recorded.</p>"}
<h2>Findings</h2>${list(report.findings)}
<h2>Safety Recommendations</h2>${list(report.recommendations)}
<h2>Limitations</h2>${list(report.limitations)}
</body>
</html>`;
}

export const AccidentReportService = {
  build(
    accidentCase: AccidentCase,
    reconstruction: AccidentReconstruction | null,
  ): AccidentReportModel {
    return {
      accidentCase,
      reconstruction,
      footage: ReconstructionFootageService.getByCaseId(accidentCase.id),
      narrative: buildNarrative(reconstruction),
      timeline: getTimeline(reconstruction),
      findings: getFindings(reconstruction),
      recommendations: getRecommendations(reconstruction),
      limitations: getLimitations(),
    };
  },

  downloadJson(report: AccidentReportModel): void {
    downloadBlob(
      `${report.accidentCase.caseNumber}-report.json`,
      JSON.stringify(report, null, 2),
      "application/json;charset=utf-8",
    );
  },

  downloadWord(report: AccidentReportModel): void {
    downloadBlob(
      `${report.accidentCase.caseNumber}-report.doc`,
      buildWordHtml(report),
      "application/msword;charset=utf-8",
    );
  },
};
