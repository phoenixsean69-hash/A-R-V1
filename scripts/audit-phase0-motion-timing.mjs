import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const outputPath =
  path.join(
    root,
    "phase0-step3-motion-audit.txt",
  );

const sourceRoot =
  path.join(
    root,
    "src",
  );

const exactPatterns = [
  "redistributeAuthoredTimes",
  "getParticipantStateAtTime",
  "participantVelocityAtTime",
  "getParticipantVelocityAtTime",
  "interpolateSpeed",
  "cornerSpeed",
  "speedKmhAt",
  "speedAtTime",
  "sortMovementPathPoints",
  "isPhysicsGeneratedPathPoint",
  "createCleanPhysicsInput",
  "applyPhysicsSimulation",
  "makePhysicsPoint",
  "simulatedDurationSeconds",
  "minimumCurveRadius",
  "requiredTurnRadius",
];

const textPatterns = [
  "timeSeconds",
  "speedKmh",
  "movementPath",
  "physics-transition",
  "Impact",
];

function collectFiles(
  directory,
) {
  const files = [];

  for (
    const entry
    of fs.readdirSync(
      directory,
      {
        withFileTypes: true,
      },
    )
  ) {
    const absolute =
      path.join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      files.push(
        ...collectFiles(
          absolute,
        ),
      );

      continue;
    }

    if (
      entry.name.endsWith(
        ".ts",
      ) ||
      entry.name.endsWith(
        ".tsx",
      )
    ) {
      files.push(
        absolute,
      );
    }
  }

  return files;
}

function lineNumberAt(
  content,
  index,
) {
  return (
    content
      .slice(
        0,
        index,
      )
      .split(
        "\n",
      )
      .length
  );
}

function findParameterEnd(
  content,
  start,
) {
  const parameterStart =
    content.indexOf(
      "(",
      start,
    );

  if (
    parameterStart < 0
  ) {
    return -1;
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (
    let index = parameterStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (
        character === "\\"
      ) {
        escaped = true;
        continue;
      }

      if (
        character === quote
      ) {
        quote = null;
      }

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

    if (
      character === "("
    ) {
      depth += 1;
    }
    else if (
      character === ")"
    ) {
      depth -= 1;

      if (
        depth === 0
      ) {
        return index;
      }
    }
  }

  return -1;
}

function extractFunction(
  content,
  markerIndex,
) {
  const candidates = [
    content.lastIndexOf(
      "export function ",
      markerIndex,
    ),
    content.lastIndexOf(
      "function ",
      markerIndex,
    ),
    content.lastIndexOf(
      "const ",
      markerIndex,
    ),
  ];

  const start =
    Math.max(
      ...candidates,
    );

  if (
    start < 0
  ) {
    return null;
  }

  let openingBrace = -1;

  if (
    content.startsWith(
      "function ",
      start,
    ) ||
    content.startsWith(
      "export function ",
      start,
    )
  ) {
    const parameterEnd =
      findParameterEnd(
        content,
        start,
      );

    if (
      parameterEnd >= 0
    ) {
      openingBrace =
        content.indexOf(
          "{",
          parameterEnd,
        );
    }
  }
  else {
    const arrowIndex =
      content.indexOf(
        "=>",
        start,
      );

    if (
      arrowIndex >= 0 &&
      arrowIndex <
        markerIndex +
          500
    ) {
      openingBrace =
        content.indexOf(
          "{",
          arrowIndex,
        );
    }
  }

  if (
    openingBrace < 0
  ) {
    return null;
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

    const next =
      content[index + 1];

    if (
      lineComment
    ) {
      if (
        character === "\n"
      ) {
        lineComment = false;
      }

      continue;
    }

    if (
      blockComment
    ) {
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

      if (
        character === "\\"
      ) {
        escaped = true;
        continue;
      }

      if (
        character === quote
      ) {
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

    if (
      character === "{"
    ) {
      depth += 1;
    }
    else if (
      character === "}"
    ) {
      depth -= 1;

      if (
        depth === 0
      ) {
        return {
          start,
          end:
            index + 1,
          text:
            content.slice(
              start,
              index + 1,
            ),
        };
      }
    }
  }

  return null;
}

const output = [];

output.push(
  "RoadSafe AR · Phase 0 Step 3 Motion and Timing Audit",
);

output.push(
  `Generated: ${new Date().toISOString()}`,
);

output.push("");

const sourceFiles =
  collectFiles(
    sourceRoot,
  );

const emitted = new Set();

for (
  const absolutePath
  of sourceFiles
) {
  const relativePath =
    path
      .relative(
        root,
        absolutePath,
      )
      .replace(
        /\\/g,
        "/",
      );

  const content =
    fs
      .readFileSync(
        absolutePath,
        "utf8",
      )
      .replace(
        /\r\n/g,
        "\n",
      );

  for (
    const pattern
    of exactPatterns
  ) {
    let searchIndex = 0;

    while (
      searchIndex <
      content.length
    ) {
      const markerIndex =
        content.indexOf(
          pattern,
          searchIndex,
        );

      if (
        markerIndex < 0
      ) {
        break;
      }

      const section =
        extractFunction(
          content,
          markerIndex,
        );

      if (section) {
        const key =
          `${relativePath}:${section.start}:${section.end}`;

        if (
          !emitted.has(
            key,
          )
        ) {
          emitted.add(
            key,
          );

          output.push(
            "=".repeat(
              100,
            ),
          );

          output.push(
            `FILE: ${relativePath}`,
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
            "=".repeat(
              100,
            ),
          );

          output.push(
            section.text,
            "",
          );
        }
      }

      searchIndex =
        markerIndex +
        pattern.length;
    }
  }
}

output.push(
  "=".repeat(
    100,
  ),
);

output.push(
  "RAW MOTION/TIME MATCH INDEX",
);

output.push(
  "=".repeat(
    100,
  ),
);

for (
  const absolutePath
  of sourceFiles
) {
  const relativePath =
    path
      .relative(
        root,
        absolutePath,
      )
      .replace(
        /\\/g,
        "/",
      );

  const lines =
    fs
      .readFileSync(
        absolutePath,
        "utf8",
      )
      .replace(
        /\r\n/g,
        "\n",
      )
      .split(
        "\n",
      );

  const matches =
    lines
      .map(
        (
          line,
          index,
        ) => ({
          line:
            index + 1,
          text:
            line.trim(),
        }),
      )
      .filter(
        (entry) =>
          textPatterns.some(
            (pattern) =>
              entry.text.includes(
                pattern,
              ),
          ),
      );

  if (
    matches.length === 0
  ) {
    continue;
  }

  output.push(
    "",
    `FILE: ${relativePath}`,
  );

  for (
    const match
    of matches.slice(
      0,
      80,
    )
  ) {
    output.push(
      `${match.line}: ${match.text}`,
    );
  }

  if (
    matches.length > 80
  ) {
    output.push(
      `... ${matches.length - 80} additional matches omitted`,
    );
  }
}

fs.writeFileSync(
  outputPath,
  output.join(
    "\n",
  ),
  "utf8",
);

console.log(
  `Motion audit written to ${outputPath}`,
);

console.log(
  `Functions/sections captured: ${emitted.size}`,
);
