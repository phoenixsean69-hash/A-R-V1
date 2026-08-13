import RAPIER from "@dimforge/rapier3d-deterministic-compat";

const VERSION =
  "0.19.3";

await RAPIER.init();

const world =
  new RAPIER.World({
    x: 0,
    y: 0,
    z: 0,
  });

world.timestep =
  1 / 120;

world.maxCcdSubsteps =
  8;

const events =
  new RAPIER.EventQueue(
    true,
  );

const movingBody =
  world.createRigidBody(
    RAPIER
      .RigidBodyDesc
      .dynamic()
      .setTranslation(
        -5,
        0,
        0,
      )
      .setLinvel(
        12,
        0,
        0,
      )
      .setCcdEnabled(
        true,
      )
      .setAdditionalSolverIterations(
        4,
      ),
  );

world.createCollider(
  RAPIER
    .ColliderDesc
    .roundCuboid(
      1.95,
      0.48,
      0.82,
      0.08,
    )
    .setMass(
      1200,
    )
    .setRestitution(
      0.05,
    )
    .setContactSkin(
      0.015,
    )
    .setRestitutionCombineRule(
      RAPIER
        .CoefficientCombineRule
        .Min,
    )
    .setFriction(
      0.7,
    )
    .setActiveEvents(
      RAPIER
        .ActiveEvents
        .COLLISION_EVENTS,
    ),
  movingBody,
);

const obstacleBody =
  world.createRigidBody(
    RAPIER
      .RigidBodyDesc
      .fixed()
      .setTranslation(
        0,
        0,
        0,
      ),
  );

world.createCollider(
  RAPIER
    .ColliderDesc
    .roundCuboid(
      1.95,
      0.48,
      0.82,
      0.08,
    )
    .setActiveEvents(
      RAPIER
        .ActiveEvents
        .COLLISION_EVENTS,
    ),
  obstacleBody,
);

let collisionStarts =
  0;

for (
  let index = 0;
  index < 120;
  index += 1
) {
  world.step(
    events,
  );

  events.drainCollisionEvents(
    (
      _first,
      _second,
      started,
    ) => {
      if (started) {
        collisionStarts +=
          1;
      }
    },
  );

  if (
    collisionStarts >
    0
  ) {
    break;
  }
}

const finalPosition =
  movingBody.translation();

events.free();
world.free();

if (
  collisionStarts <
  1
) {
  throw new Error(
    "Rapier verification failed: CCD rigid body did not report the expected collision.",
  );
}

console.log(
  `[RoadSafe] Rapier 3D deterministic compat ${VERSION} initialized successfully.`,
);

console.log(
  `[RoadSafe] Verification rounded-body collision starts: ${collisionStarts}.`,
);

console.log(
  `[RoadSafe] Moving body final x: ${finalPosition.x.toFixed(4)}.`,
);
