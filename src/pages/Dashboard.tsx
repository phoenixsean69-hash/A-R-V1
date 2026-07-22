import {
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardStats from "../components/dashboard/DashboardStats";

import AccidentMap from "../components/map/AccidentMap";

import type {
  VisualizationMode,
} from "../components/map/AccidentMap";

import HeatmapFilterPanel from "../components/map/HeatmapFilterPanel";

import {
  AccidentService,
} from "../services/accidentService";

import {
  AccidentFilterService,
} from "../services/accidentFilterService";

import type {
  AccidentHeatmapFilters,
} from "../types/heatmap";

import {
  createDefaultHeatmapFilters,
} from "../types/heatmap";

export default function Dashboard() {
  const [
    visualizationMode,
    setVisualizationMode,
  ] = useState<VisualizationMode>(
    "markers",
  );

  const [
    heatmapFilters,
    setHeatmapFilters,
  ] =
    useState<AccidentHeatmapFilters>(
      createDefaultHeatmapFilters,
    );

  const allAccidents = useMemo(
    () => AccidentService.getAll(),
    [],
  );

  const heatmapFilterOptions =
    useMemo(
      () =>
        AccidentFilterService.getOptions(
          allAccidents,
        ),
      [allAccidents],
    );

  const filteredAccidentCount =
    useMemo(
      () =>
        AccidentFilterService.filter(
          allAccidents,
          heatmapFilters,
        ).length,
      [
        allAccidents,
        heatmapFilters,
      ],
    );

  const handleResetHeatmapFilters =
    () => {
      setHeatmapFilters(
        createDefaultHeatmapFilters(),
      );
    };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <DashboardHeader />

        <DashboardStats />

        {/* Accident Case Management access */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-blue-900 shadow-lg">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div>
                <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-50">
                  Case Management Module
                </span>

                <h2 className="mt-3 text-2xl font-bold text-white">
                  Accident Cases and Reports
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">
                  Create and manage accident cases, connect each case to its
                  reconstruction, document evidence and measurements, and
                  generate complete printable investigation reports.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                to="/cases"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-indigo-700 shadow-md transition hover:bg-indigo-50 active:scale-95"
              >
                Open Accident Cases

                <span aria-hidden="true" className="text-lg">
                  →
                </span>
              </Link>

              <Link
                to="/cases/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white shadow-md backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                <span aria-hidden="true" className="text-lg">
                  +
                </span>

                New Case
              </Link>
            </div>
          </div>
        </div>

        {/* Interactive Map Section */}
        <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="grid min-h-[680px] grid-cols-1 lg:grid-cols-2">
            {/* Left side */}
            <div className="overflow-y-auto border-b border-gray-200 bg-white p-6 lg:border-b-0 lg:border-r">
              <span className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                Road Safety Analysis
              </span>

              <h2 className="mt-4 text-3xl font-bold text-gray-900">
                Interactive Accident Map
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                Explore junction risks,
                accident concentrations and
                road-safety patterns across
                Bindura.
              </p>

              {/* Marker information */}
              {visualizationMode ===
                "markers" && (
                <div className="mt-8">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <h3 className="text-lg font-bold text-gray-900">
                      Junction Markers
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Markers are automatically
                      coloured using calculated
                      risk scores from accident
                      severity, fatalities,
                      injuries and accident
                      frequency.
                    </p>

                    <div className="mt-5 space-y-4">
                      <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-3">
                        <span className="h-4 w-4 shrink-0 rounded-full bg-red-600" />

                        <div>
                          <p className="text-sm font-bold text-red-900">
                            High Risk
                          </p>

                          <p className="text-xs text-red-700">
                            Risk score of 25 or
                            higher
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                        <span className="h-4 w-4 shrink-0 rounded-full bg-amber-500" />

                        <div>
                          <p className="text-sm font-bold text-amber-900">
                            Medium Risk
                          </p>

                          <p className="text-xs text-amber-700">
                            Risk score between
                            10 and 24
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-green-100 bg-green-50 p-3">
                        <span className="h-4 w-4 shrink-0 rounded-full bg-green-600" />

                        <div>
                          <p className="text-sm font-bold text-green-900">
                            Low Risk
                          </p>

                          <p className="text-xs text-green-700">
                            Risk score below 10
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
                    <p className="text-sm font-semibold text-blue-900">
                      Using the map
                    </p>

                    <p className="mt-2 text-sm leading-6 text-blue-700">
                      Click a junction marker to
                      view its accident
                      statistics, risk score,
                      common accident cause and
                      latest accident record.
                    </p>
                  </div>

                  <div className="mt-5 rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900">
                      Available tools
                    </h3>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          1
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Street and Hybrid
                          </p>

                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            Switch between the
                            road map and satellite
                            imagery.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                          2
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Markers and Heatmap
                          </p>

                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            Compare individual
                            junction risks or
                            accident concentration.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                          3
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Select Area
                          </p>

                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            Draw a rectangle to
                            analyse a specific
                            road-safety area.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Heatmap filters beside the map */}
              {visualizationMode ===
                "heatmap" && (
                <div className="mt-6">
                  <HeatmapFilterPanel
                    filters={
                      heatmapFilters
                    }
                    options={
                      heatmapFilterOptions
                    }
                    filteredAccidentCount={
                      filteredAccidentCount
                    }
                    totalAccidentCount={
                      allAccidents.length
                    }
                    onChange={
                      setHeatmapFilters
                    }
                    onReset={
                      handleResetHeatmapFilters
                    }
                  />
                </div>
              )}
            </div>

            {/* Right side — Map */}
            <div className="relative min-h-[680px] w-full bg-gray-100">
              <AccidentMap
                visualizationMode={
                  visualizationMode
                }
                onVisualizationModeChange={
                  setVisualizationMode
                }
                heatmapFilters={
                  heatmapFilters
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}