import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const relativePath =
  "src/utils/reconstructionRoadRouting.ts";

const absolutePath =
  path.join(projectRoot, relativePath);

if (!fs.existsSync(absolutePath)) {
  throw new Error(
    `Missing file: ${relativePath}`,
  );
}

const original =
  fs.readFileSync(
    absolutePath,
    "utf8",
  );

const functionMarker =
  "export function createRoadAlignedParticipantRoute({";

const startMarker =
  "  const startLocal = sceneToLocalMetres(startPoint.position, geometry);";

const endMarker =
  "  const cumulative: number[] = [0];";

const functionIndex =
  original.indexOf(
    functionMarker,
  );

if (functionIndex < 0) {
  throw new Error(
    "Could not find createRoadAlignedParticipantRoute().",
  );
}

const startIndex =
  original.indexOf(
    startMarker,
    functionIndex,
  );

if (startIndex < 0) {
  throw new Error(
    "Could not find the road-entry start block.",
  );
}

const endIndex =
  original.indexOf(
    endMarker,
    startIndex,
  );

if (endIndex < 0) {
  throw new Error(
    "Could not find the cumulative-distance block.",
  );
}

const currentBlock =
  original.slice(
    startIndex,
    endIndex,
  );

console.log("");
console.log(
  "=== CURRENT ROAD ENTRY BLOCK ===",
);
console.log(currentBlock);

const replacement = `  /*
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

  const routePoints =
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

`;

const updated =
  original.slice(
    0,
    startIndex,
  ) +
  replacement +
  original.slice(
    endIndex,
  );

const timestamp =
  new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

const backupPath =
  path.join(
    projectRoot,
    ".roadsafe-patch-backups",
    `road-entry-${timestamp}`,
    relativePath,
  );

fs.mkdirSync(
  path.dirname(backupPath),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  backupPath,
  original,
  "utf8",
);

fs.writeFileSync(
  absolutePath,
  updated,
  "utf8",
);

const verification =
  fs.readFileSync(
    absolutePath,
    "utf8",
  );

const requiredMarkers = [
  "const projectedStart =",
  "const startOffset =",
  "const sampledCumulative:",
  "const leadInDistanceMetres =",
  "const mergeLengthMetres =",
  "const remainingOffset =",
];

for (
  const marker
  of requiredMarkers
) {
  if (
    !verification.includes(marker)
  ) {
    throw new Error(
      `Verification failed: ${marker}`,
    );
  }
}

const functionEnd =
  verification.indexOf(
    "export function createRoadAlignedIntermediatePoints",
    functionIndex,
  );

const patchedFunction =
  verification.slice(
    functionIndex,
    functionEnd > functionIndex
      ? functionEnd
      : undefined,
  );

if (
  patchedFunction.includes(
    "...sampled.slice(1)",
  )
) {
  throw new Error(
    "The old immediate centreline merge still exists.",
  );
}

console.log("");
console.log(
  "=== PATCHED ROAD ENTRY BLOCK ===",
);

const patchedStart =
  verification.indexOf(
    "  const startLocal =",
    functionIndex,
  );

const patchedEnd =
  verification.indexOf(
    endMarker,
    patchedStart,
  );

console.log(
  verification.slice(
    patchedStart,
    patchedEnd,
  ),
);

console.log("");
console.log(
  "Road-entry heading patch applied.",
);

console.log(
  `Backup: ${path.relative(
    projectRoot,
    backupPath,
  )}`,
);