import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const packagePath =
  path.join(
    root,
    "package.json",
  );

const pipelinePath =
  path.join(
    root,
    "src/services/forensicScenePipelineService.ts",
  );

const extractionPath =
  path.join(
    root,
    "src/services/realSceneExtractionService.ts",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-forensic-osm-resilience-v2.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "forensic-osm-resilience-v2-build.log",
  );

function fail(message) {
  console.error(message);
  process.exit(1);
}

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const first =
    source.indexOf(
      before,
    );

  if (first < 0) {
    fail(
      `Could not locate ${label}. No files changed.`,
    );
  }

  const second =
    source.indexOf(
      before,
      first +
        before.length,
    );

  if (second >= 0) {
    fail(
      `Found more than one ${label}; refusing ambiguous patch. No files changed.`,
    );
  }

  return (
    source.slice(
      0,
      first,
    ) +
    after +
    source.slice(
      first +
        before.length,
    )
  );
}

if (!fs.existsSync(packagePath)) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

if (
  pkg.name !==
  "roadsafe-ar"
) {
  fail(
    `Expected roadsafe-ar, found ${pkg.name ?? "unknown"}.`,
  );
}

for (
  const required of [
    pipelinePath,
    extractionPath,
  ]
) {
  if (!fs.existsSync(required)) {
    fail(
      `Required file missing: ${required}`,
    );
  }
}

const originalPipeline =
  fs.readFileSync(
    pipelinePath,
    "utf8",
  );

const originalExtraction =
  fs.readFileSync(
    extractionPath,
    "utf8",
  );

let pipeline =
  originalPipeline;

let extraction =
  originalExtraction;

/* ========================================================================== */
/* 1. Modernise endpoint pools.                                               */
/* ========================================================================== */

const oldPipelineEndpoints =
`const OVERPASS_ENDPOINTS = Array.from(
  new Set(
    [
      import.meta.env.VITE_OVERPASS_URL,
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ].filter((value): value is string => Boolean(value)),
  ),
);`;

const newPipelineEndpoints =
`const OVERPASS_ENDPOINTS = Array.from(
  new Set(
    [
      import.meta.env.VITE_OVERPASS_URL,

      // Current global public instances listed by OpenStreetMap.
      // private.coffee is the current replacement for the retired Kumi endpoint.
      "https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ].filter((value): value is string => Boolean(value)),
  ),
);

const OVERPASS_CLIENT_TIMEOUT_MS =
  36_000;

const OSM_MAIN_API_TIMEOUT_MS =
  34_000;

const OSM_MAIN_API_MAP_ENDPOINT =
  "https://api.openstreetmap.org/api/0.6/map.json";`;

if (
  pipeline.includes(
    oldPipelineEndpoints,
  )
) {
  pipeline =
    replaceOnce(
      pipeline,
      oldPipelineEndpoints,
      newPipelineEndpoints,
      "forensic Overpass endpoint pool",
    );
} else if (
  !pipeline.includes(
    "overpass.private.coffee",
  )
) {
  fail(
    "Could not recognise the forensic Overpass endpoint pool. No files changed.",
  );
}

/* Legacy extraction endpoint pool: keep independent non-forensic consumers healthy. */
extraction =
  extraction.replace(
    '"https://overpass.kumi.systems/api/interpreter",',
    `"https://overpass.private.coffee/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",`,
  );

extraction =
  extraction.replace(
    "const REQUEST_TIMEOUT_MS = 13_000;",
    "const REQUEST_TIMEOUT_MS = 30_000;",
  );

/* ========================================================================== */
/* 2. Make the forensic query smaller and give the server enough time.        */
/* ========================================================================== */

const oldQuery =
`function overpassQuery(area: RealSceneAreaSelection): string {
  const b = area.bounds;
  return \`[out:json][timeout:18];
(
  way["highway"]["area"!="yes"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["building"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["barrier"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["landuse"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["natural"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["leisure"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["waterway"](\${b.south},\${b.west},\${b.north},\${b.east});
  node["highway"](\${b.south},\${b.west},\${b.north},\${b.east});
  node["traffic_sign"](\${b.south},\${b.west},\${b.north},\${b.east});
  node["natural"~"tree|shrub"](\${b.south},\${b.west},\${b.north},\${b.east});
);
out tags geom qt;\`;
}`;

const newQuery =
`function overpassQuery(area: RealSceneAreaSelection): string {
  const b = area.bounds;

  /*
   * Keep acquisition forensic-relevant. Broad natural/leisure/waterway
   * selectors can explode result size around towns and are unnecessary for
   * the geometry normalizer.
   */
  return \`[out:json][timeout:30];
(
  way["highway"]["area"!="yes"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["building"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["barrier"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["landuse"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["natural"~"wood|scrub|grassland|wetland|bare_rock|sand|scree|water"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["leisure"~"park|garden|nature_reserve"](\${b.south},\${b.west},\${b.north},\${b.east});
  way["waterway"="riverbank"](\${b.south},\${b.west},\${b.north},\${b.east});
  node["natural"~"tree|shrub"](\${b.south},\${b.west},\${b.north},\${b.east});
);
out tags geom qt;\`;
}`;

if (
  pipeline.includes(
    oldQuery,
  )
) {
  pipeline =
    replaceOnce(
      pipeline,
      oldQuery,
      newQuery,
      "forensic Overpass query",
    );
} else if (
  !pipeline.includes(
    "[out:json][timeout:30]",
  )
) {
  fail(
    "Could not recognise the forensic Overpass query. No files changed.",
  );
}

/* ========================================================================== */
/* 3. Replace fragile fetchRawOsm with robust Overpass + OSM main API fallback */
/* ========================================================================== */

const fetchStart =
  pipeline.indexOf(
    "async function fetchRawOsm(",
  );

const sourceRecordsStart =
  pipeline.indexOf(
    "\nfunction sourceRecords(",
    fetchStart,
  );

if (
  fetchStart < 0 ||
  sourceRecordsStart < 0
) {
  fail(
    "Could not isolate fetchRawOsm implementation. No files changed.",
  );
}

const robustAcquisition =
`interface OsmApiElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string | undefined>;
}

interface OsmApiResponse {
  version?: number;
  generator?: string;
  elements?: OsmApiElement[];
}

function formatAcquisitionError(
  endpoint: string,
  error: unknown,
): string {
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return \`\${endpoint}: timed out\`;
  }

  return \`\${endpoint}: \${
    error instanceof Error
      ? error.message
      : String(error)
  }\`;
}

function osmApiToOverpass(
  response: OsmApiResponse,
): OverpassRaw {
  const nodes =
    new Map<
      number,
      {
        lat: number;
        lon: number;
        tags?: Record<string, string | undefined>;
      }
    >();

  for (
    const element of
      response.elements ?? []
  ) {
    if (
      element.type === "node" &&
      Number.isFinite(element.lat) &&
      Number.isFinite(element.lon)
    ) {
      nodes.set(
        element.id,
        {
          lat: element.lat as number,
          lon: element.lon as number,
          tags: element.tags,
        },
      );
    }
  }

  const elements: Array<{
    type: "node" | "way" | "relation";
    id: number;
    tags?: Record<string, string | undefined>;
    lat?: number;
    lon?: number;
    geometry?: Array<{
      lat: number;
      lon: number;
    }>;
  }> = [];

  for (
    const element of
      response.elements ?? []
  ) {
    if (
      element.type === "node"
    ) {
      const node =
        nodes.get(
          element.id,
        );

      /*
       * The geometry normalizer only needs tagged point features such as
       * mapped trees/shrubs. Way support nodes do not need to be duplicated.
       */
      if (
        node &&
        element.tags &&
        Object.keys(
          element.tags,
        ).length > 0
      ) {
        elements.push({
          type: "node",
          id: element.id,
          tags: element.tags,
          lat: node.lat,
          lon: node.lon,
        });
      }

      continue;
    }

    if (
      element.type === "way"
    ) {
      const geometry =
        (element.nodes ?? [])
          .map(
            (nodeId) =>
              nodes.get(
                nodeId,
              ),
          )
          .filter(
            (
              node,
            ): node is {
              lat: number;
              lon: number;
              tags?: Record<string, string | undefined>;
            } =>
              Boolean(node),
          )
          .map(
            (node) => ({
              lat: node.lat,
              lon: node.lon,
            }),
          );

      if (
        geometry.length > 0
      ) {
        elements.push({
          type: "way",
          id: element.id,
          tags: element.tags,
          geometry,
        });
      }

      continue;
    }

    /*
     * Current RoadSafe V2 normalisation does not consume relations directly.
     * They remain available only in the original OSM API response during a
     * future relation-aware normalisation phase.
     */
  }

  return {
    version:
      response.version,
    generator:
      response.generator ??
      "OpenStreetMap API 0.6 fallback",
    elements,
  };
}

async function fetchOsmMainApiFallback(
  area: RealSceneAreaSelection,
): Promise<{
  payload: OverpassRaw;
  endpoint: string;
}> {
  const b =
    area.bounds;

  const url =
    new URL(
      OSM_MAIN_API_MAP_ENDPOINT,
    );

  url.searchParams.set(
    "bbox",
    [
      b.west,
      b.south,
      b.east,
      b.north,
    ].join(","),
  );

  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () =>
        controller.abort(),
      OSM_MAIN_API_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
          },
          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      throw new Error(
        \`OpenStreetMap API returned HTTP \${response.status}.\`,
      );
    }

    const payload =
      osmApiToOverpass(
        (
          await response.json()
        ) as OsmApiResponse,
      );

    if (
      !payload.elements ||
      payload.elements.length === 0
    ) {
      throw new Error(
        "OpenStreetMap API returned no usable map elements.",
      );
    }

    return {
      payload,
      endpoint:
        "https://api.openstreetmap.org/api/0.6/map.json (small-area fallback)",
    };
  } finally {
    window.clearTimeout(
      timeout,
    );
  }
}

async function fetchRawOsm(
  area: RealSceneAreaSelection,
): Promise<{
  payload: OverpassRaw;
  endpoint: string;
}> {
  const body =
    new URLSearchParams({
      data:
        overpassQuery(
          area,
        ),
    }).toString();

  const failures:
    string[] =
    [];

  for (
    const endpoint of
      OVERPASS_ENDPOINTS
  ) {
    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(
        () =>
          controller.abort(),
        OVERPASS_CLIENT_TIMEOUT_MS,
      );

    try {
      const response =
        await fetch(
          endpoint,
          {
            method:
              "POST",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body,
            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw new Error(
          \`HTTP \${response.status}\`,
        );
      }

      const payload =
        (
          await response.json()
        ) as OverpassRaw;

      if (
        !payload.elements
      ) {
        throw new Error(
          "Response did not contain an elements array.",
        );
      }

      return {
        payload,
        endpoint,
      };
    } catch (error) {
      failures.push(
        formatAcquisitionError(
          endpoint,
          error,
        ),
      );
    } finally {
      window.clearTimeout(
        timeout,
      );
    }
  }

  /*
   * Public Overpass is the preferred source, but a forensic case should not
   * become impossible merely because public Overpass instances are congested.
   *
   * The OSM Editing API bbox endpoint is used only as a LAST-RESORT,
   * user-initiated, small-area fallback. It is not used for bulk/background
   * downloads.
   */
  try {
    return await fetchOsmMainApiFallback(
      area,
    );
  } catch (fallbackError) {
    failures.push(
      formatAcquisitionError(
        "OpenStreetMap API 0.6 bbox fallback",
        fallbackError,
      ),
    );
  }

  throw new Error(
    \`OpenStreetMap acquisition failed after all providers and the small-area fallback. \${failures.join(
      " | ",
    )}\`,
  );
}
`;

pipeline =
  pipeline.slice(
    0,
    fetchStart,
  ) +
  robustAcquisition +
  pipeline.slice(
    sourceRecordsStart,
  );

/* ========================================================================== */
/* 4. Expose safe response seeding in RealSceneExtractionService.             */
/* ========================================================================== */

if (
  !extraction.includes(
    "seedResponse(",
  )
) {
  const clearCacheMarker =
`  clearCache(): void {`;

  if (
    !extraction.includes(
      clearCacheMarker,
    )
  ) {
    fail(
      "Could not locate RealSceneExtractionService.clearCache. No files changed.",
    );
  }

  extraction =
    replaceOnce(
      extraction,
      clearCacheMarker,
`  /**
   * Seed the exact source response already acquired and archived by the
   * forensic pipeline. This prevents a second Overpass request during
   * normalisation and guarantees that archived evidence and rendered geometry
   * come from the same payload.
   */
  seedResponse(
    selection: RealSceneAreaSelection,
    response: OverpassResponse,
  ): void {
    writeCache(
      cacheKey(
        selection,
      ),
      response,
    );
  },

${clearCacheMarker}`,
      "RealSceneExtractionService clearCache insertion point",
    );
}

/* ========================================================================== */
/* 5. Seed the archived payload before normalisation.                          */
/* ========================================================================== */

const oldNormalize =
`    const extracted = await RealSceneExtractionService.extract(area.coreArea);`;

const newNormalize =
`    /*
     * Use the SAME frozen source payload for normalisation.
     * The context query covers the core, so seeding it under the core cache key
     * eliminates the previous duplicate network request.
     */
    RealSceneExtractionService.seedResponse(
      area.coreArea,
      raw.payload,
    );

    const extracted =
      await RealSceneExtractionService.extract(
        area.coreArea,
      );`;

if (
  pipeline.includes(
    oldNormalize,
  )
) {
  pipeline =
    replaceOnce(
      pipeline,
      oldNormalize,
      newNormalize,
      "forensic geometry normalisation call",
    );
} else if (
  !pipeline.includes(
    "RealSceneExtractionService.seedResponse",
  )
) {
  fail(
    "Could not locate the forensic geometry normalisation call. No files changed.",
  );
}

/* ========================================================================== */
/* 6. Better stage messaging for fallback visibility.                         */
/* ========================================================================== */

pipeline =
  pipeline.replace(
    "`Raw map source archived · ${rawArchive.sha256.slice(0, 12)}`",
    "`Raw map source archived via ${raw.endpoint.includes(\"fallback\") ? \"OSM bbox fallback\" : \"Overpass\"} · ${rawArchive.sha256.slice(0, 12)}`",
  );

/* ========================================================================== */
/* Structural/source verification before write.                               */
/* ========================================================================== */

for (
  const token of [
    "overpass.private.coffee",
    "maps.mail.ru/osm/tools/overpass",
    "OSM_MAIN_API_MAP_ENDPOINT",
    "fetchOsmMainApiFallback",
    "osmApiToOverpass",
    "OVERPASS_CLIENT_TIMEOUT_MS",
    "RealSceneExtractionService.seedResponse",
  ]
) {
  if (
    !pipeline.includes(
      token,
    ) &&
    !extraction.includes(
      token,
    )
  ) {
    fail(
      `Resilience verification failed: ${token}. No files changed.`,
    );
  }
}

const deprecatedOverpassUrl =
  "https://overpass.kumi.systems/api/interpreter";

if (
  pipeline.includes(
    deprecatedOverpassUrl,
  ) ||
  extraction.includes(
    deprecatedOverpassUrl,
  )
) {
  fail(
    "Deprecated Kumi Overpass URL survived the patch. No files changed.",
  );
}

console.log(
  "Deprecated live Overpass URL audit: PASS",
);

/* Parse transformed TS before writing. */
try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

  for (
    const [
      name,
      source,
    ] of [
      [
        "forensicScenePipelineService.ts",
        pipeline,
      ],
      [
        "realSceneExtractionService.ts",
        extraction,
      ],
    ]
  ) {
    const sourceFile =
      ts.createSourceFile(
        name,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );

    const diagnostics =
      sourceFile.parseDiagnostics ??
      [];

    if (
      diagnostics.length > 0
    ) {
      const details =
        diagnostics
          .slice(
            0,
            20,
          )
          .map(
            (diagnostic) => {
              const message =
                ts.flattenDiagnosticMessageText(
                  diagnostic.messageText,
                  "\n",
                );

              if (
                typeof diagnostic.start !==
                "number"
              ) {
                return message;
              }

              const position =
                sourceFile.getLineAndCharacterOfPosition(
                  diagnostic.start,
                );

              return (
                `${name}:${position.line + 1}:` +
                `${position.character + 1} ${message}`
              );
            },
          )
          .join(
            "\n",
          );

      fail(
        `TS parse audit failed:\n${details}`,
      );
    }
  }

  console.log(
    "Forensic OSM resilience TS parse audit: PASS",
  );
} catch (error) {
  if (
    String(
      error,
    ).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; continuing to full build.",
    );
  } else {
    throw error;
  }
}

/* ========================================================================== */
/* Backup + write + full build.                                               */
/* ========================================================================== */

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      pipelinePath:
        path.relative(
          root,
          pipelinePath,
        ),
      extractionPath:
        path.relative(
          root,
          extractionPath,
        ),
      originalPipeline,
      originalExtraction,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    pipelinePath,
    originalPipeline,
    "utf8",
  );

  fs.writeFileSync(
    extractionPath,
    originalExtraction,
    "utf8",
  );

  fs.rmSync(
    statePath,
    {
      force: true,
    },
  );
}

fs.writeFileSync(
  pipelinePath,
  pipeline,
  "utf8",
);

fs.writeFileSync(
  extractionPath,
  extraction,
  "utf8",
);

console.log(
  "PATCHED forensic OSM acquisition resilience.",
);

console.log(
  "PATCHED geometry normalisation to reuse the archived source payload.",
);

console.log("");
console.log(
  "Running full project build...",
);

const command =
  process.platform ===
  "win32"
    ? {
        executable:
          process.env.ComSpec ||
          "C:\\Windows\\System32\\cmd.exe",
        args: [
          "/d",
          "/s",
          "/c",
          "npm run build",
        ],
      }
    : {
        executable:
          "npm",
        args: [
          "run",
          "build",
        ],
      };

const build =
  spawnSync(
    command.executable,
    command.args,
    {
      cwd:
        root,
      encoding:
        "utf8",
      shell:
        false,
      env:
        process.env,
    },
  );

const output =
  [
    "RoadSafe Forensic OSM Resilience V2",
    "===================================",
    `status: ${String(
      build.status,
    )}`,
    `error: ${
      build.error
        ? `${build.error.name}: ${build.error.message}`
        : "none"
    }`,
    "",
    "STDOUT",
    "------",
    build.stdout ?? "",
    "",
    "STDERR",
    "------",
    build.stderr ?? "",
  ].join(
    "\n",
  );

fs.writeFileSync(
  buildLogPath,
  output,
  "utf8",
);

if (build.stdout) {
  process.stdout.write(
    build.stdout,
  );
}

if (build.stderr) {
  process.stderr.write(
    build.stderr,
  );
}

if (
  build.status === null ||
  build.status !== 0
) {
  console.error("");
  console.error(
    "Build failed. Restoring original acquisition services...",
  );

  restore();

  console.error(
    `Build log preserved at ${path.relative(
      root,
      buildLogPath,
    )}`,
  );

  process.exit(
    build.status ??
      1,
  );
}

console.log("");
console.log(
  "RoadSafe Forensic OSM Resilience V2 installed successfully.",
);

console.log("");
console.log(
  "Acquisition order:",
);

console.log(
  "  configured endpoint -> private.coffee -> VK Maps -> overpass-api.de -> OSM API small-area fallback",
);

console.log("");
console.log(
  "The archived raw payload is now reused directly for geometry normalisation.",
);

console.log(
  "There is no second Overpass download during the forensic Build stage.",
);

console.log("");
console.log(
  "Start / refresh:",
);

console.log(
  "  npm run dev",
);

console.log("");
console.log(
  "Rollback:",
);

console.log(
  "  node revoke-forensic-osm-resilience-v2.mjs",
);
