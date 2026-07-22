import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { THIRD_PARTY_3D_ASSET_NOTICE } from "../../data/realisticAssetCatalog";
import {
  createRealisticProceduralSceneObject,
  disposeObjectTree,
  enhanceRoadTextures,
  loadRealisticEnvironmentModel,
  loadRealisticParticipantModel,
  loadRealisticSceneObjectModel,
} from "../../services/realisticSceneAssetService";

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
  onRunPhysics: () => AccidentReconstruction;
  onPreparePlayback: () => AccidentReconstruction;
  compact?: boolean;
}

type CameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";

interface AssetLifecycle {
  isDisposed: () => boolean;
  settle: (failed?: boolean) => void;
}

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
  radius = 0,
) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(radius, Math.min(...size) * 0.45))
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addCapsule(
  group: THREE.Group,
  radius: number,
  length: number,
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function addWheel(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number,
  tireMaterial: THREE.Material,
) {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 28, 1),
    tireMaterial,
  );
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b939d,
    metalness: 0.82,
    roughness: 0.22,
  });
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 1.04, 18),
    rimMaterial,
  );
  rim.rotation.x = Math.PI / 2;
  wheel.add(rim);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 1.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x303740, metalness: 0.7, roughness: 0.28 }),
  );
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);

  wheel.position.set(x, y, z);
  wheel.userData.isWheel = true;
  wheel.userData.baseRotationX = wheel.rotation.x;
  wheel.userData.wheelSide = z < 0 ? -1 : 1;
  group.add(wheel);
}

function addVehicleLights(group: THREE.Group, length: number, height: number, width: number) {
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff7d4,
    emissive: 0xffe8a3,
    emissiveIntensity: 0.65,
    roughness: 0.16,
  });
  const rearLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d2029,
    emissive: 0x7b111b,
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  for (const z of [-width * 0.31, width * 0.31]) {
    addBox(group, [0.10, height * 0.12, width * 0.18], [length * 0.505, height * 0.45, z], headlightMaterial, [0, 0, 0], 0.03);
    addBox(group, [0.10, height * 0.12, width * 0.18], [-length * 0.505, height * 0.45, z], rearLightMaterial, [0, 0, 0], 0.03);
  }
}

function createPersonModel(participant: ReconstructionVehicle, colour: number): THREE.Group {
  const group = new THREE.Group();
  const clothes = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222833, roughness: 0.86 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97850, roughness: 0.84 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x12161c, roughness: 0.95 });
  const accent = new THREE.MeshStandardMaterial({ color: participant.type === "Officer" ? 0xcbd5e1 : 0xe8edf5, roughness: 0.72 });

  addCapsule(group, 0.20, 0.48, [0, 1.18, 0], clothes);
  addCapsule(group, 0.085, 0.50, [0, 0.56, -0.13], dark, [0.06, 0, 0.03]);
  addCapsule(group, 0.085, 0.50, [0, 0.56, 0.13], dark, [-0.06, 0, -0.03]);
  addBox(group, [0.22, 0.10, 0.15], [0.07, 0.17, -0.14], boots, [0, 0, -0.04], 0.04);
  addBox(group, [0.22, 0.10, 0.15], [0.07, 0.17, 0.14], boots, [0, 0, 0.04], 0.04);
  addCapsule(group, 0.075, 0.47, [0, 1.12, -0.31], skin, [0.06, 0, 0.02]);
  addCapsule(group, 0.075, 0.47, [0, 1.12, 0.31], skin, [-0.06, 0, -0.02]);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 14), skin);
  neck.position.set(0, 1.60, 0);
  group.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), skin);
  head.scale.set(0.9, 1.08, 0.92);
  head.position.set(0, 1.82, 0);
  head.castShadow = true;
  group.add(head);
  addBox(group, [0.035, 0.045, 0.20], [0.194, 1.85, 0], new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.65 }), [0, 0, 0], 0.01);

  if (participant.type === "Officer") {
    addBox(group, [0.055, 0.56, 0.35], [0.205, 1.20, 0], accent, [0, 0, 0], 0.015);
    addBox(group, [0.42, 0.12, 0.32], [0, 1.52, 0], dark, [0, 0, 0], 0.04);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.22, 0.10, 24), dark);
    cap.position.set(0, 2.03, 0);
    group.add(cap);
    addBox(group, [0.23, 0.025, 0.18], [0.10, 2.01, 0], dark, [0, 0, 0], 0.01);
  } else if (participant.type === "Witness") {
    addBox(group, [0.07, 0.19, 0.16], [0.23, 1.28, 0], accent, [0, 0, 0], 0.025);
  }
  return group;
}

function addBicycleWheel(group: THREE.Group, x: number, radius: number, width: number, material: THREE.Material) {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, width, 10, 36), material);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);
  const spokeMaterial = new THREE.MeshBasicMaterial({ color: 0x8b939d });
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.75, 0.012, 0.012), spokeMaterial);
    spoke.rotation.x = angle;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.10, 12), spokeMaterial);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.position.set(x, radius, 0);
  wheel.userData.isWheel = true;
  wheel.userData.baseRotationX = wheel.rotation.x;
  wheel.userData.wheelSide = x < 0 ? -1 : 1;
  group.add(wheel);
}

function createTwoWheelerModel(participant: ReconstructionVehicle, colour: number): THREE.Group {
  const group = new THREE.Group();
  const bicycle = participant.type === "Bicycle";
  const wheelRadius = bicycle ? 0.46 : 0.43;
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.96 });
  const metal = new THREE.MeshStandardMaterial({ color: colour, metalness: 0.48, roughness: 0.42 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.88, roughness: 0.18 });
  addBicycleWheel(group, -0.72, wheelRadius, bicycle ? 0.045 : 0.075, tireMaterial);
  addBicycleWheel(group, 0.72, wheelRadius, bicycle ? 0.045 : 0.075, tireMaterial);
  addBox(group, [1.15, 0.08, 0.08], [0, 0.57, 0], metal, [0, 0, -0.12], 0.02);
  addBox(group, [0.92, 0.075, 0.075], [-0.18, 0.73, 0], metal, [0, 0, 0.52], 0.02);
  addBox(group, [0.84, 0.075, 0.075], [-0.28, 0.73, 0], metal, [0, 0, -0.65], 0.02);
  addBox(group, [0.07, 0.74, 0.07], [0.62, 0.80, 0], chrome, [0, 0, -0.12], 0.02);
  addBox(group, [0.07, 0.07, 0.74], [0.66, 1.10, 0], chrome, [0, 0, 0], 0.02);
  addBox(group, [0.40, 0.11, bicycle ? 0.14 : 0.32], [-0.18, 1.0, 0], new THREE.MeshStandardMaterial({ color: 0x171c24, roughness: 0.9 }), [0, 0, 0], 0.04);
  if (!bicycle) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), metal);
    tank.scale.set(1.25, 0.76, 0.67);
    tank.position.set(0.16, 0.90, 0);
    tank.castShadow = true;
    group.add(tank);
    addBox(group, [0.36, 0.29, 0.40], [-0.50, 0.75, 0], new THREE.MeshStandardMaterial({ color: 0x2f3948, metalness: 0.3, roughness: 0.55 }), [0, 0, 0], 0.05);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe89b, emissiveIntensity: 0.55 }));
    lamp.position.set(0.79, 0.95, 0);
    group.add(lamp);
    addBox(group, [0.9, 0.08, 0.06], [-0.04, 0.54, -0.22], chrome, [0, 0, 0], 0.02);
    addBox(group, [0.9, 0.08, 0.06], [-0.04, 0.54, 0.22], chrome, [0, 0, 0], 0.02);
  }

  const rider = new THREE.Group();
  const riderClothes = new THREE.MeshStandardMaterial({ color: 0x263b60, roughness: 0.78 });
  const riderSkin = new THREE.MeshStandardMaterial({ color: 0xb97850, roughness: 0.86 });
  addCapsule(rider, 0.16, 0.38, [-0.05, 1.55, 0], riderClothes, [0, 0, -0.28]);
  addCapsule(rider, 0.065, 0.48, [-0.34, 1.13, -0.12], riderClothes, [0.12, 0, 0.55]);
  addCapsule(rider, 0.065, 0.48, [-0.34, 1.13, 0.12], riderClothes, [-0.12, 0, 0.55]);
  addCapsule(rider, 0.055, 0.45, [0.30, 1.48, -0.25], riderSkin, [0.04, 0, -0.72]);
  addCapsule(rider, 0.055, 0.45, [0.30, 1.48, 0.25], riderSkin, [-0.04, 0, -0.72]);
  const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), riderSkin);
  riderHead.position.set(-0.18, 1.96, 0);
  riderHead.castShadow = true;
  rider.add(riderHead);
  if (!bicycle) {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.208, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.60),
      new THREE.MeshStandardMaterial({ color: 0x10151e, metalness: 0.22, roughness: 0.42 }),
    );
    helmet.position.set(-0.18, 2.03, 0);
    rider.add(helmet);
    addBox(rider, [0.025, 0.10, 0.24], [0.002, 1.98, 0], new THREE.MeshStandardMaterial({ color: 0x375676, transparent: true, opacity: 0.72, roughness: 0.08 }), [0, 0, -0.16], 0.01);
  }
  group.add(rider);
  return group;
}

function createProceduralParticipantMesh(participant: ReconstructionVehicle): THREE.Group {
  const group = new THREE.Group();
  const [length, height, width] = participantDimensions(participant);
  const colour = PARTICIPANT_COLOURS[participant.colour] ?? 0x2563eb;
  const human = ["Pedestrian", "Officer", "Witness"].includes(participant.type);
  if (human) {
    group.add(createPersonModel(participant, colour));
  } else if (participant.type === "Motorcycle" || participant.type === "Bicycle") {
    group.add(createTwoWheelerModel(participant, colour));
  } else {
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: colour, metalness: 0.32, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.23 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x7fa4bd, metalness: 0.12, roughness: 0.08, transmission: 0.18, transparent: true, opacity: 0.82 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.96 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2029, metalness: 0.45, roughness: 0.42 });
    const chromeMaterial = new THREE.MeshStandardMaterial({ color: 0xaab2bb, metalness: 0.9, roughness: 0.18 });

    addBox(group, [length, height * 0.47, width], [0, height * 0.40, 0], bodyMaterial, [0, 0, 0], Math.min(0.25, height * 0.12));
    addBox(group, [length * 0.96, 0.09, width * 1.02], [0, height * 0.18, 0], trimMaterial, [0, 0, 0], 0.03);

    if (participant.type === "Truck") {
      addBox(group, [length * 0.57, height * 0.70, width * 0.95], [-length * 0.20, height * 0.88, 0], new THREE.MeshStandardMaterial({ color: 0xb6bdc5, metalness: 0.18, roughness: 0.62 }), [0, 0, 0], 0.06);
      addBox(group, [length * 0.30, height * 0.62, width * 0.92], [length * 0.34, height * 0.80, 0], bodyMaterial, [0, 0, 0], 0.12);
      addBox(group, [0.06, height * 0.27, width * 0.70], [length * 0.492, height * 0.94, 0], glassMaterial, [0, 0, 0], 0.02);
      addBox(group, [0.06, height * 0.30, width * 0.26], [length * 0.33, height * 0.94, -width * 0.47], glassMaterial, [0, 0, 0], 0.02);
      addBox(group, [0.06, height * 0.30, width * 0.26], [length * 0.33, height * 0.94, width * 0.47], glassMaterial, [0, 0, 0], 0.02);
    } else if (participant.type === "Bus") {
      addBox(group, [length * 0.98, height * 0.69, width * 0.96], [0, height * 0.83, 0], bodyMaterial, [0, 0, 0], 0.13);
      for (let index = -3; index <= 3; index += 1) {
        for (const z of [-width * 0.485, width * 0.485]) {
          addBox(group, [length * 0.095, height * 0.25, 0.035], [index * length * 0.12, height * 0.99, z], glassMaterial, [0, 0, 0], 0.02);
        }
      }
      addBox(group, [0.05, height * 0.31, width * 0.74], [length * 0.492, height * 0.99, 0], glassMaterial, [0, 0, 0], 0.02);
      addBox(group, [length * 0.96, 0.07, width * 0.98], [0, height * 1.25, 0], trimMaterial, [0, 0, 0], 0.03);
    } else {
      addBox(group, [length * 0.50, height * 0.43, width * 0.83], [-length * 0.04, height * 0.82, 0], glassMaterial, [0, 0, 0.02], 0.13);
      addBox(group, [length * 0.23, height * 0.12, width * 0.80], [length * 0.34, height * 0.66, 0], bodyMaterial, [0, 0, -0.05], 0.08);
      addBox(group, [length * 0.22, height * 0.10, width * 0.78], [-length * 0.34, height * 0.65, 0], bodyMaterial, [0, 0, 0.04], 0.08);
      for (const z of [-width * 0.505, width * 0.505]) {
        addBox(group, [0.50, 0.05, 0.18], [length * 0.04, height * 0.88, z], trimMaterial, [0, 0, 0], 0.02);
        addBox(group, [0.26, 0.12, 0.11], [length * 0.12, height * 0.76, z * 1.02], bodyMaterial, [0, 0, 0], 0.04);
      }
      addBox(group, [0.045, height * 0.27, width * 0.72], [length * 0.20, height * 0.85, 0], glassMaterial, [0, 0, -0.2], 0.02);
      addBox(group, [0.045, height * 0.24, width * 0.68], [-length * 0.27, height * 0.83, 0], glassMaterial, [0, 0, 0.23], 0.02);
      addBox(group, [0.035, height * 0.33, width * 0.35], [-length * 0.03, height * 0.84, -width * 0.422], glassMaterial, [0, 0, 0], 0.02);
      addBox(group, [0.035, height * 0.33, width * 0.35], [-length * 0.03, height * 0.84, width * 0.422], glassMaterial, [0, 0, 0], 0.02);
      addBox(group, [0.04, 0.05, width * 0.62], [length * 0.51, height * 0.34, 0], chromeMaterial, [0, 0, 0], 0.01);
      for (let index = -2; index <= 2; index += 1) {
        addBox(group, [0.025, height * 0.16, 0.03], [length * 0.522, height * 0.34, index * width * 0.10], trimMaterial);
      }
      addBox(group, [0.02, 0.18, 0.34], [length * 0.54, height * 0.42, 0], new THREE.MeshStandardMaterial({ color: 0xd6d7d2, roughness: 0.52 }), [0, 0, 0], 0.01);
    }

    const wheelXs = participant.type === "Bus" ? [-length * 0.34, length * 0.34] : participant.type === "Truck" ? [-length * 0.32, length * 0.31] : [-length * 0.31, length * 0.31];
    for (const x of wheelXs) {
      for (const z of [-width * 0.52, width * 0.52]) {
        addWheel(group, x, height * 0.22, z, height * 0.19, 0.24, wheelMaterial);
      }
    }
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
  return createRealisticProceduralSceneObject(object);
}

function createSurfaceTexture(kind: "asphalt" | "ground", wet = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = kind === "asphalt" ? (wet ? "#252c31" : "#33373b") : "#29322a";
    context.fillRect(0, 0, 256, 256);
    const count = kind === "asphalt" ? 1900 : 1000;
    for (let index = 0; index < count; index += 1) {
      const value = kind === "asphalt"
        ? 35 + Math.floor(Math.random() * 45)
        : 35 + Math.floor(Math.random() * 38);
      const alpha = kind === "asphalt" ? 0.13 + Math.random() * 0.16 : 0.10 + Math.random() * 0.14;
      context.fillStyle = kind === "asphalt"
        ? `rgba(${value},${value + 2},${value + 4},${alpha})`
        : `rgba(${value},${value + 18},${value + 5},${alpha})`;
      const size = Math.random() * (kind === "asphalt" ? 1.8 : 2.5) + 0.35;
      context.fillRect(Math.random() * 256, Math.random() * 256, size, size);
    }
    if (wet && kind === "asphalt") {
      const gradient = context.createLinearGradient(0, 0, 256, 256);
      gradient.addColorStop(0, "rgba(210,230,240,.04)");
      gradient.addColorStop(0.5, "rgba(210,230,240,.16)");
      gradient.addColorStop(1, "rgba(210,230,240,.03)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "asphalt" ? 10 : 7, kind === "asphalt" ? 10 : 7);
  texture.anisotropy = 4;
  return texture;
}

function addCrosswalk(scene: THREE.Scene, horizontal: boolean, roadWidth: number) {
  const material = new THREE.MeshStandardMaterial({ color: 0xd8dad7, roughness: 0.78 });
  for (let index = -4; index <= 4; index += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 0.65 : roadWidth * 0.72, 0.025, horizontal ? roadWidth * 0.72 : 0.65),
      material,
    );
    stripe.position.set(horizontal ? index * 1.05 : 0, 0.18, horizontal ? 0 : index * 1.05);
    stripe.receiveShadow = true;
    scene.add(stripe);
  }
}

function addStreetLight(
  scene: THREE.Scene,
  x: number,
  z: number,
  rotation: number,
  lifecycle: AssetLifecycle,
) {
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x39414a, metalness: 0.7, roughness: 0.35 });
  const fallback = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.8, 12), poleMaterial);
  pole.position.y = 2.9;
  pole.castShadow = true;
  fallback.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.10, 0.10), poleMaterial);
  arm.position.set(0.58, 5.62, 0);
  fallback.add(arm);
  const lamp = new THREE.Mesh(
    new RoundedBoxGeometry(0.46, 0.17, 0.28, 2, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xc5c9c5, emissive: 0xfff0c4, emissiveIntensity: 0.36, roughness: 0.28 }),
  );
  lamp.position.set(1.22, 5.55, 0);
  fallback.add(lamp);
  fallback.position.set(x, 0, z);
  fallback.rotation.y = rotation;
  scene.add(fallback);

  void loadRealisticEnvironmentModel("streetLight", { length: 1.9, height: 6.1, width: 1.3 })
    .then((model) => {
      if (lifecycle.isDisposed()) {
        disposeObjectTree(model);
        return;
      }
      scene.remove(fallback);
      disposeObjectTree(fallback);
      model.position.set(x, 0, z);
      model.rotation.y = rotation;
      scene.add(model);
      lifecycle.settle(false);
    })
    .catch((error: unknown) => {
      console.warn("Realistic street-light model unavailable:", error);
      lifecycle.settle(true);
    });
}

function addBuilding(
  scene: THREE.Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  tone: number,
  assetKey: "suburbanHouses" | "schoolBuilding" | "commercialBuilding",
  lifecycle: AssetLifecycle,
) {
  const fallback = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 2, 0.08),
    new THREE.MeshStandardMaterial({ color: tone, roughness: 0.82 }),
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  fallback.add(body);
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x536779, emissive: 0x182633, emissiveIntensity: 0.12, roughness: 0.35 });
  const columns = Math.max(2, Math.floor(width / 2.2));
  const rows = Math.max(1, Math.floor(height / 2.2));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.7), windowMaterial);
      windowMesh.position.set(-width / 2 + 1 + column * ((width - 2) / Math.max(1, columns - 1)), 1.25 + row * 1.7, depth / 2 + 0.011);
      fallback.add(windowMesh);
    }
  }
  fallback.position.set(x, 0, z);
  scene.add(fallback);

  void loadRealisticEnvironmentModel(assetKey, { length: width, height, width: depth })
    .then((model) => {
      if (lifecycle.isDisposed()) {
        disposeObjectTree(model);
        return;
      }
      scene.remove(fallback);
      disposeObjectTree(fallback);
      model.position.set(x, 0, z);
      scene.add(model);
      lifecycle.settle(false);
    })
    .catch((error: unknown) => {
      console.warn(`Realistic building model unavailable (${assetKey}):`, error);
      lifecycle.settle(true);
    });
}

function addRoad(scene: THREE.Scene, reconstruction: AccidentReconstruction, lifecycle: AssetLifecycle) {
  const { sceneWidthMetres: width, sceneHeightMetres: height, roadLayout } = reconstruction.scene;
  const wet = reconstruction.scene.roadSurface === "Wet";
  const groundTexture = createSurfaceTexture("ground");
  const asphaltTexture = createSurfaceTexture("asphalt", wet);
  const sidewalkTexture = createSurfaceTexture("ground");
  enhanceRoadTextures(asphaltTexture, groundTexture, sidewalkTexture);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.7, height * 1.7),
    new THREE.MeshStandardMaterial({ map: groundTexture, color: 0x687164, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMaterial = new THREE.MeshPhysicalMaterial({
    map: asphaltTexture,
    color: wet ? 0x6c7880 : 0x8a8d8f,
    roughness: wet ? 0.38 : 0.88,
    metalness: wet ? 0.12 : 0,
    clearcoat: wet ? 0.32 : 0,
    clearcoatRoughness: 0.28,
  });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    map: sidewalkTexture,
    color: 0x9b9b98,
    roughness: 0.94,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xa0a3a2, roughness: 0.85 });
  const markingMaterial = new THREE.MeshStandardMaterial({ color: 0xe3e4df, roughness: 0.72 });
  const centreMaterial = new THREE.MeshStandardMaterial({ color: 0xb9943f, roughness: 0.74 });
  const roadWidth = Math.min(18, 6.2 + reconstruction.scene.laneCount * 3.15);

  const addRoadSegment = (horizontal: boolean, segmentLength: number, offset = 0) => {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? segmentLength : roadWidth, 0.14, horizontal ? roadWidth : segmentLength),
      roadMaterial,
    );
    road.position.set(horizontal ? offset : 0, 0.07, horizontal ? 0 : offset);
    road.receiveShadow = true;
    scene.add(road);

    if (reconstruction.scene.showPavements) {
      for (const side of [-1, 1]) {
        const sidewalk = new THREE.Mesh(
          new THREE.BoxGeometry(
            horizontal ? segmentLength : 2.2,
            0.18,
            horizontal ? 2.2 : segmentLength,
          ),
          sidewalkMaterial,
        );
        sidewalk.position.set(
          horizontal ? offset : side * (roadWidth / 2 + 1.1),
          0.09,
          horizontal ? side * (roadWidth / 2 + 1.1) : offset,
        );
        sidewalk.receiveShadow = true;
        scene.add(sidewalk);
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(
            horizontal ? segmentLength : 0.22,
            0.28,
            horizontal ? 0.22 : segmentLength,
          ),
          curbMaterial,
        );
        curb.position.set(
          horizontal ? offset : side * (roadWidth / 2 + 0.12),
          0.14,
          horizontal ? side * (roadWidth / 2 + 0.12) : offset,
        );
        scene.add(curb);
      }
    }

    if (reconstruction.scene.showLaneMarkings) {
      const lanes = Math.max(1, reconstruction.scene.laneCount);
      for (let lane = 1; lane < lanes; lane += 1) {
        const laneOffset = -roadWidth / 2 + (roadWidth / lanes) * lane;
        const centre = lanes % 2 === 0 && lane === lanes / 2;
        for (let value = -segmentLength / 2; value < segmentLength / 2; value += centre ? 4 : 7) {
          const dash = new THREE.Mesh(
            new THREE.BoxGeometry(
              horizontal ? (centre ? 3.2 : 3.0) : (centre ? 0.10 : 0.08),
              0.025,
              horizontal ? (centre ? 0.10 : 0.08) : (centre ? 3.2 : 3.0),
            ),
            centre ? centreMaterial : markingMaterial,
          );
          dash.position.set(
            horizontal ? value + offset : laneOffset,
            0.165,
            horizontal ? laneOffset : value + offset,
          );
          scene.add(dash);
        }
      }
    }
  };

  addRoadSegment(true, width * 1.18);
  if (roadLayout !== "Straight Road" && roadLayout !== "Pedestrian Crossing") {
    const verticalLength = roadLayout === "T-Junction" ? height * 0.62 : height * 1.18;
    addRoadSegment(false, verticalLength, roadLayout === "T-Junction" ? height * 0.29 : 0);
  }

  if (roadLayout === "Roundabout") {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 11.2, 64),
      roadMaterial,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.18;
    ring.receiveShadow = true;
    scene.add(ring);
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(5.9, 5.9, 0.34, 48),
      new THREE.MeshStandardMaterial({ map: groundTexture, color: 0x566453, roughness: 1 }),
    );
    island.position.y = 0.16;
    island.receiveShadow = true;
    scene.add(island);
  }

  if (roadLayout === "Pedestrian Crossing" || reconstruction.scene.showPedestrianCrossing) {
    addCrosswalk(scene, true, roadWidth);
  }

  const edgeX = width * 0.63;
  const edgeZ = height * 0.63;
  const buildingMaterialTones = [0x5d6265, 0x696b68, 0x4f555b, 0x6b625b];
  const placements = [
    [-edgeX, -edgeZ, 9, 7, 6],
    [edgeX, -edgeZ * 0.9, 11, 8, 8],
    [-edgeX * 0.95, edgeZ, 8, 9, 7],
    [edgeX, edgeZ, 10, 7, 5.5],
  ] as const;
  const buildingAssets = [
    "suburbanHouses",
    "commercialBuilding",
    "schoolBuilding",
    "suburbanHouses",
  ] as const;
  placements.forEach(([x, z, buildingWidth, depth, buildingHeight], index) =>
    addBuilding(
      scene,
      x,
      z,
      buildingWidth,
      depth,
      buildingHeight,
      buildingMaterialTones[index],
      buildingAssets[index],
      lifecycle,
    ),
  );

  for (const x of [-width * 0.38, width * 0.38]) {
    addStreetLight(scene, x, roadWidth / 2 + 2.25, Math.PI, lifecycle);
    addStreetLight(scene, x, -roadWidth / 2 - 2.25, 0, lifecycle);
  }
  if (roadLayout !== "Straight Road" && roadLayout !== "Pedestrian Crossing") {
    for (const z of [-height * 0.38, height * 0.38]) {
      addStreetLight(scene, roadWidth / 2 + 2.25, z, -Math.PI / 2, lifecycle);
      addStreetLight(scene, -roadWidth / 2 - 2.25, z, Math.PI / 2, lifecycle);
    }
  }

  if (reconstruction.scene.roadSurface === "Damaged") {
    const crackMaterial = new THREE.MeshBasicMaterial({ color: 0x14171a });
    for (let index = 0; index < 8; index += 1) {
      const points = [
        new THREE.Vector3(-width * 0.35 + index * 2.1, 0.19, -1.5 + (index % 3)),
        new THREE.Vector3(-width * 0.30 + index * 2.1, 0.19, -0.4 + (index % 2)),
        new THREE.Vector3(-width * 0.26 + index * 2.1, 0.19, 0.7 + (index % 3)),
      ];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), crackMaterial));
    }
  }
}

function Reconstruction3DViewer({
  reconstruction,
  onSwitchTo2D,
  onRunPhysics,
  onPreparePlayback,
  compact = false,
}: Reconstruction3DViewerProps) {
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
  const [assetStatus, setAssetStatus] = useState({ loaded: 0, total: 0, failed: 0 });

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = reconstruction.scene.sceneWidthMetres;
    const height = reconstruction.scene.sceneHeightMetres;
    const scene = new THREE.Scene();
    let disposed = false;
    let loadedAssets = 0;
    let failedAssets = 0;
    const visibleObjectCount = showObjects
      ? reconstruction.sceneObjects.filter(
          (object) => object.visible && !(object.tracePoints && object.tracePoints.length > 1),
        ).length
      : 0;
    const hasCrossRoad = !["Straight Road", "Pedestrian Crossing"].includes(
      reconstruction.scene.roadLayout,
    );
    const environmentAssetCount = 4 + (hasCrossRoad ? 8 : 4);
    const totalAssets =
      reconstruction.vehicles.length + visibleObjectCount + environmentAssetCount;
    setAssetStatus({ loaded: 0, total: totalAssets, failed: 0 });
    const settleAsset = (failed = false) => {
      if (disposed) return;
      loadedAssets += 1;
      if (failed) failedAssets += 1;
      setAssetStatus({ loaded: loadedAssets, total: totalAssets, failed: failedAssets });
    };
    const nightScene = reconstruction.scene.timeOfDay === "Night";
    const environmentColour = nightScene ? 0x030916 : 0x75818a;
    scene.background = new THREE.Color(environmentColour);
    scene.fog = new THREE.FogExp2(environmentColour, nightScene ? 0.014 : 0.007);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(width * 0.65, Math.max(width, height) * 0.7, height * 0.7);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = nightScene ? 0.78 : 1.05;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.minDistance = 5;
    controls.maxDistance = Math.max(width, height) * 2;
    scene.add(new THREE.HemisphereLight(
      nightScene ? 0x60728e : 0xdde8ee,
      nightScene ? 0x07101d : 0x3d443d,
      nightScene ? 0.62 : 1.35,
    ));
    const sun = new THREE.DirectionalLight(nightScene ? 0x9db7e6 : 0xfff7e6, nightScene ? 1.05 : 2.1);
    sun.position.set(-30, 48, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadowExtent = Math.max(width, height) * 0.8;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = Math.max(width, height) * 3;
    sun.shadow.bias = -0.00018;
    scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0x7e9cc8, nightScene ? 0.38 : 0.3);
    fillLight.position.set(28, 18, -24);
    scene.add(fillLight);
    addRoad(scene, reconstruction, {
      isDisposed: () => disposed,
      settle: settleAsset,
    });

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
      const mesh = createProceduralParticipantMesh(participant);
      scene.add(mesh);
      participantMeshes.set(participant.id, mesh);
      void loadRealisticParticipantModel(participant, participantDimensions(participant))
        .then((realisticModel) => {
          if (disposed) {
            disposeObjectTree(realisticModel);
            return;
          }
          const modelRoot = mesh.userData.modelRoot as THREE.Group | undefined;
          if (!modelRoot) {
            disposeObjectTree(realisticModel);
            settleAsset(true);
            return;
          }
          const previousChildren = [...modelRoot.children];
          previousChildren.forEach((child) => {
            modelRoot.remove(child);
            disposeObjectTree(child);
          });
          modelRoot.add(realisticModel);
          modelRoot.userData.realisticAsset = true;
          settleAsset(false);
        })
        .catch((error: unknown) => {
          console.warn(`Realistic model unavailable for ${participant.name}:`, error);
          settleAsset(true);
        });
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
        return;
      }

      const holder = new THREE.Group();
      const fallback = createSceneObjectMesh(object);
      holder.add(fallback);
      holder.position.copy(worldPosition(object.position, width, height));
      holder.rotation.y = THREE.MathUtils.degToRad(-object.rotation);
      scene.add(holder);

      void loadRealisticSceneObjectModel(object)
        .then((realisticModel) => {
          if (!realisticModel) {
            settleAsset(false);
            return;
          }
          if (disposed) {
            disposeObjectTree(realisticModel);
            return;
          }
          holder.remove(fallback);
          disposeObjectTree(fallback);
          holder.add(realisticModel);
          holder.userData.realisticAsset = true;
          settleAsset(false);
        })
        .catch((error: unknown) => {
          console.warn(`Realistic scene object unavailable for ${object.label}:`, error);
          settleAsset(true);
        });
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
      disposed = true;
      cancelAnimationFrame(animationId);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            const texturedMaterial = material as THREE.Material & {
              map?: THREE.Texture | null;
              normalMap?: THREE.Texture | null;
              roughnessMap?: THREE.Texture | null;
              metalnessMap?: THREE.Texture | null;
              alphaMap?: THREE.Texture | null;
            };
            texturedMaterial.map?.dispose();
            texturedMaterial.normalMap?.dispose();
            texturedMaterial.roughnessMap?.dispose();
            texturedMaterial.metalnessMap?.dispose();
            texturedMaterial.alphaMap?.dispose();
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

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const startsFromBeginning =
      timeRef.current <= 0.01 ||
      timeRef.current >= reconstruction.durationSeconds;

    if (timeRef.current >= reconstruction.durationSeconds) {
      setTime(0);
    }

    if (startsFromBeginning) {
      const prepared = onPreparePlayback();
      if (timeRef.current > prepared.durationSeconds) setTime(0);
    }

    setIsPlaying(true);
  };

  return (
    <section className={`reconstruction-3d ui-panel flex min-h-0 flex-col overflow-hidden ${expanded ? "fixed inset-3 z-[120]" : ""} ${compact ? "reconstruction-3d--compact h-full" : ""}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#182743] bg-[#080e1c] ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-200">3D Reconstruction</h2>
          {!compact && <p className="mt-1 text-[9px] text-slate-600">Physical scene, participant routes and evidence layers.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!compact && <button type="button" onClick={() => { setIsPlaying(false); setTime(0); onRunPhysics(); }} className="ui-button py-1.5">Recalculate</button>}
          <button type="button" onClick={() => { setIsPlaying(false); onSwitchTo2D(); }} className="ui-button py-1.5">2D view</button>
          <select value={cameraMode} onChange={(event) => setCameraMode(event.target.value as CameraMode)} className="ui-input py-1.5"><option>Orbit</option><option>Overhead</option><option>Roadside</option><option>Driver</option></select>
          {!compact && <button type="button" onClick={() => setExpanded((value) => !value)} className="ui-button-primary py-1.5">{expanded ? "Exit full view" : "Expand"}</button>}
        </div>
      </div>
      <div
        className={`relative min-h-0 w-full flex-1 bg-[#030711] ${expanded ? "flex-1" : ""}`}
        style={expanded ? undefined : compact ? { minHeight: "270px" } : { height: "min(72vh, 760px)", minHeight: "520px" }}
      >
        <div ref={mountRef} className="absolute inset-0" />
        <button type="button" onClick={handlePlayPause} className="ui-button-primary absolute left-3 top-3 z-10 min-w-20 shadow-xl">
          {isPlaying ? "Pause" : "Play"}
        </button>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded border border-[#29446f] bg-[#050a16]/85 px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur">
          {cameraMode} · {displayTime.toFixed(1)}s
        </div>
        <div
          className="pointer-events-none absolute bottom-3 left-3 max-w-[65%] rounded border border-[#1b3153] bg-[#050a16]/85 px-2.5 py-1.5 text-[8px] text-slate-400 backdrop-blur"
          title={THIRD_PARTY_3D_ASSET_NOTICE}
        >
          {assetStatus.total > 0 && assetStatus.loaded < assetStatus.total
            ? `Loading realistic assets ${assetStatus.loaded}/${assetStatus.total}`
            : assetStatus.failed > 0
              ? `Realistic assets ready · ${assetStatus.failed} fallback(s)`
              : "Realistic GLB/PBR assets ready"}
        </div>
      </div>
      <div className={`border-t border-[#182743] bg-[#080e1c] ${compact ? "px-3 py-2" : "p-4"}`}>
        <input type="range" min={0} max={reconstruction.durationSeconds} step={0.01} value={displayTime} onChange={(event) => { setIsPlaying(false); setTime(Number(event.target.value)); }} className="roadsafe-range w-full" />
        <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "mt-1.5" : "mt-3"}`}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setIsPlaying(false); setTime(0); }} className="ui-button py-1.5">Reset</button>
            <span className="text-[9px] font-semibold text-slate-400">{displayTime.toFixed(1)}s / {reconstruction.durationSeconds.toFixed(1)}s</span>
            {!compact && reconstruction.lastPhysicsSimulation && <span className="text-[9px] text-slate-600">{reconstruction.lastPhysicsSimulation.participantCollisions} collision(s) · {reconstruction.lastPhysicsSimulation.estimatedImpactEnergyKj.toFixed(1)} kJ</span>}
          </div>
          {!compact && <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-400">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showPaths} onChange={(event) => setShowPaths(event.target.checked)} /> Paths</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showObjects} onChange={(event) => setShowObjects(event.target.checked)} /> Objects</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showEvidence} onChange={(event) => setShowEvidence(event.target.checked)} /> Evidence</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showPhysicsEffects} onChange={(event) => setShowPhysicsEffects(event.target.checked)} /> Physics</label>
            <select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="ui-input py-1.5"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
          </div>}
        </div>
      </div>
    </section>
  );
}

export default memo(Reconstruction3DViewer);
