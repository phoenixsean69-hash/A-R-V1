export interface Accident {
  id: string;
  junctionId: string;
  date: string;
  time: string;
  severity: "Minor" | "Serious" | "Fatal";
  fatalities: number;
  injuries: number;
  vehiclesInvolved: number;
  cause: string;
  weather: string;
}