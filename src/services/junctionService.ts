import {
  junctions,
} from "../data/junctions";

import {
  RiskAnalysisService,
} from "./riskAnalysisService";

import type {
  Junction,
} from "../types/junction";

import type {
  JunctionRiskAnalysis,
  RiskLevel,
} from "../types/risk";

export interface JunctionWithRisk {
  junction: Junction;
  risk: JunctionRiskAnalysis;
}

export const JunctionService = {
  getAll(): Junction[] {
    return junctions;
  },

  getById(
    id: string,
  ): Junction | undefined {
    return junctions.find(
      (junction) =>
        junction.id === id,
    );
  },

  getAllWithRisk(): JunctionWithRisk[] {
    return junctions.map(
      (junction) => ({
        junction,

        risk:
          RiskAnalysisService
            .analyseJunction(
              junction.id,
            ),
      }),
    );
  },

  getByRiskLevel(
    riskLevel: RiskLevel,
  ): Junction[] {
    return junctions.filter(
      (junction) =>
        RiskAnalysisService
          .getRiskLevel(
            junction.id,
          ) === riskLevel,
    );
  },

  getHighRisk(): Junction[] {
    return this.getByRiskLevel(
      "High",
    );
  },

  getMediumRisk(): Junction[] {
    return this.getByRiskLevel(
      "Medium",
    );
  },

  getLowRisk(): Junction[] {
    return this.getByRiskLevel(
      "Low",
    );
  },
};