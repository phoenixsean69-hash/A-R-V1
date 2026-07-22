export interface Recommendation {
  id: string;
  junctionId: string;
  recommendedInterventionId: string;
  confidence: number;
  reason: string;
}