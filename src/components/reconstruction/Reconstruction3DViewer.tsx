import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type {
  AccidentReconstruction,
  ReconstructionPosition,
  ReconstructionSceneObject,
  ReconstructionVehicle,
} from "../../types/reconstruction";
import { getParticipantStateAtTime, sortMovementPathPoints } from "../../utils/reconstructionGeometry";

interface Reconstruction3DViewerProps {
  reconstruction: AccidentReconstruction;
  onSwitchTo2D: () => void;
  onRunPhysics: () => void;
}

type CameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";

const PARTICIPANT_COLOURS: Record<string, number> = {
  Blue: 0x2563eb, Red: 0xdc2626, Green: 0x16a34a, Yellow: 0xeab308,
  Black: 0x111827, White: 0xf8fafc, Orange: 0xea580c, Purple: 0x9333ea,
};

function worldPosition(position: ReconstructionPosition, width: number, height: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3((position.x / 100 - 0.5) * width, y, (position.y / 100 - 0.5) * height);
}

function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(15,23,42,0.88)";
    context.roundRect(8, 8, 496, 104, 22);
    context.fill();
    context.font = "bold 42px Arial";
    context.fillStyle = "white";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 60);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(7, 1.75, 1);
  return sprite;
}

function participantDimensions(participant: ReconstructionVehicle): [number, number, number] {
  switch (participant.type) {
    case "Bus": return [8.5, 3.2, 2.6];
    case "Truck": return [7.5, 3.4, 2.8];
    case "Motorcycle": return [2.2, 1.25, 0.75];
    case "Bicycle": return [1.8, 1.2, 0.55];
    case "Pedestrian":
    case "Officer":
    case "Witness": return [0.65, 1.75, 0.65];
    default: return [4.4, 1.55, 1.85];
  }
}

function addBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function addWheel(group: THREE.Group, x: number, y: number, z: number, radius: number, width: number, material: THREE.Material) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 10), material);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(x, y, z);
  wheel.castShadow = true;
  wheel.userData.isWheel = true;
  wheel.userData.baseRotationX = wheel.rotation.x;
  wheel.userData.wheelSide = z < 0 ? -1 : 1;
  group.add(wheel);
}

function addVehicleLights(group: THREE.Group, length: number, height: number, width: number) {
  const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
  const rearLightMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  for (const z of [-width * 0.31, width * 0.31]) {
    addBox(group, [0.08, height * 0.12, width * 0.18], [length * 0.505, height * 0.45, z], headlightMaterial);
    addBox(group, [0.08, height * 0.12, width * 0.18], [-length * 0.505, height * 0.45, z], rearLightMaterial);
  }
}

function createPersonModel(participant: ReconstructionVehicle, colour: number): THREE.Group {
  const group = new THREE.Group();
  const clothes = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x273244, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97850, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: participant.type === "Officer" ? 0xdbeafe : 0xf8fafc, roughness: 0.8 });

  addBox(group, [0.42, 0.72, 0.30], [0, 1.12, 0], clothes);
  addBox(group, [0.16, 0.66, 0.18], [0, 0.48, -0.14], dark, [0.08, 0, 0]);
  addBox(group, [0.16, 0.66, 0.18], [0, 0.48, 0.14], dark, [-0.08, 0, 0]);
  addBox(group, [0.14, 0.68, 0.16], [0, 1.1, -0.29], skin, [0.08, 0, -0.05]);
  addBox(group, [0.14, 0.68, 0.16], [0, 1.1, 0.29], skin, [-0.08, 0, 0.05]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), skin);
  head.position.set(0, 1.72, 0);
  head.castShadow = true;
  group.add(head);
  if (participant.type === "Officer") {
    addBox(group, [0.05, 0.58, 0.33], [0.218, 1.14, 0], accent);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.10, 12), dark);
    cap.position.set(0, 1.94, 0);
    group.add(cap);
  } else if (participant.type === "Witness") {
    addBox(group, [0.06, 0.18, 0.18], [0.23, 1.25, 0], accent);
  }
  return group;
}

function createTwoWheelerModel(participant: ReconstructionVehicle, colour: number): THREE.Group {
  const group = new THREE.Group();
  const bicycle = participant.type === "Bicycle";
  const wheelRadius = bicycle ? 0.46 : 0.42;
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: colour, metalness: 0.35, roughness: 0.52 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.3 });
  for (const x of [-0.72, 0.72]) addWheel(group, x, wheelRadius, 0, wheelRadius, bicycle ? 0.08 : 0.17, wheelMaterial);
  addBox(group, [1.12, 0.10, 0.10], [0, 0.55, 0], metal, [0, 0, -0.12]);
  addBox(group, [0.90, 0.09, 0.09], [-0.18, 0.72, 0], metal, [0, 0, 0.52]);
  addBox(group, [0.82, 0.09, 0.09], [-0.28, 0.72, 0], metal, [0, 0, -0.65]);
  addBox(group, [0.08, 0.72, 0.08], [0.62, 0.78, 0], chrome, [0, 0, -0.12]);
  addBox(group, [0.08, 0.08, 0.72], [0.66, 1.10, 0], chrome);
  addBox(group, [0.38, 0.10, bicycle ? 0.14 : 0.32], [-0.18, 1.0, 0], new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }));
  if (!bicycle) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), metal);
    tank.scale.set(1.2, 0.75, 0.65);
    tank.position.set(0.18, 0.88, 0);
    group.add(tank);
    addBox(group, [0.34, 0.28, 0.38], [-0.52, 0.74, 0], new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.25, roughness: 0.6 }));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 7), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    lamp.position.set(0.78, 0.94, 0);
    group.add(lamp);
  }
  return group;
}

function createParticipantMesh(participant: ReconstructionVehicle): THREE.Group {
  const group = new THREE.Group();
  const [length, height, width] = participantDimensions(participant);
  const colour = PARTICIPANT_COLOURS[participant.colour] ?? 0x2563eb;
  const human = ["Pedestrian", "Officer", "Witness"].includes(participant.type);
  if (human) {
    group.add(createPersonModel(participant, colour));
  } else if (participant.type === "Motorcycle" || participant.type === "Bicycle") {
    group.add(createTwoWheelerModel(participant, colour));
  } else {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: colour, metalness: 0.18, roughness: 0.52 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x8bc4df, metalness: 0.25, roughness: 0.22 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x202938, metalness: 0.3, roughness: 0.55 });
    addBox(group, [length, height * 0.48, width], [0, height * 0.39, 0], bodyMaterial);

    if (participant.type === "Truck") {
      addBox(group, [length * 0.58, height * 0.72, width * 0.96], [-length * 0.18, height * 0.87, 0], new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72 }));
      addBox(group, [length * 0.29, height * 0.62, width * 0.92], [length * 0.34, height * 0.78, 0], bodyMaterial);
      addBox(group, [0.05, height * 0.26, width * 0.70], [length * 0.488, height * 0.91, 0], glassMaterial);
    } else if (participant.type === "Bus") {
      addBox(group, [length * 0.98, height * 0.69, width * 0.96], [0, height * 0.82, 0], bodyMaterial);
      for (let index = -3; index <= 3; index += 1) for (const z of [-width * 0.485, width * 0.485]) {
        addBox(group, [length * 0.095, height * 0.25, 0.035], [index * length * 0.12, height * 0.98, z], glassMaterial);
      }
      addBox(group, [0.05, height * 0.30, width * 0.73], [length * 0.492, height * 0.98, 0], glassMaterial);
    } else {
      addBox(group, [length * 0.52, height * 0.43, width * 0.84], [-length * 0.04, height * 0.82, 0], glassMaterial, [0, 0, 0.02]);
      addBox(group, [length * 0.18, height * 0.07, width * 0.78], [length * 0.38, height * 0.68, 0], bodyMaterial, [0, 0, -0.08]);
      for (const z of [-width * 0.505, width * 0.505]) addBox(group, [0.50, 0.05, 0.18], [length * 0.05, height * 0.89, z], trimMaterial);
    }
    const wheelXs = participant.type === "Bus" ? [-length * 0.34, length * 0.34] : participant.type === "Truck" ? [-length * 0.32, length * 0.31] : [-length * 0.31, length * 0.31];
    for (const x of wheelXs) for (const z of [-width * 0.52, width * 0.52]) addWheel(group, x, height * 0.22, z, height * 0.19, 0.24, wheelMaterial);
    addBox(group, [length * 0.96, 0.08, width * 1.02], [0, height * 0.18, 0], trimMaterial);
    addVehicleLights(group, length, height, width);
  }
  const modelRoot = new THREE.Group();
  const modelParts = [...group.children];
  group.remove(...modelParts);
  modelRoot.add(...modelParts);
  modelRoot.userData.isParticipantModel = true;
  group.userData.modelRoot = modelRoot;
  group.add(modelRoot);
  const label = createTextSprite(participant.name);
  label.position.y = height + 1.4;
  label.userData.isLabel = true;
  group.add(label);
  return group;
}

function applyPostImpactPose(
  mesh: THREE.Group,
  participant: ReconstructionVehicle,
  currentTime: number,
  impactTime: number | undefined,
  impactSpeedKmh: number,
  activeAction: string,
) {
  const modelRoot = mesh.userData.modelRoot as THREE.Group | undefined;
  if (!modelRoot) return;
  modelRoot.position.set(0, 0, 0);
  modelRoot.rotation.set(0, 0, 0);
  modelRoot.scale.set(1, 1, 1);
  modelRoot.traverse((part) => {
    if (part.userData.isWheel) {
      part.rotation.x = part.userData.baseRotationX as number;
      part.rotation.y = 0;
      part.rotation.z = 0;
    }
  });
  if (impactTime === undefined || currentTime < impactTime) return;

  const elapsed = currentTime - impactTime;
  const severity = THREE.MathUtils.clamp(impactSpeedKmh / 70, 0.2, 1);
  const human = ["Pedestrian", "Officer", "Witness"].includes(participant.type);
  const twoWheeler = participant.type === "Bicycle" || participant.type === "Motorcycle";

  if (human) {
    const launchVelocity = THREE.MathUtils.clamp(3.8 + impactSpeedKmh / 24, 4.2, 7.5);
    const flightDuration = (2 * launchVelocity) / 9.81;
    if (elapsed < flightDuration) {
      modelRoot.position.y = Math.max(0, launchVelocity * elapsed - 4.905 * elapsed * elapsed);
      modelRoot.rotation.x = elapsed * (5.2 + severity * 3.4);
      modelRoot.rotation.z = elapsed * (2.4 + severity * 2.8);
    } else {
      const landingElapsed = elapsed - flightDuration;
      const landingBounce = Math.abs(Math.sin(landingElapsed * 9)) * Math.exp(-landingElapsed * 4) * 0.42;
      modelRoot.position.y = 0.12 + landingBounce;
      modelRoot.rotation.x = Math.PI / 2 + Math.sin(landingElapsed * 7) * Math.exp(-landingElapsed * 3) * 0.35;
      modelRoot.rotation.z = 0.22 + Math.sin(landingElapsed * 5) * Math.exp(-landingElapsed * 3) * 0.18;
    }
    return;
  }

  if (twoWheeler) {
    const fallProgress = THREE.MathUtils.smoothstep(elapsed, 0, 0.9);
    const rebound = Math.abs(Math.sin(elapsed * 8)) * Math.exp(-elapsed * 2.8);
    modelRoot.position.y = rebound * (0.7 + severity * 0.45);
    modelRoot.rotation.x = fallProgress * (Math.PI * 0.47) + rebound * 0.28;
    modelRoot.rotation.z = elapsed < 1.5 ? elapsed * severity * 2.2 : 1.5 * severity * 2.2;
    modelRoot.scale.x = 1 - fallProgress * severity * 0.11;
    modelRoot.scale.z = 1 - fallProgress * severity * 0.16;
    modelRoot.traverse((part) => {
      if (!part.userData.isWheel) return;
      const side = part.userData.wheelSide as number;
      part.rotation.x = (part.userData.baseRotationX as number) + fallProgress * side * severity * 0.24;
      part.rotation.y = fallProgress * side * severity * 0.32;
    });
    return;
  }

  const recoil = Math.sin(elapsed * 11) * Math.exp(-elapsed * 3.1);
  const settle = THREE.MathUtils.smoothstep(elapsed, 0, 0.65);
  const deflecting = ["Ricochet", "Deflect", "Swerve", "Slide"].includes(activeAction);
  modelRoot.position.y = Math.abs(recoil) * 0.28 * severity;
  modelRoot.rotation.z = recoil * 0.16 * severity + (deflecting ? Math.sin(elapsed * 4.2) * Math.exp(-elapsed * 0.7) * 0.11 : 0);
  modelRoot.rotation.x = -recoil * 0.08 * severity;
  modelRoot.scale.x = 1 - settle * severity * (participant.type === "Car" ? 0.055 : 0.025);
  modelRoot.scale.y = 1 + settle * severity * 0.018;
}

function objectColour(object: ReconstructionSceneObject): number {
  if (["Pothole", "Road Crack", "Skid Mark", "Tyre Mark"].includes(object.type)) return 0x1f2937;
  if (["Puddle", "Oil Spill"].includes(object.type)) return 0x155e75;
  if (["Traffic Cone", "Road Barrier"].includes(object.type)) return 0xf97316;
  if (["Tree", "Bush"].includes(object.type)) return 0x166534;
  if (object.category === "Physical Evidence") return 0xfacc15;
  if (object.category === "Traffic Control") return 0xdc2626;
  return 0x64748b;
}

function createSceneObjectMesh(object: ReconstructionSceneObject): THREE.Object3D {
  const flat = ["Pothole", "Road Crack", "Puddle", "Oil Spill", "Loose Gravel", "Skid Mark", "Tyre Mark"].includes(object.type);
  const tree = object.type === "Tree" || object.type === "Bush";
  const material = new THREE.MeshStandardMaterial({ color: objectColour(object), roughness: 0.8, transparent: flat, opacity: flat ? 0.72 : 1 });
  if (object.tracePoints && object.tracePoints.length > 1) {
    return new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: objectColour(object) }));
  }
  if (flat) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.25 * object.scale, 1.25 * object.scale, 0.08, 24), material);
    mesh.position.y = 0.05;
    return mesh;
  }
  if (tree) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.36, 2.5, 10), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    trunk.position.y = 1.25;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5 * object.scale, 18, 12), material);
    crown.position.y = 3;
    group.add(trunk, crown);
    return group;
  }
  const height = ["Street Light", "Traffic Light", "CCTV Camera"].includes(object.type) ? 4.5 : 1.4;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4 * object.scale, height * object.scale, 1.4 * object.scale), material);
  mesh.position.y = height * object.scale / 2;
  mesh.castShadow = true;
  return mesh;
}

function addRoad(scene: THREE.Scene, reconstruction: AccidentReconstruction) {
  const { sceneWidthMetres: width, sceneHeightMetres: height, roadLayout } = reconstruction.scene;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.5, height * 1.5), new THREE.MeshStandardMaterial({ color: 0x526c46, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: reconstruction.scene.roadSurface === "Wet" ? 0x30363d : 0x4b5563, roughness: reconstruction.scene.roadSurface === "Wet" ? 0.35 : 0.9 });
  const roadWidth = Math.min(16, 6 + reconstruction.scene.laneCount * 3.2);
  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(width * 1.15, 0.12, roadWidth), roadMaterial);
  horizontal.position.y = 0.06;
  horizontal.receiveShadow = true;
  scene.add(horizontal);
  if (roadLayout !== "Straight Road") {
    const verticalLength = roadLayout === "T-Junction" ? height * 0.6 : height * 1.15;
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.13, verticalLength), roadMaterial);
    vertical.position.set(0, 0.065, roadLayout === "T-Junction" ? height * 0.27 : 0);
    vertical.receiveShadow = true;
    scene.add(vertical);
  }
  const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  for (let x = -width / 2; x < width / 2; x += 7) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.12), markingMaterial);
    dash.position.set(x, 0.15, 0);
    scene.add(dash);
  }
  if (roadLayout !== "Straight Road") for (let z = -height / 2; z < height / 2; z += 7) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 3.2), markingMaterial);
    dash.position.set(0, 0.16, z);
    scene.add(dash);
  }
}

function Reconstruction3DViewer({ reconstruction, onSwitchTo2D, onRunPhysics }: Reconstruction3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const speedRef = useRef(1);
  const cameraModeRef = useRef<CameraMode>("Orbit");
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("Orbit");
  const [showPaths, setShowPaths] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [showEvidence, setShowEvidence] = useState(true);
  const [showPhysicsEffects, setShowPhysicsEffects] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = reconstruction.scene.sceneWidthMetres;
    const height = reconstruction.scene.sceneHeightMetres;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(reconstruction.scene.timeOfDay === "Night" ? 0x07111f : 0xb8d8ed);
    scene.fog = new THREE.Fog(scene.background, Math.max(width, height) * 0.8, Math.max(width, height) * 2.3);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(width * 0.65, Math.max(width, height) * 0.7, height * 0.7);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.minDistance = 5;
    controls.maxDistance = Math.max(width, height) * 2;
    scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x334422, reconstruction.scene.timeOfDay === "Night" ? 0.7 : 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, reconstruction.scene.timeOfDay === "Night" ? 0.8 : 2.4);
    sun.position.set(-30, 48, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    addRoad(scene, reconstruction);

    const participantMeshes = new Map<string, THREE.Group>();
    const velocityArrows = new Map<string, THREE.ArrowHelper>();
    const smokeEffects = new Map<string, THREE.Group>();
    const impactDynamics = new Map<string, { time: number | undefined; speedKmh: number }>();
    reconstruction.vehicles.forEach((participant) => {
      const sortedPoints = sortMovementPathPoints(participant.pathPoints);
      const impactPoint = sortedPoints.find((point) => point.action === "Impact");
      impactDynamics.set(participant.id, {
        time: impactPoint?.timeSeconds,
        speedKmh: impactPoint?.speedKmh ?? participant.estimatedSpeedKmh,
      });
      const mesh = createParticipantMesh(participant);
      scene.add(mesh);
      participantMeshes.set(participant.id, mesh);
      if (showPhysicsEffects) {
        const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 2, PARTICIPANT_COLOURS[participant.colour] ?? 0xffffff, 0.65, 0.35);
        scene.add(arrow);
        velocityArrows.set(participant.id, arrow);

        const smoke = new THREE.Group();
        for (let index = 0; index < 4; index += 1) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(0.28 + index * 0.08, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xd1d5db, transparent: true, opacity: 0.32 - index * 0.05, depthWrite: false }),
          );
          puff.position.set(-index * 0.45, 0.25 + index * 0.13, (index % 2 ? 1 : -1) * 0.18);
          smoke.add(puff);
        }
        smoke.visible = false;
        scene.add(smoke);
        smokeEffects.set(participant.id, smoke);
      }
      if (showPaths) {
        const positions = sortedPoints.map((point) => worldPosition(point.position, width, height, 0.28));
        if (positions.length > 1) {
          const curve = new THREE.CatmullRomCurve3(positions, false, "catmullrom", 0.45);
          const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(Math.max(24, positions.length * 10)));
          const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: PARTICIPANT_COLOURS[participant.colour] ?? 0xffffff, transparent: true, opacity: 0.9 }));
          scene.add(line);
        }
        if (showPhysicsEffects) {
          for (let index = 1; index < sortedPoints.length; index += 1) {
            const point = sortedPoints[index];
            if (!["Brake", "Slide", "Ricochet", "Deflect", "Swerve"].includes(point.action)) continue;
            const geometry = new THREE.BufferGeometry().setFromPoints([
              worldPosition(sortedPoints[index - 1].position, width, height, 0.31),
              worldPosition(point.position, width, height, 0.31),
            ]);
            scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x111827, transparent: true, opacity: point.action === "Brake" ? 0.7 : 0.52 })));
          }
        }
      }
    });

    if (showObjects) reconstruction.sceneObjects.filter((object) => object.visible).forEach((object) => {
      if (object.tracePoints && object.tracePoints.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(object.tracePoints.map((point) => worldPosition(point, width, height, 0.22)));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: objectColour(object), linewidth: 2 }));
        scene.add(line);
      } else {
        const mesh = createSceneObjectMesh(object);
        mesh.position.add(worldPosition(object.position, width, height));
        mesh.rotation.y = THREE.MathUtils.degToRad(-object.rotation);
        scene.add(mesh);
      }
    });

    if (showEvidence) {
      reconstruction.evidenceRecords.forEach((record) => {
        const marker = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
        marker.position.copy(worldPosition(record.position, width, height, 0.7));
        scene.add(marker);
      });
      reconstruction.measurements.forEach((measurement) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([worldPosition(measurement.start, width, height, 0.35), worldPosition(measurement.end, width, height, 0.35)]);
        scene.add(new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.6, gapSize: 0.35 })));
      });
    }

    const collisionPosition = worldPosition(reconstruction.collisionPoint, width, height, 0.42);
    const collisionMarker = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 12, 36), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    collisionMarker.rotation.x = Math.PI / 2;
    collisionMarker.position.copy(collisionPosition);
    scene.add(collisionMarker);
    const impactLight = new THREE.PointLight(0xff3b20, 0, 18);
    impactLight.position.copy(collisionPosition).add(new THREE.Vector3(0, 2, 0));
    scene.add(impactLight);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const shockwave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 40), shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.copy(collisionPosition).add(new THREE.Vector3(0, 0.08, 0));
    shockwave.visible = showPhysicsEffects;
    scene.add(shockwave);

    const debris = new THREE.Group();
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      const fragment = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 + (index % 3) * 0.04, 0.06, 0.18),
        new THREE.MeshBasicMaterial({ color: index % 2 ? 0xff7a18 : 0xfacc15 }),
      );
      fragment.userData.velocity = new THREE.Vector3(Math.cos(angle) * (3.2 + index % 4), 1.8 + index % 5 * 0.42, Math.sin(angle) * (3.2 + index % 4));
      debris.add(fragment);
    }
    debris.position.copy(collisionPosition);
    debris.visible = false;
    scene.add(debris);

    let animationId = 0;
    let previous = performance.now();
    let lastUiUpdate = 0;
    const animate = (now: number) => {
      const delta = Math.min(0.08, (now - previous) / 1000);
      previous = now;
      if (playingRef.current) {
        timeRef.current += delta * speedRef.current;
        if (timeRef.current >= reconstruction.durationSeconds) {
          timeRef.current = reconstruction.durationSeconds;
          playingRef.current = false;
          setIsPlaying(false);
        }
      }
      reconstruction.vehicles.forEach((participant) => {
        const state = getParticipantStateAtTime(participant, timeRef.current);
        const mesh = participantMeshes.get(participant.id);
        if (!mesh) return;
        const basePosition = worldPosition(state.position, width, height);
        mesh.position.copy(basePosition);
        mesh.rotation.set(0, THREE.MathUtils.degToRad(-state.rotation), 0);
        const angle = THREE.MathUtils.degToRad(-state.rotation);
        const direction = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
        const arrow = velocityArrows.get(participant.id);
        if (arrow) {
          arrow.position.copy(basePosition).add(new THREE.Vector3(0, 1.9, 0));
          arrow.setDirection(direction);
          const arrowLength = Math.max(0.8, Math.min(8, state.speedKmh / 10));
          arrow.setLength(arrowLength, Math.min(0.75, arrowLength * 0.3), Math.min(0.42, arrowLength * 0.18));
          arrow.visible = state.speedKmh > 0.5;
        }
        const activePoint = participant.pathPoints.find((point) => point.id === state.activePointId);
        const impact = impactDynamics.get(participant.id);
        applyPostImpactPose(mesh, participant, timeRef.current, impact?.time, impact?.speedKmh ?? participant.estimatedSpeedKmh, activePoint?.action ?? "Cruise");
        const smoke = smokeEffects.get(participant.id);
        if (smoke) {
          smoke.visible = state.speedKmh > 3 && ["Brake", "Slide", "Ricochet", "Deflect"].includes(activePoint?.action ?? "");
          smoke.position.copy(basePosition).add(direction.clone().multiplyScalar(-1.2));
          smoke.rotation.y = angle;
          smoke.children.forEach((puff, index) => {
            const pulse = 0.85 + Math.sin(now * 0.004 + index) * 0.18;
            puff.scale.setScalar(pulse);
          });
        }
      });
      const impactTime = reconstruction.lastPhysicsSimulation?.primaryImpactTimeSeconds ?? reconstruction.vehicles.map((participant) => participant.pathPoints.find((point) => point.action === "Impact")?.timeSeconds).find((value): value is number => value !== undefined) ?? reconstruction.durationSeconds / 2;
      const impactDelta = Math.abs(timeRef.current - impactTime);
      impactLight.intensity = impactDelta < 0.35 ? (1 - impactDelta / 0.35) * 20 : 0;
      collisionMarker.scale.setScalar(impactDelta < 0.55 ? 1 + (0.55 - impactDelta) * 1.8 : 1);
      const sinceImpact = timeRef.current - impactTime;
      if (showPhysicsEffects && sinceImpact >= 0 && sinceImpact < 1.1) {
        const progress = sinceImpact / 1.1;
        shockwave.visible = true;
        shockwave.scale.setScalar(1 + progress * 7);
        shockwaveMaterial.opacity = (1 - progress) * 0.82;
      } else {
        shockwaveMaterial.opacity = 0;
      }
      debris.visible = showPhysicsEffects && sinceImpact >= 0 && sinceImpact < 1.4;
      if (debris.visible) debris.children.forEach((fragment, index) => {
        const velocity = fragment.userData.velocity as THREE.Vector3;
        fragment.position.set(velocity.x * sinceImpact, Math.max(0, velocity.y * sinceImpact - 4.9 * sinceImpact * sinceImpact), velocity.z * sinceImpact);
        fragment.rotation.set(sinceImpact * (5 + index % 3), sinceImpact * (7 + index % 4), sinceImpact * 4);
      });
      if (showPhysicsEffects && Math.abs(sinceImpact) < 0.28) {
        const strength = (1 - Math.abs(sinceImpact) / 0.28) * 0.18;
        participantMeshes.forEach((mesh) => {
          if (mesh.position.distanceTo(collisionPosition) < 12) {
            mesh.position.x += Math.sin(now * 0.08) * strength;
            mesh.rotation.z = Math.sin(now * 0.06) * strength * 0.45;
          }
        });
      }

      const mode = cameraModeRef.current;
      controls.enabled = mode === "Orbit";
      if (mode === "Overhead") {
        camera.position.lerp(new THREE.Vector3(0, Math.max(width, height) * 1.05, 0.01), 0.08);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
      } else {
        camera.up.set(0, 1, 0);
        if (mode === "Roadside") {
          camera.position.lerp(new THREE.Vector3(width * 0.14, 7, height * 0.42), 0.08);
          camera.lookAt(collisionPosition);
        } else if (mode === "Driver") {
          const participant = reconstruction.vehicles[0];
          if (participant) {
            const state = getParticipantStateAtTime(participant, timeRef.current);
            const target = worldPosition(state.position, width, height, 1.4);
            const angle = THREE.MathUtils.degToRad(-state.rotation);
            const behind = new THREE.Vector3(-Math.cos(angle) * 7, 3.2, Math.sin(angle) * 7);
            camera.position.lerp(target.clone().add(behind), 0.16);
            camera.lookAt(target.clone().add(new THREE.Vector3(Math.cos(angle) * 8, 0, -Math.sin(angle) * 8)));
          }
        }
      }
      if (controls.enabled) controls.update();
      renderer.render(scene, camera);
      if (now - lastUiUpdate > 100) {
        lastUiUpdate = now;
        setDisplayTime(timeRef.current);
      }
      animationId = requestAnimationFrame(animate);
    };
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    animationId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reconstruction, showEvidence, showObjects, showPaths, showPhysicsEffects]);

  const setTime = (value: number) => {
    timeRef.current = value;
    setDisplayTime(value);
  };

  return (
    <section className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${expanded ? "fixed inset-3 z-[120] flex flex-col" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-4">
        <div><h2 className="text-lg font-bold text-gray-900">3D Reconstruction</h2><p className="mt-1 text-xs text-gray-500">Current participants, paths, collision point and scene evidence.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setIsPlaying(false); setTime(0); onRunPhysics(); }} className="rounded-lg border border-blue-600 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">Run physics</button>
          <button type="button" onClick={() => { setIsPlaying(false); onSwitchTo2D(); }} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">2D view</button>
          <select value={cameraMode} onChange={(event) => setCameraMode(event.target.value as CameraMode)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700"><option>Orbit</option><option>Overhead</option><option>Roadside</option><option>Driver</option></select>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">{expanded ? "Exit full view" : "Expand"}</button>
        </div>
      </div>
      <div
        className={`relative w-full bg-slate-900 ${expanded ? "min-h-0 flex-1" : ""}`}
        style={expanded ? undefined : { height: "min(72vh, 760px)", minHeight: "480px" }}
      >
        <div ref={mountRef} className="absolute inset-0" />
        <button
          type="button"
          onClick={() => {
            if (displayTime >= reconstruction.durationSeconds) setTime(0);
            setIsPlaying((value) => !value);
          }}
          className="absolute left-4 top-4 z-10 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <div className="border-t border-gray-200 bg-white p-4 text-gray-900">
        <input type="range" min={0} max={reconstruction.durationSeconds} step={0.01} value={displayTime} onChange={(event) => { setIsPlaying(false); setTime(Number(event.target.value)); }} className="w-full" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><button type="button" onClick={() => { setIsPlaying(false); setTime(0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700">Reset</button><span className="text-xs font-semibold text-gray-600">{displayTime.toFixed(1)}s / {reconstruction.durationSeconds.toFixed(1)}s</span>{reconstruction.lastPhysicsSimulation && <span className="text-xs text-gray-500">{reconstruction.lastPhysicsSimulation.participantCollisions} collision(s) · {reconstruction.lastPhysicsSimulation.estimatedImpactEnergyKj.toFixed(1)} kJ</span>}</div>
          <div className="flex flex-wrap items-center gap-3 text-xs"><label className="flex items-center gap-1"><input type="checkbox" checked={showPaths} onChange={(event) => setShowPaths(event.target.checked)} /> Paths</label><label className="flex items-center gap-1"><input type="checkbox" checked={showObjects} onChange={(event) => setShowObjects(event.target.checked)} /> Objects</label><label className="flex items-center gap-1"><input type="checkbox" checked={showEvidence} onChange={(event) => setShowEvidence(event.target.checked)} /> Evidence</label><label className="flex items-center gap-1"><input type="checkbox" checked={showPhysicsEffects} onChange={(event) => setShowPhysicsEffects(event.target.checked)} /> Physics</label><select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white px-2 py-2"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></div>
        </div>
      </div>
    </section>
  );
}

export default memo(Reconstruction3DViewer);
