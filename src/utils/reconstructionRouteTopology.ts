import type {
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
        `The route jumps ${segmentLength.toFixed(2)} metres away from its previous road sample.`,
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
          `The route contains a ${detourRatio.toFixed(2)}× unnecessary detour between neighbouring samples.`,
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
          `The route performs an unsupported ${turnAngle.toFixed(1)}° reversal.`,
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
