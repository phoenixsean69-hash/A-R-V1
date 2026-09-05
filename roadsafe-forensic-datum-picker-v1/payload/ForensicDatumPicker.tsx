import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { ReconstructionService } from "../../services/reconstructionService";
import type { AccidentCase } from "../../types/accidentCase";
import type { RoadDetectionCoordinate } from "../../types/roadLayoutDetection";
import type {
  ForensicSceneDatum,
} from "./forensicInvestigationTypes";

interface Props {
  accidentCase: AccidentCase;
  currentDatum?: ForensicSceneDatum;
  onCancel(): void;
  onConfirm(datum: ForensicSceneDatum): void;
}

function insideBounds(
  latitude: number,
  longitude: number,
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
): boolean {
  return (
    latitude <= bounds.north &&
    latitude >= bounds.south &&
    longitude <= bounds.east &&
    longitude >= bounds.west
  );
}

function createHybridStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "Imagery © Esri",
      },
      labels: {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "Places and boundaries © Esri",
      },
    },
    layers: [
      {
        id: "imagery",
        type: "raster",
        source: "imagery",
      },
      {
        id: "labels",
        type: "raster",
        source: "labels",
        paint: {
          "raster-opacity": 0.9,
        },
      },
    ],
  };
}

function markerElement(
  fill: string,
  border: string,
  size: number,
): HTMLDivElement {
  const element = document.createElement("div");
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.borderRadius = "9999px";
  element.style.background = fill;
  element.style.border = `3px solid ${border}`;
  element.style.boxShadow = "0 4px 14px rgba(0,0,0,.65)";
  return element;
}

export default function ForensicDatumPicker({
  accidentCase,
  currentDatum,
  onCancel,
  onConfirm,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const datumMarkerRef = useRef<maplibregl.Marker | null>(null);
  const anchorMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [picked, setPicked] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    currentDatum
      ? {
          latitude: currentDatum.latitude,
          longitude: currentDatum.longitude,
        }
      : null,
  );

  const [label, setLabel] = useState(currentDatum?.label ?? "");
  const [message, setMessage] = useState(
    currentDatum
      ? "Existing reference point loaded. Click inside the frozen core to move it."
      : "Click a permanent point inside the frozen forensic core.",
  );

  const reconstruction = useMemo(
    () =>
      accidentCase.reconstructionId
        ? ReconstructionService.getById(accidentCase.reconstructionId)
        : null,
    [accidentCase.reconstructionId],
  );

  const geometry =
    reconstruction?.scene.realSceneGeometry ??
    accidentCase.roadLayoutDetection?.suggestedSceneSettings
      ?.realSceneGeometry;

  const selection = geometry?.selection ?? null;

  const accidentAnchor: RoadDetectionCoordinate | null =
    accidentCase.siteCoordinate ??
    accidentCase.roadLayoutDetection?.coordinate ??
    null;

  useEffect(() => {
    if (!containerRef.current || !selection || !geometry) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createHybridStyle(),
      center: [
        selection.centre.longitude,
        selection.centre.latitude,
      ],
      zoom: Math.max(17, selection.zoom || 17),
      attributionControl: true,
      maxZoom: 20,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      "bottom-right",
    );

    map.on("load", () => {
      map.fitBounds(
        [
          [selection.bounds.west, selection.bounds.south],
          [selection.bounds.east, selection.bounds.north],
        ],
        {
          padding: 70,
          duration: 0,
          maxZoom: 19,
        },
      );

      map.addSource("roadsafe-datum-core", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              selection.polygon.map((point) => [
                point.longitude,
                point.latitude,
              ]),
            ],
          },
        },
      });

      map.addLayer({
        id: "roadsafe-datum-core-fill",
        type: "fill",
        source: "roadsafe-datum-core",
        paint: {
          "fill-color": "#e8872d",
          "fill-opacity": 0.08,
        },
      });

      map.addLayer({
        id: "roadsafe-datum-core-line",
        type: "line",
        source: "roadsafe-datum-core",
        paint: {
          "line-color": "#e8872d",
          "line-width": 3,
        },
      });

      if (accidentAnchor) {
        const element = markerElement("#dc2626", "#ffffff", 22);
        element.title = "Accident anchor";

        anchorMarkerRef.current = new maplibregl.Marker({
          element,
          anchor: "center",
        })
          .setLngLat([
            accidentAnchor.longitude,
            accidentAnchor.latitude,
          ])
          .addTo(map);
      }

      if (picked) {
        const element = markerElement("#e8872d", "#202020", 24);
        element.title = "Fixed reference point";

        datumMarkerRef.current = new maplibregl.Marker({
          element,
          anchor: "center",
        })
          .setLngLat([picked.longitude, picked.latitude])
          .addTo(map);
      }
    });

    map.on("click", (event) => {
      const latitude = event.lngLat.lat;
      const longitude = event.lngLat.lng;

      if (
        !insideBounds(
          latitude,
          longitude,
          selection.bounds,
        )
      ) {
        setMessage(
          "Reference point rejected: click inside the frozen forensic core.",
        );
        return;
      }

      const next = {
        latitude,
        longitude,
      };

      setPicked(next);
      setMessage(
        "Point selected. Name the permanent feature, then confirm the reference point.",
      );

      if (!datumMarkerRef.current) {
        const element = markerElement("#e8872d", "#202020", 24);
        element.title = "Fixed reference point";

        datumMarkerRef.current = new maplibregl.Marker({
          element,
          anchor: "center",
        })
          .setLngLat([longitude, latitude])
          .addTo(map);
      } else {
        datumMarkerRef.current.setLngLat([longitude, latitude]);
      }
    });

    return () => {
      anchorMarkerRef.current?.remove();
      datumMarkerRef.current?.remove();
      map.remove();

      anchorMarkerRef.current = null;
      datumMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [selection?.id, geometry?.id]);

  if (!selection || !geometry) {
    return (
      <div className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-4">
        <div className="w-full max-w-lg rounded-md border border-[#494949] bg-[#202020] p-5 shadow-2xl">
          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
            Fixed reference point
          </p>
          <h3 className="mt-2 text-base font-bold text-slate-100">
            Frozen scene unavailable
          </h3>
          <p className="mt-3 text-[10px] leading-5 text-slate-400">
            RoadSafe could not read the frozen scene geometry from the linked
            reconstruction. Return to the case scene package and verify that the
            forensic core was successfully frozen.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 rounded border border-[#494949] bg-[#303030] px-4 py-2 text-[10px] font-semibold text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const scenePosition = picked
    ? {
        xPercent:
          ((picked.longitude - selection.bounds.west) /
            Math.max(
              0.000000001,
              selection.bounds.east - selection.bounds.west,
            )) *
          100,
        yPercent:
          ((selection.bounds.north - picked.latitude) /
            Math.max(
              0.000000001,
              selection.bounds.north - selection.bounds.south,
            )) *
          100,
      }
    : null;

  const xMetres = scenePosition
    ? (scenePosition.xPercent / 100) * geometry.sceneWidthMetres
    : 0;

  const yMetres = scenePosition
    ? (scenePosition.yPercent / 100) * geometry.sceneHeightMetres
    : 0;

  const confirm = () => {
    if (!picked || !scenePosition) {
      setMessage("Click the map to select the fixed reference point first.");
      return;
    }

    if (!label.trim()) {
      setMessage(
        "Name the permanent feature you selected, for example 'base of utility pole'.",
      );
      return;
    }

    onConfirm({
      label: label.trim(),
      latitude: picked.latitude,
      longitude: picked.longitude,
      xPercent: Number(scenePosition.xPercent.toFixed(4)),
      yPercent: Number(scenePosition.yPercent.toFixed(4)),
      xMetres: Number(xMetres.toFixed(3)),
      yMetres: Number(yMetres.toFixed(3)),
      selectedAt: new Date().toISOString(),
      method: "Manual map pick",
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/85 p-3 sm:p-5">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#494949] bg-[#202020] shadow-[0_30px_100px_rgba(0,0,0,.72)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#494949] bg-[#303030] px-4 py-3">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
              Scene datum
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-100">
              Pick fixed reference point
            </h2>
            <p className="mt-1 text-[9px] text-slate-500">
              The orange boundary is the frozen forensic core. Red is the accident
              anchor. Click a permanent feature inside the core.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[#494949] bg-[#292929] text-lg text-slate-300 hover:bg-[#383838]"
            aria-label="Close datum picker"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="relative min-h-[420px] overflow-hidden rounded-md border border-[#494949] bg-[#151515]">
            <div ref={containerRef} className="absolute inset-0" />

            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-2 rounded border border-[#494949] bg-[#202020]/90 px-2.5 py-2 text-[8px] text-slate-400">
              <span>
                <b className="text-red-400">●</b> accident anchor
              </span>
              <span>
                <b className="text-[#e8872d]">●</b> reference point
              </span>
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto rounded-md border border-[#494949] bg-[#292929]">
            <div className="border-b border-[#414141] px-3 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                Selected datum
              </p>
            </div>

            <div className="space-y-3 p-3">
              <label className="grid gap-1.5">
                <span className="text-[8px] font-bold text-slate-400">
                  Permanent feature label
                </span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. Base of utility pole beside side road"
                  className="min-h-10 rounded border border-[#494949] bg-[#202020] px-3 text-[10px] text-slate-200 outline-none focus:border-[#e8872d]"
                />
              </label>

              <div className="rounded border border-[#414141] bg-[#202020] p-3">
                <p className="text-[7px] font-bold uppercase tracking-[0.07em] text-slate-600">
                  Map coordinate
                </p>
                <p className="mt-2 font-mono text-[9px] text-slate-300">
                  {picked
                    ? `${picked.latitude.toFixed(7)}, ${picked.longitude.toFixed(7)}`
                    : "Not selected"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="Scene X"
                  value={picked ? `${xMetres.toFixed(3)} m` : "—"}
                />
                <Metric
                  label="Scene Y"
                  value={picked ? `${yMetres.toFixed(3)} m` : "—"}
                />
              </div>

              <div className="rounded border border-[#6d5523] bg-[#241d10] p-3 text-[8px] leading-4 text-[#c6ad73]">
                Choose a permanent, identifiable point that can be revisited:
                utility-pole base, signpost base, drain corner, culvert corner,
                surveyed monument, or another stable feature. Do not use debris,
                tyre marks, vehicles, or another movable object as the datum.
              </div>

              <p className="rounded border border-[#414141] bg-[#303030] p-3 text-[8px] leading-4 text-slate-400">
                {message}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded border border-[#494949] bg-[#303030] px-3 py-2 text-[9px] font-semibold text-slate-300"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirm}
                  disabled={!picked}
                  className="rounded border border-[#8c6039] bg-[#3a2c21] px-3 py-2 text-[9px] font-bold text-[#f0c49a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm reference
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-[#414141] bg-[#202020] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.06em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-[10px] font-bold text-slate-200">{value}</p>
    </div>
  );
}
