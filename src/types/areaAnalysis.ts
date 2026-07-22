import type {
  Junction,
} from "./junction";

import type {
  Accident,
} from "./accident";

import type {
  JunctionRiskAnalysis,
  RiskLevel,
} from "./risk";

export type AreaRiskLevel =
  RiskLevel;

export interface AreaAnalysis {
  junctions: Junction[];
  accidents: Accident[];

  /**
   * Automatically calculated risk analysis
   * for every junction inside the area.
   */
  junctionRiskAnalyses:
    JunctionRiskAnalysis[];

  totalJunctions: number;
  totalAccidents: number;
  totalFatalities: number;
  totalInjuries: number;

  highRiskJunctions: number;
  mediumRiskJunctions: number;
  lowRiskJunctions: number;

  /**
   * Sum of the risk scores of all junctions
   * inside the selected area.
   */
  totalRiskScore: number;

  /**
   * Average junction risk score.
   *
   * This is used to classify the overall
   * risk level of the selected area.
   */
  averageRiskScore: number;

  areaSquareKilometres: number;

  overallRiskLevel:
    AreaRiskLevel;
}