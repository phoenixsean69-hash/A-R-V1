import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  DRACO_DECODER_PATH,
  ENVIRONMENT_MODEL_ASSETS,
  PARTICIPANT_MODEL_ASSETS,
  ROAD_TEXTURE_ASSETS,
  SCENE_OBJECT_MODEL_ASSETS,
  type RealisticEnvironmentAssetKey,
  type RealisticModelAsset,
} from "../data/realisticAssetCatalog";
import type {
  ReconstructionSceneObject,
  ReconstructionVehicle,
  SceneObjectSeverity,
} from "../types/reconstruction";

export interface RealisticTargetDimensions {
  length: number;
  height: number;
  width: number;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
dracoLoader.setDecoderConfig({ type: "wasm" });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const modelPromiseCache = new Map<string, Promise<THREE.Object3D>>();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

const PARTICIPANT_TINTS: Record<string, number> = {
  Blue: 0x2563eb,
  Red: 0xdc2626,
  Green: 0x16a34a,
  Yellow: 0xeab308,
  Black: 0x111827,
  White: 0xf1f5f9,
  Orange: 0xea580c,
  Purple: 0x9333ea,
};

function normalisedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findNamedObject(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const direct = root.getObjectByName(name);
  if (direct) return direct;

  const target = normalisedName(name);
  let result: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (!result && normalisedName(object.name) === target) result = object;
  });
  return result;
}

function loadAssetSource(spec: RealisticModelAsset): Promise<THREE.Object3D> {
  const cacheKey = `${spec.url}#${spec.nodeName ?? "scene"}`;
  const existing = modelPromiseCache.get(cacheKey);
  if (existing) return existing;

  const promise = gltfLoader.loadAsync(spec.url).then((gltf) => {
    const source = spec.nodeName
      ? findNamedObject(gltf.scene, spec.nodeName) ?? gltf.scene.children[0]
      : gltf.scene;
    if (!source) {
      throw new Error(`No renderable model was found in ${spec.url}`);
    }
    return source;
  });
  modelPromiseCache.set(cacheKey, promise);
  return promise;
}

function cloneTexture(texture: THREE.Texture | null): THREE.Texture | null {
  if (!texture) return null;
  const copy = texture.clone();
  copy.needsUpdate = true;
  return copy;
}

function cloneMaterial(material: THREE.Material): THREE.Material {
  const copy = material.clone() as THREE.Material & {
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    aoMap?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
  };
  copy.map = cloneTexture(copy.map ?? null);
  copy.normalMap = cloneTexture(copy.normalMap ?? null);
  copy.roughnessMap = cloneTexture(copy.roughnessMap ?? null);
  copy.metalnessMap = cloneTexture(copy.metalnessMap ?? null);
  copy.emissiveMap = cloneTexture(copy.emissiveMap ?? null);
  copy.aoMap = cloneTexture(copy.aoMap ?? null);
  copy.alphaMap = cloneTexture(copy.alphaMap ?? null);
  return copy;
}

function makeIndependentClone(source: THREE.Object3D): THREE.Object3D {
  const clone = cloneSkeleton(source);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;

    const lowerName = object.name.toLowerCase();
    if (lowerName.includes("wheel") || lowerName.includes("tyre") || lowerName.includes("tire")) {
      object.userData.isWheel = true;
      object.userData.baseRotationX = object.rotation.x;
      object.userData.baseRotationY = object.rotation.y;
      object.userData.baseRotationZ = object.rotation.z;
      object.userData.wheelSide = object.position.z < 0 ? -1 : 1;
    }
  });
  return clone;
}

function fitModel(
  model: THREE.Object3D,
  spec: RealisticModelAsset,
  target: RealisticTargetDimensions,
): THREE.Group {
  const wrapper = new THREE.Group();
  model.rotation.y += spec.rotationY ?? 0;
  model.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const safeSize = new THREE.Vector3(
    Math.max(size.x, 0.001),
    Math.max(size.y, 0.001),
    Math.max(size.z, 0.001),
  );
  const scale = Math.min(
    target.length / safeSize.x,
    target.height / safeSize.y,
    target.width / safeSize.z,
  ) * (spec.fill ?? 0.94);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= bounds.min.y;
  model.updateMatrixWorld(true);

  wrapper.add(model);
  wrapper.userData.realisticAsset = true;
  wrapper.userData.assetSource = spec.sourceLabel;
  return wrapper;
}

function shouldTintMaterial(name: string): boolean {
  const excluded = [
    "glass", "window", "windscreen", "windshield", "tyre", "tire", "wheel",
    "rubber", "chrome", "metal", "light", "lamp", "skin", "face", "eye",
    "hair", "road", "asphalt",
  ];
  const lower = name.toLowerCase();
  return !excluded.some((token) => lower.includes(token));
}

function tintModel(model: THREE.Object3D, colour: number, strength: number): void {
  const tint = new THREE.Color(colour);
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const typed = material as THREE.Material & { color?: THREE.Color };
      if (!typed.color || !shouldTintMaterial(material.name || object.name)) return;
      typed.color.lerp(tint, strength);
      material.needsUpdate = true;
    });
  });
}

function addOfficerDetails(group: THREE.Group, target: RealisticTargetDimensions): void {
  const vest = new THREE.Mesh(
    new THREE.BoxGeometry(target.width * 0.74, target.height * 0.32, target.width * 0.32),
    new THREE.MeshPhysicalMaterial({
      color: 0xd8e5b5,
      emissive: 0x5f6f35,
      emissiveIntensity: 0.12,
      roughness: 0.68,
      clearcoat: 0.1,
    }),
  );
  vest.position.set(0, target.height * 0.60, 0);
  vest.userData.officerAccessory = true;
  group.add(vest);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(target.width * 0.22, target.width * 0.24, target.height * 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0x111a2d, roughness: 0.64 }),
  );
  cap.position.set(0, target.height * 0.96, 0);
  cap.userData.officerAccessory = true;
  group.add(cap);
}

export async function loadRealisticParticipantModel(
  participant: ReconstructionVehicle,
  dimensions: [number, number, number],
): Promise<THREE.Group> {
  const spec = PARTICIPANT_MODEL_ASSETS[participant.type];
  const source = await loadAssetSource(spec);
  const target: RealisticTargetDimensions = {
    length: dimensions[0],
    height: dimensions[1],
    width: dimensions[2],
  };
  const result = fitModel(makeIndependentClone(source), spec, target);
  const tint = PARTICIPANT_TINTS[participant.colour] ?? 0x2563eb;
  const isHuman = ["Pedestrian", "Officer", "Witness"].includes(participant.type);
  tintModel(result, tint, isHuman ? 0.16 : 0.34);
  if (participant.type === "Officer") addOfficerDetails(result, target);
  result.userData.assetUrl = spec.url;
  return result;
}

function sceneObjectTarget(object: ReconstructionSceneObject): RealisticTargetDimensions {
  const scale = Math.max(0.25, object.scale);
  switch (object.type) {
    case "Tree": return { length: 3.6 * scale, height: 6.5 * scale, width: 3.6 * scale };
    case "Bush": return { length: 2.5 * scale, height: 1.7 * scale, width: 2.5 * scale };
    case "Street Light": return { length: 1.8 * scale, height: 6.2 * scale, width: 1.2 * scale };
    case "Traffic Light": return { length: 1.4 * scale, height: 5.2 * scale, width: 1.4 * scale };
    case "Bus Stop": return { length: 5.2 * scale, height: 3.1 * scale, width: 2.2 * scale };
    case "Stop Sign": return { length: 1.4 * scale, height: 3.2 * scale, width: 0.6 * scale };
    case "Fence": return { length: Math.max(3, object.lengthMetres ?? 5) * scale, height: 1.8 * scale, width: 0.4 * scale };
    case "Parked Vehicle": return { length: 4.5 * scale, height: 1.6 * scale, width: 1.9 * scale };
    default: return { length: 2 * scale, height: 2 * scale, width: 2 * scale };
  }
}

export async function loadRealisticEnvironmentModel(
  key: RealisticEnvironmentAssetKey,
  target: RealisticTargetDimensions,
): Promise<THREE.Group> {
  const spec = ENVIRONMENT_MODEL_ASSETS[key];
  const source = await loadAssetSource(spec);
  const result = fitModel(makeIndependentClone(source), spec, target);
  result.userData.assetUrl = spec.url;
  return result;
}

export async function loadRealisticSceneObjectModel(
  object: ReconstructionSceneObject,
): Promise<THREE.Object3D | null> {
  const spec = SCENE_OBJECT_MODEL_ASSETS[object.type];
  if (!spec) return null;
  const source = await loadAssetSource(spec);
  const result = fitModel(makeIndependentClone(source), spec, sceneObjectTarget(object));
  result.userData.assetUrl = spec.url;
  return result;
}

function severityColour(severity: SceneObjectSeverity): number {
  if (severity === "Critical") return 0x8f1d1d;
  if (severity === "High") return 0xb45309;
  if (severity === "Medium") return 0xb68a2a;
  return 0x5e7895;
}

function irregularCircleGeometry(radius: number, segments = 48, variance = 0.12): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(radius, segments);
  const positions = geometry.attributes.position;
  for (let index = 1; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const distance = Math.hypot(x, y) || 1;
    const wave = 1 + Math.sin(index * 12.9898) * variance;
    positions.setXY(index, (x / distance) * radius * wave, (y / distance) * radius * wave);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createPothole(object: ReconstructionSceneObject): THREE.Group {
  const radius = Math.max(0.55, object.scale * 0.9);
  const group = new THREE.Group();
  const depression = new THREE.Mesh(
    irregularCircleGeometry(radius, 64, 0.16),
    new THREE.MeshPhysicalMaterial({
      color: 0x15191d,
      roughness: 0.96,
      metalness: 0,
      clearcoat: object.depthCentimetres && object.depthCentimetres > 8 ? 0.08 : 0,
    }),
  );
  depression.rotation.x = -Math.PI / 2;
  depression.position.y = -0.025;

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.82, radius * 0.18, 12, 52),
    new THREE.MeshStandardMaterial({
      color: 0x393d3f,
      roughness: 1,
      bumpScale: 0.08,
    }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.72;
  rim.position.y = 0.025;
  group.add(depression, rim);
  return group;
}

function createLiquidPatch(object: ReconstructionSceneObject, oil: boolean): THREE.Mesh {
  const geometry = irregularCircleGeometry(Math.max(0.65, object.scale), 64, 0.22);
  const material = new THREE.MeshPhysicalMaterial({
    color: oil ? 0x11151d : 0x355a72,
    roughness: oil ? 0.08 : 0.16,
    metalness: oil ? 0.42 : 0.08,
    transmission: oil ? 0.08 : 0.22,
    transparent: true,
    opacity: oil ? 0.76 : 0.58,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.025;
  return mesh;
}

function createRockField(object: ReconstructionSceneObject, glass = false): THREE.Group {
  const group = new THREE.Group();
  const count = glass ? 22 : 18;
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963;
    const radius = Math.sqrt(index / count) * object.scale * 1.25;
    const geometry = glass
      ? new THREE.TetrahedronGeometry(0.05 + (index % 4) * 0.025)
      : new THREE.DodecahedronGeometry(0.06 + (index % 5) * 0.025, 0);
    const material = glass
      ? new THREE.MeshPhysicalMaterial({
          color: 0x9ecbe0,
          roughness: 0.08,
          transmission: 0.48,
          transparent: true,
          opacity: 0.76,
          thickness: 0.02,
        })
      : new THREE.MeshStandardMaterial({ color: 0x6b6256, roughness: 0.98 });
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
    piece.rotation.set(angle * 0.6, angle, angle * 0.35);
    piece.castShadow = true;
    group.add(piece);
  }
  return group;
}

function createTrafficCone(object: ReconstructionSceneObject): THREE.Group {
  const scale = Math.max(0.4, object.scale);
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.75 * scale, 0.08 * scale, 0.75 * scale),
    new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.86 }),
  );
  base.position.y = 0.04 * scale;
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.27 * scale, 0.85 * scale, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xd55c18, roughness: 0.52, clearcoat: 0.22 }),
  );
  cone.position.y = 0.50 * scale;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 0.16 * scale, 32),
    new THREE.MeshStandardMaterial({ color: 0xe8e8df, roughness: 0.42 }),
  );
  band.position.y = 0.48 * scale;
  group.add(base, cone, band);
  return group;
}

function createBarrier(object: ReconstructionSceneObject): THREE.Group {
  const length = Math.max(2.5, object.lengthMetres ?? 4.5) * object.scale;
  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.48, 0.18),
    new THREE.MeshPhysicalMaterial({ color: 0xd7d8d2, roughness: 0.56, clearcoat: 0.18 }),
  );
  board.position.y = 1.05;
  group.add(board);
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xc9482c, roughness: 0.55 });
  for (let x = -length / 2 + 0.35; x < length / 2; x += 0.75) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.49, 0.19), stripeMaterial);
    stripe.position.set(x, 1.05, 0);
    stripe.rotation.z = -0.35;
    group.add(stripe);
  }
  for (const x of [-length * 0.38, length * 0.38]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.25, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x40454c, metalness: 0.45, roughness: 0.5 }),
    );
    post.position.set(x, 0.62, 0);
    group.add(post);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.10, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.88 }),
    );
    foot.position.set(x, 0.05, 0);
    group.add(foot);
  }
  return group;
}

function createSignTexture(label: string, shape: "circle" | "triangle"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, 512, 512);
    context.lineWidth = 38;
    context.strokeStyle = "#b91c1c";
    context.fillStyle = "#f5f5ef";
    if (shape === "circle") {
      context.beginPath();
      context.arc(256, 256, 205, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(256, 455);
      context.lineTo(55, 90);
      context.lineTo(457, 90);
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.fillStyle = "#141414";
    context.font = `700 ${label.length > 3 ? 105 : 160}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 256, shape === "circle" ? 270 : 245);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRoadSign(object: ReconstructionSceneObject): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 2.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x8f969d, metalness: 0.78, roughness: 0.32 }),
  );
  pole.position.y = 1.3;
  group.add(pole);
  const isYield = object.type === "Give Way Sign";
  const label = object.type === "Speed Limit Sign"
    ? String(object.speedLimitKmh ?? 60)
    : "GIVE";
  const board = new THREE.Mesh(
    isYield ? new THREE.CircleGeometry(0.66, 3) : new THREE.CircleGeometry(0.66, 48),
    new THREE.MeshStandardMaterial({
      map: createSignTexture(label, isYield ? "triangle" : "circle"),
      transparent: true,
      roughness: 0.48,
      side: THREE.DoubleSide,
    }),
  );
  board.position.set(0, 2.45, 0.04);
  if (isYield) board.rotation.z = Math.PI;
  group.add(board);
  return group;
}

function createGuardrail(object: ReconstructionSceneObject): THREE.Group {
  const length = Math.max(3, object.lengthMetres ?? 6) * object.scale;
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xadb4bb, metalness: 0.82, roughness: 0.28 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.32, 0.10), metal);
  rail.position.y = 0.78;
  group.add(rail);
  for (let x = -length / 2; x <= length / 2; x += 1.4) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.95, 0.14), metal);
    post.position.set(x, 0.46, 0);
    group.add(post);
  }
  return group;
}

function createWall(object: ReconstructionSceneObject): THREE.Group {
  const length = Math.max(2.5, object.lengthMetres ?? 5) * object.scale;
  const height = Math.max(1.2, object.widthMetres ?? 1.8) * object.scale;
  const group = new THREE.Group();
  const brickMaterial = new THREE.MeshStandardMaterial({ color: 0x665b53, roughness: 0.98 });
  const courses = Math.max(3, Math.round(height / 0.32));
  const bricks = Math.max(4, Math.round(length / 0.72));
  for (let row = 0; row < courses; row += 1) {
    for (let column = 0; column < bricks; column += 1) {
      const brick = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 0.34), brickMaterial);
      brick.position.set(
        -length / 2 + 0.34 + column * (length / bricks) + (row % 2 ? 0.28 : 0),
        0.15 + row * 0.30,
        0,
      );
      group.add(brick);
    }
  }
  return group;
}

function createCctv(object: ReconstructionSceneObject): THREE.Group {
  const scale = Math.max(0.6, object.scale);
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x6d7781, metalness: 0.72, roughness: 0.32 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.5 * scale, 18), metal);
  pole.position.y = 1.75 * scale;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.07, 0.07), metal);
  arm.position.set(0.34 * scale, 3.35 * scale, 0);
  group.add(arm);
  const camera = new THREE.Mesh(
    new THREE.BoxGeometry(0.54 * scale, 0.24 * scale, 0.24 * scale),
    new THREE.MeshPhysicalMaterial({ color: 0xd7dce0, roughness: 0.42, clearcoat: 0.18 }),
  );
  camera.position.set(0.77 * scale, 3.30 * scale, 0);
  camera.rotation.z = -0.12;
  group.add(camera);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065 * scale, 0.065 * scale, 0.04, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x07101a, roughness: 0.06, metalness: 0.45, clearcoat: 1 }),
  );
  lens.rotation.z = Math.PI / 2;
  lens.position.set(1.055 * scale, 3.30 * scale, 0);
  group.add(lens);
  return group;
}

function createBranch(object: ReconstructionSceneObject): THREE.Group {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3926, roughness: 0.98 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x315b32, roughness: 0.9 });
  const main = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 2.5 * object.scale, 14), wood);
  main.rotation.z = Math.PI / 2;
  main.position.y = 0.18;
  group.add(main);
  for (let index = 0; index < 5; index += 1) {
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 0.9 * object.scale, 10), wood);
    twig.position.set(-0.8 + index * 0.4, 0.35, (index % 2 ? 1 : -1) * 0.2);
    twig.rotation.set((index % 2 ? 1 : -1) * 0.5, 0, (index % 2 ? 1 : -1) * 0.8);
    group.add(twig);
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 * object.scale, 1), leaf);
    foliage.position.set(twig.position.x, 0.72, twig.position.z * 2);
    group.add(foliage);
  }
  return group;
}

function createMarker(object: ReconstructionSceneObject): THREE.Group {
  const group = new THREE.Group();
  const colour = severityColour(object.severity);
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.75, 16),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.46, roughness: 0.42 }),
  );
  post.position.y = 0.38;
  const head = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 1),
    new THREE.MeshPhysicalMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.14, roughness: 0.38 }),
  );
  head.position.y = 0.9;
  group.add(post, head);
  return group;
}

export function createRealisticProceduralSceneObject(
  object: ReconstructionSceneObject,
): THREE.Object3D {
  switch (object.type) {
    case "Pothole": return createPothole(object);
    case "Puddle": return createLiquidPatch(object, false);
    case "Oil Spill": return createLiquidPatch(object, true);
    case "Loose Gravel": return createRockField(object);
    case "Broken Glass": return createRockField(object, true);
    case "Debris": return createRockField(object);
    case "Traffic Cone": return createTrafficCone(object);
    case "Road Barrier": return createBarrier(object);
    case "Give Way Sign":
    case "Speed Limit Sign": return createRoadSign(object);
    case "Guardrail": return createGuardrail(object);
    case "Wall": return createWall(object);
    case "CCTV Camera": return createCctv(object);
    case "Fallen Branch": return createBranch(object);
    case "Road Crack":
    case "Skid Mark":
    case "Tyre Mark": {
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.98 });
      const length = Math.max(1.8, object.lengthMetres ?? 3.2) * object.scale;
      const strips = object.traceStyle === "Double" ? [-0.22, 0.22] : [0];
      strips.forEach((z) => {
        const mark = new THREE.Mesh(
          new THREE.PlaneGeometry(length, Math.max(0.05, object.traceWidth ?? 0.12)),
          material,
        );
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(0, 0.022, z);
        group.add(mark);
      });
      return group;
    }
    case "Drain": {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 * object.scale, 0.08, 0.8 * object.scale),
        new THREE.MeshStandardMaterial({ color: 0x333a42, metalness: 0.74, roughness: 0.42 }),
      );
      frame.position.y = 0.035;
      group.add(frame);
      for (let index = -4; index <= 4; index += 1) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.05, 0.72 * object.scale),
          new THREE.MeshStandardMaterial({ color: 0x11161b, metalness: 0.7, roughness: 0.48 }),
        );
        bar.position.set(index * 0.12 * object.scale, 0.08, 0);
        group.add(bar);
      }
      return group;
    }
    case "Vehicle Part": {
      const fragment = new THREE.Mesh(
        new THREE.BoxGeometry(0.75 * object.scale, 0.18 * object.scale, 0.45 * object.scale),
        new THREE.MeshPhysicalMaterial({ color: 0x66717d, metalness: 0.72, roughness: 0.28, clearcoat: 0.34 }),
      );
      fragment.position.y = 0.12;
      fragment.rotation.set(0.28, 0.52, 0.16);
      return fragment;
    }
    case "Bush": {
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: 0x2f5935, roughness: 0.92 });
      for (let index = 0; index < 9; index += 1) {
        const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 * object.scale, 2), material);
        const angle = index * 2.399;
        clump.position.set(Math.cos(angle) * 0.65 * object.scale, 0.4 + (index % 3) * 0.18, Math.sin(angle) * 0.65 * object.scale);
        group.add(clump);
      }
      return group;
    }
    case "Evidence Marker":
    case "Measurement Point":
    case "Witness Viewpoint":
    case "Injury Location": return createMarker(object);
    default: return createMarker(object);
  }
}

export function enhanceTextureFromUrl(
  target: THREE.Texture,
  url: string,
  repeatX: number,
  repeatY: number,
): void {
  textureLoader.load(
    url,
    (loaded) => {
      target.image = loaded.image;
      target.colorSpace = THREE.SRGBColorSpace;
      target.wrapS = THREE.RepeatWrapping;
      target.wrapT = THREE.RepeatWrapping;
      target.repeat.set(repeatX, repeatY);
      target.anisotropy = 8;
      target.needsUpdate = true;
      loaded.dispose();
    },
    undefined,
    () => {
      // Keep the generated fallback texture when offline or blocked by CORS.
    },
  );
}

export function enhanceRoadTextures(
  asphalt: THREE.Texture,
  ground: THREE.Texture,
  sidewalk?: THREE.Texture,
): void {
  enhanceTextureFromUrl(asphalt, ROAD_TEXTURE_ASSETS.asphalt, 10, 10);
  enhanceTextureFromUrl(ground, ROAD_TEXTURE_ASSETS.asphaltBright, 7, 7);
  if (sidewalk) enhanceTextureFromUrl(sidewalk, ROAD_TEXTURE_ASSETS.sidewalk, 7, 20);
}

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const typed = material as THREE.Material & {
        map?: THREE.Texture | null;
        normalMap?: THREE.Texture | null;
        roughnessMap?: THREE.Texture | null;
        metalnessMap?: THREE.Texture | null;
        emissiveMap?: THREE.Texture | null;
        aoMap?: THREE.Texture | null;
        alphaMap?: THREE.Texture | null;
      };
      typed.map?.dispose();
      typed.normalMap?.dispose();
      typed.roughnessMap?.dispose();
      typed.metalnessMap?.dispose();
      typed.emissiveMap?.dispose();
      typed.aoMap?.dispose();
      typed.alphaMap?.dispose();
      material.dispose();
    });
  });
}
