import { AccidentService } from "../../services/accidentService";
import { AccidentFilterService } from "../../services/accidentFilterService";
import { JunctionService } from "../../services/junctionService";
import type { Accident } from "../../types/accident";
import type { AccidentHeatmapFilters } from "../../types/heatmap";
import { createDefaultHeatmapFilters } from "../../types/heatmap";
import type { MapBounds } from "../../types/map";

export interface AccidentHeatmapPoint {
  accidentId: string;
  junctionId: string;
  junctionName: string;
  latitude: number;
  longitude: number;
  severity: Accident["severity"];
  fatalities: number;
  injuries: number;
  cause: string;
  weather: string;
  date: string;
  weight: number;
}

function isInsideBounds(
  latitude: number,
  longitude: number,
  bounds?: MapBounds,
): boolean {
  if (!bounds) return true;
  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

export function calculateAccidentWeight(accident: Accident): number {
  let severityWeight = 2;
  if (accident.severity === "Serious") severityWeight = 5;
  if (accident.severity === "Fatal") severityWeight = 9;

  return Math.min(
    Number(
      (
        severityWeight +
        accident.fatalities * 5 +
        accident.injuries * 1.5 +
        accident.vehiclesInvolved * 0.5
      ).toFixed(2),
    ),
    20,
  );
}

export function getAccidentHeatmapPoints(
  bounds?: MapBounds,
  filters: AccidentHeatmapFilters = createDefaultHeatmapFilters(),
): AccidentHeatmapPoint[] {
  const accidents = AccidentFilterService.filter(AccidentService.getAll(), filters);
  const points: AccidentHeatmapPoint[] = [];

  accidents.forEach((accident) => {
    const junction = JunctionService.getById(accident.junctionId);
    if (!junction) return;
    if (!isInsideBounds(junction.latitude, junction.longitude, bounds)) return;

    points.push({
      accidentId: accident.id,
      junctionId: junction.id,
      junctionName: junction.name,
      latitude: junction.latitude,
      longitude: junction.longitude,
      severity: accident.severity,
      fatalities: accident.fatalities,
      injuries: accident.injuries,
      cause: accident.cause,
      weather: accident.weather,
      date: accident.date,
      weight: calculateAccidentWeight(accident),
    });
  });

  return points;
}
