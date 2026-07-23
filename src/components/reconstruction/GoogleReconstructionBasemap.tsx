import { useEffect, useRef, useState } from "react";

import {
  latLngLiteral,
  loadGoogleMaps,
  subscribeGoogleMapsAuthenticationFailure,
} from "../../services/googleMapsLoader";
import type {
  GoogleMapsMap,
  GoogleMapsNamespace,
} from "../../services/googleMapsLoader";
import { getGoogleMapsRuntimeMapId } from "../../services/mapPreferencesService";
import type { FieldSceneCalibration } from "../../types/fieldPlacement";
import type { ReconstructionBasemapMode } from "./ReconstructionBasemap";

interface GoogleReconstructionBasemapProps {
  calibration?: FieldSceneCalibration;
  mode: Exclude<ReconstructionBasemapMode, "Diagram">;
  onLoadError?: (message: string) => void;
}

export default function GoogleReconstructionBasemap({
  calibration,
  mode,
  onLoadError,
}: GoogleReconstructionBasemapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const mapRef = useRef<GoogleMapsMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuthenticationFailure =
      subscribeGoogleMapsAuthenticationFailure((message) => onLoadError?.(message));
    let cancelled = false;

    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        const center = calibration?.origin
          ? latLngLiteral(calibration.origin)
          : { lat: -17.311182, lng: 31.336976 };
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: calibration ? 20 : 15,
          minZoom: 3,
          maxZoom: 22,
          mapTypeId: mode === "Street" ? "roadmap" : "satellite",
          mapId: getGoogleMapsRuntimeMapId(),
          heading: calibration?.rotationDegrees ?? 0,
          tilt: 0,
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
        });
        mapRef.current = map;
        setReady(true);

        if (mode === "Satellite" && calibration?.origin) {
          new maps.MaxZoomService().getMaxZoomAtLatLng(
            center,
            (result, status) => {
              if (
                status === "OK" &&
                typeof result?.zoom === "number" &&
                mapRef.current
              ) {
                mapRef.current.setZoom(Math.min(result.zoom, 21));
              }
            },
          );
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Google Maps could not be loaded.";
        onLoadError?.(message);
      });

    return () => {
      unsubscribeAuthenticationFailure();
      cancelled = true;
      if (mapRef.current && mapsRef.current) {
        mapsRef.current.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, [calibration, mode, onLoadError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(mode === "Street" ? "roadmap" : "satellite");
    if (calibration?.origin) {
      map.setCenter(latLngLiteral(calibration.origin));
      map.setHeading(calibration.rotationDegrees ?? 0);
    }
  }, [calibration, mode]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 bg-slate-700">
      <div ref={containerRef} className="roadsafe-google-map h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/70 text-xs font-black text-white">
          Loading Google basemap…
        </div>
      )}
      {!calibration && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-bold text-white shadow">
          Approximate map centre — capture GPS calibration for exact alignment
        </div>
      )}
    </div>
  );
}
