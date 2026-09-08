import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Download,
  Filter,
  Map,
  MapPin,
  RotateCcw,
  ShieldAlert,
  Skull,
  SlidersHorizontal,
  Users,
} from "../../components/icons/materialIcons";

import AccidentMap, {
  type VisualizationMode,
} from "../../components/map/AccidentMap";
import { AccidentFilterService } from "../../services/accidentFilterService";
import { AccidentService } from "../../services/accidentService";
import { JunctionService } from "../../services/junctionService";
import type { Accident } from "../../types/accident";
import {
  createDefaultHeatmapFilters,
  type AccidentHeatmapFilters,
} from "../../types/heatmap";

import "./SceneMapPage.css";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone?:
    | "neutral"
    | "warning"
    | "danger";
  onClick: () => void;
}

interface MapFocusRequest {
  junctionId: string;
  nonce: number;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  onClick,
}: MetricCardProps) {
  return (
    <button
      type="button"
      className={`scene-map-metric is-${tone}`}
      onClick={onClick}
      title={detail}
    >
      <span className="scene-map-metric__icon">
        <Icon
          size={17}
          strokeWidth={1.8}
        />
      </span>

      <span className="scene-map-metric__copy">
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>

        <em>
          {detail}
        </em>
      </span>
    </button>
  );
}

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      `${value}T00:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return (
      value ||
      "Unknown"
    );
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function escapeCsv(
  value:
    | string
    | number,
): string {
  const text =
    String(
      value ?? "",
    );

  return `"${text.replace(
    /"/g,
    '""',
  )}"`;
}

function downloadAccidentCsv(
  accidents: Accident[],
): void {
  const header = [
    "Accident ID",
    "Junction ID",
    "Date",
    "Time",
    "Severity",
    "Fatalities",
    "Injuries",
    "Vehicles involved",
    "Cause",
    "Weather",
  ];

  const rows =
    accidents.map(
      (
        accident,
      ) => [
        accident.id,
        accident.junctionId,
        accident.date,
        accident.time,
        accident.severity,
        accident.fatalities,
        accident.injuries,
        accident.vehiclesInvolved,
        accident.cause,
        accident.weather,
      ],
    );

  const csv = [
    header
      .map(
        escapeCsv,
      )
      .join(","),
    ...rows.map(
      (
        row,
      ) =>
        row
          .map(
            escapeCsv,
          )
          .join(","),
    ),
  ].join("\n");

  const blob =
    new Blob(
      [
        "\uFEFF",
        csv,
      ],
      {
        type:
          "text/csv;charset=utf-8",
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href =
    url;

  anchor.download =
    `roadsafe-scene-map-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url,
      ),
    0,
  );
}

function countActiveFilters(
  filters:
    AccidentHeatmapFilters,
): number {
  return [
    filters.startDate,
    filters.endDate,
    filters.severity !==
    "All"
      ? filters.severity
      : "",
    filters.weather !==
    "All"
      ? filters.weather
      : "",
    filters.cause !==
    "All"
      ? filters.cause
      : "",
  ].filter(Boolean).length;
}

function getRiskClass(
  riskLevel:
    | "Low"
    | "Medium"
    | "High",
): string {
  return `is-${riskLevel.toLowerCase()}`;
}

function getSeverityClass(
  severity: string,
): string {
  if (
    severity === "Fatal"
  ) {
    return "is-fatal";
  }

  if (
    severity ===
    "Serious"
  ) {
    return "is-serious";
  }

  return "is-minor";
}

export default function SceneMapPage() {
  const [
    mode,
    setMode,
  ] =
    useState<VisualizationMode>(
      "markers",
    );

  const [
    filters,
    setFilters,
  ] =
    useState<AccidentHeatmapFilters>(
      () =>
        createDefaultHeatmapFilters(),
    );

  const [
    focusRequest,
    setFocusRequest,
  ] =
    useState<
      MapFocusRequest | undefined
    >(undefined);

  const allAccidents =
    useMemo(
      () =>
        AccidentService.getAll(),
      [],
    );

  const allJunctions =
    useMemo(
      () =>
        JunctionService.getAll(),
      [],
    );

  const allJunctionsWithRisk =
    useMemo(
      () =>
        [
          ...JunctionService.getAllWithRisk(),
        ].sort(
          (
            first,
            second,
          ) =>
            second.risk
              .riskScore -
              first.risk
                .riskScore ||
            second.risk
              .totalAccidents -
              first.risk
                .totalAccidents,
        ),
      [],
    );

  const filterOptions =
    useMemo(
      () =>
        AccidentFilterService.getOptions(
          allAccidents,
        ),
      [allAccidents],
    );

  const filteredAccidents =
    useMemo(
      () =>
        AccidentFilterService.filter(
          allAccidents,
          filters,
        ),
      [
        allAccidents,
        filters,
      ],
    );

  const totals =
    useMemo(
      () => {
        const fatalities =
          filteredAccidents.reduce(
            (
              sum,
              accident,
            ) =>
              sum +
              accident.fatalities,
            0,
          );

        const injuries =
          filteredAccidents.reduce(
            (
              sum,
              accident,
            ) =>
              sum +
              accident.injuries,
            0,
          );

        const seriousOrFatal =
          filteredAccidents.filter(
            (
              accident,
            ) =>
              accident.severity ===
                "Serious" ||
              accident.severity ===
                "Fatal",
          ).length;

        const affectedJunctions =
          new Set(
            filteredAccidents.map(
              (
                accident,
              ) =>
                accident.junctionId,
            ),
          ).size;

        return {
          fatalities,
          injuries,
          seriousOrFatal,
          affectedJunctions,
        };
      },
      [filteredAccidents],
    );

  const recentAccidents =
    useMemo(
      () =>
        [
          ...filteredAccidents,
        ]
          .sort(
            (
              first,
              second,
            ) =>
              `${second.date}T${second.time}`.localeCompare(
                `${first.date}T${first.time}`,
              ),
          )
          .slice(
            0,
            6,
          ),
      [filteredAccidents],
    );

  const activeFilterCount =
    countActiveFilters(
      filters,
    );

  const invalidDateRange =
    AccidentFilterService.hasInvalidDateRange(
      filters,
    );

  const highRiskCount =
    allJunctionsWithRisk.filter(
      (
        item,
      ) =>
        item.risk
          .riskLevel ===
        "High",
    ).length;

  const updateFilter =
    <
      Key extends keyof AccidentHeatmapFilters,
    >(
      key: Key,
      value:
        AccidentHeatmapFilters[Key],
    ) => {
      setFilters(
        (
          current,
        ) => ({
          ...current,
          [key]:
            value,
        }),
      );
    };

  const resetFilters =
    () => {
      setFilters(
        createDefaultHeatmapFilters(),
      );
    };

  const focusJunction =
    (
      junctionId: string,
    ) => {
      setMode(
        "markers",
      );

      setFocusRequest(
        (
          current,
        ) => ({
          junctionId,
          nonce:
            (current?.nonce ??
              0) + 1,
        }),
      );
    };

  const showAllRecords =
    () => {
      resetFilters();

      setMode(
        "heatmap",
      );
    };

  const showAffectedJunctions =
    () => {
      setMode(
        "markers",
      );
    };

  const showSevereActivity =
    () => {
      setMode(
        "heatmap",
      );
    };

  const showFatalActivity =
    () => {
      updateFilter(
        "severity",
        "Fatal",
      );

      setMode(
        "heatmap",
      );
    };

  const showInjuryActivity =
    () => {
      setMode(
        "heatmap",
      );
    };

  return (
    <div className="scene-map-page">
      <section
        className="scene-map-metrics"
        aria-label="Scene map summary"
      >
        <MetricCard
          label="Visible records"
          value={
            filteredAccidents.length
          }
          detail={`${allAccidents.length} total records`}
          icon={Activity}
          onClick={
            showAllRecords
          }
        />

        <MetricCard
          label="Affected junctions"
          value={
            totals.affectedJunctions
          }
          detail={`${allJunctions.length} mapped junctions`}
          icon={MapPin}
          onClick={
            showAffectedJunctions
          }
        />

        <MetricCard
          label="Serious / fatal"
          value={
            totals.seriousOrFatal
          }
          detail="Show severe activity"
          icon={ShieldAlert}
          tone="warning"
          onClick={
            showSevereActivity
          }
        />

        <MetricCard
          label="Fatalities"
          value={
            totals.fatalities
          }
          detail="Filter map to fatal crashes"
          icon={Skull}
          tone="danger"
          onClick={
            showFatalActivity
          }
        />

        <MetricCard
          label="Injuries"
          value={
            totals.injuries
          }
          detail={`${highRiskCount} high-risk junctions`}
          icon={Users}
          onClick={
            showInjuryActivity
          }
        />
      </section>

      <div className="scene-map-workspace">
        <section className="scene-map-map-panel">
          <header className="scene-map-map-header">
            <div className="scene-map-map-heading">
              <span className="scene-map-map-heading__icon">
                <Map
                  size={18}
                  strokeWidth={1.8}
                />
              </span>

              <div>
                <h1>
                  Road-safety intelligence map
                </h1>

                <p>
                  Junction risk, accident density and spatial analysis
                </p>
              </div>
            </div>

            <div className="scene-map-map-status">
              <span className="scene-map-status-pill">
                <Activity
                  size={12}
                  strokeWidth={2}
                />

                {mode ===
                "markers"
                  ? "Junction markers"
                  : "Accident heatmap"}
              </span>

              {activeFilterCount >
                0 && (
                <span className="scene-map-status-pill is-active">
                  <Filter
                    size={12}
                    strokeWidth={2}
                  />

                  {
                    activeFilterCount
                  }{" "}
                  filter
                  {activeFilterCount ===
                  1
                    ? ""
                    : "s"}
                </span>
              )}
            </div>
          </header>

          <div className="scene-map-stage">
            <AccidentMap
              visualizationMode={
                mode
              }
              onVisualizationModeChange={
                setMode
              }
              heatmapFilters={
                filters
              }
              compactSelectionPanel
              focusRequest={
                focusRequest
              }
            />
          </div>
        </section>

        <aside className="scene-map-rail">
          <section className="scene-map-rail-section">
            <header className="scene-map-section-header">
              <div>
                <SlidersHorizontal
                  size={16}
                  strokeWidth={1.8}
                />

                <span>
                  <strong>
                    Filters
                  </strong>

                  <small>
                    Update the map and incident data
                  </small>
                </span>
              </div>

              <b>
                {
                  filteredAccidents.length
                }
              </b>
            </header>

            <div className="scene-map-filter-grid">
              <label>
                <span>
                  Start date
                </span>

                <input
                  type="date"
                  min={
                    filterOptions.minimumDate ||
                    undefined
                  }
                  max={
                    filterOptions.maximumDate ||
                    undefined
                  }
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
              </label>

              <label>
                <span>
                  End date
                </span>

                <input
                  type="date"
                  min={
                    filterOptions.minimumDate ||
                    undefined
                  }
                  max={
                    filterOptions.maximumDate ||
                    undefined
                  }
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
              </label>

              <label>
                <span>
                  Severity
                </span>

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
                        AccidentHeatmapFilters["severity"],
                    )
                  }
                >
                  {[
                    "All",
                    "Minor",
                    "Serious",
                    "Fatal",
                  ].map(
                    (
                      severity,
                    ) => (
                      <option
                        key={
                          severity
                        }
                        value={
                          severity
                        }
                      >
                        {severity ===
                        "All"
                          ? "All severities"
                          : severity}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Weather
                </span>

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
                  <option value="All">
                    All weather
                  </option>

                  {filterOptions.weatherConditions.map(
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
                        {
                          weather
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="is-wide">
                <span>
                  Reported cause
                </span>

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
                  <option value="All">
                    All causes
                  </option>

                  {filterOptions.causes.map(
                    (
                      cause,
                    ) => (
                      <option
                        key={
                          cause
                        }
                        value={
                          cause
                        }
                      >
                        {
                          cause
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            {invalidDateRange && (
              <div className="scene-map-filter-warning">
                <AlertTriangle
                  size={14}
                  strokeWidth={1.8}
                />

                <span>
                  Start date must be before or equal to end date.
                </span>
              </div>
            )}

            <div className="scene-map-filter-actions">
              <button
                type="button"
                onClick={
                  resetFilters
                }
                disabled={
                  activeFilterCount ===
                  0
                }
              >
                <RotateCcw
                  size={13}
                  strokeWidth={1.8}
                />

                Reset
              </button>

              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  downloadAccidentCsv(
                    filteredAccidents,
                  )
                }
                disabled={
                  filteredAccidents.length ===
                  0
                }
              >
                <Download
                  size={13}
                  strokeWidth={1.8}
                />

                Export CSV
              </button>
            </div>
          </section>

          <section className="scene-map-rail-section">
            <header className="scene-map-section-header">
              <div>
                <BarChart3
                  size={16}
                  strokeWidth={1.8}
                />

                <span>
                  <strong>
                    Highest-risk junctions
                  </strong>

                  <small>
                    Click a row to locate it
                  </small>
                </span>
              </div>
            </header>

            <div className="scene-map-risk-list">
              {allJunctionsWithRisk
                .slice(
                  0,
                  5,
                )
                .map(
                  (
                    item,
                    index,
                  ) => (
                    <button
                      key={
                        item.junction
                          .id
                      }
                      type="button"
                      className="scene-map-risk-row"
                      onClick={() =>
                        focusJunction(
                          item.junction
                            .id,
                        )
                      }
                    >
                      <span className="scene-map-risk-row__rank">
                        {String(
                          index +
                            1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>

                      <span className="scene-map-risk-row__main">
                        <strong>
                          {
                            item
                              .junction
                              .name
                          }
                        </strong>

                        <small>
                          {
                            item
                              .junction
                              .roadType
                          }
                        </small>
                      </span>

                      <span className="scene-map-risk-row__stats">
                        <span>
                          <b>
                            {
                              item
                                .risk
                                .riskScore
                            }
                          </b>
                          risk
                        </span>

                        <span>
                          <b>
                            {
                              item
                                .risk
                                .totalAccidents
                            }
                          </b>
                          crashes
                        </span>

                        <span>
                          <b>
                            {item.risk
                              .fatalities +
                              item.risk
                                .injuries}
                          </b>
                          casualties
                        </span>
                      </span>

                      <span
                        className={`scene-map-risk-badge ${getRiskClass(
                          item.risk
                            .riskLevel,
                        )}`}
                      >
                        {
                          item.risk
                            .riskLevel
                        }
                      </span>

                      <ChevronRight
                        size={15}
                        strokeWidth={1.8}
                        className="scene-map-row-arrow"
                      />
                    </button>
                  ),
                )}
            </div>
          </section>

          <section className="scene-map-rail-section scene-map-incidents">
            <header className="scene-map-section-header">
              <div>
                <CalendarDays
                  size={16}
                  strokeWidth={1.8}
                />

                <span>
                  <strong>
                    Recent incidents
                  </strong>

                  <small>
                    Latest records matching filters
                  </small>
                </span>
              </div>
            </header>

            {recentAccidents.length ===
            0 ? (
              <div className="scene-map-empty">
                <strong>
                  No matching incidents
                </strong>

                <span>
                  Reset or broaden the current filters.
                </span>
              </div>
            ) : (
              <div className="scene-map-incident-list">
                {recentAccidents.map(
                  (
                    accident,
                  ) => {
                    const junction =
                      JunctionService.getById(
                        accident.junctionId,
                      );

                    return (
                      <button
                        key={
                          accident.id
                        }
                        type="button"
                        className="scene-map-incident-row"
                        onClick={() =>
                          focusJunction(
                            accident.junctionId,
                          )
                        }
                      >
                        <span className="scene-map-incident-row__top">
                          <strong>
                            {junction?.name ??
                              accident.junctionId}
                          </strong>

                          <span
                            className={`scene-map-severity-badge ${getSeverityClass(
                              accident.severity,
                            )}`}
                          >
                            {
                              accident.severity
                            }
                          </span>
                        </span>

                        <span className="scene-map-incident-row__meta">
                          {formatDate(
                            accident.date,
                          )}{" "}
                          -{" "}
                          {
                            accident.time
                          }
                        </span>

                        <span className="scene-map-incident-row__detail">
                          {
                            accident.cause
                          }{" "}
                          -{" "}
                          {
                            accident.weather
                          }
                        </span>

                        <span className="scene-map-incident-row__stats">
                          <span>
                            <b>
                              {
                                accident.fatalities
                              }
                            </b>{" "}
                            fatal
                          </span>

                          <span>
                            <b>
                              {
                                accident.injuries
                              }
                            </b>{" "}
                            injured
                          </span>

                          <span>
                            <b>
                              {
                                accident.vehiclesInvolved
                              }
                            </b>{" "}
                            vehicles
                          </span>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </section>

          <div className="scene-map-rail-note">
            <Filter
              size={14}
              strokeWidth={1.8}
            />

            <p>
              Accident filters update the heatmap, metrics, export and incident list.
              Junction markers continue to show the full risk register.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
