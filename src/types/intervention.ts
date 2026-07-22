export interface Intervention {
  id: string;
  junctionId: string;
  type:
    | "Roundabout"
    | "Traffic Lights"
    | "Pedestrian Crossing"
    | "Speed Hump"
    | "Warning Sign";
  estimatedCost: number;
  expectedImprovement: number;
  description: string;
}