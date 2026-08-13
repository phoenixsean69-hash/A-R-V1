import RAPIER from "@dimforge/rapier3d-deterministic-compat";

await RAPIER.init();

const world = new RAPIER.World({
  x: 0,
  y: -9.81,
  z: 0,
});

world.timestep = 1 / 120;
world.maxCcdSubsteps = 8;

const events = new RAPIER.EventQueue(true);

const groundBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.fixed().setTranslation(4, -0.1, 0),
);

world.createCollider(
  RAPIER.ColliderDesc.cuboid(8, 0.1, 4)
    .setFriction(0.8)
    .setRestitution(0),
  groundBody,
);

const participantBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 0.55, 0)
    .setLinvel(8, 0, 0)
    .enabledRotations(false, true, false)
    .setCcdEnabled(true)
    .setCanSleep(false),
);

const participantCollider = world.createCollider(
  RAPIER.ColliderDesc.roundCuboid(0.92, 0.38, 0.48, 0.06)
    .setMass(1450)
    .setFriction(0.65)
    .setRestitution(0.03)
    .setActiveEvents(
      RAPIER.ActiveEvents.COLLISION_EVENTS |
      RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
    )
    .setContactForceEventThreshold(1),
  participantBody,
);

const debrisBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(2.4, 0.22, 0)
    .setLinearDamping(0.3)
    .setAngularDamping(0.5)
    .setCcdEnabled(true)
    .setCanSleep(false),
);

const debrisCollider = world.createCollider(
  RAPIER.ColliderDesc.roundCuboid(0.28, 0.16, 0.22, 0.03)
    .setMass(9)
    .setFriction(0.48)
    .setRestitution(0.04)
    .setActiveEvents(
      RAPIER.ActiveEvents.COLLISION_EVENTS |
      RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
    )
    .setContactForceEventThreshold(1),
  debrisBody,
);

// Exercise the exact angular-velocity API used by the surface-slip layer.
participantBody.setAngvel({ x: 0, y: 0.02, z: 0 }, true);

let collisionStarts = 0;
let maximumForce = 0;

for (let step = 0; step < 180; step += 1) {
  world.step(events);

  events.drainCollisionEvents((first, second, started) => {
    if (!started) return;

    const isPair =
      (first === participantCollider.handle && second === debrisCollider.handle) ||
      (second === participantCollider.handle && first === debrisCollider.handle);

    if (isPair) collisionStarts += 1;
  });

  events.drainContactForceEvents((event) => {
    const first = event.collider1();
    const second = event.collider2();

    const isPair =
      (first === participantCollider.handle && second === debrisCollider.handle) ||
      (second === participantCollider.handle && first === debrisCollider.handle);

    if (!isPair) return;

    maximumForce = Math.max(
      maximumForce,
      event.totalForceMagnitude(),
    );
  });
}

const debrisFinal = debrisBody.translation();
const participantFinal = participantBody.translation();
const debrisTravel = debrisFinal.x - 2.4;

if (collisionStarts < 1) {
  throw new Error("Dynamic Road Hazard verifier did not detect participant/debris contact.");
}

if (debrisTravel < 0.2) {
  throw new Error(
    `Dynamic Road Hazard verifier expected debris displacement > 0.2 m; got ${debrisTravel.toFixed(4)} m.`,
  );
}

if (!(maximumForce > 0)) {
  throw new Error("Dynamic Road Hazard verifier did not receive a contact-force event.");
}

console.log(`[RoadSafe] Dynamic debris collision starts: ${collisionStarts}.`);
console.log(`[RoadSafe] Debris displacement: ${debrisTravel.toFixed(4)} m.`);
console.log(`[RoadSafe] Participant final x: ${participantFinal.x.toFixed(4)} m.`);
console.log(`[RoadSafe] Maximum contact force: ${maximumForce.toFixed(2)} N.`);
console.log("[RoadSafe] Road Hazard dynamic-body runtime verification passed.");
