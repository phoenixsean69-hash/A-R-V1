import type {
  AccidentReconstruction,
  ReconstructionVehicle,
} from "../types/reconstruction";
import {
  getParticipantStateAtTime,
  getReconstructionImpactEffectState,
} from "./reconstructionGeometry";
import { getParticipantPotholeEffect } from "./reconstructionSurfaceEffects";

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

interface ParticipantDomNodes {
  participant: HTMLElement | null;
  vectorLine: SVGLineElement | null;
  vectorTip: SVGCircleElement | null;
  speedLabel: HTMLElement | null;
  smoke: HTMLElement | null;
}

interface PlaybackControlNodes {
  scrubber: HTMLInputElement | null;
  progress: HTMLElement | null;
  clock: HTMLElement | null;
}

const impactOverlayCache = new WeakMap<HTMLElement, ImpactOverlayElements>();
const participantNodeCache = new WeakMap<
  HTMLElement,
  Map<string, ParticipantDomNodes>
>();
const playbackControlCache = new WeakMap<HTMLElement, PlaybackControlNodes>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function selectByPlaybackId<T extends Element>(
  root: ParentNode,
  attribute: string,
  id: string,
): T | null {
  const backslash = String.fromCharCode(92);
  const safeId = id
    .split(backslash)
    .join(backslash + backslash)
    .split('"')
    .join(backslash + '"');
  return root.querySelector<T>(`[${attribute}="${safeId}"]`);
}

function participantNodes(
  root: HTMLElement,
  participantId: string,
): ParticipantDomNodes {
  let rootCache = participantNodeCache.get(root);
  if (!rootCache) {
    rootCache = new Map();
    participantNodeCache.set(root, rootCache);
  }

  const cached = rootCache.get(participantId);
  if (
    cached &&
    (!cached.participant || cached.participant.isConnected) &&
    (!cached.vectorLine || cached.vectorLine.isConnected) &&
    (!cached.vectorTip || cached.vectorTip.isConnected) &&
    (!cached.speedLabel || cached.speedLabel.isConnected) &&
    (!cached.smoke || cached.smoke.isConnected)
  ) {
    return cached;
  }

  const result: ParticipantDomNodes = {
    participant: selectByPlaybackId<HTMLElement>(
      root,
      "data-playback-participant-id",
      participantId,
    ),
    vectorLine: selectByPlaybackId<SVGLineElement>(
      root,
      "data-playback-vector-line-id",
      participantId,
    ),
    vectorTip: selectByPlaybackId<SVGCircleElement>(
      root,
      "data-playback-vector-tip-id",
      participantId,
    ),
    speedLabel: selectByPlaybackId<HTMLElement>(
      root,
      "data-playback-speed-label-id",
      participantId,
    ),
    smoke: selectByPlaybackId<HTMLElement>(
      root,
      "data-playback-smoke-id",
      participantId,
    ),
  };
  rootCache.set(participantId, result);
  return result;
}

function controls(editorRoot: HTMLElement): PlaybackControlNodes {
  const cached = playbackControlCache.get(editorRoot);
  if (
    cached &&
    (!cached.scrubber || cached.scrubber.isConnected) &&
    (!cached.progress || cached.progress.isConnected) &&
    (!cached.clock || cached.clock.isConnected)
  ) {
    return cached;
  }

  const result: PlaybackControlNodes = {
    scrubber: editorRoot.querySelector<HTMLInputElement>(
      '.reconstruction-playback__scrubber input[type="range"]',
    ),
    progress: editorRoot.querySelector<HTMLElement>(
      ".reconstruction-playback__progress",
    ),
    clock: editorRoot.querySelector<HTMLElement>("[data-playback-clock]"),
  };
  playbackControlCache.set(editorRoot, result);
  return result;
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
  effect: ReturnType<typeof getReconstructionImpactEffectState>,
): void {
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
  overlay.ring.style.opacity = String(fade * 0.9);

  const flashSize = 34 * effect.intensity;
  overlay.flash.style.width = `${flashSize}px`;
  overlay.flash.style.height = `${flashSize}px`;
  overlay.flash.style.opacity = String(Math.max(0, 1 - effect.progress * 4));
  overlay.flash.style.transform =
    `translate(-50%, -50%) scale(${1 + effect.progress * 2})`;
  overlay.label.style.opacity = String(Math.max(0, 1 - effect.progress * 2.2));
  overlay.label.style.transform =
    `translate(-50%, ${-54 - effect.progress * 18}px) scale(${1 + (1 - fade) * 0.15})`;

  overlay.sparks.forEach((spark, index) => {
    const angle = index * (360 / overlay.sparks.length) + (index % 2) * 7;
    spark.style.width = `${9 + (index % 4) * 5 + effect.progress * 22}px`;
    spark.style.opacity = String(fade);
    spark.style.transform = `rotate(${angle}deg) translateX(${burstDistance}px)`;
  });
}

function paintParticipant(
  sceneRoot: HTMLElement,
  reconstruction: AccidentReconstruction,
  participant: ReconstructionVehicle,
  participantIndex: number,
  timeSeconds: number,
  impactEffect: ReturnType<typeof getReconstructionImpactEffectState>,
): void {
  const state = getParticipantStateAtTime(participant, timeSeconds);
  const activePoint = participant.pathPoints.find(
    (point) => point.id === state.activePointId,
  );
  const activeAction = activePoint?.action ?? "Cruise";
  const pothole = getParticipantPotholeEffect(
    reconstruction,
    participant,
    state.position,
    state.speedKmh,
    timeSeconds,
  );

  const nearImpact =
    Math.hypot(
      state.position.x - impactEffect.position.x,
      state.position.y - impactEffect.position.y,
    ) <= 12;
  const impactShake =
    impactEffect.active && nearImpact
      ? (1 - impactEffect.progress) * 5 * impactEffect.intensity
      : 0;
  const impactPhase = impactEffect.progress * 72 + participantIndex * 2.4;
  const potholePhase = timeSeconds * 25 + participantIndex * 1.9;
  const shakeX =
    Math.sin(impactPhase) * impactShake +
    Math.sin(potholePhase) * pothole.screenShakePixels;
  const shakeY =
    Math.cos(impactPhase * 1.31) * impactShake * 0.65 +
    Math.abs(Math.sin(potholePhase * 1.7)) * pothole.screenShakePixels * 0.7;
  const rotationShake =
    Math.sin(impactPhase * 0.83) * impactShake * 0.8 +
    pothole.rollDegrees;

  const nodes = participantNodes(sceneRoot, participant.id);
  if (nodes.participant) {
    nodes.participant.style.left = `${state.position.x}%`;
    nodes.participant.style.top = `${state.position.y}%`;
    nodes.participant.style.transform =
      `translate(-50%, -50%) translate(${shakeX}px, ${shakeY}px) rotate(${state.rotation + rotationShake}deg)`;
    nodes.participant.style.willChange = "left, top, transform";
    nodes.participant.title =
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

  if (nodes.vectorLine) {
    nodes.vectorLine.setAttribute("x1", String(state.position.x));
    nodes.vectorLine.setAttribute("y1", String(state.position.y));
    nodes.vectorLine.setAttribute("x2", String(vectorEndX));
    nodes.vectorLine.setAttribute("y2", String(vectorEndY));
  }
  if (nodes.vectorTip) {
    nodes.vectorTip.setAttribute("cx", String(vectorEndX));
    nodes.vectorTip.setAttribute("cy", String(vectorEndY));
  }
  if (nodes.speedLabel) {
    nodes.speedLabel.style.left = `${vectorEndX}%`;
    nodes.speedLabel.style.top = `${vectorEndY}%`;
    nodes.speedLabel.textContent = `${state.speedKmh.toFixed(0)} km/h`;
  }
  if (nodes.smoke) {
    const visible =
      (activeAction === "Brake" || activeAction === "Slide") &&
      state.speedKmh > 5;
    nodes.smoke.style.display = visible ? "block" : "none";
    nodes.smoke.style.left = `${state.position.x}%`;
    nodes.smoke.style.top = `${state.position.y}%`;
  }
}

function paintPlaybackControls(
  editorRoot: HTMLElement,
  timeSeconds: number,
  durationSeconds: number,
): void {
  const nodes = controls(editorRoot);
  if (nodes.scrubber) nodes.scrubber.value = String(timeSeconds);
  if (nodes.progress) {
    nodes.progress.style.width =
      `${(timeSeconds / Math.max(0.1, durationSeconds)) * 100}%`;
  }
  if (nodes.clock) nodes.clock.textContent = `${timeSeconds.toFixed(2)}s`;
}

export function paintReconstructionPlaybackDomFrame({
  sceneRoot,
  editorRoot,
  reconstruction,
  timeSeconds,
}: PlaybackDomFrameOptions): void {
  if (sceneRoot) {
    const impactEffect = getReconstructionImpactEffectState(
      reconstruction,
      timeSeconds,
    );
    reconstruction.vehicles.forEach((participant, participantIndex) => {
      paintParticipant(
        sceneRoot,
        reconstruction,
        participant,
        participantIndex,
        timeSeconds,
        impactEffect,
      );
    });
    paintImpactOverlay(sceneRoot, impactEffect);
  }

  if (editorRoot) {
    paintPlaybackControls(
      editorRoot,
      timeSeconds,
      reconstruction.durationSeconds,
    );
  }
}
