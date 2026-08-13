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
  4;

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
        -2,
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
      ),
  );

world.createCollider(
  RAPIER
    .ColliderDesc
    .cuboid(
      0.4,
      0.4,
      0.4,
    )
    .setMass(
      1200,
    )
    .setRestitution(
      0.1,
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
    .cuboid(
      0.4,
      0.6,
      0.6,
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
  `[RoadSafe] Verification collision starts: ${collisionStarts}.`,
);

console.log(
  `[RoadSafe] Moving body final x: ${finalPosition.x.toFixed(4)}.`,
);
