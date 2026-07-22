import { recommendations } from "../data/recommendations";
import { InterventionService } from "./interventionService";

export const RecommendationService = {
  getByJunctionId(junctionId: string) {
    const recommendation = recommendations.find(
      (r) => r.junctionId === junctionId
    );

    if (!recommendation) return null;

    return {
      ...recommendation,
      intervention: InterventionService.getById(
        recommendation.recommendedInterventionId
      ),
    };
  },
};