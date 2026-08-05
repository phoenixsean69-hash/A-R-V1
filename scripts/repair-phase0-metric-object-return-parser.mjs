import fs from "node:fs";

const patcherPath =
  "scripts/apply-phase0-metric-route-timing.mjs";

let source =
  fs
    .readFileSync(
      patcherPath,
      "utf8",
    )
    .replace(
      /\r\n/g,
      "\n",
    );

const blockMarker =
  "/*\n * [RoadSafe:MetricInsertProgressiveTimingPatchV1]";

const blockStart =
  source.indexOf(
    blockMarker,
  );

if (blockStart < 0) {
  throw new Error(
    "Could not locate MetricInsertProgressiveTimingPatchV1.",
  );
}

const nextPatchAnchor =
`\nauthoring =
  replaceInsideFunction(
    authoring,
    "export function applySafeAuthoredPointUpdate(",`;

const blockEnd =
  source.indexOf(
    nextPatchAnchor,
    blockStart,
  );

if (blockEnd < 0) {
  throw new Error(
    "Could not locate the patch block following insertProgressiveRoutePoint.",
  );
}

const replacement = String.raw`/*
 * [RoadSafe:MetricInsertProgressiveTimingPatchV2]
 *
 * insertProgressiveRoutePoint returns an inline object type. The generic
 * functionRange helper mistakes that return-type brace for the function body,
 * so this patch bounds the function using the following exported declaration.
 */
{
  const functionStart =
    authoring.indexOf(
      "export function insertProgressiveRoutePoint(",
    );

  if (functionStart < 0) {
    throw new Error(
      "Could not locate insertProgressiveRoutePoint.",
    );
  }

  const nextFunctionStart =
    authoring.indexOf(
      "export function removeIntermediateRoutePoint(",
      functionStart,
    );

  if (nextFunctionStart < 0) {
    throw new Error(
      "Could not locate removeIntermediateRoutePoint after insertProgressiveRoutePoint.",
    );
  }

  const section =
    authoring.slice(
      functionStart,
      nextFunctionStart,
    );

  const legacyTimingCall =
    /redistributeAuthoredTimes\(\s*relabelPointZRoute\(\s*nextAuthored\s*,\s*\)\s*,\s*durationSeconds\s*,\s*\)/m;

  const match =
    section.match(
      legacyTimingCall,
    );

  if (!match) {
    const diagnosticStart =
      section.indexOf(
        "redistributeAuthoredTimes",
      );

    const diagnostic =
      diagnosticStart >= 0
        ? section.slice(
            diagnosticStart,
            diagnosticStart + 500,
          )
        : "No redistributeAuthoredTimes text was found in the function.";

    throw new Error(
      "Could not locate insertProgressiveRoutePoint timing call.\n\n" +
      diagnostic,
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

  const updatedSection =
    section.replace(
      legacyTimingCall,
      metricTimingCall,
    );

  authoring =
    authoring.slice(
      0,
      functionStart,
    ) +
    updatedSection +
    authoring.slice(
      nextFunctionStart,
    );
}
`;

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
  "✓ Step 3B1 insertProgressiveRoutePoint parser upgraded to V2.",
);
