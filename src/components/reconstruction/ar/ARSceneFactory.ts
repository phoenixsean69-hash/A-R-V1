import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import {
  disposeObjectTree,
  loadRealisticParticipantModel,
  loadRealisticSceneObjectModel,
} from "../../../services/realisticSceneAssetService";
import {
  usesGeneratedRoad,
  type AccidentReconstruction,
  type ReconstructionPosition,
  type ReconstructionSceneObject,
  type ReconstructionVehicle,
} from "../../../types/reconstruction";
import {
  getParticipantStateAtTime,
  isPhysicsGeneratedPathPoint,
  sortMovementPathPoints,
} from "../../../utils/reconstructionGeometry";
import { addRealSceneGeometryToThreeScene } from "../../../utils/realSceneThreeGeometry";
import { getParticipantPotholeEffect } from "../../../utils/reconstructionSurfaceEffects";
import { getReconstructionWorldDimensions } from "../../../utils/reconstructionWorldScale";

interface ParticipantEntry {
  participant: ReconstructionVehicle;
  holder: THREE.Group;
  modelRoot: THREE.Group;
}

export interface ARLayerVisibility {
  paths: boolean;
  objects: boolean;
  evidence: boolean;
  collisionPoint: boolean;
  roadGuide: boolean;
  physicsEffects: boolean;
}

export interface ARAssetProgress {
  loaded: number;
  total: number;
  failed: number;
}

export interface ARSceneRuntime {
  root: THREE.Group;
  update(
    timeSeconds: number,
    physicsEffects: boolean,
  ): void;
  setLayers(
    layers: ARLayerVisibility,
  ): void;
  dispose(): void;
}

interface CreateARSceneOptions {
  reconstruction: AccidentReconstruction;
  onAssetProgress?: (
    progress: ARAssetProgress,
  ) => void;
}

const PARTICIPANT_COLOURS: Record<string, number> = {
  Blue: 0x2563eb,
  Red: 0xdc2626,
  Green: 0x16a34a,
  Yellow: 0xeab308,
  Black: 0x111827,
  White: 0xf8fafc,
  Orange: 0xea580c,
  Purple: 0x9333ea,
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function worldPosition(
  position: ReconstructionPosition,
  width: number,
  height: number,
  y = 0,
): THREE.Vector3 {
  return new THREE.Vector3(
    (position.x / 100 - 0.5) *
      width,
    y,
    (0.5 - position.y / 100) *
      height,
  );
}

function participantDimensions(
  participant: ReconstructionVehicle,
): [number, number, number] {
  const fallback = (() => {
    switch (participant.type) {
      case "Bus":
        return [
          11.8,
          3.2,
          2.55,
        ] as const;
      case "Truck":
        return [
          8.4,
          3.4,
          2.5,
        ] as const;
      case "Motorcycle":
        return [
          2.2,
          1.25,
          0.82,
        ] as const;
      case "Bicycle":
        return [
          1.85,
          1.2,
          0.64,
        ] as const;
      case "Pedestrian":
      case "Officer":
      case "Witness":
        return [
          0.76,
          1.75,
          0.76,
        ] as const;
      default:
        return [
          4.5,
          1.55,
          1.82,
        ] as const;
    }
  })();

  return [
    Math.max(
      0.2,
      participant.physics
        ?.lengthMetres ??
        fallback[0],
    ),
    fallback[1],
    Math.max(
      0.2,
      participant.physics
        ?.widthMetres ??
        fallback[2],
    ),
  ];
}

function roundedBox(
  size: [number, number, number],
  colour: number,
  radius = 0.08,
): THREE.Mesh {
  const geometry =
    new RoundedBoxGeometry(
      size[0],
      size[1],
      size[2],
      3,
      Math.min(
        radius,
        Math.min(...size) * 0.42,
      ),
    );

  const material =
    new THREE.MeshPhysicalMaterial({
      color: colour,
      roughness: 0.42,
      metalness: 0.12,
      clearcoat: 0.25,
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function createFallbackParticipantModel(
  participant: ReconstructionVehicle,
): THREE.Group {
  const group =
    new THREE.Group();

  const [
    length,
    height,
    width,
  ] =
    participantDimensions(
      participant,
    );

  const colour =
    PARTICIPANT_COLOURS[
      participant.colour
    ] ??
    0x2563eb;

  const human = [
    "Pedestrian",
    "Officer",
    "Witness",
  ].includes(
    participant.type,
  );

  if (human) {
    const body =
      new THREE.Mesh(
        new THREE.CapsuleGeometry(
          0.22,
          0.8,
          6,
          12,
        ),
        new THREE.MeshStandardMaterial({
          color: colour,
          roughness: 0.75,
        }),
      );

    body.position.y = 0.9;
    body.castShadow = true;

    const head =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.21,
          18,
          14,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xb97850,
          roughness: 0.8,
        }),
      );

    head.position.y = 1.65;
    head.castShadow = true;

    group.add(
      body,
      head,
    );

    return group;
  }

  if (
    participant.type ===
      "Bicycle" ||
    participant.type ===
      "Motorcycle"
  ) {
    const wheelMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x111317,
        roughness: 0.95,
      });

    for (
      const x
      of [
        -length * 0.32,
        length * 0.32,
      ]
    ) {
      const wheel =
        new THREE.Mesh(
          new THREE.TorusGeometry(
            height * 0.28,
            0.07,
            10,
            24,
          ),
          wheelMaterial,
        );

      wheel.rotation.y =
        Math.PI / 2;

      wheel.position.set(
        x,
        height * 0.3,
        0,
      );

      wheel.castShadow = true;
      group.add(wheel);
    }

    const frame =
      roundedBox(
        [
          length * 0.62,
          height * 0.16,
          width * 0.5,
        ],
        colour,
        0.05,
      );

    frame.position.y =
      height * 0.55;

    group.add(frame);
    return group;
  }

  const lower =
    roundedBox(
      [
        length,
        height * 0.46,
        width,
      ],
      colour,
      0.16,
    );

  lower.position.y =
    height * 0.35;

  const cabin =
    roundedBox(
      [
        length * 0.5,
        height * 0.42,
        width * 0.82,
      ],
      0x7393aa,
      0.14,
    );

  cabin.position.set(
    -length * 0.04,
    height * 0.78,
    0,
  );

  group.add(
    lower,
    cabin,
  );

  const wheelMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x0d1014,
      roughness: 0.96,
    });

  for (
    const x
    of [
      -length * 0.31,
      length * 0.31,
    ]
  ) {
    for (
      const z
      of [
        -width * 0.51,
        width * 0.51,
      ]
    ) {
      const wheel =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            height * 0.18,
            height * 0.18,
            0.22,
            20,
          ),
          wheelMaterial,
        );

      wheel.rotation.x =
        Math.PI / 2;

      wheel.position.set(
        x,
        height * 0.2,
        z,
      );

      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  return group;
}

function createFallbackSceneObject(
  object: ReconstructionSceneObject,
): THREE.Object3D {
  const scale =
    Math.max(
      0.25,
      object.scale,
    );

  if (
    object.type === "Pothole"
  ) {
    const radius =
      Math.max(
        0.35,
        (
          object.widthMetres ??
          scale * 1.8
        ) / 2,
      );

    const group =
      new THREE.Group();

    const hole =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          radius,
          32,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x14181d,
          roughness: 1,
        }),
      );

    hole.rotation.x =
      -Math.PI / 2;

    hole.position.y = 0.015;

    const rim =
      new THREE.Mesh(
        new THREE.TorusGeometry(
          radius * 0.82,
          radius * 0.14,
          10,
          32,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x3f4244,
          roughness: 1,
        }),
      );

    rim.rotation.x =
      Math.PI / 2;

    rim.position.y = 0.035;

    group.add(
      hole,
      rim,
    );

    return group;
  }

  if (
    [
      "Puddle",
      "Oil Spill",
      "Loose Gravel",
    ].includes(
      object.type,
    )
  ) {
    const patch =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          Math.max(
            0.55,
            scale,
          ),
          30,
        ),
        new THREE.MeshPhysicalMaterial({
          color:
            object.type ===
            "Oil Spill"
              ? 0x11131b
              : 0x506d7a,
          roughness:
            object.type ===
            "Oil Spill"
              ? 0.1
              : 0.7,
          transparent: true,
          opacity: 0.72,
        }),
      );

    patch.rotation.x =
      -Math.PI / 2;

    patch.position.y = 0.025;

    return patch;
  }

  const dimensions:
    [number, number, number] =
    object.type ===
      "Road Barrier" ||
    object.type ===
      "Guardrail"
      ? [
          Math.max(
            2,
            object.lengthMetres ??
            4,
          ) * scale,
          1,
          0.25,
        ]
      : object.type ===
          "Wall" ||
        object.type ===
          "Fence"
        ? [
            Math.max(
              2,
              object.lengthMetres ??
              4,
            ) * scale,
            1.8,
            0.25,
          ]
        : object.type ===
            "Tree"
          ? [
              1.1 * scale,
              5 * scale,
              1.1 * scale,
            ]
          : [
              1.2 * scale,
              1.2 * scale,
              1.2 * scale,
            ];

  const mesh =
    roundedBox(
      dimensions,
      0x6b7280,
      0.05,
    );

  mesh.position.y =
    dimensions[1] / 2;

  return mesh;
}

function makeGuideMaterial(
  colour: number,
  opacity: number,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colour,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 0.9,
  });
}

function makeTransparentGuide(
  object: THREE.Object3D,
): void {
  object.traverse(
    (child) => {
      if (
        !(
          child instanceof
          THREE.Mesh
        )
      ) {
        return;
      }

      const materials =
        Array.isArray(
          child.material,
        )
          ? child.material
          : [
              child.material,
            ];

      child.material =
        materials.map(
          (material) => {
            const clone =
              material.clone() as THREE.Material & {
                opacity?: number;
                transparent?: boolean;
                depthWrite?: boolean;
              };

            clone.opacity = 0.18;
            clone.transparent = true;
            clone.depthWrite = false;
            clone.needsUpdate = true;

            return clone;
          },
        );
    },
  );
}

function createRoadGuide(
  reconstruction: AccidentReconstruction,
  width: number,
  height: number,
): THREE.Group {
  const group =
    new THREE.Group();

  const extracted =
    reconstruction.scene
      .realSceneGeometry
      ?.status === "ready"
      ? reconstruction.scene
          .realSceneGeometry
      : null;

  if (extracted) {
    const temporaryScene =
      new THREE.Scene();

    addRealSceneGeometryToThreeScene({
      scene:
        temporaryScene,
      geometry:
        extracted,
      showPavements:
        reconstruction.scene
          .showPavements,
      showLaneMarkings:
        reconstruction.scene
          .showLaneMarkings,
      wet:
        reconstruction.scene
          .roadSurface ===
        "Wet",
    });

    const children = [
      ...temporaryScene.children,
    ];

    for (
      const child
      of children
    ) {
      temporaryScene.remove(
        child,
      );

      makeTransparentGuide(
        child,
      );

      group.add(child);
    }

    return group;
  }

  if (
    !usesGeneratedRoad(
      reconstruction.scene,
    )
  ) {
    return group;
  }

  const roadWidth =
    Math.min(
      18,
      6.2 +
        reconstruction.scene
          .laneCount *
          3.15,
    );

  const material =
    makeGuideMaterial(
      reconstruction.scene
        .roadSurface === "Wet"
        ? 0x3b5f6e
        : 0x4a515a,
      0.18,
    );

  const addStrip = (
    horizontal: boolean,
  ) => {
    const road =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          horizontal
            ? width
            : roadWidth,
          horizontal
            ? roadWidth
            : height,
        ),
        material.clone(),
      );

    road.rotation.x =
      -Math.PI / 2;

    road.position.y = 0.015;
    group.add(road);
  };

  addStrip(true);

  if (
    ![
      "Straight Road",
      "Pedestrian Crossing",
    ].includes(
      reconstruction.scene
        .roadLayout,
    )
  ) {
    addStrip(false);
  }

  group.rotation.y =
    -THREE.MathUtils.degToRad(
      reconstruction.scene
        .roadRotation,
    );

  return group;
}

function applyImpactPose(
  entry: ParticipantEntry,
  currentTime: number,
  impactTime: number | undefined,
  speedKmh: number,
  enabled: boolean,
): void {
  const root =
    entry.modelRoot;

  root.position.set(
    0,
    0,
    0,
  );

  root.rotation.set(
    0,
    0,
    0,
  );

  root.scale.set(
    1,
    1,
    1,
  );

  if (
    !enabled ||
    impactTime === undefined ||
    currentTime < impactTime
  ) {
    return;
  }

  const elapsed =
    currentTime -
    impactTime;

  const severity =
    clamp(
      speedKmh / 70,
      0.2,
      1,
    );

  const human = [
    "Pedestrian",
    "Officer",
    "Witness",
  ].includes(
    entry.participant.type,
  );

  const twoWheeler = [
    "Bicycle",
    "Motorcycle",
  ].includes(
    entry.participant.type,
  );

  if (human) {
    const launchVelocity =
      clamp(
        3.6 +
          speedKmh / 25,
        4,
        7.2,
      );

    const flightDuration =
      (2 * launchVelocity) /
      9.81;

    if (
      elapsed <
      flightDuration
    ) {
      root.position.y =
        Math.max(
          0,
          launchVelocity *
            elapsed -
            4.905 *
              elapsed *
              elapsed,
        );

      root.rotation.x =
        elapsed *
        (
          5 +
          severity * 3
        );

      root.rotation.z =
        elapsed *
        (
          2 +
          severity * 2.5
        );
    } else {
      root.position.y = 0.12;
      root.rotation.x =
        Math.PI / 2;
      root.rotation.z = 0.2;
    }

    return;
  }

  if (twoWheeler) {
    const progress =
      THREE.MathUtils.smoothstep(
        elapsed,
        0,
        0.9,
      );

    root.rotation.x =
      progress *
      Math.PI *
      0.45;

    root.rotation.z =
      progress *
      severity *
      1.5;

    root.position.y =
      Math.abs(
        Math.sin(
          elapsed * 8,
        ),
      ) *
      Math.exp(
        -elapsed * 3,
      ) *
      0.6;

    return;
  }

  const recoil =
    Math.sin(
      elapsed * 11,
    ) *
    Math.exp(
      -elapsed * 3.1,
    );

  root.position.y =
    Math.abs(
      recoil,
    ) *
    0.24 *
    severity;

  root.rotation.z =
    recoil *
    0.14 *
    severity;

  root.rotation.x =
    -recoil *
    0.07 *
    severity;
}

export function createARReconstructionScene({
  reconstruction,
  onAssetProgress,
}: CreateARSceneOptions): ARSceneRuntime {
  const {
    widthMetres: width,
    heightMetres: height,
  } =
    getReconstructionWorldDimensions(
      reconstruction,
    );

  const root =
    new THREE.Group();

  root.name =
    "RoadSafe AR reconstruction";

  const offsetRoot =
    new THREE.Group();

  root.add(offsetRoot);

  const collisionWorld =
    worldPosition(
      reconstruction.collisionPoint,
      width,
      height,
      0,
    );

  offsetRoot.position.set(
    -collisionWorld.x,
    0,
    -collisionWorld.z,
  );

  const roadGroup =
    createRoadGuide(
      reconstruction,
      width,
      height,
    );

  const pathGroup =
    new THREE.Group();

  const objectGroup =
    new THREE.Group();

  const evidenceGroup =
    new THREE.Group();

  const collisionGroup =
    new THREE.Group();

  offsetRoot.add(
    roadGroup,
    pathGroup,
    objectGroup,
    evidenceGroup,
    collisionGroup,
  );

  const collisionMarker =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        0.9,
        0.09,
        10,
        36,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.95,
      }),
    );

  collisionMarker.rotation.x =
    Math.PI / 2;

  collisionMarker.position.copy(
    collisionWorld,
  );

  const collisionPole =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.025,
        0.025,
        1.8,
        12,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.72,
      }),
    );

  collisionPole.position.copy(
    collisionWorld,
  );

  collisionPole.position.y =
    0.9;

  collisionGroup.add(
    collisionMarker,
    collisionPole,
  );

  const participantEntries =
    new Map<
      string,
      ParticipantEntry
    >();

  const collisionEvents =
    reconstruction
      .lastPhysicsSimulation
      ?.collisionEvents ??
    [];

  const impactByParticipant =
    new Map<
      string,
      {
        time: number;
        speed: number;
      }
    >();

  for (
    const collision
    of collisionEvents
  ) {
    for (
      const participantId
      of collision.participantIds
    ) {
      const existing =
        impactByParticipant.get(
          participantId,
        );

      if (
        !existing ||
        collision.timeSeconds <
          existing.time
      ) {
        impactByParticipant.set(
          participantId,
          {
            time:
              collision.timeSeconds,
            speed:
              collision.relativeSpeedKmh,
          },
        );
      }
    }
  }

  let disposed = false;
  let loaded = 0;
  let failed = 0;

  const visibleObjects =
    reconstruction.sceneObjects.filter(
      (object) =>
        object.visible &&
        !object.tracePoints
          ?.length,
    );

  const total =
    reconstruction.vehicles
      .length +
    visibleObjects.length;

  const reportProgress = (
    failedAsset = false,
  ) => {
    if (disposed) {
      return;
    }

    loaded += 1;

    if (failedAsset) {
      failed += 1;
    }

    onAssetProgress?.({
      loaded,
      total,
      failed,
    });
  };

  onAssetProgress?.({
    loaded: 0,
    total,
    failed: 0,
  });

  for (
    const participant
    of reconstruction.vehicles
  ) {
    const holder =
      new THREE.Group();

    const modelRoot =
      new THREE.Group();

    modelRoot.add(
      createFallbackParticipantModel(
        participant,
      ),
    );

    holder.add(modelRoot);
    offsetRoot.add(holder);

    participantEntries.set(
      participant.id,
      {
        participant,
        holder,
        modelRoot,
      },
    );

    const authoredPoints =
      sortMovementPathPoints(
        participant.pathPoints,
      ).filter(
        (point) =>
          !isPhysicsGeneratedPathPoint(
            point,
          ),
      );

    const positions =
      authoredPoints.map(
        (point) =>
          worldPosition(
            point.position,
            width,
            height,
            0.12,
          ),
      );

    if (
      positions.length >
      1
    ) {
      const rendered =
        new THREE.CatmullRomCurve3(
          positions,
          false,
          "centripetal",
          0.5,
        ).getPoints(
          Math.max(
            18,
            positions.length * 8,
          ),
        );

      const line =
        new THREE.Line(
          new THREE.BufferGeometry()
            .setFromPoints(
              rendered,
            ),
          new THREE.LineBasicMaterial({
            color:
              PARTICIPANT_COLOURS[
                participant.colour
              ] ??
              0xffffff,
            transparent: true,
            opacity: 0.9,
          }),
        );

      pathGroup.add(line);
    }

    void loadRealisticParticipantModel(
      participant,
      participantDimensions(
        participant,
      ),
    )
      .then(
        (model) => {
          if (disposed) {
            disposeObjectTree(
              model,
            );
            return;
          }

          const previous = [
            ...modelRoot.children,
          ];

          for (
            const child
            of previous
          ) {
            modelRoot.remove(
              child,
            );
            disposeObjectTree(
              child,
            );
          }

          modelRoot.add(model);
          reportProgress(false);
        },
      )
      .catch(
        () => {
          reportProgress(true);
        },
      );
  }

  for (
    const object
    of reconstruction.sceneObjects.filter(
      (item) =>
        item.visible,
    )
  ) {
    if (
      object.tracePoints &&
      object.tracePoints.length >
        1
    ) {
      const line =
        new THREE.Line(
          new THREE.BufferGeometry()
            .setFromPoints(
              object.tracePoints.map(
                (point) =>
                  worldPosition(
                    point,
                    width,
                    height,
                    0.1,
                  ),
              ),
            ),
          new THREE.LineBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.78,
          }),
        );

      objectGroup.add(line);
      continue;
    }

    const holder =
      new THREE.Group();

    const fallback =
      createFallbackSceneObject(
        object,
      );

    holder.add(fallback);

    holder.position.copy(
      worldPosition(
        object.position,
        width,
        height,
      ),
    );

    holder.rotation.y =
      -THREE.MathUtils.degToRad(
        object.rotation,
      );

    objectGroup.add(holder);

    void loadRealisticSceneObjectModel(
      object,
    )
      .then(
        (model) => {
          if (!model) {
            reportProgress(false);
            return;
          }

          if (disposed) {
            disposeObjectTree(
              model,
            );
            return;
          }

          holder.remove(fallback);
          disposeObjectTree(
            fallback,
          );

          holder.add(model);
          reportProgress(false);
        },
      )
      .catch(
        () => {
          reportProgress(true);
        },
      );
  }

  for (
    const record
    of reconstruction.evidenceRecords
  ) {
    const marker =
      new THREE.Group();

    const cone =
      new THREE.Mesh(
        new THREE.ConeGeometry(
          0.25,
          0.75,
          10,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          roughness: 0.6,
        }),
      );

    cone.position.y = 0.42;

    const base =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.26,
          0.32,
          0.05,
          18,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x111827,
          roughness: 0.8,
        }),
      );

    base.position.y = 0.025;

    marker.add(
      cone,
      base,
    );

    marker.position.copy(
      worldPosition(
        record.position,
        width,
        height,
      ),
    );

    evidenceGroup.add(marker);
  }

  for (
    const measurement
    of reconstruction.measurements.filter(
      (item) =>
        item.visible,
    )
  ) {
    const line =
      new THREE.Line(
        new THREE.BufferGeometry()
          .setFromPoints([
            worldPosition(
              measurement.start,
              width,
              height,
              0.08,
            ),
            worldPosition(
              measurement.end,
              width,
              height,
              0.08,
            ),
          ]),
        new THREE.LineDashedMaterial({
          color: 0x38bdf8,
          dashSize: 0.35,
          gapSize: 0.2,
        }),
      );

    line.computeLineDistances();
    evidenceGroup.add(line);
  }

  const runtime: ARSceneRuntime = {
    root,

    update(
      timeSeconds,
      physicsEffects,
    ) {
      for (
        const entry
        of participantEntries.values()
      ) {
        const state =
          getParticipantStateAtTime(
            entry.participant,
            timeSeconds,
          );

        entry.holder.position.copy(
          worldPosition(
            state.position,
            width,
            height,
          ),
        );

        entry.holder.rotation.set(
          0,
          THREE.MathUtils.degToRad(
            state.rotation,
          ),
          0,
        );

        const impact =
          impactByParticipant.get(
            entry.participant.id,
          );

        applyImpactPose(
          entry,
          timeSeconds,
          impact?.time,
          impact?.speed ??
            entry.participant
              .estimatedSpeedKmh,
          physicsEffects,
        );

        const potholeEffect =
          getParticipantPotholeEffect(
            reconstruction,
            entry.participant,
            state.position,
            state.speedKmh,
            timeSeconds,
          );

        if (
          physicsEffects &&
          potholeEffect.active
        ) {
          entry.modelRoot.position.y +=
            potholeEffect.verticalMetres;

          entry.modelRoot.rotation.x +=
            THREE.MathUtils.degToRad(
              potholeEffect.pitchDegrees,
            );

          entry.modelRoot.rotation.z +=
            THREE.MathUtils.degToRad(
              potholeEffect.rollDegrees,
            );
        }
      }
    },

    setLayers(layers) {
      pathGroup.visible =
        layers.paths;

      objectGroup.visible =
        layers.objects;

      evidenceGroup.visible =
        layers.evidence;

      collisionGroup.visible =
        layers.collisionPoint;

      roadGroup.visible =
        layers.roadGuide;
    },

    dispose() {
      disposed = true;
      disposeObjectTree(root);
    },
  };

  return runtime;
}
