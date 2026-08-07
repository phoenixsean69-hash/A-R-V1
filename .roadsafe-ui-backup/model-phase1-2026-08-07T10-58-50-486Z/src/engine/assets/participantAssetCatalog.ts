import type {
  ReconstructionParticipantAssetId,
  ReconstructionVehicle,
  ReconstructionVehicleColour,
  ReconstructionVehicleType,
} from "../../types/reconstruction";

export type ParticipantAssetFamily =
  | "Passenger Car"
  | "Utility Vehicle"
  | "Bus"
  | "Truck"
  | "Two Wheeler"
  | "Human";

export type ParticipantAssetLod = "High" | "Medium" | "Low";

export interface ParticipantAssetDimensions {
  lengthMetres: number;
  widthMetres: number;
  heightMetres: number;
}

export interface ParticipantAssetCollisionProfile {
  shape: "Oriented Box" | "Circle";
  lengthMetres: number;
  widthMetres: number;
  radiusMetres: number;
}

export interface ParticipantAssetDefinition {
  id: ReconstructionParticipantAssetId;
  label: string;
  shortLabel: string;
  family: ParticipantAssetFamily;
  supportedTypes: ReconstructionVehicleType[];
  dimensions: ParticipantAssetDimensions;
  collision: ParticipantAssetCollisionProfile;
  defaultMassKg: number;
  wheelbaseMetres?: number;
  wheelRadiusMetres?: number;
  lodTriangleBudget: Record<ParticipantAssetLod, number>;
  notes: string;
}

function boxCollision(
  lengthMetres: number,
  widthMetres: number,
): ParticipantAssetCollisionProfile {
  return {
    shape: "Oriented Box",
    lengthMetres,
    widthMetres,
    radiusMetres: Math.hypot(lengthMetres, widthMetres) / 2,
  };
}

function circleCollision(
  radiusMetres: number,
): ParticipantAssetCollisionProfile {
  return {
    shape: "Circle",
    lengthMetres: radiusMetres * 2,
    widthMetres: radiusMetres * 2,
    radiusMetres,
  };
}

export const PARTICIPANT_ASSET_CATALOG: Record<
  ReconstructionParticipantAssetId,
  ParticipantAssetDefinition
> = {
  "car-sedan-generic": {
    id: "car-sedan-generic",
    label: "Generic Sedan",
    shortLabel: "Sedan",
    family: "Passenger Car",
    supportedTypes: ["Car"],
    dimensions: {
      lengthMetres: 4.6,
      widthMetres: 1.8,
      heightMetres: 1.45,
    },
    collision: boxCollision(4.45, 1.76),
    defaultMassKg: 1450,
    wheelbaseMetres: 2.7,
    wheelRadiusMetres: 0.31,
    lodTriangleBudget: {
      High: 26000,
      Medium: 10500,
      Low: 2600,
    },
    notes: "Neutral four-door passenger sedan.",
  },

  "car-hatchback-generic": {
    id: "car-hatchback-generic",
    label: "Generic Hatchback",
    shortLabel: "Hatchback",
    family: "Passenger Car",
    supportedTypes: ["Car"],
    dimensions: {
      lengthMetres: 4.15,
      widthMetres: 1.78,
      heightMetres: 1.5,
    },
    collision: boxCollision(4.02, 1.74),
    defaultMassKg: 1280,
    wheelbaseMetres: 2.55,
    wheelRadiusMetres: 0.3,
    lodTriangleBudget: {
      High: 24000,
      Medium: 9500,
      Low: 2400,
    },
    notes: "Neutral compact hatchback.",
  },

  "car-suv-generic": {
    id: "car-suv-generic",
    label: "Generic SUV",
    shortLabel: "SUV",
    family: "Utility Vehicle",
    supportedTypes: ["Car"],
    dimensions: {
      lengthMetres: 4.75,
      widthMetres: 1.92,
      heightMetres: 1.72,
    },
    collision: boxCollision(4.58, 1.88),
    defaultMassKg: 1850,
    wheelbaseMetres: 2.82,
    wheelRadiusMetres: 0.36,
    lodTriangleBudget: {
      High: 28000,
      Medium: 11500,
      Low: 2800,
    },
    notes: "Neutral five-door sport utility vehicle.",
  },

  "car-pickup-generic": {
    id: "car-pickup-generic",
    label: "Generic Pickup",
    shortLabel: "Pickup",
    family: "Utility Vehicle",
    supportedTypes: ["Car", "Truck"],
    dimensions: {
      lengthMetres: 5.35,
      widthMetres: 1.92,
      heightMetres: 1.8,
    },
    collision: boxCollision(5.15, 1.88),
    defaultMassKg: 2050,
    wheelbaseMetres: 3.15,
    wheelRadiusMetres: 0.38,
    lodTriangleBudget: {
      High: 28000,
      Medium: 11000,
      Low: 2800,
    },
    notes: "Neutral double-cab pickup with open load bed.",
  },

  "bus-minibus-generic": {
    id: "bus-minibus-generic",
    label: "Generic Minibus",
    shortLabel: "Minibus",
    family: "Bus",
    supportedTypes: ["Bus"],
    dimensions: {
      lengthMetres: 5.5,
      widthMetres: 1.95,
      heightMetres: 2.25,
    },
    collision: boxCollision(5.34, 1.9),
    defaultMassKg: 2850,
    wheelbaseMetres: 3.2,
    wheelRadiusMetres: 0.36,
    lodTriangleBudget: {
      High: 26000,
      Medium: 10000,
      Low: 2500,
    },
    notes: "Neutral commuter minibus.",
  },

  "bus-city-generic": {
    id: "bus-city-generic",
    label: "Generic Bus",
    shortLabel: "Bus",
    family: "Bus",
    supportedTypes: ["Bus"],
    dimensions: {
      lengthMetres: 11.8,
      widthMetres: 2.55,
      heightMetres: 3.2,
    },
    collision: boxCollision(11.5, 2.48),
    defaultMassKg: 11800,
    wheelbaseMetres: 6.0,
    wheelRadiusMetres: 0.5,
    lodTriangleBudget: {
      High: 34000,
      Medium: 13500,
      Low: 3400,
    },
    notes: "Neutral single-deck rigid city bus.",
  },

  "truck-rigid-generic": {
    id: "truck-rigid-generic",
    label: "Generic Rigid Truck",
    shortLabel: "Rigid Truck",
    family: "Truck",
    supportedTypes: ["Truck"],
    dimensions: {
      lengthMetres: 8.4,
      widthMetres: 2.5,
      heightMetres: 3.4,
    },
    collision: boxCollision(8.15, 2.44),
    defaultMassKg: 8200,
    wheelbaseMetres: 4.8,
    wheelRadiusMetres: 0.49,
    lodTriangleBudget: {
      High: 32000,
      Medium: 12500,
      Low: 3200,
    },
    notes: "Neutral rigid cargo truck.",
  },

  "truck-articulated-generic": {
    id: "truck-articulated-generic",
    label: "Generic Articulated Truck",
    shortLabel: "Articulated",
    family: "Truck",
    supportedTypes: ["Truck"],
    dimensions: {
      lengthMetres: 16.5,
      widthMetres: 2.5,
      heightMetres: 4.0,
    },
    collision: boxCollision(16.2, 2.46),
    defaultMassKg: 18000,
    wheelbaseMetres: 8.5,
    wheelRadiusMetres: 0.52,
    lodTriangleBudget: {
      High: 42000,
      Medium: 16500,
      Low: 4200,
    },
    notes: "Neutral tractor and semi-trailer combination.",
  },

  "truck-lorry-generic": {
    id: "truck-lorry-generic",
    label: "Generic Lorry",
    shortLabel: "Lorry",
    family: "Truck",
    supportedTypes: ["Truck"],
    dimensions: {
      lengthMetres: 7.2,
      widthMetres: 2.45,
      heightMetres: 3.1,
    },
    collision: boxCollision(7.0, 2.4),
    defaultMassKg: 6800,
    wheelbaseMetres: 4.1,
    wheelRadiusMetres: 0.47,
    lodTriangleBudget: {
      High: 30000,
      Medium: 11800,
      Low: 3000,
    },
    notes: "Neutral medium-duty lorry.",
  },

  "truck-tractor-generic": {
    id: "truck-tractor-generic",
    label: "Generic Tractor",
    shortLabel: "Tractor",
    family: "Truck",
    supportedTypes: ["Truck"],
    dimensions: {
      lengthMetres: 4.15,
      widthMetres: 2.2,
      heightMetres: 2.65,
    },
    collision: boxCollision(3.95, 2.1),
    defaultMassKg: 4200,
    wheelbaseMetres: 2.35,
    wheelRadiusMetres: 0.72,
    lodTriangleBudget: {
      High: 26000,
      Medium: 9800,
      Low: 2400,
    },
    notes: "Neutral agricultural tractor.",
  },

  "two-wheel-motorcycle-generic": {
    id: "two-wheel-motorcycle-generic",
    label: "Generic Motorcycle",
    shortLabel: "Motorcycle",
    family: "Two Wheeler",
    supportedTypes: ["Motorcycle"],
    dimensions: {
      lengthMetres: 2.2,
      widthMetres: 0.82,
      heightMetres: 1.25,
    },
    collision: boxCollision(2.06, 0.74),
    defaultMassKg: 210,
    wheelbaseMetres: 1.45,
    wheelRadiusMetres: 0.31,
    lodTriangleBudget: {
      High: 18000,
      Medium: 7200,
      Low: 1800,
    },
    notes: "Neutral road motorcycle without manufacturer branding.",
  },

  "two-wheel-bicycle-generic": {
    id: "two-wheel-bicycle-generic",
    label: "Generic Bicycle",
    shortLabel: "Bicycle",
    family: "Two Wheeler",
    supportedTypes: ["Bicycle"],
    dimensions: {
      lengthMetres: 1.85,
      widthMetres: 0.64,
      heightMetres: 1.15,
    },
    collision: boxCollision(1.72, 0.56),
    defaultMassKg: 14,
    wheelbaseMetres: 1.08,
    wheelRadiusMetres: 0.34,
    lodTriangleBudget: {
      High: 12000,
      Medium: 4600,
      Low: 1100,
    },
    notes: "Neutral road/hybrid bicycle.",
  },

  "human-adult-generic": {
    id: "human-adult-generic",
    label: "Generic Adult",
    shortLabel: "Adult",
    family: "Human",
    supportedTypes: ["Pedestrian", "Officer", "Witness"],
    dimensions: {
      lengthMetres: 0.58,
      widthMetres: 0.48,
      heightMetres: 1.7,
    },
    collision: circleCollision(0.3),
    defaultMassKg: 72,
    lodTriangleBudget: {
      High: 18000,
      Medium: 6500,
      Low: 1500,
    },
    notes: "Neutral adult body model for cases where sex is not recorded.",
  },

  "human-adult-male-generic": {
    id: "human-adult-male-generic",
    label: "Generic Adult Male",
    shortLabel: "Adult Male",
    family: "Human",
    supportedTypes: ["Pedestrian", "Officer", "Witness"],
    dimensions: {
      lengthMetres: 0.6,
      widthMetres: 0.5,
      heightMetres: 1.76,
    },
    collision: circleCollision(0.31),
    defaultMassKg: 78,
    lodTriangleBudget: {
      High: 19000,
      Medium: 6800,
      Low: 1600,
    },
    notes: "Generic adult male body model.",
  },

  "human-adult-female-generic": {
    id: "human-adult-female-generic",
    label: "Generic Adult Female",
    shortLabel: "Adult Female",
    family: "Human",
    supportedTypes: ["Pedestrian", "Officer", "Witness"],
    dimensions: {
      lengthMetres: 0.56,
      widthMetres: 0.46,
      heightMetres: 1.64,
    },
    collision: circleCollision(0.29),
    defaultMassKg: 64,
    lodTriangleBudget: {
      High: 19000,
      Medium: 6800,
      Low: 1600,
    },
    notes: "Generic adult female body model.",
  },

  "human-child-generic": {
    id: "human-child-generic",
    label: "Generic Child",
    shortLabel: "Child",
    family: "Human",
    supportedTypes: ["Pedestrian", "Witness"],
    dimensions: {
      lengthMetres: 0.44,
      widthMetres: 0.38,
      heightMetres: 1.25,
    },
    collision: circleCollision(0.24),
    defaultMassKg: 32,
    lodTriangleBudget: {
      High: 15000,
      Medium: 5200,
      Low: 1200,
    },
    notes: "Generic child body model.",
  },
};

export const DEFAULT_PARTICIPANT_ASSET_BY_TYPE: Record<
  ReconstructionVehicleType,
  ReconstructionParticipantAssetId
> = {
  Car: "car-sedan-generic",
  Bus: "bus-city-generic",
  Truck: "truck-rigid-generic",
  Motorcycle: "two-wheel-motorcycle-generic",
  Bicycle: "two-wheel-bicycle-generic",
  Pedestrian: "human-adult-generic",
  Officer: "human-adult-generic",
  Witness: "human-adult-generic",
};

export const PARTICIPANT_COLOUR_HEX: Record<
  ReconstructionVehicleColour,
  string
> = {
  Blue: "#2563eb",
  Red: "#dc2626",
  Green: "#16a34a",
  Yellow: "#eab308",
  Black: "#292929",
  White: "#f9fafb",
  Orange: "#ea580c",
  Purple: "#9333ea",
};

export function getParticipantColourHex(
  colour: ReconstructionVehicleColour,
): string {
  return PARTICIPANT_COLOUR_HEX[colour];
}

export function getParticipantColourNumber(
  colour: ReconstructionVehicleColour,
): number {
  return Number.parseInt(
    PARTICIPANT_COLOUR_HEX[colour].slice(1),
    16,
  );
}

export function getDefaultParticipantAssetId(
  type: ReconstructionVehicleType,
): ReconstructionParticipantAssetId {
  return DEFAULT_PARTICIPANT_ASSET_BY_TYPE[type];
}

export function getParticipantAssetsForType(
  type: ReconstructionVehicleType,
): ParticipantAssetDefinition[] {
  return Object.values(PARTICIPANT_ASSET_CATALOG).filter(
    (asset) => asset.supportedTypes.includes(type),
  );
}

export function getParticipantAssetDefinition(
  participant: Pick<ReconstructionVehicle, "type" | "assetId">,
): ParticipantAssetDefinition {
  if (
    participant.assetId &&
    PARTICIPANT_ASSET_CATALOG[participant.assetId] &&
    PARTICIPANT_ASSET_CATALOG[
      participant.assetId
    ].supportedTypes.includes(participant.type)
  ) {
    return PARTICIPANT_ASSET_CATALOG[participant.assetId];
  }

  return PARTICIPANT_ASSET_CATALOG[
    getDefaultParticipantAssetId(participant.type)
  ];
}

export function getParticipantPhysicalDimensions(
  participant: Pick<
    ReconstructionVehicle,
    "type" | "assetId" | "physics"
  >,
): ParticipantAssetDimensions {
  const asset = getParticipantAssetDefinition(participant);

  return {
    lengthMetres: Math.max(
      0.2,
      participant.physics?.lengthMetres ??
        asset.dimensions.lengthMetres,
    ),
    widthMetres: Math.max(
      0.2,
      participant.physics?.widthMetres ??
        asset.dimensions.widthMetres,
    ),
    heightMetres: asset.dimensions.heightMetres,
  };
}

export function getParticipant2DDisplaySize(
  participant: Pick<
    ReconstructionVehicle,
    "type" | "assetId" | "physics"
  >,
): {
  widthPixels: number;
  heightPixels: number;
} {
  const asset = getParticipantAssetDefinition(participant);
  const dimensions = getParticipantPhysicalDimensions(participant);

  if (asset.family === "Human") {
    return {
      widthPixels: 20,
      heightPixels: 20,
    };
  }

  if (asset.family === "Two Wheeler") {
    return {
      widthPixels: Math.round(
        Math.min(
          58,
          Math.max(
            38,
            dimensions.lengthMetres * 22,
          ),
        ),
      ),
      heightPixels: Math.round(
        Math.min(
          26,
          Math.max(
            18,
            dimensions.widthMetres * 26,
          ),
        ),
      ),
    };
  }

  return {
    widthPixels: Math.round(
      Math.min(
        92,
        Math.max(
          42,
          dimensions.lengthMetres * 10,
        ),
      ),
    ),
    heightPixels: Math.round(
      Math.min(
        38,
        Math.max(
          21,
          dimensions.widthMetres * 11.5,
        ),
      ),
    ),
  };
}
