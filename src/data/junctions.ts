import type { Junction } from "../types/junction";

/**
 * riskLevel remains here for compatibility with the Junction interface.
 * The application now calculates the actual risk level automatically
 * from accident records using RiskAnalysisService.
 */
export const junctions: Junction[] = [
  {
    id: "1",
    name: "Chipadze Turn-off",
    city: "Bindura",
    latitude: -17.311863,
    longitude: 31.345441,
    roadType: "Intersection",
    description:
      "A busy turn-off connecting Chipadze and surrounding roads in Bindura.",
    riskLevel: "High",
  },
  {
    id: "2",
    name: "Bindura Pick n Pay Turn-off",
    city: "Bindura",
    latitude: -17.311182,
    longitude: 31.336976,
    roadType: "Turn-off",
    description:
      "A commercial-area turn-off with frequent vehicle and pedestrian movement.",
    riskLevel: "Medium",
  },
  {
    id: "3",
    name: "Masembura–Bindura Road Junction",
    city: "Bindura",
    latitude: -17.311375,
    longitude: 31.332636,
    roadType: "Intersection",
    description:
      "A road connection serving traffic moving between Bindura and Masembura.",
    riskLevel: "Low",
  },
  {
    id: "4",
    name: "Bindura Mall Blindspot",
    city: "Bindura",
    latitude: -17.308171,
    longitude: 31.333328,
    roadType: "Blindspot",
    description:
      "A visibility-risk area near Bindura Mall with vehicle and pedestrian activity.",
    riskLevel: "High",
  },
  {
    id: "5",
    name: "Bindura Town Terminus Blindspot",
    city: "Bindura",
    latitude: -17.310557,
    longitude: 31.334865,
    roadType: "Transport Terminus",
    description:
      "A busy public-transport zone affected by buses, taxis, pedestrians and limited visibility.",
    riskLevel: "High",
  },
];