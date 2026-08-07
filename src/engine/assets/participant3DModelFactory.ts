import * as THREE from "three";
import {
  RoundedBoxGeometry,
} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type {
  ReconstructionVehicle,
} from "../../types/reconstruction";

import {
  getParticipantAssetDefinition,
  getParticipantColourNumber,
  getParticipantPhysicalDimensions,
  type ParticipantAssetLod,
} from "./participantAssetCatalog";

interface MaterialSet {
  body: THREE.MeshPhysicalMaterial;
  bodyDark: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  light: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  clothing: THREE.MeshStandardMaterial;
}

function segmentsForLod(
  lod: ParticipantAssetLod,
): number {
  if (lod === "High") return 24;
  if (lod === "Medium") return 16;
  return 10;
}

function createMaterials(
  participant: ReconstructionVehicle,
): MaterialSet {
  const bodyColour =
    getParticipantColourNumber(participant.colour);

  return {
    body: new THREE.MeshPhysicalMaterial({
      color: bodyColour,
      roughness: 0.38,
      metalness: 0.18,
      clearcoat: 0.28,
    }),
    bodyDark: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(
        bodyColour,
      ).multiplyScalar(0.68),
      roughness: 0.5,
      metalness: 0.12,
      clearcoat: 0.15,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x60727a,
      roughness: 0.18,
      metalness: 0.05,
      transparent: true,
      opacity: 0.84,
      clearcoat: 0.25,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x202020,
      roughness: 0.96,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x858585,
      roughness: 0.48,
      metalness: 0.62,
    }),
    light: new THREE.MeshStandardMaterial({
      color: 0xf1dfa3,
      emissive: 0x6f5c24,
      emissiveIntensity: 0.18,
      roughness: 0.45,
    }),
    tail: new THREE.MeshStandardMaterial({
      color: 0xa73943,
      emissive: 0x4f1218,
      emissiveIntensity: 0.12,
      roughness: 0.52,
    }),
    skin: new THREE.MeshStandardMaterial({
      color: 0xb97850,
      roughness: 0.82,
    }),
    clothing: new THREE.MeshStandardMaterial({
      color: bodyColour,
      roughness: 0.78,
    }),
  };
}

function roundedBox(
  size: [
    number,
    number,
    number,
  ],
  material: THREE.Material,
  radius: number,
): THREE.Mesh {
  const geometry =
    new RoundedBoxGeometry(
      size[0],
      size[1],
      size[2],
      3,
      Math.max(
        0.015,
        Math.min(
          radius,
          Math.min(...size) * 0.38,
        ),
      ),
    );

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function cylinderBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments: number,
): THREE.Mesh {
  const direction =
    end.clone().sub(start);

  const length =
    direction.length();

  const geometry =
    new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      radialSegments,
    );

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.position.copy(
    start
      .clone()
      .add(end)
      .multiplyScalar(0.5),
  );

  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );

  mesh.castShadow = true;

  return mesh;
}

function wheel(
  radius: number,
  width: number,
  materials: MaterialSet,
  segments: number,
): THREE.Group {
  const group =
    new THREE.Group();

  const tyre =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius,
        radius,
        width,
        segments,
      ),
      materials.rubber,
    );

  tyre.rotation.x =
    Math.PI / 2;

  tyre.castShadow = true;

  const rim =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 0.52,
        radius * 0.52,
        width * 1.04,
        Math.max(8, segments - 2),
      ),
      materials.metal,
    );

  rim.rotation.x =
    Math.PI / 2;

  group.add(
    tyre,
    rim,
  );

  group.userData.isWheel = true;

  return group;
}

function addVehicleWheels(
  group: THREE.Group,
  {
    width,
    wheelbase,
    wheelRadius,
    materials,
    segments,
    rearDouble = false,
    axleCount = 2,
  }: {
    length: number;
    width: number;
    height: number;
    wheelbase: number;
    wheelRadius: number;
    materials: MaterialSet;
    segments: number;
    rearDouble?: boolean;
    axleCount?: number;
  },
): void {
  const frontX =
    wheelbase / 2;

  const rearX =
    -wheelbase / 2;

  const y =
    wheelRadius;

  const sideZ =
    width / 2;

  const axleXs =
    axleCount <= 2
      ? [rearX, frontX]
      : [
          rearX,
          rearX + wheelbase * 0.22,
          frontX,
        ];

  axleXs.forEach(
    (x, axleIndex) => {
      for (
        const side of [-1, 1]
      ) {
        const tyre =
          wheel(
            wheelRadius,
            Math.max(
              0.14,
              width * 0.095,
            ),
            materials,
            segments,
          );

        tyre.position.set(
          x,
          y,
          side *
            (
              sideZ -
              width * 0.045
            ),
        );

        group.add(tyre);

        if (
          rearDouble &&
          axleIndex <
            axleXs.length - 1
        ) {
          const inner =
            wheel(
              wheelRadius,
              Math.max(
                0.12,
                width * 0.08,
              ),
              materials,
              segments,
            );

          inner.position.set(
            x,
            y,
            side *
              (
                sideZ -
                width * 0.13
              ),
          );

          group.add(inner);
        }
      }
    },
  );
}

function addVehicleLights(
  group: THREE.Group,
  length: number,
  width: number,
  height: number,
  materials: MaterialSet,
): void {
  const lightWidth =
    Math.max(
      0.12,
      width * 0.18,
    );

  for (
    const side of [-1, 1]
  ) {
    const head =
      roundedBox(
        [
          0.05,
          Math.max(
            0.08,
            height * 0.1,
          ),
          lightWidth,
        ],
        materials.light,
        0.025,
      );

    head.position.set(
      length / 2 + 0.015,
      height * 0.42,
      side *
        width *
        0.28,
    );

    group.add(head);

    const tail =
      roundedBox(
        [
          0.05,
          Math.max(
            0.08,
            height * 0.1,
          ),
          lightWidth,
        ],
        materials.tail,
        0.025,
      );

    tail.position.set(
      -length / 2 - 0.015,
      height * 0.42,
      side *
        width *
        0.28,
    );

    group.add(tail);
  }
}

function passengerVehicle(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const asset =
    getParticipantAssetDefinition(participant);

  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const length =
    dimensions.lengthMetres;

  const width =
    dimensions.widthMetres;

  const height =
    dimensions.heightMetres;

  const segments =
    segmentsForLod(lod);

  const suv =
    asset.id ===
    "car-suv-generic";

  const hatchback =
    asset.id ===
    "car-hatchback-generic";

  const pickup =
    asset.id ===
    "car-pickup-generic";

  const lower =
    roundedBox(
      [
        length * 0.94,
        height * 0.34,
        width * 0.96,
      ],
      materials.body,
      Math.min(
        0.18,
        height * 0.13,
      ),
    );

  lower.position.y =
    height * 0.31;

  group.add(lower);

  const hood =
    roundedBox(
      [
        length *
          (
            pickup
              ? 0.2
              : hatchback
                ? 0.19
                : 0.23
          ),
        height * 0.18,
        width * 0.88,
      ],
      materials.body,
      0.1,
    );

  hood.position.set(
    length * 0.35,
    height * 0.53,
    0,
  );

  group.add(hood);

  const cabinLength =
    length *
    (
      pickup
        ? 0.37
        : hatchback
          ? 0.55
          : suv
            ? 0.52
            : 0.48
    );

  const cabin =
    roundedBox(
      [
        cabinLength,
        height *
          (
            suv
              ? 0.45
              : pickup
                ? 0.42
                : 0.4
          ),
        width * 0.82,
      ],
      materials.glass,
      Math.min(
        0.16,
        height * 0.11,
      ),
    );

  cabin.position.set(
    pickup
      ? length * 0.08
      : -length * 0.03,
    height *
      (
        suv
          ? 0.69
          : 0.67
      ),
    0,
  );

  group.add(cabin);

  if (pickup) {
    const bedFloor =
      roundedBox(
        [
          length * 0.3,
          height * 0.13,
          width * 0.84,
        ],
        materials.bodyDark,
        0.06,
      );

    bedFloor.position.set(
      -length * 0.32,
      height * 0.45,
      0,
    );

    group.add(bedFloor);

    for (
      const side of [-1, 1]
    ) {
      const rail =
        roundedBox(
          [
            length * 0.31,
            height * 0.22,
            width * 0.055,
          ],
          materials.body,
          0.035,
        );

      rail.position.set(
        -length * 0.32,
        height * 0.55,
        side *
          width *
          0.42,
      );

      group.add(rail);
    }
  } else if (
    !hatchback
  ) {
    const boot =
      roundedBox(
        [
          length * 0.19,
          height * 0.16,
          width * 0.86,
        ],
        materials.body,
        0.08,
      );

    boot.position.set(
      -length * 0.38,
      height * 0.5,
      0,
    );

    group.add(boot);
  }

  if (lod !== "Low") {
    for (
      const side of [-1, 1]
    ) {
      const mirror =
        roundedBox(
          [
            length * 0.055,
            height * 0.065,
            width * 0.06,
          ],
          materials.body,
          0.03,
        );

      mirror.position.set(
        length * 0.12,
        height * 0.67,
        side *
          width *
          0.51,
      );

      group.add(mirror);
    }
  }

  addVehicleWheels(
    group,
    {
      length,
      width,
      height,
      wheelbase:
        asset.wheelbaseMetres ??
        length * 0.58,
      wheelRadius:
        asset.wheelRadiusMetres ??
        height * 0.2,
      materials,
      segments,
    },
  );

  addVehicleLights(
    group,
    length,
    width,
    height,
    materials,
  );

  return group;
}

function busModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const asset =
    getParticipantAssetDefinition(participant);

  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const {
    lengthMetres: length,
    widthMetres: width,
    heightMetres: height,
  } = dimensions;

  const body =
    roundedBox(
      [
        length * 0.96,
        height * 0.72,
        width * 0.96,
      ],
      materials.body,
      Math.min(
        0.17,
        width * 0.08,
      ),
    );

  body.position.y =
    height * 0.46;

  group.add(body);

  const windscreen =
    roundedBox(
      [
        length * 0.045,
        height * 0.34,
        width * 0.76,
      ],
      materials.glass,
      0.05,
    );

  windscreen.position.set(
    length * 0.47,
    height * 0.68,
    0,
  );

  group.add(windscreen);

  if (lod !== "Low") {
    const windows =
      asset.id ===
      "bus-city-generic"
        ? 7
        : 4;

    for (
      let index = 0;
      index < windows;
      index += 1
    ) {
      const x =
        -length * 0.32 +
        (
          index /
          Math.max(
            1,
            windows - 1,
          )
        ) *
        length *
        0.6;

      for (
        const side of [-1, 1]
      ) {
        const window =
          roundedBox(
            [
              length /
                windows *
                0.55,
              height * 0.24,
              width * 0.025,
            ],
            materials.glass,
            0.025,
          );

        window.position.set(
          x,
          height * 0.68,
          side *
            width *
            0.485,
        );

        group.add(window);
      }
    }
  }

  addVehicleWheels(
    group,
    {
      length,
      width,
      height,
      wheelbase:
        asset.wheelbaseMetres ??
        length * 0.55,
      wheelRadius:
        asset.wheelRadiusMetres ??
        height * 0.14,
      materials,
      segments:
        segmentsForLod(lod),
      axleCount:
        asset.id ===
        "bus-city-generic"
          ? 3
          : 2,
    },
  );

  addVehicleLights(
    group,
    length,
    width,
    height,
    materials,
  );

  return group;
}

function rigidTruckModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const asset =
    getParticipantAssetDefinition(participant);

  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const {
    lengthMetres: length,
    widthMetres: width,
    heightMetres: height,
  } = dimensions;

  const cargo =
    roundedBox(
      [
        length * 0.62,
        height * 0.62,
        width * 0.94,
      ],
      materials.bodyDark,
      0.07,
    );

  cargo.position.set(
    -length * 0.17,
    height * 0.55,
    0,
  );

  group.add(cargo);

  const cab =
    roundedBox(
      [
        length * 0.28,
        height * 0.5,
        width * 0.92,
      ],
      materials.body,
      0.14,
    );

  cab.position.set(
    length * 0.34,
    height * 0.48,
    0,
  );

  group.add(cab);

  const glass =
    roundedBox(
      [
        length * 0.045,
        height * 0.24,
        width * 0.72,
      ],
      materials.glass,
      0.04,
    );

  glass.position.set(
    length * 0.485,
    height * 0.62,
    0,
  );

  group.add(glass);

  addVehicleWheels(
    group,
    {
      length,
      width,
      height,
      wheelbase:
        asset.wheelbaseMetres ??
        length * 0.56,
      wheelRadius:
        asset.wheelRadiusMetres ??
        height * 0.15,
      materials,
      segments:
        segmentsForLod(lod),
      rearDouble: true,
      axleCount: 3,
    },
  );

  addVehicleLights(
    group,
    length,
    width,
    height,
    materials,
  );

  return group;
}

function articulatedTruckModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const {
    lengthMetres: length,
    widthMetres: width,
    heightMetres: height,
  } = dimensions;

  const tractorLength =
    length * 0.27;

  const trailerLength =
    length * 0.67;

  const tractor =
    roundedBox(
      [
        tractorLength,
        height * 0.5,
        width * 0.92,
      ],
      materials.body,
      0.14,
    );

  tractor.position.set(
    length / 2 -
      tractorLength / 2,
    height * 0.47,
    0,
  );

  group.add(tractor);

  const windscreen =
    roundedBox(
      [
        length * 0.035,
        height * 0.22,
        width * 0.7,
      ],
      materials.glass,
      0.04,
    );

  windscreen.position.set(
    length * 0.49,
    height * 0.61,
    0,
  );

  group.add(windscreen);

  const trailer =
    roundedBox(
      [
        trailerLength,
        height * 0.69,
        width * 0.95,
      ],
      materials.bodyDark,
      0.06,
    );

  trailer.position.set(
    -length / 2 +
      trailerLength / 2,
    height * 0.59,
    0,
  );

  group.add(trailer);

  const fifthWheel =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        width * 0.16,
        width * 0.16,
        0.08,
        18,
      ),
      materials.metal,
    );

  fifthWheel.position.set(
    length * 0.18,
    height * 0.35,
    0,
  );

  group.add(fifthWheel);

  addVehicleWheels(
    group,
    {
      length,
      width,
      height,
      wheelbase:
        length * 0.68,
      wheelRadius:
        Math.max(
          0.45,
          height * 0.13,
        ),
      materials,
      segments:
        segmentsForLod(lod),
      rearDouble: true,
      axleCount: 3,
    },
  );

  addVehicleLights(
    group,
    length,
    width,
    height,
    materials,
  );

  return group;
}

function tractorModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const {
    lengthMetres: length,
    widthMetres: width,
    heightMetres: height,
  } = dimensions;

  const engine =
    roundedBox(
      [
        length * 0.45,
        height * 0.25,
        width * 0.55,
      ],
      materials.body,
      0.08,
    );

  engine.position.set(
    length * 0.18,
    height * 0.48,
    0,
  );

  group.add(engine);

  const cab =
    roundedBox(
      [
        length * 0.25,
        height * 0.42,
        width * 0.58,
      ],
      materials.glass,
      0.08,
    );

  cab.position.set(
    -length * 0.12,
    height * 0.72,
    0,
  );

  group.add(cab);

  const rearRadius =
    Math.min(
      height * 0.28,
      0.82,
    );

  const frontRadius =
    rearRadius * 0.62;

  for (
    const side of [-1, 1]
  ) {
    const rear =
      wheel(
        rearRadius,
        width * 0.14,
        materials,
        segmentsForLod(lod),
      );

    rear.position.set(
      -length * 0.22,
      rearRadius,
      side *
        width *
        0.42,
    );

    group.add(rear);

    const front =
      wheel(
        frontRadius,
        width * 0.11,
        materials,
        segmentsForLod(lod),
      );

    front.position.set(
      length * 0.31,
      frontRadius,
      side *
        width *
        0.38,
    );

    group.add(front);
  }

  return group;
}

function twoWheelerModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const {
    lengthMetres: length,
    widthMetres: width,
    heightMetres: height,
  } = dimensions;

  const motorcycle =
    participant.type ===
    "Motorcycle";

  const segments =
    segmentsForLod(lod);

  const radius =
    motorcycle
      ? Math.min(
          0.34,
          height * 0.26,
        )
      : Math.min(
          0.35,
          height * 0.3,
        );

  const rearX =
    -length * 0.34;

  const frontX =
    length * 0.34;

  for (
    const x of [rearX, frontX]
  ) {
    const tyre =
      new THREE.Mesh(
        new THREE.TorusGeometry(
          radius,
          motorcycle
            ? 0.055
            : 0.035,
          Math.max(
            8,
            segments - 4,
          ),
          segments,
        ),
        materials.rubber,
      );

    tyre.rotation.y =
      Math.PI / 2;

    tyre.position.set(
      x,
      radius,
      0,
    );

    tyre.castShadow = true;

    group.add(tyre);
  }

  const framePoints =
    motorcycle
      ? [
          [
            new THREE.Vector3(
              rearX,
              radius,
              0,
            ),
            new THREE.Vector3(
              -length * 0.02,
              height * 0.53,
              0,
            ),
          ],
          [
            new THREE.Vector3(
              -length * 0.02,
              height * 0.53,
              0,
            ),
            new THREE.Vector3(
              frontX,
              radius,
              0,
            ),
          ],
        ]
      : [
          [
            new THREE.Vector3(
              rearX,
              radius,
              0,
            ),
            new THREE.Vector3(
              -length * 0.04,
              height * 0.62,
              0,
            ),
          ],
          [
            new THREE.Vector3(
              -length * 0.04,
              height * 0.62,
              0,
            ),
            new THREE.Vector3(
              length * 0.06,
              radius,
              0,
            ),
          ],
          [
            new THREE.Vector3(
              length * 0.06,
              radius,
              0,
            ),
            new THREE.Vector3(
              rearX,
              radius,
              0,
            ),
          ],
          [
            new THREE.Vector3(
              -length * 0.04,
              height * 0.62,
              0,
            ),
            new THREE.Vector3(
              length * 0.23,
              height * 0.62,
              0,
            ),
          ],
          [
            new THREE.Vector3(
              length * 0.23,
              height * 0.62,
              0,
            ),
            new THREE.Vector3(
              frontX,
              radius,
              0,
            ),
          ],
        ];

  framePoints.forEach(
    ([start, end]) => {
      group.add(
        cylinderBetween(
          start,
          end,
          motorcycle
            ? 0.055
            : 0.026,
          materials.body,
          segments,
        ),
      );
    },
  );

  if (motorcycle) {
    const tank =
      roundedBox(
        [
          length * 0.3,
          height * 0.17,
          width * 0.46,
        ],
        materials.body,
        0.07,
      );

    tank.position.set(
      length * 0.03,
      height * 0.56,
      0,
    );

    group.add(tank);

    const seat =
      roundedBox(
        [
          length * 0.26,
          height * 0.08,
          width * 0.35,
        ],
        materials.rubber,
        0.04,
      );

    seat.position.set(
      -length * 0.16,
      height * 0.66,
      0,
    );

    group.add(seat);
  }

  const handle =
    cylinderBetween(
      new THREE.Vector3(
        length * 0.27,
        height * 0.67,
        -width * 0.34,
      ),
      new THREE.Vector3(
        length * 0.27,
        height * 0.67,
        width * 0.34,
      ),
      motorcycle
        ? 0.028
        : 0.018,
      materials.metal,
      segments,
    );

  group.add(handle);

  return group;
}

function humanModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod,
): THREE.Group {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const materials =
    createMaterials(participant);

  const group =
    new THREE.Group();

  const {
    widthMetres: width,
    heightMetres: height,
  } = dimensions;

  const segments =
    segmentsForLod(lod);

  const headRadius =
    Math.max(
      0.12,
      Math.min(
        0.19,
        height * 0.105,
      ),
    );

  const torsoHeight =
    height * 0.38;

  const torsoRadius =
    Math.max(
      0.11,
      width * 0.24,
    );

  const torso =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        torsoRadius,
        Math.max(
          0.12,
          torsoHeight -
            torsoRadius * 2,
        ),
        Math.max(
          4,
          Math.round(
            segments / 3,
          ),
        ),
        segments,
      ),
      materials.clothing,
    );

  torso.position.y =
    height * 0.57;

  torso.castShadow = true;

  group.add(torso);

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        headRadius,
        segments,
        Math.max(
          8,
          Math.round(
            segments * 0.7,
          ),
        ),
      ),
      materials.skin,
    );

  head.position.y =
    height - headRadius;

  head.castShadow = true;

  group.add(head);

  const shoulderY =
    height * 0.69;

  const hipY =
    height * 0.39;

  const armLength =
    height * 0.27;

  const limbRadius =
    Math.max(
      0.035,
      width * 0.075,
    );

  for (
    const side of [-1, 1]
  ) {
    const shoulder =
      new THREE.Vector3(
        0,
        shoulderY,
        side *
          width *
          0.22,
      );

    const hand =
      new THREE.Vector3(
        height * 0.015,
        shoulderY -
          armLength,
        side *
          width *
          0.34,
      );

    group.add(
      cylinderBetween(
        shoulder,
        hand,
        limbRadius,
        materials.skin,
        segments,
      ),
    );

    const hip =
      new THREE.Vector3(
        -height * 0.015,
        hipY,
        side *
          width *
          0.12,
      );

    const foot =
      new THREE.Vector3(
        side * height * 0.02,
        0.06,
        side *
          width *
          0.16,
      );

    group.add(
      cylinderBetween(
        hip,
        foot,
        limbRadius * 1.12,
        materials.bodyDark,
        segments,
      ),
    );
  }

  if (
    participant.type ===
    "Officer"
  ) {
    const vest =
      roundedBox(
        [
          width * 0.2,
          height * 0.22,
          width * 0.54,
        ],
        new THREE.MeshStandardMaterial({
          color: 0xc8c0a0,
          roughness: 0.72,
        }),
        0.04,
      );

    vest.position.y =
      height * 0.63;

    group.add(vest);

    const cap =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          headRadius * 0.95,
          headRadius * 1.02,
          headRadius * 0.36,
          segments,
        ),
        materials.bodyDark,
      );

    cap.position.y =
      height -
      headRadius * 0.12;

    group.add(cap);
  }

  return group;
}

export function createGenericParticipant3DModel(
  participant: ReconstructionVehicle,
  lod: ParticipantAssetLod = "Medium",
): THREE.Group {
  const asset =
    getParticipantAssetDefinition(participant);

  let model: THREE.Group;

  if (asset.family === "Human") {
    model =
      humanModel(
        participant,
        lod,
      );
  } else if (
    asset.family ===
    "Two Wheeler"
  ) {
    model =
      twoWheelerModel(
        participant,
        lod,
      );
  } else if (
    asset.id ===
    "truck-articulated-generic"
  ) {
    model =
      articulatedTruckModel(
        participant,
        lod,
      );
  } else if (
    asset.id ===
    "truck-tractor-generic"
  ) {
    model =
      tractorModel(
        participant,
        lod,
      );
  } else if (
    asset.family === "Truck"
  ) {
    model =
      rigidTruckModel(
        participant,
        lod,
      );
  } else if (
    asset.family === "Bus"
  ) {
    model =
      busModel(
        participant,
        lod,
      );
  } else {
    model =
      passengerVehicle(
        participant,
        lod,
      );
  }

  model.name =
    `RoadSafe_${asset.id}`;

  model.userData.roadSafeAssetId =
    asset.id;

  model.userData.roadSafeAssetLabel =
    asset.label;

  model.userData.roadSafeAssetFamily =
    asset.family;

  model.userData.roadSafeLod =
    lod;

  model.userData.roadSafeDimensions =
    getParticipantPhysicalDimensions(
      participant,
    );

  model.traverse(
    (object) => {
      object.userData.roadSafeAssetId =
        asset.id;
    },
  );

  return model;
}
