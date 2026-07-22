import { junctions } from "../data/junctions";
import { accidents } from "../data/accidents";

export const DashboardService = {
  getStats() {
    const totalJunctions = junctions.length;

    const totalAccidents = accidents.length;

    const totalFatalities = accidents.reduce(
      (sum, accident) => sum + accident.fatalities,
      0
    );

    const totalInjuries = accidents.reduce(
      (sum, accident) => sum + accident.injuries,
      0
    );

    const highRiskJunctions = junctions.filter(
      (junction) => junction.riskLevel === "High"
    ).length;

    return {
      totalJunctions,
      totalAccidents,
      totalFatalities,
      totalInjuries,
      highRiskJunctions,
    };
  },
};