import type {
  AreaAnalysis,
} from "../types/areaAnalysis";

import type {
  MapBounds,
} from "../types/map";

import {
  AccidentService,
} from "./accidentService";

import {
  JunctionService,
} from "./junctionService";

import {
  RiskAnalysisService,
} from "./riskAnalysisService";

export class AreaAnalysisService {
  static analyse(
    bounds: MapBounds,
  ): AreaAnalysis {
    const allJunctions =
      JunctionService.getAll();

    const allAccidents =
      AccidentService.getAll();

    /**
     * Find junctions located inside the
     * rectangle selected by the user.
     */
    const junctionsInsideArea =
      allJunctions.filter(
        (junction) =>
          this.containsCoordinate(
            bounds,
            junction.latitude,
            junction.longitude,
          ),
      );

    const junctionIds =
      new Set(
        junctionsInsideArea.map(
          (junction) =>
            junction.id,
        ),
      );

    /**
     * An accident belongs to the area when
     * its junction belongs to the area.
     */
    const accidentsInsideArea =
      allAccidents.filter(
        (accident) =>
          junctionIds.has(
            accident.junctionId,
          ),
      );

    const totalFatalities =
      accidentsInsideArea.reduce(
        (total, accident) =>
          total +
          accident.fatalities,
        0,
      );

    const totalInjuries =
      accidentsInsideArea.reduce(
        (total, accident) =>
          total +
          accident.injuries,
        0,
      );

    /**
     * Calculate the real risk of each junction
     * from its accident records.
     *
     * The manually stored junction.riskLevel
     * is no longer used here.
     */
    const junctionRiskAnalyses =
      junctionsInsideArea.map(
        (junction) =>
          RiskAnalysisService
            .analyseJunction(
              junction.id,
            ),
      );

    const highRiskJunctions =
      junctionRiskAnalyses.filter(
        (risk) =>
          risk.riskLevel ===
          "High",
      ).length;

    const mediumRiskJunctions =
      junctionRiskAnalyses.filter(
        (risk) =>
          risk.riskLevel ===
          "Medium",
      ).length;

    const lowRiskJunctions =
      junctionRiskAnalyses.filter(
        (risk) =>
          risk.riskLevel ===
          "Low",
      ).length;

    /**
     * Add the scores of all junctions.
     */
    const totalRiskScore =
      junctionRiskAnalyses.reduce(
        (total, risk) =>
          total +
          risk.riskScore,
        0,
      );

    /**
     * Use the average instead of only the total.
     *
     * This prevents a physically larger area from
     * automatically appearing more dangerous simply
     * because it contains more junctions.
     */
    const averageRiskScore =
      junctionRiskAnalyses.length > 0
        ? Number(
            (
              totalRiskScore /
              junctionRiskAnalyses.length
            ).toFixed(2),
          )
        : 0;

    /**
     * Uses the same thresholds as junction risk:
     *
     * 0–9   = Low
     * 10–24 = Medium
     * 25+   = High
     */
    const overallRiskLevel =
      RiskAnalysisService
        .classifyScore(
          averageRiskScore,
        );

    return {
      junctions:
        junctionsInsideArea,

      accidents:
        accidentsInsideArea,

      junctionRiskAnalyses,

      totalJunctions:
        junctionsInsideArea.length,

      totalAccidents:
        accidentsInsideArea.length,

      totalFatalities,

      totalInjuries,

      highRiskJunctions,

      mediumRiskJunctions,

      lowRiskJunctions,

      totalRiskScore,

      averageRiskScore,

      areaSquareKilometres:
        this.calculateArea(
          bounds,
        ),

      overallRiskLevel,
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

  private static calculateArea(
    bounds: MapBounds,
  ): number {
    const averageLatitude =
      (
        bounds.north +
        bounds.south
      ) / 2;

    const heightKilometres =
      Math.abs(
        bounds.north -
        bounds.south,
      ) * 111.32;

    const widthKilometres =
      Math.abs(
        bounds.east -
        bounds.west,
      ) *
      111.32 *
      Math.cos(
        (
          averageLatitude *
          Math.PI
        ) / 180,
      );

    return Number(
      (
        heightKilometres *
        widthKilometres
      ).toFixed(3),
    );
  }
}