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
    "last-scene-completeness-terrain-v2.json",
  );

const buildLogPath =
  path.join(
    backupRoot,
    "scene-completeness-terrain-v2-build.log",
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

if (
  !extraction.includes(
    "function expandRelationElementsForNormalization(",
  )
) {
  const insertionPoint =
    extraction.indexOf(
      "\nfunction calculateConfidence(",
    );

  if (
    insertionPoint <
    0
  ) {
    fail(
      "Could not locate extraction normalization insertion point. No files changed.",
    );
  }

  const helper =
`
/**
 * OSM buildings, parks, woodland and water polygons are frequently encoded as
 * multipolygon relations rather than standalone tagged ways.
 *
 * The current canonical geometry model stores simple polygons, so each outer
 * relation member is normalized as a synthetic tagged way. Inner rings are
 * intentionally skipped in V1 rather than fabricating filled geometry.
 */
function expandRelationElementsForNormalization(
  elements: OverpassElement[],
): OverpassElement[] {
  const expanded:
    OverpassElement[] =
    [];

  for (
    const element of
      elements
  ) {
    if (
      element.type !==
        "relation"
    ) {
      expanded.push(
        element,
      );

      continue;
    }

    const tags =
      element.tags ??
      {};

    const members =
      element.members ??
      [];

    members.forEach(
      (
        member,
        index,
      ) => {
        if (
          member.type !==
            "way" ||
          !Array.isArray(
            member.geometry,
          ) ||
          member.geometry.length <
            3 ||
          (
            member.role &&
            member.role !==
              "outer"
          )
        ) {
          return;
        }

        expanded.push({
          type:
            "way",
          id:
            -(
              element.id *
                1000 +
              index +
              1
            ),
          tags,
          geometry:
            member.geometry,
        });
      },
    );
  }

  return expanded;
}

`;

  extraction =
    extraction.slice(
      0,
      insertionPoint,
    ) +
    helper +
    extraction.slice(
      insertionPoint,
    );
}

const oldLoop =
`    for (const element of
      response.elements ?? []) {`;

const newLoop =
`    const normalizationElements =
      expandRelationElementsForNormalization(
        response.elements ??
          [],
      );

    for (const element of
      normalizationElements) {`;

if (
  extraction.includes(
    oldLoop,
  )
) {
  extraction =
    replaceOnce(
      extraction,
      oldLoop,
      newLoop,
      "real-scene normalization loop",
    );
} else if (
  !extraction.includes(
    "expandRelationElementsForNormalization(",
  ) ||
  !extraction.includes(
    "normalizationElements",
  )
) {
  fail(
    "Could not patch relation-aware extraction loop. No files changed.",
  );
}

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

  environment =
    replaceOnce(
      environment,
      importAnchor,
      `${importAnchor}
import ForensicTerrainPlanOverlay from "./ForensicTerrainPlanOverlay";`,
      "RoadSceneEnvironment real geometry import",
    );
}

const oldRealSceneRender =
`      <>
        <RealSceneGeometryLayer geometry={realSceneGeometry} settings={settings} />
        <WeatherOverlay settings={settings} />
      </>`;

const newRealSceneRender =
`      <>
        <ForensicTerrainPlanOverlay
          terrain={
            settings.useRealTerrain
              ? settings.forensicScene?.terrain
              : undefined
          }
        />

        <RealSceneGeometryLayer
          geometry={
            realSceneGeometry
          }
          settings={
            settings
          }
        />

        <WeatherOverlay
          settings={
            settings
          }
        />
      </>`;

if (
  environment.includes(
    oldRealSceneRender,
  )
) {
  environment =
    replaceOnce(
      environment,
      oldRealSceneRender,
      newRealSceneRender,
      "real-scene 2D render block",
    );
} else if (
  !environment.includes(
    "<ForensicTerrainPlanOverlay",
  )
) {
  fail(
    "Could not patch the 2D terrain plan overlay. No files changed.",
  );
}

/* ====================================================================== */
/* 3. 3D DEM mesh + shared terrain sampler.                               */
/* ====================================================================== */

if (
  !viewer.includes(
    'from "../../utils/forensicTerrainSampling";',
  )
) {
  const importAnchor =
`import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";`;

  viewer =
    replaceOnce(
      viewer,
      importAnchor,
`${importAnchor}
import {
  createForensicTerrainHeightSampler,
  createForensicTerrainMesh,
} from "../../utils/forensicTerrainSampling";`,
      "3D terrain utility import",
    );
}

const oldExtractedBlock =
`    const extracted = reconstruction.scene.realSceneGeometry?.status === "ready"
      ? reconstruction.scene.realSceneGeometry
      : null;
    if (extracted) {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ color: 0x4d5b4d, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.03;
      ground.receiveShadow = true;
      scene.add(ground);
      addRealSceneGeometryToThreeScene({
        scene,
        geometry: extracted,
        showPavements: reconstruction.scene.showPavements,
        showLaneMarkings: reconstruction.scene.showLaneMarkings,
        wet: reconstruction.scene.roadSurface === "Wet",
      });
    } else {
      addGeneratedRoad(scene, reconstruction, width, height);
    }`;

const newExtractedBlock =
`    const forensicTerrain =
      reconstruction.scene.useRealTerrain
        ? reconstruction.scene.forensicScene?.terrain
        : undefined;

    const terrainHeightAt =
      createForensicTerrainHeightSampler({
        terrain:
          forensicTerrain,
        sceneWidthMetres:
          width,
        sceneHeightMetres:
          height,
        exaggeration:
          reconstruction.scene.terrainExaggeration,
      });

    const worldPositionOnTerrain = (
      position:
        ReconstructionPosition,
      yOffset =
        0,
    ) => {
      const point =
        worldPosition(
          position,
          width,
          height,
          0,
        );

      point.y =
        terrainHeightAt(
          point.x,
          point.z,
        ) +
        yOffset;

      return point;
    };

    const extracted = reconstruction.scene.realSceneGeometry?.status === "ready"
      ? reconstruction.scene.realSceneGeometry
      : null;

    if (extracted) {
      const terrainMesh =
        createForensicTerrainMesh({
          terrain:
            forensicTerrain,
          sceneWidthMetres:
            width,
          sceneHeightMetres:
            height,
          exaggeration:
            reconstruction.scene.terrainExaggeration,
        });

      if (
        terrainMesh
      ) {
        scene.add(
          terrainMesh,
        );
      } else {
        const ground =
          new THREE.Mesh(
            new THREE.PlaneGeometry(
              width,
              height,
            ),
            new THREE.MeshStandardMaterial({
              color:
                0x4d5b4d,
              roughness:
                1,
            }),
          );

        ground.rotation.x =
          -Math.PI /
          2;

        ground.position.y =
          -0.03;

        ground.receiveShadow =
          true;

        scene.add(
          ground,
        );
      }

      addRealSceneGeometryToThreeScene({
        scene,
        geometry: extracted,
        heightAt:
          terrainHeightAt,
        showPavements: reconstruction.scene.showPavements,
        showLaneMarkings: reconstruction.scene.showLaneMarkings,
        wet: reconstruction.scene.roadSurface === "Wet",
      });
    } else {
      addGeneratedRoad(scene, reconstruction, width, height);
    }`;

if (
  viewer.includes(
    oldExtractedBlock,
  )
) {
  viewer =
    replaceOnce(
      viewer,
      oldExtractedBlock,
      newExtractedBlock,
      "3D extracted-scene ground block",
    );
} else if (
  !viewer.includes(
    "createForensicTerrainHeightSampler({",
  )
) {
  fail(
    "Could not patch the 3D extracted-scene terrain block. No files changed.",
  );
}

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
        "expandRelationElementsForNormalization",
        "normalizationElements",
      ],
    ],
    [
      "pipeline",
      pipeline,
      [
        "relation[\"building\"]",
        "relation[\"landuse\"]",
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
    "RoadSafe Scene Completeness + Terrain V2",
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
  "RoadSafe Scene Completeness + Terrain V2 installed successfully.",
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
  "  node revoke-scene-completeness-terrain-v2.mjs",
);
