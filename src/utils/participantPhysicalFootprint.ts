import type {
  ParticipantPhysicsProfile,
  PhysicsCollisionShape,
  ReconstructionVehicleType,
} from "../types/reconstruction";

export interface ParticipantPhysicalFootprint {
  lengthMetres: number;
  widthMetres: number;
  heightMetres: number;
  collisionRadiusMetres: number;
  collisionShape: PhysicsCollisionShape;
}

const PHYSICAL_FOOTPRINTS: Record<
  ReconstructionVehicleType,
  ParticipantPhysicalFootprint
> = {
  Car: {
    lengthMetres: 4.4,
    widthMetres: 1.85,
    heightMetres: 1.55,
    collisionRadiusMetres: 0.925,
    collisionShape: "Oriented Box",
  },
  Bus: {
    lengthMetres: 8.5,
    widthMetres: 2.6,
    heightMetres: 3.2,
    collisionRadiusMetres: 1.3,
    collisionShape: "Oriented Box",
  },
  Truck: {
    lengthMetres: 7.5,
    widthMetres: 2.8,
    heightMetres: 3.4,
    collisionRadiusMetres: 1.4,
    collisionShape: "Oriented Box",
  },
  Motorcycle: {
    lengthMetres: 2.2,
    widthMetres: 0.75,
    heightMetres: 1.25,
    collisionRadiusMetres: 0.375,
    collisionShape: "Oriented Box",
  },
  Bicycle: {
    lengthMetres: 1.8,
    widthMetres: 0.55,
    heightMetres: 1.2,
    collisionRadiusMetres: 0.275,
    collisionShape: "Oriented Box",
  },
  Pedestrian: {
    lengthMetres: 0.65,
    widthMetres: 0.65,
    heightMetres: 1.75,
    collisionRadiusMetres: 0.325,
    collisionShape: "Circle",
  },
  Officer: {
    lengthMetres: 0.65,
    widthMetres: 0.65,
    heightMetres: 1.75,
    collisionRadiusMetres: 0.325,
    collisionShape: "Circle",
  },
  Witness: {
    lengthMetres: 0.65,
    widthMetres: 0.65,
    heightMetres: 1.75,
    collisionRadiusMetres: 0.325,
    collisionShape: "Circle",
  },
};

const LEGACY_FOOTPRINTS: Record<
  ReconstructionVehicleType,
  Pick<
    ParticipantPhysicalFootprint,
    "lengthMetres" | "widthMetres" | "collisionRadiusMetres"
  >
> = {
  Car: {
    lengthMetres: 4.5,
    widthMetres: 1.82,
    collisionRadiusMetres: 0.92,
  },
  Bus: {
    lengthMetres: 11.8,
    widthMetres: 2.55,
    collisionRadiusMetres: 1.25,
  },
  Truck: {
    lengthMetres: 8.4,
    widthMetres: 2.5,
    collisionRadiusMetres: 1.25,
  },
  Motorcycle: {
    lengthMetres: 2.2,
    widthMetres: 0.82,
    collisionRadiusMetres: 0.42,
  },
  Bicycle: {
    lengthMetres: 1.85,
    widthMetres: 0.64,
    collisionRadiusMetres: 0.34,
  },
  Pedestrian: {
    lengthMetres: 0.76,
    widthMetres: 0.76,
    collisionRadiusMetres: 0.38,
  },
  Officer: {
    lengthMetres: 0.76,
    widthMetres: 0.76,
    collisionRadiusMetres: 0.38,
  },
  Witness: {
    lengthMetres: 0.76,
    widthMetres: 0.76,
    collisionRadiusMetres: 0.38,
  },
};

function approximatelyEqual(left: number | undefined, right: number): boolean {
  return left !== undefined && Math.abs(left - right) <= 0.001;
}

export function getParticipantPhysicalFootprint(
  type: ReconstructionVehicleType,
): ParticipantPhysicalFootprint {
  return PHYSICAL_FOOTPRINTS[type];
}

export function normaliseLegacyParticipantPhysicsFootprint(
  type: ReconstructionVehicleType,
  configured: ParticipantPhysicsProfile | undefined,
  merged: ParticipantPhysicsProfile,
): Pick<
  ParticipantPhysicsProfile,
  | "collisionShape"
  | "collisionRadiusMetres"
  | "lengthMetres"
  | "widthMetres"
> {
  const physical = PHYSICAL_FOOTPRINTS[type];
  const legacy = LEGACY_FOOTPRINTS[type];

  const usePhysicalLength =
    configured?.lengthMetres === undefined ||
    approximatelyEqual(configured.lengthMetres, legacy.lengthMetres);

  const usePhysicalWidth =
    configured?.widthMetres === undefined ||
    approximatelyEqual(configured.widthMetres, legacy.widthMetres);

  const usePhysicalRadius =
    configured?.collisionRadiusMetres === undefined ||
    approximatelyEqual(
      configured.collisionRadiusMetres,
      legacy.collisionRadiusMetres,
    );

  return {
    collisionShape: configured?.collisionShape ?? physical.collisionShape,
    collisionRadiusMetres: usePhysicalRadius
      ? physical.collisionRadiusMetres
      : merged.collisionRadiusMetres,
    lengthMetres: usePhysicalLength
      ? physical.lengthMetres
      : merged.lengthMetres,
    widthMetres: usePhysicalWidth
      ? physical.widthMetres
      : merged.widthMetres,
  };
}
