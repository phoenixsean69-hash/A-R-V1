import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const files = {
  topology:
    "src/utils/reconstructionRouteTopology.ts",

  routing:
    "src/utils/reconstructionRoadRouting.ts",

  authoring:
    "src/utils/participantRouteAuthoring.ts",

  verifier:
    "scripts/verify-route-topology.mjs",

  package:
    "package.json",
};

function absolute(
  relativePath,
) {
  return path.join(
    root,
    relativePath,
  );
}

function read(
  relativePath,
) {
  return fs
    .readFileSync(
      absolute(relativePath),
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function write(
  relativePath,
  content,
) {
  fs.mkdirSync(
    path.dirname(
      absolute(relativePath),
    ),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    absolute(relativePath),
    content.replace(
      /\r\n/g,
      "\n",
    ),
    "utf8",
  );
}

function replaceOnce(
  content,
  search,
  replacement,
  description,
) {
  if (!content.includes(search)) {
    throw new Error(
      `Could not patch ${description}.`,
    );
  }

  return content.replace(
    search,
    replacement,
  );
}

function replaceRange(
  content,
  startMarker,
  endMarker,
  replacement,
  description,
) {
  const start =
    content.indexOf(
      startMarker,
    );

  if (start < 0) {
    throw new Error(
      `Could not find the start of ${description}.`,
    );
  }

  const end =
    content.indexOf(
      endMarker,
      start,
    );

  if (end < 0) {
    throw new Error(
      `Could not find the end of ${description}.`,
    );
  }

  return (
    content.slice(
      0,
      start,
    ) +
    replacement.trimEnd() +
    "\n\n" +
    content.slice(end)
  );
}

function functionRange(
  content,
  signature,
) {
  const start =
    content.indexOf(
      signature,
    );

  if (start < 0) {
    throw new Error(
      `Function not found: ${signature}`,
    );
  }

  /*
   * Locate the real function-body brace.
   *
   * The previous parser selected the first brace after the function name.
   * For a function declared with a destructured argument:
   *
   *   function example({ value }) {
   *
   * that first brace belongs to the parameter, not the function body.
   */
  const parameterStart =
    content.indexOf(
      "(",
      start,
    );

  if (parameterStart < 0) {
    throw new Error(
      `Parameter list not found: ${signature}`,
    );
  }

  let parameterEnd = -1;
  let parenthesisDepth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (
    let index = parameterStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "(") {
      parenthesisDepth += 1;
      continue;
    }

    if (character === ")") {
      parenthesisDepth -= 1;

      if (parenthesisDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }

  if (parameterEnd < 0) {
    throw new Error(
      `Parameter list did not close: ${signature}`,
    );
  }

  const openingBrace =
    content.indexOf(
      "{",
      parameterEnd + 1,
    );

  if (openingBrace < 0) {
    throw new Error(
      `Function body not found: ${signature}`,
    );
  }

  let depth = 0;
  quote = null;
  escaped = false;
  lineComment = false;
  blockComment = false;

  for (
    let index = openingBrace;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end:
            index + 1,
        };
      }
    }
  }

  throw new Error(
    `Closing brace not found: ${signature}`,
  );
}

const timestamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupRoot =
  path.join(
    root,
    ".roadsafe-patch-backups",
    `phase0-route-topology-${timestamp}`,
  );

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  },
);

for (
  const relativePath
  of [
    files.routing,
    files.authoring,
    files.package,
  ]
) {
  fs.copyFileSync(
    absolute(relativePath),
    path.join(
      backupRoot,
      path.basename(
        relativePath,
      ),
    ),
  );
}

const topologySource = `import type {
  ReconstructionVehicleType,
} from "../types/reconstruction";

/*
 * [RoadSafe:MetricRouteTopologyV1]
 *
 * All automatic-route topology checks operate in physical metres.
 * Percentage-based editor coordinates are converted before entering this
 * module.
 */

export interface MetricRoutePoint {
  x: number;
  y: number;
}

export type RouteTopologyIssueCode =
  | "InvalidPoint"
  | "DuplicatePoint"
  | "SelfIntersection"
  | "CatastrophicJump"
  | "SevereDetour"
  | "RouteReversal"
  | "ReverseAfterApproach"
  | "PostCaptureContinuation";

export interface RouteTopologyIssue {
  code: RouteTopologyIssueCode;
  sourceIndex: number;
  message: string;
  critical: boolean;
}

export interface MetricRouteTopologyOptions {
  appendImpactPoint?: boolean;
}

export interface MetricRouteTopologyResult {
  points: MetricRoutePoint[];
  keptSourceIndices: number[];
  issues: RouteTopologyIssue[];
  valid: boolean;
  capturedImpact: boolean;
}

interface IndexedMetricPoint {
  point: MetricRoutePoint;
  sourceIndex: number;
}

interface RouteTopologyProfile {
  collisionCaptureMetres: number;
  minimumPointSpacingMetres: number;
  maximumJumpMetres: number;
  moveAwayToleranceMetres: number;
}

const EPSILON =
  0.000001;

const CRITICAL_ISSUES =
  new Set<RouteTopologyIssueCode>([
    "SelfIntersection",
    "CatastrophicJump",
    "SevereDetour",
    "RouteReversal",
    "ReverseAfterApproach",
    "PostCaptureContinuation",
  ]);

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function finitePoint(
  point: MetricRoutePoint,
): boolean {
  return (
    Number.isFinite(
      point.x,
    ) &&
    Number.isFinite(
      point.y,
    )
  );
}

function distance(
  first: MetricRoutePoint,
  second: MetricRoutePoint,
): number {
  return Math.hypot(
    second.x - first.x,
    second.y - first.y,
  );
}

function subtract(
  end: MetricRoutePoint,
  start: MetricRoutePoint,
): MetricRoutePoint {
  return {
    x:
      end.x -
      start.x,

    y:
      end.y -
      start.y,
  };
}

function dot(
  first: MetricRoutePoint,
  second: MetricRoutePoint,
): number {
  return (
    first.x *
      second.x +
    first.y *
      second.y
  );
}

function cross(
  first: MetricRoutePoint,
  second: MetricRoutePoint,
): number {
  return (
    first.x *
      second.y -
    first.y *
      second.x
  );
}

function magnitude(
  vector: MetricRoutePoint,
): number {
  return Math.hypot(
    vector.x,
    vector.y,
  );
}

function angleDegrees(
  first: MetricRoutePoint,
  second: MetricRoutePoint,
): number {
  const firstLength =
    magnitude(first);

  const secondLength =
    magnitude(second);

  if (
    firstLength < EPSILON ||
    secondLength < EPSILON
  ) {
    return 0;
  }

  const cosine =
    clamp(
      dot(
        first,
        second,
      ) /
        (
          firstLength *
          secondLength
        ),
      -1,
      1,
    );

  return (
    Math.acos(
      cosine,
    ) *
    180
  ) / Math.PI;
}

function samePoint(
  first: MetricRoutePoint,
  second: MetricRoutePoint,
  tolerance = 0.001,
): boolean {
  return (
    distance(
      first,
      second,
    ) <= tolerance
  );
}

function orientation(
  first: MetricRoutePoint,
  second: MetricRoutePoint,
  third: MetricRoutePoint,
): number {
  return cross(
    subtract(
      second,
      first,
    ),
    subtract(
      third,
      first,
    ),
  );
}

function pointOnSegment(
  point: MetricRoutePoint,
  start: MetricRoutePoint,
  end: MetricRoutePoint,
): boolean {
  if (
    Math.abs(
      orientation(
        start,
        end,
        point,
      ),
    ) > 0.0001
  ) {
    return false;
  }

  return (
    point.x >=
      Math.min(
        start.x,
        end.x,
      ) -
        0.0001 &&
    point.x <=
      Math.max(
        start.x,
        end.x,
      ) +
        0.0001 &&
    point.y >=
      Math.min(
        start.y,
        end.y,
      ) -
        0.0001 &&
    point.y <=
      Math.max(
        start.y,
        end.y,
      ) +
        0.0001
  );
}

function segmentsIntersect(
  firstStart: MetricRoutePoint,
  firstEnd: MetricRoutePoint,
  secondStart: MetricRoutePoint,
  secondEnd: MetricRoutePoint,
): boolean {
  if (
    samePoint(
      firstStart,
      secondStart,
    ) ||
    samePoint(
      firstStart,
      secondEnd,
    ) ||
    samePoint(
      firstEnd,
      secondStart,
    ) ||
    samePoint(
      firstEnd,
      secondEnd,
    )
  ) {
    return false;
  }

  const firstOrientation =
    orientation(
      firstStart,
      firstEnd,
      secondStart,
    );

  const secondOrientation =
    orientation(
      firstStart,
      firstEnd,
      secondEnd,
    );

  const thirdOrientation =
    orientation(
      secondStart,
      secondEnd,
      firstStart,
    );

  const fourthOrientation =
    orientation(
      secondStart,
      secondEnd,
      firstEnd,
    );

  const properIntersection =
    (
      firstOrientation > EPSILON &&
      secondOrientation < -EPSILON
    ) ||
    (
      firstOrientation < -EPSILON &&
      secondOrientation > EPSILON
    );

  const reverseIntersection =
    (
      thirdOrientation > EPSILON &&
      fourthOrientation < -EPSILON
    ) ||
    (
      thirdOrientation < -EPSILON &&
      fourthOrientation > EPSILON
    );

  if (
    properIntersection &&
    reverseIntersection
  ) {
    return true;
  }

  return (
    (
      Math.abs(
        firstOrientation,
      ) <= EPSILON &&
      pointOnSegment(
        secondStart,
        firstStart,
        firstEnd,
      )
    ) ||
    (
      Math.abs(
        secondOrientation,
      ) <= EPSILON &&
      pointOnSegment(
        secondEnd,
        firstStart,
        firstEnd,
      )
    ) ||
    (
      Math.abs(
        thirdOrientation,
      ) <= EPSILON &&
      pointOnSegment(
        firstStart,
        secondStart,
        secondEnd,
      )
    ) ||
    (
      Math.abs(
        fourthOrientation,
      ) <= EPSILON &&
      pointOnSegment(
        firstEnd,
        secondStart,
        secondEnd,
      )
    )
  );
}

function pointToSegmentDistance(
  point: MetricRoutePoint,
  start: MetricRoutePoint,
  end: MetricRoutePoint,
): number {
  const segment =
    subtract(
      end,
      start,
    );

  const segmentLengthSquared =
    dot(
      segment,
      segment,
    );

  if (
    segmentLengthSquared <
    EPSILON
  ) {
    return distance(
      point,
      start,
    );
  }

  const progress =
    clamp(
      dot(
        subtract(
          point,
          start,
        ),
        segment,
      ) /
        segmentLengthSquared,
      0,
      1,
    );

  const projected = {
    x:
      start.x +
      segment.x *
        progress,

    y:
      start.y +
      segment.y *
        progress,
  };

  return distance(
    point,
    projected,
  );
}

function median(
  values: number[],
): number {
  if (
    values.length === 0
  ) {
    return 0;
  }

  const sorted = [
    ...values,
  ].sort(
    (
      first,
      second,
    ) =>
      first -
      second,
  );

  const middle =
    Math.floor(
      sorted.length /
        2,
    );

  if (
    sorted.length %
      2 ===
    0
  ) {
    return (
      sorted[
        middle -
        1
      ] +
      sorted[
        middle
      ]
    ) / 2;
  }

  return sorted[
    middle
  ];
}

function profileFor(
  participantType:
    ReconstructionVehicleType,
): RouteTopologyProfile {
  switch (
    participantType
  ) {
    case "Bus":
      return {
        collisionCaptureMetres:
          2.2,

        minimumPointSpacingMetres:
          0.3,

        maximumJumpMetres:
          42,

        moveAwayToleranceMetres:
          2,
      };

    case "Truck":
      return {
        collisionCaptureMetres:
          2,

        minimumPointSpacingMetres:
          0.28,

        maximumJumpMetres:
          38,

        moveAwayToleranceMetres:
          1.8,
      };

    case "Motorcycle":
      return {
        collisionCaptureMetres:
          1,

        minimumPointSpacingMetres:
          0.16,

        maximumJumpMetres:
          28,

        moveAwayToleranceMetres:
          1.25,
      };

    case "Bicycle":
      return {
        collisionCaptureMetres:
          0.8,

        minimumPointSpacingMetres:
          0.14,

        maximumJumpMetres:
          20,

        moveAwayToleranceMetres:
          1,
      };

    case "Pedestrian":
    case "Officer":
    case "Witness":
      return {
        collisionCaptureMetres:
          0.65,

        minimumPointSpacingMetres:
          0.1,

        maximumJumpMetres:
          12,

        moveAwayToleranceMetres:
          0.8,
      };

    case "Car":
    default:
      return {
        collisionCaptureMetres:
          1.5,

        minimumPointSpacingMetres:
          0.22,

        maximumJumpMetres:
          32,

        moveAwayToleranceMetres:
          1.4,
      };
  }
}

function addIssue(
  issues: RouteTopologyIssue[],
  code: RouteTopologyIssueCode,
  sourceIndex: number,
  message: string,
): void {
  issues.push({
    code,
    sourceIndex,
    message,
    critical:
      CRITICAL_ISSUES.has(
        code,
      ),
  });
}

function wouldCreateSelfIntersection(
  accepted: IndexedMetricPoint[],
  candidate: MetricRoutePoint,
): boolean {
  if (
    accepted.length < 3
  ) {
    return false;
  }

  const newStart =
    accepted[
      accepted.length -
      1
    ].point;

  for (
    let index = 0;
    index <
    accepted.length -
      2;
    index += 1
  ) {
    if (
      segmentsIntersect(
        accepted[index]
          .point,
        accepted[index + 1]
          .point,
        newStart,
        candidate,
      )
    ) {
      return true;
    }
  }

  return false;
}

function connectionToImpactIntersects(
  accepted: IndexedMetricPoint[],
  impactPoint: MetricRoutePoint,
): boolean {
  if (
    accepted.length < 3
  ) {
    return false;
  }

  const finalStart =
    accepted[
      accepted.length -
      1
    ].point;

  for (
    let index = 0;
    index <
    accepted.length -
      2;
    index += 1
  ) {
    if (
      segmentsIntersect(
        accepted[index]
          .point,
        accepted[index + 1]
          .point,
        finalStart,
        impactPoint,
      )
    ) {
      return true;
    }
  }

  return false;
}

function inspectOriginalSelfIntersections(
  entries: IndexedMetricPoint[],
  issues: RouteTopologyIssue[],
): void {
  for (
    let firstIndex = 0;
    firstIndex <
    entries.length -
      1;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex +
        2;
      secondIndex <
      entries.length -
        1;
      secondIndex += 1
    ) {
      if (
        segmentsIntersect(
          entries[
            firstIndex
          ].point,
          entries[
            firstIndex +
            1
          ].point,
          entries[
            secondIndex
          ].point,
          entries[
            secondIndex +
            1
          ].point,
        )
      ) {
        addIssue(
          issues,
          "SelfIntersection",
          entries[
            secondIndex +
            1
          ].sourceIndex,
          "The generated route crosses an earlier route segment.",
        );

        return;
      }
    }
  }
}

export function normaliseMetricRouteTopology(
  sourcePoints:
    MetricRoutePoint[],
  impactPoint:
    MetricRoutePoint,
  participantType:
    ReconstructionVehicleType,
  options:
    MetricRouteTopologyOptions = {},
): MetricRouteTopologyResult {
  const appendImpactPoint =
    options
      .appendImpactPoint ??
    true;

  const profile =
    profileFor(
      participantType,
    );

  const issues:
    RouteTopologyIssue[] = [];

  const entries:
    IndexedMetricPoint[] = [];

  sourcePoints.forEach(
    (
      point,
      sourceIndex,
    ) => {
      if (
        !finitePoint(
          point,
        )
      ) {
        addIssue(
          issues,
          "InvalidPoint",
          sourceIndex,
          "The route contains a non-finite coordinate.",
        );

        return;
      }

      const previous =
        entries[
          entries.length -
          1
        ];

      if (
        previous &&
        distance(
          previous.point,
          point,
        ) <
          profile
            .minimumPointSpacingMetres
      ) {
        addIssue(
          issues,
          "DuplicatePoint",
          sourceIndex,
          "The route contains a duplicate or near-duplicate sample.",
        );

        return;
      }

      entries.push({
        point: {
          ...point,
        },
        sourceIndex,
      });
    },
  );

  if (
    entries.length === 0 ||
    !finitePoint(
      impactPoint,
    )
  ) {
    return {
      points: [],
      keptSourceIndices: [],
      issues,
      valid: false,
      capturedImpact: false,
    };
  }

  inspectOriginalSelfIntersections(
    entries,
    issues,
  );

  const segmentLengths =
    entries
      .slice(
        1,
      )
      .map(
        (
          entry,
          index,
        ) =>
          distance(
            entries[index]
              .point,
            entry.point,
          ),
      )
      .filter(
        (length) =>
          length >
          profile
            .minimumPointSpacingMetres,
      );

  const medianSegmentLength =
    median(
      segmentLengths,
    );

  const dynamicMaximumJump =
    Math.max(
      profile
        .maximumJumpMetres,
      medianSegmentLength *
        4.5,
    );

  const directDistance =
    Math.max(
      0.001,
      distance(
        entries[0]
          .point,
        impactPoint,
      ),
    );

  const nearImpactThreshold =
    Math.max(
      profile
        .collisionCaptureMetres *
        3,
      Math.min(
        12,
        directDistance *
          0.28,
      ),
    );

  const accepted:
    IndexedMetricPoint[] = [
    entries[0],
  ];

  let bestImpactDistance =
    distance(
      entries[0]
        .point,
      impactPoint,
    );

  let capturedImpact =
    false;

  for (
    let index = 1;
    index <
    entries.length;
    index += 1
  ) {
    const current =
      entries[index];

    const previous =
      accepted[
        accepted.length -
        1
      ];

    const next =
      entries[
        index +
        1
      ];

    const segmentLength =
      distance(
        previous.point,
        current.point,
      );

    const contactDistance =
      pointToSegmentDistance(
        impactPoint,
        previous.point,
        current.point,
      );

    if (
      contactDistance <=
      profile
        .collisionCaptureMetres
    ) {
      capturedImpact =
        true;

      if (
        index <
        entries.length -
          1
      ) {
        addIssue(
          issues,
          "PostCaptureContinuation",
          current.sourceIndex,
          "The generated route continues after reaching the collision capture area.",
        );
      }

      break;
    }

    const previousImpactDistance =
      distance(
        previous.point,
        impactPoint,
      );

    const currentImpactDistance =
      distance(
        current.point,
        impactPoint,
      );

    const travelDirection =
      subtract(
        current.point,
        previous.point,
      );

    const directionToImpact =
      subtract(
        impactPoint,
        previous.point,
      );

    const travellingAway =
      dot(
        travelDirection,
        directionToImpact,
      ) < 0;

    const enteredFinalApproach =
      bestImpactDistance <=
      nearImpactThreshold;

    const movedSubstantiallyAway =
      currentImpactDistance >
      bestImpactDistance +
        profile
          .moveAwayToleranceMetres;

    const catastrophicJump =
      segmentLength >
        dynamicMaximumJump &&
      currentImpactDistance >
        previousImpactDistance +
          profile
            .moveAwayToleranceMetres;

    if (
      catastrophicJump
    ) {
      addIssue(
        issues,
        "CatastrophicJump",
        current.sourceIndex,
        \`The route jumps \${segmentLength.toFixed(2)} metres away from its previous road sample.\`,
      );

      continue;
    }

    if (
      travellingAway &&
      enteredFinalApproach &&
      movedSubstantiallyAway
    ) {
      addIssue(
        issues,
        "ReverseAfterApproach",
        current.sourceIndex,
        "The route reverses away from Point Z after beginning its final approach.",
      );

      continue;
    }

    if (next) {
      const bridgeDistance =
        distance(
          previous.point,
          next.point,
        );

      const detourDistance =
        segmentLength +
        distance(
          current.point,
          next.point,
        );

      const detourRatio =
        detourDistance /
        Math.max(
          0.1,
          bridgeDistance,
        );

      const nextImpactDistance =
        distance(
          next.point,
          impactPoint,
        );

      const currentIsFarther =
        currentImpactDistance >
        Math.min(
          previousImpactDistance,
          nextImpactDistance,
        ) +
          profile
            .moveAwayToleranceMetres;

      const severeDetour =
        detourRatio >
          3.5 &&
        detourDistance -
          bridgeDistance >
          Math.max(
            8,
            profile
              .maximumJumpMetres *
              0.35,
          ) &&
        currentIsFarther;

      if (
        severeDetour
      ) {
        addIssue(
          issues,
          "SevereDetour",
          current.sourceIndex,
          \`The route contains a \${detourRatio.toFixed(2)}× unnecessary detour between neighbouring samples.\`,
        );

        continue;
      }

      const incomingDirection =
        subtract(
          current.point,
          previous.point,
        );

      const outgoingDirection =
        subtract(
          next.point,
          current.point,
        );

      const turnAngle =
        angleDegrees(
          incomingDirection,
          outgoingDirection,
        );

      const routeReversal =
        turnAngle >
          155 &&
        currentIsFarther;

      if (
        routeReversal
      ) {
        addIssue(
          issues,
          "RouteReversal",
          current.sourceIndex,
          \`The route performs an unsupported \${turnAngle.toFixed(1)}° reversal.\`,
        );

        continue;
      }
    }

    if (
      wouldCreateSelfIntersection(
        accepted,
        current.point,
      )
    ) {
      addIssue(
        issues,
        "SelfIntersection",
        current.sourceIndex,
        "The route sample would make the path cross itself.",
      );

      continue;
    }

    accepted.push(
      current,
    );

    bestImpactDistance =
      Math.min(
        bestImpactDistance,
        currentImpactDistance,
      );
  }

  if (
    appendImpactPoint
  ) {
    while (
      accepted.length >
        1 &&
      connectionToImpactIntersects(
        accepted,
        impactPoint,
      )
    ) {
      const removed =
        accepted.pop();

      if (removed) {
        addIssue(
          issues,
          "SelfIntersection",
          removed.sourceIndex,
          "A route anchor was removed because the final connection to Point Z crossed the route.",
        );
      }
    }

    const finalAccepted =
      accepted[
        accepted.length -
        1
      ];

    if (
      !samePoint(
        finalAccepted.point,
        impactPoint,
        profile
          .minimumPointSpacingMetres,
      )
    ) {
      accepted.push({
        point: {
          ...impactPoint,
        },

        sourceIndex:
          -1,
      });
    }
    else {
      finalAccepted.point = {
        ...impactPoint,
      };
    }
  }

  const criticalIssue =
    issues.some(
      (issue) =>
        issue.critical,
    );

  return {
    points:
      accepted.map(
        (entry) => ({
          ...entry.point,
        }),
      ),

    keptSourceIndices:
      accepted.map(
        (entry) =>
          entry
            .sourceIndex,
      ),

    issues,

    valid:
      !criticalIssue &&
      accepted.length >=
        (
          appendImpactPoint
            ? 2
            : 1
        ),

    capturedImpact,
  };
}
`;

write(
  files.topology,
  topologySource,
);

let routing =
  read(
    files.routing,
  );

const topologyImport =
`import {
  normaliseMetricRouteTopology,
} from "./reconstructionRouteTopology";
`;

if (
  !routing.includes(
    'from "./reconstructionRouteTopology"',
  )
) {
  routing =
    topologyImport +
    "\n" +
    routing;
}

const spawnMarker =
`/*
 * [RoadSafe:SpawnRouteDirectionGuardV1]`;

if (
  routing.includes(
    spawnMarker,
  )
) {
  routing =
    replaceRange(
      routing,
      spawnMarker,
      "function evaluateRoute(",
`/*
 * Route direction, reversal, detour and collision-capture checks are now
 * performed by reconstructionRouteTopology in physical metres.
 */`,
      "legacy spawn-direction guards",
    );
}

{
  const range =
    functionRange(
      routing,
      "function evaluateRoute(",
    );

  let section =
    routing.slice(
      range.start,
      range.end,
    );

  const sampleStart =
    section.indexOf(
      "  const rounded = roundPolylineCorners(",
    );

  const coverageStart =
    section.indexOf(
      "  const coverage = containmentRatio(",
      sampleStart,
    );

  if (
    sampleStart < 0 ||
    coverageStart < 0
  ) {
    throw new Error(
      "Could not locate evaluateRoute sampling block.",
    );
  }

  const replacement =
`  const rounded =
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

`;

  section =
    section.slice(
      0,
      sampleStart,
    ) +
    replacement +
    section.slice(
      coverageStart,
    );

  routing =
    routing.slice(
      0,
      range.start,
    ) +
    section +
    routing.slice(
      range.end,
    );
}

{
  const range =
    functionRange(
      routing,
      "export function createRoadAlignedParticipantRoute(",
    );

  let section =
    routing.slice(
      range.start,
      range.end,
    );

  const trimMarker =
    section.indexOf(
      "  /*\n   * [RoadSafe:TrimRouteAtCollision]",
    );

  const cumulativeMarker =
    section.indexOf(
      "  const cumulative: number[] = [0];",
      trimMarker,
    );

  if (
    trimMarker < 0 ||
    cumulativeMarker < 0
  ) {
    throw new Error(
      "Could not locate the legacy collision-trimming block.",
    );
  }

  const replacement =
`  /*
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

`;

  section =
    section.slice(
      0,
      trimMarker,
    ) +
    replacement +
    section.slice(
      cumulativeMarker,
    );

  routing =
    routing.slice(
      0,
      range.start,
    ) +
    section +
    routing.slice(
      range.end,
    );
}

const helperMarker =
`/**
 * Backward-compatible helper retained for callers that only need generated`;

if (
  !routing.includes(
    "export function stabiliseAutomaticRoadMovementRoute(",
  )
) {
  const helperIndex =
    routing.indexOf(
      helperMarker,
    );

  if (
    helperIndex < 0
  ) {
    throw new Error(
      "Could not locate road-routing helper insertion point.",
    );
  }

  const helper =
`/*
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
  if (
    !activeGeometry ||
    route.length < 2
  ) {
    return route;
  }

  const metricPoints =
    route.map(
      (point) =>
        sceneToLocalMetres(
          point.position,
          activeGeometry,
        ),
    );

  const metricCollision =
    sceneToLocalMetres(
      collisionPosition,
      activeGeometry,
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

`;

  routing =
    routing.slice(
      0,
      helperIndex,
    ) +
    helper +
    routing.slice(
      helperIndex,
    );
}

if (
  routing.includes(
    "removeInitialSpawnBacktracking(",
  ) ||
  routing.includes(
    "routeStartsByMovingAwayFromImpact(",
  )
) {
  throw new Error(
    "Legacy route guards remain after patching.",
  );
}

write(
  files.routing,
  routing,
);

let authoring =
  read(
    files.authoring,
  );

if (
  !authoring.includes(
    "stabiliseAutomaticRoadMovementRoute,",
  )
) {
  authoring =
    replaceOnce(
      authoring,
      "  createRoadAlignedParticipantRoute,\n",
`  createRoadAlignedParticipantRoute,
  stabiliseAutomaticRoadMovementRoute,
`,
      "route topology import",
    );
}

const oldTopologyStart =
  authoring.indexOf(
    "function collisionRouteTolerance(",
  );

const lockedRouteStart =
  authoring.indexOf(
    "export function createLockedParticipantRoute(",
    oldTopologyStart,
  );

if (
  oldTopologyStart < 0 ||
  lockedRouteStart < 0
) {
  throw new Error(
    "Could not locate the old collision-termination functions.",
  );
}

const newTermination =
`/*
 * [RoadSafe:MetricCollisionTerminatedRouteV2]
 *
 * Point Z is the authoritative end of an approach. Automatic-road anchors are
 * filtered through the active scene's metre-based topology engine before
 * Point Z is appended.
 */
function enforceCollisionTerminatedRoute(
  route:
    MovementPathPoint[],
  collisionPosition:
    ReconstructionPosition,
  participantType:
    ReconstructionVehicleType,
): MovementPathPoint[] {
  if (
    route.length < 2
  ) {
    return route;
  }

  let pointZIndex =
    route.findIndex(
      isPointZ,
    );

  if (
    pointZIndex < 0
  ) {
    pointZIndex =
      route.findIndex(
        (point) =>
          point.action ===
          "Impact",
      );
  }

  if (
    pointZIndex < 1
  ) {
    pointZIndex =
      route.length -
      1;
  }

  const pointZSource =
    route[
      pointZIndex
    ];

  let approach =
    route
      .slice(
        0,
        pointZIndex,
      )
      .filter(
        (point) =>
          !isPointZ(
            point,
          ) &&
          point.action !==
            "Impact",
      );

  if (
    approach.length === 0
  ) {
    approach = [
      route[0],
    ];
  }

  const automaticRoadRoute =
    approach.some(
      (point) =>
        point.notes
          ?.includes(
            AUTO_ROAD_CURVE_NOTE_MARKER,
          ) === true,
    );

  if (
    automaticRoadRoute
  ) {
    approach =
      stabiliseAutomaticRoadMovementRoute(
        approach,
        collisionPosition,
        participantType,
      );
  }

  const pointZ:
    MovementPathPoint = {
    ...pointZSource,

    position: {
      ...collisionPosition,
    },

    action:
      "Impact",

    notes:
      normaliseNotes(
        pointZSource
          .notes,
        POINT_Z_NOTE_MARKER,
      ),
  };

  let terminatedRoute = [
    ...approach,
    pointZ,
  ];

  if (
    automaticRoadRoute &&
    terminatedRoute.length >
      3
  ) {
    terminatedRoute =
      simplifyRouteSection(
        terminatedRoute,
        getRouteSimplificationTolerance(
          participantType,
          true,
        ),
      );

    terminatedRoute =
      markAutomaticRoadTurns(
        terminatedRoute,
      );
  }

  return terminatedRoute;
}
`;

authoring =
  authoring.slice(
    0,
    oldTopologyStart,
  ) +
  newTermination +
  "\n\n" +
  authoring.slice(
    lockedRouteStart,
  );

if (
  authoring.includes(
    "function collisionRouteTolerance(",
  ) ||
  authoring.includes(
    "function routeTravelDotToCollision(",
  )
) {
  throw new Error(
    "Percentage-based collision topology helpers remain.",
  );
}

write(
  files.authoring,
  authoring,
);

const verifierSource = `import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath =
  "src/utils/reconstructionRouteTopology.ts";

const source =
  fs.readFileSync(
    sourcePath,
    "utf8",
  );

const transpiled =
  ts.transpileModule(
    source,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2022,

        module:
          ts.ModuleKind.ES2022,

        moduleResolution:
          ts.ModuleResolutionKind.Bundler,
      },

      fileName:
        sourcePath,

      reportDiagnostics:
        true,
    },
  );

const errors =
  (
    transpiled
      .diagnostics ??
    []
  ).filter(
    (diagnostic) =>
      diagnostic.category ===
      ts.DiagnosticCategory.Error,
  );

if (
  errors.length > 0
) {
  throw new Error(
    errors
      .map(
        (error) =>
          ts.flattenDiagnosticMessageText(
            error.messageText,
            "\\n",
          ),
      )
      .join(
        "\\n",
      ),
  );
}

const temporaryPath =
  path.join(
    os.tmpdir(),
    \`roadsafe-route-topology-\${process.pid}-\${Date.now()}.mjs\`,
  );

fs.writeFileSync(
  temporaryPath,
  transpiled.outputText,
  "utf8",
);

const module =
  await import(
    pathToFileURL(
      temporaryPath,
    ).href +
      \`?v=\${Date.now()}\`
  );

try {
  const normalise =
    module
      .normaliseMetricRouteTopology;

  assert.equal(
    typeof normalise,
    "function",
    "Topology normaliser was not exported.",
  );

  const validCurve =
    normalise(
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: 8,
          y: 1,
        },
        {
          x: 16,
          y: 4,
        },
        {
          x: 24,
          y: 8,
        },
        {
          x: 30,
          y: 10,
        },
      ],
      {
        x: 30,
        y: 10,
      },
      "Car",
    );

  assert.equal(
    validCurve.valid,
    true,
    "A normal curved approach was rejected.",
  );

  assert.deepEqual(
    validCurve
      .points
      .at(-1),
    {
      x: 30,
      y: 10,
    },
    "Point Z was not retained as the endpoint.",
  );

  const liveMalformedRoute =
    normalise(
      [
        {
          x: 10.9494,
          y: 17.1037,
        },
        {
          x: 19.6588,
          y: 22.6891,
        },
        {
          x: 28.026,
          y: 29.4567,
        },
        {
          x: 36.9214,
          y: 34.3993,
        },
        {
          x: 55.1531,
          y: 42.7617,
        },
        {
          x: 0.9162,
          y: 17.8848,
        },
        {
          x: 44.6631,
          y: 37.9502,
        },
      ],
      {
        x: 52.617468,
        y: 42.97575,
      },
      "Car",
    );

  assert.equal(
    liveMalformedRoute
      .points
      .some(
        (point) =>
          Math.abs(
            point.x -
              0.9162,
          ) <
            0.001,
      ),
    false,
    "The catastrophic Point 6 jump survived.",
  );

  assert.equal(
    liveMalformedRoute
      .points
      .some(
        (point) =>
          Math.abs(
            point.x -
              44.6631,
          ) <
            0.001 &&
          Math.abs(
            point.y -
              37.9502,
          ) <
            0.001,
      ),
    false,
    "The post-approach return point survived.",
  );

  assert.equal(
    liveMalformedRoute
      .issues
      .some(
        (issue) =>
          issue.code ===
            "CatastrophicJump" ||
          issue.code ===
            "ReverseAfterApproach" ||
          issue.code ===
            "SevereDetour",
      ),
    true,
    "The malformed live route was not diagnosed.",
  );

  const overshoot =
    normalise(
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: 8,
          y: 0,
        },
        {
          x: 10.4,
          y: 0,
        },
        {
          x: 18,
          y: 0,
        },
      ],
      {
        x: 10,
        y: 0,
      },
      "Car",
    );

  assert.equal(
    overshoot
      .issues
      .some(
        (issue) =>
          issue.code ===
          "PostCaptureContinuation",
      ),
    true,
    "A route continuing beyond collision capture was not diagnosed.",
  );

  assert.deepEqual(
    overshoot
      .points
      .at(-1),
    {
      x: 10,
      y: 0,
    },
    "The overshoot route did not terminate at Point Z.",
  );

  const selfCrossing =
    normalise(
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: 10,
          y: 10,
        },
        {
          x: 0,
          y: 10,
        },
        {
          x: 10,
          y: 0,
        },
      ],
      {
        x: 12,
        y: 0,
      },
      "Car",
    );

  assert.equal(
    selfCrossing
      .issues
      .some(
        (issue) =>
          issue.code ===
          "SelfIntersection",
      ),
    true,
    "A self-intersecting route was not diagnosed.",
  );

  console.log(
    "✓ Valid curved route accepted",
  );

  console.log(
    "✓ Live Point 6 catastrophic jump removed",
  );

  console.log(
    "✓ Post-approach return removed",
  );

  console.log(
    "✓ Collision overshoot terminated",
  );

  console.log(
    "✓ Self-intersection detected",
  );

  const routing =
    fs.readFileSync(
      "src/utils/reconstructionRoadRouting.ts",
      "utf8",
    );

  const authoring =
    fs.readFileSync(
      "src/utils/participantRouteAuthoring.ts",
      "utf8",
    );

  assert.equal(
    routing.includes(
      "SpawnRouteDirectionGuardV1",
    ),
    false,
    "Legacy spawn guard remains.",
  );

  assert.equal(
    routing.includes(
      "TrimRouteAtCollision",
    ),
    false,
    "Legacy collision trim remains.",
  );

  assert.equal(
    authoring.includes(
      "collisionRouteTolerance",
    ),
    false,
    "Percentage collision tolerance remains.",
  );

  assert.equal(
    authoring.includes(
      "routeTravelDotToCollision",
    ),
    false,
    "Percentage travel-dot helper remains.",
  );

  assert.equal(
    routing.includes(
      "MetricRouteTopologyAppliedV1",
    ),
    true,
    "Metric topology was not connected to route generation.",
  );

  assert.equal(
    authoring.includes(
      "MetricCollisionTerminatedRouteV2",
    ),
    true,
    "Metric topology was not connected to route authoring.",
  );

  console.log(
    "\\nPhase 0 metric route-topology verification passed.",
  );
}
finally {
  fs.rmSync(
    temporaryPath,
    {
      force: true,
    },
  );
}
`;

write(
  files.verifier,
  verifierSource,
);

const packageJson =
  JSON.parse(
    read(
      files.package,
    ),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "route:verify"
] =
  "node scripts/verify-route-topology.mjs && tsc -p tsconfig.phase0.json";

write(
  files.package,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) +
    "\n",
);

console.log(
  "\nPhase 0 metric route-topology patch applied.",
);

console.log(
  "Backup:",
  backupRoot,
);

console.log(
  "\nChanged files:",
);

console.log(
  [
    files.topology,
    files.routing,
    files.authoring,
    files.verifier,
    files.package,
  ].join(
    "\n",
  ),
);
