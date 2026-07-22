import { interventions } from "../data/interventions";

export const InterventionService = {
  getAll() {
    return interventions;
  },

  getByJunctionId(junctionId: string) {
    return interventions.filter(
      (intervention) => intervention.junctionId === junctionId
    );
  },

  getById(id: string) {
    return interventions.find(
      (intervention) => intervention.id === id
    );
  },
};