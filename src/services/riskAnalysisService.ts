import {
  AccidentService,
} from "./accidentService";

import type {
  Accident,
} from "../types/accident";

import type {
  JunctionRiskAnalysis,
  RiskLevel,
  RiskScoreBreakdown,
} from "../types/risk";

/**
 * Prototype risk-scoring weights.
 *
 * These values can later be adjusted using:
 * - police accident records;
 * - expert interviews;
 * - transport-planning standards;
 * - research findings.
 */
const RISK_WEIGHTS = {
  fatality: 10,
  seriousAccident: 5,
  minorAccident: 2,
  injury: 2,
  accident: 1,
} as const;

const MEDIUM_RISK_MINIMUM = 10;
const HIGH_RISK_MINIMUM = 25;

function countAccidentsBySeverity(
  accidents: Accident[],
  severity: Accident["severity"],
): number {
  return accidents.filter(
    (accident) =>
      accident.severity === severity,
  ).length;
}

function calculateFatalities(
  accidents: Accident[],
): number {
  return accidents.reduce(
    (total, accident) =>
      total + accident.fatalities,
    0,
  );
}

function calculateInjuries(
  accidents: Accident[],
): number {
  return accidents.reduce(
    (total, accident) =>
      total + accident.injuries,
    0,
  );
}

function calculateBreakdown(
  totalAccidents: number,
  seriousAccidents: number,
  minorAccidents: number,
  fatalities: number,
  injuries: number,
): RiskScoreBreakdown {
  return {
    fatalitiesScore:
      fatalities *
      RISK_WEIGHTS.fatality,

    seriousAccidentsScore:
      seriousAccidents *
      RISK_WEIGHTS.seriousAccident,

    minorAccidentsScore:
      minorAccidents *
      RISK_WEIGHTS.minorAccident,

    injuriesScore:
      injuries *
      RISK_WEIGHTS.injury,

    totalAccidentsScore:
      totalAccidents *
      RISK_WEIGHTS.accident,
  };
}

function calculateTotalScore(
  breakdown: RiskScoreBreakdown,
): number {
  return (
    breakdown.fatalitiesScore +
    breakdown.seriousAccidentsScore +
    breakdown.minorAccidentsScore +
    breakdown.injuriesScore +
    breakdown.totalAccidentsScore
  );
}

function determineRiskLevel(
  riskScore: number,
): RiskLevel {
  if (
    riskScore >= HIGH_RISK_MINIMUM
  ) {
    return "High";
  }

  if (
    riskScore >= MEDIUM_RISK_MINIMUM
  ) {
    return "Medium";
  }

  return "Low";
}

export const RiskAnalysisService = {
  analyseJunction(
    junctionId: string,
  ): JunctionRiskAnalysis {
    const accidents =
      AccidentService.getByJunctionId(
        junctionId,
      );

    const totalAccidents =
      accidents.length;

    const fatalAccidents =
      countAccidentsBySeverity(
        accidents,
        "Fatal",
      );

    const seriousAccidents =
      countAccidentsBySeverity(
        accidents,
        "Serious",
      );

    const minorAccidents =
      countAccidentsBySeverity(
        accidents,
        "Minor",
      );

    const fatalities =
      calculateFatalities(accidents);

    const injuries =
      calculateInjuries(accidents);

    const breakdown =
      calculateBreakdown(
        totalAccidents,
        seriousAccidents,
        minorAccidents,
        fatalities,
        injuries,
      );

    const riskScore =
      calculateTotalScore(
        breakdown,
      );

    const riskLevel =
      determineRiskLevel(
        riskScore,
      );

    return {
      junctionId,

      riskLevel,
      riskScore,

      totalAccidents,
      fatalAccidents,
      seriousAccidents,
      minorAccidents,

      fatalities,
      injuries,

      breakdown,
    };
  },

  /**
   * Classifies any risk score using the same
   * thresholds used for junction analysis.
   *
   * The area-analysis service uses this method
   * to classify the area's average risk score.
   */
  classifyScore(
    riskScore: number,
  ): RiskLevel {
    return determineRiskLevel(
      riskScore,
    );
  },

  getRiskLevel(
    junctionId: string,
  ): RiskLevel {
    return this.analyseJunction(
      junctionId,
    ).riskLevel;
  },

  getRiskScore(
    junctionId: string,
  ): number {
    return this.analyseJunction(
      junctionId,
    ).riskScore;
  },

  isHighRisk(
    junctionId: string,
  ): boolean {
    return (
      this.getRiskLevel(
        junctionId,
      ) === "High"
    );
  },
};