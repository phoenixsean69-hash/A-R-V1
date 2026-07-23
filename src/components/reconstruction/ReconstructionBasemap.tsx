import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import type { FieldSceneCalibration } from "../../types/fieldPlacement";

export type ReconstructionBasemapMode = "Diagram" | "Street" | "Satellite";

interface ReconstructionBasemapProps {
  calibration?: FieldSceneCalibration;
  mode: Exclude<ReconstructionBasemapMode, "Diagram">;
}

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

export default function ReconstructionBasemap({
  calibration,
  mode,
}: ReconstructionBasemapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const center = calibration?.origin
      ? [calibration.origin.longitude, calibration.origin.latitude] as [number, number]
      : [31.336976, -17.311182] as [number, number];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mode === "Street"
        ? "https://tiles.openfreemap.org/styles/liberty"
        : SATELLITE_STYLE,
      center,
      zoom: calibration ? 19 : 15,
      bearing: calibration?.rotationDegrees ?? 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [calibration, mode]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 bg-slate-700">
      <div ref={containerRef} className="h-full w-full" />
      {!calibration && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1.5 text-[10px] font-bold text-white shadow">
          Approximate map centre — capture GPS calibration for exact alignment
        </div>
      )}
    </div>
  );
}
