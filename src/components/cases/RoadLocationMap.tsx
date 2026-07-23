import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { isGoogleMapsConfigured } from "../../services/mapPreferencesService";
import type {
  DetectedRoadFeature,
  DetectedRoadSegment,
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";
import GoogleRoadLocationMap from "./GoogleRoadLocationMap";

interface RoadLocationMapProps {
  coordinate: RoadDetectionCoordinate | null;
  currentCoordinate?: RoadDetectionCoordinate | null;
  roads?: DetectedRoadSegment[];
  features?: DetectedRoadFeature[];
  editable?: boolean;
  onCoordinateChange?: (coordinate: RoadDetectionCoordinate) => void;
}

export default function RoadLocationMap(props: RoadLocationMapProps) {
  const [googleError, setGoogleError] = useState("");
  const configured = isGoogleMapsConfigured();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
            Google location intelligence
          </p>
          <h3 className="text-sm font-black text-slate-900">
            Select and verify the real incident location
          </h3>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
          Google Maps
        </span>
      </div>

      <div className="p-3">
        {(!configured || googleError) ? (
          <div className="grid min-h-[360px] place-items-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <div className="max-w-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                <div>
                  <strong className="block">Google Maps configuration required</strong>
                  <p className="mt-2 text-sm leading-6">
                    {googleError || "Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env.local, then restart the development server."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <GoogleRoadLocationMap {...props} onLoadError={setGoogleError} />
        )}
      </div>
    </section>
  );
}
