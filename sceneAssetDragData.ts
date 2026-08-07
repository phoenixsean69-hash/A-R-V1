import type {
  ReconstructionParticipantAssetId,
  ReconstructionVehicleType,
  SceneObjectType,
} from "../../types/reconstruction";

export const ROADSAFE_PARTICIPANT_ASSET_MIME =
  "application/x-roadsafe-participant-asset";

export const ROADSAFE_SCENE_OBJECT_MIME =
  "application/x-roadsafe-scene-object";

export interface RoadSafeParticipantAssetDragPayload {
  kind: "participant";
  assetId: ReconstructionParticipantAssetId;
  type: ReconstructionVehicleType;
}

export interface RoadSafeSceneObjectDragPayload {
  kind: "scene-object";
  type: SceneObjectType;
}

export type RoadSafeSceneAssetDragPayload =
  | RoadSafeParticipantAssetDragPayload
  | RoadSafeSceneObjectDragPayload;

export function writeParticipantAssetDrag(
  dataTransfer: DataTransfer,
  payload: Omit<RoadSafeParticipantAssetDragPayload, "kind">,
): void {
  const value = JSON.stringify({
    kind: "participant",
    ...payload,
  } satisfies RoadSafeParticipantAssetDragPayload);

  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(ROADSAFE_PARTICIPANT_ASSET_MIME, value);
  dataTransfer.setData("text/plain", value);
}

export function writeSceneObjectDrag(
  dataTransfer: DataTransfer,
  type: SceneObjectType,
): void {
  const value = JSON.stringify({
    kind: "scene-object",
    type,
  } satisfies RoadSafeSceneObjectDragPayload);

  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(ROADSAFE_SCENE_OBJECT_MIME, value);
  dataTransfer.setData("text/plain", value);
}

export function hasRoadSafeSceneAssetDrag(
  dataTransfer: DataTransfer,
): boolean {
  return (
    Array.from(dataTransfer.types).includes(
      ROADSAFE_PARTICIPANT_ASSET_MIME,
    ) ||
    Array.from(dataTransfer.types).includes(
      ROADSAFE_SCENE_OBJECT_MIME,
    )
  );
}

export function readRoadSafeSceneAssetDrag(
  dataTransfer: DataTransfer,
): RoadSafeSceneAssetDragPayload | null {
  const participantValue = dataTransfer.getData(
    ROADSAFE_PARTICIPANT_ASSET_MIME,
  );

  if (participantValue) {
    try {
      const parsed = JSON.parse(
        participantValue,
      ) as RoadSafeParticipantAssetDragPayload;

      if (
        parsed.kind === "participant" &&
        parsed.assetId &&
        parsed.type
      ) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  const objectValue = dataTransfer.getData(
    ROADSAFE_SCENE_OBJECT_MIME,
  );

  if (objectValue) {
    try {
      const parsed = JSON.parse(
        objectValue,
      ) as RoadSafeSceneObjectDragPayload;

      if (
        parsed.kind === "scene-object" &&
        parsed.type
      ) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}
