export type RiskLevel =
  | "Low"
  | "Medium"
  | "High";

export interface RiskScoreBreakdown {
  fatalitiesScore: number;
  seriousAccidentsScore: number;
  minorAccidentsScore: number;
  injuriesScore: number;
  totalAccidentsScore: number;
}

export interface JunctionRiskAnalysis {
  junctionId: string;

  riskLevel: RiskLevel;
  riskScore: number;

  totalAccidents: number;
  fatalAccidents: number;
  seriousAccidents: number;
  minorAccidents: number;

  fatalities: number;
  injuries: number;

  breakdown: RiskScoreBreakdown;
}