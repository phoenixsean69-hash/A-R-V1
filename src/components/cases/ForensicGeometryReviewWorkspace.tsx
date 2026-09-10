import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type {
  FeatureCollection,
  Geometry,
} from "geojson";

import type {
  ForensicPipelineBuildResult,
} from "../../types/forensicScenePipeline";

import type {
  RealSceneMetricPoint,
} from "../../types/realSceneGeometry";

import {
  ForensicGeometryCorrectionService,
} from "../../services/forensicGeometryCorrectionService";

import "./forensicGeometryReviewWorkspace.css";

interface Props {
  buildResult: ForensicPipelineBuildResult;
  onBuildResultChange(
    next: ForensicPipelineBuildResult,
  ): void;
  onError?(message: string): void;
}

const IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function style() {
  return {
    version: 8 as const,
    sources: {
      imagery: {
        type: "raster" as const,
        tiles: [IMAGERY],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery (c) Esri",
      },
    },
    layers: [
      {
        id: "imagery",
        type: "raster" as const,
        source: "imagery",
      },
    ],
  };
}

function metricToGeo(
  point: RealSceneMetricPoint,
  result: ForensicPipelineBuildResult,
): [number, number] {
  const area = result.scenePackage.area;

  return [
    area.accidentAnchor.longitude +
      point.eastMetres /
        area.localFrame.metresPerLongitudeDegree,
    area.accidentAnchor.latitude +
      point.northMetres /
        area.localFrame.metresPerLatitudeDegree,
  ];
}

function geoToMetric(
  longitude: number,
  latitude: number,
  result: ForensicPipelineBuildResult,
): RealSceneMetricPoint {
  const area = result.scenePackage.area;

  return {
    eastMetres:
      (longitude - area.accidentAnchor.longitude) *
      area.localFrame.metresPerLongitudeDegree,
    northMetres:
      (latitude - area.accidentAnchor.latitude) *
      area.localFrame.metresPerLatitudeDegree,
  };
}

function geometryData(
  result: ForensicPipelineBuildResult,
  selectedRoadId: string,
): FeatureCollection<Geometry> {
  const features: FeatureCollection<Geometry>["features"] = [];

  for (const road of result.geometry.roads) {
    if (!road.forensic) continue;

    features.push({
      type: "Feature",
      properties: {
        kind:
          road.id === selectedRoadId
            ? "selected-surface"
            : "surface",
        roadId: road.id,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          road.forensic.surfacePolygon.map((point) =>
            metricToGeo(point, result),
          ),
        ],
      },
    });

    features.push({
      type: "Feature",
      properties: {
        kind: "hit",
        roadId: road.id,
      },
      geometry: {
        type: "LineString",
        coordinates: road.forensic.centreline.map((point) =>
          metricToGeo(point, result),
        ),
      },
    });

    if (road.id === selectedRoadId) {
      for (const edge of [
        road.forensic.leftEdge,
        road.forensic.rightEdge,
      ]) {
        features.push({
          type: "Feature",
          properties: { kind: "edge", roadId: road.id },
          geometry: {
            type: "LineString",
            coordinates: edge.map((point) =>
              metricToGeo(point, result),
            ),
          },
        });
      }

      for (const lane of road.forensic.lanes) {
        features.push({
          type: "Feature",
          properties: { kind: "lane", roadId: road.id },
          geometry: {
            type: "LineString",
            coordinates: lane.centreline.map((point) =>
              metricToGeo(point, result),
            ),
          },
        });
      }
    }
  }

  for (const control of result.geometry.roadControls ?? []) {
    features.push({
      type: "Feature",
      properties: { kind: "control" },
      geometry: {
        type: "Point",
        coordinates: [
          control.position.longitude,
          control.position.latitude,
        ],
      },
    });
  }

  features.push({
    type: "Feature",
    properties: { kind: "anchor" },
    geometry: {
      type: "Point",
      coordinates: [
        result.scenePackage.area.accidentAnchor.longitude,
        result.scenePackage.area.accidentAnchor.latitude,
      ],
    },
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function draggedWidth(
  road: NonNullable<
    ForensicPipelineBuildResult["geometry"]["roads"][number]
  >,
  dragged: RealSceneMetricPoint,
): number | null {
  const model = road.forensic;

  if (!model || model.centreline.length < 2) return null;

  const index = Math.floor(model.centreline.length / 2);
  const centre = model.centreline[index];
  const a = model.centreline[Math.max(0, index - 1)];
  const b =
    model.centreline[
      Math.min(model.centreline.length - 1, index + 1)
    ];
  const dx = b.eastMetres - a.eastMetres;
  const dy = b.northMetres - a.northMetres;
  const length = Math.hypot(dx, dy);

  if (length < 1e-9) return null;

  const normalEast = -dy / length;
  const normalNorth = dx / length;
  const halfWidth = Math.abs(
    (dragged.eastMetres - centre.eastMetres) * normalEast +
      (dragged.northMetres - centre.northMetres) *
        normalNorth,
  );

  return Math.min(45, Math.max(2.4, halfWidth * 2));
}

export default function ForensicGeometryReviewWorkspace({
  buildResult,
  onBuildResultChange,
  onError,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const handlesRef = useRef<maplibregl.Marker[]>([]);

  const [selectedRoadId, setSelectedRoadId] = useState(
    buildResult.geometry.topology?.anchorRoadId ??
      buildResult.geometry.roads[0]?.id ??
      "",
  );
  const [width, setWidth] = useState("");
  const [lanes, setLanes] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedRoad = useMemo(
    () =>
      buildResult.geometry.roads.find(
        (road) => road.id === selectedRoadId,
      ) ?? buildResult.geometry.roads[0],
    [buildResult.geometry.roads, selectedRoadId],
  );

  useEffect(() => {
    if (!selectedRoad) return;

    setWidth(selectedRoad.widthMetres.toFixed(2));
    setLanes(String(selectedRoad.laneCount));
  }, [
    selectedRoad?.id,
    selectedRoad?.widthMetres,
    selectedRoad?.laneCount,
  ]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) return;

    const area = buildResult.scenePackage.area;
    const map = new maplibregl.Map({
      container: mount,
      style: style(),
      center: [
        area.accidentAnchor.longitude,
        area.accidentAnchor.latitude,
      ],
      zoom: Math.max(16, area.coreArea.zoom),
      maxZoom: 20,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: false,
      }),
      "bottom-right",
    );

    map.on("load", () => {
      map.addSource("review-geometry", {
        type: "geojson",
        data: geometryData(buildResult, selectedRoadId),
      });

      map.addLayer({
        id: "review-surface",
        type: "fill",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "surface"],
        paint: {
          "fill-color": "#e8872d",
          "fill-opacity": 0.14,
        },
      });

      map.addLayer({
        id: "review-selected",
        type: "fill",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "selected-surface"],
        paint: {
          "fill-color": "#e8872d",
          "fill-opacity": 0.3,
        },
      });

      map.addLayer({
        id: "review-edge",
        type: "line",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "edge"],
        paint: {
          "line-color": "#ffab62",
          "line-width": 2.5,
        },
      });

      map.addLayer({
        id: "review-lane",
        type: "line",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "lane"],
        paint: {
          "line-color": "#f2f2f2",
          "line-width": 1,
          "line-dasharray": [3, 3],
        },
      });

      map.addLayer({
        id: "review-hit",
        type: "line",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "hit"],
        paint: {
          "line-color": "#ffffff",
          "line-width": 18,
          "line-opacity": 0.01,
        },
      });

      map.addLayer({
        id: "review-control",
        type: "circle",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "control"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#d6ad5d",
          "circle-stroke-color": "#202020",
          "circle-stroke-width": 1.5,
        },
      });

      map.addLayer({
        id: "review-anchor",
        type: "circle",
        source: "review-geometry",
        filter: ["==", ["get", "kind"], "anchor"],
        paint: {
          "circle-radius": 7,
          "circle-color": "#e8872d",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      const bounds = area.coreArea.bounds;

      map.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        {
          padding: 42,
          duration: 0,
          maxZoom: 19,
        },
      );
    });

    map.on("click", (event) => {
      if (!map.getLayer("review-hit")) return;

      const feature = map.queryRenderedFeatures(event.point, {
        layers: ["review-hit"],
      })[0];
      const roadId = feature?.properties?.roadId;

      if (typeof roadId === "string") {
        setSelectedRoadId(roadId);
      }
    });

    return () => {
      handlesRef.current.forEach((marker) => marker.remove());
      handlesRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource(
      "review-geometry",
    ) as maplibregl.GeoJSONSource | undefined;

    source?.setData(
      geometryData(buildResult, selectedRoad?.id ?? ""),
    );
  }, [buildResult, selectedRoad?.id]);

  const apply = async (
    nextWidth: number,
    nextLanes: number,
    method: "inspector" | "edge-handle",
  ) => {
    if (!selectedRoad || busy) return;

    setBusy(true);
    onError?.("");

    try {
      const next =
        await ForensicGeometryCorrectionService.apply(
          buildResult,
          {
            roadId: selectedRoad.id,
            widthMetres: nextWidth,
            laneCount: nextLanes,
            method,
          },
        );

      onBuildResultChange(next);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    handlesRef.current.forEach((marker) => marker.remove());
    handlesRef.current = [];

    const map = mapRef.current;
    const model = selectedRoad?.forensic;

    if (!map || !model || model.centreline.length < 2) return;

    const midpoint = (points: RealSceneMetricPoint[]) =>
      points[Math.floor(points.length / 2)];

    [midpoint(model.leftEdge), midpoint(model.rightEdge)].forEach(
      (point, index) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className =
          "roadsafe-geometry-review__edge-handle";
        element.textContent = index === 0 ? "L" : "R";
        element.title = "Drag to correct roadway width";

        const marker = new maplibregl.Marker({
          element,
          anchor: "center",
        })
          .setLngLat(metricToGeo(point, buildResult))
          .addTo(map);

        marker.setDraggable(true);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const nextWidth = draggedWidth(
            selectedRoad,
            geoToMetric(lngLat.lng, lngLat.lat, buildResult),
          );

          if (nextWidth === null) return;

          setWidth(nextWidth.toFixed(2));
          void apply(
            nextWidth,
            selectedRoad.laneCount,
            "edge-handle",
          );
        });

        handlesRef.current.push(marker);
      },
    );

    return () => {
      handlesRef.current.forEach((marker) => marker.remove());
      handlesRef.current = [];
    };
  }, [
    buildResult,
    selectedRoad?.id,
    selectedRoad?.widthMetres,
    selectedRoad?.laneCount,
  ]);

  const corrections =
    buildResult.scenePackage.corrections ?? [];

  return (
    <section className="roadsafe-geometry-review">
      <header>
        <div>
          <span>Geometry correction</span>
          <strong>Satellite verification workspace</strong>
          <p>
            Select a road, compare the extracted model with imagery,
            then correct verified width or lane count before confirmation.
          </p>
        </div>

        <div className="roadsafe-geometry-review__stats">
          <span>
            <b>{buildResult.geometry.roads.length}</b> roads
          </span>
          <span>
            <b>{corrections.length}</b> corrected
          </span>
          <span>
            <b>
              {buildResult.scenePackage.qa.overallScorePercent}
            </b>{" "}
            QA
          </span>
        </div>
      </header>

      <div className="roadsafe-geometry-review__body">
        <div className="roadsafe-geometry-review__map-shell">
          <div
            ref={mountRef}
            className="roadsafe-geometry-review__map"
          />
          <div className="roadsafe-geometry-review__hint">
            Orange area = selected roadway. Drag L/R handles to
            adjust carriageway width.
          </div>
        </div>

        <aside>
          <label>
            <span>Selected road</span>
            <select
              value={selectedRoad?.id ?? ""}
              onChange={(event) =>
                setSelectedRoadId(event.target.value)
              }
            >
              {buildResult.geometry.roads.map((road) => (
                <option key={road.id} value={road.id}>
                  {road.name} - {road.highwayType}
                </option>
              ))}
            </select>
          </label>

          {selectedRoad && (
            <>
              <div className="roadsafe-geometry-review__meta">
                <span>
                  OSM <b>{selectedRoad.osmId}</b>
                </span>
                <span>
                  Width{" "}
                  <b>
                    {selectedRoad.forensic?.widthSource ??
                      "unknown"}
                  </b>
                </span>
                <span>
                  Lanes{" "}
                  <b>
                    {selectedRoad.forensic?.laneCountSource ??
                      "unknown"}
                  </b>
                </span>
              </div>

              <div className="roadsafe-geometry-review__fields">
                <label>
                  <span>Carriageway width (m)</span>
                  <input
                    type="number"
                    min="2.4"
                    max="45"
                    step="0.1"
                    value={width}
                    onChange={(event) =>
                      setWidth(event.target.value)
                    }
                  />
                </label>

                <label>
                  <span>Lane count</span>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    value={lanes}
                    onChange={(event) =>
                      setLanes(event.target.value)
                    }
                  />
                </label>
              </div>

              <button
                type="button"
                className="roadsafe-geometry-review__apply"
                disabled={
                  busy ||
                  !Number.isFinite(Number(width)) ||
                  !Number.isFinite(Number(lanes))
                }
                onClick={() =>
                  void apply(
                    Number(width),
                    Number(lanes),
                    "inspector",
                  )
                }
              >
                {busy
                  ? "Rebuilding + re-hashing..."
                  : "Apply investigator correction"}
              </button>

              <p className="roadsafe-geometry-review__warning">
                Imagery is a visual verification aid, not a surveyed
                measurement. Only apply dimensions supported by field
                measurement, trusted records, or investigator judgement.
              </p>
            </>
          )}

          {corrections.length > 0 && (
            <div className="roadsafe-geometry-review__audit">
              <strong>Latest corrections</strong>
              {[...corrections]
                .reverse()
                .slice(0, 4)
                .map((correction) => (
                  <article key={correction.id}>
                    <span>{correction.roadName}</span>
                    <small>
                      {correction.previous.widthMetres}m/
                      {correction.previous.laneCount}L to{" "}
                      {correction.next.widthMetres}m/
                      {correction.next.laneCount}L
                    </small>
                  </article>
                ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
