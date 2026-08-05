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
