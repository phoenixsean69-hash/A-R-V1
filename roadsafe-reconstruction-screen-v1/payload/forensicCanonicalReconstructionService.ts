import type {
  AccidentReconstruction,
  AccidentTimelineEvent,
  MovementPathPoint,
  ReconstructionEntity,
  ReconstructionEntityColour,
  ReconstructionEntityType,
  ReconstructionPosition,
} from "../../types/reconstruction";
import { AccidentCaseService } from "../../services/accidentCaseService";
import { ReconstructionService } from "../../services/reconstructionService";
import type {
  ForensicAccidentInvestigation,
  ForensicCrashHypothesis,
  ForensicPersonRecord,
  ForensicVehicleExamination,
} from "./forensicInvestigationTypes";
import type {
  ForensicSimulationParticipantInput,
  ForensicSimulationRun,
} from "./forensicSimulationTypes";

const STORAGE_KEY =
  "roadsafe-forensic-canonical-reconstruction-manifests-v1";

export interface ForensicCanonicalReconstructionManifest {
  caseId: string;
  reconstructionId: string;
  hypothesisId: string;
  hypothesisCode: string;
  simulationRunId: string;
  simulationRunCode: string;
  provenance: "Simulated";
  createdAt: string;
  updatedAt: string;
}

function readAll(): ForensicCanonicalReconstructionManifest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed =
      JSON.parse(raw) as ForensicCanonicalReconstructionManifest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      "Failed to read canonical reconstruction manifests:",
      error,
    );
    return [];
  }
}

function writeAll(
  manifests: ForensicCanonicalReconstructionManifest[],
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(manifests),
  );
}

function saveManifest(
  manifest: ForensicCanonicalReconstructionManifest,
): ForensicCanonicalReconstructionManifest {
  const all = readAll();
  const index = all.findIndex(
    (item) => item.caseId === manifest.caseId,
  );

  if (index >= 0) {
    all[index] = manifest;
  } else {
    all.push(manifest);
  }

  writeAll(all);
  return manifest;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function metresToScenePosition(
  xMetres: number,
  yMetres: number,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): ReconstructionPosition {
  return {
    x: clamp(
      50 +
        (xMetres /
          Math.max(1, sceneWidthMetres)) *
          100,
      0,
      100,
    ),
    y: clamp(
      50 -
        (yMetres /
          Math.max(1, sceneHeightMetres)) *
          100,
      0,
      100,
    ),
  };
}

function sourceVehicle(
  investigation: ForensicAccidentInvestigation,
  input: ForensicSimulationParticipantInput,
): ForensicVehicleExamination | undefined {
  return input.sourceVehicleId
    ? investigation.vehicles.find(
        (vehicle) =>
          vehicle.id === input.sourceVehicleId,
      )
    : undefined;
}

function sourcePerson(
  investigation: ForensicAccidentInvestigation,
  input: ForensicSimulationParticipantInput,
): ForensicPersonRecord | undefined {
  return input.sourcePersonId
    ? investigation.persons.find(
        (person) => person.id === input.sourcePersonId,
      )
    : undefined;
}

function mapParticipantType(
  vehicle?: ForensicVehicleExamination,
  person?: ForensicPersonRecord,
): ReconstructionEntityType {
  const vehicleType =
    vehicle?.vehicleType.toLowerCase() ?? "";
  const involvement =
    person?.involvement.toLowerCase() ?? "";

  if (
    vehicleType.includes("motorcycle")
  ) {
    return "Motorcycle";
  }

  if (
    vehicleType.includes("bicycle") ||
    involvement.includes("cyclist")
  ) {
    return "Bicycle";
  }

  if (
    vehicleType.includes("heavy truck") ||
    vehicleType.includes("truck") ||
    vehicleType.includes("lorry")
  ) {
    return "Truck";
  }

  if (
    vehicleType.includes("bus") ||
    vehicleType.includes("minibus") ||
    vehicleType.includes("coach")
  ) {
    return "Bus";
  }

  if (
    involvement.includes("pedestrian")
  ) {
    return "Pedestrian";
  }

  return "Car";
}

function colourForIndex(
  index: number,
): ReconstructionEntityColour {
  const colours: ReconstructionEntityColour[] = [
    "Blue",
    "Red",
    "Green",
    "Orange",
    "Purple",
    "Yellow",
    "White",
    "Black",
  ];

  return colours[index % colours.length];
}

function nearestFrameIndex(
  run: ForensicSimulationRun,
  timeSeconds: number,
): number {
  let bestIndex = 0;
  let bestDifference =
    Number.POSITIVE_INFINITY;

  run.frames.forEach((frame, index) => {
    const difference =
      Math.abs(
        frame.timeSeconds -
          timeSeconds,
      );

    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function buildPathPoints(
  run: ForensicSimulationRun,
  input: ForensicSimulationParticipantInput,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): MovementPathPoint[] {
  if (run.frames.length === 0) {
    const position =
      metresToScenePosition(
        input.startXMetres,
        input.startYMetres,
        sceneWidthMetres,
        sceneHeightMetres,
      );

    return [
      {
        id: `${input.id}-start`,
        label: "Start",
        position,
        timeSeconds: 0,
        speedKmh: input.speedKmh,
        rotation: input.headingDegrees,
        action: "Start",
        notes:
          "Imported from forensic Simulation V1.",
      },
      {
        id: `${input.id}-end`,
        label: "End",
        position,
        timeSeconds:
          run.input.durationSeconds,
        speedKmh: input.speedKmh,
        rotation: input.headingDegrees,
        action: "Stop",
        notes:
          "Simulation supplied no playback frames.",
      },
    ];
  }

  const requiredIndices =
    new Set<number>([
      0,
      run.frames.length - 1,
    ]);

  const maximumSamples = 70;
  const step = Math.max(
    1,
    Math.ceil(
      run.frames.length /
        maximumSamples,
    ),
  );

  for (
    let index = 0;
    index < run.frames.length;
    index += step
  ) {
    requiredIndices.add(index);
  }

  run.contacts
    .filter(
      (contact) =>
        contact.participantAId ===
          input.id ||
        contact.participantBId ===
          input.id,
    )
    .forEach((contact) => {
      requiredIndices.add(
        nearestFrameIndex(
          run,
          contact.timeSeconds,
        ),
      );
    });

  const contactTimes =
    run.contacts
      .filter(
        (contact) =>
          contact.participantAId ===
            input.id ||
          contact.participantBId ===
            input.id,
      )
      .map(
        (contact) =>
          contact.timeSeconds,
      );

  const indices =
    [...requiredIndices].sort(
      (a, b) => a - b,
    );

  return indices.flatMap(
    (frameIndex, pointIndex) => {
      const frame =
        run.frames[frameIndex];
      const sample =
        frame.participants.find(
          (participant) =>
            participant.participantId ===
            input.id,
        );

      if (!sample) {
        return [];
      }

      const isFirst =
        pointIndex === 0;
      const isLast =
        pointIndex ===
        indices.length - 1;

      const isImpact =
        contactTimes.some(
          (time) =>
            Math.abs(
              frame.timeSeconds -
                time,
            ) <=
            run.input
              .timestepSeconds *
              1.5,
        );

      const speedKmh =
        sample.speedMetresPerSecond *
        3.6;

      return [
        {
          id:
            `${input.id}-sim-${frameIndex}`,
          label: isFirst
            ? "Start"
            : isImpact
              ? "Impact"
              : isLast
                ? "Final"
                : `Simulation ${pointIndex}`,
          position:
            metresToScenePosition(
              sample.xMetres,
              sample.yMetres,
              sceneWidthMetres,
              sceneHeightMetres,
            ),
          timeSeconds:
            frame.timeSeconds,
          speedKmh,
          rotation:
            input.headingDegrees,
          action: isFirst
            ? "Start"
            : isImpact
              ? "Impact"
              : isLast &&
                  speedKmh <= 1.5
                ? "Stop"
                : "Cruise",
          notes:
            "Canonical path sample imported from forensic Simulation V1. Provenance: Simulated.",
        } satisfies MovementPathPoint,
      ];
    },
  );
}

function buildParticipant(
  investigation: ForensicAccidentInvestigation,
  run: ForensicSimulationRun,
  input: ForensicSimulationParticipantInput,
  index: number,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): ReconstructionEntity {
  const vehicle =
    sourceVehicle(
      investigation,
      input,
    );

  const person =
    sourcePerson(
      investigation,
      input,
    );

  const type =
    mapParticipantType(
      vehicle,
      person,
    );

  const pathPoints =
    buildPathPoints(
      run,
      input,
      sceneWidthMetres,
      sceneHeightMetres,
    );

  const start =
    pathPoints[0];

  const impact =
    pathPoints.find(
      (point) =>
        point.action === "Impact",
    ) ??
    pathPoints[
      Math.floor(
        pathPoints.length / 2,
      )
    ];

  const final =
    pathPoints[
      pathPoints.length - 1
    ];

  return {
    id: input.id,
    name:
      input.label ||
      vehicle?.label ||
      person?.label ||
      `Participant ${index + 1}`,
    type,
    colour:
      colourForIndex(index),
    estimatedSpeedKmh:
      input.speedKmh,
    originLocation:
      `Simulation start X ${input.startXMetres.toFixed(
        2,
      )} m, Y ${input.startYMetres.toFixed(
        2,
      )} m`,
    destinationLocation:
      "Simulation-derived final position",
    pathPoints,
    startPosition:
      start.position,
    collisionPosition:
      impact.position,
    finalPosition:
      final.position,
    startRotation:
      input.headingDegrees,
    collisionRotation:
      input.headingDegrees,
    finalRotation:
      input.headingDegrees,
    collisionTimeSeconds:
      impact.timeSeconds,
    notes:
      [
        "Forensic Reconstruction V2 canonical participant.",
        `Source simulation: ${run.code}.`,
        vehicle
          ? `Source examined vehicle: ${vehicle.code}.`
          : "",
        person
          ? `Source person: ${person.code}.`
          : "",
        "Provenance: Simulated.",
      ]
        .filter(Boolean)
        .join(" "),
    physics: {
      enabled: false,
      inputSpeedKmh:
        input.speedKmh,
      massKg:
        input.massKg,
      collisionRadiusMetres:
        input.collisionRadiusMetres,
      restitution:
        run.input
          .restitutionCoefficient,
      rollingFriction:
        input.frictionCoefficient,
      lateralGrip: 1,
      brakingDecelerationMps2:
        input.frictionCoefficient *
        run.input
          .gravityMetresPerSecondSquared,
    },
  };
}

function mapConfidence(
  confidence: ForensicSimulationRun["confidence"],
): "High" | "Medium" | "Low" {
  if (
    confidence === "Verified" ||
    confidence === "High"
  ) {
    return "High";
  }

  if (
    confidence === "Moderate"
  ) {
    return "Medium";
  }

  return "Low";
}

function buildTimeline(
  run: ForensicSimulationRun,
): AccidentTimelineEvent[] {
  return run.contacts.map(
    (contact, index) => ({
      id:
        `canonical-contact-${contact.id}`,
      timeSeconds:
        contact.timeSeconds,
      title:
        `Simulated contact ${index + 1}`,
      description:
        `${contact.participantALabel} ↔ ${contact.participantBLabel} at X ${contact.xMetres.toFixed(
          2,
        )} m, Y ${contact.yMetres.toFixed(
          2,
        )} m. ${
          contact
            .insideProposedImpactRegion
            ? "Inside"
            : "Outside"
        } the proposed impact region.`,
      type: "Collision",
    }),
  );
}

function chooseCollisionPoint(
  hypothesis: ForensicCrashHypothesis,
  run: ForensicSimulationRun,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
): ReconstructionPosition {
  const firstContact =
    run.contacts[0];

  if (firstContact) {
    return metresToScenePosition(
      firstContact.xMetres,
      firstContact.yMetres,
      sceneWidthMetres,
      sceneHeightMetres,
    );
  }

  if (hypothesis.impactRegion) {
    return metresToScenePosition(
      hypothesis
        .impactRegion.xMetres,
      hypothesis
        .impactRegion.yMetres,
      sceneWidthMetres,
      sceneHeightMetres,
    );
  }

  return {
    x: 50,
    y: 50,
  };
}

export const ForensicCanonicalReconstructionService = {
  getManifest(
    caseId: string,
  ): ForensicCanonicalReconstructionManifest | null {
    return (
      readAll().find(
        (item) =>
          item.caseId === caseId,
      ) ?? null
    );
  },

  getCanonicalReconstruction(
    caseId: string,
  ): AccidentReconstruction | null {
    const manifest =
      this.getManifest(caseId);

    if (!manifest) {
      return null;
    }

    return (
      ReconstructionService.getById(
        manifest.reconstructionId,
      ) ?? null
    );
  },

  promoteSimulationRun(
    investigation: ForensicAccidentInvestigation,
    run: ForensicSimulationRun,
  ): {
    reconstruction: AccidentReconstruction;
    manifest: ForensicCanonicalReconstructionManifest;
  } {
    if (
      run.caseId !==
      investigation.caseId
    ) {
      throw new Error(
        "The selected simulation belongs to another case.",
      );
    }

    const hypothesis =
      investigation.hypotheses.find(
        (item) =>
          item.id ===
          run.hypothesisId,
      );

    if (!hypothesis) {
      throw new Error(
        "The simulation's source hypothesis is no longer available.",
      );
    }

    const linked =
      AccidentCaseService.ensureReconstruction(
        investigation.caseId,
      );

    if (!linked) {
      throw new Error(
        "RoadSafe could not load the case's linked reconstruction.",
      );
    }

    const sceneWidthMetres =
      Math.max(
        20,
        Number(
          linked.scene
            .sceneWidthMetres ??
            60,
        ),
      );

    const sceneHeightMetres =
      Math.max(
        20,
        Number(
          linked.scene
            .sceneHeightMetres ??
            60,
        ),
      );

    const vehicles =
      run.input.participants.map(
        (input, index) =>
          buildParticipant(
            investigation,
            run,
            input,
            index,
            sceneWidthMetres,
            sceneHeightMetres,
          ),
      );

    const collisionPoint =
      chooseCollisionPoint(
        hypothesis,
        run,
        sceneWidthMetres,
        sceneHeightMetres,
      );

    const now =
      new Date().toISOString();

    const descriptionParts = [
      linked.description.trim(),
      `Forensic V2 canonical source: ${hypothesis.code} / ${run.code}.`,
      "The movement shown here is a derived reconstruction output with Simulated provenance.",
      "Original scene evidence, measurements, witness records and Analysis findings remain in the forensic investigation store.",
    ].filter(Boolean);

    const reconstruction:
      AccidentReconstruction = {
      ...linked,
      title:
        `${investigation.caseNumber} · ${hypothesis.code} Canonical Reconstruction`,
      description:
        descriptionParts.join(
          "\n\n",
        ),
      durationSeconds:
        Math.max(
          2,
          run.input
            .durationSeconds,
        ),
      vehicles,
      collisionPoint,
      timelineEvents:
        buildTimeline(run),
      collisionSetup: {
        source: "Derived",
        confirmed: false,
        locked: true,
        toleranceMetres:
          Math.max(
            0.5,
            hypothesis
              .impactRegion
              ?.radiusMetres ??
              2,
          ),
        confidence:
          mapConfidence(
            run.confidence,
          ),
        notes:
          [
            `Derived from ${hypothesis.code} and ${run.code}.`,
            "Collision location remains a tested hypothesis output, not an observed fact.",
          ].join(" "),
        lastCalculatedAt:
          run.createdAt,
      },
      physicsSettings: {
        enabled: false,
        mode: "Guided Paths",
        autoRunOnPlay: false,
        liveSimulation: false,
        timeStepSeconds:
          Math.max(
            0.04,
            run.input
              .timestepSeconds,
          ),
        collisionToleranceMetres:
          Math.max(
            0.5,
            hypothesis
              .impactRegion
              ?.radiusMetres ??
              2,
          ),
        globalFrictionMultiplier: 1,
        airDrag: 0,
        stopSpeedKmh: 1,
        showVelocityVectors: true,
        showImpactEffects: true,
        replacePostImpactPath: false,
        contactDurationMinimumMs: 80,
        contactDurationMaximumMs: 160,
      },
      lastPhysicsSimulation:
        undefined,
      updatedAt: now,
      status: "Draft",
    };

    const saved =
      ReconstructionService.save(
        reconstruction,
      );

    const previous =
      this.getManifest(
        investigation.caseId,
      );

    const manifest:
      ForensicCanonicalReconstructionManifest = {
      caseId:
        investigation.caseId,
      reconstructionId:
        saved.id,
      hypothesisId:
        hypothesis.id,
      hypothesisCode:
        hypothesis.code,
      simulationRunId:
        run.id,
      simulationRunCode:
        run.code,
      provenance: "Simulated",
      createdAt:
        previous?.createdAt ??
        now,
      updatedAt: now,
    };

    saveManifest(manifest);

    return {
      reconstruction: saved,
      manifest,
    };
  },
};
