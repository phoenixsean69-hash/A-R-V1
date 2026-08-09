import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root =
  process.cwd();

const scriptDir =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const packagePath =
  path.join(
    root,
    "package.json",
  );

const extractionPath =
  path.join(
    root,
    "src/services/realSceneExtractionService.ts",
  );

const pipelinePath =
  path.join(
    root,
    "src/services/forensicScenePipelineService.ts",
  );

const viewerPath =
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  );

const environmentPath =
  path.join(
    root,
    "src/components/reconstruction/RoadSceneEnvironment.tsx",
  );

const terrainUtilPath =
  path.join(
    root,
    "src/utils/forensicTerrainSampling.ts",
  );

const terrainOverlayPath =
  path.join(
    root,
    "src/components/reconstruction/ForensicTerrainPlanOverlay.tsx",
  );

const payloadTerrainUtil =
  path.join(
    scriptDir,
    "forensicTerrainSampling.ts",
  );

const payloadTerrainOverlay =
  path.join(
    scriptDir,
    "ForensicTerrainPlanOverlay.tsx",
  );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
  );

const statePath =
  path.join(
    backupRoot,
    "last-scene-completeness-terrain-v4.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "scene-completeness-terrain-v4-build.log",
  );

function fail(
  message,
) {
  console.error(
    message,
  );

  process.exit(
    1,
  );
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

  if (
    first <
    0
  ) {
    fail(
      `Could not locate ${label}. No files changed.`,
    );
  }

  if (
    source.indexOf(
      before,
      first +
        before.length,
    ) >=
    0
  ) {
    fail(
      `Multiple ${label} anchors found. No files changed.`,
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

function insertIntoInterface(
  source,
  interfaceName,
  token,
  insertion,
) {
  if (
    source.includes(
      token,
    )
  ) {
    return source;
  }

  const start =
    source.indexOf(
      `interface ${interfaceName} {`,
    );

  if (
    start <
    0
  ) {
    fail(
      `Could not locate ${interfaceName}. No files changed.`,
    );
  }

  const nextInterface =
    source.indexOf(
      "\ninterface ",
      start +
        1,
    );

  const endSearch =
    nextInterface >=
      0
      ? nextInterface
      : source.length;

  const close =
    source.lastIndexOf(
      "\n}",
      endSearch,
    );

  if (
    close <
    start
  ) {
    fail(
      `Could not locate ${interfaceName} closing brace. No files changed.`,
    );
  }

  return (
    source.slice(
      0,
      close,
    ) +
    insertion +
    source.slice(
      close,
    )
  );
}

function addRelationQueryLines(
  source,
  label,
) {
  /*
   * Do NOT key this patch to one exact variable spelling.
   *
   * Depending on which RoadSafe patches are already installed, the bbox may
   * look like either:
   *
   *   ${b.south},${b.west},${b.north},${b.east}
   *
   * or:
   *
   *   ${south},${west},${north},${east}
   *
   * We therefore locate the existing WAY selector structurally, capture its
   * exact bbox expression, and insert the equivalent RELATION selector.
   */
  const selectorSpecs = [
    {
      name:
        "building",
      wayPattern:
        /(^[ \t]*)way\["building"\]\(([^;\n]+)\);/m,
      relationFor:
        (
          indent,
          bbox,
        ) =>
          `${indent}relation["building"](${bbox});`,
    },
    {
      name:
        "landuse",
      wayPattern:
        /(^[ \t]*)way\["landuse"\]\(([^;\n]+)\);/m,
      relationFor:
        (
          indent,
          bbox,
        ) =>
          `${indent}relation["landuse"](${bbox});`,
    },
    {
      name:
        "natural",
      wayPattern:
        /(^[ \t]*)way\["natural"(~"[^"]+")?\]\(([^;\n]+)\);/m,
      relationFor:
        (
          indent,
          bbox,
          filter,
        ) =>
          `${indent}relation["natural"${filter ?? ""}](${bbox});`,
    },
    {
      name:
        "leisure",
      wayPattern:
        /(^[ \t]*)way\["leisure"(~"[^"]+")?\]\(([^;\n]+)\);/m,
      relationFor:
        (
          indent,
          bbox,
          filter,
        ) =>
          `${indent}relation["leisure"${filter ?? ""}](${bbox});`,
    },
    {
      name:
        "waterway",
      wayPattern:
        /(^[ \t]*)way\["waterway"(="[^"]+")?\]\(([^;\n]+)\);/m,
      relationFor:
        (
          indent,
          bbox,
          filter,
        ) =>
          `${indent}relation["waterway"${filter ?? ""}](${bbox});`,
    },
  ];

  let next =
    source;

  let inserted =
    0;

  for (
    const spec of
      selectorSpecs
  ) {
    /*
     * If this logical relation selector is already present, leave it alone.
     * This makes V2 safe to re-run against a partially patched working tree.
     */
    const relationPresence =
      new RegExp(
        `relation\\["${spec.name}"`,
      );

    if (
      relationPresence.test(
        next,
      )
    ) {
      continue;
    }

    const match =
      spec.wayPattern.exec(
        next,
      );

    if (
      !match
    ) {
      /*
       * Not every current query is required to contain every optional layer.
       * Building and landuse are treated as the minimum completeness anchors;
       * natural/leisure/waterway are additive where present.
       */
      continue;
    }

    const full =
      match[0];

    const indent =
      match[1] ??
      "";

    let filter;
    let bbox;

    if (
      spec.name ===
        "natural" ||
      spec.name ===
        "leisure" ||
      spec.name ===
        "waterway"
    ) {
      filter =
        match[2] ??
        "";

      bbox =
        match[3];
    } else {
      bbox =
        match[2];
    }

    const relationLine =
      spec.relationFor(
        indent,
        bbox,
        filter,
      );

    next =
      next.slice(
        0,
        match.index,
      ) +
      full +
      "\n" +
      relationLine +
      next.slice(
        match.index +
          full.length,
      );

    inserted +=
      1;
  }

  const hasBuildingRelation =
    /relation\["building"\]/.test(
      next,
    );

  const hasLanduseRelation =
    /relation\["landuse"\]/.test(
      next,
    );

  if (
    !hasBuildingRelation ||
    !hasLanduseRelation
  ) {
    fail(
      `Could not structurally add required relation selectors to ${label}. ` +
        `building=${hasBuildingRelation ? "yes" : "no"}, ` +
        `landuse=${hasLanduseRelation ? "yes" : "no"}. No files changed.`,
    );
  }

  console.log(
    `PATCHED ${label} relation selectors structurally (${inserted} inserted).`,
  );

  return next;
}

if (
  !fs.existsSync(
    packagePath,
  )
) {
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
    extractionPath,
    pipelinePath,
    viewerPath,
    environmentPath,
    payloadTerrainUtil,
    payloadTerrainOverlay,
  ]
) {
  if (
    !fs.existsSync(
      required,
    )
  ) {
    fail(
      `Required file missing: ${required}`,
    );
  }
}

const originalExtraction =
  fs.readFileSync(
    extractionPath,
    "utf8",
  );

const originalPipeline =
  fs.readFileSync(
    pipelinePath,
    "utf8",
  );

const originalViewer =
  fs.readFileSync(
    viewerPath,
    "utf8",
  );

const originalEnvironment =
  fs.readFileSync(
    environmentPath,
    "utf8",
  );

const originalTerrainUtil =
  fs.existsSync(
    terrainUtilPath,
  )
    ? fs.readFileSync(
        terrainUtilPath,
        "utf8",
      )
    : null;

const originalTerrainOverlay =
  fs.existsSync(
    terrainOverlayPath,
  )
    ? fs.readFileSync(
        terrainOverlayPath,
        "utf8",
      )
    : null;

let extraction =
  originalExtraction;

let pipeline =
  originalPipeline;

let viewer =
  originalViewer;

let environment =
  originalEnvironment;

/* ====================================================================== */
/* 1. Relation-aware OSM normalization.                                   */
/* ====================================================================== */

const memberType =
`
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role?: string;
    geometry?: Array<{
      lat: number;
      lon: number;
    }>;
  }>;`;

extraction =
  insertIntoInterface(
    extraction,
    "OverpassElement",
    "members?: Array<",
    memberType,
  );

if (
  pipeline.includes(
    "interface OverpassElement {",
  )
) {
  pipeline =
    insertIntoInterface(
      pipeline,
      "OverpassElement",
      "members?: Array<",
      memberType,
    );
}

extraction =
  addRelationQueryLines(
    extraction,
    "real-scene extraction query",
  );

pipeline =
  addRelationQueryLines(
    pipeline,
    "forensic acquisition query",
  );

/*
 * Keep the existing RealSceneExtractionService normalization loop untouched.
 *
 * Raw OSM is archived exactly as received. A DERIVED normalization payload is
 * created in the forensic pipeline and seeded into the existing extractor.
 * This avoids brittle source-loop surgery and gives us a cleaner provenance
 * boundary:
 *
 *   raw provider response
 *          ↓
 *   immutable raw archive
 *          ↓
 *   relation expansion (derived)
 *          ↓
 *   existing RoadSafe normalizer
 */
if (
  !pipeline.includes(
    "function expandRelationsForNormalization(",
  )
) {
  const insertionPoint =
    pipeline.indexOf(
      "\nfunction sourceRecords(",
    );

  if (
    insertionPoint <
    0
  ) {
    fail(
      "Could not locate forensic sourceRecords insertion point. No files changed.",
    );
  }

  const helper =
`
function relationPointEqual(
  first: {
    lat: number;
    lon: number;
  },
  second: {
    lat: number;
    lon: number;
  },
): boolean {
  return (
    Math.abs(
      first.lat -
      second.lat,
    ) <
      0.00000001 &&
    Math.abs(
      first.lon -
      second.lon,
    ) <
      0.00000001
  );
}

function assembleRelationOuterRings(
  segments: Array<
    Array<{
      lat: number;
      lon: number;
    }>
  >,
): Array<
  Array<{
    lat: number;
    lon: number;
  }>
> {
  const remaining =
    segments
      .filter(
        (
          segment,
        ) =>
          segment.length >=
          2,
      )
      .map(
        (
          segment,
        ) =>
          segment.map(
            (
              point,
            ) => ({
              ...point,
            }),
          ),
      );

  const rings: Array<
    Array<{
      lat: number;
      lon: number;
    }>
  > =
    [];

  while (
    remaining.length >
    0
  ) {
    let ring =
      remaining.shift() ??
      [];

    let changed =
      true;

    while (
      changed &&
      remaining.length >
        0 &&
      !relationPointEqual(
        ring[0],
        ring[
          ring.length -
          1
        ],
      )
    ) {
      changed =
        false;

      const first =
        ring[0];

      const last =
        ring[
          ring.length -
          1
        ];

      for (
        let index =
          0;
        index <
        remaining.length;
        index +=
          1
      ) {
        const segment =
          remaining[
            index
          ];

        const segmentFirst =
          segment[0];

        const segmentLast =
          segment[
            segment.length -
            1
          ];

        if (
          relationPointEqual(
            last,
            segmentFirst,
          )
        ) {
          ring = [
            ...ring,
            ...segment.slice(
              1,
            ),
          ];
        } else if (
          relationPointEqual(
            last,
            segmentLast,
          )
        ) {
          ring = [
            ...ring,
            ...[
              ...segment,
            ]
              .reverse()
              .slice(
                1,
              ),
          ];
        } else if (
          relationPointEqual(
            first,
            segmentLast,
          )
        ) {
          ring = [
            ...segment.slice(
              0,
              -1,
            ),
            ...ring,
          ];
        } else if (
          relationPointEqual(
            first,
            segmentFirst,
          )
        ) {
          ring = [
            ...[
              ...segment,
            ]
              .reverse()
              .slice(
                0,
                -1,
              ),
            ...ring,
          ];
        } else {
          continue;
        }

        remaining.splice(
          index,
          1,
        );

        changed =
          true;

        break;
      }
    }

    /*
     * Only emit genuinely closed rings. Do not fabricate a polygon from an
     * incomplete relation fragment.
     */
    if (
      ring.length >=
        4 &&
      relationPointEqual(
        ring[0],
        ring[
          ring.length -
            1
        ],
      )
    ) {
      rings.push(
        ring,
      );
    }
  }

  return rings;
}

function expandRelationsForNormalization(
  payload: OverpassRaw,
): OverpassRaw {
  const sourceElements =
    payload.elements ??
    [];

  const expanded:
    OverpassElement[] =
    [
      ...sourceElements,
    ];

  for (
    const element of
      sourceElements
  ) {
    if (
      element.type !==
        "relation" ||
      !element.tags
    ) {
      continue;
    }

    const tags =
      element.tags;

    const isRelevantPolygon =
      Boolean(
        tags.building ||
        tags.landuse ||
        tags.natural ||
        tags.leisure ||
        tags.waterway ===
          "riverbank",
      );

    if (
      !isRelevantPolygon
    ) {
      continue;
    }

    const outerSegments =
      (
        element.members ??
        []
      )
        .filter(
          (
            member,
          ) =>
            member.type ===
              "way" &&
            (
              !member.role ||
              member.role ===
                "outer"
            ) &&
            Array.isArray(
              member.geometry,
            ) &&
            member.geometry.length >=
              2,
        )
        .map(
          (
            member,
          ) =>
            (
              member.geometry ??
              []
            ).map(
              (
                point,
              ) => ({
                ...point,
              }),
            ),
        );

    const rings =
      assembleRelationOuterRings(
        outerSegments,
      );

    rings.forEach(
      (
        ring,
        ringIndex,
      ) => {
        expanded.push({
          type:
            "way",

          /*
           * Stable negative derived ID. It cannot collide with positive OSM
           * way IDs and preserves the parent relation identity.
           */
          id:
            -(
              element.id *
                1000 +
              ringIndex +
              1
            ),

          tags: {
            ...tags,
            "roadsafe:derived_from_relation":
              String(
                element.id,
              ),
          },

          geometry:
            ring,
        });
      },
    );
  }

  return {
    ...payload,
    elements:
      expanded,
  };
}

`;

  pipeline =
    pipeline.slice(
      0,
      insertionPoint,
    ) +
    helper +
    pipeline.slice(
      insertionPoint,
    );
}

if (
  !pipeline.includes(
    "RealSceneExtractionService.seedResponse(",
  )
) {
  fail(
    "The forensic pipeline is missing seedResponse(). Install Forensic OSM Resilience V3 first. No files changed.",
  );
}

if (
  !pipeline.includes(
    "const normalizationPayload =",
  )
) {
  const seedIndex =
    pipeline.indexOf(
      "RealSceneExtractionService.seedResponse(",
    );

  if (
    seedIndex <
    0
  ) {
    fail(
      "Could not locate the forensic seedResponse call. No files changed.",
    );
  }

  const statementStart =
    pipeline.lastIndexOf(
      "\n",
      seedIndex,
    ) +
    1;

  const normalizationPrelude =
`    const normalizationPayload =
      expandRelationsForNormalization(
        raw.payload,
      );

`;

  pipeline =
    pipeline.slice(
      0,
      statementStart,
    ) +
    normalizationPrelude +
    pipeline.slice(
      statementStart,
    );

  /*
   * Seed the derived payload, not the immutable raw provider response.
   * Limit replacement to the seedResponse call region.
   */
  const nextSeedIndex =
    pipeline.indexOf(
      "RealSceneExtractionService.seedResponse(",
      statementStart,
    );

  const seedClose =
    pipeline.indexOf(
      ");",
      nextSeedIndex,
    );

  if (
    seedClose <
    0
  ) {
    fail(
      "Could not isolate seedResponse call. No files changed.",
    );
  }

  const seedCall =
    pipeline.slice(
      nextSeedIndex,
      seedClose +
        2,
    );

  if (
    !seedCall.includes(
      "raw.payload",
    )
  ) {
    fail(
      "seedResponse no longer uses raw.payload as expected. No files changed.",
    );
  }

  const nextSeedCall =
    seedCall.replace(
      "raw.payload",
      "normalizationPayload",
    );

  pipeline =
    pipeline.slice(
      0,
      nextSeedIndex,
    ) +
    nextSeedCall +
    pipeline.slice(
      seedClose +
        2,
    );
}

console.log(
  "PATCHED relation expansion at the forensic normalization boundary; extractor loop left untouched.",
);

/* Preserve relation member geometry in V3's runtime sanitizer. */
if (
  pipeline.includes(
    "function sanitiseOverpassPayload(",
  ) &&
  !pipeline.includes(
    "candidate.members",
  )
) {
  const sanitizerStart =
    pipeline.indexOf(
      "function sanitiseOverpassPayload(",
    );

  const sanitizerEnd =
    pipeline.indexOf(
      "\nconst OVERPASS_ENDPOINTS",
      sanitizerStart,
    );

  if (
    sanitizerStart <
      0 ||
    sanitizerEnd <
      0
  ) {
    fail(
      "Could not isolate sanitiseOverpassPayload. No files changed.",
    );
  }

  let sanitizer =
    pipeline.slice(
      sanitizerStart,
      sanitizerEnd,
    );

  const pushAnchor =
`    elements.push(
      element,
    );`;

  if (
    !sanitizer.includes(
      pushAnchor,
    )
  ) {
    fail(
      "Could not locate sanitizer element push. No files changed.",
    );
  }

  const memberValidation =
`
    if (
      Array.isArray(
        candidate.members,
      )
    ) {
      element.members =
        candidate.members
          .filter(
            (
              member,
            ): member is Record<
              string,
              unknown
            > =>
              isRecord(
                member,
              ) &&
              (
                member.type ===
                  "node" ||
                member.type ===
                  "way" ||
                member.type ===
                  "relation"
              ) &&
              typeof member.ref ===
                "number" &&
              Number.isFinite(
                member.ref,
              ),
          )
          .map(
            (
              member,
            ) => ({
              type:
                member.type as
                  | "node"
                  | "way"
                  | "relation",
              ref:
                member.ref as number,
              role:
                typeof member.role ===
                  "string"
                  ? member.role
                  : undefined,
              geometry:
                Array.isArray(
                  member.geometry,
                )
                  ? member.geometry
                      .filter(
                        (
                          point,
                        ): point is Record<
                          string,
                          unknown
                        > =>
                          isRecord(
                            point,
                          ) &&
                          typeof point.lat ===
                            "number" &&
                          Number.isFinite(
                            point.lat,
                          ) &&
                          typeof point.lon ===
                            "number" &&
                          Number.isFinite(
                            point.lon,
                          ),
                      )
                      .map(
                        (
                          point,
                        ) => ({
                          lat:
                            point.lat as number,
                          lon:
                            point.lon as number,
                        }),
                      )
                  : undefined,
            }),
          );
    }

`;

  sanitizer =
    sanitizer.replace(
      pushAnchor,
      memberValidation +
        pushAnchor,
    );

  pipeline =
    pipeline.slice(
      0,
      sanitizerStart,
    ) +
    sanitizer +
    pipeline.slice(
      sanitizerEnd,
    );
}

/*
 * OSM main API fallback: keep relation membership so relation-tagged outer
 * ways can still be recovered when public Overpass is unavailable.
 */
if (
  pipeline.includes(
    "interface OsmApiElement {",
  )
) {
  pipeline =
    insertIntoInterface(
      pipeline,
      "OsmApiElement",
      "members?: Array<",
`
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role?: string;
  }>;`,
    );
}

if (
  pipeline.includes(
    "function osmApiToOverpass(",
  ) &&
  !pipeline.includes(
    "RoadSafe relation fallback expansion",
  )
) {
  const functionStart =
    pipeline.indexOf(
      "function osmApiToOverpass(",
    );

  const functionEnd =
    pipeline.indexOf(
      "\nasync function fetchOsmMainApiFallback(",
      functionStart,
    );

  if (
    functionStart >=
      0 &&
    functionEnd >=
      0
  ) {
    let functionText =
      pipeline.slice(
        functionStart,
        functionEnd,
      );

    const returnAnchor =
`  return {
    version:`;

    if (
      functionText.includes(
        returnAnchor,
      )
    ) {
      const relationFallback =
`
  /*
   * RoadSafe relation fallback expansion.
   * api/0.6/map.json gives relation member refs and the member ways/nodes in
   * the same bbox response. Reconstruct outer-member geometry and copy the
   * relation tags so the normalizer sees the same logical polygon.
   */
  for (
    const relation of
      response.elements ??
      []
  ) {
    if (
      relation.type !==
        "relation" ||
      !relation.tags
    ) {
      continue;
    }

    (
      relation.members ??
      []
    ).forEach(
      (
        member,
        index,
      ) => {
        if (
          member.type !==
            "way" ||
          (
            member.role &&
            member.role !==
              "outer"
          )
        ) {
          return;
        }

        const sourceWay =
          (
            response.elements ??
            []
          ).find(
            (
              candidate,
            ) =>
              candidate.type ===
                "way" &&
              candidate.id ===
                member.ref,
          );

        if (
          !sourceWay
        ) {
          return;
        }

        const geometry =
          (
            sourceWay.nodes ??
            []
          )
            .map(
              (
                nodeId,
              ) =>
                nodes.get(
                  nodeId,
                ),
            )
            .filter(
              (
                point,
              ): point is {
                lat: number;
                lon: number;
                tags?: Record<
                  string,
                  string |
                  undefined
                >;
              } =>
                Boolean(
                  point,
                ),
            )
            .map(
              (
                point,
              ) => ({
                lat:
                  point.lat,
                lon:
                  point.lon,
              }),
            );

        if (
          geometry.length <
          3
        ) {
          return;
        }

        elements.push({
          type:
            "way",
          id:
            -(
              relation.id *
                1000 +
              index +
              1
            ),
          tags:
            relation.tags,
          geometry,
        });
      },
    );
  }

`;

      functionText =
        functionText.replace(
          returnAnchor,
          relationFallback +
            returnAnchor,
        );

      pipeline =
        pipeline.slice(
          0,
          functionStart,
        ) +
        functionText +
        pipeline.slice(
          functionEnd,
        );
    }
  }
}

/* Build-stage visibility: report environmental features, not only roads. */
pipeline =
  pipeline.replace(
    'message: `${geometry.roads.length} road(s), ${geometry.buildings.length} building(s), ${geometry.paths.length} path(s).`',
    'message: `${geometry.roads.length} road(s), ${geometry.buildings.length} building(s), ${geometry.paths.length} path(s), ${geometry.vegetation?.length ?? 0} vegetation item(s), ${geometry.landCover?.length ?? 0} land-cover polygon(s).`',
  );

/* ====================================================================== */
/* 2. 2D terrain plan overlay.                                            */
/* ====================================================================== */

if (
  !environment.includes(
    'import ForensicTerrainPlanOverlay from "./ForensicTerrainPlanOverlay";',
  )
) {
  const importAnchor =
    'import RealSceneGeometryLayer from "./RealSceneGeometryLayer";';

  if (
    !environment.includes(
      importAnchor,
    )
  ) {
    fail(
      "Could not locate RealSceneGeometryLayer import for the 2D environment. No files changed.",
    );
  }

  environment =
    environment.replace(
      importAnchor,
      `${importAnchor}
import ForensicTerrainPlanOverlay from "./ForensicTerrainPlanOverlay";`,
    );
}

if (
  !environment.includes(
    "<ForensicTerrainPlanOverlay",
  )
) {
  const realSceneBranch =
    environment.indexOf(
      "if (realSceneGeometry)",
    );

  if (
    realSceneBranch <
    0
  ) {
    fail(
      "Could not locate the real-scene branch in RoadSceneEnvironment. No files changed.",
    );
  }

  const layerIndex =
    environment.indexOf(
      "<RealSceneGeometryLayer",
      realSceneBranch,
    );

  if (
    layerIndex <
    0
  ) {
    fail(
      "Could not locate rendered RealSceneGeometryLayer in the real-scene branch. No files changed.",
    );
  }

  const lineStart =
    environment.lastIndexOf(
      "\n",
      layerIndex,
    ) +
    1;

  const indentationMatch =
    environment
      .slice(
        lineStart,
        layerIndex,
      )
      .match(
        /^[ \t]*/,
      );

  const indent =
    indentationMatch?.[0] ??
    "";

  const terrainNode =
`${indent}<ForensicTerrainPlanOverlay
${indent}  terrain={
${indent}    settings.useRealTerrain
${indent}      ? settings.forensicScene?.terrain
${indent}      : undefined
${indent}  }
/>
`;

  environment =
    environment.slice(
      0,
      lineStart,
    ) +
    terrainNode +
    environment.slice(
      lineStart,
    );
}

if (
  !environment.includes(
    "<ForensicTerrainPlanOverlay",
  ) ||
  !environment.includes(
    "settings.forensicScene?.terrain",
  )
) {
  fail(
    "Structural 2D terrain overlay insertion failed. No files changed.",
  );
}

console.log(
  "PATCHED 2D terrain plan overlay structurally before RealSceneGeometryLayer.",
);

/* ====================================================================== */
/* 3. 3D DEM mesh + shared terrain sampler.                               */
/* ====================================================================== */

if (
  !viewer.includes(
    'from "../../utils/forensicTerrainSampling";',
  )
) {
  const worldScaleImport =
    'from "../../utils/reconstructionWorldScale";';

  const importIndex =
    viewer.indexOf(
      worldScaleImport,
    );

  if (
    importIndex <
    0
  ) {
    fail(
      "Could not locate reconstructionWorldScale import for 3D terrain utilities. No files changed.",
    );
  }

  const importLineEnd =
    viewer.indexOf(
      "\n",
      importIndex,
    );

  if (
    importLineEnd <
    0
  ) {
    fail(
      "Could not determine the end of reconstructionWorldScale import. No files changed.",
    );
  }

  viewer =
    viewer.slice(
      0,
      importLineEnd +
        1,
    ) +
`import {
  createForensicTerrainHeightSampler,
  createForensicTerrainMesh,
} from "../../utils/forensicTerrainSampling";
` +
    viewer.slice(
      importLineEnd +
        1,
    );
}

/*
 * Insert the terrain sampler before the extracted-geometry branch. This is a
 * semantic anchor and is independent of CRLF/formatting around the block.
 */
if (
  !viewer.includes(
    "const terrainHeightAt =",
  )
) {
  const extractedAnchor =
    "const extracted = reconstruction.scene.realSceneGeometry?.status";

  const extractedIndex =
    viewer.indexOf(
      extractedAnchor,
    );

  if (
    extractedIndex <
    0
  ) {
    fail(
      "Could not locate the 3D extracted-geometry branch. No files changed.",
    );
  }

  const lineStart =
    viewer.lastIndexOf(
      "\n",
      extractedIndex,
    ) +
    1;

  const indent =
    viewer
      .slice(
        lineStart,
        extractedIndex,
      )
      .match(
        /^[ \t]*/,
      )?.[0] ??
    "";

  const setup =
`${indent}const forensicTerrain =
${indent}  reconstruction.scene.useRealTerrain
${indent}    ? reconstruction.scene.forensicScene?.terrain
${indent}    : undefined;

${indent}const terrainHeightAt =
${indent}  createForensicTerrainHeightSampler({
${indent}    terrain: forensicTerrain,
${indent}    sceneWidthMetres: width,
${indent}    sceneHeightMetres: height,
${indent}    exaggeration:
${indent}      reconstruction.scene.terrainExaggeration,
${indent}  });

${indent}const worldPositionOnTerrain = (
${indent}  position: ReconstructionPosition,
${indent}  yOffset = 0,
${indent}) => {
${indent}  const point =
${indent}    worldPosition(
${indent}      position,
${indent}      width,
${indent}      height,
${indent}      0,
${indent}    );

${indent}  point.y =
${indent}    terrainHeightAt(
${indent}      point.x,
${indent}      point.z,
${indent}    ) +
${indent}    yOffset;

${indent}  return point;
${indent}};

`;

  viewer =
    viewer.slice(
      0,
      lineStart,
    ) +
    setup +
    viewer.slice(
      lineStart,
    );
}

/*
 * Replace only the flat-ground statements inside `if (extracted)`. We do not
 * replace the whole branch.
 */
if (
  !viewer.includes(
    "const terrainMesh =",
  )
) {
  const extractedIfIndex =
    viewer.indexOf(
      "if (extracted)",
      viewer.indexOf(
        "const extracted = reconstruction.scene.realSceneGeometry?.status",
      ),
    );

  const addGeometryIndex =
    viewer.indexOf(
      "addRealSceneGeometryToThreeScene({",
      extractedIfIndex,
    );

  if (
    extractedIfIndex <
      0 ||
    addGeometryIndex <
      0
  ) {
    fail(
      "Could not isolate the 3D extracted-scene section. No files changed.",
    );
  }

  const section =
    viewer.slice(
      extractedIfIndex,
      addGeometryIndex,
    );

  const groundStart =
    section.indexOf(
      "const ground = new THREE.Mesh(",
    );

  const sceneAddGround =
    section.indexOf(
      "scene.add(ground);",
      groundStart,
    );

  if (
    groundStart <
      0 ||
    sceneAddGround <
      0
  ) {
    fail(
      "Could not locate the existing flat 3D ground statements. No files changed.",
    );
  }

  const absoluteGroundStart =
    extractedIfIndex +
    groundStart;

  const absoluteGroundEnd =
    extractedIfIndex +
    sceneAddGround +
    "scene.add(ground);".length;

  const lineStart =
    viewer.lastIndexOf(
      "\n",
      absoluteGroundStart,
    ) +
    1;

  const indent =
    viewer
      .slice(
        lineStart,
        absoluteGroundStart,
      )
      .match(
        /^[ \t]*/,
      )?.[0] ??
    "      ";

  const terrainGround =
`${indent}const terrainMesh =
${indent}  createForensicTerrainMesh({
${indent}    terrain: forensicTerrain,
${indent}    sceneWidthMetres: width,
${indent}    sceneHeightMetres: height,
${indent}    exaggeration:
${indent}      reconstruction.scene.terrainExaggeration,
${indent}  });

${indent}if (terrainMesh) {
${indent}  scene.add(terrainMesh);
${indent}} else {
${indent}  const ground = new THREE.Mesh(
${indent}    new THREE.PlaneGeometry(width, height),
${indent}    new THREE.MeshStandardMaterial({
${indent}      color: 0x4d5b4d,
${indent}      roughness: 1,
${indent}    }),
${indent}  );
${indent}  ground.rotation.x = -Math.PI / 2;
${indent}  ground.position.y = -0.03;
${indent}  ground.receiveShadow = true;
${indent}  scene.add(ground);
${indent}}`;

  viewer =
    viewer.slice(
      0,
      lineStart,
    ) +
    terrainGround +
    viewer.slice(
      absoluteGroundEnd,
    );
}

/*
 * Feed the SAME DEM sampler into road/building/land-cover/vegetation geometry.
 */
if (
  !viewer.includes(
    "heightAt: terrainHeightAt",
  )
) {
  const callIndex =
    viewer.indexOf(
      "addRealSceneGeometryToThreeScene({",
    );

  if (
    callIndex <
    0
  ) {
    fail(
      "Could not locate addRealSceneGeometryToThreeScene call. No files changed.",
    );
  }

  const geometryIndex =
    viewer.indexOf(
      "geometry: extracted",
      callIndex,
    );

  if (
    geometryIndex <
    0
  ) {
    fail(
      "Could not locate extracted geometry argument in 3D real-scene call. No files changed.",
    );
  }

  const geometryLineEnd =
    viewer.indexOf(
      "\n",
      geometryIndex,
    );

  if (
    geometryLineEnd <
    0
  ) {
    fail(
      "Could not determine the geometry argument line end. No files changed.",
    );
  }

  const lineStart =
    viewer.lastIndexOf(
      "\n",
      geometryIndex,
    ) +
    1;

  const indent =
    viewer
      .slice(
        lineStart,
        geometryIndex,
      )
      .match(
        /^[ \t]*/,
      )?.[0] ??
    "        ";

  viewer =
    viewer.slice(
      0,
      geometryLineEnd +
        1,
    ) +
`${indent}heightAt: terrainHeightAt,
` +
    viewer.slice(
      geometryLineEnd +
        1,
    );
}

console.log(
  "PATCHED 3D terrain mesh + heightAt structurally around the extracted-scene call.",
);

/* Ground the major editor entities on the same DEM sampler. */
const positionReplacements =
  new Map([
    [
      "worldPosition(point.position, width, height, 0.18)",
      "worldPositionOnTerrain(point.position, 0.18)",
    ],
    [
      "worldPosition(point, width, height, 0.12)",
      "worldPositionOnTerrain(point, 0.12)",
    ],
    [
      "worldPosition(object.position, width, height)",
      "worldPositionOnTerrain(object.position)",
    ],
    [
      "worldPosition(record.position, width, height, 0.55)",
      "worldPositionOnTerrain(record.position, 0.55)",
    ],
    [
      "worldPosition(measurement.start, width, height, 0.16)",
      "worldPositionOnTerrain(measurement.start, 0.16)",
    ],
    [
      "worldPosition(measurement.end, width, height, 0.16)",
      "worldPositionOnTerrain(measurement.end, 0.16)",
    ],
    [
      "worldPosition(state.position, width, height)",
      "worldPositionOnTerrain(state.position)",
    ],
  ]);

for (
  const [
    before,
    after,
  ] of positionReplacements
) {
  viewer =
    viewer
      .split(
        before,
      )
      .join(
        after,
      );
}

const collisionOld =
`    const collisionPoint = worldPosition(
      reconstruction.collisionPoint,
      width,
      height,
      0.2,
    );`;

const collisionNew =
`    const collisionPoint =
      worldPositionOnTerrain(
        reconstruction.collisionPoint,
        0.2,
      );`;

if (
  viewer.includes(
    collisionOld,
  )
) {
  viewer =
    viewer.replace(
      collisionOld,
      collisionNew,
    );
}

if (
  (
    environment.match(
      /<RealSceneGeometryLayer\b/g,
    ) ??
    []
  ).length <
    1 ||
  (
    environment.match(
      /<ForensicTerrainPlanOverlay\b/g,
    ) ??
    []
  ).length !==
    1
) {
  fail(
    "2D semantic render-count audit failed. No files changed.",
  );
}

if (
  (
    viewer.match(
      /addRealSceneGeometryToThreeScene\(\{/g,
    ) ??
    []
  ).length <
    1 ||
  !viewer.includes(
    "heightAt: terrainHeightAt",
  ) ||
  !viewer.includes(
    "createForensicTerrainMesh({",
  )
) {
  fail(
    "3D semantic terrain wiring audit failed. No files changed.",
  );
}

console.log(
  "2D/3D semantic renderer seam audit: PASS",
);

/* ====================================================================== */
/* Verification before write.                                             */
/* ====================================================================== */

for (
  const [
    label,
    source,
    tokens,
  ] of [
    [
      "extraction",
      extraction,
      [
        "members?: Array<",
        "relation[\"building\"]",
        "relation[\"landuse\"]",
      ],
    ],
    [
      "pipeline",
      pipeline,
      [
        "relation[\"building\"]",
        "relation[\"landuse\"]",
        "expandRelationsForNormalization",
        "assembleRelationOuterRings",
        "const normalizationPayload =",
        "normalizationPayload",
      ],
    ],
    [
      "2D environment",
      environment,
      [
        "ForensicTerrainPlanOverlay",
        "settings.forensicScene?.terrain",
      ],
    ],
    [
      "3D viewer",
      viewer,
      [
        "createForensicTerrainHeightSampler",
        "createForensicTerrainMesh",
        "terrainHeightAt",
        "worldPositionOnTerrain",
        "heightAt:",
      ],
    ],
  ]
) {
  for (
    const token of
      tokens
  ) {
    if (
      !source.includes(
        token,
      )
    ) {
      fail(
        `${label} verification failed: ${token}. No files changed.`,
      );
    }
  }
}

if (
  extraction.includes(
    "normalizationElements",
  ) ||
  extraction.includes(
    "expandRelationElementsForNormalization",
  )
) {
  fail(
    "V3 must not rewrite the existing extraction loop. No files changed.",
  );
}

if (
  !pipeline.includes(
    "expandRelationsForNormalization(",
  ) ||
  !pipeline.includes(
    "normalizationPayload",
  )
) {
  fail(
    "Pipeline-side relation expansion verification failed. No files changed.",
  );
}

console.log(
  "Existing extractor-loop preservation audit: PASS",
);

/* ====================================================================== */
/* Parse changed/new TS/TSX before write.                                 */
/* ====================================================================== */

const terrainUtil =
  fs.readFileSync(
    payloadTerrainUtil,
    "utf8",
  );

const terrainOverlay =
  fs.readFileSync(
    payloadTerrainOverlay,
    "utf8",
  );

try {
  const require =
    createRequire(
      import.meta.url,
    );

  const ts =
    require(
      "typescript",
    );

  const targets = [
    [
      "realSceneExtractionService.ts",
      extraction,
      ts.ScriptKind.TS,
    ],
    [
      "forensicScenePipelineService.ts",
      pipeline,
      ts.ScriptKind.TS,
    ],
    [
      "Reconstruction3DViewer.tsx",
      viewer,
      ts.ScriptKind.TSX,
    ],
    [
      "RoadSceneEnvironment.tsx",
      environment,
      ts.ScriptKind.TSX,
    ],
    [
      "forensicTerrainSampling.ts",
      terrainUtil,
      ts.ScriptKind.TS,
    ],
    [
      "ForensicTerrainPlanOverlay.tsx",
      terrainOverlay,
      ts.ScriptKind.TSX,
    ],
  ];

  for (
    const [
      name,
      source,
      kind,
    ] of targets
  ) {
    const sourceFile =
      ts.createSourceFile(
        name,
        source,
        ts.ScriptTarget.Latest,
        true,
        kind,
      );

    const diagnostics =
      sourceFile.parseDiagnostics ??
      [];

    if (
      diagnostics.length >
      0
    ) {
      const details =
        diagnostics
          .slice(
            0,
            30,
          )
          .map(
            (
              diagnostic,
            ) => {
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

              return `${name}:${position.line + 1}:${position.character + 1} ${message}`;
            },
          )
          .join(
            "\n",
          );

      fail(
        `TS/TSX parse audit failed:\n${details}`,
      );
    }
  }

  console.log(
    "Scene completeness TS/TSX parse audit: PASS",
  );
} catch (
  error
) {
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

/* ====================================================================== */
/* Backup + write.                                                         */
/* ====================================================================== */

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
      extractionPath:
        path.relative(
          root,
          extractionPath,
        ),
      pipelinePath:
        path.relative(
          root,
          pipelinePath,
        ),
      viewerPath:
        path.relative(
          root,
          viewerPath,
        ),
      environmentPath:
        path.relative(
          root,
          environmentPath,
        ),
      terrainUtilPath:
        path.relative(
          root,
          terrainUtilPath,
        ),
      terrainOverlayPath:
        path.relative(
          root,
          terrainOverlayPath,
        ),
      originalExtraction,
      originalPipeline,
      originalViewer,
      originalEnvironment,
      originalTerrainUtil,
      originalTerrainOverlay,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(
    extractionPath,
    originalExtraction,
    "utf8",
  );

  fs.writeFileSync(
    pipelinePath,
    originalPipeline,
    "utf8",
  );

  fs.writeFileSync(
    viewerPath,
    originalViewer,
    "utf8",
  );

  fs.writeFileSync(
    environmentPath,
    originalEnvironment,
    "utf8",
  );

  if (
    originalTerrainUtil ===
    null
  ) {
    fs.rmSync(
      terrainUtilPath,
      {
        force: true,
      },
    );
  } else {
    fs.writeFileSync(
      terrainUtilPath,
      originalTerrainUtil,
      "utf8",
    );
  }

  if (
    originalTerrainOverlay ===
    null
  ) {
    fs.rmSync(
      terrainOverlayPath,
      {
        force: true,
      },
    );
  } else {
    fs.writeFileSync(
      terrainOverlayPath,
      originalTerrainOverlay,
      "utf8",
    );
  }

  fs.rmSync(
    statePath,
    {
      force: true,
    },
  );
}

fs.writeFileSync(
  extractionPath,
  extraction,
  "utf8",
);

fs.writeFileSync(
  pipelinePath,
  pipeline,
  "utf8",
);

fs.writeFileSync(
  viewerPath,
  viewer,
  "utf8",
);

fs.writeFileSync(
  environmentPath,
  environment,
  "utf8",
);

fs.writeFileSync(
  terrainUtilPath,
  terrainUtil,
  "utf8",
);

fs.writeFileSync(
  terrainOverlayPath,
  terrainOverlay,
  "utf8",
);

console.log(
  "PATCHED OSM relation-aware buildings / land-cover.",
);

console.log(
  "WROTE forensic terrain bilinear sampler + Three.js terrain mesh.",
);

console.log(
  "PATCHED 3D scene to consume the frozen DEM.",
);

console.log(
  "PATCHED 2D scene with orthographic DEM plan overlay.",
);

/* ====================================================================== */
/* Full build.                                                             */
/* ====================================================================== */

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
    "RoadSafe Scene Completeness + Terrain V4",
    "========================================",
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
    build.stdout ??
      "",
    "",
    "STDERR",
    "------",
    build.stderr ??
      "",
  ].join(
    "\n",
  );

fs.writeFileSync(
  buildLogPath,
  output,
  "utf8",
);

if (
  build.stdout
) {
  process.stdout.write(
    build.stdout,
  );
}

if (
  build.stderr
) {
  process.stderr.write(
    build.stderr,
  );
}

if (
  build.status ===
    null ||
  build.status !==
    0
) {
  console.error("");
  console.error(
    "Build failed. Restoring the previous scene pipeline...",
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
  "RoadSafe Scene Completeness + Terrain V4 installed successfully.",
);

console.log("");
console.log(
  "New scene behavior:",
);

console.log(
  "  building / land-cover multipolygon relations are normalized",
);

console.log(
  "  mapped trees/shrubs + derived mapped-cover vegetation remain available",
);

console.log(
  "  frozen DEM becomes a real 3D terrain mesh",
);

console.log(
  "  roads/buildings/vegetation use the same bilinear terrain height sampler",
);

console.log(
  "  3D participants/objects/evidence/collision are grounded to the DEM",
);

console.log(
  "  2D remains orthographic and gets a non-perspective DEM plan overlay",
);

console.log("");
console.log(
  "IMPORTANT: unmapped objects visible only in satellite imagery are not invented.",
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
  "  node revoke-scene-completeness-terrain-v4.mjs",
);
