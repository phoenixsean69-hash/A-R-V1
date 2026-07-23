import type { AccidentReconstruction } from "../types/reconstruction";
import {
  getParticipantStateAtTime,
  getReconstructionImpactEffectState,
} from "./reconstructionGeometry";

interface PlaybackDomFrameOptions {
  sceneRoot: HTMLElement | null;
  editorRoot: HTMLElement | null;
  reconstruction: AccidentReconstruction;
  timeSeconds: number;
  timestamp: number;
}

interface ImpactOverlayElements {
  root: HTMLDivElement;
  ring: HTMLSpanElement;
  flash: HTMLSpanElement;
  label: HTMLSpanElement;
  sparks: HTMLSpanElement[];
}

const impactOverlayCache = new WeakMap<HTMLElement, ImpactOverlayElements>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function selectByPlaybackId<T extends Element>(
  root: ParentNode,
  attribute: string,
  id: string,
): T | null {
  const safeId = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return root.querySelector<T>(`[${attribute}="${safeId}"]`);
}

function ensureImpactOverlay(sceneRoot: HTMLElement): ImpactOverlayElements {
  const cached = impactOverlayCache.get(sceneRoot);
  if (cached && cached.root.isConnected) return cached;

  const root = document.createElement("div");
  root.dataset.playbackImpactOverlay = "true";
  Object.assign(root.style, {
    position: "absolute",
    zIndex: "85",
    width: "0",
    height: "0",
    pointerEvents: "none",
    display: "none",
    contain: "layout style paint",
  });

  const ring = document.createElement("span");
  Object.assign(ring.style, {
    position: "absolute",
    left: "0",
    top: "0",
    border: "4px solid rgba(253, 230, 138, 0.95)",
    borderRadius: "9999px",
    boxShadow: "0 0 26px rgba(251, 191, 36, 0.95)",
    transform: "translate(-50%, -50%)",
    willChange: "width, height, opacity",
  });

  const flash = document.createElement("span");
  Object.assign(flash.style, {
    position: "absolute",
    left: "0",
    top: "0",
    borderRadius: "9999px",
    background: "white",
    boxShadow: "0 0 50px 24px rgba(251, 146, 60, 0.9)",
    transform: "translate(-50%, -50%)",
    willChange: "transform, opacity",
  });

  const label = document.createElement("span");
  label.textContent = "IMPACT";
  Object.assign(label.style, {
    position: "absolute",
    left: "0",
    top: "0",
    borderRadius: "6px",
    background: "#b91c1c",
    padding: "4px 12px",
    color: "white",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.18em",
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
    transform: "translate(-50%, -54px)",
    willChange: "transform, opacity",
    whiteSpace: "nowrap",
  });

  const sparks = Array.from({ length: 14 }, (_, index) => {
    const spark = document.createElement("span");
    Object.assign(spark.style, {
      position: "absolute",
      left: "0",
      top: "0",
      height: "4px",
      borderRadius: "9999px",
      background: index % 3 === 0 ? "#ef4444" : "#fcd34d",
      boxShadow: "0 0 8px rgba(251, 191, 36, 0.95)",
      transformOrigin: "0 50%",
      willChange: "transform, opacity, width",
    });
    root.appendChild(spark);
    return spark;
  });

  root.appendChild(ring);
  root.appendChild(flash);
  root.appendChild(label);
  sceneRoot.appendChild(root);

  const elements = { root, ring, flash, label, sparks };
  impactOverlayCache.set(sceneRoot, elements);
  return elements;
}

function paintImpactOverlay(
  sceneRoot: HTMLElement,
  reconstruction: AccidentReconstruction,
  timeSeconds: number,
): void {
  const effect = getReconstructionImpactEffectState(reconstruction, timeSeconds);
  const overlay = ensureImpactOverlay(sceneRoot);

  if (!effect.active) {
    overlay.root.style.display = "none";
    return;
  }

  const fade = clamp(1 - effect.progress, 0, 1);
  const ringSize = 42 + effect.progress * 86 * effect.intensity;
  const burstDistance = 12 + effect.progress * 44 * effect.intensity;

  overlay.root.style.display = "block";
  overlay.root.style.left = `${effect.position.x}%`;
  overlay.root.style.top = `${effect.position.y}%`;

  overlay.ring.style.width = `${ringSize}px`;
  overlay.ring.style.height = `${ringSize}px`;
  overlay.ring.style.opacity = `${fade * 0.9}`;

  const flashSize = 34 * effect.intensity;
  overlay.flash.style.width = `${flashSize}px`;
  overlay.flash.style.height = `${flashSize}px`;
  overlay.flash.style.opacity = `${Math.max(0, 1 - effect.progress * 4)}`;
  overlay.flash.style.transform =
    `translate(-50%, -50%) scale(${1 + effect.progress * 2})`;

  overlay.label.style.opacity = `${Math.max(0, 1 - effect.progress * 2.2)}`;
  overlay.label.style.transform =
    `translate(-50%, ${-54 - effect.progress * 18}px) scale(${1 + (1 - fade) * 0.15})`;

  overlay.sparks.forEach((spark, index) => {
    const angle = index * (360 / overlay.sparks.length) + (index % 2) * 7;
    spark.style.width = `${9 + (index % 4) * 5 + effect.progress * 22}px`;
    spark.style.opacity = `${fade}`;
    spark.style.transform =
      `rotate(${angle}deg) translateX(${burstDistance}px)`;
  });
}

function paintParticipant(
  sceneRoot: HTMLElement,
  reconstruction: AccidentReconstruction,
  participantIndex: number,
  timeSeconds: number,
): void {
  const participant = reconstruction.vehicles[participantIndex];
  if (!participant) return;

  const state = getParticipantStateAtTime(participant, timeSeconds);
  const activePoint = participant.pathPoints.find(
    (point) => point.id === state.activePointId,
  );
  const activeAction = activePoint?.action ?? "Cruise";
  const impactEffect = getReconstructionImpactEffectState(
    reconstruction,
    timeSeconds,
  );

  const nearImpact =
    Math.hypot(
      state.position.x - impactEffect.position.x,
      state.position.y - impactEffect.position.y,
    ) <= 12;
  const shakeStrength =
    impactEffect.active && nearImpact
      ? (1 - impactEffect.progress) * 5 * impactEffect.intensity
      : 0;
  const shakePhase = impactEffect.progress * 72 + participantIndex * 2.4;
  const shakeX = Math.sin(shakePhase) * shakeStrength;
  const shakeY = Math.cos(shakePhase * 1.31) * shakeStrength * 0.65;
  const rotationShake =
    Math.sin(shakePhase * 0.83) * shakeStrength * 0.8;

  const participantNode = selectByPlaybackId<HTMLElement>(
    sceneRoot,
    "data-playback-participant-id",
    participant.id,
  );
  if (participantNode) {
    participantNode.style.left = `${state.position.x}%`;
    participantNode.style.top = `${state.position.y}%`;
    participantNode.style.transform =
      `translate(-50%, -50%) translate(${shakeX}px, ${shakeY}px) rotate(${state.rotation + rotationShake}deg)`;
    participantNode.style.willChange = "left, top, transform";
    participantNode.title =
      `${participant.name} — ${state.speedKmh.toFixed(0)} km/h`;
  }

  const vectorLength = Math.min(14, 3 + state.speedKmh / 8);
  const vectorRadians = (state.rotation * Math.PI) / 180;
  const vectorEndX = clamp(
    state.position.x + Math.cos(vectorRadians) * vectorLength,
    0,
    100,
  );
  const vectorEndY = clamp(
    state.position.y + Math.sin(vectorRadians) * vectorLength,
    0,
    100,
  );

  const vectorLine = selectByPlaybackId<SVGLineElement>(
    sceneRoot,
    "data-playback-vector-line-id",
    participant.id,
  );
  if (vectorLine) {
    vectorLine.setAttribute("x1", String(state.position.x));
    vectorLine.setAttribute("y1", String(state.position.y));
    vectorLine.setAttribute("x2", String(vectorEndX));
    vectorLine.setAttribute("y2", String(vectorEndY));
  }

  const vectorTip = selectByPlaybackId<SVGCircleElement>(
    sceneRoot,
    "data-playback-vector-tip-id",
    participant.id,
  );
  if (vectorTip) {
    vectorTip.setAttribute("cx", String(vectorEndX));
    vectorTip.setAttribute("cy", String(vectorEndY));
  }

  const speedLabel = selectByPlaybackId<HTMLElement>(
    sceneRoot,
    "data-playback-speed-label-id",
    participant.id,
  );
  if (speedLabel) {
    speedLabel.style.left = `${vectorEndX}%`;
    speedLabel.style.top = `${vectorEndY}%`;
    speedLabel.textContent = `${state.speedKmh.toFixed(0)} km/h`;
  }

  const smoke = selectByPlaybackId<HTMLElement>(
    sceneRoot,
    "data-playback-smoke-id",
    participant.id,
  );
  if (smoke) {
    const visible =
      (activeAction === "Brake" || activeAction === "Slide") &&
      state.speedKmh > 5;
    smoke.style.display = visible ? "block" : "none";
    smoke.style.left = `${state.position.x}%`;
    smoke.style.top = `${state.position.y}%`;
  }
}

function paintPlaybackControls(
  editorRoot: HTMLElement,
  timeSeconds: number,
  durationSeconds: number,
): void {
  const scrubber = editorRoot.querySelector<HTMLInputElement>(
    '.reconstruction-playback__scrubber input[type="range"]',
  );
  if (scrubber) scrubber.value = String(timeSeconds);

  const progress = editorRoot.querySelector<HTMLElement>(
    ".reconstruction-playback__progress",
  );
  if (progress) {
    progress.style.width =
      `${(timeSeconds / Math.max(0.1, durationSeconds)) * 100}%`;
  }

  const clock = editorRoot.querySelector<HTMLElement>("[data-playback-clock]");
  if (clock) clock.textContent = `${timeSeconds.toFixed(2)}s`;
}

export function paintReconstructionPlaybackDomFrame({
  sceneRoot,
  editorRoot,
  reconstruction,
  timeSeconds,
}: PlaybackDomFrameOptions): void {
  if (sceneRoot) {
    reconstruction.vehicles.forEach((_, participantIndex) => {
      paintParticipant(
        sceneRoot,
        reconstruction,
        participantIndex,
        timeSeconds,
      );
    });
    paintImpactOverlay(sceneRoot, reconstruction, timeSeconds);
  }

  if (editorRoot) {
    paintPlaybackControls(
      editorRoot,
      timeSeconds,
      reconstruction.durationSeconds,
    );
  }
}
