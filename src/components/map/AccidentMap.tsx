import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import JunctionAnalysisModal from "./JunctionAnalysisModal";

import maplibregl from "maplibre-gl";

import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  StyleSpecification,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import AreaAnalysisResults from "./AreaAnalysisResults";

import {
  addJunctionMarkers,
} from "./junctionMapLayer";

import {
  ensureAccidentHeatmapLayers,
  setAccidentHeatmapVisibility,
} from "./accidentHeatmapLayer";

import {
  AreaAnalysisService,
} from "../../services/areaAnalysisService";

import type {
  AreaAnalysis,
} from "../../types/areaAnalysis";

import type {
  AccidentHeatmapFilters,
} from "../../types/heatmap";

import type {
  MapBounds,
} from "../../types/map";

type MapType =
  | "street"
  | "hybrid";

export type VisualizationMode =
  | "markers"
  | "heatmap";

interface AccidentMapProps {
  visualizationMode:
    VisualizationMode;

  onVisualizationModeChange: (
    mode: VisualizationMode,
  ) => void;

  heatmapFilters:
    AccidentHeatmapFilters;
}

interface SelectionFeatureCollection {
  type: "FeatureCollection";

  features: Array<{
    type: "Feature";

    properties:
      Record<string, never>;

    geometry: {
      type: "Polygon";

      coordinates:
        number[][][];
    };
  }>;
}

const MAX_ALLOWED_ZOOM = 18;
const MIN_ALLOWED_ZOOM = 5;
const INITIAL_ZOOM = 15;

const INITIAL_CENTER: [
  number,
  number,
] = [
  31.336976,
  -17.311182,
];

const STREET_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

const SELECTION_SOURCE_ID =
  "selected-area-source";

const SELECTION_FILL_LAYER_ID =
  "selected-area-fill";

const SELECTION_OUTLINE_LAYER_ID =
  "selected-area-outline";

function createHybridStyle():
  StyleSpecification {
  return {
    version: 8,

    sources: {
      "esri-imagery": {
        type: "raster",

        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,

        attribution:
          "Tiles © Esri",
      },

      "esri-transportation": {
        type: "raster",

        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,

        attribution:
          "Transportation © Esri",
      },

      "esri-places": {
        type: "raster",

        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,

        attribution:
          "Places and boundaries © Esri",
      },
    },

    layers: [
      {
        id:
          "esri-imagery-layer",

        type: "raster",

        source:
          "esri-imagery",

        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },

      {
        id:
          "esri-transportation-layer",

        type: "raster",

        source:
          "esri-transportation",

        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },

      {
        id:
          "esri-places-layer",

        type: "raster",

        source:
          "esri-places",

        paint: {
          "raster-opacity": 1,
          "raster-fade-duration": 0,
        },
      },
    ],
  };
}

function getMapStyle(
  mapType: MapType,
): string | StyleSpecification {
  if (mapType === "hybrid") {
    return createHybridStyle();
  }

  return STREET_STYLE;
}

function createEmptyFeatureCollection():
  SelectionFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function boundsToGeoJSON(
  bounds: MapBounds | null,
): SelectionFeatureCollection {
  if (!bounds) {
    return (
      createEmptyFeatureCollection()
    );
  }

  return {
    type: "FeatureCollection",

    features: [
      {
        type: "Feature",

        properties: {},

        geometry: {
          type: "Polygon",

          coordinates: [
            [
              [
                bounds.west,
                bounds.south,
              ],

              [
                bounds.east,
                bounds.south,
              ],

              [
                bounds.east,
                bounds.north,
              ],

              [
                bounds.west,
                bounds.north,
              ],

              [
                bounds.west,
                bounds.south,
              ],
            ],
          ],
        },
      },
    ],
  };
}

function calculateBounds(
  startLongitude: number,
  startLatitude: number,
  endLongitude: number,
  endLatitude: number,
): MapBounds {
  return {
    north: Math.max(
      startLatitude,
      endLatitude,
    ),

    south: Math.min(
      startLatitude,
      endLatitude,
    ),

    east: Math.max(
      startLongitude,
      endLongitude,
    ),

    west: Math.min(
      startLongitude,
      endLongitude,
    ),
  };
}

function ensureSelectionLayers(
  map: MapLibreMap,
): void {
  if (
    !map.getSource(
      SELECTION_SOURCE_ID,
    )
  ) {
    map.addSource(
      SELECTION_SOURCE_ID,
      {
        type: "geojson",

        data:
          createEmptyFeatureCollection(),
      },
    );
  }

  if (
    !map.getLayer(
      SELECTION_FILL_LAYER_ID,
    )
  ) {
    map.addLayer({
      id:
        SELECTION_FILL_LAYER_ID,

      type: "fill",

      source:
        SELECTION_SOURCE_ID,

      paint: {
        "fill-color":
          "#2563eb",

        "fill-opacity":
          0.14,
      },
    });
  }

  if (
    !map.getLayer(
      SELECTION_OUTLINE_LAYER_ID,
    )
  ) {
    map.addLayer({
      id:
        SELECTION_OUTLINE_LAYER_ID,

      type: "line",

      source:
        SELECTION_SOURCE_ID,

      paint: {
        "line-color":
          "#1d4ed8",

        "line-width": 3,
      },
    });
  }
}

function updateSelectionLayer(
  map: MapLibreMap,
  bounds: MapBounds | null,
): void {
  if (!map.isStyleLoaded()) {
    return;
  }

  ensureSelectionLayers(map);

  const source =
    map.getSource(
      SELECTION_SOURCE_ID,
    ) as
      | GeoJSONSource
      | undefined;

  source?.setData(
    boundsToGeoJSON(bounds),
  );
}

export default function AccidentMap({
  visualizationMode,
  onVisualizationModeChange,
  heatmapFilters,
}: AccidentMapProps) {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapRef =
    useRef<MapLibreMap | null>(
      null,
    );

  const selectedBoundsRef =
    useRef<MapBounds | null>(
      null,
    );

  const currentMapTypeRef =
    useRef<MapType>("street");

  const visualizationModeRef =
    useRef<VisualizationMode>(
      visualizationMode,
    );

  const heatmapFiltersRef =
    useRef<AccidentHeatmapFilters>(
      heatmapFilters,
    );

  const junctionMarkersCleanupRef =
    useRef<(() => void) | null>(
      null,
    );

  const [mapType, setMapType] =
    useState<MapType>("street");

  const [
    selectionEnabled,
    setSelectionEnabled,
  ] = useState(false);

  const [
  selectedJunctionId,
  setSelectedJunctionId,
] = useState<string | null>(null);

const handleOpenJunctionAnalysis =
  useCallback(
    (junctionId: string) => {
      setSelectedJunctionId(
        junctionId,
      );
    },
    [],
  );

const handleCloseJunctionAnalysis =
  useCallback(() => {
    setSelectedJunctionId(null);
  }, []);

  const [
    selectedBounds,
    setSelectedBounds,
  ] = useState<MapBounds | null>(
    null,
  );

  const [
    showAnalysis,
    setShowAnalysis,
  ] = useState(false);

  const [
    analysis,
    setAnalysis,
  ] = useState<AreaAnalysis | null>(
    null,
  );

  const [
    analysisError,
    setAnalysisError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    selectedBoundsRef.current =
      selectedBounds;

    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (map.isStyleLoaded()) {
      updateSelectionLayer(
        map,
        selectedBounds,
      );

      return;
    }

    const handleStyleLoad =
      () => {
        updateSelectionLayer(
          map,
          selectedBoundsRef.current,
        );
      };

    map.once(
      "style.load",
      handleStyleLoad,
    );

    return () => {
      map.off(
        "style.load",
        handleStyleLoad,
      );
    };
  }, [selectedBounds]);

  useEffect(() => {
    if (
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return;
    }

    const map =
      new maplibregl.Map({
        container:
          mapContainerRef.current,

        style:
          getMapStyle("street"),

        center:
          INITIAL_CENTER,

        zoom:
          INITIAL_ZOOM,

        minZoom:
          MIN_ALLOWED_ZOOM,

        maxZoom:
          MAX_ALLOWED_ZOOM,

        pitch: 0,
        bearing: 0,

        attributionControl: {
          compact: true,
        },
      });

    const handleCoordinatePick = (
      event:
        maplibregl.MapMouseEvent,
    ) => {
      const latitude =
        Number(
          event.lngLat.lat.toFixed(
            6,
          ),
        );

      const longitude =
        Number(
          event.lngLat.lng.toFixed(
            6,
          ),
        );

      console.log(
        "Selected coordinate:",
        {
          latitude,
          longitude,
        },
      );

      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
      })
        .setLngLat([
          longitude,
          latitude,
        ])
        .setHTML(`
          <div style="padding: 4px;">
            <strong>Selected coordinate</strong>

            <p style="margin: 6px 0 0;">
              Latitude: ${latitude}<br />
              Longitude: ${longitude}
            </p>
          </div>
        `)
        .addTo(map);
    };

    map.on(
      "contextmenu",
      handleCoordinatePick,
    );

    map.addControl(
      new maplibregl
        .NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
      "bottom-right",
    );

    map.addControl(
      new maplibregl
        .ScaleControl({
          maxWidth: 120,
          unit: "metric",
        }),
      "bottom-left",
    );

    const handleMapLoad =
      () => {
        map.setMaxZoom(
          MAX_ALLOWED_ZOOM,
        );

        ensureAccidentHeatmapLayers(
          map,
          undefined,
          heatmapFiltersRef.current,
        );

        setAccidentHeatmapVisibility(
          map,

          visualizationModeRef.current ===
            "heatmap",
        );

        ensureSelectionLayers(
          map,
        );

        updateSelectionLayer(
          map,
          selectedBoundsRef.current,
        );

        if (
          visualizationModeRef.current ===
          "markers"
        ) {
          junctionMarkersCleanupRef
            .current?.();

          junctionMarkersCleanupRef.current =
            addJunctionMarkers(
  map,
  undefined,
  handleOpenJunctionAnalysis,
);
        }

        map.resize();
      };

    map.on(
      "load",
      handleMapLoad,
    );

    mapRef.current = map;

    return () => {
      junctionMarkersCleanupRef
        .current?.();

      junctionMarkersCleanupRef.current =
        null;

      map.off(
        "contextmenu",
        handleCoordinatePick,
      );

      map.off(
        "load",
        handleMapLoad,
      );

      map.remove();

      mapRef.current = null;
    };
  }, [handleOpenJunctionAnalysis]);

  useEffect(() => {
    visualizationModeRef.current =
      visualizationMode;

    const map = mapRef.current;

    if (
      !map ||
      !map.isStyleLoaded()
    ) {
      return;
    }

    ensureAccidentHeatmapLayers(
      map,
      undefined,
      heatmapFiltersRef.current,
      SELECTION_FILL_LAYER_ID,
    );

    setAccidentHeatmapVisibility(
      map,

      visualizationMode ===
        "heatmap",
    );

    if (
      visualizationMode ===
      "markers"
    ) {
      if (
        !junctionMarkersCleanupRef
          .current
      ) {
        junctionMarkersCleanupRef.current =
          addJunctionMarkers(
  map,
  undefined,
  handleOpenJunctionAnalysis,
);
      }

      return;
    }

    junctionMarkersCleanupRef
      .current?.();

    junctionMarkersCleanupRef.current =
      null;
  }, [handleOpenJunctionAnalysis, visualizationMode]);

  useEffect(() => {
    heatmapFiltersRef.current =
      heatmapFilters;

    const map = mapRef.current;

    if (
      !map ||
      !map.isStyleLoaded()
    ) {
      return;
    }

    ensureAccidentHeatmapLayers(
      map,
      undefined,
      heatmapFilters,
      SELECTION_FILL_LAYER_ID,
    );

    setAccidentHeatmapVisibility(
      map,

      visualizationModeRef.current ===
        "heatmap",
    );
  }, [heatmapFilters]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.setMaxZoom(
      MAX_ALLOWED_ZOOM,
    );

    if (
      map.getZoom() >
      MAX_ALLOWED_ZOOM
    ) {
      map.jumpTo({
        zoom:
          MAX_ALLOWED_ZOOM,
      });
    }

    if (
      currentMapTypeRef.current ===
      mapType
    ) {
      return;
    }

    currentMapTypeRef.current =
      mapType;

    const handleStyleLoad =
      () => {
        map.setMaxZoom(
          MAX_ALLOWED_ZOOM,
        );

        ensureAccidentHeatmapLayers(
          map,
          undefined,
          heatmapFiltersRef.current,
        );

        setAccidentHeatmapVisibility(
          map,

          visualizationModeRef.current ===
            "heatmap",
        );

        ensureSelectionLayers(
          map,
        );

        updateSelectionLayer(
          map,
          selectedBoundsRef.current,
        );

        junctionMarkersCleanupRef
          .current?.();

        junctionMarkersCleanupRef.current =
          null;

        if (
          visualizationModeRef.current ===
          "markers"
        ) {
          junctionMarkersCleanupRef.current =
            addJunctionMarkers(
  map,
  undefined,
  handleOpenJunctionAnalysis,
);
        }

        map.resize();
      };

    map.once(
      "style.load",
      handleStyleLoad,
    );

    map.setStyle(
      getMapStyle(mapType),
    );

    return () => {
      map.off(
        "style.load",
        handleStyleLoad,
      );
    };
  }, [handleOpenJunctionAnalysis, mapType]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !selectionEnabled
    ) {
      return;
    }

    let startLongitude:
      | number
      | null = null;

    let startLatitude:
      | number
      | null = null;

    let drawing = false;

    map.dragPan.disable();

    map.getCanvas().style.cursor =
      "crosshair";

    const handleMouseDown = (
      event: MapMouseEvent,
    ) => {
      if (
        event.originalEvent.button !==
        0
      ) {
        return;
      }

      event.preventDefault();

      startLongitude =
        event.lngLat.lng;

      startLatitude =
        event.lngLat.lat;

      drawing = true;

      const initialBounds =
        calculateBounds(
          startLongitude,
          startLatitude,
          startLongitude,
          startLatitude,
        );

      updateSelectionLayer(
        map,
        initialBounds,
      );
    };

    const handleMouseMove = (
      event: MapMouseEvent,
    ) => {
      if (
        !drawing ||
        startLongitude === null ||
        startLatitude === null
      ) {
        return;
      }

      const previewBounds =
        calculateBounds(
          startLongitude,
          startLatitude,
          event.lngLat.lng,
          event.lngLat.lat,
        );

      updateSelectionLayer(
        map,
        previewBounds,
      );
    };

    const handleMouseUp = (
      event: MapMouseEvent,
    ) => {
      if (
        !drawing ||
        startLongitude === null ||
        startLatitude === null
      ) {
        return;
      }

      const finalBounds =
        calculateBounds(
          startLongitude,
          startLatitude,
          event.lngLat.lng,
          event.lngLat.lat,
        );

      drawing = false;

      startLongitude = null;
      startLatitude = null;

      setSelectedBounds(
        finalBounds,
      );

      setSelectionEnabled(
        false,
      );

      setShowAnalysis(false);
      setAnalysis(null);
      setAnalysisError(null);
    };

    map.on(
      "mousedown",
      handleMouseDown,
    );

    map.on(
      "mousemove",
      handleMouseMove,
    );

    map.on(
      "mouseup",
      handleMouseUp,
    );

    return () => {
      map.off(
        "mousedown",
        handleMouseDown,
      );

      map.off(
        "mousemove",
        handleMouseMove,
      );

      map.off(
        "mouseup",
        handleMouseUp,
      );

      map.dragPan.enable();

      map.getCanvas().style.cursor =
        "";
    };
  }, [selectionEnabled]);

  const handleSelectArea =
    useCallback(() => {
      setSelectedBounds(null);
      setShowAnalysis(false);
      setAnalysis(null);
      setAnalysisError(null);

      setSelectionEnabled(
        true,
      );
    }, []);

  const handleCloseSelectedArea =
    useCallback(() => {
      setSelectedBounds(null);

      setSelectionEnabled(
        false,
      );

      setShowAnalysis(false);
      setAnalysis(null);
      setAnalysisError(null);
    }, []);

  const handleAnalyseArea =
    useCallback(() => {
      if (!selectedBounds) {
        return;
      }

      try {
        const result =
          AreaAnalysisService.analyse(
            selectedBounds,
          );

        setAnalysis(result);
        setAnalysisError(null);
        setShowAnalysis(true);
      } catch (error) {
        console.error(
          "Selected area analysis failed:",
          error,
        );

        setAnalysis(null);
        setShowAnalysis(true);

        setAnalysisError(
          error instanceof Error
            ? error.message
            : "The selected area could not be analysed.",
        );
      }
    }, [selectedBounds]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
      />

      {/* Map type controls */}
      <div className="absolute right-4 top-4 z-10 flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
        <button
          type="button"
          onClick={() =>
            setMapType("street")
          }
          className={`px-4 py-2 text-sm font-medium transition ${
            mapType === "street"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Street
        </button>

        <button
          type="button"
          onClick={() =>
            setMapType("hybrid")
          }
          className={`border-l border-gray-200 px-4 py-2 text-sm font-medium transition ${
            mapType === "hybrid"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Hybrid
        </button>

        <button
          type="button"
          onClick={
            handleSelectArea
          }
          className={`border-l border-gray-200 px-4 py-2 text-sm font-medium transition ${
            selectionEnabled
              ? "bg-green-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {selectionEnabled
            ? "Draw Rectangle"
            : "Select Area"}
        </button>
      </div>

      {/* Markers / Heatmap controls */}
      <div className="absolute right-4 top-16 z-10 flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
        <button
          type="button"
          onClick={() =>
            onVisualizationModeChange(
              "markers",
            )
          }
          className={`px-4 py-2 text-sm font-medium transition ${
            visualizationMode ===
            "markers"
              ? "bg-purple-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Markers
        </button>

        <button
          type="button"
          onClick={() =>
            onVisualizationModeChange(
              "heatmap",
            )
          }
          className={`border-l border-gray-200 px-4 py-2 text-sm font-medium transition ${
            visualizationMode ===
            "heatmap"
              ? "bg-purple-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Heatmap
        </button>
      </div>

      {visualizationMode ===
        "markers" && (
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-700">
            Junction Risk
          </p>

          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600" />
              <span>High</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span>Medium</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-600" />
              <span>Low</span>
            </div>
          </div>
        </div>
      )}

      {visualizationMode ===
        "heatmap" && (
        <div className="absolute left-4 top-4 z-10 w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-700">
            Accident Concentration
          </p>

          <div
            className="h-3 w-full rounded-full"
            style={{
              background:
                "linear-gradient(to right, rgb(103,169,207), rgb(50,205,170), rgb(255,255,0), rgb(255,165,0), rgb(239,68,68), rgb(127,29,29))",
            }}
          />

          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>Lower</span>
            <span>Higher</span>
          </div>
        </div>
      )}

      {selectionEnabled && (
        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          Click and drag to select an area
        </div>
      )}

      {selectedBounds && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[95%] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Selected Area
                </h3>

                <p className="text-sm text-gray-500">
                  Focused road-safety analysis zone
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleCloseSelectedArea
                }
                className="rounded-xl bg-red-600 px-8 py-3.5 text-lg font-semibold text-white shadow-md transition hover:bg-red-700 active:scale-95"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto p-5">
<SelectedAreaPreview
  bounds={selectedBounds}
  mapType={mapType}
  visualizationMode={
    visualizationMode
  }
  heatmapFilters={
    heatmapFilters
  }
  onViewFullAnalysis={
    handleOpenJunctionAnalysis
  }
/>

              {showAnalysis &&
                analysis && (
                  <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
                    <AreaAnalysisResults
                      analysis={
                        analysis
                      }
                    />
                  </div>
                )}

              {showAnalysis &&
                analysisError && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
                    <h4 className="font-semibold text-red-800">
                      Analysis failed
                    </h4>

                    <p className="mt-1 text-sm text-red-700">
                      {analysisError}
                    </p>
                  </div>
                )}

              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    handleSelectArea
                  }
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  Select Again
                </button>

                {showAnalysis &&
                analysis ? (
                  <button
                    type="button"
                    onClick={() =>
                      setShowAnalysis(
                        false,
                      )
                    }
                    className="rounded-lg border border-blue-600 px-5 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    Hide Analysis
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={
                      handleAnalyseArea
                    }
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Analyse Selected Area
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedJunctionId && (
        <JunctionAnalysisModal
          junctionId={
            selectedJunctionId
          }
          onClose={
            handleCloseJunctionAnalysis
          }
        />
      )}
    </div>
  );
}

interface SelectedAreaPreviewProps {
  bounds: MapBounds;
  mapType: MapType;
  visualizationMode: VisualizationMode;
  heatmapFilters: AccidentHeatmapFilters;

  onViewFullAnalysis: (
    junctionId: string,
  ) => void;
}

function SelectedAreaPreview({
  bounds,
  mapType,
  visualizationMode,
  heatmapFilters,
  onViewFullAnalysis,
}: SelectedAreaPreviewProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let cleanupJunctionMarkers:
      | (() => void)
      | null = null;

    const previewMap =
      new maplibregl.Map({
        container:
          containerRef.current,

        style:
          getMapStyle(mapType),

        center: [
          (
            bounds.west +
            bounds.east
          ) / 2,

          (
            bounds.south +
            bounds.north
          ) / 2,
        ],

        zoom:
          INITIAL_ZOOM,

        minZoom:
          MIN_ALLOWED_ZOOM,

        maxZoom:
          MAX_ALLOWED_ZOOM,

        pitch: 0,

        bearing: 0,

        attributionControl: {
          compact: true,
        },
      });

    previewMap.addControl(
      new maplibregl
        .NavigationControl({
          showCompass: false,
          showZoom: true,
        }),
      "bottom-right",
    );

    const handlePreviewLoad =
      () => {
        previewMap.setMaxZoom(
          MAX_ALLOWED_ZOOM,
        );

        ensureAccidentHeatmapLayers(
          previewMap,
          bounds,
          heatmapFilters,
        );

        setAccidentHeatmapVisibility(
          previewMap,
          visualizationMode ===
            "heatmap",
        );

        ensureSelectionLayers(
          previewMap,
        );

        updateSelectionLayer(
          previewMap,
          bounds,
        );

        if (
          visualizationMode ===
          "markers"
        ) {
          cleanupJunctionMarkers =
            addJunctionMarkers(
              previewMap,
              bounds,
              onViewFullAnalysis,
            );
        }

        previewMap.resize();
      };

    previewMap.on(
      "load",
      handlePreviewLoad,
    );

    return () => {
      cleanupJunctionMarkers?.();

      cleanupJunctionMarkers =
        null;

      previewMap.off(
        "load",
        handlePreviewLoad,
      );

      previewMap.remove();
    };
  }, [
    bounds,
    mapType,
    visualizationMode,
    heatmapFilters,
    onViewFullAnalysis,
  ]);

  

  return (
    <div className="h-[340px] overflow-hidden rounded-xl border border-gray-200">
      <div
        ref={containerRef}
        className="h-full w-full"
      />

    </div>
  );

  
}