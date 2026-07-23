import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  LocateFixed,
  ScanEye,
  Search,
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
  getGoogleMapsMapId,
  getPreferredGoogleMapType,
  setPreferredGoogleMapType,
} from "../../services/mapPreferencesService";
import type { GoogleMapDisplayType } from "../../types/mapping";
import type {
  DetectedRoadFeature,
  DetectedRoadSegment,
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";
import { createAccuracyCircleGeoJson } from "../../utils/geographicCoordinates";

interface GoogleRoadLocationMapProps {
  coordinate: RoadDetectionCoordinate | null;
  currentCoordinate?: RoadDetectionCoordinate | null;
  roads?: DetectedRoadSegment[];
  features?: DetectedRoadFeature[];
  editable?: boolean;
  onCoordinateChange?: (coordinate: RoadDetectionCoordinate) => void;
  onLoadError?: (message: string) => void;
}

interface GoogleRoadLayers {
  accuracy: GoogleDataLayer;
  current: GoogleDataLayer;
  feature: GoogleDataLayer;
  road: GoogleDataLayer;
  roadCasing: GoogleDataLayer;
  selected: GoogleDataLayer;
}

interface GoogleMapClickEvent {
  latLng?: { lat(): number; lng(): number };
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

function pointFeature(
  coordinate: Pick<RoadDetectionCoordinate, "latitude" | "longitude">,
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

function roadsToFeatures(
  roads: DetectedRoadSegment[],
): Array<GeoJSON.Feature<GeoJSON.LineString>> {
  return roads
    .filter((road) => road.points.length >= 2)
    .map((road) => ({
      type: "Feature",
      properties: {
        id: road.id,
        name: road.name,
        highwayType: road.highwayType,
      },
      geometry: {
        type: "LineString",
        coordinates: road.points.map((point) => [
          point.longitude,
          point.latitude,
        ]),
      },
    }));
}

function createLayers(
  maps: GoogleMapsNamespace,
  map: GoogleMapsMap,
): GoogleRoadLayers {
  const layers: GoogleRoadLayers = {
    accuracy: new maps.Data({ map }),
    current: new maps.Data({ map }),
    feature: new maps.Data({ map }),
    road: new maps.Data({ map }),
    roadCasing: new maps.Data({ map }),
    selected: new maps.Data({ map }),
  };

  layers.accuracy.setStyle({
    fillColor: "#2563eb",
    fillOpacity: 0.12,
    strokeColor: "#2563eb",
    strokeOpacity: 0.8,
    strokeWeight: 2,
  });
  layers.roadCasing.setStyle({
    strokeColor: "#ffffff",
    strokeOpacity: 0.9,
    strokeWeight: 8,
  });
  layers.road.setStyle({
    strokeColor: "#dc2626",
    strokeOpacity: 0.95,
    strokeWeight: 4.5,
  });
  layers.feature.setStyle({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 5.5,
      fillColor: "#f59e0b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
  layers.selected.setStyle({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#dc2626",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
    },
  });
  layers.current.setStyle({
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 5,
      fillColor: "#2563eb",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });

  return layers;
}

export default function GoogleRoadLocationMap({
  coordinate,
  currentCoordinate = null,
  roads = [],
  features = [],
  editable = false,
  onCoordinateChange,
  onLoadError,
}: GoogleRoadLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const panoramaContainerRef = useRef<HTMLDivElement | null>(null);
  const searchHostRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const initialCoordinateRef = useRef(coordinate ?? currentCoordinate ?? null);
  const onLoadErrorRef = useRef(onLoadError);
  const mapRef = useRef<GoogleMapsMap | null>(null);
  const layersRef = useRef<GoogleRoadLayers | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);
  const onCoordinateChangeRef = useRef(onCoordinateChange);
  const editableRef = useRef(editable);
  const coordinateRef = useRef(coordinate);
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
    onCoordinateChangeRef.current = onCoordinateChange;
    editableRef.current = editable;
    coordinateRef.current = coordinate;
  }, [coordinate, editable, onCoordinateChange]);

  useEffect(() => {
    let cancelled = false;
    let searchElement: HTMLElement | null = null;
    let clickListener: { remove(): void } | null = null;

    void loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !mapContainerRef.current) return;
        mapsRef.current = maps;
        const initial = initialCoordinateRef.current;
        const map = new maps.Map(mapContainerRef.current, {
          center: initial
            ? latLngLiteral(initial)
            : { lat: -17.8252, lng: 31.0335 },
          zoom: initial ? 18 : 6,
          minZoom: 3,
          maxZoom: 22,
          mapTypeId: MAP_TYPE_IDS[initialMapTypeRef.current],
          mapId: getGoogleMapsMapId(),
          gestureHandling: "greedy",
          fullscreenControl: true,
          mapTypeControl: false,
          rotateControl: true,
          scaleControl: true,
          streetViewControl: false,
          zoomControl: true,
        });
        mapRef.current = map;
        layersRef.current = createLayers(maps, map);

        clickListener = map.addListener("click", (...args: unknown[]) => {
          const event = args[0] as GoogleMapClickEvent | undefined;
          if (!editableRef.current || !event?.latLng) return;
          onCoordinateChangeRef.current?.({
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
            accuracyMetres: coordinateRef.current?.accuracyMetres ?? 10,
            capturedAt: new Date().toISOString(),
          });
        });

        const placesLibrary = await maps.importLibrary("places");
        const PlaceAutocompleteElement = placesLibrary.PlaceAutocompleteElement as
          | (new (options?: Record<string, unknown>) => HTMLElement)
          | undefined;
        if (PlaceAutocompleteElement && searchHostRef.current) {
          searchElement = new PlaceAutocompleteElement({});
          searchElement.style.width = "100%";
          searchElement.setAttribute("aria-label", "Search for the incident location");
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
            if (editableRef.current && place.location) {
              onCoordinateChangeRef.current?.({
                latitude: place.location.lat(),
                longitude: place.location.lng(),
                accuracyMetres: 10,
                capturedAt: new Date().toISOString(),
              });
            }
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
      clickListener?.remove();
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
      coordinate ? [createAccuracyCircleGeoJson(coordinate)] : [],
    );
    replaceLayerData(
      layers.selected,
      coordinate ? [pointFeature(coordinate, { kind: "selected" })] : [],
    );
    replaceLayerData(
      layers.current,
      currentCoordinate
        ? [pointFeature(currentCoordinate, { kind: "current" })]
        : [],
    );
    const roadFeatures = roadsToFeatures(roads);
    replaceLayerData(layers.roadCasing, roadFeatures);
    replaceLayerData(layers.road, roadFeatures);
    replaceLayerData(
      layers.feature,
      features.map((feature) =>
        pointFeature(
          { latitude: feature.latitude, longitude: feature.longitude },
          { id: feature.id, type: feature.type },
        ),
      ),
    );
  }, [coordinate, currentCoordinate, features, ready, roads]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coordinate) return;
    map.panTo(latLngLiteral(coordinate));
    map.setZoom(Math.max(map.getZoom() ?? 17, 17.5));
  }, [coordinate]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || roads.length === 0) return;
    const bounds = new maps.LatLngBounds();
    roads.forEach((road) =>
      road.points.forEach((point) =>
        bounds.extend({ lat: point.latitude, lng: point.longitude }),
      ),
    );
    if (coordinate) bounds.extend(latLngLiteral(coordinate));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 55);
  }, [coordinate, roads]);

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

  const useMapCentre = () => {
    const centre = mapRef.current ? mapCenterLiteral(mapRef.current) : null;
    if (!centre || !editable || !onCoordinateChange) return;
    onCoordinateChange({
      latitude: centre.lat,
      longitude: centre.lng,
      accuracyMetres: coordinate?.accuracyMetres ?? 10,
      capturedAt: new Date().toISOString(),
    });
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

  const openStreetView = () => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const centre = map ? mapCenterLiteral(map) : null;
    if (!maps || !centre) return;
    setStreetViewMessage("Finding the nearest Street View panorama…");
    new maps.StreetViewService().getPanorama(
      { location: centre, radius: 180, preference: "nearest", source: "outdoor" },
      (data, status) => {
        const position = data?.location?.latLng;
        if (status !== "OK" || !position) {
          setStreetViewMessage("No Street View panorama was found within 180 metres.");
          setStreetViewOpen(false);
          return;
        }
        setStreetViewPosition({ lat: position.lat(), lng: position.lng() });
        setStreetViewMessage(
          data.location?.description
            ? `Street View: ${data.location.description}`
            : "Nearest Street View panorama",
        );
        setStreetViewOpen(true);
      },
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(Object.keys(MAP_TYPE_IDS) as GoogleMapDisplayType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMapType(type)}
              className={`px-2.5 py-2 text-[10px] font-black ${
                mapType === type
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="min-w-[230px] flex-1 rounded-lg border border-slate-200 bg-white p-1">
          <div ref={searchHostRef} className="min-h-9 w-full" />
        </div>
        <button
          type="button"
          onClick={zoomToMaximumImagery}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
        >
          <ZoomIn size={14} /> Max Detail
        </button>
        <button
          type="button"
          onClick={openStreetView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
        >
          <ScanEye size={14} /> Street View
        </button>
        {editable && (
          <button
            type="button"
            onClick={useMapCentre}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700"
          >
            <Crosshair size={14} /> Use Centre
          </button>
        )}
      </div>

      <div className={streetViewOpen ? "grid md:grid-cols-2" : "grid"}>
        <div className="relative min-h-[360px]">
          <div ref={mapContainerRef} className="absolute inset-0" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-sm font-black text-white">
              Loading Google Maps…
            </div>
          )}
          {editable && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-red-600 drop-shadow-lg">
              <LocateFixed size={28} strokeWidth={2.6} />
            </div>
          )}
          {(maxZoomMessage || searchLabel) && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-slate-950/85 px-3 py-2 text-[10px] font-bold text-white">
              {[searchLabel, maxZoomMessage].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        {streetViewOpen && (
          <div className="relative min-h-[360px] border-l border-slate-200">
            <div ref={panoramaContainerRef} className="absolute inset-0" />
            <button
              type="button"
              onClick={() => setStreetViewOpen(false)}
              className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg bg-slate-950/90 px-3 py-2 text-xs font-black text-white shadow"
            >
              <X size={14} /> Close
            </button>
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-slate-950/90 px-3 py-2 text-[10px] font-bold text-white">
              {streetViewMessage}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Search size={13} />
          {editable
            ? "Search, click the map, or centre the crosshair and choose Use Centre."
            : "Red lines show detected road geometry around the selected location."}
        </span>
        <span>Google basemap is contextual; confirmed GPS remains authoritative.</span>
      </div>
    </div>
  );
}
