import type { Intervention } from "../types/intervention";

export const interventions: Intervention[] = [
  {
    id: "1",
    junctionId: "1",
    type: "Roundabout",
    estimatedCost: 45000,
    expectedImprovement: 70,
    description: "Reduce conflict points and improve traffic flow.",
  },
  {
    id: "2",
    junctionId: "1",
    type: "Traffic Lights",
    estimatedCost: 30000,
    expectedImprovement: 55,
    description: "Control vehicle movement during peak hours.",
  },
];