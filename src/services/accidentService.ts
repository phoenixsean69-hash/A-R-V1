import { accidents } from "../data/accidents";

import type { Accident } from "../types/accident";
import type { AccidentSummary } from "../types/junction";

function getAccidentsByJunction(
  junctionId: string,
): Accident[] {
  return accidents.filter(
    (accident) =>
      accident.junctionId === junctionId,
  );
}

function getMostCommonCause(
  junctionAccidents: Accident[],
): string {
  if (junctionAccidents.length === 0) {
    return "No accident records";
  }

  const causeCounts = new Map<
    string,
    number
  >();

  junctionAccidents.forEach((accident) => {
    const currentCount =
      causeCounts.get(accident.cause) ?? 0;

    causeCounts.set(
      accident.cause,
      currentCount + 1,
    );
  });

  const mostCommonCause = Array.from(
    causeCounts.entries(),
  ).sort(
    (first, second) =>
      second[1] - first[1],
  )[0];

  return (
    mostCommonCause?.[0] ??
    "Cause unavailable"
  );
}

function getLatestAccidentDate(
  junctionAccidents: Accident[],
): string {
  if (junctionAccidents.length === 0) {
    return "";
  }

  const sortedAccidents = [
    ...junctionAccidents,
  ].sort(
    (first, second) =>
      new Date(second.date).getTime() -
      new Date(first.date).getTime(),
  );

  return sortedAccidents[0]?.date ?? "";
}

export const AccidentService = {
  getAll(): Accident[] {
    return accidents;
  },

  getById(
    id: string,
  ): Accident | undefined {
    return accidents.find(
      (accident) => accident.id === id,
    );
  },

  getByJunctionId(
    junctionId: string,
  ): Accident[] {
    return getAccidentsByJunction(
      junctionId,
    );
  },

  getTotalAccidents(
    junctionId: string,
  ): number {
    return getAccidentsByJunction(
      junctionId,
    ).length;
  },

  getTotalFatalities(
    junctionId: string,
  ): number {
    return getAccidentsByJunction(
      junctionId,
    ).reduce(
      (total, accident) =>
        total + accident.fatalities,
      0,
    );
  },

  getTotalInjuries(
    junctionId: string,
  ): number {
    return getAccidentsByJunction(
      junctionId,
    ).reduce(
      (total, accident) =>
        total + accident.injuries,
      0,
    );
  },

  getFatalAccidents(
    junctionId: string,
  ): Accident[] {
    return getAccidentsByJunction(
      junctionId,
    ).filter(
      (accident) =>
        accident.severity === "Fatal",
    );
  },

  getSeriousAccidents(
    junctionId: string,
  ): Accident[] {
    return getAccidentsByJunction(
      junctionId,
    ).filter(
      (accident) =>
        accident.severity === "Serious",
    );
  },

  getSummary(
    junctionId: string,
  ): AccidentSummary {
    const junctionAccidents =
      getAccidentsByJunction(junctionId);

    const fatalities =
      junctionAccidents.reduce(
        (total, accident) =>
          total + accident.fatalities,
        0,
      );

    const injuries =
      junctionAccidents.reduce(
        (total, accident) =>
          total + accident.injuries,
        0,
      );

    return {
      junctionId,

      totalAccidents:
        junctionAccidents.length,

      fatalities,

      injuries,

      commonCause:
        getMostCommonCause(
          junctionAccidents,
        ),

      lastUpdated:
        getLatestAccidentDate(
          junctionAccidents,
        ),
    };
  },
};