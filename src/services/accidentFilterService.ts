import type { Accident } from "../types/accident";

import type {
  AccidentHeatmapFilterOptions,
  AccidentHeatmapFilters,
} from "../types/heatmap";

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function isDateRangeValid(
  filters: AccidentHeatmapFilters,
): boolean {
  if (
    !filters.startDate ||
    !filters.endDate
  ) {
    return true;
  }

  return (
    filters.startDate <=
    filters.endDate
  );
}

function matchesDateRange(
  accident: Accident,
  filters: AccidentHeatmapFilters,
): boolean {
  if (
    filters.startDate &&
    accident.date <
      filters.startDate
  ) {
    return false;
  }

  if (
    filters.endDate &&
    accident.date >
      filters.endDate
  ) {
    return false;
  }

  return true;
}

function matchesSeverity(
  accident: Accident,
  filters: AccidentHeatmapFilters,
): boolean {
  return (
    filters.severity === "All" ||
    accident.severity ===
      filters.severity
  );
}

function matchesWeather(
  accident: Accident,
  filters: AccidentHeatmapFilters,
): boolean {
  if (filters.weather === "All") {
    return true;
  }

  return (
    normalizeValue(accident.weather) ===
    normalizeValue(filters.weather)
  );
}

function matchesCause(
  accident: Accident,
  filters: AccidentHeatmapFilters,
): boolean {
  if (filters.cause === "All") {
    return true;
  }

  return (
    normalizeValue(accident.cause) ===
    normalizeValue(filters.cause)
  );
}

export const AccidentFilterService = {
  filter(
    accidents: Accident[],
    filters: AccidentHeatmapFilters,
  ): Accident[] {
    if (!isDateRangeValid(filters)) {
      return [];
    }

    return accidents.filter(
      (accident) =>
        matchesDateRange(
          accident,
          filters,
        ) &&
        matchesSeverity(
          accident,
          filters,
        ) &&
        matchesWeather(
          accident,
          filters,
        ) &&
        matchesCause(
          accident,
          filters,
        ),
    );
  },

  getOptions(
    accidents: Accident[],
  ): AccidentHeatmapFilterOptions {
    const weatherConditions =
      Array.from(
        new Set(
          accidents
            .map(
              (accident) =>
                accident.weather.trim(),
            )
            .filter(Boolean),
        ),
      ).sort((first, second) =>
        first.localeCompare(second),
      );

    const causes = Array.from(
      new Set(
        accidents
          .map(
            (accident) =>
              accident.cause.trim(),
          )
          .filter(Boolean),
      ),
    ).sort((first, second) =>
      first.localeCompare(second),
    );

    const dates = accidents
      .map(
        (accident) =>
          accident.date,
      )
      .filter(Boolean)
      .sort();

    return {
      weatherConditions,
      causes,
      minimumDate:
        dates[0] ?? "",
      maximumDate:
        dates[
          dates.length - 1
        ] ?? "",
    };
  },

  hasInvalidDateRange(
    filters: AccidentHeatmapFilters,
  ): boolean {
    return !isDateRangeValid(
      filters,
    );
  },
};