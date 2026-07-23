import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Focus,
  LocateFixed,
  MapPinned,
  Search,
  ScanEye,
  X,
  ZoomIn,
} from "lucide-react";

import {
  latLngLiteral,
  loadGoogleMaps,
  mapCenterLiteral,
} from "../../services/googleMapsLoader";
import type {
  GoogleDataLayer,
  GoogleMapsMap,
  GoogleMapsNamespace,
  GoogleStreetViewPanorama,
} from "../../services/googleMapsLoader";
import {
  getGoogleMapsRuntimeMapId,
  getPreferredGoogleMapType,
  setPreferredGoogleMapType,
} from "../../services/mapPreferencesService";
import type {
  FieldCaptureMode,
  FieldPlacementRecord,
  FieldSceneCalibration,
  GeoCoordinate,
  RejectedGeoCoordinate,
} from "../../types/fieldPlacement";
import type { GoogleMapDisplayType } from "../../types/mapping";
import { createAccuracyCircleGeoJson } from "../../utils/geographicCoordinates";

interface GoogleFieldPlacementMapProps {
  current: GeoCoordinate | null;
  calibration?: FieldSceneCalibration;
  placements: FieldPlacementRecord[];
  rawTraceCoordinates?: GeoCoordinate[];
  processedTraceCoordinates?: GeoCoordinate[];
  rejectedTraceCoordinates?: RejectedGeoCoordinate[];
  pendingCoordinate?: GeoCoordinate | null;
  captureMode?: FieldCaptureMode;
  guidancePlacementId: string | null;
  onLoadError?: (message: string) => void;
}

interface GoogleLayers {
  accuracy: GoogleDataLayer;
  calibration: GoogleDataLayer;
  current: GoogleDataLayer;
  pending: GoogleDataLayer;
  placements: GoogleDataLayer;
  processed: GoogleDataLayer;
  raw: GoogleDataLayer;
  rejected: GoogleDataLayer;
}

interface SearchPlace {
  displayName?: string;
  formattedAddress?: string;
  location?: { lat(): number; lng(): number };
  viewport?: unknown;
  fetchFields?(input: { fields: string[] }): Promise<void>;
}

interface SearchEventDetail extends Event {
  place?: SearchPlace;
  placePrediction?: { toPlace(): SearchPlace };
}

const MAP_TYPE_IDS: Record<GoogleMapDisplayType, string> = {
  Road: "roadmap",
  Satellite: "satellite",
  Hybrid: "hybrid",
  Terrain: "terrain",
};

function pointFeature(
  coordinate: Pick<GeoCoordinate, "latitude" | "longitude">,
  properties: Record<string, string | number>,
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: [coordinate.longitude, coordinate.latitude],
    },
  };
}

function lineFeature(
  coordinates: GeoCoordinate[],
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: coordinates.map((coordinate) => [
        coordinate.longitude,
        coordinate.latitude,
      ]),
    },
  };
}

function polygonFeature(
  coordinates: GeoCoordinate[],
): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        coordinates.map((coordinate) => [
          coordinate.longitude,
          coordinate.latitude,
        ]),
      ],
    },
  };
}

function replaceLayerData(
  layer: GoogleDataLayer,
  features: GeoJSON.Feature[],
): void {
  const existing: Array<Parameters<GoogleDataLayer["remove"]>[0]> = [];
  layer.forEach((feature) => existing.push(feature));
  existing.forEach((feature) => layer.remove(feature));
  if (features.length > 0) {
    layer.addGeoJson({ type: "FeatureCollection", features });
  }
}

function createLayers(
  maps: GoogleMapsNamespace,
  map: GoogleMapsMap,
): GoogleLayers {
  const layers: GoogleLayers = {
    accuracy: new maps.Data({ map }),
    calibration: new maps.Data({ map }),
    current: new maps.Data({ map }),
    pending: new maps.Data({ map }),
    placements: new maps.Data({ map }),
    processed: new maps.Data({ map }),
    raw: new maps.Data({ map }),
    rejected: new maps.Data({ map }),
  };

  layers.accuracy.setStyle({
    fillColor: "#0284c7",
    fillOpacity: 0.12,
    strokeColor: "#0284c7",
    strokeOpacity: 0.9,
    strokeWeight: 2,
  });
  layers.current.setStyle({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#0284c7",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
    },
  });
  layers.calibration.setStyle((feature) => {
    const kind = String(feature.getProperty("kind") ?? "width");
    return {
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor:
          kind === "origin"
            ? "#16a34a"
            : kind === "direction"
              ? "#2563eb"
              : "#0891b2",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    };
  });
  layers.placements.setStyle((feature) => ({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: Number(feature.getProperty("selected")) === 1 ? 8 : 5.5,
      fillColor:
        Number(feature.getProperty("selected")) === 1 ? "#f59e0b" : "#1d4ed8",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  }));
  layers.raw.setStyle({
    strokeColor: "#f59e0b",
    strokeOpacity: 0.9,
    strokeWeight: 3,
  });
  layers.processed.setStyle({
    fillColor: "#0ea5e9",
    fillOpacity: 0.15,
    strokeColor: "#0284c7",
    strokeOpacity: 1,
    strokeWeight: 5,
  });
  layers.rejected.setStyle({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 4.5,
      fillColor: "#64748b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
    },
  });
  layers.pending.setStyle({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#f59e0b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
    },
  });

  return layers;
}

function collectCoordinates(input: {
  current: GeoCoordinate | null;
  calibration?: FieldSceneCalibration;
  placements: FieldPlacementRecord[];
  raw: GeoCoordinate[];
  processed: GeoCoordinate[];
  pending?: GeoCoordinate | null;
}): GeoCoordinate[] {
  const coordinates: GeoCoordinate[] = [];
  if (input.current) coordinates.push(input.current);
  if (input.pending) coordinates.push(input.pending);
  if (input.calibration) {
    coordinates.push(
      input.calibration.origin,
      input.calibration.directionReference,
    );
    if (input.calibration.widthReference) {
      coordinates.push(input.calibration.widthReference);
    }
  }
  coordinates.push(...input.placements.map((placement) => placement.coordinate));
  coordinates.push(...input.raw, ...input.processed);
  return coordinates;
}

export default function GoogleFieldPlacementMap({
  current,
  calibration,
  placements,
  rawTraceCoordinates = [],
  processedTraceCoordinates = [],
  rejectedTraceCoordinates = [],
  pendingCoordinate = null,
  captureMode = "Point",
  guidancePlacementId,
  onLoadError,
}: GoogleFieldPlacementMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const panoramaContainerRef = useRef<HTMLDivElement | null>(null);
  const searchHostRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const initialCoordinateRef = useRef(current ?? calibration?.origin ?? null);
  const onLoadErrorRef = useRef(onLoadError);
  const mapRef = useRef<GoogleMapsMap | null>(null);
  const layersRef = useRef<GoogleLayers | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);
  const [ready, setReady] = useState(false);
  const [followOfficer, setFollowOfficer] = useState(true);
  const [mapType, setMapType] = useState<GoogleMapDisplayType>(() =>
    getPreferredGoogleMapType(),
  );
  const initialMapTypeRef = useRef(mapType);
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [streetViewPosition, setStreetViewPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [streetViewMessage, setStreetViewMessage] = useState("");
  const [maxZoomMessage, setMaxZoomMessage] = useState("");
  const [searchLabel, setSearchLabel] = useState("");

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  const captureCoordinates = useMemo(
    () =>
      processedTraceCoordinates.length > 0
        ? processedTraceCoordinates
        : rawTraceCoordinates,
    [processedTraceCoordinates, rawTraceCoordinates],
  );

  const fitCoordinates = useCallback((coordinates: GeoCoordinate[]) => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || coordinates.length === 0) return;
    if (coordinates.length === 1) {
      map.panTo(latLngLiteral(coordinates[0]));
      map.setZoom(Math.max(18, map.getZoom() ?? 18));
      return;
    }
    const bounds = new maps.LatLngBounds();
    coordinates.forEach((coordinate) => bounds.extend(latLngLiteral(coordinate)));
    map.fitBounds(bounds, 56);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let searchElement: HTMLElement | null = null;

    void loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !mapContainerRef.current) return;
        mapsRef.current = maps;
        const initial = initialCoordinateRef.current;
        const map = new maps.Map(mapContainerRef.current, {
          center: initial
            ? latLngLiteral(initial)
            : { lat: -17.311182, lng: 31.336976 },
          zoom: initial ? 18 : 14,
          minZoom: 3,
          maxZoom: 22,
          mapTypeId: MAP_TYPE_IDS[initialMapTypeRef.current],
          mapId: getGoogleMapsRuntimeMapId(),
          gestureHandling: "greedy",
          fullscreenControl: true,
          mapTypeControl: false,
          rotateControl: true,
          scaleControl: true,
          streetViewControl: false,
          zoomControl: true,
        });
        map.addListener("dragstart", () => setFollowOfficer(false));
        mapRef.current = map;
        layersRef.current = createLayers(maps, map);

        const placesLibrary = await maps.importLibrary("places");
        const PlaceAutocompleteElement = placesLibrary.PlaceAutocompleteElement as
          | (new (options?: Record<string, unknown>) => HTMLElement)
          | undefined;
        if (PlaceAutocompleteElement && searchHostRef.current) {
          searchElement = new PlaceAutocompleteElement({});
          searchElement.style.width = "100%";
          searchElement.setAttribute("aria-label", "Search Google Maps");
          const handlePlace = async (event: Event) => {
            const detail = event as SearchEventDetail;
            const place = detail.place ?? detail.placePrediction?.toPlace();
            if (!place) return;
            await place.fetchFields?.({
              fields: ["displayName", "formattedAddress", "location", "viewport"],
            });
            setSearchLabel(place.displayName ?? place.formattedAddress ?? "Location");
            if (place.viewport) {
              map.fitBounds(place.viewport as never, 48);
            } else if (place.location) {
              map.panTo({ lat: place.location.lat(), lng: place.location.lng() });
              map.setZoom(19);
            }
            setFollowOfficer(false);
          };
          searchElement.addEventListener("gmp-placeselect", handlePlace);
          searchElement.addEventListener("gmp-select", handlePlace);
          searchHostRef.current.replaceChildren(searchElement);
        }
        setReady(true);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Google Maps could not be loaded.";
        onLoadErrorRef.current?.(message);
      });

    return () => {
      cancelled = true;
      searchElement?.remove();
      Object.values(layersRef.current ?? {}).forEach((layer) => layer.setMap(null));
      if (mapRef.current && mapsRef.current) {
        mapsRef.current.event.clearInstanceListeners(mapRef.current);
      }
      panoramaRef.current?.setVisible(false);
      panoramaRef.current = null;
      layersRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(MAP_TYPE_IDS[mapType]);
    setPreferredGoogleMapType(mapType);
    setMaxZoomMessage("");
  }, [mapType]);

  useEffect(() => {
    const layers = layersRef.current;
    if (!layers || !ready) return;

    replaceLayerData(
      layers.accuracy,
      current ? [createAccuracyCircleGeoJson(current)] : [],
    );
    replaceLayerData(
      layers.current,
      current ? [pointFeature(current, { kind: "officer" })] : [],
    );
    replaceLayerData(
      layers.calibration,
      calibration
        ? [
            pointFeature(calibration.origin, { kind: "origin" }),
            pointFeature(calibration.directionReference, { kind: "direction" }),
            ...(calibration.widthReference
              ? [pointFeature(calibration.widthReference, { kind: "width" })]
              : []),
          ]
        : [],
    );
    replaceLayerData(
      layers.placements,
      placements.map((placement) =>
        pointFeature(placement.coordinate, {
          selected: placement.id === guidancePlacementId ? 1 : 0,
          label: placement.targetLabel,
        }),
      ),
    );
    replaceLayerData(
      layers.raw,
      rawTraceCoordinates.length >= 2 ? [lineFeature(rawTraceCoordinates)] : [],
    );
    replaceLayerData(
      layers.processed,
      processedTraceCoordinates.length >= 2
        ? [
            captureMode === "Boundary" && processedTraceCoordinates.length >= 4
              ? polygonFeature(processedTraceCoordinates)
              : lineFeature(processedTraceCoordinates),
          ]
        : [],
    );
    replaceLayerData(
      layers.rejected,
      rejectedTraceCoordinates.map((sample) =>
        pointFeature(sample.coordinate, { reason: sample.reason }),
      ),
    );
    replaceLayerData(
      layers.pending,
      pendingCoordinate
        ? [pointFeature(pendingCoordinate, { kind: "pending" })]
        : [],
    );
  }, [
    calibration,
    captureMode,
    current,
    guidancePlacementId,
    pendingCoordinate,
    placements,
    processedTraceCoordinates,
    rawTraceCoordinates,
    ready,
    rejectedTraceCoordinates,
  ]);

  useEffect(() => {
    if (!ready || !followOfficer || !current || !mapRef.current) return;
    mapRef.current.panTo(latLngLiteral(current));
  }, [current, followOfficer, ready]);

  useEffect(() => {
    if (
      !streetViewOpen ||
      !streetViewPosition ||
      !panoramaContainerRef.current ||
      !mapsRef.current
    ) {
      return;
    }
    panoramaRef.current?.setVisible(false);
    panoramaRef.current = new mapsRef.current.StreetViewPanorama(
      panoramaContainerRef.current,
      {
        position: streetViewPosition,
        pov: { heading: mapRef.current?.getHeading() ?? 0, pitch: 0 },
        addressControl: true,
        fullscreenControl: true,
        motionTracking: false,
        zoomControl: true,
      },
    );
  }, [streetViewOpen, streetViewPosition]);

  const openStreetView = () => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const centre = map ? mapCenterLiteral(map) : null;
    if (!maps || !centre) return;
    setStreetViewMessage("Finding the nearest Street View panorama…");
    new maps.StreetViewService().getPanorama(
      { location: centre, radius: 150, preference: "nearest", source: "outdoor" },
      (data, status) => {
        const position = data?.location?.latLng;
        if (status !== "OK" || !position) {
          setStreetViewMessage("No Street View panorama was found within 150 metres.");
          setStreetViewOpen(false);
          return;
        }
        setStreetViewPosition({ lat: position.lat(), lng: position.lng() });
        setStreetViewMessage(
          data?.location?.description
            ? `Street View: ${data.location.description}`
            : "Nearest Street View panorama",
        );
        setStreetViewOpen(true);
      },
    );
  };

  const zoomToMaximumImagery = () => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const centre = map ? mapCenterLiteral(map) : null;
    if (!maps || !map || !centre) return;
    setMaxZoomMessage("Checking satellite detail…");
    new maps.MaxZoomService().getMaxZoomAtLatLng(centre, (result, status) => {
      if (status !== "OK" || typeof result?.zoom !== "number") {
        setMaxZoomMessage("Maximum satellite zoom is not available here.");
        return;
      }
      const nextType = mapType === "Hybrid" ? "Hybrid" : "Satellite";
      setMapType(nextType);
      map.setMapTypeId(MAP_TYPE_IDS[nextType]);
      map.setZoom(result.zoom);
      setMaxZoomMessage(`Maximum imagery zoom: ${result.zoom}`);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-600 bg-slate-950">
          {(Object.keys(MAP_TYPE_IDS) as GoogleMapDisplayType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMapType(type)}
              className={`px-2.5 py-2 text-[10px] font-black ${
                mapType === type
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="min-w-[220px] flex-1 rounded-lg bg-white p-1 text-slate-950">
          <div ref={searchHostRef} className="min-h-9 w-full" />
        </div>
        <button
          type="button"
          onClick={zoomToMaximumImagery}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200"
          title="Query the maximum satellite imagery zoom available at the map centre."
        >
          <ZoomIn size={14} /> Max Detail
        </button>
        <button
          type="button"
          onClick={openStreetView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200"
          title="Open the nearest Google Street View panorama."
        >
          <ScanEye size={14} /> Street View
        </button>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_auto]">
        <div className={streetViewOpen ? "grid md:grid-cols-2" : "grid"}>
          <div className="relative min-h-[390px]">
            <div ref={mapContainerRef} className="roadsafe-google-map absolute inset-0" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm font-black text-white">
                Loading Google Maps…
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[80%] rounded-xl bg-slate-950/90 px-3 py-2 text-[10px] font-bold text-slate-200 shadow-lg backdrop-blur-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span><b className="text-sky-400">●</b> Officer</span>
                <span><b className="text-amber-400">━</b> Raw capture</span>
                <span><b className="text-sky-500">━</b> Processed geometry</span>
                <span><b className="text-slate-400">●</b> Rejected sample</span>
              </div>
              {(maxZoomMessage || searchLabel) && (
                <div className="mt-1 text-slate-400">
                  {[searchLabel, maxZoomMessage].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </div>

          {streetViewOpen && (
            <div className="relative min-h-[390px] border-l border-slate-700">
              <div ref={panoramaContainerRef} className="roadsafe-google-map absolute inset-0" />
              <button
                type="button"
                onClick={() => setStreetViewOpen(false)}
                className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg bg-slate-950/90 px-3 py-2 text-xs font-black text-white shadow"
              >
                <X size={14} /> Close
              </button>
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-slate-950/90 px-3 py-2 text-[10px] font-bold text-slate-200">
                {streetViewMessage}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-[150px] flex-col gap-2 border-l border-slate-700 bg-slate-900 p-3">
          <button
            type="button"
            onClick={() => {
              setFollowOfficer((value) => !value);
              if (!followOfficer && current) fitCoordinates([current]);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black ${
              followOfficer
                ? "border-sky-400 bg-sky-500 text-slate-950"
                : "border-slate-600 bg-slate-800 text-slate-200"
            }`}
          >
            <LocateFixed size={14} />
            {followOfficer ? "Following" : "Follow Officer"}
          </button>
          <button
            type="button"
            onClick={() => fitCoordinates(captureCoordinates)}
            disabled={captureCoordinates.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-40"
          >
            <Focus size={14} /> Fit Capture
          </button>
          <button
            type="button"
            onClick={() =>
              fitCoordinates(
                collectCoordinates({
                  current,
                  calibration,
                  placements,
                  raw: rawTraceCoordinates,
                  processed: processedTraceCoordinates,
                  pending: pendingCoordinate,
                }),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200"
          >
            <MapPinned size={14} /> Fit All
          </button>
          <button
            type="button"
            onClick={() => current && fitCoordinates([current])}
            disabled={!current}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-40"
          >
            <Crosshair size={14} /> Officer
          </button>
          <div className="mt-auto rounded-lg border border-slate-700 bg-slate-950 p-2 text-[10px] leading-4 text-slate-400">
            <div className="mb-1 flex items-center gap-1 font-black text-slate-200">
              <Search size={12} /> Google context
            </div>
            Search and imagery are contextual. Officer GPS and confirmed RoadSafe geometry remain authoritative.
          </div>
        </div>
      </div>
    </div>
  );
}
