import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import maplibregl from
  "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import type {
  Feature,
  FeatureCollection,
  Polygon,
} from "geojson";

import {
  LocationSearchService,
  type ZimbabweLocationSearchResult,
} from "../../services/locationSearchService";

import type {
  RealSceneAreaSelection,
  RealSceneBounds,
  RealSceneMapMode,
} from "../../types/realSceneGeometry";

import type {
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";

import {
  areaSelectionFromBounds,
} from "../../services/forensicAreaService";

interface ForensicAreaMapProps {
  anchor:
    RoadDetectionCoordinate | null;

  coreArea:
    RealSceneAreaSelection | null;

  contextArea:
    RealSceneAreaSelection | null;

  onAnchorChange(
    coordinate:
      RoadDetectionCoordinate,
  ): void;

  onCoreAreaChange(
    area:
      RealSceneAreaSelection | null,
  ): void;
}

const DEFAULT_CENTER:
  [number, number] =
  [
    31.053,
    -17.825,
  ];

const STREET_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

const HYBRID_IMAGERY_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const HYBRID_TRANSPORT_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";

const HYBRID_PLACES_TILE =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

const TERRAIN_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";

function createHybridStyle() {
  return {
    version: 8 as const,

    sources: {
      imagery: {
        type:
          "raster" as const,

        tiles: [
          HYBRID_IMAGERY_TILE,
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,

        attribution:
          "Imagery © Esri",
      },

      transportation: {
        type:
          "raster" as const,

        tiles: [
          HYBRID_TRANSPORT_TILE,
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,

        attribution:
          "Transportation reference © Esri",
      },

      places: {
        type:
          "raster" as const,

        tiles: [
          HYBRID_PLACES_TILE,
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,

        attribution:
          "Places and boundaries © Esri",
      },
    },

    layers: [
      {
        id:
          "hybrid-imagery",
        type:
          "raster" as const,
        source:
          "imagery",
        paint: {
          "raster-opacity":
            1,
          "raster-fade-duration":
            0,
        },
      },

      {
        id:
          "hybrid-transportation",
        type:
          "raster" as const,
        source:
          "transportation",
        paint: {
          "raster-opacity":
            0.98,
          "raster-fade-duration":
            0,
        },
      },

      {
        id:
          "hybrid-places",
        type:
          "raster" as const,
        source:
          "places",
        paint: {
          "raster-opacity":
            1,
          "raster-fade-duration":
            0,
        },
      },
    ],
  };
}

function createTerrainStyle() {
  return {
    version: 8 as const,

    sources: {
      terrain: {
        type:
          "raster" as const,

        tiles: [
          TERRAIN_TILE,
        ],

        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,

        attribution:
          "Topographic map © Esri",
      },
    },

    layers: [
      {
        id:
          "terrain-layer",
        type:
          "raster" as const,
        source:
          "terrain",
        paint: {
          "raster-opacity":
            1,
          "raster-fade-duration":
            0,
        },
      },
    ],
  };
}

function styleForMode(
  mode:
    RealSceneMapMode,
) {
  if (
    mode ===
    "hybrid"
  ) {
    return createHybridStyle();
  }

  if (
    mode ===
    "terrain"
  ) {
    return createTerrainStyle();
  }

  return STREET_STYLE;
}

function polygonCollection(
  area:
    RealSceneAreaSelection | null,
): FeatureCollection<Polygon> {
  if (!area) {
    return {
      type:
        "FeatureCollection",
      features: [],
    };
  }

  const feature:
    Feature<Polygon> =
    {
      type:
        "Feature",
      properties: {},
      geometry: {
        type:
          "Polygon",
        coordinates: [
          area.polygon.map(
            (point) => [
              point.longitude,
              point.latitude,
            ],
          ),
        ],
      },
    };

  return {
    type:
      "FeatureCollection",
    features: [
      feature,
    ],
  };
}

function boundsFromCorners(
  first: {
    latitude: number;
    longitude: number;
  },
  second: {
    latitude: number;
    longitude: number;
  },
): RealSceneBounds {
  return {
    north:
      Math.max(
        first.latitude,
        second.latitude,
      ),

    south:
      Math.min(
        first.latitude,
        second.latitude,
      ),

    east:
      Math.max(
        first.longitude,
        second.longitude,
      ),

    west:
      Math.min(
        first.longitude,
        second.longitude,
      ),
  };
}

function fitSearchResult(
  map:
    maplibregl.Map,
  result:
    ZimbabweLocationSearchResult,
): void {
  if (
    result.boundingBox
  ) {
    const bounds =
      new maplibregl.LngLatBounds(
        [
          result.boundingBox.west,
          result.boundingBox.south,
        ],
        [
          result.boundingBox.east,
          result.boundingBox.north,
        ],
      );

    map.fitBounds(
      bounds,
      {
        padding:
          75,

        maxZoom:
          17,

        duration:
          650,
      },
    );

    return;
  }

  map.easeTo({
    center: [
      result.coordinate.longitude,
      result.coordinate.latitude,
    ],

    zoom:
      17,

    duration:
      650,
  });
}

export default function ForensicAreaMap({
  anchor,
  coreArea,
  contextArea,
  onAnchorChange,
  onCoreAreaChange,
}: ForensicAreaMapProps) {
  const mountRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapRef =
    useRef<maplibregl.Map | null>(
      null,
    );

  const markerRef =
    useRef<maplibregl.Marker | null>(
      null,
    );

  const firstCornerRef =
    useRef<{
      latitude: number;
      longitude: number;
    } | null>(
      null,
    );

  const coreAreaRef =
    useRef(
      coreArea,
    );

  const contextAreaRef =
    useRef(
      contextArea,
    );

  const drawingRef =
    useRef(
      false,
    );

  const [mode, setMode] =
    useState<RealSceneMapMode>(
      "hybrid",
    );

  const [drawing, setDrawing] =
    useState(
      false,
    );

  const [drawMessage, setDrawMessage] =
    useState(
      "Click the map to position the accident anchor.",
    );

  const [searchQuery, setSearchQuery] =
    useState(
      "",
    );

  const [searching, setSearching] =
    useState(
      false,
    );

  const [
    searchResults,
    setSearchResults,
  ] =
    useState<
      ZimbabweLocationSearchResult[]
    >(
      [],
    );

  const [
    searchError,
    setSearchError,
  ] =
    useState(
      "",
    );

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(
      false,
    );

  const anchorKey =
    useMemo(
      () =>
        anchor
          ? `${anchor.latitude.toFixed(
              7,
            )}:${anchor.longitude.toFixed(
              7,
            )}`
          : "none",
      [
        anchor,
      ],
    );

  useEffect(() => {
    coreAreaRef.current =
      coreArea;
  }, [
    coreArea,
  ]);

  useEffect(() => {
    contextAreaRef.current =
      contextArea;
  }, [
    contextArea,
  ]);

  useEffect(() => {
    drawingRef.current =
      drawing;
  }, [
    drawing,
  ]);

  useEffect(() => {
    const mount =
      mountRef.current;

    if (!mount) {
      return;
    }

    const map =
      new maplibregl.Map({
        container:
          mount,

        style:
          styleForMode(
            mode,
          ),

        center:
          anchor
            ? [
                anchor.longitude,
                anchor.latitude,
              ]
            : DEFAULT_CENTER,

        zoom:
          anchor
            ? 17
            : 6,

        maxZoom:
          17,

        pitch:
          0,

        bearing:
          0,

        attributionControl:
          false,
      });

    mapRef.current =
      map;

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch:
          false,
      }),

      "bottom-right",
    );

    map.addControl(
      new maplibregl.AttributionControl({
        compact:
          true,
      }),

      "bottom-left",
    );

    const ensureAreaLayers =
      () => {
        if (
          !map.getSource(
            "forensic-context",
          )
        ) {
          map.addSource(
            "forensic-context",
            {
              type:
                "geojson",

              data:
                polygonCollection(
                  contextAreaRef.current,
                ),
            },
          );

          map.addLayer({
            id:
              "forensic-context-fill",

            type:
              "fill",

            source:
              "forensic-context",

            paint: {
              "fill-color":
                "#8a8a8a",

              "fill-opacity":
                0.08,
            },
          });

          map.addLayer({
            id:
              "forensic-context-line",

            type:
              "line",

            source:
              "forensic-context",

            paint: {
              "line-color":
                "#a0a0a0",

              "line-opacity":
                0.8,

              "line-width":
                1.2,

              "line-dasharray":
                [
                  3,
                  2,
                ],
            },
          });
        }

        if (
          !map.getSource(
            "forensic-core",
          )
        ) {
          map.addSource(
            "forensic-core",
            {
              type:
                "geojson",

              data:
                polygonCollection(
                  coreAreaRef.current,
                ),
            },
          );

          map.addLayer({
            id:
              "forensic-core-fill",

            type:
              "fill",

            source:
              "forensic-core",

            paint: {
              "fill-color":
                "#e8872d",

              "fill-opacity":
                0.11,
            },
          });

          map.addLayer({
            id:
              "forensic-core-line",

            type:
              "line",

            source:
              "forensic-core",

            paint: {
              "line-color":
                "#e8872d",

              "line-width":
                2.2,
            },
          });
        }
      };

    map.on(
      "load",
      ensureAreaLayers,
    );

    map.on(
      "style.load",
      ensureAreaLayers,
    );

    const handleClick =
      (
        event:
          maplibregl.MapMouseEvent,
      ) => {
        const coordinate:
          RoadDetectionCoordinate =
          {
            latitude:
              event.lngLat.lat,

            longitude:
              event.lngLat.lng,

            accuracyMetres:
              0,

            capturedAt:
              new Date().toISOString(),
          };

        if (
          !drawingRef.current
        ) {
          onAnchorChange(
            coordinate,
          );

          setSearchOpen(
            false,
          );

          setDrawMessage(
            "Accident anchor updated. Draw the forensic core when ready.",
          );

          return;
        }

        const first =
          firstCornerRef.current;

        if (!first) {
          firstCornerRef.current =
            coordinate;

          setDrawMessage(
            "First corner fixed. Click the opposite corner.",
          );

          return;
        }

        const bounds =
          boundsFromCorners(
            first,
            coordinate,
          );

        const area =
          areaSelectionFromBounds(
            bounds,
            {
              mapMode:
                mode,

              zoom:
                map.getZoom(),

              bearing:
                map.getBearing(),

              pitch:
                map.getPitch(),
            },
          );

        firstCornerRef.current =
          null;

        drawingRef.current =
          false;

        setDrawing(
          false,
        );

        onCoreAreaChange(
          area,
        );

        setDrawMessage(
          "Forensic core selected. The grey context buffer is generated automatically.",
        );
      };

    map.on(
      "click",
      handleClick,
    );

    return () => {
      markerRef.current?.remove();

      markerRef.current =
        null;

      map.remove();

      mapRef.current =
        null;
    };
  }, [
    mode,
  ]);

  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !anchor
    ) {
      return;
    }

    markerRef.current?.remove();

    const markerElement =
      document.createElement(
        "div",
      );

    markerElement.className =
      "roadsafe-forensic-anchor-marker";

    markerRef.current =
      new maplibregl.Marker({
        element:
          markerElement,

        anchor:
          "center",
      })
        .setLngLat([
          anchor.longitude,
          anchor.latitude,
        ])
        .addTo(
          map,
        );

    if (
      anchorKey !==
      "none"
    ) {
      map.easeTo({
        center: [
          anchor.longitude,
          anchor.latitude,
        ],

        zoom:
          Math.max(
            15,
            map.getZoom(),
          ),

        duration:
          450,
      });
    }
  }, [
    anchorKey,
  ]);

  useEffect(() => {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    const update =
      (
        id: string,
        area:
          RealSceneAreaSelection | null,
      ) => {
        const source =
          map.getSource(
            id,
          ) as
            | maplibregl.GeoJSONSource
            | undefined;

        source?.setData(
          polygonCollection(
            area,
          ),
        );
      };

    update(
      "forensic-core",
      coreArea,
    );

    update(
      "forensic-context",
      contextArea,
    );
  }, [
    coreArea,
    contextArea,
  ]);

  const handleSearch =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      const query =
        searchQuery.trim();

      if (
        query.length <
        2
      ) {
        setSearchResults(
          [],
        );

        setSearchError(
          "Enter at least 2 characters.",
        );

        setSearchOpen(
          true,
        );

        return;
      }

      setSearching(
        true,
      );

      setSearchError(
        "",
      );

      setSearchOpen(
        true,
      );

      try {
        const results =
          await LocationSearchService.search(
            query,
          );

        setSearchResults(
          results,
        );

        if (
          results.length ===
          0
        ) {
          setSearchError(
            "No matching Zimbabwe locations were found.",
          );
        }
      } catch (error) {
        setSearchResults(
          [],
        );

        setSearchError(
          error instanceof
          Error
            ? error.message
            : "Location search failed.",
        );
      } finally {
        setSearching(
          false,
        );
      }
    };

  const selectSearchResult =
    (
      result:
        ZimbabweLocationSearchResult,
    ) => {
      const map =
        mapRef.current;

      setSearchQuery(
        result.displayName,
      );

      setSearchOpen(
        false,
      );

      setSearchError(
        "",
      );

      firstCornerRef.current =
        null;

      drawingRef.current =
        false;

      setDrawing(
        false,
      );

      /**
       * A searched place may be hundreds of kilometres from the current core.
       * Clear the old core intentionally so the case cannot retain stale area
       * geometry around the previous anchor.
       */
      onCoreAreaChange(
        null,
      );

      onAnchorChange(
        {
          ...result.coordinate,

          capturedAt:
            new Date().toISOString(),
        },
      );

      if (map) {
        fitSearchResult(
          map,
          result,
        );
      }

      setDrawMessage(
        "Search location selected and accident anchor moved. Draw a new forensic core around the actual crash scene.",
      );
    };

  return (
    <section className="roadsafe-forensic-map">
      <div className="roadsafe-forensic-map__toolbar">
        <div className="roadsafe-forensic-map__modes">
          {(
            [
              "street",
              "hybrid",
              "terrain",
            ] as
              RealSceneMapMode[]
          ).map(
            (
              item,
            ) => (
              <button
                key={
                  item
                }

                type="button"

                className={
                  mode ===
                  item
                    ? "is-active"
                    : ""
                }

                onClick={() =>
                  setMode(
                    item,
                  )
                }
              >
                {item}
              </button>
            ),
          )}
        </div>

        <form
          className="roadsafe-forensic-map__search"
          onSubmit={
            handleSearch
          }
        >
          <div className="roadsafe-forensic-map__search-input">
            <input
              type="search"

              value={
                searchQuery
              }

              placeholder="Search road, city, junction or place…"

              autoComplete="off"

              aria-label="Search Zimbabwe location"

              onFocus={() => {
                if (
                  searchResults.length >
                    0 ||
                  searchError
                ) {
                  setSearchOpen(
                    true,
                  );
                }
              }}

              onChange={(
                event,
              ) => {
                setSearchQuery(
                  event.target.value,
                );

                setSearchError(
                  "",
                );

                if (
                  event.target.value.trim()
                    .length ===
                  0
                ) {
                  setSearchResults(
                    [],
                  );

                  setSearchOpen(
                    false,
                  );
                }
              }}
            />

            <button
              type="submit"
              disabled={
                searching
              }
            >
              {searching
                ? "Searching…"
                : "Search"}
            </button>
          </div>

          {searchOpen && (
            <div className="roadsafe-forensic-map__search-results">
              {searchError && (
                <p className="roadsafe-forensic-map__search-error">
                  {
                    searchError
                  }
                </p>
              )}

              {searchResults.map(
                (
                  result,
                ) => (
                  <button
                    key={
                      result.id
                    }

                    type="button"

                    onClick={() =>
                      selectSearchResult(
                        result,
                      )
                    }
                  >
                    <span>
                      {
                        result.displayName
                      }
                    </span>

                    <small>
                      {
                        result.type
                      }
                    </small>
                  </button>
                ),
              )}
            </div>
          )}
        </form>

        <div className="roadsafe-forensic-map__actions">
          <button
            type="button"

            className={
              drawing
                ? "is-active"
                : ""
            }

            onClick={() => {
              firstCornerRef.current =
                null;

              const next =
                !drawing;

              drawingRef.current =
                next;

              setDrawing(
                next,
              );

              setSearchOpen(
                false,
              );

              setDrawMessage(
                next
                  ? "Click the first corner of the forensic core."
                  : "Core drawing cancelled.",
              );
            }}
          >
            {drawing
              ? "Cancel draw"
              : "Draw forensic core"}
          </button>

          <button
            type="button"

            onClick={() => {
              firstCornerRef.current =
                null;

              drawingRef.current =
                false;

              setDrawing(
                false,
              );

              onCoreAreaChange(
                null,
              );

              setDrawMessage(
                "Core cleared. Draw a new forensic core.",
              );
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={
          mountRef
        }

        className="roadsafe-forensic-map__canvas"
      />

      <div className="roadsafe-forensic-map__legend">
        <span>
          <i className="is-core" />
          Forensic core
        </span>

        <span>
          <i className="is-context" />
          Context buffer
        </span>

        <span>
          <i className="is-anchor" />
          Accident anchor
        </span>
      </div>

      <p className="roadsafe-forensic-map__message">
        {
          drawMessage
        }
      </p>
    </section>
  );
}
