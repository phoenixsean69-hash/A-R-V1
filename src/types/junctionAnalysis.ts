import type { Accident } from "./accident";
import type {
  AccidentSummary,
  Junction,
} from "./junction";
import type { JunctionRiskAnalysis } from "./risk";

export interface AnalysisBreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

export interface MonthlyAccidentTrend {
  monthKey: string;
  monthLabel: string;
  accidents: number;
  fatalities: number;
  injuries: number;
}

export interface TimePeriodAnalysis {
  label: string;
  timeRange: string;
  count: number;
  percentage: number;
}

export type RecommendationPriority =
  | "High"
  | "Medium"
  | "Low";

export interface SafetyRecommendation {
  id: string;
  title: string;
  reason: string;
  priority: RecommendationPriority;
  actions: string[];
}

export interface JunctionAnalysis {
  junction: Junction;
  summary: AccidentSummary;
  risk: JunctionRiskAnalysis;

  severityBreakdown: AnalysisBreakdownItem[];
  causeBreakdown: AnalysisBreakdownItem[];
  weatherBreakdown: AnalysisBreakdownItem[];
  timeOfDayBreakdown: TimePeriodAnalysis[];

  monthlyTrend: MonthlyAccidentTrend[];
  recentAccidents: Accident[];

  recommendations: SafetyRecommendation[];
}