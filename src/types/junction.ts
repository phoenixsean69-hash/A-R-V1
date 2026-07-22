export interface Junction {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  roadType: string;
  description: string;
  riskLevel: "Low" | "Medium" | "High";
}

export interface AccidentSummary {
  junctionId: string;
  totalAccidents: number;
  fatalities: number;
  injuries: number;
  commonCause: string;
  lastUpdated: string;
}