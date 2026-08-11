import type {
  ReconstructionSceneObject,
  SceneObjectType,
} from "../types/reconstruction";

export function getDefaultSceneObjectMassKg(
  type: SceneObjectType,
): number {
  switch (type) {
    case "Traffic Cone": return 3;
    case "Vehicle Part": return 18;
    case "Debris":
    case "Broken Glass": return 12;
    case "Fallen Branch": return 45;
    case "Bush": return 35;
    case "Parked Vehicle": return 1500;
    case "Road Barrier": return 280;
    case "Fence": return 350;
    case "Stop Sign":
    case "Give Way Sign":
    case "Speed Limit Sign": return 90;
    case "Traffic Light": return 650;
    case "Street Light": return 900;
    case "Bus Stop": return 1200;
    case "Guardrail": return 1800;
    case "Tree": return 2500;
    case "Wall": return 5000;
    default: return 1_000_000;
  }
}

export function getSceneObjectEffectiveMassKg(
  object: ReconstructionSceneObject,
): number {
  const configured = object.physics?.massKg;

  return (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured > 0
  )
    ? configured
    : getDefaultSceneObjectMassKg(object.type);
}
