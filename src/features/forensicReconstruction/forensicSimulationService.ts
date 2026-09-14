import type {
  Collider,
  RigidBody,
} from "@dimforge/rapier3d-deterministic-compat";
import type {
  ForensicSimulationContactEvent,
  ForensicSimulationFrame,
  ForensicSimulationInput,
  ForensicSimulationParticipantInput,
  ForensicSimulationParticipantMetric,
  ForensicSimulationRun,
} from "./forensicSimulationTypes";

const STORAGE_KEY = "roadsafe-forensic-simulation-runs-v1";

const RAPIER_PACKAGE =
  "@dimforge/rapier3d-deterministic-compat";
const RAPIER_PACKAGE_VERSION = "0.19.3";
const ENGINE_PROFILE =
  "RoadSafe-Rapier-Planar-RigidBody-V2";

interface ProposedImpactRegion {
  xMetres: number;
  yMetres: number;
  radiusMetres: number;
}

interface RapierParticipantState {
  input: ForensicSimulationParticipantInput;
  body: RigidBody;
  collider: Collider;
  enteredImpactRegion: boolean;
}

interface PlanarVelocity {
  x: number;
  z: number;
}

const DEG_TO_RAD =
  0.017453292519943295769236907684886;

const CORDIC_GAIN =
  0.6072529350088812561694;

const CORDIC_ATAN = [
  0.7853981633974483,
  0.4636476090008061,
  0.24497866312686414,
  0.12435499454676144,
  0.06241880999595735,
  0.031239833430268277,
  0.015623728620476831,
  0.007812341060101111,
  0.0039062301319669718,
  0.0019531225164788188,
  0.0009765621895593195,
  0.0004882812111948983,
  0.00024414062014936177,
  0.00012207031189367021,
  0.00006103515617420877,
  0.000030517578115526096,
  0.000015258789061315762,
  0.00000762939453110197,
  0.000003814697265606496,
  0.000001907348632810187,
  0.0000009536743164059608,
  0.00000047683715820308884,
  0.00000023841857910155797,
  0.00000011920928955078068,
] as const;

function readAll(): ForensicSimulationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ForensicSimulationRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      "Failed to read forensic simulation runs:",
      error,
    );
    return [];
  }
}

function writeAll(records: ForensicSimulationRun[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function magnitude2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function distance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return magnitude2(ax - bx, ay - by);
}

function pointInImpactRegion(
  x: number,
  y: number,
  region?: ProposedImpactRegion,
): boolean {
  if (!region) return false;

  return (
    distance(
      x,
      y,
      region.xMetres,
      region.yMetres,
    ) <= region.radiusMetres
  );
}

/*
 * Deterministic CORDIC heading conversion.
 *
 * Rapier's deterministic profile only remains cross-platform
 * deterministic when the initial conditions are deterministic too.
 * Avoid Math.sin/Math.cos here because transcendental functions may
 * produce tiny platform-specific differences before Rapier even runs.
 */
function deterministicSinCosDegrees(
  degrees: number,
): {
  sin: number;
  cos: number;
} {
  let normalized =
    ((degrees % 360) + 360) % 360;

  if (normalized > 180) {
    normalized -= 360;
  }

  let angle = normalized * DEG_TO_RAD;
  let halfTurnFlip = 1;

  const halfPi = Math.PI / 2;

  if (angle > halfPi) {
    angle -= Math.PI;
    halfTurnFlip = -1;
  } else if (angle < -halfPi) {
    angle += Math.PI;
    halfTurnFlip = -1;
  }

  let x = CORDIC_GAIN;
  let y = 0;
  let z = angle;
  let power = 1;

  for (
    let index = 0;
    index < CORDIC_ATAN.length;
    index += 1
  ) {
    const direction = z >= 0 ? 1 : -1;
    const nextX =
      x - direction * y * power;
    const nextY =
      y + direction * x * power;

    z -= direction * CORDIC_ATAN[index];
    x = nextX;
    y = nextY;
    power *= 0.5;
  }

  return {
    cos: x * halfTurnFlip,
    sin: y * halfTurnFlip,
  };
}

function validateInput(
  input: ForensicSimulationInput,
): string[] {
  const warnings: string[] = [];

  if (!input.hypothesisId) {
    warnings.push(
      "No hypothesis is linked to this simulation.",
    );
  }

  if (input.participants.length < 2) {
    warnings.push(
      "At least two participants are required for contact testing.",
    );
  }

  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > 60
  ) {
    warnings.push(
      "Duration must be greater than 0 and no more than 60 seconds.",
    );
  }

  if (
    !Number.isFinite(input.timestepSeconds) ||
    input.timestepSeconds < 0.01 ||
    input.timestepSeconds > 0.25
  ) {
    warnings.push(
      "Time step must be between 0.01 s and 0.25 s.",
    );
  }

  if (
    !Number.isFinite(input.restitutionCoefficient) ||
    input.restitutionCoefficient < 0 ||
    input.restitutionCoefficient > 1
  ) {
    warnings.push(
      "Restitution coefficient must be between 0 and 1.",
    );
  }

  for (const participant of input.participants) {
    const label =
      participant.label || "Participant";

    if (!participant.label.trim()) {
      warnings.push(
        "Every participant needs a label.",
      );
    }

    if (
      !Number.isFinite(participant.massKg) ||
      participant.massKg <= 0
    ) {
      warnings.push(
        `${label} has an invalid mass.`,
      );
    }

    if (
      !Number.isFinite(participant.speedKmh) ||
      participant.speedKmh < 0
    ) {
      warnings.push(
        `${label} has an invalid speed.`,
      );
    }

    if (
      !Number.isFinite(
        participant.collisionRadiusMetres,
      ) ||
      participant.collisionRadiusMetres <= 0
    ) {
      warnings.push(
        `${label} has an invalid collision radius.`,
      );
    }

    if (
      !Number.isFinite(
        participant.frictionCoefficient,
      ) ||
      participant.frictionCoefficient < 0 ||
      participant.frictionCoefficient > 1.5
    ) {
      warnings.push(
        `${label} has an invalid friction coefficient.`,
      );
    }

    if (
      !Number.isFinite(
        participant.reactionTimeSeconds,
      ) ||
      participant.reactionTimeSeconds < 0 ||
      participant.reactionTimeSeconds > 10
    ) {
      warnings.push(
        `${label} has an invalid reaction time.`,
      );
    }

    if (
      !Number.isFinite(
        participant.headingDegrees,
      )
    ) {
      warnings.push(
        `${label} has an invalid heading.`,
      );
    }

    if (
      !Number.isFinite(
        participant.startXMetres,
      ) ||
      !Number.isFinite(
        participant.startYMetres,
      )
    ) {
      warnings.push(
        `${label} has an invalid start position.`,
      );
    }
  }

  return warnings;
}

function applyBraking(
  state: RapierParticipantState,
  elapsedSeconds: number,
  dt: number,
  gravity: number,
): void {
  if (!state.input.brakingEnabled) return;

  if (
    elapsedSeconds <
    state.input.reactionTimeSeconds
  ) {
    return;
  }

  const velocity = state.body.linvel();
  const speed =
    magnitude2(velocity.x, velocity.z);

  if (speed <= 0.000001) {
    state.body.setLinvel(
      { x: 0, y: 0, z: 0 },
      true,
    );
    return;
  }

  const mu = Math.max(
    0,
    state.input.frictionCoefficient,
  );

  const deceleration =
    mu * gravity;

  const nextSpeed = Math.max(
    0,
    speed - deceleration * dt,
  );

  const scale =
    speed > 0
      ? nextSpeed / speed
      : 0;

  state.body.setLinvel(
    {
      x: velocity.x * scale,
      y: 0,
      z: velocity.z * scale,
    },
    true,
  );
}

function captureFrame(
  timeSeconds: number,
  states: RapierParticipantState[],
): ForensicSimulationFrame {
  return {
    timeSeconds:
      Number(timeSeconds.toFixed(4)),
    participants: states.map((state) => {
      const position =
        state.body.translation();

      const velocity =
        state.body.linvel();

      return {
        participantId: state.input.id,
        xMetres: position.x,
        yMetres: position.z,
        speedMetresPerSecond:
          magnitude2(
            velocity.x,
            velocity.z,
          ),
      };
    }),
  };
}

function markImpactRegionEntry(
  states: RapierParticipantState[],
  region?: ProposedImpactRegion,
): void {
  if (!region) return;

  for (const state of states) {
    const position =
      state.body.translation();

    if (
      pointInImpactRegion(
        position.x,
        position.z,
        region,
      )
    ) {
      state.enteredImpactRegion = true;
    }
  }
}

function pairKey(
  firstId: string,
  secondId: string,
): string {
  return firstId < secondId
    ? `${firstId}:${secondId}`
    : `${secondId}:${firstId}`;
}

function preStepRelativeSpeed(
  first: PlanarVelocity | undefined,
  second: PlanarVelocity | undefined,
): number {
  if (!first || !second) return 0;

  return magnitude2(
    second.x - first.x,
    second.z - first.z,
  );
}

export const ForensicSimulationService = {
  getByCaseId(
    caseId: string,
  ): ForensicSimulationRun[] {
    return readAll()
      .filter((run) => run.caseId === caseId)
      .sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
  },

  delete(runId: string): void {
    writeAll(
      readAll().filter(
        (run) => run.id !== runId,
      ),
    );
  },

  async run(
    input: ForensicSimulationInput,
    proposedImpactRegion?: ProposedImpactRegion,
  ): Promise<ForensicSimulationRun> {
    const validationWarnings =
      validateInput(input);

    if (validationWarnings.length > 0) {
      throw new Error(
        validationWarnings.join(" "),
      );
    }

    const RAPIER =
      await import(
        "@dimforge/rapier3d-deterministic-compat"
      );

    const gravity =
      input.gravityMetresPerSecondSquared;

    const nominalDt =
      input.timestepSeconds;

    const world =
      new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      });

    const eventQueue =
      new RAPIER.EventQueue(true);

    world.timestep = nominalDt;

    const states: RapierParticipantState[] = [];
    const stateByCollider =
      new Map<number, RapierParticipantState>();

    const contacts:
      ForensicSimulationContactEvent[] = [];

    const recordedPairs =
      new Set<string>();

    const frames:
      ForensicSimulationFrame[] = [];

    const warnings: string[] = [
      "Simulation V2 uses Rapier deterministic rigid-body contact solving with planar circular participant envelopes.",
      "Vehicle deformation, tyre force curves, steering input, suspension, roll, yaw inertia and road camber are not yet modelled.",
      "A simulated contact is a scenario-testing result, not proof that the real crash occurred that way.",
    ];

    const initialMetrics =
      new Map<
        string,
        Omit<
          ForensicSimulationParticipantMetric,
          | "finalSpeedMetresPerSecond"
          | "finalXMetres"
          | "finalYMetres"
          | "enteredProposedImpactRegion"
        >
      >();

    try {
      for (
        let index = 0;
        index < input.participants.length;
        index += 1
      ) {
        const participant =
          input.participants[index];

        const speed =
          participant.speedKmh / 3.6;

        const heading =
          deterministicSinCosDegrees(
            participant.headingDegrees,
          );

        const bodyDesc =
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
              participant.startXMetres,
              0,
              participant.startYMetres,
            )
            .setLinvel(
              heading.cos * speed,
              0,
              heading.sin * speed,
            )
            .enabledTranslations(
              true,
              false,
              true,
            )
            .enabledRotations(
              false,
              false,
              false,
            )
            .setCanSleep(false)
            .setCcdEnabled(true);

        const body =
          world.createRigidBody(bodyDesc);

        const colliderDesc =
          RAPIER.ColliderDesc.ball(
            participant.collisionRadiusMetres,
          )
            .setMass(participant.massKg)
            .setFriction(0)
            .setRestitution(
              input.restitutionCoefficient,
            )
            .setActiveEvents(
              RAPIER.ActiveEvents.COLLISION_EVENTS,
            );

        const collider =
          world.createCollider(
            colliderDesc,
            body,
          );

        const state: RapierParticipantState = {
          input: participant,
          body,
          collider,
          enteredImpactRegion:
            pointInImpactRegion(
              participant.startXMetres,
              participant.startYMetres,
              proposedImpactRegion,
            ),
        };

        states.push(state);
        stateByCollider.set(
          collider.handle,
          state,
        );

        const mu =
          participant.frictionCoefficient;

        const reactionDistance =
          participant.brakingEnabled
            ? speed *
              participant.reactionTimeSeconds
            : 0;

        const brakingDistance =
          participant.brakingEnabled &&
          mu > 0
            ? (speed * speed) /
              (2 * mu * gravity)
            : undefined;

        initialMetrics.set(
          participant.id,
          {
            participantId:
              participant.id,
            label:
              participant.label,
            initialSpeedMetresPerSecond:
              speed,
            initialMomentumKgMetresPerSecond:
              participant.massKg *
              speed,
            initialKineticEnergyJoules:
              0.5 *
              participant.massKg *
              speed *
              speed,
            reactionDistanceMetres:
              reactionDistance,
            theoreticalBrakingDistanceMetres:
              brakingDistance,
            theoreticalStoppingDistanceMetres:
              brakingDistance === undefined
                ? undefined
                : reactionDistance +
                  brakingDistance,
          },
        );
      }

      frames.push(
        captureFrame(0, states),
      );

      let elapsed = 0;
      let stepIndex = 0;

      while (
        elapsed <
        input.durationSeconds - 0.0000001
      ) {
        const stepDt =
          Math.min(
            nominalDt,
            input.durationSeconds - elapsed,
          );

        world.timestep = stepDt;

        for (const state of states) {
          applyBraking(
            state,
            elapsed,
            stepDt,
            gravity,
          );
        }

        const preStepVelocity =
          new Map<string, PlanarVelocity>();

        for (const state of states) {
          const velocity =
            state.body.linvel();

          preStepVelocity.set(
            state.input.id,
            {
              x: velocity.x,
              z: velocity.z,
            },
          );
        }

        world.step(eventQueue);

        const nextTime =
          Math.min(
            input.durationSeconds,
            elapsed + stepDt,
          );

        markImpactRegionEntry(
          states,
          proposedImpactRegion,
        );

        eventQueue.drainCollisionEvents(
          (
            firstHandle,
            secondHandle,
            started,
          ) => {
            if (!started) return;

            const first =
              stateByCollider.get(
                firstHandle,
              );

            const second =
              stateByCollider.get(
                secondHandle,
              );

            if (!first || !second) {
              return;
            }

            const key = pairKey(
              first.input.id,
              second.input.id,
            );

            if (recordedPairs.has(key)) {
              return;
            }

            recordedPairs.add(key);

            const firstPosition =
              first.body.translation();

            const secondPosition =
              second.body.translation();

            let contactX =
              (firstPosition.x +
                secondPosition.x) /
              2;

            let contactY =
              (firstPosition.z +
                secondPosition.z) /
              2;

            world.contactPair(
              first.collider,
              second.collider,
              (manifold) => {
                if (
                  manifold.numSolverContacts() >
                  0
                ) {
                  const point =
                    manifold.solverContactPoint(
                      0,
                    );

                  contactX = point.x;
                  contactY = point.z;
                }
              },
            );

            const relativeSpeed =
              preStepRelativeSpeed(
                preStepVelocity.get(
                  first.input.id,
                ),
                preStepVelocity.get(
                  second.input.id,
                ),
              );

            contacts.push({
              id:
                `simulation-contact-${stepIndex}-` +
                `${first.input.id}-` +
                `${second.input.id}`,
              timeSeconds:
                Number(
                  nextTime.toFixed(4),
                ),
              participantAId:
                first.input.id,
              participantBId:
                second.input.id,
              participantALabel:
                first.input.label,
              participantBLabel:
                second.input.label,
              xMetres:
                contactX,
              yMetres:
                contactY,
              relativeSpeedMetresPerSecond:
                relativeSpeed,
              insideProposedImpactRegion:
                pointInImpactRegion(
                  contactX,
                  contactY,
                  proposedImpactRegion,
                ),
            });
          },
        );

        frames.push(
          captureFrame(
            nextTime,
            states,
          ),
        );

        elapsed = nextTime;
        stepIndex += 1;
      }

      const participantMetrics:
        ForensicSimulationParticipantMetric[] =
        states.map((state) => {
          const position =
            state.body.translation();

          const velocity =
            state.body.linvel();

          return {
            ...initialMetrics.get(
              state.input.id,
            )!,
            finalSpeedMetresPerSecond:
              magnitude2(
                velocity.x,
                velocity.z,
              ),
            finalXMetres:
              position.x,
            finalYMetres:
              position.z,
            enteredProposedImpactRegion:
              state.enteredImpactRegion,
          };
        });

      if (contacts.length === 0) {
        warnings.push(
          "No participant contact occurred within the selected duration and collision envelopes.",
        );
      }

      if (
        proposedImpactRegion &&
        contacts.length > 0 &&
        !contacts.some(
          (contact) =>
            contact.insideProposedImpactRegion,
        )
      ) {
        warnings.push(
          "Simulated contact occurred outside the hypothesis's proposed impact region.",
        );
      }

      const existingForCase =
        this.getByCaseId(
          input.caseId,
        );

      const run: ForensicSimulationRun = {
        id:
          createId("simulation-run"),
        code:
          `SIM-${String(
            existingForCase.length + 1,
          ).padStart(3, "0")}`,
        caseId:
          input.caseId,
        caseNumber:
          input.caseNumber,
        hypothesisId:
          input.hypothesisId,
        hypothesisCode:
          input.hypothesisCode,
        hypothesisTitle:
          input.hypothesisTitle,
        provenance:
          "Simulated",
        confidence:
          contacts.length > 0
            ? "Moderate"
            : "Low",
        status:
          warnings.length > 3
            ? "Completed with warnings"
            : "Completed",
        engine: {
          name:
            "Rapier 3D deterministic",
          packageName:
            RAPIER_PACKAGE,
          packageVersion:
            RAPIER_PACKAGE_VERSION,
          profile:
            ENGINE_PROFILE,
          deterministic:
            true,
          planar:
            true,
          colliderModel:
            "Circular envelope",
          continuousCollisionDetection:
            true,
        },
        input,
        participantMetrics,
        frames,
        contacts,
        warnings,
        formulas: [
          "Speed conversion: v(m/s) = v(km/h) / 3.6",
          "Momentum magnitude: p = m x v",
          "Kinetic energy: KE = 0.5 x m x v^2",
          "Reaction distance: dr = v x tr",
          "Braking deceleration screening: a = mu x g",
          "Theoretical braking distance: db = v^2 / (2 x mu x g)",
          "Rigid-body contacts and restitution response: Rapier 3D deterministic solver.",
          "Planar constraint: world X/Z correspond to RoadSafe scene X/Y; vertical translation and rotation are locked.",
        ],
        createdAt:
          new Date().toISOString(),
      };

      writeAll([
        ...readAll(),
        run,
      ]);

      return run;
    } finally {
      eventQueue.free();
      world.free();
    }
  },
};
