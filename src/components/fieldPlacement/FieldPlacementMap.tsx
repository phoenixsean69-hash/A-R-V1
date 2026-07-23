import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { isGoogleMapsConfigured } from "../../services/mapPreferencesService";
import type {
  FieldCaptureMode,
  FieldPlacementRecord,
  FieldSceneCalibration,
  GeoCoordinate,
  RejectedGeoCoordinate,
} from "../../types/fieldPlacement";
import GoogleFieldPlacementMap from "./GoogleFieldPlacementMap";

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
  const [googleError, setGoogleError] = useState("");
  const configured = isGoogleMapsConfigured();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Google field intelligence
          </p>
          <h3 className="text-sm font-black text-white">
            Officer position and captured geometry
          </h3>
        </div>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-200">
          Google Maps
        </span>
      </div>

      {(!configured || googleError) && (
        <div className="flex min-h-[320px] items-center justify-center p-6">
          <div className="max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <div>
                <strong className="block text-white">Google Maps configuration required</strong>
                <p className="mt-2 leading-6">
                  {googleError || "Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env.local, then restart the development server."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {configured && !googleError && (
        <GoogleFieldPlacementMap
          {...props}
          onLoadError={setGoogleError}
        />
      )}
    </section>
  );
}
