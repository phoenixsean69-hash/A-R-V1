function chooseStartTime({
  primaryImpactTime,
  predictedHazardTime,
}) {
  const crashPreRollStart =
    primaryImpactTime -
    0.4;

  const hazardPreRollStart =
    predictedHazardTime === undefined
      ? Number.POSITIVE_INFINITY
      : predictedHazardTime -
        0.55;

  return Math.max(
    0,
    Math.min(
      crashPreRollStart,
      hazardPreRollStart,
    ),
  );
}

const earlyHazard =
  chooseStartTime({
    primaryImpactTime: 8,
    predictedHazardTime: 2.5,
  });

if (
  Math.abs(
    earlyHazard -
      1.95,
  ) >
  0.000001
) {
  throw new Error(
    `Expected early hazard pre-roll 1.95 s, got ${earlyHazard}.`,
  );
}

const crashOnly =
  chooseStartTime({
    primaryImpactTime: 8,
    predictedHazardTime: undefined,
  });

if (
  Math.abs(
    crashOnly -
      7.6,
  ) >
  0.000001
) {
  throw new Error(
    `Expected crash-only pre-roll 7.6 s, got ${crashOnly}.`,
  );
}

const nearCrashHazard =
  chooseStartTime({
    primaryImpactTime: 8,
    predictedHazardTime: 7.9,
  });

if (
  Math.abs(
    nearCrashHazard -
      7.35,
  ) >
  0.000001
) {
  throw new Error(
    `Expected near-crash hazard pre-roll 7.35 s, got ${nearCrashHazard}.`,
  );
}

console.log(
  "[RoadSafe] Road Hazard pre-roll policy verification passed.",
);
console.log(
  `[RoadSafe] Early hazard: ${earlyHazard.toFixed(2)} s; crash-only: ${crashOnly.toFixed(2)} s; near-crash hazard: ${nearCrashHazard.toFixed(2)} s.`,
);
