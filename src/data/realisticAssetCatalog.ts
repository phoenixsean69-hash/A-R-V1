import type {
  ReconstructionVehicleType,
  SceneObjectType,
} from "../types/reconstruction";

export interface RealisticModelAsset {
  url: string;
  nodeName?: string;
  rotationY?: number;
  fill?: number;
  sourceLabel: string;
}

const configuredBaseUrl = import.meta.env.VITE_ROADSAFE_3D_ASSET_BASE_URL?.trim();

export const REALISTIC_ASSET_BASE_URL = (
  configuredBaseUrl || "https://assets.3dstreet.app/"
).replace(/\/?$/, "/");

export const DRACO_DECODER_PATH =
  import.meta.env.VITE_ROADSAFE_DRACO_DECODER_PATH?.trim() ||
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

function asset(
  path: string,
  options: Omit<RealisticModelAsset, "url" | "sourceLabel"> & {
    sourceLabel?: string;
  } = {},
): RealisticModelAsset {
  return {
    url: `${REALISTIC_ASSET_BASE_URL}${path}`,
    sourceLabel: options.sourceLabel ?? "3DStreet",
    nodeName: options.nodeName,
    rotationY: options.rotationY,
    fill: options.fill,
  };
}

/**
 * Web-optimised, Draco-compressed prototype models.
 * Keep all third-party URLs isolated here so commercially licensed or
 * institution-owned assets can be swapped without touching the renderer.
 */
export const PARTICIPANT_MODEL_ASSETS: Record<
  ReconstructionVehicleType,
  RealisticModelAsset
> = {
  Car: asset("sets/vehicles-rig/gltf-exports/draco/toyota-prius-rig.glb", {
    rotationY: Math.PI / 2,
    fill: 0.94,
  }),
  Bus: asset("sets/flyer-bus/gltf-exports/draco/new-flyer-bus.glb", {
    rotationY: Math.PI / 2,
    fill: 0.94,
  }),
  Truck: asset("sets/vehicles-rig/gltf-exports/draco/isuzu-truck-rig.glb", {
    rotationY: Math.PI / 2,
    fill: 0.94,
  }),
  Motorcycle: asset("sets/vehicles/gltf-exports/draco/two-wheeler-with-person.glb", {
    rotationY: Math.PI / 2,
    fill: 0.92,
  }),
  Bicycle: asset("sets/micro-mobility-devices/gltf-exports/draco/bike-only-hybrid.glb", {
    rotationY: Math.PI / 2,
    fill: 0.92,
  }),
  Pedestrian: asset("sets/human-characters-poses-1/gltf-exports/draco/human-characters-poses-1.glb", {
    nodeName: "Character_1",
    fill: 0.95,
  }),
  Officer: asset("sets/human-characters-poses-1/gltf-exports/draco/human-characters-poses-1.glb", {
    nodeName: "Character_7",
    fill: 0.95,
  }),
  Witness: asset("sets/human-characters-poses-2/gltf-exports/draco/human-characters-poses-2.glb", {
    nodeName: "Character_10",
    fill: 0.95,
  }),
};

const streetProps = (nodeName: string, fill = 0.95): RealisticModelAsset =>
  asset("sets/street-props/gltf-exports/draco/street-props.glb", {
    nodeName,
    fill,
  });

export const SCENE_OBJECT_MODEL_ASSETS: Partial<
  Record<SceneObjectType, RealisticModelAsset>
> = {
  Tree: streetProps("tree-01"),
  Bush: streetProps("tree-01", 0.82),
  "Street Light": streetProps("street-light"),
  "Bus Stop": streetProps("transit-shelter-1"),
  "Traffic Light": asset("sets/signals/gltf-exports/draco/signal1.glb", {
    fill: 0.92,
  }),
  "Stop Sign": asset("sets/road-signs/gltf-exports/draco/stop-sign.glb", {
    fill: 0.92,
  }),
  Fence: asset("sets/fences/gltf-exports/draco/fence4.glb", {
    fill: 0.95,
  }),
  "Parked Vehicle": PARTICIPANT_MODEL_ASSETS.Car,
};


export type RealisticEnvironmentAssetKey =
  | "streetLight"
  | "suburbanHouses"
  | "schoolBuilding"
  | "commercialBuilding";

export const ENVIRONMENT_MODEL_ASSETS: Record<
  RealisticEnvironmentAssetKey,
  RealisticModelAsset
> = {
  streetLight: streetProps("street-light"),
  suburbanHouses: asset("sets/suburban-houses/gltf-exports/draco/suburban-houses.glb", {
    fill: 0.94,
  }),
  schoolBuilding: asset("sets/school-building/gltf-exports/draco/school-building.glb", {
    fill: 0.94,
  }),
  commercialBuilding: asset("sets/irish-bar-building/gltf-exports/draco/irish-bar-building.glb", {
    fill: 0.94,
  }),
};

export const ROAD_TEXTURE_ASSETS = {
  asphalt:
    `${REALISTIC_ASSET_BASE_URL}materials/TexturesCom_Roads0086_1_seamless_S_rotate.jpg`,
  asphaltBright:
    `${REALISTIC_ASSET_BASE_URL}materials/asphalthd_Base_Color.jpg`,
  sidewalk:
    `${REALISTIC_ASSET_BASE_URL}materials/TexturesCom_FloorsRegular0301_1_seamless_S.jpg`,
  markings:
    `${REALISTIC_ASSET_BASE_URL}materials/lane-markings-atlas_1024.png`,
};

export const THIRD_PARTY_3D_ASSET_NOTICE =
  "Prototype models and materials: 3DStreet assets, CC BY-NC-SA 4.0. Replace or commercially license before commercial deployment.";
