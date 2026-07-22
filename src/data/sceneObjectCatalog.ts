import type {
  SceneObjectCategory,
  SceneObjectSeverity,
  SceneObjectType,
} from "../types/reconstruction";

export interface SceneObjectCatalogItem {
  type: SceneObjectType;
  category: SceneObjectCategory;
  label: string;
  icon: string;
  defaultSeverity: SceneObjectSeverity;
  description: string;
}

export const sceneObjectCatalog: SceneObjectCatalogItem[] = [
  {
    type: "Pothole",
    category: "Road Hazards",
    label: "Pothole",
    icon: "◉",
    defaultSeverity: "High",
    description: "Road-surface cavity or depression.",
  },
  {
    type: "Road Crack",
    category: "Road Hazards",
    label: "Road Crack",
    icon: "⌁",
    defaultSeverity: "Medium",
    description: "Visible road-surface cracking.",
  },
  {
    type: "Puddle",
    category: "Road Hazards",
    label: "Puddle",
    icon: "≈",
    defaultSeverity: "Medium",
    description: "Standing water on or beside the road.",
  },
  {
    type: "Oil Spill",
    category: "Road Hazards",
    label: "Oil Spill",
    icon: "●",
    defaultSeverity: "High",
    description: "Slippery oil or fuel contamination.",
  },
  {
    type: "Loose Gravel",
    category: "Road Hazards",
    label: "Loose Gravel",
    icon: "∴",
    defaultSeverity: "Medium",
    description: "Loose stones affecting traction.",
  },
  {
    type: "Debris",
    category: "Road Hazards",
    label: "Debris",
    icon: "✦",
    defaultSeverity: "Medium",
    description: "General road debris or scattered objects.",
  },
  {
    type: "Fallen Branch",
    category: "Road Hazards",
    label: "Fallen Branch",
    icon: "⌇",
    defaultSeverity: "High",
    description: "Branch or vegetation blocking the roadway.",
  },
  {
    type: "Broken Glass",
    category: "Physical Evidence",
    label: "Broken Glass",
    icon: "✧",
    defaultSeverity: "Low",
    description: "Glass fragments associated with the collision.",
  },
  {
    type: "Skid Mark",
    category: "Physical Evidence",
    label: "Skid Mark",
    icon: "═",
    defaultSeverity: "Medium",
    description: "Braking or sliding tyre marks.",
  },
  {
    type: "Tyre Mark",
    category: "Physical Evidence",
    label: "Tyre Mark",
    icon: "━",
    defaultSeverity: "Low",
    description: "Tyre track or rolling mark.",
  },
  {
    type: "Vehicle Part",
    category: "Physical Evidence",
    label: "Vehicle Part",
    icon: "◆",
    defaultSeverity: "Medium",
    description: "Detached vehicle component or fragment.",
  },
  {
    type: "Injury Location",
    category: "Physical Evidence",
    label: "Injury Location",
    icon: "+",
    defaultSeverity: "Critical",
    description: "Recorded location of an injured person.",
  },
  {
    type: "Traffic Cone",
    category: "Traffic Control",
    label: "Traffic Cone",
    icon: "▲",
    defaultSeverity: "Low",
    description: "Portable traffic cone.",
  },
  {
    type: "Road Barrier",
    category: "Traffic Control",
    label: "Road Barrier",
    icon: "▰",
    defaultSeverity: "Medium",
    description: "Temporary or permanent road barrier.",
  },
  {
    type: "Stop Sign",
    category: "Traffic Control",
    label: "Stop Sign",
    icon: "STOP",
    defaultSeverity: "Low",
    description: "Stop-control sign.",
  },
  {
    type: "Give Way Sign",
    category: "Traffic Control",
    label: "Give Way Sign",
    icon: "▽",
    defaultSeverity: "Low",
    description: "Give-way or yield sign.",
  },
  {
    type: "Speed Limit Sign",
    category: "Traffic Control",
    label: "Speed Limit Sign",
    icon: "60",
    defaultSeverity: "Low",
    description: "Posted speed-limit sign.",
  },
  {
    type: "Traffic Light",
    category: "Traffic Control",
    label: "Traffic Light",
    icon: "●●●",
    defaultSeverity: "Low",
    description: "Traffic-signal head.",
  },
  {
    type: "Street Light",
    category: "Road Infrastructure",
    label: "Street Light",
    icon: "⌐",
    defaultSeverity: "Low",
    description: "Roadside street-light pole.",
  },
  {
    type: "Drain",
    category: "Road Infrastructure",
    label: "Drain",
    icon: "▦",
    defaultSeverity: "Medium",
    description: "Drainage inlet or open drain.",
  },
  {
    type: "Guardrail",
    category: "Road Infrastructure",
    label: "Guardrail",
    icon: "━━",
    defaultSeverity: "Low",
    description: "Roadside safety barrier.",
  },
  {
    type: "Bus Stop",
    category: "Road Infrastructure",
    label: "Bus Stop",
    icon: "BUS",
    defaultSeverity: "Low",
    description: "Bus-stop or passenger loading point.",
  },
  {
    type: "Parked Vehicle",
    category: "Road Infrastructure",
    label: "Parked Vehicle",
    icon: "▣",
    defaultSeverity: "Medium",
    description: "Stationary vehicle or visual obstruction.",
  },
  {
    type: "Tree",
    category: "Environment",
    label: "Tree",
    icon: "♣",
    defaultSeverity: "Medium",
    description: "Tree affecting visibility or roadside clearance.",
  },
  {
    type: "Bush",
    category: "Environment",
    label: "Bush",
    icon: "✿",
    defaultSeverity: "Medium",
    description: "Vegetation or bush affecting visibility.",
  },
  {
    type: "Wall",
    category: "Environment",
    label: "Wall",
    icon: "▤",
    defaultSeverity: "Medium",
    description: "Wall or solid roadside obstruction.",
  },
  {
    type: "Fence",
    category: "Environment",
    label: "Fence",
    icon: "╫",
    defaultSeverity: "Low",
    description: "Fence or roadside boundary.",
  },
  {
    type: "CCTV Camera",
    category: "Investigation",
    label: "CCTV Camera",
    icon: "CAM",
    defaultSeverity: "Low",
    description: "Camera location and viewing direction.",
  },
  {
    type: "Evidence Marker",
    category: "Investigation",
    label: "Evidence Marker",
    icon: "1",
    defaultSeverity: "Low",
    description: "Numbered evidence location.",
  },
  {
    type: "Measurement Point",
    category: "Investigation",
    label: "Measurement Point",
    icon: "⊕",
    defaultSeverity: "Low",
    description: "Measured reference point in the scene.",
  },
  {
    type: "Witness Viewpoint",
    category: "Investigation",
    label: "Witness Viewpoint",
    icon: "◉→",
    defaultSeverity: "Low",
    description: "Witness location and viewing direction.",
  },
];

export const sceneObjectCategories: SceneObjectCategory[] = [
  "Road Hazards",
  "Physical Evidence",
  "Traffic Control",
  "Road Infrastructure",
  "Environment",
  "Investigation",
];

export function getSceneObjectCatalogItem(
  type: SceneObjectType,
): SceneObjectCatalogItem {
  const item = sceneObjectCatalog.find((entry) => entry.type === type);

  if (!item) {
    throw new Error(`Unknown scene object type: ${type}`);
  }

  return item;
}
