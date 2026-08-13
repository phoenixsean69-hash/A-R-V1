import type {
  SceneObjectDynamicsSample,
  SceneObjectDynamicsState,
  SceneObjectInteractionEvent,
} from "../types/reconstruction";

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

function interpolate(
  start: number,
  end: number,
  progress: number,
): number {
  return start +
    (end - start) *
      progress;
}

function normaliseQuaternion(
  quaternion: {
    x: number;
    y: number;
    z: number;
    w: number;
  },
) {
  const magnitude =
    Math.hypot(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w,
    ) || 1;

  return {
    x:
      quaternion.x /
      magnitude,
    y:
      quaternion.y /
      magnitude,
    z:
      quaternion.z /
      magnitude,
    w:
      quaternion.w /
      magnitude,
  };
}

function interpolateQuaternion(
  first:
    SceneObjectDynamicsSample["rotationQuaternion"],
  second:
    SceneObjectDynamicsSample["rotationQuaternion"],
  progress: number,
) {
  let target =
    second;

  const dot =
    first.x * second.x +
    first.y * second.y +
    first.z * second.z +
    first.w * second.w;

  if (
    dot < 0
  ) {
    target = {
      x: -second.x,
      y: -second.y,
      z: -second.z,
      w: -second.w,
    };
  }

  return normaliseQuaternion({
    x:
      interpolate(
        first.x,
        target.x,
        progress,
      ),
    y:
      interpolate(
        first.y,
        target.y,
        progress,
      ),
    z:
      interpolate(
        first.z,
        target.z,
        progress,
      ),
    w:
      interpolate(
        first.w,
        target.w,
        progress,
      ),
  });
}

export function getSceneObjectDynamicsSampleAtTime(
  state:
    SceneObjectDynamicsState | undefined,
  timeSeconds: number,
): SceneObjectDynamicsSample | null {
  const samples =
    state?.samples ??
    [];

  if (
    samples.length === 0
  ) {
    return null;
  }

  if (
    timeSeconds <=
    samples[0].timeSeconds
  ) {
    return samples[0];
  }

  const last =
    samples[
      samples.length - 1
    ];

  if (
    timeSeconds >=
    last.timeSeconds
  ) {
    return last;
  }

  for (
    let index = 0;
    index <
      samples.length - 1;
    index += 1
  ) {
    const first =
      samples[index];

    const second =
      samples[
        index + 1
      ];

    if (
      timeSeconds >
      second.timeSeconds
    ) {
      continue;
    }

    const duration =
      Math.max(
        0.000001,
        second.timeSeconds -
          first.timeSeconds,
      );

    const progress =
      clamp(
        (
          timeSeconds -
          first.timeSeconds
        ) /
          duration,
        0,
        1,
      );

    return {
      timeSeconds,
      position: {
        x:
          interpolate(
            first.position.x,
            second.position.x,
            progress,
          ),
        y:
          interpolate(
            first.position.y,
            second.position.y,
            progress,
          ),
      },
      verticalMetres:
        interpolate(
          first.verticalMetres,
          second.verticalMetres,
          progress,
        ),
      rotationQuaternion:
        interpolateQuaternion(
          first.rotationQuaternion,
          second.rotationQuaternion,
          progress,
        ),
      linearVelocityMps: {
        x:
          interpolate(
            first.linearVelocityMps.x,
            second.linearVelocityMps.x,
            progress,
          ),
        y:
          interpolate(
            first.linearVelocityMps.y,
            second.linearVelocityMps.y,
            progress,
          ),
        z:
          interpolate(
            first.linearVelocityMps.z,
            second.linearVelocityMps.z,
            progress,
          ),
      },
      sleeping:
        progress < 0.5
          ? first.sleeping
          : second.sleeping,
    };
  }

  return last;
}

export function getRecentSceneObjectInteraction(
  events:
    SceneObjectInteractionEvent[] | undefined,
  input: {
    timeSeconds: number;
    sceneObjectId?: string;
    participantId?: string;
    maximumAgeSeconds?: number;
  },
): SceneObjectInteractionEvent | null {
  const maximumAgeSeconds =
    Math.max(
      0,
      input.maximumAgeSeconds ??
        0.9,
    );

  let best:
    SceneObjectInteractionEvent | null =
      null;

  for (
    const event
    of events ?? []
  ) {
    if (
      input.sceneObjectId &&
      event.sceneObjectId !==
        input.sceneObjectId
    ) {
      continue;
    }

    if (
      input.participantId &&
      event.participantId !==
        input.participantId
    ) {
      continue;
    }

    const age =
      input.timeSeconds -
      event.timeSeconds;

    if (
      age < 0 ||
      age > maximumAgeSeconds
    ) {
      continue;
    }

    if (
      !best ||
      event.timeSeconds >
        best.timeSeconds
    ) {
      best =
        event;
    }
  }

  return best;
}
