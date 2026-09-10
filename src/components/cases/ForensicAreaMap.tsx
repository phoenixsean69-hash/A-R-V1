import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { FormEvent } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type {
  FeatureCollection,
  LineString,
  Polygon,
} from "geojson";

import {
  LocationSearchService,
  type ZimbabweLocationSearchResult,
} from "../../services/locationSearchService";

import {
  ForensicAreaIntelligenceService,
  type ForensicAreaRoadIntelligence,
} from "../../services/forensicAreaIntelligenceService";

import {
  areaSelectionFromPolygon,
  createContextArea,
  dimensionsForBounds,
} from "../../services/forensicAreaService";

import type {
  RealSceneAreaSelection,
  RealSceneGeoPoint,
  RealSceneMapMode,
} from "../../types/realSceneGeometry";

import type {
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";

interface Props {
  anchor: RoadDetectionCoordinate | null;
  coreArea: RealSceneAreaSelection | null;
  contextArea: RealSceneAreaSelection | null;
  contextBufferMetres: number;
  onAnchorChange(coordinate: RoadDetectionCoordinate): void;
  onCoreAreaChange(area: RealSceneAreaSelection | null): void;
}

const DEFAULT_CENTER: [number, number] = [31.053, -17.825];
const STREET_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";
const IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TRANSPORT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
const TERRAIN =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";

function styleForMode(mode: RealSceneMapMode) {
  if (mode === "street") {
    return STREET_STYLE;
  }

  const tile = mode === "terrain" ? TERRAIN : IMAGERY;

  return {
    version: 8 as const,
    sources: {
      base: {
        type: "raster" as const,
        tiles: [tile],
        tileSize: 256,
        maxzoom: 19,
      },
      ...(mode === "hybrid"
        ? {
            transport: {
              type: "raster" as const,
              tiles: [TRANSPORT],
              tileSize: 256,
              maxzoom: 19,
            },
          }
        : {}),
    },
    layers: [
      {
        id: "base",
        type: "raster" as const,
        source: "base",
      },
      ...(mode === "hybrid"
        ? [
            {
              id: "transport",
              type: "raster" as const,
              source: "transport",
              paint: {
                "raster-opacity": 0.9,
              },
            },
          ]
        : []),
    ],
  };
}

function polygonData(
  area: RealSceneAreaSelection | null,
): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: area
      ? [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                area.polygon.map((point) => [
                  point.longitude,
                  point.latitude,
                ]),
              ],
            },
          },
        ]
      : [],
  };
}

function draftData(
  vertices: RealSceneGeoPoint[],
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features:
      vertices.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: vertices.map((point) => [
                  point.longitude,
                  point.latitude,
                ]),
              },
            },
          ]
        : [],
  };
}

function roadData(
  intelligence: ForensicAreaRoadIntelligence | null,
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features:
      intelligence?.roads.map((road) => ({
        type: "Feature" as const,
        properties: {
          clipped: road.clippedByCore,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: road.points.map((point) => [
            point.longitude,
            point.latitude,
          ]),
        },
      })) ?? [],
  };
}

function openVertices(
  area: RealSceneAreaSelection,
): RealSceneGeoPoint[] {
  const polygon = area.polygon;

  if (polygon.length < 2) {
    return [...polygon];
  }

  const first = polygon[0];
  const last = polygon[polygon.length - 1];

  return (
    first.latitude === last.latitude &&
    first.longitude === last.longitude
      ? polygon.slice(0, -1)
      : [...polygon]
  );
}

function effectiveBuffer(
  area: RealSceneAreaSelection | null,
  requested: number,
): number {
  if (!area) return requested;

  const dimensions = dimensionsForBounds(area.bounds);
  const diagonal = Math.hypot(
    dimensions.width,
    dimensions.height,
  );

  return Math.max(
    requested,
    Math.round(
      Math.min(
        180,
        Math.max(60, diagonal * 0.45),
      ),
    ),
  );
}

function fitSearchResult(
  map: maplibregl.Map,
  result: ZimbabweLocationSearchResult,
) {
  if (result.boundingBox) {
    map.fitBounds(
      [
        [
          result.boundingBox.west,
          result.boundingBox.south,
        ],
        [
          result.boundingBox.east,
          result.boundingBox.north,
        ],
      ],
      {
        padding: 70,
        maxZoom: 18,
        duration: 600,
      },
    );

    return;
  }

  map.easeTo({
    center: [
      result.coordinate.longitude,
      result.coordinate.latitude,
    ],
    zoom: 18,
    duration: 600,
  });
}

export default function ForensicAreaMap({
  anchor,
  coreArea,
  contextArea,
  contextBufferMetres,
  onAnchorChange,
  onCoreAreaChange,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const anchorMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([]);
  const drawingRef = useRef(false);
  const draftRef = useRef<RealSceneGeoPoint[]>([]);
  const coreRef = useRef(coreArea);
  const contextRef = useRef(contextArea);
  const intelligenceRef =
    useRef<ForensicAreaRoadIntelligence | null>(null);

  const [mode, setMode] =
    useState<RealSceneMapMode>("hybrid");
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<RealSceneGeoPoint[]>([]);
  const [message, setMessage] = useState(
    "Click the map to position the accident anchor.",
  );
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] =
    useState<ZimbabweLocationSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [intelligence, setIntelligence] =
    useState<ForensicAreaRoadIntelligence | null>(null);
  const [scanState, setScanState] =
    useState<"idle" | "loading" | "ready" | "warning">(
      "idle",
    );

  const requestedBuffer = Math.min(
    350,
    Math.max(10, contextBufferMetres),
  );

  const adaptiveBuffer = effectiveBuffer(
    coreArea,
    requestedBuffer,
  );

  const displayContext = useMemo(
    () =>
      coreArea
        ? createContextArea(coreArea, adaptiveBuffer)
        : contextArea,
    [coreArea, contextArea, adaptiveBuffer],
  );

  const dimensions = useMemo(
    () =>
      coreArea
        ? dimensionsForBounds(coreArea.bounds)
        : null,
    [coreArea],
  );

  useEffect(() => {
    coreRef.current = coreArea;
  }, [coreArea]);

  useEffect(() => {
    contextRef.current = displayContext;
  }, [displayContext]);

  useEffect(() => {
    intelligenceRef.current = intelligence;
  }, [intelligence]);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!anchor) {
      setIntelligence(null);
      setScanState("idle");
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setScanState("loading");

      try {
        const next =
          await ForensicAreaIntelligenceService.scan({
            anchor,
            coreArea,
            contextArea: displayContext,
          });

        if (cancelled) return;

        setIntelligence(next);
        setScanState(next.warning ? "warning" : "ready");

        if (next.warning) {
          setMessage(next.warning);
        }
      } catch (error) {
        if (cancelled) return;

        setIntelligence(null);
        setScanState("warning");
        setMessage(
          error instanceof Error
            ? error.message
            : "Road-awareness scan unavailable.",
        );
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    anchor?.latitude,
    anchor?.longitude,
    coreArea?.id,
    coreArea?.selectedAt,
    adaptiveBuffer,
  ]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) return;

    const map = new maplibregl.Map({
      container: mount,
      style: styleForMode(mode),
      center: anchor
        ? [anchor.longitude, anchor.latitude]
        : DEFAULT_CENTER,
      zoom: anchor ? 17 : 6,
      maxZoom: 19,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: false,
      }),
      "bottom-right",
    );

    const ensureLayers = () => {
      if (!map.getSource("forensic-context")) {
        map.addSource("forensic-context", {
          type: "geojson",
          data: polygonData(contextRef.current),
        });

        map.addLayer({
          id: "forensic-context-fill",
          type: "fill",
          source: "forensic-context",
          paint: {
            "fill-color": "#8a8a8a",
            "fill-opacity": 0.07,
          },
        });

        map.addLayer({
          id: "forensic-context-line",
          type: "line",
          source: "forensic-context",
          paint: {
            "line-color": "#a0a0a0",
            "line-width": 1.2,
            "line-dasharray": [3, 2],
          },
        });
      }

      if (!map.getSource("forensic-core")) {
        map.addSource("forensic-core", {
          type: "geojson",
          data: polygonData(coreRef.current),
        });

        map.addLayer({
          id: "forensic-core-fill",
          type: "fill",
          source: "forensic-core",
          paint: {
            "fill-color": "#e8872d",
            "fill-opacity": 0.12,
          },
        });

        map.addLayer({
          id: "forensic-core-line",
          type: "line",
          source: "forensic-core",
          paint: {
            "line-color": "#e8872d",
            "line-width": 2.2,
          },
        });
      }

      if (!map.getSource("forensic-draft")) {
        map.addSource("forensic-draft", {
          type: "geojson",
          data: draftData(draftRef.current),
        });

        map.addLayer({
          id: "forensic-draft-line",
          type: "line",
          source: "forensic-draft",
          paint: {
            "line-color": "#ffad63",
            "line-width": 2,
            "line-dasharray": [2, 1.5],
          },
        });
      }

      if (!map.getSource("forensic-road-awareness")) {
        map.addSource("forensic-road-awareness", {
          type: "geojson",
          data: roadData(intelligenceRef.current),
        });

        map.addLayer({
          id: "forensic-road-awareness-line",
          type: "line",
          source: "forensic-road-awareness",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "clipped"], true],
              "#d39b61",
              "#d6d6d6",
            ],
            "line-width": [
              "case",
              ["==", ["get", "clipped"], true],
              2.5,
              1.3,
            ],
            "line-opacity": 0.78,
          },
        });
      }
    };

    map.on("load", ensureLayers);
    map.on("style.load", ensureLayers);

    map.on("click", (event) => {
      if (!drawingRef.current) {
        onAnchorChange({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
          accuracyMetres: 0,
          capturedAt: new Date().toISOString(),
        });

        setSearchOpen(false);
        setMessage(
          "Anchor updated. Draw or auto-fit the forensic core.",
        );
        return;
      }

      const next = [
        ...draftRef.current,
        {
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        },
      ];

      draftRef.current = next;
      setDraft(next);

      setMessage(
        next.length < 3
          ? `${next.length} vertex fixed. Add at least ${
              3 - next.length
            } more.`
          : `${next.length} vertices fixed. Add more or Finish.`,
      );
    });

    return () => {
      anchorMarkerRef.current?.remove();
      vertexMarkersRef.current.forEach((marker) =>
        marker.remove(),
      );
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(styleForMode(mode));
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      (
        map.getSource("forensic-core") as
          | maplibregl.GeoJSONSource
          | undefined
      )?.setData(polygonData(coreArea));

      (
        map.getSource("forensic-context") as
          | maplibregl.GeoJSONSource
          | undefined
      )?.setData(polygonData(displayContext));

      (
        map.getSource("forensic-draft") as
          | maplibregl.GeoJSONSource
          | undefined
      )?.setData(draftData(draft));

      (
        map.getSource("forensic-road-awareness") as
          | maplibregl.GeoJSONSource
          | undefined
      )?.setData(roadData(intelligence));
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once("style.load", update);
    }
  }, [
    coreArea,
    displayContext,
    draft,
    intelligence,
    mode,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    anchorMarkerRef.current?.remove();

    if (!anchor) {
      anchorMarkerRef.current = null;
      return;
    }

    const element = document.createElement("button");
    element.type = "button";
    element.className = "roadsafe-forensic-anchor-marker";
    element.title = "Drag accident anchor";

    const marker = new maplibregl.Marker({
      element,
      draggable: true,
    })
      .setLngLat([
        anchor.longitude,
        anchor.latitude,
      ])
      .addTo(map);

    marker.on("dragend", () => {
      const point = marker.getLngLat();

      onAnchorChange({
        latitude: point.lat,
        longitude: point.lng,
        accuracyMetres: 0,
        capturedAt: new Date().toISOString(),
      });

      setMessage(
        "Anchor moved. Road-aware diagnostics are refreshing.",
      );
    });

    anchorMarkerRef.current = marker;
  }, [
    anchor?.latitude,
    anchor?.longitude,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    vertexMarkersRef.current.forEach((marker) =>
      marker.remove(),
    );
    vertexMarkersRef.current = [];

    if (!map || !coreArea || drawing) {
      return;
    }

    const vertices = openVertices(coreArea);

    vertices.forEach((vertex, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className =
        "roadsafe-forensic-core-vertex";
      element.textContent = String(index + 1);
      element.title =
        `Drag forensic-core vertex ${index + 1}`;

      const marker = new maplibregl.Marker({
        element,
        draggable: true,
        anchor: "center",
      })
        .setLngLat([
          vertex.longitude,
          vertex.latitude,
        ])
        .addTo(map);

      marker.on("dragend", () => {
        const moved = marker.getLngLat();

        const next = vertices.map((point, pointIndex) =>
          pointIndex === index
            ? {
                latitude: moved.lat,
                longitude: moved.lng,
              }
            : point,
        );

        try {
          onCoreAreaChange(
            areaSelectionFromPolygon(next, {
              mapMode: mode,
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            }),
          );

          setMessage(
            "Core vertex updated. Road coverage is refreshing.",
          );
        } catch (error) {
          marker.setLngLat([
            vertex.longitude,
            vertex.latitude,
          ]);

          setMessage(
            error instanceof Error
              ? error.message
              : "Vertex move rejected.",
          );
        }
      });

      vertexMarkersRef.current.push(marker);
    });

    return () => {
      vertexMarkersRef.current.forEach((marker) =>
        marker.remove(),
      );
      vertexMarkersRef.current = [];
    };
  }, [
    coreArea?.id,
    coreArea?.selectedAt,
    drawing,
    mode,
  ]);

  const finish = () => {
    const map = mapRef.current;

    if (!map || draftRef.current.length < 3) {
      setMessage(
        "A forensic polygon needs at least 3 vertices.",
      );
      return;
    }

    try {
      const area = areaSelectionFromPolygon(
        draftRef.current,
        {
          mapMode: mode,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        },
      );

      onCoreAreaChange(area);
      draftRef.current = [];
      setDraft([]);
      drawingRef.current = false;
      setDrawing(false);

      setMessage(
        "Polygon core created. Drag numbered vertices to refine it.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Polygon could not be created.",
      );
    }
  };

  const fitRoads = () => {
    const map = mapRef.current;

    if (!map || !anchor || !intelligence) {
      return;
    }

    const area =
      ForensicAreaIntelligenceService.suggestCore({
        anchor,
        roads: intelligence.roads,
        mapMode: mode,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });

    if (!area) {
      setMessage(
        "Not enough mapped road geometry to auto-fit the core.",
      );
      return;
    }

    onCoreAreaChange(area);

    map.fitBounds(
      [
        [area.bounds.west, area.bounds.south],
        [area.bounds.east, area.bounds.north],
      ],
      {
        padding: 70,
        maxZoom: 19,
        duration: 500,
      },
    );

    setMessage(
      "Core fitted to nearby approaches. Drag vertices to refine it.",
    );
  };

  const submitSearch = async (
    event: FormEvent,
  ) => {
    event.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);

    try {
      const next =
        await LocationSearchService.search(
          trimmed,
        );

      setResults(next);
      setSearchOpen(true);
    } catch (error) {
      setResults([]);
      setSearchOpen(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Location search failed.",
      );
    } finally {
      setSearching(false);
    }
  };

  const chooseResult = (
    result: ZimbabweLocationSearchResult,
  ) => {
    onAnchorChange({
      ...result.coordinate,
      capturedAt: new Date().toISOString(),
    });

    onCoreAreaChange(null);
    setSearchOpen(false);
    setDraft([]);
    draftRef.current = [];
    setDrawing(false);
    drawingRef.current = false;

    if (mapRef.current) {
      fitSearchResult(
        mapRef.current,
        result,
      );
    }

    setMessage(
      "Location selected. Road scan is running.",
    );
  };

  return (
    <section className="roadsafe-forensic-map roadsafe-forensic-map--area-v2">
      <div
        ref={mountRef}
        className="roadsafe-forensic-map__canvas"
      />

      <div className="roadsafe-forensic-map__toolbar">
        <div className="roadsafe-forensic-map__modes">
          {(
            [
              "street",
              "hybrid",
              "terrain",
            ] as RealSceneMapMode[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              className={
                mode === item
                  ? "is-active"
                  : ""
              }
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <form
          className="roadsafe-forensic-map__search"
          onSubmit={(event) =>
            void submitSearch(event)
          }
        >
          <div className="roadsafe-forensic-map__search-input">
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search Zimbabwe road, junction or place"
            />
            <button
              type="submit"
              disabled={searching}
            >
              {searching ? "Searching" : "Search"}
            </button>
          </div>

          {searchOpen && (
            <div className="roadsafe-forensic-map__search-results">
              {results.length === 0 && (
                <p>No matching locations.</p>
              )}

              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() =>
                    chooseResult(result)
                  }
                >
                  <strong>{result.displayName}</strong>
                  <small>{result.type}</small>
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="roadsafe-forensic-map__actions">
          <button
            type="button"
            className={
              drawing ? "is-active" : ""
            }
            onClick={() => {
              const next = !drawing;

              setDrawing(next);
              drawingRef.current = next;
              setDraft([]);
              draftRef.current = [];
              setSearchOpen(false);

              setMessage(
                next
                  ? "Polygon mode: click at least 3 vertices around the core."
                  : "Polygon drawing cancelled.",
              );
            }}
          >
            {drawing ? "Cancel" : "Draw polygon"}
          </button>

          {drawing && (
            <>
              <button
                type="button"
                disabled={draft.length < 3}
                onClick={finish}
              >
                Finish
              </button>

              <button
                type="button"
                disabled={draft.length === 0}
                onClick={() => {
                  const next = draft.slice(0, -1);
                  draftRef.current = next;
                  setDraft(next);
                }}
              >
                Undo
              </button>
            </>
          )}

          <button
            type="button"
            disabled={
              !anchor ||
              !intelligence ||
              intelligence.roads.length === 0
            }
            onClick={fitRoads}
          >
            Fit roads
          </button>

          <button
            type="button"
            disabled={!coreArea}
            onClick={() => {
              onCoreAreaChange(null);
              setMessage(
                "Core cleared. Draw a polygon or fit nearby roads.",
              );
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="roadsafe-forensic-area-hud">
        <div>
          <span>Boundary</span>
          <strong>
            {coreArea
              ? `Polygon / ${
                  openVertices(coreArea).length
                } vertices`
              : "Not selected"}
          </strong>
        </div>

        <div>
          <span>Core envelope</span>
          <strong>
            {dimensions
              ? `${dimensions.width.toFixed(
                  0,
                )} x ${dimensions.height.toFixed(
                  0,
                )} m`
              : "-"}
          </strong>
        </div>

        <div>
          <span>Roads scanned</span>
          <strong>
            {scanState === "loading"
              ? "Scanning..."
              : intelligence
                ? intelligence.roads.length
                : "-"}
          </strong>
        </div>

        <div
          className={
            intelligence &&
            intelligence.nearestRoadDistanceMetres > 12
              ? "is-warning"
              : ""
          }
        >
          <span>Anchor to road</span>
          <strong>
            {intelligence
              ? `${intelligence.nearestRoadDistanceMetres.toFixed(
                  1,
                )} m`
              : "-"}
          </strong>
        </div>

        <div
          className={
            intelligence &&
            intelligence.clippedApproachCount > 0
              ? "is-warning"
              : ""
          }
        >
          <span>Clipped approaches</span>
          <strong>
            {intelligence
              ? intelligence.clippedApproachCount
              : "-"}
          </strong>
        </div>

        <div
          className={
            adaptiveBuffer > requestedBuffer
              ? "is-adaptive"
              : ""
          }
        >
          <span>Context requested / effective</span>
          <strong>
            {requestedBuffer} / {adaptiveBuffer} m
          </strong>
        </div>
      </div>

      <div className="roadsafe-forensic-map__legend">
        <span>
          <i className="is-core" />
          forensic core
        </span>
        <span>
          <i className="is-context" />
          context
        </span>
        <span>
          <i className="is-road" />
          mapped road
        </span>
        <span>
          <i className="is-cut" />
          clipped approach
        </span>
        <span>
          <i className="is-anchor" />
          accident anchor
        </span>
      </div>

      <p
        className={`roadsafe-forensic-map__message ${
          scanState === "warning"
            ? "is-warning"
            : ""
        }`}
      >
        {message}
      </p>
    </section>
  );
}
