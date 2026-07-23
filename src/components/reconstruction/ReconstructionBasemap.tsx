import { useState } from "react";

import { isGoogleMapsConfigured } from "../../services/mapPreferencesService";
import type { FieldSceneCalibration } from "../../types/fieldPlacement";
import GoogleReconstructionBasemap from "./GoogleReconstructionBasemap";

export type ReconstructionBasemapMode = "Diagram" | "Street" | "Satellite";

interface ReconstructionBasemapProps {
  calibration?: FieldSceneCalibration;
  mode: Exclude<ReconstructionBasemapMode, "Diagram">;
}

export default function ReconstructionBasemap({
  calibration,
  mode,
}: ReconstructionBasemapProps) {
  const [googleError, setGoogleError] = useState("");

  if (!isGoogleMapsConfigured() || googleError) {
    return (
      <div className="pointer-events-none absolute inset-0 z-0 grid place-items-center bg-slate-800 p-6 text-center">
        <div className="max-w-md rounded-xl border border-amber-400/30 bg-slate-950/90 p-4 text-xs leading-5 text-amber-100 shadow-xl">
          <strong className="block text-white">Google basemap unavailable</strong>
          <span className="mt-2 block">
            {googleError || "Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env.local and restart the app."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <GoogleReconstructionBasemap
      calibration={calibration}
      mode={mode}
      onLoadError={setGoogleError}
    />
  );
}
