import { accidents } from "../data/accidents";
import { junctions } from "../data/junctions";
import type { AccidentCase } from "../types/accidentCase";
import type {
  AccidentReconstruction,
  EvidenceRecord,
  ScenePhotoAttachment,
} from "../types/reconstruction";
import type { ReconstructionFootage } from "../types/reconstructionFootage";
import { AccidentCaseService } from "./accidentCaseService";
import { ReconstructionFootageService } from "./reconstructionFootageService";
import { ReconstructionService } from "./reconstructionService";

export interface WorkspaceEvidenceItem {
  id: string;
  accidentCase: AccidentCase | null;
  reconstruction: AccidentReconstruction;
  evidence: EvidenceRecord;
  photos: ScenePhotoAttachment[];
}

export interface WorkspaceReportItem {
  id: string;
  accidentCase: AccidentCase;
  reconstruction: AccidentReconstruction | null;
  title: string;
  generatedAt: string;
  readiness: number;
}

function sortNewest<T>(records: T[], getDate: (record: T) => string): T[] {
  return [...records].sort(
    (left, right) =>
      new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime(),
  );
}

function monthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  if (key === "Unknown") return key;
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, 1));
}

export const WorkspaceDataService = {
  getCases(): AccidentCase[] {
    return sortNewest(AccidentCaseService.getAll(), (record) => record.updatedAt);
  },

  getReconstructions(): AccidentReconstruction[] {
    return sortNewest(ReconstructionService.getAll(), (record) => record.updatedAt);
  },

  getFootage(): ReconstructionFootage[] {
    return ReconstructionFootageService.getAllMetadata();
  },

  getEvidence(): WorkspaceEvidenceItem[] {
    const cases = this.getCases();
    const casesByReconstruction = new Map(
      cases
        .filter((record) => record.reconstructionId)
        .map((record) => [record.reconstructionId as string, record]),
    );

    return this.getReconstructions()
      .flatMap((reconstruction) =>
        reconstruction.evidenceRecords.map((evidence) => ({
          id: `${reconstruction.id}:${evidence.id}`,
          accidentCase: casesByReconstruction.get(reconstruction.id) ?? null,
          reconstruction,
          evidence,
          photos: reconstruction.photos.filter(
            (photo) =>
              photo.linkedEvidenceId === evidence.id ||
              evidence.photoIds.includes(photo.id),
          ),
        })),
      )
      .sort(
        (left, right) =>
          new Date(right.evidence.recordedAt).getTime() -
          new Date(left.evidence.recordedAt).getTime(),
      );
  },

  getReports(): WorkspaceReportItem[] {
    return this.getCases().map((accidentCase) => {
      const reconstruction = AccidentCaseService.getLinkedReconstruction(accidentCase);
      const completion = AccidentCaseService.getCompletion(accidentCase);
      const title =
        accidentCase.status === "Closed"
          ? "Final accident reconstruction report"
          : accidentCase.status === "Reconstruction Complete"
            ? "Reconstruction findings report"
            : "Preliminary investigation report";

      return {
        id: accidentCase.id,
        accidentCase,
        reconstruction,
        title,
        generatedAt: reconstruction?.updatedAt ?? accidentCase.updatedAt,
        readiness: completion.percentage,
      };
    });
  },

  getSummary() {
    const cases = this.getCases();
    const reconstructions = this.getReconstructions();
    const evidence = this.getEvidence();
    const footage = this.getFootage();

    return {
      cases,
      reconstructions,
      evidence,
      footage,
      totalCases: cases.length,
      activeCases: cases.filter((record) =>
        ["Open", "Under Investigation"].includes(record.status),
      ).length,
      completedCases: cases.filter((record) =>
        ["Reconstruction Complete", "Closed"].includes(record.status),
      ).length,
      reconstructionCount: reconstructions.length,
      evidenceCount: evidence.length,
      photoCount: reconstructions.reduce(
        (total, reconstruction) => total + reconstruction.photos.length,
        0,
      ),
      footageCount: footage.length,
      totalFatalities: accidents.reduce(
        (total, accident) => total + accident.fatalities,
        0,
      ),
      totalInjuries: accidents.reduce(
        (total, accident) => total + accident.injuries,
        0,
      ),
      highRiskJunctions: junctions.filter(
        (junction) => junction.riskLevel === "High",
      ).length,
      latestCase: cases[0] ?? null,
      latestReconstruction: reconstructions[0] ?? null,
    };
  },

  getMonthlyActivity() {
    const counts = new Map<string, { accidents: number; cases: number }>();

    accidents.forEach((record) => {
      const key = monthKey(record.date);
      const current = counts.get(key) ?? { accidents: 0, cases: 0 };
      current.accidents += 1;
      counts.set(key, current);
    });

    this.getCases().forEach((record) => {
      const key = monthKey(record.accidentDate);
      const current = counts.get(key) ?? { accidents: 0, cases: 0 };
      current.cases += 1;
      counts.set(key, current);
    });

    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-12)
      .map(([key, value]) => ({ label: monthLabel(key), ...value }));
  },

  getSeverityDistribution() {
    const counts = new Map<string, number>();
    accidents.forEach((record) =>
      counts.set(record.severity, (counts.get(record.severity) ?? 0) + 1),
    );
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  },

  getCauseDistribution() {
    const counts = new Map<string, number>();
    accidents.forEach((record) =>
      counts.set(record.cause, (counts.get(record.cause) ?? 0) + 1),
    );
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value);
  },

  getParticipantDistribution() {
    const counts = new Map<string, number>();
    this.getReconstructions().forEach((reconstruction) =>
      reconstruction.vehicles.forEach((participant) =>
        counts.set(
          participant.type,
          (counts.get(participant.type) ?? 0) + 1,
        ),
      ),
    );
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value);
  },

  getRoadConditionDistribution() {
    const counts = new Map<string, number>();
    this.getReconstructions().forEach((reconstruction) => {
      const label = `${reconstruction.scene.roadSurface} / ${reconstruction.scene.weather}`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  },

  getJunctionRiskRows() {
    return junctions.map((junction) => {
      const records = accidents.filter(
        (accident) => accident.junctionId === junction.id,
      );
      return {
        ...junction,
        accidents: records.length,
        fatalities: records.reduce(
          (total, accident) => total + accident.fatalities,
          0,
        ),
        injuries: records.reduce(
          (total, accident) => total + accident.injuries,
          0,
        ),
      };
    });
  },
};
