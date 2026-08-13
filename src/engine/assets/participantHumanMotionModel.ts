import * as THREE from "three";

import type {
  ReconstructionVehicle,
} from "../../types/reconstruction";

import {
  getParticipantColourNumber,
  getParticipantPhysicalDimensions,
} from "./participantAssetCatalog";

export interface HumanMotionAnimationInput {
  timeSeconds: number;
  speedKmh: number;
  reactionIntensity: number;
  lookYawDegrees: number;
  postImpact: boolean;
}

type RigPartName =
  | "root"
  | "torso"
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg";

function markPart(
  object: THREE.Object3D,
  part: RigPartName,
): void {
  object.userData
    .roadSafeHumanRigPart =
      part;
}

function rigPart(
  root: THREE.Object3D,
  name: RigPartName,
): THREE.Object3D | null {
  let found:
    THREE.Object3D | null =
      null;

  root.traverse(
    (object) => {
      if (
        !found &&
        object.userData
          .roadSafeHumanRigPart ===
          name
      ) {
        found = object;
      }
    },
  );

  return found;
}

function cylinderFromPivot(
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  segments = 14,
): THREE.Mesh {
  const length =
    Math.max(
      0.001,
      end.length(),
    );

  const geometry =
    new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      segments,
    );

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.position.copy(
    end.clone()
      .multiplyScalar(
        0.5,
      ),
  );

  mesh.quaternion
    .setFromUnitVectors(
      new THREE.Vector3(
        0,
        1,
        0,
      ),
      end.clone()
        .normalize(),
    );

  mesh.castShadow =
    true;

  return mesh;
}

export function createAnimatedHumanParticipantModel(
  participant:
    ReconstructionVehicle,
): THREE.Group {
  const dimensions =
    getParticipantPhysicalDimensions(
      participant,
    );

  const height =
    dimensions.heightMetres;

  const width =
    dimensions.widthMetres;

  const bodyColour =
    getParticipantColourNumber(
      participant.colour,
    );

  const skin =
    new THREE.MeshStandardMaterial({
      color: 0xb97850,
      roughness: 0.82,
    });

  const clothing =
    new THREE.MeshStandardMaterial({
      color: bodyColour,
      roughness: 0.78,
    });

  const dark =
    new THREE.MeshStandardMaterial({
      color: 0x303033,
      roughness: 0.9,
    });

  const root =
    new THREE.Group();

  root.name =
    "RoadSafe_AnimatedHuman";

  markPart(
    root,
    "root",
  );

  root.userData
    .roadSafeAnimatedHuman =
      true;

  const torsoPivot =
    new THREE.Group();

  markPart(
    torsoPivot,
    "torso",
  );

  torsoPivot.position.y =
    height *
    0.39;

  const torsoHeight =
    height *
    0.38;

  const torsoRadius =
    Math.max(
      0.1,
      width *
      0.22,
    );

  const torso =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        torsoRadius,
        Math.max(
          0.12,
          torsoHeight -
          torsoRadius *
          2,
        ),
        5,
        16,
      ),
      clothing,
    );

  torso.position.y =
    height *
      0.18;

  torso.castShadow =
    true;

  torsoPivot.add(
    torso,
  );

  root.add(
    torsoPivot,
  );

  const headRadius =
    Math.max(
      0.12,
      Math.min(
        0.19,
        height *
        0.105,
      ),
    );

  const headPivot =
    new THREE.Group();

  markPart(
    headPivot,
    "head",
  );

  headPivot.position.y =
    height -
    headRadius;

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius,
        18,
        14,
      ),
      skin,
    );

  head.castShadow =
    true;

  headPivot.add(
    head,
  );

  root.add(
    headPivot,
  );

  const shoulderY =
    height *
    0.69;

  const hipY =
    height *
    0.39;

  const armLength =
    height *
    0.27;

  const legLength =
    Math.max(
      0.2,
      hipY -
      0.06,
    );

  const limbRadius =
    Math.max(
      0.034,
      width *
      0.07,
    );

  for (
    const side of [-1, 1]
  ) {
    const armPivot =
      new THREE.Group();

    const armPart:
      RigPartName =
        side < 0
          ? "leftArm"
          : "rightArm";

    markPart(
      armPivot,
      armPart,
    );

    armPivot.position.set(
      0,
      shoulderY,
      side *
        width *
        0.22,
    );

    armPivot.add(
      cylinderFromPivot(
        new THREE.Vector3(
          height *
            0.015,
          -armLength,
          side *
            width *
            0.1,
        ),
        limbRadius,
        skin,
      ),
    );

    root.add(
      armPivot,
    );

    const legPivot =
      new THREE.Group();

    const legPart:
      RigPartName =
        side < 0
          ? "leftLeg"
          : "rightLeg";

    markPart(
      legPivot,
      legPart,
    );

    legPivot.position.set(
      0,
      hipY,
      side *
        width *
        0.12,
    );

    legPivot.add(
      cylinderFromPivot(
        new THREE.Vector3(
          0,
          -legLength,
          side *
            width *
            0.04,
        ),
        limbRadius *
          1.12,
        dark,
      ),
    );

    root.add(
      legPivot,
    );
  }

  if (
    participant.type ===
    "Officer"
  ) {
    const vest =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width *
            0.2,
          height *
            0.22,
          width *
            0.54,
        ),
        new THREE
          .MeshStandardMaterial({
            color:
              0xc8c0a0,
            roughness:
              0.72,
          }),
      );

    vest.position.y =
      height *
      0.24;

    torsoPivot.add(
      vest,
    );

    const cap =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          headRadius *
            0.95,
          headRadius *
            1.02,
          headRadius *
            0.36,
          16,
        ),
        dark,
      );

    cap.position.y =
      headRadius *
      0.88;

    headPivot.add(
      cap,
    );
  }

  return root;
}

function radians(
  degrees: number,
): number {
  return (
    degrees *
    Math.PI /
    180
  );
}

export function animateHumanParticipantModel(
  model:
    THREE.Object3D,
  input:
    HumanMotionAnimationInput,
): void {
  const root =
    rigPart(
      model,
      "root",
    );

  if (!root) {
    return;
  }

  const torso =
    rigPart(
      model,
      "torso",
    );

  const head =
    rigPart(
      model,
      "head",
    );

  const leftArm =
    rigPart(
      model,
      "leftArm",
    );

  const rightArm =
    rigPart(
      model,
      "rightArm",
    );

  const leftLeg =
    rigPart(
      model,
      "leftLeg",
    );

  const rightLeg =
    rigPart(
      model,
      "rightLeg",
    );

  const speedRatio =
    Math.min(
      1.35,
      Math.max(
        0,
        input.speedKmh /
        6.5,
      ),
    );

  const moving =
    !input.postImpact &&
    input.speedKmh >
      0.45;

  const cadenceHz =
    1.35 +
    Math.min(
      1,
      speedRatio,
    ) *
    0.7 +
    Math.max(
      0,
      speedRatio -
      1,
    ) *
    0.55;

  const phase =
    input.timeSeconds *
    cadenceHz *
    Math.PI *
    2;

  const legSwing =
    moving
      ? Math.sin(
          phase,
        ) *
        radians(
          22 +
          Math.min(
            1,
            speedRatio,
          ) *
          14,
        )
      : 0;

  const armSwing =
    -legSwing *
    0.72;

  const startle =
    Math.max(
      0,
      Math.min(
        1,
        input
          .reactionIntensity,
      ),
    );

  if (leftLeg) {
    leftLeg.rotation.z =
      legSwing;
  }

  if (rightLeg) {
    rightLeg.rotation.z =
      -legSwing;
  }

  if (leftArm) {
    leftArm.rotation.z =
      armSwing;

    leftArm.rotation.x =
      startle *
      radians(-8);
  }

  if (rightArm) {
    rightArm.rotation.z =
      -armSwing;

    rightArm.rotation.x =
      startle *
      radians(8);
  }

  if (torso) {
    torso.rotation.z =
      moving
        ? radians(
            -2.2 *
            Math.min(
              1,
              speedRatio,
            ),
          )
        : 0;

    torso.rotation.y =
      startle *
      radians(
        Math.max(
          -5,
          Math.min(
            5,
            input
              .lookYawDegrees *
              0.18,
          ),
        ),
      );
  }

  if (head) {
    head.rotation.y =
      radians(
        Math.max(
          -32,
          Math.min(
            32,
            input
              .lookYawDegrees,
          ),
        ),
      );
  }

  root.position.y =
    moving
      ? Math.abs(
          Math.sin(
            phase *
            2,
          ),
        ) *
        0.028 *
        Math.min(
          1,
          speedRatio,
        )
      : 0;
}
