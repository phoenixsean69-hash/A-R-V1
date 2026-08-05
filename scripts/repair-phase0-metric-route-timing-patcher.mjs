import fs from "node:fs";

const patcherPath =
  "scripts/apply-phase0-metric-route-timing.mjs";

let source =
  fs.readFileSync(
    patcherPath,
    "utf8",
  ).replace(
    /\r\n/g,
    "\n",
  );

const repairMarker =
  "[RoadSafe:MetricInsertProgressiveTimingPatchV1]";

if (
  source.includes(
    repairMarker,
  )
) {
  console.log(
    "✓ Step 3B1 patcher was already repaired.",
  );

  process.exit(0);
}

const description =
  '"insertProgressiveRoutePoint metric redistribution"';

const descriptionIndex =
  source.indexOf(
    description,
  );

if (
  descriptionIndex < 0
) {
  throw new Error(
    "Could not locate the fragile insertProgressiveRoutePoint patch.",
  );
}

const blockStart =
  source.lastIndexOf(
    "authoring =\n  replaceInsideFunction(",
    descriptionIndex,
  );

if (
  blockStart < 0
) {
  throw new Error(
    "Could not locate the start of the fragile patch block.",
  );
}

const closingMarker =
  "\n  );";

const closingIndex =
  source.indexOf(
    closingMarker,
    descriptionIndex,
  );

if (
  closingIndex < 0
) {
  throw new Error(
    "Could not locate the end of the fragile patch block.",
  );
}

const blockEnd =
  closingIndex +
  closingMarker.length;

const replacement = String.raw`/*
 * [RoadSafe:MetricInsertProgressiveTimingPatchV1]
 *
 * Use structural matching here because the function's indentation changed
 * during earlier in-memory option/destructuring edits.
 */
{
  const range =
    functionRange(
      authoring,
      "export function insertProgressiveRoutePoint(",
    );

  const section =
    authoring.slice(
      range.start,
      range.end,
    );

  const legacyTimingCall =
    /redistributeAuthoredTimes\(\s*relabelPointZRoute\(\s*nextAuthored,\s*\),\s*durationSeconds,\s*\)/;

  if (
    !legacyTimingCall.test(
      section,
    )
  ) {
    throw new Error(
      "Could not structurally locate insertProgressiveRoutePoint timing redistribution.",
    );
  }

  const metricTimingCall = [
    "redistributeAuthoredTimes(",
    "        relabelPointZRoute(",
    "          nextAuthored,",
    "        ),",
    "        durationSeconds,",
    "        authored[0]",
    "          ?.speedKmh ??",
    "          1,",
    "        worldDimensions,",
    "      )",
  ].join("\n");

  const updated =
    section.replace(
      legacyTimingCall,
      metricTimingCall,
    );

  authoring =
    authoring.slice(
      0,
      range.start,
    ) +
    updated +
    authoring.slice(
      range.end,
    );
}`;

source =
  source.slice(
    0,
    blockStart,
  ) +
  replacement +
  source.slice(
    blockEnd,
  );

fs.writeFileSync(
  patcherPath,
  source,
  "utf8",
);

console.log(
  "✓ insertProgressiveRoutePoint patch now uses structural matching.",
);
