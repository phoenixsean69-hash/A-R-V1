import type {
  ForensicSimulationContactEvent,
  ForensicSimulationFrame,
  ForensicSimulationInput,
  ForensicSimulationParticipantInput,
  ForensicSimulationParticipantMetric,
  ForensicSimulationRun,
} from "./forensicSimulationTypes";

const STORAGE_KEY = "roadsafe-forensic-simulation-runs-v1";

interface MotionState {
  input: ForensicSimulationParticipantInput;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  hasContacted: Set<string>;
  enteredImpactRegion: boolean;
}

interface ProposedImpactRegion {
  xMetres: number;
  yMetres: number;
  radiusMetres: number;
}

function readAll(): ForensicSimulationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForensicSimulationRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read forensic simulation runs:", error);
    return [];
  }
}

function writeAll(records: ForensicSimulationRun[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(ax - bx, ay - by);
}

function pointInImpactRegion(
  x: number,
  y: number,
  region?: ProposedImpactRegion,
): boolean {
  if (!region) return false;
  return (
    distance(x, y, region.xMetres, region.yMetres) <=
    region.radiusMetres
  );
}

function applyBraking(
  state: MotionState,
  elapsedSeconds: number,
  dt: number,
  gravity: number,
): void {
  if (!state.input.brakingEnabled) return;
  if (elapsedSeconds < state.input.reactionTimeSeconds) return;
  if (state.speed <= 0) {
    state.speed = 0;
    state.vx = 0;
    state.vy = 0;
    return;
  }

  const mu = Math.max(0, state.input.frictionCoefficient);
  const deceleration = mu * gravity;
  const nextSpeed = Math.max(0, state.speed - deceleration * dt);

  if (state.speed > 0) {
    const scale = nextSpeed / state.speed;
    state.vx *= scale;
    state.vy *= scale;
  }

  state.speed = nextSpeed;
}

function resolveCircularContact(
  a: MotionState,
  b: MotionState,
  restitution: number,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.max(0.0001, Math.hypot(dx, dy));
  const nx = dx / d;
  const ny = dy / d;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const relativeNormalVelocity = rvx * nx + rvy * ny;

  if (relativeNormalVelocity >= 0) {
    return Math.hypot(rvx, rvy);
  }

  const m1 = Math.max(1, a.input.massKg);
  const m2 = Math.max(1, b.input.massKg);
  const e = Math.min(1, Math.max(0, restitution));

  const impulse =
    (-(1 + e) * relativeNormalVelocity) /
    (1 / m1 + 1 / m2);

  const ix = impulse * nx;
  const iy = impulse * ny;

  a.vx -= ix / m1;
  a.vy -= iy / m1;
  b.vx += ix / m2;
  b.vy += iy / m2;

  a.speed = Math.hypot(a.vx, a.vy);
  b.speed = Math.hypot(b.vx, b.vy);

  const overlap =
    a.input.collisionRadiusMetres +
    b.input.collisionRadiusMetres -
    d;

  if (overlap > 0) {
    const correction = overlap / 2 + 0.001;
    a.x -= nx * correction;
    a.y -= ny * correction;
    b.x += nx * correction;
    b.y += ny * correction;
  }

  return Math.hypot(rvx, rvy);
}

function validateInput(input: ForensicSimulationInput): string[] {
  const warnings: string[] = [];

  if (!input.hypothesisId) {
    warnings.push("No hypothesis is linked to this simulation.");
  }

  if (input.participants.length < 2) {
    warnings.push("At least two participants are required for contact testing.");
  }

  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > 60
  ) {
    warnings.push("Duration must be greater than 0 and no more than 60 seconds.");
  }

  if (
    !Number.isFinite(input.timestepSeconds) ||
    input.timestepSeconds < 0.01 ||
    input.timestepSeconds > 0.25
  ) {
    warnings.push("Time step must be between 0.01 s and 0.25 s.");
  }

  if (
    !Number.isFinite(input.restitutionCoefficient) ||
    input.restitutionCoefficient < 0 ||
    input.restitutionCoefficient > 1
  ) {
    warnings.push("Restitution coefficient must be between 0 and 1.");
  }

  for (const participant of input.participants) {
    if (!participant.label.trim()) {
      warnings.push("Every participant needs a label.");
    }
    if (!Number.isFinite(participant.massKg) || participant.massKg <= 0) {
      warnings.push(`${participant.label || "Participant"} has an invalid mass.`);
    }
    if (
      !Number.isFinite(participant.speedKmh) ||
      participant.speedKmh < 0
    ) {
      warnings.push(`${participant.label || "Participant"} has an invalid speed.`);
    }
    if (
      !Number.isFinite(participant.collisionRadiusMetres) ||
      participant.collisionRadiusMetres <= 0
    ) {
      warnings.push(
        `${participant.label || "Participant"} has an invalid collision radius.`,
      );
    }
    if (
      !Number.isFinite(participant.frictionCoefficient) ||
      participant.frictionCoefficient < 0 ||
      participant.frictionCoefficient > 1.5
    ) {
      warnings.push(
        `${participant.label || "Participant"} has an invalid friction coefficient.`,
      );
    }
  }

  return warnings;
}

export const ForensicSimulationService = {
  getByCaseId(caseId: string): ForensicSimulationRun[] {
    return readAll()
      .filter((run) => run.caseId === caseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  delete(runId: string): void {
    writeAll(readAll().filter((run) => run.id !== runId));
  },

  run(
    input: ForensicSimulationInput,
    proposedImpactRegion?: ProposedImpactRegion,
  ): ForensicSimulationRun {
    const validationWarnings = validateInput(input);

    if (validationWarnings.length > 0) {
      throw new Error(validationWarnings.join(" "));
    }

    const gravity = input.gravityMetresPerSecondSquared;
    const dt = input.timestepSeconds;
    const stepCount = Math.ceil(input.durationSeconds / dt);

    const states: MotionState[] = input.participants.map((participant) => {
      const speed = participant.speedKmh / 3.6;
      const heading = toRadians(participant.headingDegrees);

      return {
        input: participant,
        x: participant.startXMetres,
        y: participant.startYMetres,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        speed,
        hasContacted: new Set<string>(),
        enteredImpactRegion: pointInImpactRegion(
          participant.startXMetres,
          participant.startYMetres,
          proposedImpactRegion,
        ),
      };
    });

    const contacts: ForensicSimulationContactEvent[] = [];
    const frames: ForensicSimulationFrame[] = [];
    const warnings: string[] = [
      "Collision response uses simplified circular envelopes and a frictionless normal impulse at contact.",
      "Vehicle deformation, tyre force curves, steering input, suspension, roll, yaw inertia and road camber are not modelled in Simulation V1.",
      "A simulated contact is a scenario-testing result, not proof that the real crash occurred that way.",
    ];

    const initialMetrics = new Map<
      string,
      Omit<
        ForensicSimulationParticipantMetric,
        "finalSpeedMetresPerSecond" | "finalXMetres" | "finalYMetres" | "enteredProposedImpactRegion"
      >
    >();

    for (const participant of input.participants) {
      const speed = participant.speedKmh / 3.6;
      const mu = participant.frictionCoefficient;
      const reactionDistance =
        participant.brakingEnabled
          ? speed * participant.reactionTimeSeconds
          : 0;
      const brakingDistance =
        participant.brakingEnabled && mu > 0
          ? (speed * speed) / (2 * mu * gravity)
          : undefined;

      initialMetrics.set(participant.id, {
        participantId: participant.id,
        label: participant.label,
        initialSpeedMetresPerSecond: speed,
        initialMomentumKgMetresPerSecond: participant.massKg * speed,
        initialKineticEnergyJoules:
          0.5 * participant.massKg * speed * speed,
        reactionDistanceMetres: reactionDistance,
        theoreticalBrakingDistanceMetres: brakingDistance,
        theoreticalStoppingDistanceMetres:
          brakingDistance === undefined
            ? undefined
            : reactionDistance + brakingDistance,
      });
    }

    for (let step = 0; step <= stepCount; step += 1) {
      const time = Math.min(step * dt, input.durationSeconds);

      frames.push({
        timeSeconds: Number(time.toFixed(4)),
        participants: states.map((state) => ({
          participantId: state.input.id,
          xMetres: state.x,
          yMetres: state.y,
          speedMetresPerSecond: state.speed,
        })),
      });

      if (step === stepCount) break;

      for (const state of states) {
        applyBraking(state, time, dt, gravity);

        state.x += state.vx * dt;
        state.y += state.vy * dt;

        if (
          pointInImpactRegion(
            state.x,
            state.y,
            proposedImpactRegion,
          )
        ) {
          state.enteredImpactRegion = true;
        }
      }

      for (let i = 0; i < states.length; i += 1) {
        for (let j = i + 1; j < states.length; j += 1) {
          const a = states[i];
          const b = states[j];
          const pairKey = `${a.input.id}:${b.input.id}`;
          const contactDistance =
            a.input.collisionRadiusMetres +
            b.input.collisionRadiusMetres;
          const currentDistance = distance(a.x, a.y, b.x, b.y);

          if (
            currentDistance <= contactDistance &&
            !a.hasContacted.has(pairKey)
          ) {
            const contactX = (a.x + b.x) / 2;
            const contactY = (a.y + b.y) / 2;
            const relativeSpeed = resolveCircularContact(
              a,
              b,
              input.restitutionCoefficient,
            );

            a.hasContacted.add(pairKey);
            b.hasContacted.add(pairKey);

            contacts.push({
              id: createId("simulation-contact"),
              timeSeconds: Number((time + dt).toFixed(4)),
              participantAId: a.input.id,
              participantBId: b.input.id,
              participantALabel: a.input.label,
              participantBLabel: b.input.label,
              xMetres: contactX,
              yMetres: contactY,
              relativeSpeedMetresPerSecond: relativeSpeed,
              insideProposedImpactRegion: pointInImpactRegion(
                contactX,
                contactY,
                proposedImpactRegion,
              ),
            });
          }
        }
      }
    }

    const participantMetrics: ForensicSimulationParticipantMetric[] =
      states.map((state) => ({
        ...initialMetrics.get(state.input.id)!,
        finalSpeedMetresPerSecond: state.speed,
        finalXMetres: state.x,
        finalYMetres: state.y,
        enteredProposedImpactRegion: state.enteredImpactRegion,
      }));

    if (contacts.length === 0) {
      warnings.push(
        "No participant contact occurred within the selected duration and simplified collision envelopes.",
      );
    }

    if (
      proposedImpactRegion &&
      contacts.length > 0 &&
      !contacts.some((contact) => contact.insideProposedImpactRegion)
    ) {
      warnings.push(
        "Simulated contact occurred outside the hypothesis's proposed impact region.",
      );
    }

    const existingForCase = this.getByCaseId(input.caseId);
    const run: ForensicSimulationRun = {
      id: createId("simulation-run"),
      code: `SIM-${String(existingForCase.length + 1).padStart(3, "0")}`,
      caseId: input.caseId,
      caseNumber: input.caseNumber,
      hypothesisId: input.hypothesisId,
      hypothesisCode: input.hypothesisCode,
      hypothesisTitle: input.hypothesisTitle,
      provenance: "Simulated",
      confidence: contacts.length > 0 ? "Moderate" : "Low",
      status: warnings.length > 3 ? "Completed with warnings" : "Completed",
      input,
      participantMetrics,
      frames,
      contacts,
      warnings,
      formulas: [
        "Speed conversion: v(m/s) = v(km/h) ÷ 3.6",
        "Momentum magnitude: p = m × v",
        "Kinetic energy: KE = ½ × m × v²",
        "Reaction distance: dᵣ = v × tᵣ",
        "Braking deceleration screening: a = μ × g",
        "Theoretical braking distance: dᵦ = v² ÷ (2 × μ × g)",
        "Simplified collision impulse: j = −(1 + e)(vᵣₑₗ · n) ÷ (1/m₁ + 1/m₂)",
      ],
      createdAt: new Date().toISOString(),
    };

    writeAll([...readAll(), run]);
    return run;
  },
};
