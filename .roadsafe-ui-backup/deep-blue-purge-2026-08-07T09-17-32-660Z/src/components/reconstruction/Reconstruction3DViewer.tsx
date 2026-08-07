import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { THIRD_PARTY_3D_ASSET_NOTICE } from "../../data/realisticAssetCatalog";
import {
  disposeObjectTree,
  loadRealisticParticipantModel,
  loadRealisticSceneObjectModel,
} from "../../services/realisticSceneAssetService";
import {
  usesGeneratedRoad,
  type AccidentReconstruction,
  type ParticipantImpactResponse,
  type ReconstructionPosition,
  type ReconstructionSceneObject,
  type ReconstructionVehicle,
} from "../../types/reconstruction";
import {  getParticipantPlaybackPathPoints,

  getParticipantStateAtTime,
  isPhysicsGeneratedPathPoint,} from "../../utils/reconstructionGeometry";
import { addRealSceneGeometryToThreeScene } from "../../utils/realSceneThreeGeometry";
import { getParticipantPotholeEffect } from "../../utils/reconstructionSurfaceEffects";
import { AUTO_ROAD_CURVE_NOTE_MARKER } from "../../utils/reconstructionRoadRouting";
import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";
import {
  getParticipantImpactVisualPose,
  indexEarliestParticipantImpactResponses,
} from "../../utils/reconstructionImpactVisualization";
import {
  reconstructionHeadingToThreeYawRadians,
  reconstructionPositionToThreeVector,
} from "../../utils/reconstructionThreeCoordinates";

interface Reconstruction3DViewerProps {
  reconstruction: AccidentReconstruction;
  onSwitchTo2D: () => void;
  onRunPhysics: () => AccidentReconstruction;
  onPreparePlayback: () => AccidentReconstruction;
  compact?: boolean;
  workspaceMode?: boolean;
  selectedParticipantId?: string | null;
  onSelectParticipant?: (participantId: string) => void;
  cameraCycleToken?: number;
  workspaceTimeSeconds?: number;
  workspaceTimeSourceRef?: { readonly current: number };
  workspacePlaying?: boolean;
  workspacePlaybackSpeed?: number;
  workspaceCameraMode?: CameraMode;
  workspaceLayers?: {
    paths: boolean;
    objects: boolean;
    evidence: boolean;
    physics: boolean;
  };
  workspaceTool?: WorkspaceToolMode;
}

type WorkspaceToolMode =
  | "Select"
  | "Move"
  | "Rotate"
  | "Scale"
  | "Timeline"
  | "Measure"
  | "Camera";

type CameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";

interface ParticipantRenderEntry {
  participant: ReconstructionVehicle;
  holder: THREE.Group;
  modelRoot: THREE.Group;
  label: THREE.Sprite;
}

const PARTICIPANT_COLOURS: Record<string, number> = {
  Blue: 0x2563eb,
  Red: 0xdc2626,
  Green: 0x16a34a,
  Yellow: 0xeab308,
  Black: 0x111827,
  White: 0xf8fafc,
  Orange: 0xea580c,
  Purple: 0x9333ea,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function participantDimensions(
  participant: ReconstructionVehicle,
): [number, number, number] {
  const fallback = (() => {
    switch (participant.type) {
      case "Bus":
        return [11.8, 3.2, 2.55] as const;
      case "Truck":
        return [8.4, 3.4, 2.5] as const;
      case "Motorcycle":
        return [2.2, 1.25, 0.82] as const;
      case "Bicycle":
        return [1.85, 1.2, 0.64] as const;
      case "Pedestrian":
      case "Officer":
      case "Witness":
        return [0.76, 1.75, 0.76] as const;
      default:
        return [4.5, 1.55, 1.82] as const;
    }
  })();

  return [
    Math.max(0.2, participant.physics?.lengthMetres ?? fallback[0]),
    fallback[1],
    Math.max(0.2, participant.physics?.widthMetres ?? fallback[2]),
  ];
}

function worldPosition(
  position: ReconstructionPosition,
  width: number,
  height: number,
  y = 0,
): THREE.Vector3 {
  return reconstructionPositionToThreeVector(
    position,
    width,
    height,
    y,
  );
}

const NON_BODY_MATERIAL_TOKENS = [
  "glass",
  "window",
  "windscreen",
  "windshield",
  "tyre",
  "tire",
  "wheel",
  "rubber",
  "chrome",
  "light",
  "lamp",
  "indicator",
  "skin",
  "face",
  "eye",
  "hair",
] as const;

function applyExactParticipantColour(
  root: THREE.Object3D,
  participant: ReconstructionVehicle,
): void {
  const colour =
    PARTICIPANT_COLOURS[participant.colour] ?? 0x2563eb;
  const human = ["Pedestrian", "Officer", "Witness"].includes(
    participant.type,
  );

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const objectName = object.name.toLowerCase();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach((material) => {
      const materialName = material.name.toLowerCase();
      const identity = `${objectName} ${materialName}`;
      const nonBody = NON_BODY_MATERIAL_TOKENS.some((token) =>
        identity.includes(token),
      );
      const typed = material as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        map?: THREE.Texture | null;
        transmission?: number;
        opacity?: number;
      };

      if (!typed.color || nonBody) return;
      if ((typed.transmission ?? 0) > 0.05) return;
      if ((typed.opacity ?? 1) < 0.78) return;

      // Preserve natural skin and clothing variation for people. Vehicle body
      // panels, however, use the exact same palette as the 2D SVG so changing
      // a participant colour produces a consistent result in both views.
      if (human) {
        typed.color.lerp(new THREE.Color(colour), 0.32);
      } else {
        typed.color.setHex(colour);
        typed.map = null;
        typed.emissive?.setHex(0x000000);
      }
      material.needsUpdate = true;
    });
  });
}

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(32,32,32,.88)";
    context.roundRect(8, 8, 496, 104, 22);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 38px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 60);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(6.4, 1.6, 1);
  sprite.userData.isLabel = true;
  return sprite;
}

function roundedBox(
  size: [number, number, number],
  colour: number,
  radius = 0.08,
): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(
    size[0],
    size[1],
    size[2],
    3,
    Math.min(radius, Math.min(...size) * 0.42),
  );
  const material = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.38,
    metalness: 0.18,
    clearcoat: 0.35,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createFallbackParticipantModel(
  participant: ReconstructionVehicle,
): THREE.Group {
  const group = new THREE.Group();
  const [length, height, width] = participantDimensions(participant);
  const colour = PARTICIPANT_COLOURS[participant.colour] ?? 0x2563eb;
  const human = ["Pedestrian", "Officer", "Witness"].includes(
    participant.type,
  );

  if (human) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.8, 6, 12),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.75 }),
    );
    body.position.y = 0.9;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xb97850, roughness: 0.8 }),
    );
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(body, head);
    return group;
  }

  if (participant.type === "Bicycle" || participant.type === "Motorcycle") {
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.95,
    });
    for (const x of [-length * 0.32, length * 0.32]) {
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(height * 0.28, 0.07, 10, 24),
        wheelMaterial,
      );
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(x, height * 0.3, 0);
      wheel.castShadow = true;
      group.add(wheel);
    }
    const frame = roundedBox(
      [length * 0.62, height * 0.16, width * 0.5],
      colour,
      0.05,
    );
    frame.position.y = height * 0.55;
    group.add(frame);
    return group;
  }

  const lower = roundedBox([length, height * 0.46, width], colour, 0.16);
  lower.position.y = height * 0.35;
  const cabin = roundedBox(
    [length * 0.5, height * 0.42, width * 0.82],
    0x7393aa,
    0.14,
  );
  cabin.position.set(-length * 0.04, height * 0.78, 0);
  group.add(lower, cabin);

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1014,
    roughness: 0.96,
  });
  for (const x of [-length * 0.31, length * 0.31]) {
    for (const z of [-width * 0.51, width * 0.51]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(height * 0.18, height * 0.18, 0.22, 20),
        wheelMaterial,
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, height * 0.2, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }
  return group;
}

function createParticipantHolder(
  participant: ReconstructionVehicle,
): ParticipantRenderEntry {
  const holder = new THREE.Group();
  holder.userData.participantId = participant.id;
  const modelRoot = new THREE.Group();
  modelRoot.userData.isParticipantModel = true;
  modelRoot.add(createFallbackParticipantModel(participant));
  holder.add(modelRoot);
  const label = makeTextSprite(participant.name);
  label.position.y = participantDimensions(participant)[1] + 1.15;
  holder.add(label);
  holder.traverse((object) => {
    object.userData.participantId = participant.id;
  });
  return { participant, holder, modelRoot, label };
}

function createFallbackSceneObject(
  object: ReconstructionSceneObject,
): THREE.Object3D {
  const scale = Math.max(0.25, object.scale);
  if (object.type === "Pothole") {
    const radius = Math.max(0.35, (object.widthMetres ?? scale * 1.8) / 2);
    const group = new THREE.Group();
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 36),
      new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 1 }),
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.015;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.82, radius * 0.14, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x3f4244, roughness: 1 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.035;
    group.add(hole, rim);
    return group;
  }

  if (["Puddle", "Oil Spill", "Loose Gravel"].includes(object.type)) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(0.55, scale), 30),
      new THREE.MeshPhysicalMaterial({
        color: object.type === "Oil Spill" ? 0x11131b : 0x506d7a,
        roughness: object.type === "Oil Spill" ? 0.1 : 0.7,
        transparent: true,
        opacity: 0.72,
      }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.025;
    return patch;
  }

  const dimensions: [number, number, number] =
    object.type === "Road Barrier" || object.type === "Guardrail"
      ? [Math.max(2, object.lengthMetres ?? 4) * scale, 1, 0.25]
      : object.type === "Wall" || object.type === "Fence"
        ? [Math.max(2, object.lengthMetres ?? 4) * scale, 1.8, 0.25]
        : object.type === "Tree"
          ? [1.1 * scale, 5 * scale, 1.1 * scale]
          : [1.2 * scale, 1.2 * scale, 1.2 * scale];
  const mesh = roundedBox(dimensions, 0x6b7280, 0.05);
  mesh.position.y = dimensions[1] / 2;
  return mesh;
}

function addGeneratedRoad(
  scene: THREE.Scene,
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.35, height * 1.35),
    new THREE.MeshStandardMaterial({ color: 0x526052, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  if (!usesGeneratedRoad(reconstruction.scene)) return;

  const roadWidth = Math.min(18, 6.2 + reconstruction.scene.laneCount * 3.15);
  const material = new THREE.MeshStandardMaterial({
    color: reconstruction.scene.roadSurface === "Wet" ? 0x29343b : 0x34383d,
    roughness: reconstruction.scene.roadSurface === "Wet" ? 0.45 : 0.9,
  });
  const addStrip = (horizontal: boolean) => {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(
        horizontal ? width : roadWidth,
        horizontal ? roadWidth : height,
      ),
      material,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.03;
    road.receiveShadow = true;
    scene.add(road);
  };

  addStrip(true);
  if (
    !["Straight Road", "Pedestrian Crossing"].includes(
      reconstruction.scene.roadLayout,
    )
  ) {
    addStrip(false);
  }
}

/*
 * [RoadSafe:ImpulseDrivenImpactVisualizationV1]
 */
function applyImpactPose(
  entry: ParticipantRenderEntry,
  currentTime: number,
  response:
    ParticipantImpactResponse | undefined,
  participantHeadingDegrees: number,
  enabled: boolean,
): void {
  const root =
    entry.modelRoot;

  root.position.set(
    0,
    0,
    0,
  );

  root.rotation.set(
    0,
    0,
    0,
  );

  root.scale.set(
    1,
    1,
    1,
  );

  if (
    !enabled ||
    !response
  ) {
    return;
  }

  const dimensions =
    participantDimensions(
      entry.participant,
    );

  const pose =
    getParticipantImpactVisualPose({
      response,
      currentTimeSeconds:
        currentTime,
      participantHeadingDegrees,
      participantHeightMetres:
        dimensions[1],
    });

  root.position.y =
    pose.verticalMetres;

  root.rotation.set(
    THREE.MathUtils.degToRad(
      pose.rotationXDegrees,
    ),
    THREE.MathUtils.degToRad(
      pose.rotationYDegrees,
    ),
    THREE.MathUtils.degToRad(
      pose.rotationZDegrees,
    ),
  );
}

function Reconstruction3DViewer({
  reconstruction,
  onSwitchTo2D,
  onRunPhysics,
  onPreparePlayback,
  compact = false,
  workspaceMode = false,
  selectedParticipantId = null,
  onSelectParticipant,
  cameraCycleToken = 0,
  workspaceTimeSeconds,
  workspaceTimeSourceRef,
  workspacePlaying,
  workspacePlaybackSpeed,
  workspaceCameraMode,
  workspaceLayers,
  workspaceTool = "Select",
}: Reconstruction3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const timeRef = useRef(workspaceTimeSeconds ?? 0);
  const workspaceTimeRef = useRef(workspaceTimeSeconds ?? 0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const cameraModeRef = useRef<CameraMode>("Orbit");
  const selectedRef = useRef<string | null>(selectedParticipantId);
  const onSelectRef = useRef(onSelectParticipant);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(workspaceTimeSeconds ?? 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("Orbit");
  const [showPaths, setShowPaths] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [showEvidence, setShowEvidence] = useState(true);
  const [showPhysicsEffects, setShowPhysicsEffects] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [assetStatus, setAssetStatus] = useState({ loaded: 0, total: 0, failed: 0 });

  const controlledWorkspace = workspaceMode && workspaceTimeSeconds !== undefined;
  const effectivePlaying = controlledWorkspace ? Boolean(workspacePlaying) : isPlaying;
  const effectiveSpeed = controlledWorkspace
    ? workspacePlaybackSpeed ?? 1
    : playbackSpeed;
  const effectiveCameraMode = workspaceMode && workspaceCameraMode
    ? workspaceCameraMode
    : cameraMode;
  const effectiveShowPaths = workspaceLayers?.paths ?? showPaths;
  const effectiveShowObjects = workspaceLayers?.objects ?? showObjects;
  const effectiveShowEvidence = workspaceLayers?.evidence ?? showEvidence;
  const effectiveShowPhysics = workspaceLayers?.physics ?? showPhysicsEffects;
  const visibleTime = controlledWorkspace ? workspaceTimeSeconds ?? 0 : displayTime;

  useEffect(() => {
    playingRef.current = effectivePlaying;
  }, [effectivePlaying]);
  useEffect(() => {
    speedRef.current = effectiveSpeed;
  }, [effectiveSpeed]);
  useEffect(() => {
    cameraModeRef.current = effectiveCameraMode;
  }, [effectiveCameraMode]);
  useEffect(() => {
    selectedRef.current = selectedParticipantId;
  }, [selectedParticipantId]);
  useEffect(() => {
    onSelectRef.current = onSelectParticipant;
  }, [onSelectParticipant]);
  useEffect(() => {
    if (!controlledWorkspace || workspaceTimeSeconds === undefined) return;
    workspaceTimeRef.current = workspaceTimeSeconds;
    timeRef.current = workspaceTimeSeconds;
  }, [controlledWorkspace, workspaceTimeSeconds]);

  useEffect(() => {
    if (!workspaceMode || cameraCycleToken <= 0) return;
    const modes: CameraMode[] = ["Orbit", "Overhead", "Roadside", "Driver"];
    setCameraMode((current) => modes[(modes.indexOf(current) + 1) % modes.length]);
  }, [cameraCycleToken, workspaceMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const { widthMetres: width, heightMetres: height } =
      getReconstructionWorldDimensions(reconstruction);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      reconstruction.scene.timeOfDay === "Night" ? 0x030916 : 0x74818a,
    );
    scene.fog = new THREE.FogExp2(
      scene.background as THREE.Color,
      reconstruction.scene.timeOfDay === "Night" ? 0.014 : 0.006,
    );

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(width * 0.58, Math.max(width, height) * 0.72, height * 0.62);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = reconstruction.scene.timeOfDay === "Night" ? 0.8 : 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minDistance = 4;
    controls.maxDistance = Math.max(width, height) * 1.7;
    controls.maxPolarAngle = Math.PI / 2.02;
    if (workspaceTool === "Move") {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    } else if (workspaceTool === "Scale") {
      controls.mouseButtons.LEFT = THREE.MOUSE.DOLLY;
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }

    scene.add(
      new THREE.HemisphereLight(
        reconstruction.scene.timeOfDay === "Night" ? 0x667b9c : 0xe5edf2,
        0x354035,
        reconstruction.scene.timeOfDay === "Night" ? 0.7 : 1.4,
      ),
    );
    const sun = new THREE.DirectionalLight(0xfff4df, 1.9);
    sun.position.set(-30, 45, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const shadowExtent = Math.max(width, height) * 0.75;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    scene.add(sun);

    const extracted = reconstruction.scene.realSceneGeometry?.status === "ready"
      ? reconstruction.scene.realSceneGeometry
      : null;
    if (extracted) {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ color: 0x4d5b4d, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.03;
      ground.receiveShadow = true;
      scene.add(ground);
      addRealSceneGeometryToThreeScene({
        scene,
        geometry: extracted,
        showPavements: reconstruction.scene.showPavements,
        showLaneMarkings: reconstruction.scene.showLaneMarkings,
        wet: reconstruction.scene.roadSurface === "Wet",
      });
    } else {
      addGeneratedRoad(scene, reconstruction, width, height);
    }

    const participantEntries = new Map<string, ParticipantRenderEntry>();
    let disposed = false;
    let loadedAssets = 0;
    let failedAssets = 0;
    const visibleObjectCount = effectiveShowObjects
      ? reconstruction.sceneObjects.filter((object) => object.visible).length
      : 0;
    const totalAssets = reconstruction.vehicles.length + visibleObjectCount;
    setAssetStatus({ loaded: 0, total: totalAssets, failed: 0 });
    const settleAsset = (failed = false) => {
      if (disposed) return;
      loadedAssets += 1;
      if (failed) failedAssets += 1;
      setAssetStatus({ loaded: loadedAssets, total: totalAssets, failed: failedAssets });
    };

    reconstruction.vehicles.forEach((participant) => {
      const entry = createParticipantHolder(participant);
      scene.add(entry.holder);
      participantEntries.set(participant.id, entry);
      void loadRealisticParticipantModel(participant, participantDimensions(participant))
        .then((model) => {
          if (disposed) {
            disposeObjectTree(model);
            return;
          }
          const previous = [...entry.modelRoot.children];
          previous.forEach((child) => {
            entry.modelRoot.remove(child);
            disposeObjectTree(child);
          });
          applyExactParticipantColour(model, participant);
          entry.modelRoot.add(model);
          entry.holder.traverse((object) => {
            object.userData.participantId = participant.id;
          });
          settleAsset(false);
        })
        .catch(() => settleAsset(true));

      if (effectiveShowPaths) {
        const authoredPoints =
          getParticipantPlaybackPathPoints(
            participant,
          ).filter(
            (point) =>
              !isPhysicsGeneratedPathPoint(
                point,
              ),
          );
        const positions = authoredPoints.map((point) =>
          worldPosition(point.position, width, height, 0.18),
        );
        if (positions.length > 1) {
          const roadGraphControlled = authoredPoints.some(
            (point) =>
              point.notes?.includes(AUTO_ROAD_CURVE_NOTE_MARKER) === true,
          );
          const renderedPoints = roadGraphControlled
            ? positions
            : new THREE.CatmullRomCurve3(
                positions,
                false,
                "centripetal",
                0.5,
              ).getPoints(Math.max(18, positions.length * 8));
          const path = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(renderedPoints),
            new THREE.LineBasicMaterial({
              color: PARTICIPANT_COLOURS[participant.colour] ?? 0xffffff,
              transparent: true,
              opacity: 0.85,
            }),
          );
          scene.add(path);
        }
      }
    });

    if (effectiveShowObjects) {
      reconstruction.sceneObjects
        .filter((object) => object.visible)
        .forEach((object) => {
          if (object.tracePoints && object.tracePoints.length > 1) {
            const line = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(
                object.tracePoints.map((point) =>
                  worldPosition(point, width, height, 0.12),
                ),
              ),
              new THREE.LineBasicMaterial({ color: 0x111827 }),
            );
            scene.add(line);
            settleAsset(false);
            return;
          }
          const holder = new THREE.Group();
          const fallback = createFallbackSceneObject(object);
          holder.add(fallback);
          holder.position.copy(worldPosition(object.position, width, height));
          holder.rotation.y = -THREE.MathUtils.degToRad(object.rotation);
          scene.add(holder);
          void loadRealisticSceneObjectModel(object)
            .then((model) => {
              if (!model) {
                settleAsset(false);
                return;
              }
              if (disposed) {
                disposeObjectTree(model);
                return;
              }
              holder.remove(fallback);
              disposeObjectTree(fallback);
              holder.add(model);
              settleAsset(false);
            })
            .catch(() => settleAsset(true));
        });
    }

    if (effectiveShowEvidence) {
      reconstruction.evidenceRecords.forEach((record) => {
        const marker = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 1.1, 10),
          new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
        );
        marker.position.copy(worldPosition(record.position, width, height, 0.55));
        scene.add(marker);
      });
      reconstruction.measurements.forEach((measurement) => {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            worldPosition(measurement.start, width, height, 0.16),
            worldPosition(measurement.end, width, height, 0.16),
          ]),
          new THREE.LineDashedMaterial({
            color: 0x38bdf8,
            dashSize: 0.5,
            gapSize: 0.3,
          }),
        );
        line.computeLineDistances();
        scene.add(line);
      });
    }

    const collisionEvents =
      reconstruction.lastPhysicsSimulation?.collisionEvents ?? [];
    const participantImpact = collisionEvents
      .filter((event) => event.type === "Participant-Participant")
      .sort((left, right) => left.timeSeconds - right.timeSeconds)[0];
    const impactByParticipant =
      indexEarliestParticipantImpactResponses(
        collisionEvents,
      );

    // Point Z and the visible primary marker are authoritative in both views.
    // A physics contact can be reported a few centimetres away because bodies
    // have dimensions, but it must not move the investigator's crash marker.
    const collisionPoint = worldPosition(
      reconstruction.collisionPoint,
      width,
      height,
      0.2,
    );
    const collisionMarker = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.14, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    );
    collisionMarker.rotation.x = Math.PI / 2;
    collisionMarker.position.copy(collisionPoint);
    scene.add(collisionMarker);
    const impactLight = new THREE.PointLight(0xff4a22, 0, 18);
    impactLight.position.copy(collisionPoint).add(new THREE.Vector3(0, 2, 0));
    scene.add(impactLight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      if (!onSelectRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(
          [...participantEntries.values()].map((entry) => entry.holder),
          true,
        )
        .find((intersection) => {
          let current: THREE.Object3D | null = intersection.object;
          while (current) {
            if (current.userData.participantId) return true;
            current = current.parent;
          }
          return false;
        });
      if (!hit) return;
      let current: THREE.Object3D | null = hit.object;
      while (current && !current.userData.participantId) current = current.parent;
      const id = current?.userData.participantId as string | undefined;
      if (id) onSelectRef.current(id);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver(() => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    let animationId = 0;
    let previous = performance.now();
    let lastUiUpdate = 0;
    const animate = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;

      if (controlledWorkspace) {
        timeRef.current =
          workspaceTimeSourceRef?.current ?? workspaceTimeRef.current;
      } else if (playingRef.current) {
        timeRef.current = Math.min(
          reconstruction.durationSeconds,
          timeRef.current + delta * speedRef.current,
        );
        if (timeRef.current >= reconstruction.durationSeconds) {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }

      participantEntries.forEach((entry) => {
        const state = getParticipantStateAtTime(
                        entry.participant,
                        timeRef.current,
                        { widthMetres: width, heightMetres: height },
                      );
        entry.holder.position.copy(worldPosition(state.position, width, height));
        // Use the exact shared trajectory heading returned to the 2D view.
        // The old 3D-only time sampling could disagree at Point 1 and caused
        // a visible snap as playback began. Positive Three.js Y rotation maps
        // screen-space clockwise headings onto the reconstruction ground plane.
        entry.holder.rotation.set(
          0,
          reconstructionHeadingToThreeYawRadians(
            state.rotation,
          ),
          0,
        );
        entry.label.visible = selectedRef.current === null || selectedRef.current === entry.participant.id;

        const impact = impactByParticipant.get(entry.participant.id);
        applyImpactPose(
          entry,
          timeRef.current,
          impact,
          state.rotation,
          effectiveShowPhysics,
        );
        const potholeEffect = getParticipantPotholeEffect(
          reconstruction,
          entry.participant,
          state.position,
          state.speedKmh,
          timeRef.current,
        );
        if (
          effectiveShowPhysics &&
          potholeEffect.active
        ) {
          entry.modelRoot.position.y += potholeEffect.verticalMetres;
          entry.modelRoot.rotation.x += THREE.MathUtils.degToRad(
            potholeEffect.pitchDegrees,
          );
          entry.modelRoot.rotation.z += THREE.MathUtils.degToRad(
            potholeEffect.rollDegrees,
          );
        }
      });

      const impactTime = participantImpact?.timeSeconds;
      const impactDelta = impactTime === undefined
        ? Number.POSITIVE_INFINITY
        : Math.abs(timeRef.current - impactTime);
      impactLight.intensity =
        effectiveShowPhysics && impactDelta < 0.35
          ? (1 - impactDelta / 0.35) * 18
          : 0;

      const mode = cameraModeRef.current;
      controls.enabled = mode === "Orbit";
      if (mode === "Overhead") {
        camera.position.lerp(
          new THREE.Vector3(0, Math.max(width, height) * 1.05, 0.01),
          0.1,
        );
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
      } else if (mode === "Roadside") {
        camera.up.set(0, 1, 0);
        camera.position.lerp(new THREE.Vector3(width * 0.12, 6, height * 0.46), 0.08);
        camera.lookAt(0, 0.8, 0);
      } else if (mode === "Driver") {
        const selected =
          (selectedRef.current
            ? participantEntries.get(selectedRef.current)
            : undefined) ??
          (participantEntries.values().next().value as
            | ParticipantRenderEntry
            | undefined);
        if (selected) {
          const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(
            selected.holder.quaternion,
          );
          const desired = selected.holder.position
            .clone()
            .add(new THREE.Vector3(0, 1.55, 0))
            .addScaledVector(direction, -1.2);
          camera.position.lerp(desired, 0.14);
          camera.up.set(0, 1, 0);
          camera.lookAt(
            selected.holder.position
              .clone()
              .add(new THREE.Vector3(0, 1.1, 0))
              .addScaledVector(direction, 10),
          );
        }
      } else {
        camera.up.set(0, 1, 0);
        controls.update();
      }

      if (!controlledWorkspace && now - lastUiUpdate > 80) {
        lastUiUpdate = now;
        setDisplayTime(timeRef.current);
      }
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animationId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.dispose();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.Sprite
        ) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (controlsRef.current === controls) controlsRef.current = null;
    };
  }, [
    controlledWorkspace,
    effectiveShowEvidence,
    effectiveShowObjects,
    effectiveShowPaths,
    effectiveShowPhysics,
    reconstruction,
    workspaceMode,
    workspaceTimeSourceRef,
    workspaceTool,
  ]);

  const setTime = (value: number) => {
    const next = clamp(value, 0, reconstruction.durationSeconds);
    timeRef.current = next;
    setDisplayTime(next);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (timeRef.current >= reconstruction.durationSeconds) setTime(0);
    if (timeRef.current <= 0.01 || timeRef.current >= reconstruction.durationSeconds) {
      onPreparePlayback();
    }
    setIsPlaying(true);
  };

  return (
    <section
      className={`reconstruction-3d ui-panel flex min-h-0 flex-col overflow-hidden ${
        expanded ? "fixed inset-3 z-[120]" : ""
      } ${compact ? "reconstruction-3d--compact h-full" : ""} ${
        workspaceMode ? "reconstruction-3d--workspace" : ""
      }`}
    >
      {!workspaceMode && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#494949] bg-[#292929] ${
            compact ? "px-3 py-2" : "px-4 py-3"
          }`}
        >
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-200">
              3D Reconstruction
            </h2>
            {!compact && (
              <p className="mt-1 text-[9px] text-slate-600">
                Calibrated physical scene, participant routes and evidence layers.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!compact && (
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setTime(0);
                  onRunPhysics();
                }}
                className="ui-button py-1.5"
              >
                Recalculate
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                onSwitchTo2D();
              }}
              className="ui-button py-1.5"
            >
              2D view
            </button>
            <select
              value={cameraMode}
              onChange={(event) => setCameraMode(event.target.value as CameraMode)}
              className="ui-input py-1.5"
            >
              <option>Orbit</option>
              <option>Overhead</option>
              <option>Roadside</option>
              <option>Driver</option>
            </select>
            {!compact && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="ui-button-primary py-1.5"
              >
                {expanded ? "Exit full view" : "Expand"}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={`relative min-h-0 w-full flex-1 bg-[#303030] ${
          expanded ? "flex-1" : ""
        }`}
        style={
          expanded || workspaceMode
            ? undefined
            : compact
              ? { minHeight: "270px" }
              : { height: "min(72vh, 760px)", minHeight: "520px" }
        }
      >
        <div ref={mountRef} className="absolute inset-0" />
        {!workspaceMode && (
          <button
            type="button"
            onClick={handlePlayPause}
            className="ui-button-primary absolute left-3 top-3 z-10 min-w-20 shadow-xl"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        )}
        <div className="pointer-events-none absolute right-3 top-3 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[8px] text-slate-300 backdrop-blur">
          {getReconstructionWorldDimensions(reconstruction).source} Ãƒâ€šÃ‚Â· {effectiveCameraMode}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur">
          {visibleTime.toFixed(1)}s
        </div>
        <div
          className="pointer-events-none absolute bottom-3 left-3 max-w-[65%] rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[8px] text-slate-400 backdrop-blur"
          title={THIRD_PARTY_3D_ASSET_NOTICE}
        >
          {assetStatus.total > 0 && assetStatus.loaded < assetStatus.total
            ? `Loading realistic assets ${assetStatus.loaded}/${assetStatus.total}`
            : assetStatus.failed > 0
              ? `Realistic assets ready Ãƒâ€šÃ‚Â· ${assetStatus.failed} fallback(s)`
              : "Realistic GLB/PBR assets ready"}
        </div>
      </div>

      {!workspaceMode && (
        <div
          className={`border-t border-[#494949] bg-[#292929] ${
            compact ? "px-3 py-2" : "p-4"
          }`}
        >
          <input
            type="range"
            min={0}
            max={reconstruction.durationSeconds}
            step={0.01}
            value={displayTime}
            onChange={(event) => {
              setIsPlaying(false);
              setTime(Number(event.target.value));
            }}
            className="roadsafe-range w-full"
          />
          <div
            className={`flex flex-wrap items-center justify-between gap-3 ${
              compact ? "mt-1.5" : "mt-3"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setTime(0);
                }}
                className="ui-button py-1.5"
              >
                Reset
              </button>
              <span className="text-[9px] font-semibold text-slate-400">
                {displayTime.toFixed(1)}s / {reconstruction.durationSeconds.toFixed(1)}s
              </span>
            </div>
            {!compact && (
              <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-400">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPaths}
                    onChange={(event) => setShowPaths(event.target.checked)}
                  />
                  Paths
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showObjects}
                    onChange={(event) => setShowObjects(event.target.checked)}
                  />
                  Objects
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showEvidence}
                    onChange={(event) => setShowEvidence(event.target.checked)}
                  />
                  Evidence
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPhysicsEffects}
                    onChange={(event) => setShowPhysicsEffects(event.target.checked)}
                  />
                  Physics
                </label>
                <select
                  value={playbackSpeed}
                  onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                  className="ui-input py-1.5"
                >
                  <option value={0.5}>0.5ÃƒÆ’Ã¢â‚¬â€</option>
                  <option value={1}>1ÃƒÆ’Ã¢â‚¬â€</option>
                  <option value={1.5}>1.5ÃƒÆ’Ã¢â‚¬â€</option>
                  <option value={2}>2ÃƒÆ’Ã¢â‚¬â€</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(Reconstruction3DViewer);
