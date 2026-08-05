import {
  normaliseMetricRouteTopology,
} from "./reconstructionRouteTopology";

import type {
  RealSceneGeometry,
  RealSceneLocalPoint,
  RealSceneRoadGeometry,
} from "../types/realSceneGeometry";
import type {
  MovementPathPoint,
  ReconstructionPosition,
  ReconstructionVehicleType,
} from "../types/reconstruction";
import {
  hasLearnedRoutePreference,
  learnRoutePreference,
  rankReconstructionRoutes,
  type ReconstructionRouteCandidate,
  type ReconstructionRouteFeatures,
} from "./reconstructionRouteAiRanker";
import { getEffectiveRealRoadWidthMetres } from "./reconstructionWorldScale";

export const AUTO_ROAD_CURVE_NOTE_MARKER = "[RoadSafe:AutoRoadCurve]";
export const AUTO_ROAD_CURVE_ID_PREFIX = "path-auto-road-";
export const ROUTE_CONFIDENCE_NOTE_PREFIX = "[RoadSafe:RouteConfidence=";

let activeGeometry: RealSceneGeometry | null = null;

interface Point2 {
  x: number;
  y: number;
}

interface GraphNode {
  id: number;
  point: Point2;
  edges: GraphEdge[];
}

interface RoadSegment {
  id: string;
  road: RealSceneRoadGeometry;
  start: Point2;
  end: Point2;
  startNodeId: number;
  endNodeId: number;
  lengthMetres: number;
  tangent: Point2;
  widthMetres: number;
}

interface GraphEdge {
  id: string;
  from: number;
  to: number;
  segment: RoadSegment;
  direction: Point2;
  distanceMetres: number;
}

interface RoadGraph {
  nodes: GraphNode[];
  segments: RoadSegment[];
  edgesById: Map<string, GraphEdge>;
}

interface RoadProjection {
  segment: RoadSegment;
  point: Point2;
  progress: number;
  distanceMetres: number;
}

interface ProjectionOption {
  nodeId: number;
  point: Point2;
  distanceMetres: number;
  direction: Point2;
}

interface SearchProfile {
  id: string;
  turnPenalty: number;
  roadSwitchPenalty: number;
  uTurnPenalty: number;
  distanceWeight: number;
}

interface RawRoadRoute {
  id: string;
  points: Point2[];
  startProjectionPoint: Point2;
  travelDistanceMetres: number;
  startProjectionDistanceMetres: number;
  impactProjectionDistanceMetres: number;
  startDirection: Point2;
  arrivalDirection: Point2;
  roadSwitches: number;
  edgeCount: number;
  minimumRoadWidthMetres: number;
}

interface EvaluatedRoadRoute extends RawRoadRoute {
  sampledPoints: Point2[];
  features: ReconstructionRouteFeatures;
  deterministicConfidence: number;
}

interface CreateRoadAlignedIntermediatePointsOptions {
  startPoint: MovementPathPoint;
  impactPoint: MovementPathPoint;
  participantType: ReconstructionVehicleType;
  durationSeconds: number;
  createId: (prefix: string) => string;
}

export interface ReconstructionRoadRouteRecommendation {
  available: boolean;
  confidence: number;
  candidateCount: number;
  reason: string;
}

export interface RoadAlignedParticipantRoutePlan {
  startPoint: MovementPathPoint;
  intermediatePoints: MovementPathPoint[];
  confidence: number;
}

let lastRecommendation: ReconstructionRoadRouteRecommendation = {
  available: false,
  confidence: 0,
  candidateCount: 0,
  reason: "No route has been evaluated yet.",
};

const graphCache = new WeakMap<RealSceneGeometry, RoadGraph>();

const SEARCH_PROFILES: SearchProfile[] = [
  {
    id: "balanced",
    turnPenalty: 5.2,
    roadSwitchPenalty: 2.0,
    uTurnPenalty: 70,
    distanceWeight: 1,
  },
  {
    id: "smooth",
    turnPenalty: 10.5,
    roadSwitchPenalty: 2.8,
    uTurnPenalty: 95,
    distanceWeight: 0.92,
  },
  {
    id: "direct",
    turnPenalty: 3.2,
    roadSwitchPenalty: 1.2,
    uTurnPenalty: 75,
    distanceWeight: 1.18,
  },
  {
    id: "few-road-changes",
    turnPenalty: 6.2,
    roadSwitchPenalty: 7.5,
    uTurnPenalty: 90,
    distanceWeight: 1,
  },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function vectorLength(vector: Point2): number {
  return Math.hypot(vector.x, vector.y);
}

function distance(first: Point2, second: Point2): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function subtract(end: Point2, start: Point2): Point2 {
  return { x: end.x - start.x, y: end.y - start.y };
}

function addScaled(point: Point2, direction: Point2, amount: number): Point2 {
  return {
    x: point.x + direction.x * amount,
    y: point.y + direction.y * amount,
  };
}

function normalise(vector: Point2, fallback: Point2 = { x: 1, y: 0 }): Point2 {
  const magnitude = vectorLength(vector);
  if (magnitude > 0.000001) {
    return { x: vector.x / magnitude, y: vector.y / magnitude };
  }

  const fallbackMagnitude = vectorLength(fallback) || 1;
  return {
    x: fallback.x / fallbackMagnitude,
    y: fallback.y / fallbackMagnitude,
  };
}

function reverse(vector: Point2): Point2 {
  return { x: -vector.x, y: -vector.y };
}

function dot(first: Point2, second: Point2): number {
  return first.x * second.x + first.y * second.y;
}

function angleDifferenceDegrees(first: Point2, second: Point2): number {
  return (
    Math.acos(clamp(dot(normalise(first), normalise(second)), -1, 1)) *
    180 /
    Math.PI
  );
}

function localPoint(point: RealSceneLocalPoint): Point2 {
  return { x: point.xMetres, y: point.yMetres };
}

function sceneToLocalMetres(
  position: ReconstructionPosition,
  geometry: RealSceneGeometry,
): Point2 {
  return {
    x: (clamp(position.x, 0, 100) / 100) * geometry.sceneWidthMetres,
    y:
      (1 - clamp(position.y, 0, 100) / 100) *
      geometry.sceneHeightMetres,
  };
}

function localMetresToScene(
  point: Point2,
  geometry: RealSceneGeometry,
): ReconstructionPosition {
  return {
    x: clamp(
      (point.x / Math.max(1, geometry.sceneWidthMetres)) * 100,
      0,
      100,
    ),
    y: clamp(
      100 - (point.y / Math.max(1, geometry.sceneHeightMetres)) * 100,
      0,
      100,
    ),
  };
}

function screenHeadingVector(degrees: number): Point2 {
  const radians = (degrees * Math.PI) / 180;
  return normalise({
    x: Math.cos(radians),
    y: -Math.sin(radians),
  });
}

function nearestPointOnSegment(
  point: Point2,
  start: Point2,
  end: Point2,
): { point: Point2; progress: number; distanceMetres: number } {
  const segment = subtract(end, start);
  const lengthSquared = dot(segment, segment);
  const progress =
    lengthSquared <= 0.000001
      ? 0
      : clamp(dot(subtract(point, start), segment) / lengthSquared, 0, 1);
  const projected = addScaled(start, segment, progress);

  return {
    point: projected,
    progress,
    distanceMetres: distance(point, projected),
  };
}

interface RoadPrimitive {
  id: string;
  road: RealSceneRoadGeometry;
  start: Point2;
  end: Point2;
  lengthMetres: number;
  splitProgress: number[];
}

function interpolatePoint(start: Point2, end: Point2, progress: number): Point2 {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  };
}

function segmentIntersectionProgress(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): { first: number; second: number } | null {
  const firstVector = subtract(firstEnd, firstStart);
  const secondVector = subtract(secondEnd, secondStart);
  const determinant =
    firstVector.x * secondVector.y - firstVector.y * secondVector.x;
  if (Math.abs(determinant) < 0.000001) return null;

  const offset = subtract(secondStart, firstStart);
  const firstProgress =
    (offset.x * secondVector.y - offset.y * secondVector.x) / determinant;
  const secondProgress =
    (offset.x * firstVector.y - offset.y * firstVector.x) / determinant;

  if (
    firstProgress < -0.0001 ||
    firstProgress > 1.0001 ||
    secondProgress < -0.0001 ||
    secondProgress > 1.0001
  ) {
    return null;
  }

  return {
    first: clamp(firstProgress, 0, 1),
    second: clamp(secondProgress, 0, 1),
  };
}

function addSplitProgress(primitive: RoadPrimitive, progress: number): void {
  const safe = clamp(progress, 0, 1);
  if (
    primitive.splitProgress.every(
      (existing) => Math.abs(existing - safe) * primitive.lengthMetres > 0.12,
    )
  ) {
    primitive.splitProgress.push(safe);
  }
}

function createRoadGraph(geometry: RealSceneGeometry): RoadGraph {
  const cached = graphCache.get(geometry);
  if (cached) return cached;

  const primitives: RoadPrimitive[] = [];
  geometry.roads.forEach((road) => {
    const points = road.localPoints.map(localPoint);
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const lengthMetres = distance(start, end);
      if (lengthMetres < 0.1) continue;
      primitives.push({
        id: `${road.id}:${index - 1}`,
        road,
        start,
        end,
        lengthMetres,
        splitProgress: [0, 1],
      });
    }
  });

  // OSM normally shares an exact node at intersections, but extracted ways can
  // still cross without carrying the same intermediate vertex. Split every
  // crossing and T-junction before graph construction so the planner cannot
  // treat visibly connected roads as disconnected.
  for (let firstIndex = 0; firstIndex < primitives.length; firstIndex += 1) {
    const first = primitives[firstIndex];
    const firstMinX = Math.min(first.start.x, first.end.x) - 1.8;
    const firstMaxX = Math.max(first.start.x, first.end.x) + 1.8;
    const firstMinY = Math.min(first.start.y, first.end.y) - 1.8;
    const firstMaxY = Math.max(first.start.y, first.end.y) + 1.8;

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < primitives.length;
      secondIndex += 1
    ) {
      const second = primitives[secondIndex];
      if (first.road.id === second.road.id) continue;
      if (
        Math.max(second.start.x, second.end.x) < firstMinX ||
        Math.min(second.start.x, second.end.x) > firstMaxX ||
        Math.max(second.start.y, second.end.y) < firstMinY ||
        Math.min(second.start.y, second.end.y) > firstMaxY
      ) {
        continue;
      }

      const intersection = segmentIntersectionProgress(
        first.start,
        first.end,
        second.start,
        second.end,
      );
      if (intersection) {
        addSplitProgress(first, intersection.first);
        addSplitProgress(second, intersection.second);
        continue;
      }

      // Also connect near-miss T-junctions caused by coordinate rounding.
      for (const endpoint of [first.start, first.end]) {
        const projected = nearestPointOnSegment(endpoint, second.start, second.end);
        if (projected.distanceMetres <= 1.8) {
          addSplitProgress(second, projected.progress);
        }
      }
      for (const endpoint of [second.start, second.end]) {
        const projected = nearestPointOnSegment(endpoint, first.start, first.end);
        if (projected.distanceMetres <= 1.8) {
          addSplitProgress(first, projected.progress);
        }
      }
    }
  }

  const nodes: GraphNode[] = [];
  const segments: RoadSegment[] = [];
  const edgesById = new Map<string, GraphEdge>();
  const mergeDistanceMetres = 1.8;
  const grid = new Map<string, number[]>();
  const gridKey = (x: number, y: number): string =>
    `${Math.floor(x / mergeDistanceMetres)}:${Math.floor(y / mergeDistanceMetres)}`;

  const findOrCreateNode = (point: Point2): number => {
    const cellX = Math.floor(point.x / mergeDistanceMetres);
    const cellY = Math.floor(point.y / mergeDistanceMetres);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const candidates =
          grid.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
        const matching = candidates.find(
          (nodeId) => distance(nodes[nodeId].point, point) <= mergeDistanceMetres,
        );
        if (matching !== undefined) return matching;
      }
    }

    const id = nodes.length;
    nodes.push({ id, point: { ...point }, edges: [] });
    const key = gridKey(point.x, point.y);
    grid.set(key, [...(grid.get(key) ?? []), id]);
    return id;
  };

  const addEdge = (
    segment: RoadSegment,
    from: number,
    to: number,
    direction: Point2,
    suffix: string,
  ): void => {
    const edge: GraphEdge = {
      id: `${segment.id}:${suffix}`,
      from,
      to,
      segment,
      direction,
      distanceMetres: segment.lengthMetres,
    };
    nodes[from].edges.push(edge);
    edgesById.set(edge.id, edge);
  };

  primitives.forEach((primitive) => {
    const progresses = [...primitive.splitProgress].sort((a, b) => a - b);
    for (let index = 1; index < progresses.length; index += 1) {
      const startProgress = progresses[index - 1];
      const endProgress = progresses[index];
      const start = interpolatePoint(primitive.start, primitive.end, startProgress);
      const end = interpolatePoint(primitive.start, primitive.end, endProgress);
      const lengthMetres = distance(start, end);
      if (lengthMetres < 0.1) continue;

      const segment: RoadSegment = {
        id: `${primitive.id}:split-${index - 1}`,
        road: primitive.road,
        start,
        end,
        startNodeId: findOrCreateNode(start),
        endNodeId: findOrCreateNode(end),
        lengthMetres,
        tangent: normalise(subtract(end, start)),
        widthMetres: getEffectiveRealRoadWidthMetres(primitive.road),
      };
      segments.push(segment);
      addEdge(
        segment,
        segment.startNodeId,
        segment.endNodeId,
        segment.tangent,
        "forward",
      );
      if (!primitive.road.oneWay) {
        addEdge(
          segment,
          segment.endNodeId,
          segment.startNodeId,
          reverse(segment.tangent),
          "reverse",
        );
      }
    }
  });

  const graph = { nodes, segments, edgesById };
  graphCache.set(geometry, graph);
  return graph;
}

function roadProjectionCandidates(
  target: Point2,
  graph: RoadGraph,
  limit: number,
): RoadProjection[] {
  const projections = graph.segments
    .map((segment) => {
      const projected = nearestPointOnSegment(target, segment.start, segment.end);
      return {
        segment,
        point: projected.point,
        progress: projected.progress,
        distanceMetres: projected.distanceMetres,
      };
    })
    .sort((first, second) => first.distanceMetres - second.distanceMetres);

  if (projections.length === 0) return [];
  const nearestDistance = projections[0].distanceMetres;
  const credible = projections.filter(
    (projection) =>
      projection.distanceMetres <= projection.segment.widthMetres / 2 + 2.2 &&
      projection.distanceMetres <= nearestDistance + 2.4,
  );

  return (credible.length > 0 ? credible : projections.slice(0, 1)).slice(0, limit);
}

function departureOptions(projection: RoadProjection): ProjectionOption[] {
  const options: ProjectionOption[] = [
    {
      nodeId: projection.segment.endNodeId,
      point: projection.segment.end,
      distanceMetres:
        (1 - projection.progress) * projection.segment.lengthMetres,
      direction: projection.segment.tangent,
    },
  ];

  if (!projection.segment.road.oneWay) {
    options.push({
      nodeId: projection.segment.startNodeId,
      point: projection.segment.start,
      distanceMetres: projection.progress * projection.segment.lengthMetres,
      direction: reverse(projection.segment.tangent),
    });
  }

  return options;
}

function arrivalOptions(projection: RoadProjection): ProjectionOption[] {
  const options: ProjectionOption[] = [
    {
      nodeId: projection.segment.startNodeId,
      point: projection.segment.start,
      distanceMetres: projection.progress * projection.segment.lengthMetres,
      direction: projection.segment.tangent,
    },
  ];

  if (!projection.segment.road.oneWay) {
    options.push({
      nodeId: projection.segment.endNodeId,
      point: projection.segment.end,
      distanceMetres:
        (1 - projection.progress) * projection.segment.lengthMetres,
      direction: reverse(projection.segment.tangent),
    });
  }

  return options;
}

class MinimumHeap<T> {
  private values: Array<{ priority: number; value: T }> = [];

  get size(): number {
    return this.values.length;
  }

  push(priority: number, value: T): void {
    const entry = { priority, value };
    this.values.push(entry);
    let index = this.values.length - 1;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].priority <= entry.priority) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = entry;
  }

  pop(): T | null {
    if (this.values.length === 0) return null;
    const root = this.values[0];
    const tail = this.values.pop();
    if (!tail || this.values.length === 0) return root.value;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const smallest =
        right < this.values.length &&
        this.values[right].priority < this.values[left].priority
          ? right
          : left;
      if (this.values[smallest].priority >= tail.priority) break;
      this.values[index] = this.values[smallest];
      index = smallest;
    }
    this.values[index] = tail;
    return root.value;
  }
}

interface SearchRecord {
  key: string;
  nodeId: number;
  incomingEdgeId: string | null;
  cost: number;
  previousKey: string | null;
}

function searchNodePath(
  graph: RoadGraph,
  startNodeId: number,
  endNodeId: number,
  initialDirection: Point2,
  profile: SearchProfile,
  excludedEdgeId?: string,
): GraphEdge[] | null {
  if (startNodeId === endNodeId) return [];

  const records = new Map<string, SearchRecord>();
  const bestCosts = new Map<string, number>();
  const open = new MinimumHeap<string>();
  const startKey = `${startNodeId}|start`;
  records.set(startKey, {
    key: startKey,
    nodeId: startNodeId,
    incomingEdgeId: null,
    cost: 0,
    previousKey: null,
  });
  bestCosts.set(startKey, 0);
  open.push(distance(graph.nodes[startNodeId].point, graph.nodes[endNodeId].point), startKey);

  let finalKey: string | null = null;
  let expansions = 0;
  const maximumExpansions = Math.max(1200, graph.nodes.length * 18);

  while (open.size > 0 && expansions < maximumExpansions) {
    const key = open.pop();
    if (!key) break;
    const current = records.get(key);
    if (!current) continue;
    if (current.cost > (bestCosts.get(key) ?? Number.POSITIVE_INFINITY) + 0.0001) {
      continue;
    }
    if (current.nodeId === endNodeId) {
      finalKey = key;
      break;
    }

    expansions += 1;
    const incoming = current.incomingEdgeId
      ? graph.edgesById.get(current.incomingEdgeId) ?? null
      : null;
    const incomingDirection = incoming?.direction ?? initialDirection;

    graph.nodes[current.nodeId].edges.forEach((edge) => {
      if (edge.id === excludedEdgeId) return;
      const turnDegrees = angleDifferenceDegrees(incomingDirection, edge.direction);
      const isUTurn = turnDegrees > 150;
      const roadSwitch = incoming && incoming.segment.road.id !== edge.segment.road.id;
      const turnCost =
        profile.turnPenalty * Math.pow(turnDegrees / 90, 2) +
        (isUTurn ? profile.uTurnPenalty : 0);
      const nextCost =
        current.cost +
        edge.distanceMetres * profile.distanceWeight +
        turnCost +
        (roadSwitch ? profile.roadSwitchPenalty : 0);
      const nextKey = `${edge.to}|${edge.id}`;

      if (nextCost >= (bestCosts.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        return;
      }

      const record: SearchRecord = {
        key: nextKey,
        nodeId: edge.to,
        incomingEdgeId: edge.id,
        cost: nextCost,
        previousKey: current.key,
      };
      records.set(nextKey, record);
      bestCosts.set(nextKey, nextCost);
      const heuristic =
        distance(graph.nodes[edge.to].point, graph.nodes[endNodeId].point) *
        profile.distanceWeight *
        0.82;
      open.push(nextCost + heuristic, nextKey);
    });
  }

  if (!finalKey) return null;
  const reversed: GraphEdge[] = [];
  let cursor: string | null = finalKey;
  while (cursor) {
    const record = records.get(cursor);
    if (!record) break;
    if (record.incomingEdgeId) {
      const edge = graph.edgesById.get(record.incomingEdgeId);
      if (edge) reversed.push(edge);
    }
    cursor = record.previousKey;
  }
  reversed.reverse();
  return reversed;
}

function deduplicatePoints(points: Point2[], tolerance = 0.1): Point2[] {
  const result: Point2[] = [];
  points.forEach((point) => {
    const previous = result[result.length - 1];
    if (!previous || distance(previous, point) > tolerance) {
      result.push({ ...point });
    }
  });
  return result;
}

function routeKey(points: Point2[]): string {
  return points
    .map((point) => `${Math.round(point.x * 2)}:${Math.round(point.y * 2)}`)
    .join("|");
}

function createSameSegmentRoute(
  startProjection: RoadProjection,
  impactProjection: RoadProjection,
  startLocal: Point2,
  impactLocal: Point2,
): RawRoadRoute | null {
  if (startProjection.segment.id !== impactProjection.segment.id) return null;
  const forward = impactProjection.progress >= startProjection.progress;
  if (startProjection.segment.road.oneWay && !forward) return null;

  const direction = forward
    ? startProjection.segment.tangent
    : reverse(startProjection.segment.tangent);
  const alongDistance =
    Math.abs(impactProjection.progress - startProjection.progress) *
    startProjection.segment.lengthMetres;
  const points = deduplicatePoints([
    startProjection.point,
    impactProjection.point,
    impactLocal,
  ]);

  return {
    id: `same:${startProjection.segment.id}:${forward ? "f" : "r"}`,
    points,
    startProjectionPoint: { ...startProjection.point },
    travelDistanceMetres:
      distance(startLocal, startProjection.point) +
      alongDistance +
      distance(impactProjection.point, impactLocal),
    startProjectionDistanceMetres: startProjection.distanceMetres,
    impactProjectionDistanceMetres: impactProjection.distanceMetres,
    startDirection: direction,
    arrivalDirection: direction,
    roadSwitches: 0,
    edgeCount: 1,
    minimumRoadWidthMetres: startProjection.segment.widthMetres,
  };
}

function createNetworkRoute(
  graph: RoadGraph,
  startProjection: RoadProjection,
  impactProjection: RoadProjection,
  startOption: ProjectionOption,
  impactOption: ProjectionOption,
  startLocal: Point2,
  impactLocal: Point2,
  profile: SearchProfile,
  excludedEdgeId?: string,
): RawRoadRoute | null {
  const edges = searchNodePath(
    graph,
    startOption.nodeId,
    impactOption.nodeId,
    startOption.direction,
    profile,
    excludedEdgeId,
  );
  if (!edges) return null;

  const nodePoints = edges.map((edge) => graph.nodes[edge.to].point);
  const points = deduplicatePoints([
    startProjection.point,
    startOption.point,
    ...nodePoints,
    impactOption.point,
    impactProjection.point,
    impactLocal,
  ]);
  const edgeDistance = edges.reduce((sum, edge) => sum + edge.distanceMetres, 0);
  const travelDistanceMetres =
    distance(startLocal, startProjection.point) +
    startOption.distanceMetres +
    edgeDistance +
    impactOption.distanceMetres +
    distance(impactProjection.point, impactLocal);
  const directDistance = distance(startLocal, impactLocal);
  if (travelDistanceMetres > directDistance * 3.1 + 28) return null;

  let roadSwitches = 0;
  for (let index = 1; index < edges.length; index += 1) {
    if (edges[index - 1].segment.road.id !== edges[index].segment.road.id) {
      roadSwitches += 1;
    }
  }

  const widths = [
    startProjection.segment.widthMetres,
    impactProjection.segment.widthMetres,
    ...edges.map((edge) => edge.segment.widthMetres),
  ];

  return {
    id: `${profile.id}:${startProjection.segment.id}:${impactProjection.segment.id}:${startOption.nodeId}:${impactOption.nodeId}:${excludedEdgeId ?? "none"}`,
    points,
    startProjectionPoint: { ...startProjection.point },
    travelDistanceMetres,
    startProjectionDistanceMetres: startProjection.distanceMetres,
    impactProjectionDistanceMetres: impactProjection.distanceMetres,
    startDirection: startOption.direction,
    arrivalDirection: impactOption.direction,
    roadSwitches,
    edgeCount: Math.max(1, edges.length),
    minimumRoadWidthMetres: Math.min(...widths),
  };
}

function generateRawRoutes(
  geometry: RealSceneGeometry,
  startLocal: Point2,
  impactLocal: Point2,
): { graph: RoadGraph; routes: RawRoadRoute[] } {
  const graph = createRoadGraph(geometry);
  if (graph.segments.length === 0) return { graph, routes: [] };

  const startCandidates = roadProjectionCandidates(startLocal, graph, 4);
  const impactCandidates = roadProjectionCandidates(impactLocal, graph, 5);
  const unique = new Map<string, RawRoadRoute>();

  startCandidates.forEach((startProjection) => {
    impactCandidates.forEach((impactProjection) => {
      const same = createSameSegmentRoute(
        startProjection,
        impactProjection,
        startLocal,
        impactLocal,
      );
      if (same) unique.set(routeKey(same.points), same);

      departureOptions(startProjection).forEach((startOption) => {
        arrivalOptions(impactProjection).forEach((impactOption) => {
          SEARCH_PROFILES.forEach((profile) => {
            const route = createNetworkRoute(
              graph,
              startProjection,
              impactProjection,
              startOption,
              impactOption,
              startLocal,
              impactLocal,
              profile,
            );
            if (!route) return;
            const key = routeKey(route.points);
            const current = unique.get(key);
            if (!current || route.travelDistanceMetres < current.travelDistanceMetres) {
              unique.set(key, route);
            }
          });
        });
      });
    });
  });

  return {
    graph,
    routes: [...unique.values()]
      .sort((first, second) => first.travelDistanceMetres - second.travelDistanceMetres)
      .slice(0, 24),
  };
}

function simplifyPolyline(points: Point2[]): Point2[] {
  const source = deduplicatePoints(points);
  if (source.length <= 2) return source;
  const result: Point2[] = [source[0]];

  for (let index = 1; index < source.length - 1; index += 1) {
    const previous = result[result.length - 1];
    const current = source[index];
    const next = source[index + 1];
    const turn = angleDifferenceDegrees(
      subtract(current, previous),
      subtract(next, current),
    );

    if (turn >= 2.5 || distance(previous, current) >= 10) {
      result.push(current);
    }
  }
  result.push(source[source.length - 1]);
  return deduplicatePoints(result);
}

function quadraticPoint(
  start: Point2,
  control: Point2,
  end: Point2,
  progress: number,
): Point2 {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * start.x +
      2 * inverse * progress * control.x +
      progress * progress * end.x,
    y:
      inverse * inverse * start.y +
      2 * inverse * progress * control.y +
      progress * progress * end.y,
  };
}

function participantBaseTurnRadius(type: ReconstructionVehicleType): number {
  switch (type) {
    case "Bus":
      return 7.2;
    case "Truck":
      return 6.4;
    case "Motorcycle":
      return 3.0;
    case "Bicycle":
      return 2.2;
    default:
      return 4.2;
  }
}

function requiredTurnRadius(
  type: ReconstructionVehicleType,
  speedKmh: number,
): number {
  return participantBaseTurnRadius(type) + clamp(speedKmh, 0, 100) * 0.025;
}

function roundPolylineCorners(
  points: Point2[],
  participantType: ReconstructionVehicleType,
  speedKmh: number,
  radiusScale: number,
): Point2[] {
  const source = simplifyPolyline(points);
  if (source.length <= 2) return source;
  const result: Point2[] = [{ ...source[0] }];
  const preferredRadius = requiredTurnRadius(participantType, speedKmh) * radiusScale;

  for (let index = 1; index < source.length - 1; index += 1) {
    const previous = source[index - 1];
    const corner = source[index];
    const next = source[index + 1];
    const incomingVector = subtract(corner, previous);
    const outgoingVector = subtract(next, corner);
    const incomingLength = vectorLength(incomingVector);
    const outgoingLength = vectorLength(outgoingVector);

    if (incomingLength < 0.25 || outgoingLength < 0.25) {
      result.push({ ...corner });
      continue;
    }

    const incoming = normalise(incomingVector);
    const outgoing = normalise(outgoingVector);
    const turnDegrees = angleDifferenceDegrees(incoming, outgoing);
    if (turnDegrees < 4 || turnDegrees > 168) {
      result.push({ ...corner });
      continue;
    }

    const tangentDistance =
      preferredRadius * Math.tan((turnDegrees * Math.PI) / 360);
    const cutDistance = Math.min(
      tangentDistance,
      incomingLength * 0.42,
      outgoingLength * 0.42,
    );
    if (cutDistance < 0.35) {
      result.push({ ...corner });
      continue;
    }

    const entry = addScaled(corner, incoming, -cutDistance);
    const exit = addScaled(corner, outgoing, cutDistance);
    result.push(entry);
    const subdivisions = clamp(Math.ceil(turnDegrees / 9), 5, 14);
    for (let step = 1; step < subdivisions; step += 1) {
      result.push(quadraticPoint(entry, corner, exit, step / subdivisions));
    }
    result.push(exit);
  }

  result.push({ ...source[source.length - 1] });
  return deduplicatePoints(result);
}

function polylineLength(points: Point2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function participantSampleSpacing(type: ReconstructionVehicleType): number {
  switch (type) {
    case "Bus":
      return 3.2;
    case "Truck":
      return 3.0;
    case "Motorcycle":
      return 2.1;
    case "Bicycle":
      return 1.9;
    default:
      return 2.35;
  }
}

function samplePolylineByDistance(
  points: Point2[],
  requestedSpacing: number,
  maximumPoints = 18,
): Point2[] {
  const source = deduplicatePoints(points);
  if (source.length < 2) return source;
  const total = polylineLength(source);
  if (total < 0.1) return [source[0], source[source.length - 1]];

  const spacing = Math.max(
    requestedSpacing,
    total / Math.max(2, maximumPoints - 1),
  );
  const targets = [0];
  for (let value = spacing; value < total; value += spacing) targets.push(value);
  targets.push(total);

  const result: Point2[] = [];
  let segmentIndex = 0;
  let distanceBefore = 0;
  targets.forEach((target) => {
    while (
      segmentIndex < source.length - 2 &&
      distanceBefore + distance(source[segmentIndex], source[segmentIndex + 1]) < target
    ) {
      distanceBefore += distance(source[segmentIndex], source[segmentIndex + 1]);
      segmentIndex += 1;
    }

    const start = source[segmentIndex];
    const end = source[Math.min(source.length - 1, segmentIndex + 1)];
    const segmentLength = Math.max(0.000001, distance(start, end));
    const progress = clamp((target - distanceBefore) / segmentLength, 0, 1);
    result.push({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    });
  });

  return deduplicatePoints(result);
}

function nearestRoadDistance(
  point: Point2,
  graph: RoadGraph,
): { distanceMetres: number; widthMetres: number } {
  let bestDistance = Number.POSITIVE_INFINITY;
  let widthMetres = 3;
  graph.segments.forEach((segment) => {
    const projected = nearestPointOnSegment(point, segment.start, segment.end);
    if (projected.distanceMetres < bestDistance) {
      bestDistance = projected.distanceMetres;
      widthMetres = segment.widthMetres;
    }
  });
  return { distanceMetres: bestDistance, widthMetres };
}

function containmentRatio(points: Point2[], graph: RoadGraph): number {
  if (points.length === 0) return 0;
  let inside = 0;
  points.forEach((point) => {
    const nearest = nearestRoadDistance(point, graph);
    if (nearest.distanceMetres <= nearest.widthMetres / 2 + 1.4) inside += 1;
  });
  return inside / points.length;
}

function circumradius(first: Point2, second: Point2, third: Point2): number {
  const a = distance(second, third);
  const b = distance(first, third);
  const c = distance(first, second);
  const doubledArea = Math.abs(
    (second.x - first.x) * (third.y - first.y) -
      (second.y - first.y) * (third.x - first.x),
  );
  if (doubledArea < 0.0001) return Number.POSITIVE_INFINITY;
  return (a * b * c) / (2 * doubledArea);
}

function minimumCurveRadius(points: Point2[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length - 1; index += 1) {
    const turn = angleDifferenceDegrees(
      subtract(points[index], points[index - 1]),
      subtract(points[index + 1], points[index]),
    );
    if (turn < 2) continue;
    minimum = Math.min(
      minimum,
      circumradius(points[index - 1], points[index], points[index + 1]),
    );
  }
  return minimum;
}

function totalTurnDegrees(points: Point2[]): number {
  let total = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    total += angleDifferenceDegrees(
      subtract(points[index], points[index - 1]),
      subtract(points[index + 1], points[index]),
    );
  }
  return total;
}

function participantMinimumRoadWidth(type: ReconstructionVehicleType): number {
  switch (type) {
    case "Bus":
      return 5.2;
    case "Truck":
      return 4.8;
    case "Motorcycle":
      return 2.2;
    case "Bicycle":
      return 1.8;
    default:
      return 3.4;
  }
}


/*
 * Route direction, reversal, detour and collision-capture checks are now
 * performed by reconstructionRouteTopology in physical metres.
 */

function evaluateRoute(
  route: RawRoadRoute,
  graph: RoadGraph,
  startLocal: Point2,
  impactLocal: Point2,
  startHeading: Point2,
  participantType: ReconstructionVehicleType,
  speedKmh: number,
  radiusScale: number,
): EvaluatedRoadRoute | null {
  const maximumEndpointSnap = Math.max(6, route.minimumRoadWidthMetres / 2 + 2.5);
  if (
    route.startProjectionDistanceMetres > maximumEndpointSnap ||
    route.impactProjectionDistanceMetres > maximumEndpointSnap
  ) {
    return null;
  }

  const rounded =
    roundPolylineCorners(
      route.points,
      participantType,
      speedKmh,
      radiusScale,
    );

  const rawSampled =
    samplePolylineByDistance(
      rounded,
      participantSampleSpacing(
        participantType,
      ),
    );

  if (
    rawSampled.length < 3
  ) {
    return null;
  }

  /*
   * Candidate ranking must operate on a route that has already passed the
   * complete metric topology invariant.
   */
  rawSampled[0] = {
    ...route
      .startProjectionPoint,
  };

  rawSampled[
    rawSampled.length -
      1
  ] = {
    ...impactLocal,
  };

  const topology =
    normaliseMetricRouteTopology(
      rawSampled,
      impactLocal,
      participantType,
    );

  if (
    !topology.valid ||
    topology.points.length <
      3
  ) {
    return null;
  }

  const sampled =
    topology.points;

  const coverage = containmentRatio(sampled, graph);
  const minimumRadius = minimumCurveRadius(sampled);
  const requiredRadius = requiredTurnRadius(participantType, speedKmh);
  const curvatureCompliance = Number.isFinite(minimumRadius)
    ? clamp(minimumRadius / Math.max(0.1, requiredRadius), 0, 1)
    : 1;
  if (coverage < 0.9 || curvatureCompliance < 0.48) return null;

  const firstDirection = normalise(subtract(sampled[1], sampled[0]), route.startDirection);
  const finalDirection = normalise(
    subtract(sampled[sampled.length - 1], sampled[sampled.length - 2]),
    route.arrivalDirection,
  );
  const routeLength = Math.max(0.001, polylineLength(sampled));
  const directDistance = Math.max(0.001, distance(startLocal, impactLocal));
  const turns = totalTurnDegrees(sampled);
  const snapDistance =
    route.startProjectionDistanceMetres + route.impactProjectionDistanceMetres;
  const widthSuitability = clamp(
    route.minimumRoadWidthMetres /
      participantMinimumRoadWidth(participantType),
    0,
    1,
  );

  const features: ReconstructionRouteFeatures = {
    roadContainment: coverage,
    startAlignment: clamp((dot(firstDirection, startHeading) + 1) / 2, 0, 1),
    arrivalAlignment: clamp(
      (dot(finalDirection, normalise(route.arrivalDirection)) + 1) / 2,
      0,
      1,
    ),
    curvatureCompliance,
    directness: clamp(directDistance / routeLength, 0, 1),
    laneContinuity: clamp(
      1 - route.roadSwitches / Math.max(2, route.edgeCount),
      0,
      1,
    ),
    turnEfficiency: clamp(1 - turns / 520, 0, 1),
    vehicleSuitability: clamp(curvatureCompliance * 0.7 + widthSuitability * 0.3, 0, 1),
    snapQuality: clamp(1 - snapDistance / 18, 0, 1),
  };

  const deterministicConfidence = clamp(
    features.roadContainment * 0.30 +
      features.curvatureCompliance * 0.22 +
      features.vehicleSuitability * 0.15 +
      features.snapQuality * 0.13 +
      features.directness * 0.10 +
      features.laneContinuity * 0.10,
    0,
    1,
  );

  return {
    ...route,
    id: `${route.id}:radius-${radiusScale.toFixed(2)}`,
    sampledPoints: sampled,
    features,
    deterministicConfidence,
  };
}

function buildRankedCandidates(
  geometry: RealSceneGeometry,
  startPoint: MovementPathPoint,
  impactPoint: MovementPathPoint,
  participantType: ReconstructionVehicleType,
): Array<ReconstructionRouteCandidate<EvaluatedRoadRoute>> {
  const startLocal = sceneToLocalMetres(startPoint.position, geometry);
  const impactLocal = sceneToLocalMetres(impactPoint.position, geometry);
  if (distance(startLocal, impactLocal) < 2.5) return [];

  const { graph, routes } = generateRawRoutes(geometry, startLocal, impactLocal);
  const startHeading = screenHeadingVector(startPoint.rotation);
  const evaluated = new Map<string, EvaluatedRoadRoute>();

  routes.forEach((route) => {
    [0.9, 1.08].forEach((radiusScale) => {
      const candidate = evaluateRoute(
        route,
        graph,
        startLocal,
        impactLocal,
        startHeading,
        participantType,
        startPoint.speedKmh,
        radiusScale,
      );
      if (!candidate) return;
      const key = routeKey(candidate.sampledPoints);
      const previous = evaluated.get(key);
      if (
        !previous ||
        candidate.deterministicConfidence > previous.deterministicConfidence
      ) {
        evaluated.set(key, candidate);
      }
    });
  });

  return [...evaluated.values()].map((candidate) => ({
    id: candidate.id,
    value: candidate,
    features: candidate.features,
    deterministicConfidence: candidate.deterministicConfidence,
  }));
}

function headingDegrees(previous: Point2, next: Point2, fallback: number): number {
  const vector = subtract(next, previous);
  if (vectorLength(vector) < 0.000001) return fallback;
  return ((Math.atan2(-vector.y, vector.x) * 180) / Math.PI + 360) % 360;
}

function isRoadFollowingParticipant(type: ReconstructionVehicleType): boolean {
  return !["Pedestrian", "Officer", "Witness"].includes(type);
}

function routeLearningSignature(
  geometry: RealSceneGeometry,
  participantType: ReconstructionVehicleType,
  points: MovementPathPoint[],
): string {
  return [
    geometry.extractedAt,
    participantType,
    ...points.map(
      (point) =>
        `${Math.round(point.position.x * 10)}:${Math.round(point.position.y * 10)}`,
    ),
  ].join("|");
}

function evaluateAuthoredRouteFeatures(
  geometry: RealSceneGeometry,
  points: MovementPathPoint[],
  participantType: ReconstructionVehicleType,
): ReconstructionRouteFeatures | null {
  if (points.length < 3) return null;
  const graph = createRoadGraph(geometry);
  const local = points.map((point) => sceneToLocalMetres(point.position, geometry));
  const coverage = containmentRatio(local, graph);
  const minimumRadius = minimumCurveRadius(local);
  const requiredRadius = requiredTurnRadius(participantType, points[0].speedKmh);
  const curvatureCompliance = Number.isFinite(minimumRadius)
    ? clamp(minimumRadius / Math.max(0.1, requiredRadius), 0, 1)
    : 1;
  const routeLength = Math.max(0.001, polylineLength(local));
  const directDistance = Math.max(0.001, distance(local[0], local[local.length - 1]));
  const firstDirection = normalise(subtract(local[1], local[0]));
  const finalDirection = normalise(
    subtract(local[local.length - 1], local[local.length - 2]),
  );
  const firstRoad = nearestRoadDistance(local[0], graph);
  const finalRoad = nearestRoadDistance(local[local.length - 1], graph);

  return {
    roadContainment: coverage,
    startAlignment: clamp(
      (dot(firstDirection, screenHeadingVector(points[0].rotation)) + 1) / 2,
      0,
      1,
    ),
    arrivalAlignment: clamp(
      (dot(finalDirection, screenHeadingVector(points[points.length - 1].rotation)) + 1) / 2,
      0,
      1,
    ),
    curvatureCompliance,
    directness: clamp(directDistance / routeLength, 0, 1),
    laneContinuity: coverage,
    turnEfficiency: clamp(1 - totalTurnDegrees(local) / 520, 0, 1),
    vehicleSuitability: curvatureCompliance,
    snapQuality: clamp(
      1 - (firstRoad.distanceMetres + finalRoad.distanceMetres) / 18,
      0,
      1,
    ),
  };
}

export function setActiveReconstructionRoadGeometry(
  geometry: RealSceneGeometry | null,
): void {
  activeGeometry = geometry;
}

export function clearActiveReconstructionRoadGeometry(
  geometry?: RealSceneGeometry,
): void {
  if (!geometry || activeGeometry === geometry) activeGeometry = null;
}

export function getActiveReconstructionRoadGeometry(): RealSceneGeometry | null {
  return activeGeometry;
}

export function getLastRoadRouteRecommendation(): ReconstructionRoadRouteRecommendation {
  return { ...lastRecommendation };
}

export function isAutoRoadCurvePoint(point: MovementPathPoint): boolean {
  return point.notes?.includes(AUTO_ROAD_CURVE_NOTE_MARKER) === true;
}

/**
 * Learns from a route after an investigator has converted at least one
 * generated point into a normal authored point. The deterministic planner still
 * owns validity; learning only changes candidate preference.
 */
export function learnFromInvestigatorRoadRoute(
  authored: MovementPathPoint[],
  participantType: ReconstructionVehicleType,
): boolean {
  const geometry = activeGeometry;
  if (!geometry || !isRoadFollowingParticipant(participantType)) return false;
  if (authored.length < 3 || authored.slice(1, -1).every(isAutoRoadCurvePoint)) {
    return false;
  }

  const signature = routeLearningSignature(geometry, participantType, authored);
  if (hasLearnedRoutePreference(signature)) return false;

  const preferred = evaluateAuthoredRouteFeatures(
    geometry,
    authored,
    participantType,
  );
  if (!preferred) return false;
  const alternatives = rankReconstructionRoutes(
    buildRankedCandidates(
      geometry,
      authored[0],
      authored[authored.length - 1],
      participantType,
    ),
  );
  const rejected = alternatives[0]?.features;
  if (!rejected) return false;

  return learnRoutePreference(
    preferred,
    rejected,
    signature,
  );
}

export function createRoadAlignedParticipantRoute({
  startPoint,
  impactPoint,
  participantType,
  durationSeconds,
  createId,
}: CreateRoadAlignedIntermediatePointsOptions): RoadAlignedParticipantRoutePlan | null {
  const geometry = activeGeometry;
  if (!geometry || geometry.roads.length === 0) {
    lastRecommendation = {
      available: false,
      confidence: 0,
      candidateCount: 0,
      reason: "No extracted road geometry is available.",
    };
    return null;
  }
  if (!isRoadFollowingParticipant(participantType)) return null;

  const ranked = rankReconstructionRoutes(
    buildRankedCandidates(
      geometry,
      startPoint,
      impactPoint,
      participantType,
    ),
  );
  const selected = ranked[0];
  if (!selected || selected.confidence < 0.54) {
    lastRecommendation = {
      available: false,
      confidence: selected?.confidence ?? 0,
      candidateCount: ranked.length,
      reason:
        ranked.length === 0
          ? "No road-contained route connects Point 1 to Point Z."
          : "All generated routes were below the safety confidence threshold.",
    };
    return null;
  }

  const sampled = selected.value.sampledPoints;
  if (sampled.length < 2) return null;

  // The participant must spawn exactly where the investigator clicked.
  // Route evaluation starts at the centreline projection, so re-attach the
  // exact click as the first route point and let the vehicle merge onto the
  // road instead of teleporting it sideways to the centreline.
  /*
   * Point 1 represents the investigator-selected lane position.
   *
   * The generated route starts on the road centreline. Connecting Point 1
   * directly to that centreline creates a short sideways segment, causing the
   * participant to face across the road.
   *
   * Preserve the initial lateral lane offset while travelling forward, then
   * merge gradually onto the generated route.
   */
  const startLocal =
    sceneToLocalMetres(
      startPoint.position,
      geometry,
    );

  const projectedStart =
    sampled[0];

  const startOffset = {
    x:
      startLocal.x -
      projectedStart.x,
    y:
      startLocal.y -
      projectedStart.y,
  };

  const mergeDistance =
    vectorLength(
      startOffset,
    );

  const sampledCumulative:
    number[] = [0];

  for (
    let index = 1;
    index < sampled.length;
    index += 1
  ) {
    sampledCumulative.push(
      sampledCumulative[
        index - 1
      ] +
        distance(
          sampled[index - 1],
          sampled[index],
        ),
    );
  }

  const leadInDistanceMetres =
    clamp(
      participantSampleSpacing(
        participantType,
      ) * 2.2,
      4.5,
      8,
    );

  const mergeLengthMetres =
    clamp(
      Math.max(
        12,
        mergeDistance * 5.5,
      ),
      12,
      26,
    );

  let routePoints =
    mergeDistance <= 0.25
      ? sampled.map(
          (point) => ({
            ...point,
          }),
        )
      : sampled.map(
          (
            point,
            index,
          ) => {
            if (index === 0) {
              return {
                ...startLocal,
              };
            }

            const distanceAfterLeadIn =
              Math.max(
                0,
                sampledCumulative[
                  index
                ] -
                  leadInDistanceMetres,
              );

            const mergeProgress =
              clamp(
                distanceAfterLeadIn /
                  mergeLengthMetres,
                0,
                1,
              );

            const remainingOffset =
              Math.pow(
                1 -
                  mergeProgress,
                2,
              );

            return {
              x:
                point.x +
                startOffset.x *
                  remainingOffset,
              y:
                point.y +
                startOffset.y *
                  remainingOffset,
            };
          },
        );

  /*
   * [RoadSafe:MetricRouteTopologyAppliedV1]
   *
   * Validate the complete lane-offset route after merging the investigator's
   * exact Point 1 position onto the generated road path.
   */
  const impactLocal =
    sceneToLocalMetres(
      impactPoint.position,
      geometry,
    );

  const topology =
    normaliseMetricRouteTopology(
      routePoints,
      impactLocal,
      participantType,
    );

  if (
    !topology.valid ||
    topology.points.length <
      2
  ) {
    lastRecommendation = {
      available: false,
      confidence:
        selected.confidence,
      candidateCount:
        ranked.length,
      reason:
        topology.issues[0]
          ?.message ??
        "The selected route failed the physical topology checks.",
    };

    return null;
  }

  routePoints =
    topology.points;

  const cumulative: number[] = [0];
  for (let index = 1; index < routePoints.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        distance(routePoints[index - 1], routePoints[index]),
    );
  }

  const total = Math.max(
    0.001,
    cumulative[cumulative.length - 1],
  );
  const impactTime = clamp(
    impactPoint.timeSeconds,
    0.1,
    Math.max(0.1, durationSeconds - 0.05),
  );
  const confidencePercent = Math.round(
    selected.confidence * 100,
  );

  lastRecommendation = {
    available: true,
    confidence: selected.confidence,
    candidateCount: ranked.length,
    reason: `Selected from ${ranked.length} road-valid candidate routes.`,
  };

  const routeStart = routePoints[0];
  const startDirectionTarget = routePoints[1] ?? routePoints[0];
  const alignedStartPoint: MovementPathPoint = {
    ...startPoint,
    position: { ...startPoint.position },
    rotation: headingDegrees(
      routeStart,
      startDirectionTarget,
      startPoint.rotation,
    ),
    notes: [
      startPoint.notes ?? "",
      "[RoadSafe:RoadSnappedStart]",
      `${ROUTE_CONFIDENCE_NOTE_PREFIX}${confidencePercent}]`,
    ]
      .filter(Boolean)
      .join("\n"),
  };

  const intermediatePoints = routePoints
    .slice(1, -1)
    .map((point, intermediateIndex) => {
      const sourceIndex = intermediateIndex + 1;
      const progress = cumulative[sourceIndex] / total;
      const previous = routePoints[Math.max(0, sourceIndex - 1)];
      const next = routePoints[
        Math.min(routePoints.length - 1, sourceIndex + 1)
      ];
      const speedProgress =
        progress * progress * (3 - 2 * progress);

      return {
        id: createId(AUTO_ROAD_CURVE_ID_PREFIX.slice(0, -1)),
        label: `AI road route ${intermediateIndex + 1}`,
        position: localMetresToScene(point, geometry),
        timeSeconds: Number((impactTime * progress).toFixed(3)),
        speedKmh: Number(
          (
            startPoint.speedKmh +
            (impactPoint.speedKmh - startPoint.speedKmh) *
              speedProgress
          ).toFixed(2),
        ),
        rotation: headingDegrees(
          previous,
          next,
          alignedStartPoint.rotation,
        ),
        action: "Cruise" as const,
        notes: `${AUTO_ROAD_CURVE_NOTE_MARKER}\n${ROUTE_CONFIDENCE_NOTE_PREFIX}${confidencePercent}]`,
      };
    });

  return {
    startPoint: alignedStartPoint,
    intermediatePoints,
    confidence: selected.confidence,
  };
}

/*
 * [RoadSafe:ActiveMetricRouteStabiliserV1]
 *
 * Cleans persisted automatic-road anchors using the active extracted scene's
 * real metre dimensions. Investigator-created anchors are not passed here.
 */
export function stabiliseAutomaticRoadMovementRoute(
  route:
    MovementPathPoint[],
  collisionPosition:
    ReconstructionPosition,
  participantType:
    ReconstructionVehicleType,
): MovementPathPoint[] {
  const geometry =
    activeGeometry;

  if (
    !geometry ||
    route.length < 2
  ) {
    return route;
  }

  const metricPoints =
    route.map(
      (point) =>
        sceneToLocalMetres(
          point.position,
          geometry,
        ),
    );

  const metricCollision =
    sceneToLocalMetres(
      collisionPosition,
      geometry,
    );

  const topology =
    normaliseMetricRouteTopology(
      metricPoints,
      metricCollision,
      participantType,
      {
        appendImpactPoint:
          false,
      },
    );

  const retained =
    topology
      .keptSourceIndices
      .filter(
        (sourceIndex) =>
          sourceIndex >= 0 &&
          sourceIndex <
            route.length,
      )
      .map(
        (sourceIndex) =>
          route[
            sourceIndex
          ],
      );

  return retained.length > 0
    ? retained
    : [
        route[0],
      ];
}

/**
 * Backward-compatible helper retained for callers that only need generated
 * intermediate points. New route authoring should use
 * createRoadAlignedParticipantRoute so Point 1 is snapped and aligned too.
 */
export function createRoadAlignedIntermediatePoints(
  options: CreateRoadAlignedIntermediatePointsOptions,
): MovementPathPoint[] {
  return (
    createRoadAlignedParticipantRoute(options)?.intermediatePoints ?? []
  );
}
