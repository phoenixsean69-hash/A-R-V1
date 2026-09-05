import type { Accident } from "../types/accident";
import type { AreaAnalysis } from "../types/areaAnalysis";
import type { AccidentHeatmapFilters } from "../types/heatmap";
import type { MapBounds } from "../types/map";
import type {
  JunctionRiskAnalysis,
  RiskScoreBreakdown,
} from "../types/risk";

import { AccidentFilterService } from "./accidentFilterService";
import { AccidentService } from "./accidentService";
import { JunctionService } from "./junctionService";
import { RiskAnalysisService } from "./riskAnalysisService";

const RISK_WEIGHTS = {
  fatality: 10,
  seriousAccident: 5,
  minorAccident: 2,
  injury: 2,
  accident: 1,
} as const;

function analyseFilteredJunction(
  junctionId: string,
  accidents: Accident[],
): JunctionRiskAnalysis {
  const junctionAccidents = accidents.filter(
    (accident) => accident.junctionId === junctionId,
  );

  const fatalAccidents = junctionAccidents.filter(
    (accident) => accident.severity === "Fatal",
  ).length;
  const seriousAccidents = junctionAccidents.filter(
    (accident) => accident.severity === "Serious",
  ).length;
  const minorAccidents = junctionAccidents.filter(
    (accident) => accident.severity === "Minor",
  ).length;

  const fatalities = junctionAccidents.reduce(
    (total, accident) => total + accident.fatalities,
    0,
  );
  const injuries = junctionAccidents.reduce(
    (total, accident) => total + accident.injuries,
    0,
  );

  const breakdown: RiskScoreBreakdown = {
    fatalitiesScore: fatalities * RISK_WEIGHTS.fatality,
    seriousAccidentsScore:
      seriousAccidents * RISK_WEIGHTS.seriousAccident,
    minorAccidentsScore:
      minorAccidents * RISK_WEIGHTS.minorAccident,
    injuriesScore: injuries * RISK_WEIGHTS.injury,
    totalAccidentsScore:
      junctionAccidents.length * RISK_WEIGHTS.accident,
  };

  const riskScore = Object.values(breakdown).reduce(
    (total, value) => total + value,
    0,
  );

  return {
    junctionId,
    riskLevel: RiskAnalysisService.classifyScore(riskScore),
    riskScore,
    totalAccidents: junctionAccidents.length,
    fatalAccidents,
    seriousAccidents,
    minorAccidents,
    fatalities,
    injuries,
    breakdown,
  };
}

export class AreaAnalysisService {
  static analyse(
    bounds: MapBounds,
    filters?: AccidentHeatmapFilters,
  ): AreaAnalysis {
    const allJunctions = JunctionService.getAll();
    const allAccidents = AccidentService.getAll();

    const analyticalAccidents = filters
      ? AccidentFilterService.filter(allAccidents, filters)
      : allAccidents;

    const junctionsInsideArea = allJunctions.filter((junction) =>
      this.containsCoordinate(
        bounds,
        junction.latitude,
        junction.longitude,
      ),
    );

    const junctionIds = new Set(
      junctionsInsideArea.map((junction) => junction.id),
    );

    const accidentsInsideArea = analyticalAccidents.filter((accident) =>
      junctionIds.has(accident.junctionId),
    );

    const totalFatalities = accidentsInsideArea.reduce(
      (total, accident) => total + accident.fatalities,
      0,
    );

    const totalInjuries = accidentsInsideArea.reduce(
      (total, accident) => total + accident.injuries,
      0,
    );

    const junctionRiskAnalyses = junctionsInsideArea.map((junction) =>
      analyseFilteredJunction(junction.id, accidentsInsideArea),
    );

    const highRiskJunctions = junctionRiskAnalyses.filter(
      (risk) => risk.riskLevel === "High",
    ).length;

    const mediumRiskJunctions = junctionRiskAnalyses.filter(
      (risk) => risk.riskLevel === "Medium",
    ).length;

    const lowRiskJunctions = junctionRiskAnalyses.filter(
      (risk) => risk.riskLevel === "Low",
    ).length;

    const totalRiskScore = junctionRiskAnalyses.reduce(
      (total, risk) => total + risk.riskScore,
      0,
    );

    const averageRiskScore =
      junctionRiskAnalyses.length > 0
        ? Number(
            (
              totalRiskScore / junctionRiskAnalyses.length
            ).toFixed(2),
          )
        : 0;

    return {
      junctions: junctionsInsideArea,
      accidents: accidentsInsideArea,
      junctionRiskAnalyses,
      totalJunctions: junctionsInsideArea.length,
      totalAccidents: accidentsInsideArea.length,
      totalFatalities,
      totalInjuries,
      highRiskJunctions,
      mediumRiskJunctions,
      lowRiskJunctions,
      totalRiskScore,
      averageRiskScore,
      areaSquareKilometres: this.calculateArea(bounds),
      overallRiskLevel:
        RiskAnalysisService.classifyScore(averageRiskScore),
    };
  }

  private static containsCoordinate(
    bounds: MapBounds,
    latitude: number,
    longitude: number,
  ): boolean {
    return (
      latitude >= bounds.south &&
      latitude <= bounds.north &&
      longitude >= bounds.west &&
      longitude <= bounds.east
    );
  }

  private static calculateArea(bounds: MapBounds): number {
    const averageLatitude = (bounds.north + bounds.south) / 2;

    const heightKilometres =
      Math.abs(bounds.north - bounds.south) * 111.32;

    const widthKilometres =
      Math.abs(bounds.east - bounds.west) *
      111.32 *
      Math.cos((averageLatitude * Math.PI) / 180);

    return Number(
      (heightKilometres * widthKilometres).toFixed(3),
    );
  }
}
