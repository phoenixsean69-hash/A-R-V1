/*
 * [RoadSafe:CanonicalMotionKinematicsV1]
 *
 * Shared deterministic speed integration and finite-difference sampling.
 * Route playback and the physics engine must not implement separate motion
 * equations.
 */

export interface VelocitySampleWindow {
  beforeTimeSeconds: number;
  afterTimeSeconds: number;
  mode:
    | "Forward"
    | "Central"
    | "Backward"
    | "Stationary";
}

const TIME_EPSILON_SECONDS =
  0.0001;

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

function finiteNonNegative(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function smoothKinematicProgress(
  progress: number,
): number {
  const safe =
    clamp(
      progress,
      0,
      1,
    );

  return (
    safe *
    safe *
    (
      3 -
      2 * safe
    )
  );
}

export function smootherKinematicProgress(
  progress: number,
): number {
  const safe =
    clamp(
      progress,
      0,
      1,
    );

  return (
    safe *
    safe *
    safe *
    (
      safe *
        (
          safe * 6 -
          15
        ) +
      10
    )
  );
}

export function getSmoothKinematicSpeedKmh(
  startSpeedKmh: number,
  endSpeedKmh: number,
  timeProgress: number,
): number {
  const start =
    finiteNonNegative(
      startSpeedKmh,
    );

  const end =
    finiteNonNegative(
      endSpeedKmh,
    );

  const progress =
    smoothKinematicProgress(
      timeProgress,
    );

  return Math.max(
    0,
    start +
      (
        end -
        start
      ) *
        progress,
  );
}

/*
 * Integral of:
 *
 *   smoothstep(t) = 3t² - 2t³
 *
 * from zero to t:
 *
 *   t³ - 0.5t⁴
 */
export function getIntegratedKinematicDistanceProgress(
  startSpeedKmh: number,
  endSpeedKmh: number,
  timeProgress: number,
): number {
  const progress =
    clamp(
      timeProgress,
      0,
      1,
    );

  const start =
    finiteNonNegative(
      startSpeedKmh,
    );

  const end =
    finiteNonNegative(
      endSpeedKmh,
    );

  const averageSpeed =
    (
      start +
      end
    ) / 2;

  if (
    averageSpeed <
    0.01
  ) {
    return smootherKinematicProgress(
      progress,
    );
  }

  const speedDifference =
    end -
    start;

  const integratedSmoothStep =
    progress *
      progress *
      progress -
    0.5 *
      progress *
      progress *
      progress *
      progress;

  const travelledSpeedArea =
    start *
      progress +
    speedDifference *
      integratedSmoothStep;

  return clamp(
    travelledSpeedArea /
      averageSpeed,
    0,
    1,
  );
}

export function resolveVelocitySampleWindow(
  currentTimeSeconds: number,
  requestedSampleSeconds: number,
  firstPathTimeSeconds: number,
  lastPathTimeSeconds: number,
): VelocitySampleWindow {
  const first =
    Number.isFinite(
      firstPathTimeSeconds,
    )
      ? firstPathTimeSeconds
      : 0;

  const last =
    Number.isFinite(
      lastPathTimeSeconds,
    )
      ? Math.max(
          first,
          lastPathTimeSeconds,
        )
      : first;

  const availableDuration =
    last -
    first;

  if (
    availableDuration <=
    TIME_EPSILON_SECONDS
  ) {
    return {
      beforeTimeSeconds:
        first,

      afterTimeSeconds:
        last,

      mode:
        "Stationary",
    };
  }

  const sample =
    clamp(
      Number.isFinite(
        requestedSampleSeconds,
      )
        ? Math.abs(
            requestedSampleSeconds,
          )
        : 0.05,
      0.001,
      Math.max(
        0.001,
        availableDuration,
      ),
    );

  const current =
    clamp(
      Number.isFinite(
        currentTimeSeconds,
      )
        ? currentTimeSeconds
        : first,
      first,
      last,
    );

  /*
   * At the final authored point, use a backward difference. Sampling beyond
   * the endpoint would return the stationary final pose and understate the
   * incoming impact velocity.
   */
  if (
    current >=
    last -
      TIME_EPSILON_SECONDS
  ) {
    return {
      beforeTimeSeconds:
        Math.max(
          first,
          last -
            sample,
        ),

      afterTimeSeconds:
        last,

      mode:
        "Backward",
    };
  }

  if (
    current <=
    first +
      TIME_EPSILON_SECONDS
  ) {
    return {
      beforeTimeSeconds:
        first,

      afterTimeSeconds:
        Math.min(
          last,
          first +
            sample,
        ),

      mode:
        "Forward",
    };
  }

  const before =
    Math.max(
      first,
      current -
        sample,
    );

  const after =
    Math.min(
      last,
      current +
        sample,
    );

  if (
    after -
      before <=
    TIME_EPSILON_SECONDS
  ) {
    if (
      current -
        first >
      last -
        current
    ) {
      return {
        beforeTimeSeconds:
          Math.max(
            first,
            current -
              sample,
          ),

        afterTimeSeconds:
          current,

        mode:
          "Backward",
      };
    }

    return {
      beforeTimeSeconds:
        current,

      afterTimeSeconds:
        Math.min(
          last,
          current +
            sample,
        ),

      mode:
        "Forward",
    };
  }

  return {
    beforeTimeSeconds:
      before,

    afterTimeSeconds:
      after,

    mode:
      "Central",
  };
}


/*
 * [RoadSafe:MetricRouteTimingSolverV1]
 *
 * Converts editor coordinates to physical metres and reconciles the complete
 * point-speed profile with the authoritative Point Z timestamp.
 *
 * A single global scale is applied to the entered point speeds. This preserves
 * their relative acceleration/deceleration profile while ensuring that:
 *
 *   metric distance = integrated displayed speed × segment time
 */
export interface MetricSceneDimensions {
  widthMetres: number;
  heightMetres: number;
}

export interface MetricRouteTimingPoint {
  position: {
    x: number;
    y: number;
  };
  speedKmh: number;
  stopped?: boolean;
}

export interface MetricRouteTimingResult {
  timesSeconds: number[];
  speedsKmh: number[];
  segmentLengthsMetres: number[];
  naturalDurationSeconds: number;
  targetDurationSeconds: number;
  speedScale: number;
  usedMetricDimensions: boolean;
}

function metricTimingRound(
  value: number,
): number {
  return Number(
    value.toFixed(4),
  );
}

function normaliseMetricSceneDimensions(
  dimensions:
    MetricSceneDimensions |
    undefined,
): {
  widthMetres: number;
  heightMetres: number;
  supplied: boolean;
} {
  const supplied =
    Boolean(
      dimensions &&
      Number.isFinite(
        dimensions.widthMetres,
      ) &&
      Number.isFinite(
        dimensions.heightMetres,
      ) &&
      dimensions.widthMetres > 0 &&
      dimensions.heightMetres > 0,
    );

  return {
    widthMetres:
      supplied
        ? Math.max(
            1,
            dimensions
              ?.widthMetres ??
              100,
          )
        : 100,

    heightMetres:
      supplied
        ? Math.max(
            1,
            dimensions
              ?.heightMetres ??
              100,
          )
        : 100,

    supplied,
  };
}

function sceneSegmentLengthMetres(
  start:
    MetricRouteTimingPoint,
  end:
    MetricRouteTimingPoint,
  dimensions: {
    widthMetres: number;
    heightMetres: number;
  },
): number {
  const horizontal =
    (
      end.position.x -
      start.position.x
    ) /
    100 *
    dimensions.widthMetres;

  const vertical =
    (
      end.position.y -
      start.position.y
    ) /
    100 *
    dimensions.heightMetres;

  return Math.hypot(
    horizontal,
    vertical,
  );
}

function timingPointSpeedKmh(
  point:
    MetricRouteTimingPoint,
  fallbackSpeedKmh: number,
): number {
  if (point.stopped) {
    return 0;
  }

  const entered =
    Number.isFinite(
      point.speedKmh,
    )
      ? Math.max(
          0,
          point.speedKmh,
        )
      : 0;

  if (entered >= 0.1) {
    return entered;
  }

  return Math.max(
    0.1,
    Number.isFinite(
      fallbackSpeedKmh,
    )
      ? fallbackSpeedKmh
      : 1,
  );
}

export function solveMetricRouteTiming(
  points:
    MetricRouteTimingPoint[],
  targetDurationSeconds: number,
  fallbackSpeedKmh: number,
  dimensions?:
    MetricSceneDimensions,
  segmentLengthsMetresOverride?:
    readonly number[],
): MetricRouteTimingResult {
  const world =
    normaliseMetricSceneDimensions(
      dimensions,
    );

  const safeTarget =
    Math.max(
      0.1,
      Number.isFinite(
        targetDurationSeconds,
      )
        ? targetDurationSeconds
        : 0.1,
    );

  if (points.length === 0) {
    return {
      timesSeconds: [],
      speedsKmh: [],
      segmentLengthsMetres: [],
      naturalDurationSeconds: 0,
      targetDurationSeconds:
        metricTimingRound(
          safeTarget,
        ),
      speedScale: 1,
      usedMetricDimensions:
        world.supplied,
    };
  }

  if (points.length === 1) {
    return {
      timesSeconds: [0],
      speedsKmh: [
        metricTimingRound(
          timingPointSpeedKmh(
            points[0],
            fallbackSpeedKmh,
          ),
        ),
      ],
      segmentLengthsMetres: [],
      naturalDurationSeconds: 0,
      targetDurationSeconds:
        metricTimingRound(
          safeTarget,
        ),
      speedScale: 1,
      usedMetricDimensions:
        world.supplied,
    };
  }

  const baseSpeedsKmh =
    points.map(
      (point) =>
        timingPointSpeedKmh(
          point,
          fallbackSpeedKmh,
        ),
    );

  /*
   * [RoadSafe:CanonicalSplineLengthTimingOverrideV1]
   *
   * Step 3B2 playback may supply the exact metric lengths of its smoothed
   * Bézier segments. Existing callers continue using straight metric segment
   * lengths when no valid override is supplied.
   */
  const validLengthOverride =
    segmentLengthsMetresOverride?.length ===
      points.length - 1 &&
    segmentLengthsMetresOverride.every(
      (length) =>
        Number.isFinite(length) &&
        length >= 0,
    );

  const segmentLengthsMetres =
    validLengthOverride
      ? segmentLengthsMetresOverride.map(
          (length) =>
            Math.max(
              0,
              Number(length),
            ),
        )
      : points
          .slice(
            0,
            -1,
          )
          .map(
            (point, index) =>
              sceneSegmentLengthMetres(
                point,
                points[index + 1],
                world,
              ),
          );

  const minimumMovingSpeedMps =
    0.1 / 3.6;

  const naturalSegmentDurations =
    segmentLengthsMetres.map(
      (
        lengthMetres,
        index,
      ) => {
        const averageSpeedMps =
          Math.max(
            minimumMovingSpeedMps,
            (
              baseSpeedsKmh[index] +
              baseSpeedsKmh[index + 1]
            ) /
              2 /
              3.6,
          );

        return (
          lengthMetres /
          averageSpeedMps
        );
      },
    );

  const naturalDurationSeconds =
    naturalSegmentDurations.reduce(
      (
        sum,
        duration,
      ) =>
        sum + duration,
      0,
    );

  const speedScale =
    naturalDurationSeconds >
      0.000001
      ? naturalDurationSeconds /
        safeTarget
      : 1;

  const speedsKmh =
    baseSpeedsKmh.map(
      (speedKmh) =>
        metricTimingRound(
          speedKmh *
          speedScale,
        ),
    );

  const scaledSegmentDurations =
    segmentLengthsMetres.map(
      (
        lengthMetres,
        index,
      ) => {
        const averageSpeedMps =
          Math.max(
            minimumMovingSpeedMps,
            (
              speedsKmh[index] +
              speedsKmh[index + 1]
            ) /
              2 /
              3.6,
          );

        return (
          lengthMetres /
          averageSpeedMps
        );
      },
    );

  const scaledDurationTotal =
    scaledSegmentDurations.reduce(
      (
        sum,
        duration,
      ) =>
        sum + duration,
      0,
    );

  const timesSeconds:
    number[] = [0];

  let accumulated = 0;

  for (
    let index = 0;
    index <
    scaledSegmentDurations.length;
    index += 1
  ) {
    accumulated +=
      scaledSegmentDurations[index];

    const finalPoint =
      index ===
      scaledSegmentDurations.length -
        1;

    if (finalPoint) {
      timesSeconds.push(
        metricTimingRound(
          safeTarget,
        ),
      );

      continue;
    }

    const proportionalTime =
      scaledDurationTotal >
        0.000001
        ? (
            accumulated /
            scaledDurationTotal
          ) *
          safeTarget
        : (
            (index + 1) /
            (
              points.length -
              1
            )
          ) *
          safeTarget;

    const previousTime =
      timesSeconds[
        timesSeconds.length -
        1
      ];

    const remainingPoints =
      points.length -
      (
        index + 2
      );

    const maximumTime =
      safeTarget -
      remainingPoints *
        0.0001;

    timesSeconds.push(
      metricTimingRound(
        Math.min(
          maximumTime,
          Math.max(
            previousTime +
              0.0001,
            proportionalTime,
          ),
        ),
      ),
    );
  }

  return {
    timesSeconds,

    speedsKmh,

    segmentLengthsMetres:
      segmentLengthsMetres.map(
        metricTimingRound,
      ),

    naturalDurationSeconds:
      metricTimingRound(
        naturalDurationSeconds,
      ),

    targetDurationSeconds:
      metricTimingRound(
        safeTarget,
      ),

    speedScale:
      metricTimingRound(
        speedScale,
      ),

    usedMetricDimensions:
      world.supplied,
  };
}
