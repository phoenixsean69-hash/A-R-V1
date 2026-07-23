import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Crosshair,
  Focus,
  Layers3,
  MapPinned,
  ScanEye,
  Search,
  X,
  ZoomIn,
} from "lucide-react";

import {
  loadGoogleMaps,
  mapCenterLiteral,
} from "../../services/googleMapsLoader";
import type {
  GoogleInfoWindow,
  GoogleLatLng,
  GoogleMapsListener,
  GoogleMapsMap,
  GoogleMapsNamespace,
  GoogleRectangle,
  GoogleStreetViewPanorama,
} from "../../services/googleMapsLoader";
import {
  getGoogleMapsRuntimeMapId,
  getPreferredGoogleMapType,
  isGoogleMapsConfigured,
  setPreferredGoogleMapType,
} from "../../services/mapPreferencesService";
import { AreaAnalysisService } from "../../services/areaAnalysisService";
import type { AreaAnalysis } from "../../types/areaAnalysis";
import type { AccidentHeatmapFilters } from "../../types/heatmap";
import type { MapBounds } from "../../types/map";
import type { GoogleMapDisplayType } from "../../types/mapping";
import AreaAnalysisResults from "./AreaAnalysisResults";
import JunctionAnalysisModal from "./JunctionAnalysisModal";
import {
  getAccidentHeatmapPoints,
} from "./accidentHeatmapLayer";
import {
  createJunctionInfoContent,
  createJunctionMarkerElement,
  getJunctionMapRecords,
} from "./junctionMapLayer";
import type { JunctionMapRecord } from "./junctionMapLayer";
import {
  createGoogleHeatmapOverlay,
} from "./GoogleHeatmapOverlay";
import type { GoogleHeatmapOverlayHandle } from "./GoogleHeatmapOverlay";

export type VisualizationMode = "markers" | "heatmap";

interface AccidentMapProps {
  visualizationMode: VisualizationMode;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  heatmapFilters: AccidentHeatmapFilters;
  compactSelectionPanel?: boolean;
}

interface GoogleMapClickEvent {
  latLng?: GoogleLatLng;
}

interface GoogleAdvancedMarker {
  map: GoogleMapsMap | null;
  addListener(
    eventName: string,
    handler: (...args: unknown[]) => void,
  ): GoogleMapsListener;
}

interface GoogleAdvancedMarkerConstructor {
  new (options: Record<string, unknown>): GoogleAdvancedMarker;
}

interface SearchPlace {
  displayName?: string;
  formattedAddress?: string;
  location?: GoogleLatLng;
  viewport?: unknown;
  fetchFields?(input: { fields: string[] }): Promise<void>;
}

interface SearchEventDetail extends Event {
  place?: SearchPlace;
  placePrediction?: { toPlace(): SearchPlace };
}

const INITIAL_CENTER = { lat: -17.311182, lng: 31.336976 };
const INITIAL_ZOOM = 15;
const MAP_TYPE_IDS: Record<GoogleMapDisplayType, string> = {
  Road: "roadmap",
  Satellite: "satellite",
  Hybrid: "hybrid",
  Terrain: "terrain",
};

function calculateBounds(
  startLongitude: number,
  startLatitude: number,
  endLongitude: number,
  endLatitude: number,
): MapBounds {
  return {
    north: Math.max(startLatitude, endLatitude),
    south: Math.min(startLatitude, endLatitude),
    east: Math.max(startLongitude, endLongitude),
    west: Math.min(startLongitude, endLongitude),
  };
}

function mapBoundsOptions(bounds: MapBounds): Record<string, number> {
  return {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
  };
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function clearMarkers(markers: GoogleAdvancedMarker[]): void {
  markers.forEach((marker) => {
    marker.map = null;
  });
  markers.length = 0;
}

function fitRecords(
  maps: GoogleMapsNamespace,
  map: GoogleMapsMap,
  records: JunctionMapRecord[],
): void {
  if (records.length === 0) return;
  const bounds = new maps.LatLngBounds();
  records.forEach(({ junction }) => {
    bounds.extend({ lat: junction.latitude, lng: junction.longitude });
  });
  map.fitBounds(bounds, 56);
}

function createMarkers(
  markerConstructor: GoogleAdvancedMarkerConstructor,
  map: GoogleMapsMap,
  infoWindow: GoogleInfoWindow,
  records: JunctionMapRecord[],
  onViewFullAnalysis: (junctionId: string) => void,
): GoogleAdvancedMarker[] {
  return records.map((record) => {
    const marker = new markerConstructor({
      map,
      position: {
        lat: record.junction.latitude,
        lng: record.junction.longitude,
      },
      content: createJunctionMarkerElement(record),
      title: `${record.junction.name} — ${record.risk.riskLevel} risk`,
      gmpClickable: true,
      zIndex: Math.round(record.risk.riskScore * 10),
    });
    marker.addListener("click", () => {
      infoWindow.setContent(
        createJunctionInfoContent(record, onViewFullAnalysis),
      );
      infoWindow.open({ map, anchor: marker });
    });
    return marker;
  });
}

export default function AccidentMap({
  visualizationMode,
  onVisualizationModeChange,
  heatmapFilters,
  compactSelectionPanel = false,
}: AccidentMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const panoramaContainerRef = useRef<HTMLDivElement | null>(null);
  const searchHostRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const mapRef = useRef<GoogleMapsMap | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null);
  const markersRef = useRef<GoogleAdvancedMarker[]>([]);
  const markerConstructorRef = useRef<GoogleAdvancedMarkerConstructor | null>(null);
  const heatmapRef = useRef<GoogleHeatmapOverlayHandle | null>(null);
  const selectionRectangleRef = useRef<GoogleRectangle | null>(null);
  const configured = isGoogleMapsConfigured();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [mapType, setMapType] = useState<GoogleMapDisplayType>(() =>
    getPreferredGoogleMapType(),
  );
  const initialMapTypeRef = useRef(mapType);
  const initialVisualizationRef = useRef(visualizationMode);
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [selectedBounds, setSelectedBounds] = useState<MapBounds | null>(null);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AreaAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [streetViewPosition, setStreetViewPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [streetViewMessage, setStreetViewMessage] = useState("");
  const [maxZoomMessage, setMaxZoomMessage] = useState("");
  const [searchLabel, setSearchLabel] = useState("");

  const records = useMemo(() => getJunctionMapRecords(), []);
  const heatmapPoints = useMemo(
    () => getAccidentHeatmapPoints(undefined, heatmapFilters),
    [heatmapFilters],
  );
  const initialHeatmapPointsRef = useRef(heatmapPoints);

  const handleOpenJunctionAnalysis = useCallback((junctionId: string) => {
    setSelectedJunctionId(junctionId);
  }, []);

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;
    let searchElement: HTMLElement | null = null;
    let searchHandler: ((event: Event) => void) | null = null;
    const listeners: GoogleMapsListener[] = [];

    void loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !mapContainerRef.current) return;
        mapsRef.current = maps;

        const map = new maps.Map(mapContainerRef.current, {
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
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
          clickableIcons: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new maps.InfoWindow({ maxWidth: 380 });

        const markerLibrary = await maps.importLibrary("marker");
        markerConstructorRef.current = markerLibrary.AdvancedMarkerElement as
          | GoogleAdvancedMarkerConstructor
          | null;

        heatmapRef.current = createGoogleHeatmapOverlay(
          maps,
          map,
          initialHeatmapPointsRef.current,
        );
        heatmapRef.current.setVisible(initialVisualizationRef.current === "heatmap");

        listeners.push(
          map.addListener("contextmenu", (...args: unknown[]) => {
            const event = args[0] as GoogleMapClickEvent | undefined;
            if (!event?.latLng || !infoWindowRef.current) return;
            const latitude = event.latLng.lat();
            const longitude = event.latLng.lng();
            const content = document.createElement("div");
            content.style.padding = "6px";
            content.innerHTML = `
              <strong style="color:#0f172a">Selected coordinate</strong>
              <p style="margin:6px 0 0;color:#475569;font-size:12px;line-height:1.6">
                Latitude: ${formatCoordinate(latitude)}<br />
                Longitude: ${formatCoordinate(longitude)}
              </p>
            `;
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.setPosition({ lat: latitude, lng: longitude });
            infoWindowRef.current.open({ map });
          }),
        );

        const placesLibrary = await maps.importLibrary("places");
        const PlaceAutocompleteElement = placesLibrary.PlaceAutocompleteElement as
          | (new (options?: Record<string, unknown>) => HTMLElement)
          | undefined;
        if (PlaceAutocompleteElement && searchHostRef.current) {
          searchElement = new PlaceAutocompleteElement({});
          searchElement.style.width = "100%";
          searchElement.setAttribute("aria-label", "Search Google Maps");
          searchHandler = async (event: Event) => {
            const detail = event as SearchEventDetail;
            const place = detail.place ?? detail.placePrediction?.toPlace();
            if (!place) return;
            await place.fetchFields?.({
              fields: ["displayName", "formattedAddress", "location", "viewport"],
            });
            setSearchLabel(place.displayName ?? place.formattedAddress ?? "Location");
            if (place.viewport) {
              map.fitBounds(place.viewport, 48);
            } else if (place.location) {
              map.panTo({ lat: place.location.lat(), lng: place.location.lng() });
              map.setZoom(18);
            }
          };
          searchElement.addEventListener("gmp-placeselect", searchHandler);
          searchElement.addEventListener("gmp-select", searchHandler);
          searchHostRef.current.replaceChildren(searchElement);
        }

        if (markerConstructorRef.current && initialVisualizationRef.current === "markers") {
          markersRef.current = createMarkers(
            markerConstructorRef.current,
            map,
            infoWindowRef.current,
            records,
            handleOpenJunctionAnalysis,
          );
        }

        fitRecords(maps, map, records);
        setReady(true);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Google Maps could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
      listeners.forEach((listener) => listener.remove());
      if (searchElement && searchHandler) {
        searchElement.removeEventListener("gmp-placeselect", searchHandler);
        searchElement.removeEventListener("gmp-select", searchHandler);
      }
      clearMarkers(markersRef.current);
      heatmapRef.current?.destroy();
      heatmapRef.current = null;
      selectionRectangleRef.current?.setMap(null);
      selectionRectangleRef.current = null;
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      if (mapRef.current && mapsRef.current) {
        mapsRef.current.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
      mapsRef.current = null;
      markerConstructorRef.current = null;
    };
  }, [configured, handleOpenJunctionAnalysis, records]);

  useEffect(() => {
    const map = mapRef.current;
    const constructor = markerConstructorRef.current;
    const infoWindow = infoWindowRef.current;
    heatmapRef.current?.setData(heatmapPoints);
    heatmapRef.current?.setVisible(visualizationMode === "heatmap");

    clearMarkers(markersRef.current);
    if (visualizationMode === "markers" && map && constructor && infoWindow) {
      markersRef.current = createMarkers(
        constructor,
        map,
        infoWindow,
        records,
        handleOpenJunctionAnalysis,
      );
    }
  }, [handleOpenJunctionAnalysis, heatmapPoints, records, visualizationMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMapTypeId(MAP_TYPE_IDS[mapType]);
    setPreferredGoogleMapType(mapType);
  }, [mapType]);

  useEffect(() => {
    if (!streetViewOpen || !streetViewPosition || !panoramaContainerRef.current) {
      return;
    }
    const maps = mapsRef.current;
    if (!maps) return;
    panoramaRef.current = new maps.StreetViewPanorama(
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

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || !selectionEnabled) return;

    let start: { lat: number; lng: number } | null = null;
    const listeners: GoogleMapsListener[] = [];
    map.setOptions({
      draggable: false,
      gestureHandling: "none",
      draggableCursor: "crosshair",
    });

    listeners.push(
      map.addListener("mousedown", (...args: unknown[]) => {
        const event = args[0] as GoogleMapClickEvent | undefined;
        if (!event?.latLng) return;
        start = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        selectionRectangleRef.current?.setMap(null);
        selectionRectangleRef.current = new maps.Rectangle({
          map,
          bounds: mapBoundsOptions(
            calculateBounds(start.lng, start.lat, start.lng, start.lat),
          ),
          clickable: false,
          editable: false,
          draggable: false,
          fillColor: "#2563eb",
          fillOpacity: 0.14,
          strokeColor: "#1d4ed8",
          strokeOpacity: 1,
          strokeWeight: 3,
          zIndex: 50,
        });
      }),
      map.addListener("mousemove", (...args: unknown[]) => {
        const event = args[0] as GoogleMapClickEvent | undefined;
        if (!start || !event?.latLng || !selectionRectangleRef.current) return;
        selectionRectangleRef.current.setBounds(
          mapBoundsOptions(
            calculateBounds(
              start.lng,
              start.lat,
              event.latLng.lng(),
              event.latLng.lat(),
            ),
          ),
        );
      }),
      map.addListener("mouseup", (...args: unknown[]) => {
        const event = args[0] as GoogleMapClickEvent | undefined;
        if (!start || !event?.latLng) return;
        const finalBounds = calculateBounds(
          start.lng,
          start.lat,
          event.latLng.lng(),
          event.latLng.lat(),
        );
        selectionRectangleRef.current?.setBounds(mapBoundsOptions(finalBounds));
        setSelectedBounds(finalBounds);
        setSelectionEnabled(false);
        setShowAnalysis(false);
        setAnalysis(null);
        setAnalysisError(null);
        start = null;
      }),
    );

    return () => {
      listeners.forEach((listener) => listener.remove());
      map.setOptions({
        draggable: true,
        gestureHandling: "greedy",
        draggableCursor: undefined,
      });
    };
  }, [selectionEnabled]);

  const handleSelectArea = useCallback(() => {
    selectionRectangleRef.current?.setMap(null);
    selectionRectangleRef.current = null;
    setSelectedBounds(null);
    setShowAnalysis(false);
    setAnalysis(null);
    setAnalysisError(null);
    setSelectionEnabled(true);
  }, []);

  const handleCloseSelectedArea = useCallback(() => {
    selectionRectangleRef.current?.setMap(null);
    selectionRectangleRef.current = null;
    setSelectedBounds(null);
    setSelectionEnabled(false);
    setShowAnalysis(false);
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

  const handleAnalyseArea = useCallback(() => {
    if (!selectedBounds) return;
    try {
      setAnalysis(AreaAnalysisService.analyse(selectedBounds));
      setAnalysisError(null);
      setShowAnalysis(true);
    } catch (error) {
      setAnalysis(null);
      setShowAnalysis(true);
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "The selected area could not be analysed.",
      );
    }
  }, [selectedBounds]);

  const handleMaxDetail = useCallback(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    const center = mapCenterLiteral(map);
    if (!center) return;
    setMapType("Satellite");
    setMaxZoomMessage("Checking available Google satellite detail…");
    new maps.MaxZoomService().getMaxZoomAtLatLng(center, (result, status) => {
      if (status === "OK" && typeof result?.zoom === "number") {
        const zoom = Math.min(result.zoom, 22);
        map.setZoom(zoom);
        setMaxZoomMessage(`Maximum available satellite zoom: ${zoom}`);
      } else {
        setMaxZoomMessage("Maximum satellite zoom was not available here.");
      }
    });
  }, []);

  const handleStreetView = useCallback(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    const center = mapCenterLiteral(map);
    if (!center) return;
    setStreetViewMessage("Searching for the nearest Google Street View panorama…");
    new maps.StreetViewService().getPanorama(
      { location: center, radius: 150, preference: "nearest" },
      (data, status) => {
        const position = data?.location?.latLng;
        if (status === "OK" && position) {
          setStreetViewPosition({ lat: position.lat(), lng: position.lng() });
          setStreetViewMessage(
            data?.location?.description || "Nearest Street View panorama",
          );
          setStreetViewOpen(true);
        } else {
          setStreetViewMessage("No Street View panorama was found near this location.");
        }
      },
    );
  }, []);

  const handleFitData = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    fitRecords(maps, map, records);
  }, [records]);

  if (!configured || loadError) {
    return (
      <div className="grid h-full min-h-[320px] place-items-center bg-[#07101f] p-6">
        <div className="max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
          <strong className="block text-white">Google Maps could not start</strong>
          <p className="mt-2 leading-6">{loadError || "Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env.local, then restart the app."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07101f]">
      <div ref={mapContainerRef} className="roadsafe-google-map h-full w-full" />

      {!ready && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#07101f]/90 text-xs font-bold text-slate-300">
          Loading Google accident intelligence…
        </div>
      )}

      <div className="absolute left-3 top-3 z-20 w-[min(360px,calc(100%-24px))] rounded-md border border-[#24426b] bg-[#061125]/95 p-2 shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Search size={14} className="shrink-0 text-[#8bb8ff]" />
          <div ref={searchHostRef} className="min-w-0 flex-1" />
        </div>
        {searchLabel && (
          <p className="mt-1.5 truncate px-5 text-[8px] text-slate-500">
            {searchLabel}
          </p>
        )}
      </div>

      <div className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
        <div className="flex flex-wrap justify-end overflow-hidden rounded-md border border-[#24426b] bg-[#061125]/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
          {(["Road", "Satellite", "Hybrid", "Terrain"] as GoogleMapDisplayType[]).map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMapType(type)}
                className={`rounded px-2.5 py-1.5 text-[9px] font-semibold transition-colors ${
                  mapType === type
                    ? "bg-[#173b72] text-white"
                    : "text-slate-300 hover:bg-[#0c1c36]"
                }`}
              >
                {type}
              </button>
            ),
          )}
        </div>

        <div className="flex flex-wrap justify-end overflow-hidden rounded-md border border-[#24426b] bg-[#061125]/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
          <button
            type="button"
            onClick={handleMaxDetail}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-[#0c1c36]"
          >
            <ZoomIn size={12} /> Max detail
          </button>
          <button
            type="button"
            onClick={handleStreetView}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-[#0c1c36]"
          >
            <ScanEye size={12} /> Street View
          </button>
          <button
            type="button"
            onClick={handleFitData}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-[#0c1c36]"
          >
            <Focus size={12} /> Fit data
          </button>
          <button
            type="button"
            onClick={handleSelectArea}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-semibold ${
              selectionEnabled
                ? "bg-[#254d82] text-white"
                : "text-slate-300 hover:bg-[#0c1c36]"
            }`}
          >
            <Crosshair size={12} />
            {selectionEnabled ? "Draw area" : "Select area"}
          </button>
        </div>

        <div className="flex overflow-hidden rounded-md border border-[#24426b] bg-[#061125]/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onVisualizationModeChange("markers")}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-semibold ${
              visualizationMode === "markers"
                ? "bg-[#173b72] text-white"
                : "text-slate-300 hover:bg-[#0c1c36]"
            }`}
          >
            <MapPinned size={12} /> Markers
          </button>
          <button
            type="button"
            onClick={() => onVisualizationModeChange("heatmap")}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[9px] font-semibold ${
              visualizationMode === "heatmap"
                ? "bg-[#173b72] text-white"
                : "text-slate-300 hover:bg-[#0c1c36]"
            }`}
          >
            <Layers3 size={12} /> Heatmap
          </button>
        </div>
      </div>

      {(maxZoomMessage || streetViewMessage) && (
        <div className="absolute left-1/2 top-[78px] z-20 max-w-[min(420px,calc(100%-24px))] -translate-x-1/2 rounded-full border border-[#24426b] bg-[#061125]/95 px-4 py-2 text-center text-[9px] font-semibold text-slate-200 shadow-xl backdrop-blur-sm">
          {streetViewMessage || maxZoomMessage}
        </div>
      )}

      {visualizationMode === "markers" ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 min-w-[118px] rounded-md border border-[#24426b] bg-[#061125]/95 px-3 py-2 shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-300">
            Junction risk
          </p>
          <div className="space-y-1.5 text-[9px] text-slate-400">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />High</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Medium</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Low</div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-40 rounded-md border border-[#24426b] bg-[#061125]/95 px-3 py-2 shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-300">
            Accident concentration
          </p>
          <div className="h-1.5 w-full rounded-full bg-[linear-gradient(to_right,#244e91,#4e8bd3,#32cdaa,#facc15,#ef6848,#7f1d1d)]" />
          <div className="mt-1.5 flex justify-between text-[8px] text-slate-500"><span>Lower</span><span>Higher</span></div>
        </div>
      )}

      {selectionEnabled && (
        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          Click and drag to select an area
        </div>
      )}

      {selectedBounds && compactSelectionPanel && (
        <CompactSelectionPanel
          analysis={analysis}
          analysisError={analysisError}
          onAnalyse={handleAnalyseArea}
          onClose={handleCloseSelectedArea}
          onReselect={handleSelectArea}
          onToggleAnalysis={() => setShowAnalysis((current) => !current)}
          showAnalysis={showAnalysis}
        />
      )}

      {selectedBounds && !compactSelectionPanel && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[95%] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Selected area</h3>
                <p className="text-sm text-gray-500">Google Maps road-safety analysis zone</p>
              </div>
              <button
                type="button"
                onClick={handleCloseSelectedArea}
                className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-red-700"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <SelectedAreaPreview
                bounds={selectedBounds}
                mapType={mapType}
                visualizationMode={visualizationMode}
                heatmapFilters={heatmapFilters}
                onViewFullAnalysis={handleOpenJunctionAnalysis}
              />
              {showAnalysis && analysis && (
                <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
                  <AreaAnalysisResults analysis={analysis} />
                </div>
              )}
              {showAnalysis && analysisError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
                  <h4 className="font-semibold text-red-800">Analysis failed</h4>
                  <p className="mt-1 text-sm text-red-700">{analysisError}</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSelectArea}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Select again
                </button>
                {showAnalysis && analysis ? (
                  <button
                    type="button"
                    onClick={() => setShowAnalysis(false)}
                    className="rounded-lg border border-blue-600 px-5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Hide analysis
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAnalyseArea}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Analyse selected area
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {streetViewOpen && streetViewPosition && (
        <div className="absolute inset-3 z-40 overflow-hidden rounded-xl border border-[#24426b] bg-[#061125] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#24426b] px-4 py-3 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8bb8ff]">Google Street View</p>
              <p className="mt-1 text-xs text-slate-300">{streetViewMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setStreetViewOpen(false)}
              className="rounded border border-[#24426b] p-2 text-slate-300 hover:bg-[#0d1b33]"
              aria-label="Close Street View"
            >
              <X size={16} />
            </button>
          </div>
          <div ref={panoramaContainerRef} className="roadsafe-google-map h-[calc(100%-65px)] w-full" />
        </div>
      )}

      {selectedJunctionId && (
        <JunctionAnalysisModal
          junctionId={selectedJunctionId}
          onClose={() => setSelectedJunctionId(null)}
        />
      )}
    </div>
  );
}

interface CompactSelectionPanelProps {
  analysis: AreaAnalysis | null;
  analysisError: string | null;
  onAnalyse(): void;
  onClose(): void;
  onReselect(): void;
  onToggleAnalysis(): void;
  showAnalysis: boolean;
}

function CompactSelectionPanel({
  analysis,
  analysisError,
  onAnalyse,
  onClose,
  onReselect,
  onToggleAnalysis,
  showAnalysis,
}: CompactSelectionPanelProps) {
  return (
    <div className="absolute bottom-3 right-3 z-20 w-[min(270px,calc(100%-24px))] overflow-hidden rounded-md border border-[#24426b] bg-[#061125]/98 shadow-[0_14px_34px_rgba(0,0,0,.45)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 border-b border-[#19345a] px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-100">Selected area</h3>
          <p className="mt-0.5 truncate text-[8px] text-slate-500">Focused Google Maps analysis zone</p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-[#24426b] px-2 py-1 text-[8px] font-semibold text-slate-300 hover:bg-[#0d1b33]">Close</button>
      </div>
      <div className="space-y-2.5 px-3 py-3">
        {showAnalysis && analysis ? (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                ["Junctions", analysis.totalJunctions],
                ["Crashes", analysis.totalAccidents],
                ["Fatal", analysis.totalFatalities],
                ["Injured", analysis.totalInjuries],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-[#1b3559] bg-[#08162b] px-1.5 py-2 text-center">
                  <p className="text-[12px] font-bold text-slate-100">{value}</p>
                  <p className="mt-0.5 text-[7px] uppercase tracking-[0.06em] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded border border-[#1b3559] bg-[#08162b] px-2.5 py-2">
              <span className="text-[8px] uppercase tracking-[0.08em] text-slate-500">Overall risk</span>
              <span className="text-[9px] font-bold text-[#78adfa]">{analysis.overallRiskLevel}</span>
            </div>
          </>
        ) : analysisError ? (
          <p className="rounded border border-[#623044] bg-[#2a101b] px-2.5 py-2 text-[8px] text-[#ff9db0]">{analysisError}</p>
        ) : (
          <p className="text-[8px] leading-4 text-slate-400">Analyse this selection for junctions, recorded crashes, casualties and overall risk.</p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onReselect} className="flex-1 rounded border border-[#24426b] bg-[#08162b] px-2 py-1.5 text-[8px] font-semibold text-slate-300 hover:bg-[#0d1b33]">Select again</button>
          <button
            type="button"
            onClick={showAnalysis && analysis ? onToggleAnalysis : onAnalyse}
            className="flex-1 rounded border border-[#315f9c] bg-[#12396f] px-2 py-1.5 text-[8px] font-semibold text-[#d8e9ff] hover:bg-[#174783]"
          >
            {showAnalysis && analysis ? "Hide analysis" : "Analyse area"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SelectedAreaPreviewProps {
  bounds: MapBounds;
  mapType: GoogleMapDisplayType;
  visualizationMode: VisualizationMode;
  heatmapFilters: AccidentHeatmapFilters;
  onViewFullAnalysis(junctionId: string): void;
}

function SelectedAreaPreview({
  bounds,
  mapType,
  visualizationMode,
  heatmapFilters,
  onViewFullAnalysis,
}: SelectedAreaPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: GoogleMapsMap | null = null;
    let mapsNamespace: GoogleMapsNamespace | null = null;
    let heatmap: GoogleHeatmapOverlayHandle | null = null;
    let markers: GoogleAdvancedMarker[] = [];
    let infoWindow: GoogleInfoWindow | null = null;
    let rectangle: GoogleRectangle | null = null;

    void loadGoogleMaps().then(async (maps) => {
      if (cancelled || !containerRef.current) return;
      mapsNamespace = maps;
      map = new maps.Map(containerRef.current, {
        center: {
          lat: (bounds.north + bounds.south) / 2,
          lng: (bounds.east + bounds.west) / 2,
        },
        zoom: INITIAL_ZOOM,
        minZoom: 3,
        maxZoom: 22,
        mapTypeId: MAP_TYPE_IDS[mapType],
        mapId: getGoogleMapsRuntimeMapId(),
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        rotateControl: false,
        scaleControl: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
      const googleBounds = new maps.LatLngBounds();
      googleBounds.extend({ lat: bounds.south, lng: bounds.west });
      googleBounds.extend({ lat: bounds.north, lng: bounds.east });
      map.fitBounds(googleBounds, 32);

      rectangle = new maps.Rectangle({
        map,
        bounds: mapBoundsOptions(bounds),
        clickable: false,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        strokeColor: "#1d4ed8",
        strokeOpacity: 1,
        strokeWeight: 2,
      });

      if (visualizationMode === "heatmap") {
        heatmap = createGoogleHeatmapOverlay(
          maps,
          map,
          getAccidentHeatmapPoints(bounds, heatmapFilters),
        );
      } else {
        const markerLibrary = await maps.importLibrary("marker");
        const markerConstructor = markerLibrary.AdvancedMarkerElement as
          | GoogleAdvancedMarkerConstructor
          | undefined;
        if (markerConstructor) {
          infoWindow = new maps.InfoWindow({ maxWidth: 380 });
          markers = createMarkers(
            markerConstructor,
            map,
            infoWindow,
            getJunctionMapRecords(bounds),
            onViewFullAnalysis,
          );
        }
      }
    });

    return () => {
      cancelled = true;
      clearMarkers(markers);
      heatmap?.destroy();
      infoWindow?.close();
      rectangle?.setMap(null);
      if (map && mapsNamespace) {
        mapsNamespace.event.clearInstanceListeners(map);
      }
    };
  }, [bounds, heatmapFilters, mapType, onViewFullAnalysis, visualizationMode]);

  return (
    <div className="h-[340px] overflow-hidden rounded-xl border border-gray-200">
      <div ref={containerRef} className="roadsafe-google-map h-full w-full" />
    </div>
  );
}

