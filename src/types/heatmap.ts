import type { Accident } from "./accident";

export type HeatmapSeverityFilter =
  | "All"
  | Accident["severity"];

export interface AccidentHeatmapFilters {
  startDate: string;
  endDate: string;
  severity: HeatmapSeverityFilter;
  weather: string;
  cause: string;
}

export interface AccidentHeatmapFilterOptions {
  weatherConditions: string[];
  causes: string[];
  minimumDate: string;
  maximumDate: string;
}

export function createDefaultHeatmapFilters(): AccidentHeatmapFilters {
  return {
    startDate: "",
    endDate: "",
    severity: "All",
    weather: "All",
    cause: "All",
  };
}