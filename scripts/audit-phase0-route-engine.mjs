import fs from "node:fs";
import path from "node:path";

const projectRoot =
  process.cwd();

const outputPath =
  path.join(
    projectRoot,
    "phase0-step2-route-audit.txt",
  );

const targetFiles = [
  "src/utils/reconstructionRoadRouting.ts",
  "src/utils/participantRouteAuthoring.ts",
  "src/utils/reconstructionGeometry.ts",
  "src/utils/reconstructionWorldScale.ts",
  "src/services/reconstructionParticipantService.ts",
];

const patterns = [
  "routeStartsByMovingAwayFromImpact",
  "removeInitialSpawnBacktracking",
  "evaluateRoute",
  "createRoadAlignedParticipantRoute",
  "TrimRouteAtCollision",
  "CollisionTerminatedRouteV1",
  "enforceCollisionTerminatedRoute",
  "normalisePointZRoute",
  "redistributeAuthoredTimes",
  "stabiliseAuthoredVehicleRoute",
  "distanceFromPointToSegment",
  "sceneToLocalMetres",
  "localMetresToScene",
  "getReconstructionWorldDimensions",
];

function readFile(relativePath) {
  const absolutePath =
    path.join(
      projectRoot,
      relativePath,
    );

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs
    .readFileSync(
      absolutePath,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function lineNumberAt(
  content,
  index,
) {
  return (
    content
      .slice(0, index)
      .split("\n")
      .length
  );
}

function extractFunction(
  content,
  marker,
) {
  const markerIndex =
    content.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const functionIndex =
    Math.max(
      content.lastIndexOf(
        "function ",
        markerIndex,
      ),
      content.lastIndexOf(
        "export function ",
        markerIndex,
      ),
    );

  const start =
    functionIndex >= 0
      ? functionIndex
      : markerIndex;

  const openingBrace =
    content.indexOf(
      "{",
      start,
    );

  if (openingBrace < 0) {
    return {
      start,
      end:
        Math.min(
          content.length,
          start + 1_500,
        ),
      text:
        content.slice(
          start,
          Math.min(
            content.length,
            start + 1_500,
          ),
        ),
    };
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (
    let index = openingBrace;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const nextCharacter =
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
        nextCharacter === "/"
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
      nextCharacter === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      nextCharacter === "*"
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
    }
    else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end: index + 1,
          text:
            content.slice(
              start,
              index + 1,
            ),
        };
      }
    }
  }

  return {
    start,
    end:
      Math.min(
        content.length,
        start + 6_000,
      ),
    text:
      content.slice(
        start,
        Math.min(
          content.length,
          start + 6_000,
        ),
      ),
  };
}

const output = [];

output.push(
  "RoadSafe AR · Phase 0 Step 2 Route Audit",
);

output.push(
  `Generated: ${new Date().toISOString()}`,
);

output.push("");

for (const relativePath of targetFiles) {
  const content =
    readFile(relativePath);

  output.push(
    "=".repeat(100),
  );

  output.push(
    `FILE: ${relativePath}`,
  );

  output.push(
    "=".repeat(100),
  );

  if (content === null) {
    output.push(
      "FILE NOT FOUND",
      "",
    );

    continue;
  }

  output.push(
    `Total lines: ${content.split("\n").length}`,
    "",
  );

  const emittedRanges = [];

  for (const pattern of patterns) {
    let searchIndex = 0;

    while (searchIndex < content.length) {
      const markerIndex =
        content.indexOf(
          pattern,
          searchIndex,
        );

      if (markerIndex < 0) {
        break;
      }

      const section =
        extractFunction(
          content,
          pattern,
        );

      if (!section) {
        break;
      }

      const duplicate =
        emittedRanges.some(
          (range) =>
            section.start >=
              range.start &&
            section.end <=
              range.end,
        );

      if (!duplicate) {
        emittedRanges.push({
          start: section.start,
          end: section.end,
        });

        output.push(
          "-".repeat(100),
        );

        output.push(
          `MATCH: ${pattern}`,
        );

        output.push(
          `START LINE: ${lineNumberAt(
            content,
            section.start,
          )}`,
        );

        output.push(
          "-".repeat(100),
        );

        output.push(
          section.text,
          "",
        );
      }

      searchIndex =
        markerIndex +
        pattern.length;
    }
  }

  const roadSafeMarkers =
    content
      .split("\n")
      .map(
        (line, index) => ({
          line:
            index + 1,
          text:
            line.trim(),
        }),
      )
      .filter(
        (entry) =>
          entry.text.includes(
            "[RoadSafe:",
          ),
      );

  output.push(
    "-".repeat(100),
  );

  output.push(
    "ROADSAFE PATCH MARKERS",
  );

  output.push(
    "-".repeat(100),
  );

  if (
    roadSafeMarkers.length === 0
  ) {
    output.push(
      "No RoadSafe markers found.",
    );
  }
  else {
    for (
      const marker
      of roadSafeMarkers
    ) {
      output.push(
        `${marker.line}: ${marker.text}`,
      );
    }
  }

  output.push("");
}

fs.writeFileSync(
  outputPath,
  output.join("\n"),
  "utf8",
);

console.log(
  `Route audit written to ${outputPath}`,
);
