import type { Accident } from "../types/accident";

import type {
  AnalysisBreakdownItem,
  JunctionAnalysis,
  MonthlyAccidentTrend,
  SafetyRecommendation,
  TimePeriodAnalysis,
} from "../types/junctionAnalysis";

import { AccidentService } from "./accidentService";
import { JunctionService } from "./junctionService";
import { RiskAnalysisService } from "./riskAnalysisService";

function calculatePercentage(
  count: number,
  total: number,
): number {
  if (total === 0) {
    return 0;
  }

  return Number(
    ((count / total) * 100).toFixed(1),
  );
}

function createBreakdown(
  values: string[],
): AnalysisBreakdownItem[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const cleanedValue =
      value.trim() || "Unknown";

    counts.set(
      cleanedValue,
      (counts.get(cleanedValue) ?? 0) + 1,
    );
  });

  const total = values.length;

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: calculatePercentage(
        count,
        total,
      ),
    }))
    .sort(
      (first, second) =>
        second.count - first.count,
    );
}

function createSeverityBreakdown(
  accidents: Accident[],
): AnalysisBreakdownItem[] {
  const severityOrder: Accident["severity"][] = [
    "Fatal",
    "Serious",
    "Minor",
  ];

  return severityOrder.map((severity) => {
    const count = accidents.filter(
      (accident) =>
        accident.severity === severity,
    ).length;

    return {
      label: severity,
      count,
      percentage: calculatePercentage(
        count,
        accidents.length,
      ),
    };
  });
}

function createMonthlyTrend(
  accidents: Accident[],
): MonthlyAccidentTrend[] {
  const monthlyData = new Map<
    string,
    {
      accidents: number;
      fatalities: number;
      injuries: number;
    }
  >();

  accidents.forEach((accident) => {
    const monthKey =
      accident.date.slice(0, 7);

    const existing =
      monthlyData.get(monthKey) ?? {
        accidents: 0,
        fatalities: 0,
        injuries: 0,
      };

    existing.accidents += 1;
    existing.fatalities +=
      accident.fatalities;
    existing.injuries +=
      accident.injuries;

    monthlyData.set(
      monthKey,
      existing,
    );
  });

  return Array.from(
    monthlyData.entries(),
  )
    .sort(([firstMonth], [secondMonth]) =>
      firstMonth.localeCompare(secondMonth),
    )
    .map(([monthKey, values]) => {
      const [year, month] =
        monthKey.split("-");

      const date = new Date(
        Number(year),
        Number(month) - 1,
        1,
      );

      const monthLabel =
        new Intl.DateTimeFormat(
          "en-GB",
          {
            month: "short",
            year: "numeric",
          },
        ).format(date);

      return {
        monthKey,
        monthLabel,
        ...values,
      };
    });
}

function getTimePeriod(
  time: string,
): {
  label: string;
  timeRange: string;
} {
  const hour = Number(
    time.split(":")[0],
  );

  if (hour >= 0 && hour < 6) {
    return {
      label: "Early Morning",
      timeRange: "00:00–05:59",
    };
  }

  if (hour < 12) {
    return {
      label: "Morning",
      timeRange: "06:00–11:59",
    };
  }

  if (hour < 17) {
    return {
      label: "Afternoon",
      timeRange: "12:00–16:59",
    };
  }

  if (hour < 21) {
    return {
      label: "Evening",
      timeRange: "17:00–20:59",
    };
  }

  return {
    label: "Night",
    timeRange: "21:00–23:59",
  };
}

function createTimeOfDayBreakdown(
  accidents: Accident[],
): TimePeriodAnalysis[] {
  const periods = [
    {
      label: "Early Morning",
      timeRange: "00:00–05:59",
    },
    {
      label: "Morning",
      timeRange: "06:00–11:59",
    },
    {
      label: "Afternoon",
      timeRange: "12:00–16:59",
    },
    {
      label: "Evening",
      timeRange: "17:00–20:59",
    },
    {
      label: "Night",
      timeRange: "21:00–23:59",
    },
  ];

  const counts = new Map<string, number>();

  accidents.forEach((accident) => {
    const period = getTimePeriod(
      accident.time,
    );

    counts.set(
      period.label,
      (counts.get(period.label) ?? 0) + 1,
    );
  });

  return periods
    .map((period) => {
      const count =
        counts.get(period.label) ?? 0;

      return {
        ...period,
        count,
        percentage:
          calculatePercentage(
            count,
            accidents.length,
          ),
      };
    })
    .sort(
      (first, second) =>
        second.count - first.count,
    );
}

function sortAccidentsByNewest(
  accidents: Accident[],
): Accident[] {
  return [...accidents].sort(
    (first, second) => {
      const firstDate = new Date(
        `${first.date}T${first.time}`,
      ).getTime();

      const secondDate = new Date(
        `${second.date}T${second.time}`,
      ).getTime();

      return secondDate - firstDate;
    },
  );
}

function createRecommendations(
  accidents: Accident[],
  riskLevel: "Low" | "Medium" | "High",
): SafetyRecommendation[] {
  const recommendations =
    new Map<
      string,
      SafetyRecommendation
    >();

  const addRecommendation = (
    recommendation: SafetyRecommendation,
  ) => {
    recommendations.set(
      recommendation.id,
      recommendation,
    );
  };

  const causes = accidents.map(
    (accident) =>
      accident.cause.toLowerCase(),
  );

  const weatherConditions =
    accidents.map(
      (accident) =>
        accident.weather.toLowerCase(),
    );

  const totalFatalities =
    accidents.reduce(
      (total, accident) =>
        total + accident.fatalities,
      0,
    );

  if (
    causes.some(
      (cause) =>
        cause.includes("speed") ||
        cause.includes("overtaking"),
    )
  ) {
    addRecommendation({
      id: "speed-management",
      title: "Introduce speed-management measures",
      reason:
        "Speeding or dangerous overtaking appears in the accident history.",
      priority: "High",
      actions: [
        "Install speed humps or rumble strips",
        "Add visible speed-limit signs",
        "Conduct targeted speed enforcement",
        "Consider speed-camera monitoring",
      ],
    });
  }

  if (
    causes.some(
      (cause) =>
        cause.includes("visibility") ||
        cause.includes("parking"),
    )
  ) {
    addRecommendation({
      id: "visibility-improvement",
      title: "Improve junction visibility",
      reason:
        "Poor visibility or obstructive parking contributes to recorded accidents.",
      priority: "High",
      actions: [
        "Remove visual obstructions",
        "Improve street lighting",
        "Add no-parking road markings",
        "Install blindspot warning signs",
      ],
    });
  }

  if (
    causes.some(
      (cause) =>
        cause.includes("pedestrian"),
    )
  ) {
    addRecommendation({
      id: "pedestrian-protection",
      title: "Strengthen pedestrian protection",
      reason:
        "Pedestrian movement has been identified as an accident factor.",
      priority: "High",
      actions: [
        "Install a marked pedestrian crossing",
        "Add pedestrian warning signs",
        "Improve roadside lighting",
        "Consider pedestrian guardrails",
      ],
    });
  }

  if (
    causes.some(
      (cause) =>
        cause.includes("give way") ||
        cause.includes("illegal turn"),
    )
  ) {
    addRecommendation({
      id: "traffic-control",
      title: "Improve traffic-control guidance",
      reason:
        "Right-of-way and turning conflicts appear in the accident records.",
      priority: "Medium",
      actions: [
        "Install or improve Give Way signs",
        "Add directional lane arrows",
        "Repaint faded road markings",
        "Review junction turning movements",
      ],
    });
  }

  if (
    weatherConditions.some(
      (weather) =>
        weather.includes("rain"),
    )
  ) {
    addRecommendation({
      id: "wet-weather-safety",
      title: "Improve wet-weather road safety",
      reason:
        "Some accidents occurred during rainy conditions.",
      priority: "Medium",
      actions: [
        "Inspect stormwater drainage",
        "Repair water-collection areas",
        "Use skid-resistant road surfacing",
        "Install wet-road warning signs",
      ],
    });
  }

  if (
    riskLevel === "High" ||
    totalFatalities > 0
  ) {
    addRecommendation({
      id: "formal-road-audit",
      title: "Conduct an urgent road-safety audit",
      reason:
        "The calculated risk level or casualty history requires formal investigation.",
      priority: "High",
      actions: [
        "Conduct an on-site engineering assessment",
        "Observe traffic during peak periods",
        "Review police accident reports",
        "Prioritise the junction for intervention funding",
      ],
    });
  }

  if (recommendations.size === 0) {
    addRecommendation({
      id: "continued-monitoring",
      title: "Continue monitoring the junction",
      reason:
        "Current records do not indicate an urgent intervention requirement.",
      priority: "Low",
      actions: [
        "Continue collecting accident reports",
        "Inspect road signs and markings periodically",
        "Track changes in traffic volume",
      ],
    });
  }

  return Array.from(
    recommendations.values(),
  );
}

export const JunctionAnalysisService = {
  analyse(
    junctionId: string,
  ): JunctionAnalysis | null {
    const junction =
      JunctionService.getById(
        junctionId,
      );

    if (!junction) {
      return null;
    }

    const accidents =
      AccidentService.getByJunctionId(
        junctionId,
      );

    const summary =
      AccidentService.getSummary(
        junctionId,
      );

    const risk =
      RiskAnalysisService
        .analyseJunction(
          junctionId,
        );

    return {
      junction,
      summary,
      risk,

      severityBreakdown:
        createSeverityBreakdown(
          accidents,
        ),

      causeBreakdown:
        createBreakdown(
          accidents.map(
            (accident) =>
              accident.cause,
          ),
        ),

      weatherBreakdown:
        createBreakdown(
          accidents.map(
            (accident) =>
              accident.weather,
          ),
        ),

      timeOfDayBreakdown:
        createTimeOfDayBreakdown(
          accidents,
        ),

      monthlyTrend:
        createMonthlyTrend(
          accidents,
        ),

      recentAccidents:
        sortAccidentsByNewest(
          accidents,
        ).slice(0, 8),

      recommendations:
        createRecommendations(
          accidents,
          risk.riskLevel,
        ),
    };
  },
};