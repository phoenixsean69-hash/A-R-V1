import type {
  AccidentReconstruction,
  AccidentTimelineEvent,
  ReconstructionPosition,
  ReconstructionSceneObject,
  ReconstructionVehicle,
} from "../types/reconstruction";
import {
  getParticipantStateAtTime,
  getReconstructionImpactEffectState,
} from "./reconstructionGeometry";

export interface ReconstructionCanvasRenderOptions {
  caseNumber: string;
  showMovementPaths: boolean;
  showMeasurements: boolean;
  showEvidenceMarkers: boolean;
  showEventCaption: boolean;
}

export interface ReconstructionFrameDescription {
  title: string;
  description: string;
}

const COLOURS: Record<string, string> = {
  Blue: "#2563eb",
  Red: "#dc2626",
  Green: "#16a34a",
  Yellow: "#eab308",
  Black: "#111827",
  White: "#f8fafc",
  Orange: "#ea580c",
  Purple: "#9333ea",
};

function toCanvasPoint(
  point: ReconstructionPosition,
  width: number,
  height: number,
): ReconstructionPosition {
  return {
    x: (point.x / 100) * width,
    y: (point.y / 100) * height,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawSmoothPath(
  context: CanvasRenderingContext2D,
  points: ReconstructionPosition[],
  width: number,
  height: number,
): void {
  if (points.length < 2) return;

  const canvasPoints = points.map((point) => toCanvasPoint(point, width, height));
  context.beginPath();
  context.moveTo(canvasPoints[0].x, canvasPoints[0].y);

  for (let index = 1; index < canvasPoints.length - 1; index += 1) {
    const current = canvasPoints[index];
    const next = canvasPoints[index + 1];
    const midpoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };
    context.quadraticCurveTo(current.x, current.y, midpoint.x, midpoint.y);
  }

  const last = canvasPoints[canvasPoints.length - 1];
  context.lineTo(last.x, last.y);
}

function drawRoad(
  context: CanvasRenderingContext2D,
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): void {
  const scene = reconstruction.scene;
  const night = scene.timeOfDay === "Night";
  const dusk = scene.timeOfDay === "Dusk" || scene.timeOfDay === "Dawn";

  context.fillStyle = night ? "#0f172a" : dusk ? "#64748b" : "#86a96f";
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(width / 2, height / 2);
  context.rotate((scene.roadRotation * Math.PI) / 180);
  context.translate(-width / 2, -height / 2);

  const roadColour = scene.roadSurface === "Wet" ? "#384152" : "#475569";
  const pavementColour = "#a8a29e";
  const horizontalHeight = height * 0.34;
  const verticalWidth = width * 0.25;

  const drawHorizontal = () => {
    if (scene.showPavements) {
      context.fillStyle = pavementColour;
      context.fillRect(0, height / 2 - horizontalHeight / 2 - 18, width, horizontalHeight + 36);
    }
    context.fillStyle = roadColour;
    context.fillRect(0, height / 2 - horizontalHeight / 2, width, horizontalHeight);
  };

  const drawVertical = (fromTop = true, toBottom = true) => {
    if (scene.showPavements) {
      context.fillStyle = pavementColour;
      const y = fromTop ? 0 : height / 2;
      const h = fromTop && toBottom ? height : height / 2;
      context.fillRect(width / 2 - verticalWidth / 2 - 18, y, verticalWidth + 36, h);
    }
    context.fillStyle = roadColour;
    const y = fromTop ? 0 : height / 2;
    const h = fromTop && toBottom ? height : height / 2;
    context.fillRect(width / 2 - verticalWidth / 2, y, verticalWidth, h);
  };

  switch (scene.roadLayout) {
    case "Straight Road":
      drawHorizontal();
      break;
    case "T-Junction":
      drawHorizontal();
      drawVertical(false, true);
      break;
    case "Transport Terminus":
      drawHorizontal();
      context.fillStyle = roadColour;
      context.fillRect(width * 0.55, height * 0.08, width * 0.38, height * 0.84);
      for (let index = 0; index < 5; index += 1) {
        context.strokeStyle = "rgba(255,255,255,0.7)";
        context.lineWidth = 3;
        context.strokeRect(width * 0.6, height * (0.14 + index * 0.14), width * 0.25, height * 0.1);
      }
      break;
    default:
      drawHorizontal();
      drawVertical(true, true);
      break;
  }

  if (scene.roadLayout === "Roundabout") {
    context.fillStyle = roadColour;
    context.beginPath();
    context.arc(width / 2, height / 2, Math.min(width, height) * 0.18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#7c9a5b";
    context.beginPath();
    context.arc(width / 2, height / 2, Math.min(width, height) * 0.085, 0, Math.PI * 2);
    context.fill();
  }

  if (scene.showLaneMarkings) {
    context.save();
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 3;
    context.setLineDash([18, 16]);
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();

    if (scene.roadLayout !== "Straight Road" && scene.roadLayout !== "Transport Terminus") {
      context.beginPath();
      context.moveTo(width / 2, scene.roadLayout === "T-Junction" ? height / 2 : 0);
      context.lineTo(width / 2, height);
      context.stroke();
    }
    context.restore();
  }

  if (scene.showPedestrianCrossing || scene.roadLayout === "Pedestrian Crossing") {
    context.fillStyle = "rgba(255,255,255,0.9)";
    const stripeWidth = 13;
    for (let index = -4; index <= 4; index += 1) {
      context.fillRect(
        width / 2 + index * stripeWidth * 1.5 - stripeWidth / 2,
        height / 2 - horizontalHeight / 2,
        stripeWidth,
        horizontalHeight,
      );
    }
  }

  context.restore();

  if (scene.weather === "Rain") {
    context.save();
    context.strokeStyle = "rgba(191,219,254,0.45)";
    context.lineWidth = 2;
    for (let x = 0; x < width; x += 35) {
      for (let y = -20; y < height; y += 42) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - 10, y + 24);
        context.stroke();
      }
    }
    context.restore();
  }

  if (scene.weather === "Fog" || scene.visibility === "Poor") {
    context.fillStyle = "rgba(226,232,240,0.32)";
    context.fillRect(0, 0, width, height);
  }

  if (scene.weather === "Dust") {
    context.fillStyle = "rgba(180,120,60,0.18)";
    context.fillRect(0, 0, width, height);
  }
}

function drawSceneObject(
  context: CanvasRenderingContext2D,
  object: ReconstructionSceneObject,
  width: number,
  height: number,
): void {
  if (!object.visible) return;

  if (object.tracePoints && object.tracePoints.length >= 2) {
    context.save();
    context.strokeStyle =
      object.type === "Road Crack" ? "#111827" : "rgba(15,23,42,0.88)";
    context.lineWidth = Math.max(2, (object.traceWidth ?? 0.7) * 5);
    context.lineCap = "round";
    context.lineJoin = "round";
    drawSmoothPath(context, object.tracePoints, width, height);
    context.stroke();

    if (object.traceStyle === "Double") {
      context.translate(5, 3);
      drawSmoothPath(context, object.tracePoints, width, height);
      context.stroke();
    }
    context.restore();
    return;
  }

  const point = toCanvasPoint(object.position, width, height);
  const size = Math.max(10, 16 * object.scale);

  context.save();
  context.translate(point.x, point.y);
  context.rotate((object.rotation * Math.PI) / 180);

  switch (object.type) {
    case "Pothole":
      context.fillStyle = "#1f2937";
      context.beginPath();
      context.ellipse(0, 0, size * 1.5, size, 0.2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#64748b";
      context.lineWidth = 3;
      context.stroke();
      break;
    case "Puddle":
    case "Oil Spill":
      context.fillStyle = object.type === "Puddle" ? "rgba(37,99,235,0.7)" : "rgba(15,23,42,0.75)";
      context.beginPath();
      context.ellipse(0, 0, size * 1.6, size, 0, 0, Math.PI * 2);
      context.fill();
      break;
    case "Traffic Cone":
      context.fillStyle = "#f97316";
      context.beginPath();
      context.moveTo(0, -size);
      context.lineTo(size * 0.65, size);
      context.lineTo(-size * 0.65, size);
      context.closePath();
      context.fill();
      break;
    case "Road Barrier":
    case "Guardrail":
    case "Wall":
    case "Fence":
      context.fillStyle = object.type === "Wall" ? "#78716c" : "#f59e0b";
      context.fillRect(-size * 2.2, -size * 0.35, size * 4.4, size * 0.7);
      break;
    case "Broken Glass":
    case "Debris":
    case "Vehicle Part":
      context.fillStyle = object.type === "Broken Glass" ? "#bfdbfe" : "#334155";
      for (let index = 0; index < 7; index += 1) {
        context.beginPath();
        context.arc(
          Math.cos(index * 2.1) * size,
          Math.sin(index * 1.7) * size * 0.7,
          2 + (index % 3),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      break;
    default:
      context.fillStyle = object.category === "Traffic Control" ? "#ef4444" : "#f59e0b";
      roundedRect(context, -size, -size, size * 2, size * 2, 5);
      context.fill();
      context.fillStyle = "white";
      context.font = `${Math.max(9, size * 0.65)}px Rubik, Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(object.type.slice(0, 2).toUpperCase(), 0, 0);
      break;
  }

  context.restore();
}

function drawParticipantPath(
  context: CanvasRenderingContext2D,
  participant: ReconstructionVehicle,
  width: number,
  height: number,
): void {
  if (participant.pathPoints.length < 2) return;
  context.save();
  context.strokeStyle = COLOURS[participant.colour] ?? "#2563eb";
  context.lineWidth = 3;
  context.globalAlpha = 0.52;
  context.setLineDash([10, 8]);
  drawSmoothPath(
    context,
    participant.pathPoints.map((point) => point.position),
    width,
    height,
  );
  context.stroke();
  context.restore();
}

function drawParticipant(
  context: CanvasRenderingContext2D,
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
): void {
  const state = getParticipantStateAtTime(participant, timeSeconds);
  const position = toCanvasPoint(state.position, width, height);
  const colour = COLOURS[participant.colour] ?? "#2563eb";

  context.save();
  context.translate(position.x, position.y);
  context.rotate((state.rotation * Math.PI) / 180);
  context.shadowColor = "rgba(0,0,0,0.4)";
  context.shadowBlur = 8;
  context.shadowOffsetY = 4;

  if (["Pedestrian", "Officer", "Witness"].includes(participant.type)) {
    context.strokeStyle = colour;
    context.fillStyle = colour;
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, -13, 7, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(0, -5);
    context.lineTo(0, 13);
    context.moveTo(-10, 1);
    context.lineTo(10, 1);
    context.moveTo(0, 13);
    context.lineTo(-8, 25);
    context.moveTo(0, 13);
    context.lineTo(8, 25);
    context.stroke();
  } else if (participant.type === "Bicycle") {
    context.strokeStyle = colour;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(-14, 6, 10, 0, Math.PI * 2);
    context.arc(14, 6, 10, 0, Math.PI * 2);
    context.moveTo(-14, 6);
    context.lineTo(0, -8);
    context.lineTo(14, 6);
    context.lineTo(-3, 6);
    context.closePath();
    context.stroke();
  } else {
    const dimensions =
      participant.type === "Bus"
        ? { width: 58, height: 25 }
        : participant.type === "Truck"
          ? { width: 52, height: 27 }
          : participant.type === "Motorcycle"
            ? { width: 30, height: 13 }
            : { width: 42, height: 22 };

    context.fillStyle = colour;
    context.strokeStyle = "white";
    context.lineWidth = 2;
    roundedRect(
      context,
      -dimensions.width / 2,
      -dimensions.height / 2,
      dimensions.width,
      dimensions.height,
      6,
    );
    context.fill();
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.45)";
    context.fillRect(-dimensions.width * 0.12, -dimensions.height * 0.36, dimensions.width * 0.25, dimensions.height * 0.72);
  }

  context.restore();

  context.save();
  context.font = "700 15px Rubik, Arial, sans-serif";
  context.textAlign = "center";
  context.fillStyle = "white";
  context.strokeStyle = "rgba(15,23,42,0.9)";
  context.lineWidth = 4;
  context.strokeText(participant.name, position.x, position.y - 34);
  context.fillText(participant.name, position.x, position.y - 34);
  context.restore();
}

function drawMeasurements(
  context: CanvasRenderingContext2D,
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): void {
  reconstruction.measurements
    .filter((measurement) => measurement.visible)
    .forEach((measurement) => {
      const start = toCanvasPoint(measurement.start, width, height);
      const end = toCanvasPoint(measurement.end, width, height);
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

      context.save();
      context.strokeStyle = measurement.colour;
      context.lineWidth = 3;
      context.setLineDash([8, 6]);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      context.fillStyle = measurement.colour;
      roundedRect(context, midpoint.x - 53, midpoint.y - 15, 106, 30, 9);
      context.fill();
      context.fillStyle = "white";
      context.font = "700 13px Rubik, Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        `M-${String(measurement.measurementNumber).padStart(2, "0")} · ${measurement.distanceMetres.toFixed(2)}m`,
        midpoint.x,
        midpoint.y,
      );
      context.restore();
    });
}

function drawCollisionPoint(
  context: CanvasRenderingContext2D,
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): void {
  const point = toCanvasPoint(reconstruction.collisionPoint, width, height);
  context.save();
  context.strokeStyle = "rgba(220,38,38,0.95)";
  context.fillStyle = "rgba(220,38,38,0.9)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(point.x, point.y, 15, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "white";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(point.x, point.y, 8, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "rgba(220,38,38,0.8)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(point.x - 30, point.y);
  context.lineTo(point.x + 30, point.y);
  context.moveTo(point.x, point.y - 30);
  context.lineTo(point.x, point.y + 30);
  context.stroke();
  context.fillStyle = "white";
  context.font = "900 11px Rubik, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("HIT", point.x, point.y);
  context.restore();
}

function drawImpactEffect(
  context: CanvasRenderingContext2D,
  reconstruction: AccidentReconstruction,
  timeSeconds: number,
  width: number,
  height: number,
): void {
  const effect = getReconstructionImpactEffectState(reconstruction, timeSeconds);
  if (!effect.active) return;

  const point = toCanvasPoint(effect.position, width, height);
  const fade = 1 - effect.progress;
  const baseScale = Math.min(width, height) / 720;
  const ringRadius =
    (22 + effect.progress * 82 * effect.intensity) * baseScale;
  const burstDistance =
    (18 + effect.progress * 72 * effect.intensity) * baseScale;

  context.save();
  context.globalCompositeOperation = "screen";

  const flash = context.createRadialGradient(
    point.x,
    point.y,
    0,
    point.x,
    point.y,
    Math.max(1, ringRadius * 0.72),
  );
  flash.addColorStop(0, `rgba(255,255,255,${Math.max(0, 1 - effect.progress * 4)})`);
  flash.addColorStop(0.32, `rgba(251,191,36,${fade * 0.9})`);
  flash.addColorStop(1, "rgba(239,68,68,0)");
  context.fillStyle = flash;
  context.beginPath();
  context.arc(point.x, point.y, ringRadius, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = fade * 0.95;
  context.strokeStyle = "#fde68a";
  context.lineWidth = Math.max(3, 5 * baseScale);
  context.beginPath();
  context.arc(point.x, point.y, ringRadius, 0, Math.PI * 2);
  context.stroke();

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2 + (index % 2) * 0.12;
    const startDistance = burstDistance * (0.72 + (index % 3) * 0.1);
    const length = (12 + (index % 5) * 5 + effect.progress * 24) * baseScale;
    context.strokeStyle = index % 3 === 0 ? "#ef4444" : "#fcd34d";
    context.lineWidth = Math.max(2, (index % 3 === 0 ? 4 : 3) * baseScale);
    context.beginPath();
    context.moveTo(
      point.x + Math.cos(angle) * startDistance,
      point.y + Math.sin(angle) * startDistance,
    );
    context.lineTo(
      point.x + Math.cos(angle) * (startDistance + length),
      point.y + Math.sin(angle) * (startDistance + length),
    );
    context.stroke();
  }

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = Math.max(0, 1 - effect.progress * 2.2);
  context.font = `900 ${Math.max(15, 22 * baseScale)}px Rubik, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = Math.max(4, 6 * baseScale);
  context.strokeStyle = "rgba(127,29,29,0.95)";
  context.fillStyle = "white";
  const labelY = point.y - (54 + effect.progress * 18) * baseScale;
  context.strokeText("IMPACT", point.x, labelY);
  context.fillText("IMPACT", point.x, labelY);
  context.restore();
}

function drawEvidenceMarkers(
  context: CanvasRenderingContext2D,
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): void {
  reconstruction.evidenceRecords.forEach((evidence) => {
    const point = toCanvasPoint(evidence.position, width, height);
    context.save();
    context.fillStyle = "#f59e0b";
    context.strokeStyle = "white";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(point.x, point.y, 16, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#111827";
    context.font = "700 12px Rubik, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`E${evidence.evidenceNumber}`, point.x, point.y);
    context.restore();
  });
}

function getTimelineEntries(
  reconstruction: AccidentReconstruction,
): Array<{ timeSeconds: number; title: string; description: string }> {
  const movement = reconstruction.vehicles.flatMap((participant) =>
    participant.pathPoints.map((point) => ({
      timeSeconds: point.timeSeconds,
      title: `${participant.name}: ${point.action}`,
      description: point.label || point.notes || "",
    })),
  );

  const manual = reconstruction.timelineEvents.map((event: AccidentTimelineEvent) => ({
    timeSeconds: event.timeSeconds,
    title: event.title,
    description: event.description,
  }));

  return [...movement, ...manual].sort(
    (left, right) => left.timeSeconds - right.timeSeconds,
  );
}

export function getActiveReconstructionFrameDescription(
  reconstruction: AccidentReconstruction,
  timeSeconds: number,
): ReconstructionFrameDescription {
  const entries = getTimelineEntries(reconstruction);
  const active = [...entries]
    .reverse()
    .find((entry) => entry.timeSeconds <= timeSeconds + 0.05);

  return active
    ? { title: active.title, description: active.description }
    : { title: "Initial scene", description: "Participants are at their starting positions." };
}

export function renderReconstructionFrame(
  canvas: HTMLCanvasElement,
  reconstruction: AccidentReconstruction,
  timeSeconds: number,
  options: ReconstructionCanvasRenderOptions,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  drawRoad(context, reconstruction, width, height);

  reconstruction.sceneObjects.forEach((object) =>
    drawSceneObject(context, object, width, height),
  );

  drawCollisionPoint(context, reconstruction, width, height);

  if (options.showMovementPaths) {
    reconstruction.vehicles.forEach((participant) =>
      drawParticipantPath(context, participant, width, height),
    );
  }

  if (options.showMeasurements) {
    drawMeasurements(context, reconstruction, width, height);
  }

  if (options.showEvidenceMarkers) {
    drawEvidenceMarkers(context, reconstruction, width, height);
  }

  reconstruction.vehicles.forEach((participant) =>
    drawParticipant(context, participant, timeSeconds, width, height),
  );

  drawImpactEffect(context, reconstruction, timeSeconds, width, height);

  context.save();
  const gradient = context.createLinearGradient(0, 0, 0, 115);
  gradient.addColorStop(0, "rgba(2,6,23,0.88)");
  gradient.addColorStop(1, "rgba(2,6,23,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, 125);
  context.fillStyle = "white";
  context.font = "900 24px Rubik, Arial, sans-serif";
  context.fillText("ROADSAFE AR", 30, 38);
  context.font = "700 16px Rubik, Arial, sans-serif";
  context.fillStyle = "#bfdbfe";
  context.fillText(`Case ${options.caseNumber}`, 30, 67);
  context.textAlign = "right";
  context.fillStyle = "white";
  context.font = "900 26px Rubik, Arial, sans-serif";
  context.fillText(`${timeSeconds.toFixed(2)}s`, width - 30, 45);
  context.font = "700 14px Rubik, Arial, sans-serif";
  context.fillStyle = "#cbd5e1";
  context.fillText(
    `${reconstruction.scene.roadLayout} · ${reconstruction.scene.weather} · ${reconstruction.scene.timeOfDay}`,
    width - 30,
    72,
  );
  context.restore();

  if (options.showEventCaption) {
    const event = getActiveReconstructionFrameDescription(reconstruction, timeSeconds);
    context.save();
    const boxWidth = Math.min(width - 80, 720);
    const boxX = (width - boxWidth) / 2;
    const boxY = height - 92;
    context.fillStyle = "rgba(2,6,23,0.84)";
    roundedRect(context, boxX, boxY, boxWidth, 64, 14);
    context.fill();
    context.fillStyle = "white";
    context.textAlign = "center";
    context.font = "900 18px Rubik, Arial, sans-serif";
    context.fillText(event.title, width / 2, boxY + 25);
    context.font = "14px Rubik, Arial, sans-serif";
    context.fillStyle = "#cbd5e1";
    const description = event.description.slice(0, 95);
    context.fillText(description, width / 2, boxY + 47);
    context.restore();
  }
}
