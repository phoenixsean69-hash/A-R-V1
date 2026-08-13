import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { createRoadSafeViewportPolish } from "./roadSafeViewportPolish";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  disposeObjectTree,
  loadRealisticSceneObjectModel,
} from "../../services/realisticSceneAssetService";
import {
  usesGeneratedRoad,
  type AccidentReconstruction,
  type ParticipantImpactResponse,
  type ParticipantVisualDamageState,
  type ReconstructionPosition,
  type ReconstructionSceneObject,
  type ReconstructionVehicle,
} from "../../types/reconstruction";
import {  getParticipantPlaybackPathPoints,

  getParticipantStateAtTime,
  isPhysicsGeneratedPathPoint,} from "../../utils/reconstructionGeometry";
import { addRealSceneGeometryToThreeScene } from "../../utils/realSceneThreeGeometry";
import { getParticipantPotholeEffect } from "../../utils/reconstructionSurfaceEffects";
import {
  createGenericParticipant3DModel,
} from "../../engine/assets/participant3DModelFactory";
import {
  animateHumanParticipantModel,
  createAnimatedHumanParticipantModel,
} from "../../engine/assets/participantHumanMotionModel";
import {
  getParticipantColourNumber,
  getParticipantPhysicalDimensions,
} from "../../engine/assets/participantAssetCatalog";
import { AUTO_ROAD_CURVE_NOTE_MARKER } from "../../utils/reconstructionRoadRouting";
import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";
import {
  getParticipantAccidentReactionState,
  isHumanReconstructionParticipant,
} from "../../utils/reconstructionReactionModel";
import {
  getGroundedHumanKnockdownPose,
} from "../../utils/reconstructionHumanKnockdown";
import {
  getParticipantImpactVisualPose,
  indexEarliestParticipantImpactResponses,
} from "../../utils/reconstructionImpactVisualization";
import {
  reconstructionHeadingToThreeYawRadians,
  reconstructionPositionToThreeVector,
} from "../../utils/reconstructionThreeCoordinates";

import type {
  ReconstructionParticipantAssetId,
  ReconstructionVehicleType,
  SceneObjectType,
} from "../../types/reconstruction";

import {
  loadPremiumParticipantModel,
} from "../../services/premiumParticipantAssetService";

import {
  hasRoadSafeSceneAssetDrag,
  readRoadSafeSceneAssetDrag,
} from "../../engine/assets/sceneAssetDragData";

interface Reconstruction3DViewerProps {
  reconstruction: AccidentReconstruction;
  onSwitchTo2D: () => void;
  onRunPhysics: () => void | Promise<void>;
  onPreparePlayback: () => AccidentReconstruction;
  compact?: boolean;
  workspaceMode?: boolean;
  selectedParticipantId?: string | null;
  onSelectParticipant?: (participantId: string) => void;
  selectedSceneObjectId?: string | null;
  onSelectSceneObject?: (objectId: string) => void;

  onTransformParticipant?: (
    participantId: string,
    next: {
      position: ReconstructionPosition;
      rotationDegrees: number;
      visualScale: number;
    },
  ) => void;

  onTransformSceneObject?: (
    objectId: string,
    next: {
      position: ReconstructionPosition;
      rotationDegrees: number;
      scaleMultiplier: number;
    },
  ) => void;
  cameraCycleToken?: number;
  workspaceTimeSeconds?: number;
  workspaceTimeSourceRef?: { readonly current: number };
  workspacePlaying?: boolean;
  workspacePlaybackSpeed?: number;
  workspaceCameraMode?: CameraMode;
  workspaceLayers?: {
    paths: boolean;
    objects: boolean;
    evidence: boolean;
    physics: boolean;
  };
  workspaceTool?: WorkspaceToolMode;

  onDropParticipantAsset?: (
    assetId: ReconstructionParticipantAssetId,
    type: ReconstructionVehicleType,
    position: ReconstructionPosition,
  ) => void;

  onDropSceneObject?: (
    type: SceneObjectType,
    position: ReconstructionPosition,
  ) => void;
}

type WorkspaceToolMode =
  | "Select"
  | "Move"
  | "Rotate"
  | "Scale"
  | "Timeline"
  | "Measure"
  | "Camera";

type CameraMode = "Orbit" | "Overhead" | "Roadside" | "Driver";

interface ParticipantVisualPoseFilter {
  initialized: boolean;
  lastTimelineTimeSeconds: number;

  /** Render-only holder yaw; canonical reconstruction rotation is untouched. */
  yawRadians: number;

  /** Render-only impact/body-response pose; canonical physics is untouched. */
  impactVerticalMetres: number;
  impactRotationX: number;
  impactRotationY: number;
  impactRotationZ: number;
}

interface ParticipantRenderEntry {
  participant: ReconstructionVehicle;
  holder: THREE.Group;
  modelRoot: THREE.Group;
  damageRoot: THREE.Group;
  brakeLightRoot: THREE.Group;
  label: THREE.Sprite;
  visualPoseFilter: ParticipantVisualPoseFilter;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function participantDimensions(
  participant: ReconstructionVehicle,
): [number, number, number] {
  const dimensions =
    getParticipantPhysicalDimensions(
      participant,
    );

  return [
    dimensions.lengthMetres,
    dimensions.heightMetres,
    dimensions.widthMetres,
  ];
}

function worldPosition(
  position: ReconstructionPosition,
  width: number,
  height: number,
  y = 0,
): THREE.Vector3 {
  return reconstructionPositionToThreeVector(
    position,
    width,
    height,
    y,
  );
}

function getParticipantRapierContactTime(
  reconstruction:
    AccidentReconstruction,
  participantId: string,
): number | undefined {
  const diagnostics =
    reconstruction
      .lastPhysicsSimulation
      ?.rapierDynamics;

  const participantTime =
    diagnostics
      ?.participantFirstContactTimesSeconds
      ?.[participantId];

  if (
    participantTime !==
      undefined &&
    Number.isFinite(
      participantTime,
    )
  ) {
    return participantTime;
  }

  const globalTime =
    diagnostics
      ?.firstContactTimeSeconds;

  return (
    globalTime !==
      undefined &&
    Number.isFinite(
      globalTime,
    )
  )
    ? globalTime
    : undefined;
}

function alignImpactResponseToRapierContact(
  response:
    ParticipantImpactResponse | undefined,
  contactTimeSeconds:
    number | undefined,
): ParticipantImpactResponse | undefined {
  if (
    !response ||
    contactTimeSeconds ===
      undefined
  ) {
    return response;
  }

  return {
    ...response,
    timeSeconds:
      contactTimeSeconds,
  };
}

function alignVisualDamageToRapierContact(
  damage:
    ParticipantVisualDamageState | undefined,
  contactTimeSeconds:
    number | undefined,
): ParticipantVisualDamageState | undefined {
  if (
    !damage ||
    contactTimeSeconds ===
      undefined
  ) {
    return damage;
  }

  return {
    ...damage,
    timeSeconds:
      contactTimeSeconds,
  };
}

/*
 * [RoadSafe:ThreePlaybackPoseStabilizerV1]
 *
 * This is VIEWPORT-ONLY smoothing.
 * It never writes to:
 * - participant path points,
 * - Rapier samples,
 * - collision state,
 * - physics summaries,
 * - forensic calculations,
 * - 2D playback.
 */

function shortestAngleRadians(
  from: number,
  to: number,
): number {
  return Math.atan2(
    Math.sin(to - from),
    Math.cos(to - from),
  );
}

function circularMeanDegrees(
  values: number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  let sine = 0;
  let cosine = 0;

  values.forEach((degrees) => {
    const radians =
      THREE.MathUtils.degToRad(
        degrees,
      );

    sine +=
      Math.sin(radians);

    cosine +=
      Math.cos(radians);
  });

  if (
    Math.abs(sine) <
      0.000001 &&
    Math.abs(cosine) <
      0.000001
  ) {
    return values[
      Math.floor(
        values.length /
          2,
      )
    ];
  }

  return (
    THREE.MathUtils.radToDeg(
      Math.atan2(
        sine,
        cosine,
      ),
    ) +
    360
  ) % 360;
}

function getRenderStableHeadingDegrees(
  participant:
    ReconstructionVehicle,
  currentTimeSeconds: number,
  durationSeconds: number,
  widthMetres: number,
  heightMetres: number,
): number {
  const centre =
    getParticipantStateAtTime(
      participant,
      currentTimeSeconds,
      {
        widthMetres,
        heightMetres,
      },
    );

  /*
   * At very low speed, position/heading samples can be dominated by tiny
   * solver/resting corrections. Preserve the canonical centre heading there.
   */
  if (
    centre.speedKmh <
    1.2
  ) {
    return centre.rotation;
  }

  const windowSeconds =
    isPhysicsGeneratedPathPoint(
      participant.pathPoints.find(
        (point) =>
          point.id ===
          centre.activePointId,
      ) ?? {
        id: "",
        label: "",
        position: {
          x: 0,
          y: 0,
        },
        timeSeconds: 0,
        speedKmh: 0,
        rotation: 0,
        action: "Cruise",
      },
    )
      ? 0.028
      : 0.045;

  const beforeTime =
    Math.max(
      0,
      currentTimeSeconds -
        windowSeconds,
    );

  const afterTime =
    Math.min(
      durationSeconds,
      currentTimeSeconds +
        windowSeconds,
    );

  if (
    Math.abs(
      afterTime -
      beforeTime,
    ) <
    0.0001
  ) {
    return centre.rotation;
  }

  const before =
    getParticipantStateAtTime(
      participant,
      beforeTime,
      {
        widthMetres,
        heightMetres,
      },
    );

  const after =
    getParticipantStateAtTime(
      participant,
      afterTime,
      {
        widthMetres,
        heightMetres,
      },
    );

  /*
   * Circular mean avoids the classic 359° -> 0° -> 1° wobble.
   * The centre sample is weighted twice so true sharp impact rotations remain
   * responsive rather than being over-smoothed.
   */
  return circularMeanDegrees([
    before.rotation,
    centre.rotation,
    centre.rotation,
    after.rotation,
  ]);
}

function stabilizeParticipantHolderYaw(
  entry:
    ParticipantRenderEntry,
  targetYawRadians: number,
  timelineTimeSeconds: number,
  playbackActive: boolean,
): number {
  const filter =
    entry.visualPoseFilter;

  const timelineDelta =
    timelineTimeSeconds -
    filter.lastTimelineTimeSeconds;

  const timelineJump =
    !Number.isFinite(
      timelineDelta,
    ) ||
    timelineDelta <
      -0.0001 ||
    Math.abs(timelineDelta) >
      0.18;

  if (
    !filter.initialized ||
    !playbackActive ||
    timelineJump
  ) {
    filter.initialized =
      true;

    filter.lastTimelineTimeSeconds =
      timelineTimeSeconds;

    filter.yawRadians =
      targetYawRadians;

    return targetYawRadians;
  }

  const positiveDelta =
    Math.max(
      1 / 240,
      timelineDelta,
    );

  /*
   * About 55 ms of yaw damping. It removes high-frequency shake while keeping
   * genuine impact deflection and spin visually responsive.
   */
  const alpha =
    1 -
    Math.exp(
      -positiveDelta *
        18,
    );

  const error =
    shortestAngleRadians(
      filter.yawRadians,
      targetYawRadians,
    );

  /*
   * Ignore microscopic solver/route heading movement below 0.18 degrees.
   */
  const deadband =
    THREE.MathUtils.degToRad(
      0.18,
    );

  if (
    Math.abs(error) >
    deadband
  ) {
    filter.yawRadians +=
      error *
      alpha;
  }

  filter.lastTimelineTimeSeconds =
    timelineTimeSeconds;

  return filter.yawRadians;
}

function dampScalar(
  current: number,
  target: number,
  timelineDeltaSeconds: number,
  response: number,
): number {
  const delta =
    Math.max(
      1 / 240,
      Math.min(
        0.08,
        Math.abs(
          timelineDeltaSeconds,
        ),
      ),
    );

  const alpha =
    1 -
    Math.exp(
      -delta *
        response,
    );

  return THREE.MathUtils.lerp(
    current,
    target,
    alpha,
  );
}

function dampAngle(
  current: number,
  target: number,
  timelineDeltaSeconds: number,
  response: number,
): number {
  const delta =
    Math.max(
      1 / 240,
      Math.min(
        0.08,
        Math.abs(
          timelineDeltaSeconds,
        ),
      ),
    );

  const alpha =
    1 -
    Math.exp(
      -delta *
        response,
    );

  return (
    current +
    shortestAngleRadians(
      current,
      target,
    ) *
      alpha
  );
}

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(32,32,32,.88)";
    context.roundRect(8, 8, 496, 104, 22);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 38px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 60);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(6.4, 1.6, 1);
  sprite.userData.isLabel = true;
  return sprite;
}

function roundedBox(
  size: [number, number, number],
  colour: number,
  radius = 0.08,
): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(
    size[0],
    size[1],
    size[2],
    3,
    Math.min(radius, Math.min(...size) * 0.42),
  );
  const material = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.38,
    metalness: 0.18,
    clearcoat: 0.35,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createFallbackParticipantModel(
  participant: ReconstructionVehicle,
): THREE.Group {
  if (
    isHumanReconstructionParticipant(
      participant,
    )
  ) {
    return createAnimatedHumanParticipantModel(
      participant,
    );
  }

  return createGenericParticipant3DModel(
    participant,
    "Medium",
  );
}

function createParticipantBrakeLightRoot(
  participant:
    ReconstructionVehicle,
): THREE.Group {
  const root =
    new THREE.Group();

  root.userData
    .isParticipantBrakeLight =
      true;

  root.visible =
    false;

  if (
    isHumanReconstructionParticipant(
      participant,
    ) ||
    participant.type ===
      "Bicycle"
  ) {
    return root;
  }

  const [
    length,
    height,
    width,
  ] =
    participantDimensions(
      participant,
    );

  const material =
    new THREE.MeshBasicMaterial({
      color: 0xff3028,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

  for (
    const side of [-1, 1]
  ) {
    const lamp =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(
            0.04,
            length * 0.012,
          ),
          Math.max(
            0.055,
            height * 0.075,
          ),
          Math.max(
            0.08,
            width * 0.15,
          ),
        ),
        material.clone(),
      );

    lamp.position.set(
      -length / 2 -
        0.018,
      Math.max(
        0.18,
        height * 0.38,
      ),
      side *
        width *
        0.28,
    );

    root.add(
      lamp,
    );
  }

  return root;
}

function createParticipantHolder(
  participant: ReconstructionVehicle,
): ParticipantRenderEntry {
  const holder = new THREE.Group();
  holder.userData.participantId = participant.id;
  const modelRoot = new THREE.Group();
  modelRoot.userData.isParticipantModel = true;
  modelRoot.add(createFallbackParticipantModel(participant));
  holder.add(modelRoot);

  const damageRoot = new THREE.Group();
  damageRoot.userData.isParticipantDamageVisual = true;
  damageRoot.visible = false;
  holder.add(damageRoot);

  const brakeLightRoot =
    createParticipantBrakeLightRoot(
      participant,
    );

  holder.add(
    brakeLightRoot,
  );

  const label = makeTextSprite(participant.name);
  label.position.y = participantDimensions(participant)[1] + 1.15;
  holder.add(label);
  holder.traverse((object) => {
    object.userData.participantId = participant.id;
  });
  return {
    participant,
    holder,
    modelRoot,
    damageRoot,
    brakeLightRoot,
    label,
    visualPoseFilter: {
      initialized: false,
      lastTimelineTimeSeconds:
        Number.NaN,
      yawRadians: 0,
      impactVerticalMetres: 0,
      impactRotationX: 0,
      impactRotationY: 0,
      impactRotationZ: 0,
    },
  };
}

function createFallbackSceneObject(
  object: ReconstructionSceneObject,
): THREE.Object3D {
  const scale = Math.max(0.25, object.scale);
  if (object.type === "Pothole") {
    const radius = Math.max(0.35, (object.widthMetres ?? scale * 1.8) / 2);
    const group = new THREE.Group();
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 36),
      new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 1 }),
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.015;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.82, radius * 0.14, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x3f4244, roughness: 1 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.035;
    group.add(hole, rim);
    return group;
  }

  if (["Puddle", "Oil Spill", "Loose Gravel"].includes(object.type)) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(0.55, scale), 30),
      new THREE.MeshPhysicalMaterial({
        color: object.type === "Oil Spill" ? 0x202020 : 0x506d7a,
        roughness: object.type === "Oil Spill" ? 0.1 : 0.7,
        transparent: true,
        opacity: 0.72,
      }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.025;
    return patch;
  }

  const dimensions: [number, number, number] =
    object.type === "Road Barrier" || object.type === "Guardrail"
      ? [Math.max(2, object.lengthMetres ?? 4) * scale, 1, 0.25]
      : object.type === "Wall" || object.type === "Fence"
        ? [Math.max(2, object.lengthMetres ?? 4) * scale, 1.8, 0.25]
        : object.type === "Tree"
          ? [1.1 * scale, 5 * scale, 1.1 * scale]
          : [1.2 * scale, 1.2 * scale, 1.2 * scale];
  const mesh = roundedBox(dimensions, 0x6b7280, 0.05);
  mesh.position.y = dimensions[1] / 2;
  return mesh;
}

function addGeneratedRoad(
  scene: THREE.Scene,
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.35, height * 1.35),
    new THREE.MeshStandardMaterial({ color: 0x526052, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  if (!usesGeneratedRoad(reconstruction.scene)) return;

  const roadWidth = Math.min(18, 6.2 + reconstruction.scene.laneCount * 3.15);
  const material = new THREE.MeshStandardMaterial({
    color: reconstruction.scene.roadSurface === "Wet" ? 0x29343b : 0x34383d,
    roughness: reconstruction.scene.roadSurface === "Wet" ? 0.45 : 0.9,
  });
  const addStrip = (horizontal: boolean) => {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(
        horizontal ? width : roadWidth,
        horizontal ? roadWidth : height,
      ),
      material,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.03;
    road.receiveShadow = true;
    scene.add(road);
  };

  addStrip(true);
  if (
    !["Straight Road", "Pedestrian Crossing"].includes(
      reconstruction.scene.roadLayout,
    )
  ) {
    addStrip(false);
  }
}

/*
 * [RoadSafe:BodyContactDamageVisualV1]
 *
 * This is deliberately a visual cue only. The canonical forensic quantities
 * remain in RoadSafe Physics V2 and the damage state itself is marked
 * visualOnly in the reconstruction summary.
 */
function populateParticipantDamageVisual(
  entry:
    ParticipantRenderEntry,
  damage:
    ParticipantVisualDamageState | undefined,
): void {
  const root =
    entry.damageRoot;

  while (
    root.children.length >
    0
  ) {
    const child =
      root.children[
        root.children.length -
        1
      ];

    root.remove(
      child,
    );

    if (
      child instanceof
      THREE.Mesh
    ) {
      child.geometry.dispose();

      const materials =
        Array.isArray(
          child.material,
        )
          ? child.material
          : [child.material];

      materials.forEach(
        (material) =>
          material.dispose(),
      );
    }
  }

  root.visible =
    false;

  if (!damage) {
    return;
  }

  const [
    length,
    height,
    width,
  ] =
    participantDimensions(
      entry.participant,
    );

  const severityScale =
    damage.severity ===
      "Critical"
      ? 1
      : damage.severity ===
          "Severe"
        ? 0.82
        : damage.severity ===
            "Moderate"
          ? 0.62
          : 0.42;

  const crush =
    Math.max(
      0.04,
      Math.min(
        damage
          .crushDepthMetres,
        length *
          0.18,
      ),
    );

  const damageMaterial =
    new THREE
      .MeshStandardMaterial({
        color:
          0x282323,
        roughness:
          0.92,
        metalness:
          0.24,
      });

  const addPatch = (
    size:
      [
        number,
        number,
        number,
      ],
    position:
      [
        number,
        number,
        number,
      ],
  ) => {
    const geometry =
      new RoundedBoxGeometry(
        size[0],
        size[1],
        size[2],
        2,
        Math.min(
          0.07,
          Math.min(
            ...size,
          ) *
            0.32,
        ),
      );

    const patch =
      new THREE.Mesh(
        geometry,
        damageMaterial.clone(),
      );

    patch.position.set(
      position[0],
      position[1],
      position[2],
    );

    patch.castShadow =
      true;

    root.add(
      patch,
    );
  };

  const verticalCentre =
    Math.max(
      0.28,
      height *
        0.42,
    );

  if (
    damage.contactZone ===
      "Front" ||
    damage.contactZone ===
      "Rear"
  ) {
    const sign =
      damage.contactZone ===
        "Front"
        ? 1
        : -1;

    addPatch(
      [
        Math.max(
          0.045,
          Math.min(
            0.12,
            crush *
              0.24,
          ),
        ),
        Math.max(
          0.16,
          height *
            0.34 *
            severityScale,
        ),
        Math.max(
          0.3,
          width *
            (
              0.5 +
              severityScale *
                0.28
            ),
        ),
      ],
      [
        sign *
          (
            length /
              2 +
            0.012
          ),
        verticalCentre,
        0,
      ],
    );
  } else if (
    damage.contactZone ===
      "Left Side" ||
    damage.contactZone ===
      "Right Side"
  ) {
    const sign =
      damage.contactZone ===
        "Left Side"
        ? 1
        : -1;

    addPatch(
      [
        Math.max(
          0.45,
          length *
            (
              0.2 +
              severityScale *
                0.17
            ),
        ),
        Math.max(
          0.16,
          height *
            0.34 *
            severityScale,
        ),
        Math.max(
          0.04,
          Math.min(
            0.1,
            crush *
              0.22,
          ),
        ),
      ],
      [
        0,
        verticalCentre,
        sign *
          (
            width /
              2 +
            0.01
          ),
      ],
    );
  } else {
    addPatch(
      [
        Math.max(
          0.35,
          length *
            0.22 *
            severityScale,
        ),
        Math.max(
          0.16,
          height *
            0.3 *
            severityScale,
        ),
        Math.max(
          0.3,
          width *
            0.42 *
            severityScale,
        ),
      ],
      [
        length *
          0.32,
        verticalCentre,
        0,
      ],
    );
  }

  /*
   * Keep V1.2.3 damage attached to the body. Detached fragments looked like
   * floating bumpers and made the contact frame read as a rendering glitch.
   * True physical debris will be introduced later as Rapier rigid bodies.
   */
}

function applyParticipantDamagePose(
  entry:
    ParticipantRenderEntry,
  damage:
    ParticipantVisualDamageState | undefined,
  currentTime: number,
  enabled: boolean,
): void {
  const damageRoot =
    entry.damageRoot;

  damageRoot.visible =
    false;

  if (
    !enabled ||
    !damage ||
    currentTime <
      damage.timeSeconds
  ) {
    return;
  }

  damageRoot.visible =
    true;

  /*
   * Do NOT scale/translate the entire participant model to fake crush.
   * That moved wheels/body panels and made two otherwise-valid Rapier bodies
   * look like they were clipping. V1.2.3 keeps the canonical rendered body
   * aligned to the rigid-body pose and only animates the localized damage skin.
   */
  damageRoot.position.copy(
    entry.modelRoot.position,
  );

  damageRoot.rotation.copy(
    entry.modelRoot.rotation,
  );

  const revealProgress =
    clamp(
      (
        currentTime -
        damage.timeSeconds
      ) /
        0.12,
      0,
      1,
    );

  /*
   * Ease the localized damage in over 120 ms so it appears as an impact
   * deformation rather than popping into existence on one frame.
   */
  const eased =
    1 -
    Math.pow(
      1 -
        revealProgress,
      3,
    );

  damageRoot.scale.set(
    eased,
    eased,
    eased,
  );
}

/*
 * [RoadSafe:ImpulseDrivenImpactVisualizationV1]
 */
function applyImpactPose(
  entry: ParticipantRenderEntry,
  currentTime: number,
  response:
    ParticipantImpactResponse | undefined,
  participantHeadingDegrees: number,
  enabled: boolean,
  playbackActive: boolean,
): void {
  const root =
    entry.modelRoot;

  const filter =
    entry.visualPoseFilter;

  let targetVertical = 0;
  let targetRotationX = 0;
  let targetRotationY = 0;
  let targetRotationZ = 0;

  if (
    enabled &&
    response
  ) {
    const dimensions =
      participantDimensions(
        entry.participant,
      );

    const pose =
      getParticipantImpactVisualPose({
        response,
        currentTimeSeconds:
          currentTime,
        participantHeadingDegrees,
        participantHeightMetres:
          dimensions[1],
      });

    targetVertical =
      pose.verticalMetres;

    targetRotationX =
      THREE.MathUtils.degToRad(
        pose.rotationXDegrees,
      );

    targetRotationY =
      THREE.MathUtils.degToRad(
        pose.rotationYDegrees,
      );

    targetRotationZ =
      THREE.MathUtils.degToRad(
        pose.rotationZDegrees,
      );
  }

  const timelineDelta =
    currentTime -
    filter.lastTimelineTimeSeconds;

  const jump =
    !Number.isFinite(
      timelineDelta,
    ) ||
    timelineDelta <
      -0.0001 ||
    Math.abs(timelineDelta) >
      0.18;

  if (
    !playbackActive ||
    jump
  ) {
    filter.impactVerticalMetres =
      targetVertical;

    filter.impactRotationX =
      targetRotationX;

    filter.impactRotationY =
      targetRotationY;

    filter.impactRotationZ =
      targetRotationZ;
  } else {
    /*
     * Slightly stronger damping for pitch/roll than for yaw. This keeps real
     * impact body motion, but removes the small high-frequency rocking that
     * reads as mesh wobble after collision.
     */
    filter.impactVerticalMetres =
      dampScalar(
        filter
          .impactVerticalMetres,
        targetVertical,
        timelineDelta,
        22,
      );

    filter.impactRotationX =
      dampAngle(
        filter
          .impactRotationX,
        targetRotationX,
        timelineDelta,
        20,
      );

    filter.impactRotationY =
      dampAngle(
        filter
          .impactRotationY,
        targetRotationY,
        timelineDelta,
        18,
      );

    filter.impactRotationZ =
      dampAngle(
        filter
          .impactRotationZ,
        targetRotationZ,
        timelineDelta,
        20,
      );
  }

  root.position.set(
    0,
    filter
      .impactVerticalMetres,
    0,
  );

  root.rotation.set(
    filter
      .impactRotationX,
    filter
      .impactRotationY,
    filter
      .impactRotationZ,
  );

  root.scale.set(
    1,
    1,
    1,
  );
}

function Reconstruction3DViewer({
  reconstruction,
  onSwitchTo2D,
  onRunPhysics,
  onPreparePlayback,
  compact = false,
  workspaceMode = false,
  selectedParticipantId = null,
  onSelectParticipant,
  selectedSceneObjectId = null,
  onSelectSceneObject,
  onTransformParticipant,
  onTransformSceneObject,
  cameraCycleToken = 0,
  workspaceTimeSeconds,
  workspaceTimeSourceRef,
  workspacePlaying,
  workspacePlaybackSpeed,
  workspaceCameraMode,
  workspaceLayers,
  workspaceTool = "Select",
  onDropParticipantAsset,
  onDropSceneObject,
}: Reconstruction3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const timeRef = useRef(workspaceTimeSeconds ?? 0);
  const workspaceTimeRef = useRef(workspaceTimeSeconds ?? 0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const cameraModeRef = useRef<CameraMode>("Orbit");
  const selectedRef = useRef<string | null>(selectedParticipantId);
  const onSelectRef = useRef(onSelectParticipant);
  const selectedSceneObjectRef =
    useRef<string | null>(
      selectedSceneObjectId,
    );
  const onSelectSceneObjectRef =
    useRef(onSelectSceneObject);
  const onTransformParticipantRef =
    useRef(onTransformParticipant);
  const onTransformSceneObjectRef =
    useRef(onTransformSceneObject);
  const onDropParticipantAssetRef =
    useRef(onDropParticipantAsset);
  const onDropSceneObjectRef =
    useRef(onDropSceneObject);

  useEffect(() => {
    onDropParticipantAssetRef.current =
      onDropParticipantAsset;
  }, [onDropParticipantAsset]);

  useEffect(() => {
    onDropSceneObjectRef.current =
      onDropSceneObject;
  }, [onDropSceneObject]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(workspaceTimeSeconds ?? 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("Orbit");
  const [showPaths, setShowPaths] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [showEvidence, setShowEvidence] = useState(true);
  const [showPhysicsEffects, setShowPhysicsEffects] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [assetStatus, setAssetStatus] = useState({ loaded: 0, total: 0, failed: 0 });

  const controlledWorkspace = workspaceMode && workspaceTimeSeconds !== undefined;
  const effectivePlaying = controlledWorkspace ? Boolean(workspacePlaying) : isPlaying;
  const effectiveSpeed = controlledWorkspace
    ? workspacePlaybackSpeed ?? 1
    : playbackSpeed;
  const effectiveCameraMode = workspaceMode && workspaceCameraMode
    ? workspaceCameraMode
    : cameraMode;
  const effectiveShowPaths = workspaceLayers?.paths ?? showPaths;
  const effectiveShowObjects = workspaceLayers?.objects ?? showObjects;
  const effectiveShowEvidence = workspaceLayers?.evidence ?? showEvidence;
  const effectiveShowPhysics = workspaceLayers?.physics ?? showPhysicsEffects;
  const visibleTime = controlledWorkspace ? workspaceTimeSeconds ?? 0 : displayTime;

  useEffect(() => {
    playingRef.current = effectivePlaying;
  }, [effectivePlaying]);
  useEffect(() => {
    speedRef.current = effectiveSpeed;
  }, [effectiveSpeed]);
  useEffect(() => {
    cameraModeRef.current = effectiveCameraMode;
  }, [effectiveCameraMode]);
  useEffect(() => {
    selectedRef.current = selectedParticipantId;
  }, [selectedParticipantId]);
  useEffect(() => {
    onSelectRef.current = onSelectParticipant;
  }, [onSelectParticipant]);
  useEffect(() => {
    selectedSceneObjectRef.current =
      selectedSceneObjectId;
  }, [selectedSceneObjectId]);

  useEffect(() => {
    onSelectSceneObjectRef.current =
      onSelectSceneObject;
  }, [onSelectSceneObject]);

  useEffect(() => {
    onTransformParticipantRef.current =
      onTransformParticipant;
  }, [onTransformParticipant]);

  useEffect(() => {
    onTransformSceneObjectRef.current =
      onTransformSceneObject;
  }, [onTransformSceneObject]);
  useEffect(() => {
    if (!controlledWorkspace || workspaceTimeSeconds === undefined) return;
    workspaceTimeRef.current = workspaceTimeSeconds;
    timeRef.current = workspaceTimeSeconds;
  }, [controlledWorkspace, workspaceTimeSeconds]);

  useEffect(() => {
    if (!workspaceMode || cameraCycleToken <= 0) return;
    const modes: CameraMode[] = ["Orbit", "Overhead", "Roadside", "Driver"];
    setCameraMode((current) => modes[(modes.indexOf(current) + 1) % modes.length]);
  }, [cameraCycleToken, workspaceMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const { widthMetres: width, heightMetres: height } =
      getReconstructionWorldDimensions(reconstruction);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      reconstruction.scene.timeOfDay === "Night" ? 0x202020 : 0x74818a,
    );
    scene.fog = new THREE.FogExp2(
      scene.background as THREE.Color,
      reconstruction.scene.timeOfDay === "Night" ? 0.014 : 0.006,
    );

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(width * 0.58, Math.max(width, height) * 0.72, height * 0.62);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = reconstruction.scene.timeOfDay === "Night" ? 0.8 : 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    /*
     * [RoadSafe:EasyViewportMouseNavigationV2:3D]
     *
     * Easy mouse navigation:
     * - left drag   = orbit
     * - middle drag = pan
     * - right drag  = pan
     * - wheel       = zoom
     *
     * TransformControls continues to disable OrbitControls while a selected
     * entity gizmo is actively being dragged.
     */
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.2;
    controls.rotateSpeed = 0.82;
    controls.zoomSpeed = 1.08;

    controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;

    controls.mouseButtons.MIDDLE =
      THREE.MOUSE.PAN;

    controls.mouseButtons.RIGHT =
      THREE.MOUSE.PAN;
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minDistance = 4;
    controls.maxDistance = Math.max(width, height) * 1.7;
    controls.maxPolarAngle = Math.PI / 2.02;

    /*
     * [RoadSafe:Main3DViewportPolishV2]
     * Pure viewport helpers: floor grid, world axes and orientation gizmo.
     */
    const viewportPolish =
      createRoadSafeViewportPolish({
        scene,
        camera,
        controls,
        mount,
        widthMetres: width,
        heightMetres: height,
      });
    /*
     * G / R / S belong to the selected entity, not the camera.
     * Camera navigation keeps ordinary OrbitControls behaviour.
     */
    controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;

    scene.add(
      new THREE.HemisphereLight(
        reconstruction.scene.timeOfDay === "Night" ? 0x667b9c : 0xe5edf2,
        0x354035,
        reconstruction.scene.timeOfDay === "Night" ? 0.7 : 1.4,
      ),
    );
    const sun = new THREE.DirectionalLight(0xfff4df, 1.9);
    sun.position.set(-30, 45, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const shadowExtent = Math.max(width, height) * 0.75;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    scene.add(sun);

    const extracted = reconstruction.scene.realSceneGeometry?.status === "ready"
      ? reconstruction.scene.realSceneGeometry
      : null;
    if (extracted) {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ color: 0x4d5b4d, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.03;
      ground.receiveShadow = true;
      scene.add(ground);
      addRealSceneGeometryToThreeScene({
        scene,
        geometry: extracted,
        showPavements: reconstruction.scene.showPavements,
        showLaneMarkings: reconstruction.scene.showLaneMarkings,
        wet: reconstruction.scene.roadSurface === "Wet",
      });
    } else {
      addGeneratedRoad(scene, reconstruction, width, height);
    }

    const participantEntries = new Map<string, ParticipantRenderEntry>();

    const damageByParticipant =
      new Map<
        string,
        ParticipantVisualDamageState
      >(
        (
          reconstruction
            .lastPhysicsSimulation
            ?.participantVisualDamage ??
          []
        ).map(
          (damage) => [
            damage.participantId,
            damage,
          ],
        ),
      );

    const sceneObjectEntries =
      new Map<
        string,
        {
          object:
            ReconstructionSceneObject;
          holder:
            THREE.Group;
        }
      >();
    let disposed = false;
    let loadedAssets = 0;
    let failedAssets = 0;
    const visibleObjectCount = effectiveShowObjects
      ? reconstruction.sceneObjects.filter((object) => object.visible).length
      : 0;
    const totalAssets = reconstruction.vehicles.length + visibleObjectCount;
    setAssetStatus({ loaded: 0, total: totalAssets, failed: 0 });
    const settleAsset = (failed = false) => {
      if (disposed) return;
      loadedAssets += 1;
      if (failed) failedAssets += 1;
      setAssetStatus({ loaded: loadedAssets, total: totalAssets, failed: failedAssets });
    };

    reconstruction.vehicles.forEach((participant) => {
      const entry = createParticipantHolder(participant);

      populateParticipantDamageVisual(
        entry,
        damageByParticipant.get(
          participant.id,
        ),
      );

      entry.holder.scale.setScalar(
        Math.max(
          0.2,
          Math.min(
            5,
            participant.visualScale ??
              1,
          ),
        ),
      );

      scene.add(entry.holder);
      participantEntries.set(participant.id, entry);
      if (
        isHumanReconstructionParticipant(
          participant,
        )
      ) {
        settleAsset(false);
      } else {
        void loadPremiumParticipantModel(participant)
        .then((premiumModel) => {
          if (!premiumModel) {
            settleAsset(false);
            return;
          }

          if (disposed) {
            disposeObjectTree(
              premiumModel,
            );
            return;
          }

          const previousModels = [
            ...entry.modelRoot.children,
          ];

          previousModels.forEach(
            (object) => {
              entry.modelRoot.remove(
                object,
              );

              disposeObjectTree(
                object,
              );
            },
          );

          entry.modelRoot.add(
            premiumModel,
          );

          settleAsset(false);
        })
        .catch(() =>
          settleAsset(true),
        );
      }


      if (effectiveShowPaths) {
        const authoredPoints =
          getParticipantPlaybackPathPoints(
            participant,
          ).filter(
            (point) =>
              !isPhysicsGeneratedPathPoint(
                point,
              ),
          );
        const positions = authoredPoints.map((point) =>
          worldPosition(point.position, width, height, 0.18),
        );
        if (positions.length > 1) {
          const roadGraphControlled = authoredPoints.some(
            (point) =>
              point.notes?.includes(AUTO_ROAD_CURVE_NOTE_MARKER) === true,
          );
          const renderedPoints = roadGraphControlled
            ? positions
            : new THREE.CatmullRomCurve3(
                positions,
                false,
                "centripetal",
                0.5,
              ).getPoints(Math.max(18, positions.length * 8));
          const path = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(renderedPoints),
            new THREE.LineBasicMaterial({
              color: getParticipantColourNumber(participant.colour),
              transparent: true,
              opacity: 0.85,
            }),
          );
          scene.add(path);
        }
      }
    });

    if (effectiveShowObjects) {
      reconstruction.sceneObjects
        .filter((object) => object.visible)
        .forEach((object) => {
          if (object.tracePoints && object.tracePoints.length > 1) {
            const holder =
              new THREE.Group();

            holder.userData.sceneObjectId =
              object.id;

            const origin =
              worldPosition(
                object.position,
                width,
                height,
                0.12,
              );

            const line =
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(
                  object.tracePoints.map(
                    (point) =>
                      worldPosition(
                        point,
                        width,
                        height,
                        0.12,
                      ).sub(
                        origin,
                      ),
                  ),
                ),
                new THREE.LineBasicMaterial({
                  color:
                    0x292929,
                }),
              );

            line.scale.setScalar(
              Math.max(
                0.2,
                object.scale,
              ),
            );

            holder.position.copy(
              origin,
            );

            holder.rotation.y =
              -THREE.MathUtils.degToRad(
                object.rotation,
              );

            holder.add(
              line,
            );

            holder.traverse(
              (child) => {
                child.userData.sceneObjectId =
                  object.id;
              },
            );

            scene.add(
              holder,
            );

            sceneObjectEntries.set(
              object.id,
              {
                object,
                holder,
              },
            );

            settleAsset(false);
            return;
          }
          const holder = new THREE.Group();
          const fallback = createFallbackSceneObject(object);
          holder.add(fallback);
          holder.position.copy(worldPosition(object.position, width, height));
          holder.rotation.y = -THREE.MathUtils.degToRad(object.rotation);
          holder.traverse(
            (child) => {
              child.userData.sceneObjectId =
                object.id;
            },
          );

          scene.add(holder);

          sceneObjectEntries.set(
            object.id,
            {
              object,
              holder,
            },
          );

          void loadRealisticSceneObjectModel(object)
            .then((model) => {
              if (!model) {
                settleAsset(false);
                return;
              }
              if (disposed) {
                disposeObjectTree(model);
                return;
              }
              holder.remove(fallback);
              disposeObjectTree(fallback);
              holder.add(model);
              settleAsset(false);
            })
            .catch(() => settleAsset(true));
        });
    }

    if (effectiveShowEvidence) {
      reconstruction.evidenceRecords.forEach((record) => {
        const marker = new THREE.Mesh(
          new THREE.ConeGeometry(0.35, 1.1, 10),
          new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
        );
        marker.position.copy(worldPosition(record.position, width, height, 0.55));
        scene.add(marker);
      });
      reconstruction.measurements.forEach((measurement) => {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            worldPosition(measurement.start, width, height, 0.16),
            worldPosition(measurement.end, width, height, 0.16),
          ]),
          new THREE.LineDashedMaterial({
            color: 0x38bdf8,
            dashSize: 0.5,
            gapSize: 0.3,
          }),
        );
        line.computeLineDistances();
        scene.add(line);
      });
    }

    const collisionEvents =
      reconstruction.lastPhysicsSimulation?.collisionEvents ?? [];
    const participantImpact = collisionEvents
      .filter((event) => event.type === "Participant-Participant")
      .sort((left, right) => left.timeSeconds - right.timeSeconds)[0];
    const impactByParticipant =
      indexEarliestParticipantImpactResponses(
        collisionEvents,
      );

    // Point Z and the visible primary marker are authoritative in both views.
    // A physics contact can be reported a few centimetres away because bodies
    // have dimensions, but it must not move the investigator's crash marker.
    const collisionPoint = worldPosition(
      reconstruction.collisionPoint,
      width,
      height,
      0.2,
    );
    const collisionMarker = new THREE.Mesh(
      new THREE.TorusGeometry(
        0.42,
        0.055,
        8,
        28,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );
    collisionMarker.rotation.x = Math.PI / 2;
    collisionMarker.position.copy(collisionPoint);
    scene.add(collisionMarker);
    const impactLight = new THREE.PointLight(0xff4a22, 0, 18);
    impactLight.position.copy(collisionPoint).add(new THREE.Vector3(0, 2, 0));
    scene.add(impactLight);

    let gizmoDragging =
      false;

    const transformControls =
      new TransformControls(
        camera,
        renderer.domElement,
      );

    const transformHelper =
      transformControls.getHelper();

    transformHelper.visible =
      false;

    scene.add(
      transformHelper,
    );

    const selectedParticipantEntry =
      selectedRef.current
        ? participantEntries.get(
            selectedRef.current,
          )
        : undefined;

    const selectedSceneObjectEntry =
      selectedSceneObjectRef.current
        ? sceneObjectEntries.get(
            selectedSceneObjectRef.current,
          )
        : undefined;

    const transformModeActive =
      workspaceTool === "Move" ||
      workspaceTool === "Rotate" ||
      workspaceTool === "Scale";

    let transformTarget:
      THREE.Object3D |
      null =
      null;

    let transformTargetKind:
      "participant" |
      "scene-object" |
      null =
      null;

    if (
      transformModeActive &&
      selectedSceneObjectEntry &&
      !selectedSceneObjectEntry.object.locked
    ) {
      transformTarget =
        selectedSceneObjectEntry.holder;

      transformTargetKind =
        "scene-object";
    } else if (
      transformModeActive &&
      selectedParticipantEntry
    ) {
      const selectedState =
        getParticipantStateAtTime(
          selectedParticipantEntry.participant,
          timeRef.current,
          {
            widthMetres:
              width,
            heightMetres:
              height,
          },
        );

      const selectedPoint =
        selectedParticipantEntry.participant.pathPoints.find(
          (point) =>
            point.id ===
            selectedState.activePointId,
        );

      const participantRouteEditable =
        workspaceTool === "Scale" ||
        Boolean(
          selectedPoint &&
          !isPhysicsGeneratedPathPoint(
            selectedPoint,
          ) &&
          selectedPoint.action !==
            "Impact",
        );

      if (
        participantRouteEditable
      ) {
        transformTarget =
          selectedParticipantEntry.holder;

        transformTargetKind =
          "participant";
      }
    }

    if (
      transformTarget
    ) {
      transformHelper.visible =
        true;

      transformControls.attach(
        transformTarget,
      );

      transformControls.setSpace(
        "world",
      );

      if (
        workspaceTool ===
        "Move"
      ) {
        transformControls.setMode(
          "translate",
        );

        transformControls.showX =
          true;

        transformControls.showY =
          false;

        transformControls.showZ =
          true;
      } else if (
        workspaceTool ===
        "Rotate"
      ) {
        transformControls.setMode(
          "rotate",
        );

        transformControls.showX =
          false;

        transformControls.showY =
          true;

        transformControls.showZ =
          false;
      } else {
        transformControls.setMode(
          "scale",
        );

        transformControls.showX =
          true;

        transformControls.showY =
          true;

        transformControls.showZ =
          true;
      }
    }

    transformControls.addEventListener(
      "dragging-changed",
      (
        event,
      ) => {
        gizmoDragging =
          Boolean(
            event.value,
          );

        controls.enabled =
          cameraModeRef.current ===
            "Orbit" &&
          !gizmoDragging;
      },
    );

    transformControls.addEventListener(
      "objectChange",
      () => {
        if (
          workspaceTool !==
            "Scale" ||
          !transformTarget
        ) {
          return;
        }

        /*
         * RoadSafe scale is deliberately uniform. Three's individual axis
         * scale handles are normalized into one scalar immediately.
         */
        const activeAxis =
          transformControls.axis ??
          "XYZ";

        const scalar =
          activeAxis.includes(
            "X",
          )
            ? transformTarget.scale.x
            : activeAxis.includes(
                "Y",
              )
              ? transformTarget.scale.y
              : transformTarget.scale.z;

        transformTarget.scale.setScalar(
          Math.max(
            0.2,
            scalar,
          ),
        );
      },
    );

    const commitTransform =
      () => {
        if (
          !transformTarget ||
          !transformTargetKind
        ) {
          return;
        }

        const position: ReconstructionPosition = {
          x:
            clamp(
              (
                transformTarget.position.x /
                  width +
                0.5
              ) *
                100,
              0,
              100,
            ),

          y:
            clamp(
              (
                transformTarget.position.z /
                  height +
                0.5
              ) *
                100,
              0,
              100,
            ),
        };

        const rotationDegrees =
          (
            -THREE.MathUtils.radToDeg(
              transformTarget.rotation.y,
            ) +
            360
          ) %
          360;

        if (
          transformTargetKind ===
            "scene-object" &&
          selectedSceneObjectEntry
        ) {
          onTransformSceneObjectRef.current?.(
            selectedSceneObjectEntry.object.id,
            {
              position,
              rotationDegrees,

              /*
               * Scene-object dimensions already consume object.scale.
               * TransformControls therefore contributes a multiplier.
               */
              scaleMultiplier:
                Math.max(
                  0.2,
                  transformTarget.scale.x,
                ),
            },
          );

          return;
        }

        if (
          transformTargetKind ===
            "participant" &&
          selectedParticipantEntry
        ) {
          onTransformParticipantRef.current?.(
            selectedParticipantEntry.participant.id,
            {
              position,
              rotationDegrees,
              visualScale:
                Math.max(
                  0.2,
                  transformTarget.scale.x,
                ),
            },
          );
        }
      };

    transformControls.addEventListener(
      "mouseUp",
      commitTransform,
    );

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      if (!onSelectRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(
          [
            ...Array.from(
              participantEntries.values(),
            ).map(
              (entry) => entry.holder,
            ),
            ...Array.from(
              sceneObjectEntries.values(),
            ).map(
              (entry) => entry.holder,
            ),
          ],
          true,
        )
        .find((intersection) => {
          let current:
            THREE.Object3D |
            null =
            intersection.object;

          while (current) {
            if (
              current.userData.participantId ||
              current.userData.sceneObjectId
            ) {
              return true;
            }

            current =
              current.parent;
          }

          return false;
        });

      if (!hit) return;

      let current:
        THREE.Object3D |
        null =
        hit.object;

      while (
        current &&
        !current.userData.participantId &&
        !current.userData.sceneObjectId
      ) {
        current =
          current.parent;
      }

      const sceneObjectId =
        current?.userData.sceneObjectId as
          | string
          | undefined;

      if (
        sceneObjectId
      ) {
        onSelectSceneObjectRef.current?.(
          sceneObjectId,
        );

        return;
      }

      const participantId =
        current?.userData.participantId as
          | string
          | undefined;

      if (
        participantId
      ) {
        onSelectRef.current?.(
          participantId,
        );
      }
    };
    const handleSceneAssetDragOver = (
      event: DragEvent,
    ) => {
      const dataTransfer =
        event.dataTransfer;

      if (
        !dataTransfer ||
        !hasRoadSafeSceneAssetDrag(
          dataTransfer,
        )
      ) {
        return;
      }

      event.preventDefault();

      dataTransfer.dropEffect =
        "copy";
    };

    const handleSceneAssetDrop = (
      event: DragEvent,
    ) => {
      const dataTransfer =
        event.dataTransfer;

      if (!dataTransfer) {
        return;
      }

      const payload =
        readRoadSafeSceneAssetDrag(
          dataTransfer,
        );

      if (!payload) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect =
        renderer.domElement
          .getBoundingClientRect();

      pointer.x =
        (
          (
            event.clientX -
            rect.left
          ) /
          rect.width
        ) *
          2 -
        1;

      pointer.y =
        -(
          (
            event.clientY -
            rect.top
          ) /
          rect.height
        ) *
          2 +
        1;

      raycaster.setFromCamera(
        pointer,
        camera,
      );

      const point =
        raycaster.ray.intersectPlane(
          new THREE.Plane(
            new THREE.Vector3(
              0,
              1,
              0,
            ),
            0,
          ),
          new THREE.Vector3(),
        );

      if (!point) {
        return;
      }

      const position: ReconstructionPosition = {
        x: clamp(
          (
            point.x /
              width +
            0.5
          ) *
            100,
          0,
          100,
        ),
        y: clamp(
          (
            point.z /
              height +
            0.5
          ) *
            100,
          0,
          100,
        ),
      };

      if (
        payload.kind ===
        "participant"
      ) {
        onDropParticipantAssetRef.current?.(
          payload.assetId,
          payload.type,
          position,
        );

        return;
      }

      onDropSceneObjectRef.current?.(
        payload.type,
        position,
      );
    };

    renderer.domElement.addEventListener(
      "dragover",
      handleSceneAssetDragOver,
    );

    renderer.domElement.addEventListener(
      "drop",
      handleSceneAssetDrop,
    );

    const handleRoadSafeViewportContextMenu =
      (
        event: MouseEvent,
      ) => {
        event.preventDefault();
      };

    renderer.domElement.addEventListener(
      "contextmenu",
      handleRoadSafeViewportContextMenu,
    );

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver(() => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
      viewportPolish.resize();
    });
    resizeObserver.observe(mount);

    let animationId = 0;
    let previous = performance.now();
    let lastUiUpdate = 0;
    const animate = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;

      if (controlledWorkspace) {
        timeRef.current =
          workspaceTimeSourceRef?.current ?? workspaceTimeRef.current;
      } else if (playingRef.current) {
        timeRef.current = Math.min(
          reconstruction.durationSeconds,
          timeRef.current + delta * speedRef.current,
        );
        if (timeRef.current >= reconstruction.durationSeconds) {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }

      participantEntries.forEach((entry) => {
        if (
          gizmoDragging &&
          selectedRef.current ===
            entry.participant.id
        ) {
          return;
        }

        const state =
          getParticipantStateAtTime(
            entry.participant,
            timeRef.current,
            {
              widthMetres:
                width,
              heightMetres:
                height,
            },
          );

        /*
         * Position stays EXACTLY on the canonical shared trajectory.
         * Only the rendered orientation receives viewport stabilization.
         */
        entry.holder.position.copy(
          worldPosition(
            state.position,
            width,
            height,
          ),
        );

        const stableHeadingDegrees =
          getRenderStableHeadingDegrees(
            entry.participant,
            timeRef.current,
            reconstruction
              .durationSeconds,
            width,
            height,
          );

        const rapierContactTime =
          getParticipantRapierContactTime(
            reconstruction,
            entry.participant.id,
          );

        const reaction =
          getParticipantAccidentReactionState(
            entry.participant,
            timeRef.current,
            state.position,
            stableHeadingDegrees,
            state.speedKmh,
            rapierContactTime ??
              reconstruction
                .lastPhysicsSimulation
                ?.primaryImpactTimeSeconds,
          );

        const displayHeadingDegrees =
          reaction
            .suggestedHeadingDegrees;

        const targetYaw =
          reconstructionHeadingToThreeYawRadians(
            displayHeadingDegrees,
          );

        const stableYaw =
          stabilizeParticipantHolderYaw(
            entry,
            targetYaw,
            timeRef.current,
            playingRef.current,
          );

        entry.holder.rotation.set(
          0,
          stableYaw,
          0,
        );

        entry.label.visible =
          selectedRef.current ===
            null ||
          selectedRef.current ===
            entry.participant.id;

        const impact =
          alignImpactResponseToRapierContact(
            impactByParticipant.get(
              entry.participant.id,
            ),
            rapierContactTime,
          );

        applyImpactPose(
          entry,
          timeRef.current,
          impact,
          displayHeadingDegrees,
          effectiveShowPhysics,
          playingRef.current,
        );

        if (
          isHumanReconstructionParticipant(
            entry.participant,
          ) &&
          impact &&
          effectiveShowPhysics
        ) {
          const dimensions =
            participantDimensions(
              entry.participant,
            );

          const knockdown =
            getGroundedHumanKnockdownPose({
              response:
                impact,
              currentTimeSeconds:
                timeRef.current,
              participantHeadingDegrees:
                displayHeadingDegrees,
              participantHeightMetres:
                dimensions[1],
            });

          if (
            knockdown.active
          ) {
            entry.modelRoot.position.set(
              0,
              knockdown
                .verticalMetres,
              0,
            );

            entry.modelRoot.rotation.set(
              THREE.MathUtils.degToRad(
                knockdown
                  .rotationXDegrees,
              ),
              THREE.MathUtils.degToRad(
                knockdown
                  .rotationYDegrees,
              ),
              THREE.MathUtils.degToRad(
                knockdown
                  .rotationZDegrees,
              ),
            );

            entry.modelRoot.scale.set(
              1,
              1,
              1,
            );
          }
        }

        const postImpact =
          reaction
            .impactTimeSeconds !==
            undefined &&
          timeRef.current >=
            reaction
              .impactTimeSeconds;

        animateHumanParticipantModel(
          entry.modelRoot,
          {
            timeSeconds:
              timeRef.current,
            speedKmh:
              reaction
                .adjustedSpeedKmh,
            reactionIntensity:
              reaction
                .reactionIntensity,
            lookYawDegrees:
              reaction
                .lookYawDegrees,
            postImpact,
          },
        );

        entry.brakeLightRoot.visible =
          reaction
            .emergencyBraking &&
          !postImpact;

        if (
          reaction
            .emergencyBraking &&
          !postImpact
        ) {
          /*
           * Vehicle body pitch under emergency braking. Forward is local +X,
           * so a small negative local-Z rotation produces a restrained nose
           * dive without changing the canonical rigid-body/path pose.
           */
          entry.modelRoot.rotation.z -=
            THREE.MathUtils.degToRad(
              2.1 *
              reaction
                .emergencyBrakeIntensity,
            );

          entry.modelRoot.position.y -=
            0.018 *
            reaction
              .emergencyBrakeIntensity;
        }

        const potholeEffect = getParticipantPotholeEffect(
          reconstruction,
          entry.participant,
          state.position,
          state.speedKmh,
          timeRef.current,
        );
        if (
          effectiveShowPhysics &&
          potholeEffect.active
        ) {
          entry.modelRoot.position.y += potholeEffect.verticalMetres;
          entry.modelRoot.rotation.x += THREE.MathUtils.degToRad(
            potholeEffect.pitchDegrees,
          );
          entry.modelRoot.rotation.z += THREE.MathUtils.degToRad(
            potholeEffect.rollDegrees,
          );
        }

        applyParticipantDamagePose(
          entry,
          alignVisualDamageToRapierContact(
            damageByParticipant.get(
              entry.participant.id,
            ),
            rapierContactTime,
          ),
          timeRef.current,
          effectiveShowPhysics,
        );
      });

      const impactTime =
        reconstruction
          .lastPhysicsSimulation
          ?.rapierDynamics
          ?.firstContactTimeSeconds ??
        participantImpact
          ?.timeSeconds;
      const impactDelta = impactTime === undefined
        ? Number.POSITIVE_INFINITY
        : Math.abs(timeRef.current - impactTime);
      impactLight.intensity =
        effectiveShowPhysics && impactDelta < 0.35
          ? (1 - impactDelta / 0.35) * 18
          : 0;

      const mode = cameraModeRef.current;
      controls.enabled = mode === "Orbit" && !gizmoDragging;
      if (mode === "Overhead") {
        camera.position.lerp(
          new THREE.Vector3(0, Math.max(width, height) * 1.05, 0.01),
          0.1,
        );
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
      } else if (mode === "Roadside") {
        camera.up.set(0, 1, 0);
        camera.position.lerp(new THREE.Vector3(width * 0.12, 6, height * 0.46), 0.08);
        camera.lookAt(0, 0.8, 0);
      } else if (mode === "Driver") {
        const selected =
          (selectedRef.current
            ? participantEntries.get(selectedRef.current)
            : undefined) ??
          (participantEntries.values().next().value as
            | ParticipantRenderEntry
            | undefined);
        if (selected) {
          const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(
            selected.holder.quaternion,
          );
          const desired = selected.holder.position
            .clone()
            .add(new THREE.Vector3(0, 1.55, 0))
            .addScaledVector(direction, -1.2);
          camera.position.lerp(desired, 0.14);
          camera.up.set(0, 1, 0);
          camera.lookAt(
            selected.holder.position
              .clone()
              .add(new THREE.Vector3(0, 1.1, 0))
              .addScaledVector(direction, 10),
          );
        }
      } else {
        camera.up.set(0, 1, 0);
        controls.update();
      }

      if (!controlledWorkspace && now - lastUiUpdate > 80) {
        lastUiUpdate = now;
        setDisplayTime(timeRef.current);
      }
      viewportPolish.update();
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animationId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);

      renderer.domElement.removeEventListener(
        "contextmenu",
        handleRoadSafeViewportContextMenu,
      );

      renderer.domElement.removeEventListener(
        "dragover",
        handleSceneAssetDragOver,
      );

      renderer.domElement.removeEventListener(
        "drop",
        handleSceneAssetDrop,
      );
      transformControls.detach();
      transformControls.dispose();
      scene.remove(transformHelper);
      viewportPolish.dispose();
      controls.dispose();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.Sprite
        ) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (controlsRef.current === controls) controlsRef.current = null;
    };
  }, [
    controlledWorkspace,
    effectiveShowEvidence,
    effectiveShowObjects,
    effectiveShowPaths,
    effectiveShowPhysics,
    reconstruction,
    selectedSceneObjectId,
    selectedParticipantId,
    workspaceMode,
    workspaceTimeSourceRef,
    workspaceTool,
  ]);

  const setTime = (value: number) => {
    const next = clamp(value, 0, reconstruction.durationSeconds);
    timeRef.current = next;
    setDisplayTime(next);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (timeRef.current >= reconstruction.durationSeconds) setTime(0);
    if (timeRef.current <= 0.01 || timeRef.current >= reconstruction.durationSeconds) {
      onPreparePlayback();
    }
    setIsPlaying(true);
  };

  return (
    <section
      className={`reconstruction-3d ui-panel flex min-h-0 flex-col overflow-hidden ${
        expanded ? "fixed inset-3 z-[120]" : ""
      } ${compact ? "reconstruction-3d--compact h-full" : ""} ${
        workspaceMode ? "reconstruction-3d--workspace" : ""
      }`}
    >
      {!workspaceMode && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#494949] bg-[#292929] ${
            compact ? "px-3 py-2" : "px-4 py-3"
          }`}
        >
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-200">
              3D Reconstruction
            </h2>
            {!compact && (
              <p className="mt-1 text-[9px] text-slate-600">
                Calibrated physical scene, participant routes and evidence layers.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!compact && (
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setTime(0);
                  void onRunPhysics();
                }}
                className="ui-button py-1.5"
              >
                Recalculate
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                onSwitchTo2D();
              }}
              className="ui-button py-1.5"
            >
              2D view
            </button>
            <select
              value={cameraMode}
              onChange={(event) => setCameraMode(event.target.value as CameraMode)}
              className="ui-input py-1.5"
            >
              <option>Orbit</option>
              <option>Overhead</option>
              <option>Roadside</option>
              <option>Driver</option>
            </select>
            {!compact && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="ui-button-primary py-1.5"
              >
                {expanded ? "Exit full view" : "Expand"}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={`relative min-h-0 w-full flex-1 bg-[#303030] ${
          expanded ? "flex-1" : ""
        }`}
        style={
          expanded || workspaceMode
            ? undefined
            : compact
              ? { minHeight: "270px" }
              : { height: "min(72vh, 760px)", minHeight: "520px" }
        }
      >
        <div ref={mountRef} className="absolute inset-0" />
        {!workspaceMode && (
          <button
            type="button"
            onClick={handlePlayPause}
            className="ui-button-primary absolute left-3 top-3 z-10 min-w-20 shadow-xl"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        )}
        <div className="pointer-events-none absolute right-3 top-3 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[8px] text-slate-300 backdrop-blur">
          {getReconstructionWorldDimensions(reconstruction).source} Ãƒâ€šÃ‚Â· {effectiveCameraMode}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-[142px] z-20 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur">
          {visibleTime.toFixed(1)}s
        </div>
        <div
          className="pointer-events-none absolute bottom-3 left-3 max-w-[65%] rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[8px] text-slate-400 backdrop-blur"
>
          {assetStatus.total > 0 && assetStatus.loaded < assetStatus.total
            ? `Loading model assets ${assetStatus.loaded}/${assetStatus.total}`
            : assetStatus.failed > 0
              ? `RoadSafe models ready · ${assetStatus.failed} scene fallback(s)`
              : "RoadSafe generic model library ready"}
        </div>
      </div>

      {!workspaceMode && (
        <div
          className={`border-t border-[#494949] bg-[#292929] ${
            compact ? "px-3 py-2" : "p-4"
          }`}
        >
          <input
            type="range"
            min={0}
            max={reconstruction.durationSeconds}
            step={0.01}
            value={displayTime}
            onChange={(event) => {
              setIsPlaying(false);
              setTime(Number(event.target.value));
            }}
            className="roadsafe-range w-full"
          />
          <div
            className={`flex flex-wrap items-center justify-between gap-3 ${
              compact ? "mt-1.5" : "mt-3"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setTime(0);
                }}
                className="ui-button py-1.5"
              >
                Reset
              </button>
              <span className="text-[9px] font-semibold text-slate-400">
                {displayTime.toFixed(1)}s / {reconstruction.durationSeconds.toFixed(1)}s
              </span>
            </div>
            {!compact && (
              <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-400">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPaths}
                    onChange={(event) => setShowPaths(event.target.checked)}
                  />
                  Paths
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showObjects}
                    onChange={(event) => setShowObjects(event.target.checked)}
                  />
                  Objects
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showEvidence}
                    onChange={(event) => setShowEvidence(event.target.checked)}
                  />
                  Evidence
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPhysicsEffects}
                    onChange={(event) => setShowPhysicsEffects(event.target.checked)}
                  />
                  Physics
                </label>
                <select
                  value={playbackSpeed}
                  onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                  className="ui-input py-1.5"
                >
                  <option value={0.5}>0.5ÃƒÆ’Ã¢â‚¬â€</option>
                  <option value={1}>1ÃƒÆ’Ã¢â‚¬â€</option>
                  <option value={1.5}>1.5ÃƒÆ’Ã¢â‚¬â€</option>
                  <option value={2}>2ÃƒÆ’Ã¢â‚¬â€</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(Reconstruction3DViewer);
