import type { AreaAnalysis } from "../../types/areaAnalysis";

interface AreaAnalysisResultsProps {
  analysis: AreaAnalysis;
}

function getRiskClasses(riskLevel: AreaAnalysis["overallRiskLevel"]) {
  switch (riskLevel) {
    case "High":
      return "bg-red-100 text-red-700 border-red-200";

    case "Medium":
      return "bg-amber-100 text-amber-700 border-amber-200";

    default:
      return "bg-green-100 text-green-700 border-green-200";
  }
}

export default function AreaAnalysisResults({
  analysis,
}: AreaAnalysisResultsProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            Selected Area Analysis
          </h3>

          <p className="text-sm text-gray-500">
            Approximately {analysis.areaSquareKilometres.toFixed(3)} km²
          </p>
        </div>

        <span
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${getRiskClasses(
            analysis.overallRiskLevel,
          )}`}
        >
          {analysis.overallRiskLevel} Risk
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResultCard
          label="Junctions"
          value={analysis.totalJunctions}
        />

        <ResultCard
          label="Accidents"
          value={analysis.totalAccidents}
        />

        <ResultCard
          label="Fatalities"
          value={analysis.totalFatalities}
        />

        <ResultCard
          label="Injuries"
          value={analysis.totalInjuries}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h4 className="mb-3 font-semibold text-gray-900">
          Junction risk distribution
        </h4>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-2xl font-semibold text-red-700">
              {analysis.highRiskJunctions}
            </p>

            <p className="text-xs text-red-600">High risk</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-2xl font-semibold text-amber-700">
              {analysis.mediumRiskJunctions}
            </p>

            <p className="text-xs text-amber-600">Medium risk</p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-2xl font-semibold text-green-700">
              {analysis.lowRiskJunctions}
            </p>

            <p className="text-xs text-green-600">Low risk</p>
          </div>
        </div>
      </div>

      {analysis.junctions.length > 0 ? (
        <div>
          <h4 className="mb-3 font-semibold text-gray-900">
            Junctions in selected area
          </h4>

          <div className="max-h-44 space-y-2 overflow-y-auto">
            {analysis.junctions.map((junction) => (
              <div
                key={junction.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {junction.name}
                  </p>

                  <p className="text-sm text-gray-500">
                    {junction.city}
                  </p>
                </div>

                <span className="text-sm font-medium">
                  {junction.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <p className="font-medium text-gray-700">
            No monitored junctions found
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Try selecting a larger area containing one of the sample junctions.
          </p>
        </div>
      )}
    </div>
  );
}

interface ResultCardProps {
  label: string;
  value: number;
}

function ResultCard({ label, value }: ResultCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>

      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}