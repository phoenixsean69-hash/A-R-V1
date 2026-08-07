import * as THREE from "three";

import { FBXLoader } from
  "three/examples/jsm/loaders/FBXLoader.js";

import { GLTFLoader } from
  "three/examples/jsm/loaders/GLTFLoader.js";

import {
  clone as cloneSkeleton,
} from
  "three/examples/jsm/utils/SkeletonUtils.js";

import type {
  ReconstructionParticipantAssetId,
  ReconstructionVehicle,
  ReconstructionVehicleColour,
} from "../types/reconstruction";

import {
  PARTICIPANT_ASSET_CATALOG,
  getDefaultParticipantAssetId,
  getParticipantColourNumber,
  getParticipantPhysicalDimensions,
} from "../engine/assets/participantAssetCatalog";

import {
  getPremiumParticipantRuntimeAsset,
  type PremiumParticipantRuntimeAsset,
} from "../engine/assets/premiumParticipantAssetManifest";

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

const sourceCache =
  new Map<string, Promise<THREE.Object3D>>();

function cloneTexture(
  texture: THREE.Texture | null,
): THREE.Texture | null {
  if (!texture) return null;

  const copy = texture.clone();
  copy.needsUpdate = true;
  return copy;
}

function cloneMaterial(
  material: THREE.Material,
): THREE.Material {
  const copy =
    material.clone() as THREE.Material & {
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

function independentClone(
  source: THREE.Object3D,
): THREE.Object3D {
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
  });

  return clone;
}

async function loadSource(
  spec: PremiumParticipantRuntimeAsset,
): Promise<THREE.Object3D> {
  const cached = sourceCache.get(spec.url);
  if (cached) return cached;

  const promise =
    spec.format === "fbx"
      ? fbxLoader
          .loadAsync(spec.url)
          .then((group) => group as THREE.Object3D)
      : gltfLoader
          .loadAsync(spec.url)
          .then((gltf) => gltf.scene);

  sourceCache.set(spec.url, promise);
  return promise;
}

function fitPremiumModel(
  source: THREE.Object3D,
  target: {
    lengthMetres: number;
    widthMetres: number;
    heightMetres: number;
  },
): THREE.Group {
  const model = independentClone(source);

  model.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(model);
  let size = bounds.getSize(new THREE.Vector3());

  // Align the longest horizontal model axis with RoadSafe X/length.
  if (
    target.lengthMetres > target.widthMetres * 1.15 &&
    size.z > size.x * 1.12
  ) {
    model.rotation.y += Math.PI / 2;
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    size = bounds.getSize(new THREE.Vector3());
  }

  const safeX = Math.max(size.x, 0.001);
  const safeY = Math.max(size.y, 0.001);
  const safeZ = Math.max(size.z, 0.001);

  const scale =
    Math.min(
      target.lengthMetres / safeX,
      target.heightMetres / safeY,
      target.widthMetres / safeZ,
    ) * 0.96;

  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(model);

  const centre = bounds.getCenter(new THREE.Vector3());

  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= bounds.min.y;

  model.updateMatrixWorld(true);

  const wrapper = new THREE.Group();
  wrapper.add(model);

  wrapper.userData.premiumParticipantAsset = true;

  return wrapper;
}

function shouldTint(
  materialName: string,
  objectName: string,
): boolean {
  const name =
    `${materialName} ${objectName}`.toLowerCase();

  const excluded = [
    "glass",
    "window",
    "windshield",
    "windscreen",
    "wheel",
    "tyre",
    "tire",
    "rubber",
    "chrome",
    "light",
    "lamp",
    "skin",
    "face",
    "eye",
    "hair",
  ];

  return !excluded.some((token) => name.includes(token));
}

function lightlyTint(
  model: THREE.Object3D,
  colour: ReconstructionVehicleColour,
  strength: number,
): void {
  const tint = new THREE.Color(
    getParticipantColourNumber(colour),
  );

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach((material) => {
      const typed = material as
        THREE.Material & { color?: THREE.Color };

      if (
        !typed.color ||
        !shouldTint(material.name, object.name)
      ) {
        return;
      }

      typed.color.lerp(tint, strength);
      material.needsUpdate = true;
    });
  });
}

export async function loadPremiumParticipantAssetModel(
  assetId: ReconstructionParticipantAssetId,
): Promise<THREE.Group | null> {
  const spec =
    await getPremiumParticipantRuntimeAsset(assetId);

  if (!spec) return null;

  const asset =
    PARTICIPANT_ASSET_CATALOG[assetId];

  if (!asset) return null;

  const source = await loadSource(spec);

  const result = fitPremiumModel(
    source,
    asset.dimensions,
  );

  result.userData.assetId = assetId;
  result.userData.assetUrl = spec.url;
  result.userData.assetSource = spec.sourceName;
  result.userData.assetLicense = spec.license;

  return result;
}

export async function loadPremiumParticipantModel(
  participant: ReconstructionVehicle,
): Promise<THREE.Group | null> {
  const assetId =
    participant.assetId ??
    getDefaultParticipantAssetId(participant.type);

  const spec =
    await getPremiumParticipantRuntimeAsset(assetId);

  if (!spec) return null;

  const source = await loadSource(spec);

  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const result = fitPremiumModel(
    source,
    dimensions,
  );

  const human = [
    "Pedestrian",
    "Officer",
    "Witness",
  ].includes(participant.type);

  lightlyTint(
    result,
    participant.colour,
    human ? 0.035 : 0.1,
  );

  result.userData.assetId = assetId;
  result.userData.assetUrl = spec.url;
  result.userData.assetSource = spec.sourceName;
  result.userData.assetLicense = spec.license;

  return result;
}
