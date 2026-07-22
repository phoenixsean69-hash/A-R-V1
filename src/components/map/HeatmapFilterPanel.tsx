import type {
  AccidentHeatmapFilterOptions,
  AccidentHeatmapFilters,
  HeatmapSeverityFilter,
} from "../../types/heatmap";

interface HeatmapFilterPanelProps {
  filters: AccidentHeatmapFilters;

  options:
    AccidentHeatmapFilterOptions;

  filteredAccidentCount: number;
  totalAccidentCount: number;

  onChange: (
    filters: AccidentHeatmapFilters,
  ) => void;

  onReset: () => void;
}

export default function HeatmapFilterPanel({
  filters,
  options,
  filteredAccidentCount,
  totalAccidentCount,
  onChange,
  onReset,
}: HeatmapFilterPanelProps) {
  const invalidDateRange =
    Boolean(
      filters.startDate &&
        filters.endDate &&
        filters.startDate >
          filters.endDate,
    );

  const activeFilterCount = [
    Boolean(filters.startDate),
    Boolean(filters.endDate),

    filters.severity !== "All",

    filters.weather !== "All",

    filters.cause !== "All",
  ].filter(Boolean).length;

  const updateFilters = (
    changes: Partial<AccidentHeatmapFilters>,
  ) => {
    onChange({
      ...filters,
      ...changes,
    });
  };

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Heatmap Filters
          </h3>

          <p className="mt-1 text-xs leading-4 text-gray-500">
            Control which accident records contribute to the heatmap.
          </p>
        </div>

        {activeFilterCount > 0 && (
          <span className="shrink-0 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">
            {activeFilterCount} active
          </span>
        )}
      </div>

      {/* Heatmap legend */}
      <div className="mt-4 rounded-lg bg-gray-50 p-3">
        <div
          className="h-3 w-full rounded-full"
          style={{
            background:
              "linear-gradient(to right, rgb(103,169,207), rgb(50,205,170), rgb(255,255,0), rgb(255,165,0), rgb(239,68,68), rgb(127,29,29))",
          }}
        />

        <div className="mt-1 flex justify-between text-[10px] font-medium text-gray-500">
          <span>Lower</span>
          <span>Higher</span>
        </div>
      </div>

      {/* Date range */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Date range
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">
              From
            </span>

            <input
              type="date"
              value={filters.startDate}
              min={
                options.minimumDate ||
                undefined
              }
              max={
                options.maximumDate ||
                undefined
              }
              onChange={(event) =>
                updateFilters({
                  startDate:
                    event.target.value,
                })
              }
              className={`w-full rounded-lg border px-2 py-2 text-xs text-gray-700 outline-none transition focus:ring-2 ${
                invalidDateRange
                  ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                  : "border-gray-300 focus:border-purple-500 focus:ring-purple-100"
              }`}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">
              To
            </span>

            <input
              type="date"
              value={filters.endDate}
              min={
                options.minimumDate ||
                undefined
              }
              max={
                options.maximumDate ||
                undefined
              }
              onChange={(event) =>
                updateFilters({
                  endDate:
                    event.target.value,
                })
              }
              className={`w-full rounded-lg border px-2 py-2 text-xs text-gray-700 outline-none transition focus:ring-2 ${
                invalidDateRange
                  ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                  : "border-gray-300 focus:border-purple-500 focus:ring-purple-100"
              }`}
            />
          </label>
        </div>

        {invalidDateRange && (
          <p className="mt-2 text-xs font-medium text-red-600">
            The starting date must be before the ending date.
          </p>
        )}
      </div>

      {/* Severity */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
          Accident severity
        </span>

        <select
          value={filters.severity}
          onChange={(event) =>
            updateFilters({
              severity:
                event.target
                  .value as HeatmapSeverityFilter,
            })
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
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
      </label>

      {/* Weather */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
          Weather
        </span>

        <select
          value={filters.weather}
          onChange={(event) =>
            updateFilters({
              weather:
                event.target.value,
            })
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
        >
          <option value="All">
            All weather conditions
          </option>

          {options.weatherConditions.map(
            (weather) => (
              <option
                key={weather}
                value={weather}
              >
                {weather}
              </option>
            ),
          )}
        </select>
      </label>

      {/* Cause */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
          Accident cause
        </span>

        <select
          value={filters.cause}
          onChange={(event) =>
            updateFilters({
              cause:
                event.target.value,
            })
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
        >
          <option value="All">
            All accident causes
          </option>

          {options.causes.map(
            (cause) => (
              <option
                key={cause}
                value={cause}
              >
                {cause}
              </option>
            ),
          )}
        </select>
      </label>

      <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
        <p className="text-sm font-bold text-purple-900">
          {filteredAccidentCount} of{" "}
          {totalAccidentCount} records
        </p>

        <p className="mt-1 text-xs leading-4 text-purple-700">
          These accident records are currently contributing to the heatmap.
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={activeFilterCount === 0}
        className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset Filters
      </button>
    </div>
  );
}