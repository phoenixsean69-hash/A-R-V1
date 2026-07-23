import { useState } from "react";

import { useMapProviderPreference } from "../../hooks/useMapProviderPreference";
import { isGoogleMapsConfigured } from "../../services/mapPreferencesService";
import type { FieldSceneCalibration } from "../../types/fieldPlacement";
import GoogleReconstructionBasemap from "./GoogleReconstructionBasemap";
import OpenReconstructionBasemap from "./OpenReconstructionBasemap";

export type ReconstructionBasemapMode = "Diagram" | "Street" | "Satellite";

interface ReconstructionBasemapProps {
  calibration?: FieldSceneCalibration;
  mode: Exclude<ReconstructionBasemapMode, "Diagram">;
}

export default function ReconstructionBasemap({
  calibration,
  mode,
}: ReconstructionBasemapProps) {
  const [provider, setProvider] = useMapProviderPreference();
  const [googleFailed, setGoogleFailed] = useState(false);
  const useGoogle =
    provider === "Google" && isGoogleMapsConfigured() && !googleFailed;

  if (useGoogle) {
    return (
      <GoogleReconstructionBasemap
        calibration={calibration}
        mode={mode}
        onLoadError={() => {
          setGoogleFailed(true);
          setProvider("Open Map");
        }}
      />
    );
  }

  return <OpenReconstructionBasemap calibration={calibration} mode={mode} />;
}
