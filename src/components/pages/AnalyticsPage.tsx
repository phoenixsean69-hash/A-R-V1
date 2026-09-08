import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ActiveElement,
  type ChartEvent,
  type Plugin,

} from "chart.js";
import {
  Bar,
  Doughnut,
  Line,
} from "react-chartjs-2";
import {
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Database,
  Filter,
  Gauge,
  Lightbulb,
  MapPin,
  RefreshCw,
  Users,
  type LucideIcon,
} from "../../components/icons/materialIcons";

import {
  AnalyticsAnalysisService,
  type AnalyticsFilters,
  type AnalyticsSeverityFilter,
} from "../../services/analyticsAnalysisService";

import "./AnalyticsPage.css";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const chartText =
  "#a9a9a9";

const chartGrid =
  "rgba(255,255,255,0.08)";

const panelSurface =
  "#232323";

const orange =
  "#e8872d";

const orangeSoft =
  "rgba(232,135,45,0.12)";

const orangeStrong =
  "rgba(232,135,45,0.8)";

const danger =
  "#cf7b83";

const dangerSoft =
  "rgba(207,123,131,0.10)";

const casualty =
  "#d0b071";

const casualtySoft =
  "rgba(208,176,113,0.12)";

const green =
  "#71b97f";

const greenSoft =
  "rgba(113,185,127,0.13)";

ChartJS.defaults.font.family =
  "Saira, sans-serif";

ChartJS.defaults.font.size =
  10;

ChartJS.defaults.color =
  chartText;

const chartSurfacePlugin:
  Plugin =
    {
      id:
        "roadsafeChartSurface",

      beforeDraw(
        chart,
      ) {
        const {
          ctx,
          chartArea,
        } = chart;

        if (
          !chartArea
        ) {
          return;
        }

        ctx.save();

        ctx.fillStyle =
          panelSurface;

        ctx.fillRect(
          chartArea.left,
          chartArea.top,
          chartArea.right -
            chartArea.left,
          chartArea.bottom -
            chartArea.top,
        );

        ctx.restore();
      },
    };

interface AnalyticsInteraction {
  eyebrow: string;
  title: string;
  summary: string;
  metrics: Array<{
    label: string;
    value: string;
  }>;
  action?: {
    label: string;
    kind:
      | "month"
      | "cause"
      | "junction"
      | "severity";
    value: string;
  };
}
function signed(
  value: number,
): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function changeText(
  value:
    | number
    | null,
): string {
  if (value === null) {
    return "No baseline";
  }

  if (value === 0) {
    return "No change";
  }

  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? "higher" : "lower"}`;
}

function comparisonTone(
  value:
    | number
    | null,
): string {
  if (
    value === null ||
    value === 0
  ) {
    return "is-neutral";
  }

  return value > 0
    ? "is-warning"
    : "is-positive";
}

function percentageWidth(
  value: number,
  max: number,
): string {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.max(
    2,
    Math.min(
      100,
      (value / max) * 100,
    ),
  )}%`;
}

function lineOptions(
  maxTicks = 6,
  onSelect?: (
    index: number,
  ) => void,
) {
  return {
    responsive:
      true,

    maintainAspectRatio:
      false,

    onClick: (
      _event: ChartEvent,
      elements: ActiveElement[],
    ) => {
      const index =
        elements[0]?.index;

      if (
        index !== undefined
      ) {
        onSelect?.(
          index,
        );
      }
    },


    interaction: {
      intersect:
        false,

      mode:
        "index" as const,
    },

    plugins: {
      legend: {
        display:
          false,
      },

      tooltip: {
        backgroundColor:
          "#1f1f1f",

        borderColor:
          "#4a4a4a",

        borderWidth: 1,

        titleColor:
          "#eeeeee",

        bodyColor:
          "#b7b7b7",

        displayColors:
          true,

        padding: 10,
      },
    },

    scales: {
      x: {
        ticks: {
          color:
            chartText,

          font: {
            size: 10,
          },

          maxRotation:
            0,

          autoSkip:
            true,

          maxTicksLimit:
            maxTicks,
        },

        grid: {
          color:
            chartGrid,
        },
      },

      y: {
        beginAtZero:
          true,

        ticks: {
          color:
            chartText,

          font: {
            size: 10,
          },

          precision:
            0,
        },

        grid: {
          color:
            chartGrid,
        },
      },
    },
  };
}

function barOptions(
  horizontal = false,
  onSelect?: (
    index: number,
  ) => void,
) {
  return {
    responsive:
      true,

    maintainAspectRatio:
      false,

    onClick: (
      _event: ChartEvent,
      elements: ActiveElement[],
    ) => {
      const index =
        elements[0]?.index;

      if (
        index !== undefined
      ) {
        onSelect?.(
          index,
        );
      }
    },


    indexAxis:
      horizontal
        ? ("y" as const)
        : ("x" as const),

    plugins: {
      legend: {
        display:
          false,
      },

      tooltip: {
        backgroundColor:
          "#1f1f1f",

        borderColor:
          "#4a4a4a",

        borderWidth: 1,

        titleColor:
          "#eeeeee",

        bodyColor:
          "#b7b7b7",

        displayColors:
          true,

        padding: 10,
      },
    },

    scales: {
      x: {
        beginAtZero:
          true,

        ticks: {
          color:
            chartText,

          font: {
            size: 10,
          },

          precision:
            0,
        },

        grid: {
          color:
            chartGrid,
        },
      },

      y: {
        ticks: {
          color:
            chartText,

          font: {
            size: 10,
          },
        },

        grid: {
          display:
            !horizontal,
          color:
            chartGrid,
        },
      },
    },
  };
}

function doughnutOptions(
  onSelect?: (
    index: number,
  ) => void,
) {
  return {
    responsive:
      true,

    maintainAspectRatio:
      false,

    onClick: (
      _event: ChartEvent,
      elements: ActiveElement[],
    ) => {
      const index =
        elements[0]?.index;

      if (
        index !== undefined
      ) {
        onSelect?.(
          index,
        );
      }
    },


    cutout:
      "62%",

    plugins: {
      legend: {
        display:
          true,

        position:
          "bottom" as const,

        labels: {
          color:
            chartText,

          boxWidth: 10,

          boxHeight: 10,

          padding: 12,

          font: {
            size: 10,
          },
        },
      },

      tooltip: {
        backgroundColor:
          "#1f1f1f",

        borderColor:
          "#4a4a4a",

        borderWidth: 1,

        titleColor:
          "#eeeeee",

        bodyColor:
          "#b7b7b7",

        displayColors:
          true,

        padding: 10,
      },
    },
  };
}

export default function AnalyticsPage() {
  const [
    filters,
    setFilters,
  ] = useState<AnalyticsFilters>(
    AnalyticsAnalysisService.emptyFilters(),
  );

  const [
    chartPage,
    setChartPage,
  ] = useState(0);
  const [
    interaction,
    setInteraction,
  ] =
    useState<AnalyticsInteraction | null>(
      null,
    );

  const model =
    useMemo(
      () =>
        AnalyticsAnalysisService.analyse(
          filters,
        ),
      [filters],
    );

  const updateFilter =
    <
      K extends keyof AnalyticsFilters,
    >(
      key: K,
      value:
        AnalyticsFilters[K],
    ) => {
      setFilters(
        (
          current,
        ) => ({
          ...current,
          [key]: value,
        }),
      );
    };

  const highestRisk =
    model.junctions[0];

  const peakTimeBand =
    [...model.timeBands]
      .sort(
        (
          left,
          right,
        ) =>
          right.accidents -
          left.accidents,
      )[0];

  const maxCauseCrashes =
    Math.max(
      1,
      ...model.causes.map(
        (row) =>
          row.accidents,
      ),
    );

  const activeFilterCount =
    [
      filters.junctionId,
      filters.severity !==
        "All"
        ? filters.severity
        : "",
      filters.cause,
      filters.weather,
      filters.startDate,
      filters.endDate,
    ].filter(Boolean)
      .length;

  const trendLabels =
    model.monthly.map(
      (item) =>
        item.label,
    );

  const severityMix =
    model.matrices.causeSeverity.reduce(
      (
        totals,
        row,
      ) => ({
        minor:
          totals.minor +
          row.minor,
        serious:
          totals.serious +
          row.serious,
        fatal:
          totals.fatal +
          row.fatal,
      }),
      {
        minor: 0,
        serious: 0,
        fatal: 0,
      },
    );

  const metricCards:
    Array<{
      label: string;
      value: string;
      note: string;
      icon: LucideIcon;
      accent?:
        | "orange"
        | "danger"
        | "neutral";
    }> = [
      {
        label:
          "Filtered crashes",
        value:
          String(
            model.kpis
              .totalAccidents,
          ),
        note:
          `${model.kpis.severeAccidents} serious / fatal`,
        icon:
          CarFront,
        accent:
          "orange",
      },
      {
        label:
          "Severe rate",
        value:
          `${model.kpis.severeRatePct}%`,
        note:
          "Serious + fatal",
        icon:
          AlertTriangle,
        accent:
          "danger",
      },
      {
        label:
          "Casualties",
        value:
          String(
            model.kpis
              .casualties,
          ),
        note:
          `${model.kpis.casualtiesPerAccident.toFixed(2)} per crash`,
        icon:
          Users,
        accent:
          "orange",
      },
      {
        label:
          "Severity index",
        value:
          `${model.kpis.severityIndex.toFixed(2)} / 5`,
        note:
          "Minor=1 - Serious=3 - Fatal=5",
        icon:
          Gauge,
        accent:
          "neutral",
      },
      {
        label:
          "Highest-risk junction",
        value:
          highestRisk
            ?.name ??
          "No junction data",
        note:
          highestRisk
            ? `Risk score: ${highestRisk.riskScore}`
            : "No filtered risk score",
        icon:
          MapPin,
        accent:
          "orange",
      },
      {
        label:
          "Peak time band",
        value:
          peakTimeBand
            ?.label ??
          "No time data",
        note:
          peakTimeBand
            ? `${peakTimeBand.sharePct}% of crashes`
            : "No filtered time pattern",
        icon:
          Clock3,
        accent:
          "orange",
      },
    ];

  const findings =
    model.findings.slice(
      0,
      4,
    );

  const setMonthSelection = (
    index: number,
    source: string,
  ): void => {
    const row =
      model.monthly[index];

    if (!row) {
      return;
    }

    const severeRate =
      row.accidents
        ? (
            (row.severeAccidents /
              row.accidents) *
            100
          ).toFixed(1)
        : "0.0";

    const intensity =
      row.accidents
        ? (
            row.casualties /
            row.accidents
          ).toFixed(2)
        : "0.00";

    setInteraction({
      eyebrow:
        source,
      title:
        row.label,
      summary:
        "Monthly crash statistics from the current analytical sample.",
      metrics: [
        {
          label:
            "Crashes",
          value:
            String(
              row.accidents,
            ),
        },
        {
          label:
            "Severe",
          value:
            `${severeRate}%`,
        },
        {
          label:
            "Casualties",
          value:
            String(
              row.casualties,
            ),
        },
        {
          label:
            "Casualties/crash",
          value:
            intensity,
        },
      ],
      action: {
        label:
          "Filter to month",
        kind:
          "month",
        value:
          row.key,
      },
    });
  };

  const setCauseSelection = (
    label: string,
  ): void => {
    const row =
      model.causes.find(
        (item) =>
          item.label ===
          label,
      );

    if (!row) {
      return;
    }

    setInteraction({
      eyebrow:
        "Cause diagnostic",
      title:
        row.label,
      summary:
        "Recorded cause statistics from the current filtered sample.",
      metrics: [
        {
          label:
            "Crashes",
          value:
            String(
              row.accidents,
            ),
        },
        {
          label:
            "Share",
          value:
            `${row.sharePct}%`,
        },
        {
          label:
            "Severe",
          value:
            `${row.severeRatePct}%`,
        },
        {
          label:
            "Casualties/crash",
          value:
            row.casualtiesPerAccident.toFixed(
              2,
            ),
        },
      ],
      action: {
        label:
          "Filter to cause",
        kind:
          "cause",
        value:
          row.label,
      },
    });
  };

  const setSeveritySelection = (
    index: number,
  ): void => {
    const labels:
      AnalyticsSeverityFilter[] = [
        "Minor",
        "Serious",
        "Fatal",
      ];

    const counts = [
      severityMix.minor,
      severityMix.serious,
      severityMix.fatal,
    ];

    const label =
      labels[index];

    if (!label) {
      return;
    }

    setInteraction({
      eyebrow:
        "Severity mix",
      title:
        label,
      summary:
        "Severity segment selected from the current filtered sample.",
      metrics: [
        {
          label:
            "Crashes",
          value:
            String(
              counts[index] ??
                0,
            ),
        },
        {
          label:
            "Filtered sample",
          value:
            String(
              model.kpis
                .totalAccidents,
            ),
        },
      ],
      action: {
        label:
          `Filter to ${label}`,
        kind:
          "severity",
        value:
          label,
      },
    });
  };

  const setJunctionSelection = (
    index: number,
  ): void => {
    const row =
      model.junctions
        .slice(
          0,
          5,
        )[index];

    if (!row) {
      return;
    }

    setInteraction({
      eyebrow:
        "Junction risk",
      title:
        row.name,
      summary:
        `${row.priority}. ${row.topCause} is the leading recorded cause.`,
      metrics: [
        {
          label:
            "Risk",
          value:
            String(
              row.riskScore,
            ),
        },
        {
          label:
            "Crashes",
          value:
            String(
              row.accidents,
            ),
        },
        {
          label:
            "Severe",
          value:
            `${row.severeRatePct}%`,
        },
        {
          label:
            "Peak",
          value:
            row.peakTimeBand,
        },
      ],
      action: {
        label:
          "Filter to junction",
        kind:
          "junction",
        value:
          row.id,
      },
    });
  };

  const setTimeSelection = (
    label: string,
  ): void => {
    const row =
      model.timeBands.find(
        (item) =>
          item.label ===
          label,
      );

    if (!row) {
      return;
    }

    setInteraction({
      eyebrow:
        "Time band",
      title:
        row.label,
      summary:
        "Time concentration for the current filtered crash sample.",
      metrics: [
        {
          label:
            "Crashes",
          value:
            String(
              row.accidents,
            ),
        },
        {
          label:
            "Share",
          value:
            `${row.sharePct}%`,
        },
        {
          label:
            "Severe",
          value:
            `${row.severeRatePct}%`,
        },
        {
          label:
            "Severity index",
          value:
            row.severityIndex.toFixed(
              2,
            ),
        },
      ],
    });
  };

  const setFindingSelection = (
    index: number,
  ): void => {
    const finding =
      findings[index];

    if (!finding) {
      return;
    }

    setInteraction({
      eyebrow:
        `${finding.level} finding`,
      title:
        finding.title,
      summary:
        finding.statement,
      metrics: [
        {
          label:
            "Evidence",
          value:
            finding.evidence,
        },
      ],
    });
  };

  const setSampleSelection =
    (): void => {
      setInteraction({
        eyebrow:
          "Current sample",
        title:
          `${model.kpis.totalAccidents} filtered crashes`,
        summary:
          `${model.kpis.severeAccidents} serious/fatal crashes and ${model.kpis.casualties} casualties are currently included.`,
        metrics: [
          {
            label:
              "Severe rate",
            value:
              `${model.kpis.severeRatePct}%`,
          },
          {
            label:
              "Severity index",
            value:
              model.kpis.severityIndex.toFixed(
                2,
              ),
          },
          {
            label:
              "Casualties/crash",
            value:
              model.kpis.casualtiesPerAccident.toFixed(
                2,
              ),
          },
        ],
      });
    };

  const handleKpiClick = (
    label: string,
  ): void => {
    if (
      label ===
        "Highest-risk junction"
    ) {
      setJunctionSelection(
        0,
      );
      return;
    }

    if (
      label ===
        "Peak time band" &&
      peakTimeBand
    ) {
      setTimeSelection(
        peakTimeBand.label,
      );
      return;
    }

    setSampleSelection();
  };

  const applyInteraction =
    (): void => {
      const action =
        interaction?.action;

      if (!action) {
        return;
      }

      if (
        action.kind ===
        "cause"
      ) {
        updateFilter(
          "cause",
          action.value,
        );
        return;
      }

      if (
        action.kind ===
        "junction"
      ) {
        updateFilter(
          "junctionId",
          action.value,
        );
        return;
      }

      if (
        action.kind ===
        "severity"
      ) {
        updateFilter(
          "severity",
          action.value as
            AnalyticsSeverityFilter,
        );
        return;
      }

      const [
        yearText,
        monthText,
      ] =
        action.value.split(
          "-",
        );

      const year =
        Number(
          yearText,
        );

      const month =
        Number(
          monthText,
        );

      if (
        !year ||
        !month
      ) {
        return;
      }

      const endDay =
        new Date(
          year,
          month,
          0,
        ).getDate();

      setFilters(
        (
          current,
        ) => ({
          ...current,
          startDate:
            `${action.value}-01`,
          endDate:
            `${action.value}-${String(
              endDay,
            ).padStart(
              2,
              "0",
            )}`,
        }),
      );
    };
  const chartCards:
    Array<{
      key: string;
      title: string;
      subtitle: string;
      icon: LucideIcon;
      tone:
        | "orange"
        | "danger"
        | "gold"
        | "green";
      chart:
        ReactNode;
    }> = [
      {
        key:
          "crash-volume",
        title:
          "Crash volume",
        subtitle:
          "All recorded crashes",
        icon:
          CarFront,
        tone:
          "orange",
        chart: (
          <Line
            plugins={[
              chartSurfacePlugin,
            ]}
            data={{
              labels:
                trendLabels,
              datasets: [
                {
                  label:
                    "All crashes",
                  data:
                    model.monthly.map(
                      (
                        item,
                      ) =>
                        item.accidents,
                    ),
                  borderColor:
                    orange,
                  backgroundColor:
                    orangeSoft,
                  fill:
                    true,
                  tension:
                    0.28,
                  pointRadius:
                    2,
                  pointHoverRadius:
                    4,
                  borderWidth:
                    2,
                },
              ],
            }}
            options={lineOptions(6, (index) => setMonthSelection(index, "Crash volume"))}
          />
        ),
      },
      {
        key:
          "severe-outcomes",
        title:
          "Severe outcomes",
        subtitle:
          "Serious + fatal crashes",
        icon:
          AlertTriangle,
        tone:
          "danger",
        chart: (
          <Line
            plugins={[
              chartSurfacePlugin,
            ]}
            data={{
              labels:
                trendLabels,
              datasets: [
                {
                  label:
                    "Serious + fatal",
                  data:
                    model.monthly.map(
                      (
                        item,
                      ) =>
                        item.severeAccidents,
                    ),
                  borderColor:
                    danger,
                  backgroundColor:
                    dangerSoft,
                  fill:
                    true,
                  tension:
                    0.28,
                  pointRadius:
                    2,
                  pointHoverRadius:
                    4,
                  borderWidth:
                    2,
                },
              ],
            }}
            options={lineOptions(6, (index) => setMonthSelection(index, "Severe outcomes"))}
          />
        ),
      },
      {
        key:
          "casualties",
        title:
          "Casualties",
        subtitle:
          "Fatalities + injuries",
        icon:
          Users,
        tone:
          "gold",
        chart: (
          <Bar
            plugins={[
              chartSurfacePlugin,
            ]}
            data={{
              labels:
                trendLabels,
              datasets: [
                {
                  label:
                    "Casualties",
                  data:
                    model.monthly.map(
                      (
                        item,
                      ) =>
                        item.casualties,
                    ),
                  backgroundColor:
                    casualtySoft,
                  borderColor:
                    casualty,
                  borderWidth:
                    1,
                  borderRadius:
                    3,
                  hoverBackgroundColor:
                    "rgba(208,176,113,0.24)",
                },
              ],
            }}
            options={barOptions(false, (index) => setMonthSelection(index, "Casualties"))}
          />
        ),
      },
      {
        key:
          "severe-rate",
        title:
          "Severe rate",
        subtitle:
          "Share of monthly crashes",
        icon:
          AlertTriangle,
        tone:
          "danger",
        chart: (
          <Line
            plugins={[
              chartSurfacePlugin,
            ]}
            data={{
              labels:
                trendLabels,
              datasets: [
                {
                  label:
                    "Severe rate %",
                  data:
                    model.monthly.map(
                      (
                        item,
                      ) =>
                        item.accidents
                          ? Number(
                              (
                                (item.severeAccidents /
                                  item.accidents) *
                                100
                              ).toFixed(
                                1,
                              ),
                            )
                          : 0,
                    ),
                  borderColor:
                    danger,
                  backgroundColor:
                    dangerSoft,
                  fill:
                    true,
                  tension:
                    0.3,
                  pointRadius:
                    2,
                  pointHoverRadius:
                    4,
                  borderWidth:
                    2,
                },
              ],
            }}
            options={lineOptions(6, (index) => setMonthSelection(index, "Severe rate"))}
          />
        ),
      },
      {
        key:
          "casualty-intensity",
        title:
          "Casualty intensity",
        subtitle:
          "Casualties per crash by month",
        icon:
          Gauge,
        tone:
          "green",
        chart: (
          <Line
            plugins={[
              chartSurfacePlugin,
            ]}
            data={{
              labels:
                trendLabels,
              datasets: [
                {
                  label:
                    "Casualties / crash",
                  data:
                    model.monthly.map(
                      (
                        item,
                      ) =>
                        item.accidents
                          ? Number(
                              (
                                item.casualties /
                                item.accidents
                              ).toFixed(
                                2,
                              ),
                            )
                          : 0,
                    ),
                  borderColor:
                    green,
                  backgroundColor:
                    greenSoft,
                  fill:
                    true,
                  tension:
                    0.3,
                  pointRadius:
                    2,
                  pointHoverRadius:
                    4,
                  borderWidth:
                    2,
                },
              ],
            }}
            options={lineOptions(6, (index) => setMonthSelection(index, "Casualty intensity"))}
          />
        ),
      },
      {
        key:
          "severity-mix",
        title:
          "Severity mix",
        subtitle:
          "Minor, serious and fatal share",
        icon:
          BarChart3,
        tone:
          "orange",
        chart: (
          <Doughnut
            data={{
              labels: [
                "Minor",
                "Serious",
                "Fatal",
              ],
              datasets: [
                {
                  data: [
                    severityMix.minor,
                    severityMix.serious,
                    severityMix.fatal,
                  ],
                  backgroundColor: [
                    orangeStrong,
                    danger,
                    "#7a3c42",
                  ],
                  borderColor:
                    "#232323",
                  borderWidth:
                    2,
                  hoverOffset:
                    4,
                },
              ],
            }}
            options={doughnutOptions(setSeveritySelection)}
          />
        ),
      },
      {
        key:
          "cause-share",
        title:
          "Cause share",
        subtitle:
          "Top recorded causes",
        icon:
          Activity,
        tone:
          "orange",
        chart: (
          <Doughnut
            data={{
              labels:
                model.causes
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (
                      row,
                    ) =>
                      row.label,
                  ),
              datasets: [
                {
                  data:
                    model.causes
                      .slice(
                        0,
                        6,
                      )
                      .map(
                        (
                          row,
                        ) =>
                          row.accidents,
                      ),
                  backgroundColor: [
                    "#e8872d",
                    "#cf7b83",
                    "#d0b071",
                    "#71b97f",
                    "#7f8cc7",
                    "#6bb8c8",
                  ],
                  borderColor:
                    "#232323",
                  borderWidth:
                    2,
                  hoverOffset:
                    4,
                },
              ],
            }}
            options={doughnutOptions((index) => {
              const row =
                model.causes
                  .slice(
                    0,
                    6,
                  )[index];

              if (row) {
                setCauseSelection(
                  row.label,
                );
              }
            })}
          />
        ),
      },
      {
        key:
          "junction-risk",
        title:
          "Junction risk",
        subtitle:
          "Top weighted risk scores",
        icon:
          MapPin,
        tone:
          "orange",
        chart: (
          <Bar
            plugins={[
              chartSurfacePlugin,
            ]}
            data={{
              labels:
                model.junctions
                  .slice(
                    0,
                    5,
                  )
                  .map(
                    (
                      row,
                    ) =>
                      row.name,
                  ),
              datasets: [
                {
                  label:
                    "Risk score",
                  data:
                    model.junctions
                      .slice(
                        0,
                        5,
                      )
                      .map(
                        (
                          row,
                        ) =>
                          row.riskScore,
                      ),
                  backgroundColor:
                    orangeSoft,
                  borderColor:
                    orange,
                  borderWidth:
                    1,
                  borderRadius:
                    3,
                },
              ],
            }}
            options={barOptions(true, setJunctionSelection)}
          />
        ),
      },
    ];

  const chartSlides =
    useMemo(
      () => {
        const pages:
          typeof chartCards[] =
            [];

        for (
          let index = 0;
          index <
          chartCards.length;
          index += 2
        ) {
          pages.push(
            chartCards.slice(
              index,
              index + 2,
            ),
          );
        }

        return pages;
      },
      [chartCards],
    );

  const safeChartPage =
    Math.min(
      chartPage,
      Math.max(
        chartSlides.length -
          1,
        0,
      ),
    );

  return (
    <div className="roadsafe-analytics-page">
      <section className="roadsafe-analytics-topbar">
        <div className="roadsafe-analytics-heading">
          <div className="roadsafe-analytics-heading__icon">
            <BarChart3
              size={21}
            />
          </div>

          <div>
            <h1>
              Analytics
            </h1>

            <p>
              Traffic safety intelligence
            </p>
          </div>

          <span className="roadsafe-analytics-quality-pill">
            <Database
              size={13}
            />

            {model.dataSufficiency.label}
            <b>
              {model.kpis.totalAccidents}
            </b>
            records
          </span>
        </div>

        <div className="roadsafe-analytics-filterbar">
          <AnalyticsFilter
            label="Junction"
            icon={MapPin}
          >
            <select
              value={
                filters.junctionId
              }
              onChange={(
                event,
              ) =>
                updateFilter(
                  "junctionId",
                  event.target.value,
                )
              }
            >
              <option value="">
                All junctions
              </option>

              {model.filterOptions.junctions.map(
                (
                  junction,
                ) => (
                  <option
                    key={
                      junction.id
                    }
                    value={
                      junction.id
                    }
                  >
                    {
                      junction.name
                    }
                  </option>
                ),
              )}
            </select>
          </AnalyticsFilter>

          <AnalyticsFilter
            label="Severity"
            icon={AlertTriangle}
          >
            <select
              value={
                filters.severity
              }
              onChange={(
                event,
              ) =>
                updateFilter(
                  "severity",
                  event.target
                    .value as
                    AnalyticsSeverityFilter,
                )
              }
            >
              <option value="All">
                All severities
              </option>
              <option value="Minor">
                Minor
              </option>
              <option value="Serious">
                Serious
              </option>
              <option value="Fatal">
                Fatal
              </option>
            </select>
          </AnalyticsFilter>

          <AnalyticsFilter
            label="Cause"
            icon={Activity}
          >
            <select
              value={
                filters.cause
              }
              onChange={(
                event,
              ) =>
                updateFilter(
                  "cause",
                  event.target.value,
                )
              }
            >
              <option value="">
                All causes
              </option>

              {model.filterOptions.causes.map(
                (
                  cause,
                ) => (
                  <option
                    key={cause}
                    value={cause}
                  >
                    {cause}
                  </option>
                ),
              )}
            </select>
          </AnalyticsFilter>

          <AnalyticsFilter
            label="Weather"
            icon={Cloud}
          >
            <select
              value={
                filters.weather
              }
              onChange={(
                event,
              ) =>
                updateFilter(
                  "weather",
                  event.target.value,
                )
              }
            >
              <option value="">
                All weather
              </option>

              {model.filterOptions.weather.map(
                (
                  weather,
                ) => (
                  <option
                    key={
                      weather
                    }
                    value={
                      weather
                    }
                  >
                    {weather}
                  </option>
                ),
              )}
            </select>
          </AnalyticsFilter>

          <AnalyticsFilter
            label="From"
            icon={CalendarDays}
          >
            <input
              type="date"
              value={
                filters.startDate
              }
              onChange={(
                event,
              ) =>
                updateFilter(
                  "startDate",
                  event.target.value,
                )
              }
            />
          </AnalyticsFilter>

          <AnalyticsFilter
            label="To"
            icon={CalendarDays}
          >
            <input
              type="date"
              value={
                filters.endDate
              }
              onChange={(
                event,
              ) =>
                updateFilter(
                  "endDate",
                  event.target.value,
                )
              }
            />
          </AnalyticsFilter>

          <button
            type="button"
            className="roadsafe-analytics-reset"
            disabled={
              activeFilterCount ===
              0
            }
            onClick={() =>
              setFilters(
                AnalyticsAnalysisService.emptyFilters(),
              )
            }
          >
            <RefreshCw
              size={14}
            />

            Reset

            {activeFilterCount >
              0 && (
              <span>
                {
                  activeFilterCount
                }
              </span>
            )}
          </button>
        </div>
      </section>

      <section className="roadsafe-analytics-kpis">
        {metricCards.map(
          ({
            label,
            value,
            note,
            icon: Icon,
            accent =
              "neutral",
          }) => (
            <article
              key={label}
              className={`roadsafe-analytics-kpi is-${accent}`}
            role="button"
              tabIndex={0}
              onClick={() =>
                handleKpiClick(
                  label,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();

                  handleKpiClick(
                    label,
                  );
                }
              }}
            >
              <div className="roadsafe-analytics-kpi__icon">
                <Icon
                  size={18}
                />
              </div>

              <div className="roadsafe-analytics-kpi__copy">
                <span>
                  {label}
                </span>

                <strong>
                  {value}
                </strong>

                <small>
                  {note}
                </small>
              </div>
            </article>
          ),
        )}
      </section>

      <section className="roadsafe-analytics-primary-grid">
        <section className="roadsafe-analytics-panel roadsafe-analytics-chartdeck">
          <div className="roadsafe-analytics-chartdeck__header">
            <PanelHeader
              icon={Activity}
              title="Analytics charts"
              subtitle="Eight charts are available. Two are shown at a time."
            />

            <div className="roadsafe-analytics-chartdeck__controls">
              <button
                type="button"
                onClick={() =>
                  setChartPage(
                    (
                      current,
                    ) =>
                      Math.max(
                        current - 1,
                        0,
                      ),
                  )
                }
                disabled={
                  safeChartPage ===
                  0
                }
                aria-label="Previous chart slide"
              >
                <ChevronLeft
                  size={16}
                />
              </button>

              <span>
                {chartSlides.length
                  ? safeChartPage +
                    1
                  : 0}
                /
                {
                  chartSlides.length
                }
              </span>

              <button
                type="button"
                onClick={() =>
                  setChartPage(
                    (
                      current,
                    ) =>
                      Math.min(
                        current + 1,
                        chartSlides.length -
                          1,
                      ),
                  )
                }
                disabled={
                  safeChartPage >=
                  chartSlides.length -
                    1
                }
                aria-label="Next chart slide"
              >
                <ChevronRight
                  size={16}
                />
              </button>
            </div>
          </div>

          <div className="roadsafe-analytics-chartdeck__viewport">
            {chartSlides.length ? (
              <div className="roadsafe-analytics-chartdeck__grid">
                {chartSlides[
                  safeChartPage
                ].map(
                  (
                    chart,
                  ) => (
                    <AnalyticsChartCard
                      key={
                        chart.key
                      }
                      title={
                        chart.title
                      }
                      subtitle={
                        chart.subtitle
                      }
                      icon={
                        chart.icon
                      }
                      tone={
                        chart.tone
                      }
                    >
                      {
                        chart.chart
                      }
                    </AnalyticsChartCard>
                  ),
                )}
              </div>
            ) : (
              <EmptyBlock
                text="No chart data for the current filters."
              />
            )}
          </div>

          <div className="roadsafe-analytics-chartdeck__dots">
            {chartSlides.map(
              (
                _slide,
                index,
              ) => (
                <button
                  key={index}
                  type="button"
                  className={
                    index ===
                    safeChartPage
                      ? "is-active"
                      : ""
                  }
                  aria-label={`Show chart slide ${index + 1}`}
                  onClick={() =>
                    setChartPage(
                      index,
                    )
                  }
                />
              ),
            )}
          </div>
                  <div className="roadsafe-analytics-chart-context">
            <button
              type="button"
              className="roadsafe-analytics-context-card"
              onClick={
                setSampleSelection
              }
            >
              <Database
                size={17}
              />

              <span>
                <small>
                  Current sample
                </small>

                <strong>
                  {model.kpis.totalAccidents} crashes
                </strong>

                <em>
                  {model.kpis.severeRatePct}% severe - {model.kpis.casualties} casualties
                </em>
              </span>
            </button>

            <button
              type="button"
              className="roadsafe-analytics-context-card"
              disabled={
                !highestRisk
              }
              onClick={() =>
                setJunctionSelection(
                  0,
                )
              }
            >
              <MapPin
                size={17}
              />

              <span>
                <small>
                  Highest risk
                </small>

                <strong>
                  {highestRisk?.name ?? "No junction"}
                </strong>

                <em>
                  {highestRisk
                    ? `Score ${highestRisk.riskScore} - ${highestRisk.priority}`
                    : "No junction risk available"}
                </em>
              </span>
            </button>

            <button
              type="button"
              className="roadsafe-analytics-context-card"
              disabled={
                !peakTimeBand
              }
              onClick={() => {
                if (
                  peakTimeBand
                ) {
                  setTimeSelection(
                    peakTimeBand.label,
                  );
                }
              }}
            >
              <Clock3
                size={17}
              />

              <span>
                <small>
                  Peak period
                </small>

                <strong>
                  {peakTimeBand?.label ?? "No time band"}
                </strong>

                <em>
                  {peakTimeBand
                    ? `${peakTimeBand.sharePct}% share - ${peakTimeBand.severeRatePct}% severe`
                    : "No time pattern available"}
                </em>
              </span>
            </button>

            <article className="roadsafe-analytics-selected-datum">
              <Activity
                size={17}
              />

              <div>
                <small>
                  {interaction?.eyebrow ?? "Selected datum"}
                </small>

                <strong>
                  {interaction?.title ?? "Click a point, bar or slice"}
                </strong>

                <p>
                  {interaction?.summary ??
                    "Chart selections show their supporting statistics here."}
                </p>

                {interaction && (
                  <div className="roadsafe-analytics-selected-datum__metrics">
                    {interaction.metrics.map(
                      (
                        metric,
                      ) => (
                        <span
                          key={
                            metric.label
                          }
                        >
                          <small>
                            {
                              metric.label
                            }
                          </small>

                          <b>
                            {
                              metric.value
                            }
                          </b>
                        </span>
                      ),
                    )}
                  </div>
                )}

                {interaction?.action && (
                  <div className="roadsafe-analytics-selected-datum__actions">
                    <button
                      type="button"
                      onClick={
                        applyInteraction
                      }
                    >
                      {
                        interaction.action
                          .label
                      }
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setInteraction(
                          null,
                        )
                      }
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </article>
          </div>
</section>

        <section className="roadsafe-analytics-panel roadsafe-analytics-findings">
          <PanelHeader
            icon={Lightbulb}
            title="Key findings"
            subtitle="Highest-priority signals in the filtered sample"
          />

          <div className="roadsafe-analytics-findings__list">
            {findings.length ? (
              findings.map(
                (
                  finding,
                  index,
                ) => (
                  <article
                    key={
                      finding.id
                    }
                    className="roadsafe-analytics-finding"
                  role="button"
                    tabIndex={0}
                    onClick={() =>
                      setFindingSelection(
                        index,
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();

                        setFindingSelection(
                          index,
                        );
                      }
                    }}
                  >
                    <span
                      className={`roadsafe-analytics-finding__rank is-${finding.level.toLowerCase()}`}
                    >
                      {index + 1}
                    </span>

                    <div>
                      <strong>
                        {
                          finding.title
                        }
                      </strong>

                      <p>
                        {
                          finding.statement
                        }
                      </p>

                      <small>
                        {
                          finding.evidence
                        }
                      </small>
                    </div>
                  </article>
                ),
              )
            ) : (
              <EmptyBlock
                text="No findings for the current filters."
              />
            )}
          </div>

          <div className="roadsafe-analytics-filter-summary">
            <div>
              <Filter
                size={15}
              />

              <span>
                Filters applied
              </span>

              <strong>
                {
                  activeFilterCount
                }
              </strong>
            </div>

            <p>
              {model.kpis.totalAccidents} of{" "}
              {model.totalDatasetAccidents} accident records
              currently contribute to this view.
            </p>
          </div>
        </section>
      </section>

      <section className="roadsafe-analytics-board-grid">
        <section className="roadsafe-analytics-panel roadsafe-analytics-time">
          <PanelHeader
            icon={Clock3}
            title="Time bands"
            subtitle="Crash share and severe-outcome rate"
          />

          <div className="roadsafe-analytics-time__legend">
            <span>
              <i className="is-orange" />
              Share
            </span>

            <span>
              <i className="is-danger" />
              Severe
            </span>
          </div>

          <div className="roadsafe-analytics-time__rows">
            {model.timeBands.map(
              (
                row,
              ) => (
                <div
                  key={
                    row.label
                  }
                  className="roadsafe-analytics-time-row"
                role="button"
                  tabIndex={0}
                  onClick={() =>
                    setTimeSelection(
                      row.label,
                    )
                  }
                >
                  <strong>
                    {row.label}
                  </strong>

                  <div className="roadsafe-analytics-time-row__bars">
                    <span>
                      <i
                        className="is-orange"
                        style={{
                          width:
                            `${Math.min(
                              100,
                              row.sharePct,
                            )}%`,
                        }}
                      />
                    </span>

                    <span>
                      <i
                        className="is-danger"
                        style={{
                          width:
                            `${Math.min(
                              100,
                              row.severeRatePct,
                            )}%`,
                        }}
                      />
                    </span>
                  </div>

                  <div className="roadsafe-analytics-time-row__values">
                    <span>
                      {row.sharePct}%
                    </span>

                    <span>
                      {row.severeRatePct}%
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="roadsafe-analytics-panel roadsafe-analytics-causes">
          <PanelHeader
            icon={BarChart3}
            title="Cause ranking"
            subtitle="Crashes and share of filtered sample"
          />

          <div className="roadsafe-analytics-cause-head">
            <span>
              Cause
            </span>
            <span>
              Crashes
            </span>
            <span>
              Share
            </span>
          </div>

          <div className="roadsafe-analytics-cause-list">
            {model.causes
              .slice(
                0,
                8,
              )
              .map(
                (
                  row,
                ) => (
                  <div
                    key={
                      row.label
                    }
                    className="roadsafe-analytics-cause-row"
                  role="button"
                    tabIndex={0}
                    onClick={() =>
                      setCauseSelection(
                        row.label,
                      )
                    }
                  >
                    <strong>
                      {
                        row.label
                      }
                    </strong>

                    <div className="roadsafe-analytics-cause-row__bar">
                      <i
                        style={{
                          width:
                            percentageWidth(
                              row.accidents,
                              maxCauseCrashes,
                            ),
                        }}
                      />
                    </div>

                    <span>
                      {
                        row.accidents
                      }
                    </span>

                    <span>
                      {
                        row.sharePct
                      }%
                    </span>
                  </div>
                ),
              )}
          </div>
        </section>

        <section className="roadsafe-analytics-panel roadsafe-analytics-comparison">
          <PanelHeader
            icon={Activity}
            title="Comparable period"
            subtitle="Latest year vs same prior-year period"
          />

          {model.comparablePeriod.latestYear ===
          null ? (
            <EmptyBlock
              text="No comparable dated records."
            />
          ) : (
            <div className="roadsafe-analytics-comparison__rows">
              <CompactComparison
                label="Crash count"
                current={
                  model.comparablePeriod
                    .latestAccidents
                }
                previous={
                  model.comparablePeriod
                    .previousAccidents
                }
                change={
                  model.comparablePeriod
                    .accidentChangePct
                }
              />

              <CompactComparison
                label="Serious + fatal"
                current={
                  model.comparablePeriod
                    .latestSevere
                }
                previous={
                  model.comparablePeriod
                    .previousSevere
                }
                change={
                  model.comparablePeriod
                    .severeChangePct
                }
              />

              <CompactComparison
                label="Casualties"
                current={
                  model.comparablePeriod
                    .latestCasualties
                }
                previous={
                  model.comparablePeriod
                    .previousCasualties
                }
                change={
                  model.comparablePeriod
                    .casualtyChangePct
                }
              />

              <p className="roadsafe-analytics-comparison__note">
                Counts are not exposure-adjusted crash rates.
              </p>
            </div>
          )}
        </section>

        <section className="roadsafe-analytics-panel roadsafe-analytics-junctions">
          <PanelHeader
            icon={MapPin}
            title="Junction risk"
            subtitle="Top junctions by weighted risk score"
          />

          <div className="roadsafe-analytics-junction-head">
            <span>
              #
            </span>
            <span>
              Junction
            </span>
            <span>
              Crashes
            </span>
            <span>
              Risk
            </span>
          </div>

          <div className="roadsafe-analytics-junction-list">
            {model.junctions
              .slice(
                0,
                5,
              )
              .map(
                (
                  junction,
                  index,
                ) => (
                  <div
                    key={
                      junction.id
                    }
                    className={
                      index === 0
                        ? "is-top"
                        : ""
                    }
                  role="button"
                    tabIndex={0}
                    onClick={() =>
                      setJunctionSelection(
                        index,
                      )
                    }
                  >
                    <span>
                      {index + 1}
                    </span>

                    <strong>
                      {
                        junction.name
                      }
                    </strong>

                    <span>
                      {
                        junction.accidents
                      }
                    </span>

                    <b>
                      {
                        junction.riskScore
                      }
                    </b>
                  </div>
                ),
              )}
          </div>
        </section>
      </section>

      <details className="roadsafe-analytics-advanced">
        <summary>
          <span>
            <Activity
              size={16}
            />

            Advanced analysis
          </span>

          <small>
            Matrices, full diagnostics, day-of-week patterns and data-quality guardrails
          </small>
        </summary>

        <div className="roadsafe-analytics-advanced__content">
          <section className="roadsafe-analytics-advanced-grid">
            <AdvancedTable
              title="Time-of-day diagnostic"
              subtitle="Frequency, share, severe rate and severity index"
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Time band
                    </th>
                    <th>
                      Crashes
                    </th>
                    <th>
                      Share
                    </th>
                    <th>
                      Severe
                    </th>
                    <th>
                      Index
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {model.timeBands.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.label
                        }
                      >
                        <td>
                          {
                            row.label
                          }
                        </td>
                        <td>
                          {
                            row.accidents
                          }
                        </td>
                        <td>
                          {
                            row.sharePct
                          }%
                        </td>
                        <td>
                          {
                            row.severeRatePct
                          }%
                        </td>
                        <td>
                          {
                            row.severityIndex.toFixed(
                              2,
                            )
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </AdvancedTable>

            <AdvancedTable
              title="Cause diagnostic"
              subtitle="Frequency, severity uplift and casualty intensity"
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Cause
                    </th>
                    <th>
                      Crashes
                    </th>
                    <th>
                      Share
                    </th>
                    <th>
                      Severe
                    </th>
                    <th>
                      Uplift
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {model.causes.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.label
                        }
                      >
                        <td>
                          {
                            row.label
                          }
                        </td>
                        <td>
                          {
                            row.accidents
                          }
                        </td>
                        <td>
                          {
                            row.sharePct
                          }%
                        </td>
                        <td>
                          {
                            row.severeRatePct
                          }%
                        </td>
                        <td>
                          {
                            signed(
                              row.severeRateDeltaPct,
                            )
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </AdvancedTable>

            <SeverityMatrix
              title="Cause x severity"
              subtitle="Recorded cause cross-tabulation"
              rows={
                model.matrices.causeSeverity.map(
                  (
                    row,
                  ) => ({
                    label:
                      row.cause,
                    minor:
                      row.minor,
                    serious:
                      row.serious,
                    fatal:
                      row.fatal,
                    total:
                      row.total,
                  }),
                )
              }
            />

            <SeverityMatrix
              title="Weather x severity"
              subtitle="Weather category cross-tabulation"
              rows={
                model.matrices.weatherSeverity.map(
                  (
                    row,
                  ) => ({
                    label:
                      row.weather,
                    minor:
                      row.minor,
                    serious:
                      row.serious,
                    fatal:
                      row.fatal,
                    total:
                      row.total,
                  }),
                )
              }
            />
          </section>

          <AdvancedTable
            title="Full junction diagnostics"
            subtitle="RoadSafe weighted-risk ranking for the current filtered sample"
          >
            <table className="is-wide">
              <thead>
                <tr>
                  <th>
                    Rank / junction
                  </th>
                  <th>
                    Risk
                  </th>
                  <th>
                    Crashes
                  </th>
                  <th>
                    Severe rate
                  </th>
                  <th>
                    Casualties/crash
                  </th>
                  <th>
                    Cause
                  </th>
                  <th>
                    Peak time
                  </th>
                  <th>
                    Priority
                  </th>
                </tr>
              </thead>

              <tbody>
                {model.junctions.map(
                  (
                    junction,
                    index,
                  ) => (
                    <tr
                      key={
                        junction.id
                      }
                    >
                      <td>
                        #{index + 1}{" "}
                        <b>
                          {
                            junction.name
                          }
                        </b>
                      </td>
                      <td>
                        {
                          junction.riskScore
                        }
                      </td>
                      <td>
                        {
                          junction.accidents
                        }
                      </td>
                      <td>
                        {
                          junction.severeRatePct
                        }%
                      </td>
                      <td>
                        {
                          junction.casualtiesPerAccident.toFixed(
                            2,
                          )
                        }
                      </td>
                      <td>
                        {
                          junction.topCause
                        }
                      </td>
                      <td>
                        {
                          junction.peakTimeBand
                        }
                      </td>
                      <td>
                        {
                          junction.priority
                        }
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </AdvancedTable>

          <section className="roadsafe-analytics-limits">
            <PanelHeader
              icon={Database}
              title="Analytical limits / data quality"
              subtitle="Guardrails against over-interpreting a small prototype dataset"
            />

            <div>
              <article>
                <strong>
                  Prototype register
                </strong>

                <p>
                  Demonstration records must be replaced with verified police or research data before substantive conclusions are reported.
                </p>
              </article>

              <article>
                <strong>
                  No exposure denominator
                </strong>

                <p>
                  Junction comparisons are counts and weighted severity scores, not true exposure-adjusted crash rates.
                </p>
              </article>

              <article>
                <strong>
                  Small categories are unstable
                </strong>

                <p>
                  One or two crashes can easily create 0% or 100% severe rates. Always interpret the sample count beside the rate.
                </p>
              </article>

              <article>
                <strong>
                  Association is not causation
                </strong>

                <p>
                  Cause, weather and time comparisons identify recorded associations and do not independently prove causation.
                </p>
              </article>
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}

function AnalyticsFilter({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className="roadsafe-analytics-filter">
      <span>
        <Icon
          size={13}
        />

        {label}
      </span>

      {children}
    </label>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="roadsafe-analytics-panel-header">
      <div className="roadsafe-analytics-panel-header__icon">
        <Icon
          size={17}
        />
      </div>

      <div>
        <h2>
          {title}
        </h2>

        <p>
          {subtitle}
        </p>
      </div>
    </header>
  );
}

function AnalyticsChartCard({
  icon: Icon,
  title,
  subtitle,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone:
    | "orange"
    | "danger"
    | "gold"
    | "green";
  children: ReactNode;
}) {
  return (
    <article className="roadsafe-analytics-chart-card">
      <header>
        <div className={`roadsafe-analytics-chart-card__icon is-${tone}`}>
          <Icon
            size={16}
          />
        </div>

        <div className="roadsafe-analytics-chart-card__copy">
          <strong>
            {title}
          </strong>

          <small>
            {subtitle}
          </small>
        </div>
      </header>

      <div className="roadsafe-analytics-chart-card__plot">
        {children}
      </div>
    </article>
  );
}

function CompactComparison({
  label,
  current,
  previous,
  change,
}: {
  label: string;
  current: number;
  previous: number;
  change:
    | number
    | null;
}) {
  return (
    <article className="roadsafe-analytics-comparison-row">
      <strong>
        {label}
      </strong>

      <span>
        {current} vs {previous}
      </span>

      <b
        className={
          comparisonTone(
            change,
          )
        }
      >
        {changeText(
          change,
        )}
      </b>
    </article>
  );
}

function EmptyBlock({
  text,
}: {
  text: string;
}) {
  return (
    <div className="roadsafe-analytics-empty">
      {text}
    </div>
  );
}

function AdvancedTable({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="roadsafe-analytics-advanced-card">
      <header>
        <strong>
          {title}
        </strong>

        <small>
          {subtitle}
        </small>
      </header>

      <div className="roadsafe-analytics-table-wrap">
        {children}
      </div>
    </section>
  );
}

function SeverityMatrix({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{
    label: string;
    minor: number;
    serious: number;
    fatal: number;
    total: number;
  }>;
}) {
  return (
    <AdvancedTable
      title={title}
      subtitle={subtitle}
    >
      <table>
        <thead>
          <tr>
            <th>
              Category
            </th>
            <th>
              Total
            </th>
            <th>
              Minor
            </th>
            <th>
              Serious
            </th>
            <th>
              Fatal
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
            ) => (
              <tr
                key={
                  row.label
                }
              >
                <td>
                  {
                    row.label
                  }
                </td>
                <td>
                  {
                    row.total
                  }
                </td>
                <td>
                  {
                    row.minor
                  }
                </td>
                <td>
                  {
                    row.serious
                  }
                </td>
                <td>
                  {
                    row.fatal
                  }
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </AdvancedTable>
  );
}