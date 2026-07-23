import { AlertTriangle, Globe2, Map } from "lucide-react";
import { useState } from "react";

import { useMapProviderPreference } from "../../hooks/useMapProviderPreference";
import { isGoogleMapsConfigured } from "../../services/mapPreferencesService";
import type {
  FieldCaptureMode,
  FieldPlacementRecord,
  FieldSceneCalibration,
  GeoCoordinate,
  RejectedGeoCoordinate,
} from "../../types/fieldPlacement";
import GoogleFieldPlacementMap from "./GoogleFieldPlacementMap";
import OpenFieldPlacementMap from "./OpenFieldPlacementMap";

interface FieldPlacementMapProps {
  current: GeoCoordinate | null;
  calibration?: FieldSceneCalibration;
  placements: FieldPlacementRecord[];
  rawTraceCoordinates?: GeoCoordinate[];
  processedTraceCoordinates?: GeoCoordinate[];
  rejectedTraceCoordinates?: RejectedGeoCoordinate[];
  pendingCoordinate?: GeoCoordinate | null;
  captureMode?: FieldCaptureMode;
  guidancePlacementId: string | null;
}

export default function FieldPlacementMap(props: FieldPlacementMapProps) {
  const [provider, setProvider] = useMapProviderPreference();
  const [googleError, setGoogleError] = useState("");
  const googleConfigured = isGoogleMapsConfigured();
  const activeProvider = provider === "Google" && googleConfigured && !googleError
    ? "Google"
    : "Open Map";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Real-world field map
          </p>
          <h3 className="text-sm font-black text-white">
            Officer position and captured geometry
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-600 bg-slate-950">
            <button
              type="button"
              onClick={() => {
                setGoogleError("");
                setProvider("Open Map");
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black ${
                activeProvider === "Open Map"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
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
              className={`inline-flex items-center gap-1.5 border-l border-slate-600 px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${
                activeProvider === "Google"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
              title={
                googleConfigured
                  ? "Use Google Maps imagery and context tools."
                  : "Add VITE_GOOGLE_MAPS_BROWSER_KEY to enable Google Maps."
              }
            >
              <Globe2 size={14} /> Google
            </button>
          </div>
        </div>
      </div>

      {googleError && (
        <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>Google Maps was unavailable.</strong> {googleError} The open-map provider is active instead.
          </div>
        </div>
      )}

      {activeProvider === "Google" ? (
        <GoogleFieldPlacementMap
          {...props}
          onLoadError={(message) => {
            setGoogleError(message);
            setProvider("Open Map");
          }}
        />
      ) : (
        <OpenFieldPlacementMap {...props} />
      )}
    </section>
  );
}
