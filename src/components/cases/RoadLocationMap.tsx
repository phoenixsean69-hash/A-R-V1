import { AlertTriangle, Globe2, Map } from "lucide-react";
import { useState } from "react";

import { useMapProviderPreference } from "../../hooks/useMapProviderPreference";
import { isGoogleMapsConfigured } from "../../services/mapPreferencesService";
import type {
  DetectedRoadFeature,
  DetectedRoadSegment,
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";
import GoogleRoadLocationMap from "./GoogleRoadLocationMap";
import OpenRoadLocationMap from "./OpenRoadLocationMap";

interface RoadLocationMapProps {
  coordinate: RoadDetectionCoordinate | null;
  currentCoordinate?: RoadDetectionCoordinate | null;
  roads?: DetectedRoadSegment[];
  features?: DetectedRoadFeature[];
  editable?: boolean;
  onCoordinateChange?: (coordinate: RoadDetectionCoordinate) => void;
}

export default function RoadLocationMap(props: RoadLocationMapProps) {
  const [provider, setProvider] = useMapProviderPreference();
  const [googleError, setGoogleError] = useState("");
  const googleConfigured = isGoogleMapsConfigured();
  const activeProvider = provider === "Google" && googleConfigured && !googleError
    ? "Google"
    : "Open Map";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Location intelligence
          </p>
          <h3 className="text-sm font-black text-slate-900">
            Select and verify the real incident location
          </h3>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => {
              setGoogleError("");
              setProvider("Open Map");
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black ${
              activeProvider === "Open Map"
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Map size={14} /> Open Map
          </button>
          <button
            type="button"
            disabled={!googleConfigured}
            onClick={() => {
              setGoogleError("");
              setProvider("Google");
            }}
            className={`inline-flex items-center gap-1.5 border-l border-slate-200 px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${
              activeProvider === "Google"
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            title={
              googleConfigured
                ? "Use Google search, imagery, maximum zoom and Street View."
                : "Add VITE_GOOGLE_MAPS_BROWSER_KEY to enable Google Maps."
            }
          >
            <Globe2 size={14} /> Google
          </button>
        </div>
      </div>

      {googleError && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>Google Maps was unavailable.</strong> {googleError} The open-map provider is active instead.
          </div>
        </div>
      )}

      <div className="p-3">
        {activeProvider === "Google" ? (
          <GoogleRoadLocationMap
            {...props}
            onLoadError={(message) => {
              setGoogleError(message);
              setProvider("Open Map");
            }}
          />
        ) : (
          <OpenRoadLocationMap {...props} />
        )}
      </div>
    </section>
  );
}
