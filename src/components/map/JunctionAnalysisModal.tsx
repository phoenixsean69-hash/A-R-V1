import {
  useEffect,
  useMemo,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  JunctionAnalysisService,
} from "../../services/junctionAnalysisService";

import type {
  AnalysisBreakdownItem,
  RecommendationPriority,
} from "../../types/junctionAnalysis";

interface JunctionAnalysisModalProps {
  junctionId: string;
  onClose: () => void;
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  description?: string;
}

function MetricCard({
  label,
  value,
  description,
}: MetricCardProps) {
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>

      {description && (
        <p className="mt-1 text-xs leading-5 text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}

function getRiskClasses(
  riskLevel: "Low" | "Medium" | "High",
): string {
  switch (riskLevel) {
    case "High":
      return "border-red-200 bg-red-100 text-red-800";

    case "Medium":
      return "border-amber-200 bg-amber-100 text-amber-800";

    case "Low":
      return "border-green-200 bg-green-100 text-green-800";
  }
}

function getPriorityClasses(
  priority: RecommendationPriority,
): string {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700";

    case "Medium":
      return "bg-amber-100 text-amber-700";

    case "Low":
      return "bg-green-100 text-green-700";
  }
}

function getSeverityClasses(
  severity: string,
): string {
  switch (severity) {
    case "Fatal":
      return "bg-red-100 text-red-700";

    case "Serious":
      return "bg-amber-100 text-amber-700";

    default:
      return "bg-green-100 text-green-700";
  }
}

function formatDate(
  dateValue: string,
): string {
  const date = new Date(
    `${dateValue}T00:00:00`,
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

interface BreakdownChartProps {
  title: string;
  items: AnalysisBreakdownItem[];
  emptyMessage?: string;
}

function BreakdownChart({
  title,
  items,
  emptyMessage = "No records available.",
}: BreakdownChartProps) {
  const nonEmptyItems =
    items.filter(
      (item) =>
        item.count > 0,
    );

  return (
    <div className="rounded-sm border border-gray-200 bg-white p-5">
      <h3 className="font-bold text-gray-900">
        {title}
      </h3>

      {nonEmptyItems.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {nonEmptyItems.map(
            (item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-gray-700">
                    {item.label}
                  </span>

                  <span className="text-gray-500">
                    {item.count} (
                    {item.percentage}%)
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${Math.max(
                        item.percentage,
                        3,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function JunctionAnalysisModal({
  junctionId,
  onClose,
}: JunctionAnalysisModalProps) {
  const analysis = useMemo(
    () =>
      JunctionAnalysisService.analyse(
        junctionId,
      ),
    [junctionId],
  );

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);

  if (!analysis) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900">
            Junction not found
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-sm bg-red-600 px-7 py-3 font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const {
    junction,
    summary,
    risk,
  } = analysis;

  const maximumMonthlyAccidents =
    Math.max(
      ...analysis.monthlyTrend.map(
        (item) =>
          item.accidents,
      ),
      1,
    );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-gray-50 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-5 border-b border-gray-200 bg-white p-5 sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                {junction.name}
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${getRiskClasses(
                  risk.riskLevel,
                )}`}
              >
                {risk.riskLevel} Risk
              </span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              {junction.city} •{" "}
              {junction.roadType}
            </p>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
              {junction.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm bg-red-600 px-6 py-3 text-base font-bold text-white shadow-md transition hover:bg-red-700 active:scale-95"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-7">
          {/* Main metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Risk Score"
              value={risk.riskScore}
              description="Automatically calculated"
            />

            <MetricCard
              label="Accidents"
              value={summary.totalAccidents}
            />

            <MetricCard
              label="Fatalities"
              value={summary.fatalities}
            />

            <MetricCard
              label="Injuries"
              value={summary.injuries}
            />

            <MetricCard
              label="Common Cause"
              value={
                <span className="text-lg">
                  {summary.commonCause}
                </span>
              }
            />
          </div>

          {/* Severity */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {analysis.severityBreakdown.map(
              (item) => (
                <div
                  key={item.label}
                  className="rounded-sm border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${getSeverityClasses(
                        item.label,
                      )}`}
                    >
                      {item.label}
                    </span>

                    <span className="text-xs text-gray-500">
                      {item.percentage}%
                    </span>
                  </div>

                  <p className="mt-4 text-3xl font-bold text-gray-900">
                    {item.count}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Recorded accidents
                  </p>
                </div>
              ),
            )}
          </div>

          {/* Monthly trend */}
          <div className="mt-6 rounded-sm border border-gray-200 bg-white p-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Accident Trend by Month
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Recorded accident frequency,
                fatalities and injuries.
              </p>
            </div>

            {analysis.monthlyTrend.length ===
            0 ? (
              <p className="mt-5 text-sm text-gray-500">
                No monthly accident data
                is available.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {analysis.monthlyTrend.map(
                  (month) => (
                    <div
                      key={
                        month.monthKey
                      }
                      className="grid items-center gap-3 sm:grid-cols-[100px_1fr_190px]"
                    >
                      <span className="text-sm font-semibold text-gray-700">
                        {
                          month.monthLabel
                        }
                      </span>

                      <div className="h-7 overflow-hidden rounded-lg bg-gray-100">
                        <div
                          className="flex h-full items-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"
                          style={{
                            width: `${Math.max(
                              (month.accidents /
                                maximumMonthlyAccidents) *
                                100,
                              8,
                            )}%`,
                          }}
                        >
                          {
                            month.accidents
                          }
                        </div>
                      </div>

                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>
                          Fatalities:{" "}
                          {
                            month.fatalities
                          }
                        </span>

                        <span>
                          Injuries:{" "}
                          {month.injuries}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Pattern charts */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <BreakdownChart
              title="Common Accident Causes"
              items={
                analysis.causeBreakdown
              }
            />

            <BreakdownChart
              title="Weather Conditions"
              items={
                analysis.weatherBreakdown
              }
            />
          </div>

          {/* Time analysis */}
          <div className="mt-6 rounded-sm border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-bold text-gray-900">
              High-Risk Times of Day
            </h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {analysis.timeOfDayBreakdown.map(
                (period) => (
                  <div
                    key={
                      period.label
                    }
                    className="rounded-sm border border-gray-200 bg-gray-50 p-4"
                  >
                    <p className="font-bold text-gray-900">
                      {period.label}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {period.timeRange}
                    </p>

                    <p className="mt-4 text-2xl font-bold text-blue-700">
                      {period.count}
                    </p>

                    <p className="text-xs text-gray-500">
                      {
                        period.percentage
                      }
                      % of records
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="mt-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Recommended Safety
                Interventions
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Current recommendations
                use rule-based analysis.
                AI recommendations will be
                integrated later.
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {analysis.recommendations.map(
                (recommendation) => (
                  <div
                    key={
                      recommendation.id
                    }
                    className="rounded-sm border border-gray-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-bold text-gray-900">
                        {
                          recommendation.title
                        }
                      </h4>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getPriorityClasses(
                          recommendation.priority,
                        )}`}
                      >
                        {
                          recommendation.priority
                        }{" "}
                        Priority
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {
                        recommendation.reason
                      }
                    </p>

                    <div className="mt-4 space-y-2">
                      {recommendation.actions.map(
                        (action) => (
                          <div
                            key={action}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <span className="mt-1 text-blue-600">
                              ●
                            </span>

                            <span>
                              {action}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Recent accident records */}
          <div className="mt-6 overflow-hidden rounded-sm border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="text-lg font-bold text-gray-900">
                Recent Accident Records
              </h3>
            </div>

            {analysis.recentAccidents
              .length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                No accidents have been
                recorded for this junction.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 font-semibold text-gray-600">
                        Date
                      </th>

                      <th className="px-5 py-3 font-semibold text-gray-600">
                        Severity
                      </th>

                      <th className="px-5 py-3 font-semibold text-gray-600">
                        Cause
                      </th>

                      <th className="px-5 py-3 font-semibold text-gray-600">
                        Weather
                      </th>

                      <th className="px-5 py-3 font-semibold text-gray-600">
                        Fatalities
                      </th>

                      <th className="px-5 py-3 font-semibold text-gray-600">
                        Injuries
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {analysis.recentAccidents.map(
                      (accident) => (
                        <tr
                          key={
                            accident.id
                          }
                          className="hover:bg-gray-50"
                        >
                          <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                            {formatDate(
                              accident.date,
                            )}
                            <span className="ml-2 text-xs text-gray-400">
                              {
                                accident.time
                              }
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${getSeverityClasses(
                                accident.severity,
                              )}`}
                            >
                              {
                                accident.severity
                              }
                            </span>
                          </td>

                          <td className="px-5 py-4 text-gray-700">
                            {
                              accident.cause
                            }
                          </td>

                          <td className="px-5 py-4 text-gray-700">
                            {
                              accident.weather
                            }
                          </td>

                          <td className="px-5 py-4 font-semibold text-gray-900">
                            {
                              accident.fatalities
                            }
                          </td>

                          <td className="px-5 py-4 font-semibold text-gray-900">
                            {
                              accident.injuries
                            }
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}