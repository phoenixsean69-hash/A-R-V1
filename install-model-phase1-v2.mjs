import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();

const packagePath =
  path.join(root, "package.json");

const replacementRoot =
  path.join(
    root,
    "roadsafe-model-phase1-replacements",
  );

if (
  !fs.existsSync(packagePath)
) {
  console.error(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

if (
  packageJson.name !==
  "roadsafe-ar"
) {
  console.error(
    `Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const newFiles = [
  "src/engine/assets/participantAssetCatalog.ts",
  "src/engine/assets/participant3DModelFactory.ts",
  "src/components/reconstruction/Participant2DModel.tsx",
];

const modifiedFiles = [
  "src/types/reconstruction.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ForensicScenePreview.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
  "scripts/verify-participant-model-foundation.mjs",
  "package.json",
];

for (
  const relativePath of
  newFiles
) {
  const source =
    path.join(
      replacementRoot,
      relativePath,
    );

  if (
    !fs.existsSync(source)
  ) {
    console.error(
      `Missing replacement file: ${source}`,
    );
    process.exit(1);
  }
}

for (
  const relativePath of [
    "src/types/reconstruction.ts",
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    "src/components/reconstruction/ForensicScenePreview.tsx",
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  ]
) {
  if (
    !fs.existsSync(
      path.join(
        root,
        relativePath,
      ),
    )
  ) {
    console.error(
      `Required repo file is missing: ${relativePath}`,
    );
    process.exit(1);
  }
}

const timestamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupRoot =
  path.join(
    root,
    ".roadsafe-ui-backup",
    `model-phase1-${timestamp}`,
  );

const statePath =
  path.join(
    root,
    ".roadsafe-ui-backup",
    "last-model-phase1.json",
  );

const existedBefore = {};
const changedFiles = [];

/*
 * V1 could stop after writing the three new model files but before modifying
 * any existing repo file. Detect that exact partial state so V2 can treat
 * those files as V1 leftovers, not as pre-existing user work.
 */
const typeSourceBeforeInstall =
  fs.readFileSync(
    path.join(
      root,
      "src/types/reconstruction.ts",
    ),
    "utf8",
  );

const v1PartialFiles =
  new Set();

if (
  !typeSourceBeforeInstall.includes(
    "ReconstructionParticipantAssetId",
  )
) {
  for (
    const relativePath of
    newFiles
  ) {
    const currentPath =
      path.join(
        root,
        relativePath,
      );

    const payloadPath =
      path.join(
        replacementRoot,
        relativePath,
      );

    if (
      fs.existsSync(currentPath) &&
      fs.existsSync(payloadPath) &&
      fs.readFileSync(
        currentPath,
        "utf8",
      ) ===
        fs.readFileSync(
          payloadPath,
          "utf8",
        )
    ) {
      v1PartialFiles.add(
        relativePath,
      );
    }
  }
}

if (
  v1PartialFiles.size > 0
) {
  console.log(
    `Detected ${v1PartialFiles.size} leftover file(s) from the interrupted V1 install. V2 will repair them safely.`,
  );
}

function backup(
  relativePath,
) {
  if (
    relativePath in
    existedBefore
  ) {
    return;
  }

  const target =
    path.join(
      root,
      relativePath,
    );

  const exists =
    fs.existsSync(target);

  const treatAsInterruptedV1NewFile =
    v1PartialFiles.has(
      relativePath,
    );

  existedBefore[
    relativePath
  ] =
    exists &&
    !treatAsInterruptedV1NewFile;

  if (
    !exists ||
    treatAsInterruptedV1NewFile
  ) {
    return;
  }

  const destination =
    path.join(
      backupRoot,
      relativePath,
    );

  fs.mkdirSync(
    path.dirname(
      destination,
    ),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    target,
    destination,
  );
}

function write(
  relativePath,
  content,
) {
  backup(relativePath);

  const target =
    path.join(
      root,
      relativePath,
    );

  fs.mkdirSync(
    path.dirname(
      target,
    ),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );

  if (
    !changedFiles.includes(
      relativePath,
    )
  ) {
    changedFiles.push(
      relativePath,
    );
  }
}

function copyReplacement(
  relativePath,
) {
  backup(relativePath);

  const source =
    path.join(
      replacementRoot,
      relativePath,
    );

  const target =
    path.join(
      root,
      relativePath,
    );

  fs.mkdirSync(
    path.dirname(
      target,
    ),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    source,
    target,
  );

  if (
    !changedFiles.includes(
      relativePath,
    )
  ) {
    changedFiles.push(
      relativePath,
    );
  }

  console.log(
    `WROTE ${relativePath}`,
  );
}

function replaceOrFail(
  source,
  oldValue,
  newValue,
  label,
) {
  if (
    !source.includes(
      oldValue,
    )
  ) {
    console.error(
      `Could not locate ${label}.`,
    );
    process.exit(1);
  }

  return source.replace(
    oldValue,
    newValue,
  );
}

for (
  const relativePath of
  newFiles
) {
  copyReplacement(
    relativePath,
  );
}

/*
 * ---------------------------------------------------------
 * 1. Canonical participant asset IDs in reconstruction state
 * ---------------------------------------------------------
 */
{
  const relativePath =
    "src/types/reconstruction.ts";

  let source =
    fs.readFileSync(
      path.join(
        root,
        relativePath,
      ),
      "utf8",
    );

  /*
   * Add the model-id union before ReconstructionEntityColour.
   * We intentionally search by declaration name rather than exact surrounding
   * whitespace because this repo has been through several formatter/UI passes.
   */
  if (
    !source.includes(
      "export type ReconstructionParticipantAssetId",
    )
  ) {
    const colourTypeIndex =
      source.indexOf(
        "export type ReconstructionEntityColour",
      );

    if (
      colourTypeIndex < 0
    ) {
      console.error(
        "Could not locate ReconstructionEntityColour declaration.",
      );
      restoreAll();
      process.exit(1);
    }

    const assetType =
`export type ReconstructionParticipantAssetId =
  | "car-sedan-generic"
  | "car-hatchback-generic"
  | "car-suv-generic"
  | "car-pickup-generic"
  | "bus-minibus-generic"
  | "bus-city-generic"
  | "truck-rigid-generic"
  | "truck-articulated-generic"
  | "truck-lorry-generic"
  | "truck-tractor-generic"
  | "two-wheel-motorcycle-generic"
  | "two-wheel-bicycle-generic"
  | "human-adult-generic"
  | "human-adult-male-generic"
  | "human-adult-female-generic"
  | "human-child-generic";

`;

    source =
      source.slice(
        0,
        colourTypeIndex,
      ) +
      assetType +
      source.slice(
        colourTypeIndex,
      );
  }

  /*
   * Patch only the ReconstructionEntity interface body.
   * V1 looked for two exact adjacent lines. That was too brittle.
   */
  if (
    !source.includes(
      "assetId?: ReconstructionParticipantAssetId;",
    )
  ) {
    const interfaceStart =
      source.indexOf(
        "export interface ReconstructionEntity",
      );

    const nextDeclaration =
      source.indexOf(
        "export type PhysicsCollisionShape",
        interfaceStart,
      );

    if (
      interfaceStart < 0 ||
      nextDeclaration < 0
    ) {
      console.error(
        "Could not isolate ReconstructionEntity interface.",
      );
      restoreAll();
      process.exit(1);
    }

    const entityBlock =
      source.slice(
        interfaceStart,
        nextDeclaration,
      );

    const typeLineMatch =
      entityBlock.match(
        /^(\s*)type\s*:\s*ReconstructionEntityType\s*;\s*$/m,
      );

    if (
      !typeLineMatch ||
      typeLineMatch.index === undefined
    ) {
      console.error(
        "Could not locate the participant type field inside ReconstructionEntity.",
      );
      restoreAll();
      process.exit(1);
    }

    const absoluteInsertStart =
      interfaceStart +
      typeLineMatch.index;

    const matchedLine =
      typeLineMatch[0];

    const lineEnd =
      source.indexOf(
        "\n",
        absoluteInsertStart,
      );

    const insertionPoint =
      lineEnd >= 0
        ? lineEnd + 1
        : absoluteInsertStart +
          matchedLine.length;

    const indent =
      typeLineMatch[1] ||
      "  ";

    const insertion =
`${indent}
/**
${indent} * Shared generic visual asset used by 2D, 3D and later AR.
${indent} * Older cases may omit it; the asset registry resolves a type-specific default.
${indent} */
${indent}assetId?: ReconstructionParticipantAssetId;
`;

    source =
      source.slice(
        0,
        insertionPoint,
      ) +
      insertion +
      source.slice(
        insertionPoint,
      );
  }

  write(
    relativePath,
    source,
  );

  console.log(
    `CHANGED ${relativePath}`,
  );
}

/*
 * ---------------------------------------------------------
 * 2. AccidentReconstructionEditor:
 *    shared 2D model + asset selector
 * ---------------------------------------------------------
 */
{
  const relativePath =
    "src/components/reconstruction/AccidentReconstructionEditor.tsx";

  let source =
    fs.readFileSync(
      path.join(
        root,
        relativePath,
      ),
      "utf8",
    );

  if (
    !source.includes(
      'import Participant2DModel from "./Participant2DModel";',
    )
  ) {
    source =
      replaceOrFail(
        source,
        'import SceneSettingsPanel from "./SceneSettingsPanel";',
        `import SceneSettingsPanel from "./SceneSettingsPanel";
import Participant2DModel from "./Participant2DModel";`,
        "SceneSettingsPanel import",
      );
  }

  if (
    !source.includes(
      'from "../../engine/assets/participantAssetCatalog";',
    )
  ) {
    const anchor =
`import { getSceneObjectCatalogItem } from "../../data/sceneObjectCatalog";`;

    source =
      replaceOrFail(
        source,
        anchor,
`${anchor}
import {
  getDefaultParticipantAssetId,
  getParticipantAssetDefinition,
  getParticipantAssetsForType,
} from "../../engine/assets/participantAssetCatalog";`,
        "scene object catalog import",
      );
  }

  if (
    !source.includes(
      "ReconstructionParticipantAssetId,",
    )
  ) {
    source =
      replaceOrFail(
        source,
        "  ReconstructionPosition,\n",
        "  ReconstructionPosition,\n  ReconstructionParticipantAssetId,\n",
        "reconstruction type import list",
      );
  }

  /*
   * Remove the editor-only hard-coded display-size table.
   */
  const dimensionsStart =
    source.indexOf(
      "function getVehicleDimensions(",
    );

  const dimensionsEnd =
    source.indexOf(
      "function getPathPointColour(",
      dimensionsStart,
    );

  if (
    dimensionsStart >= 0 &&
    dimensionsEnd >
      dimensionsStart
  ) {
    source =
      source.slice(
        0,
        dimensionsStart,
      ) +
      source.slice(
        dimensionsEnd,
      );
  }

  /*
   * Replace the entire old procedural ParticipantShape with the shared renderer.
   */
  const shapeStart =
    source.indexOf(
      "function ParticipantShape(",
    );

  const shapeEnd =
    source.indexOf(
      "function ImpactEffectOverlay(",
      shapeStart,
    );

  if (
    shapeStart < 0 ||
    shapeEnd < 0
  ) {
    console.error(
      "Could not isolate ParticipantShape.",
    );
    process.exit(1);
  }

  const newShape =
`function ParticipantShape({
  participant,
  selected,
}: ParticipantShapeProps) {
  return (
    <Participant2DModel
      participant={participant}
      selected={selected}
      showLabel
    />
  );
}

`;

  source =
    source.slice(
      0,
      shapeStart,
    ) +
    newShape +
    source.slice(
      shapeEnd,
    );

  /*
   * Type changes reset the model to the default model for that broad type.
   */
  const oldTypeChange =
`      updateParticipant(participant.id, {
        type,
        estimatedSpeedKmh: getDefaultSpeed(type),
        role: getDefaultRole(type),
        injured: isHumanParticipant(type) ? participant.injured ?? false : false,
      });`;

  const newTypeChange =
`      updateParticipant(participant.id, {
        type,
        assetId:
          getDefaultParticipantAssetId(
            type,
          ),
        estimatedSpeedKmh: getDefaultSpeed(type),
        role: getDefaultRole(type),
        injured: isHumanParticipant(type) ? participant.injured ?? false : false,
      });`;

  if (
    source.includes(
      oldTypeChange,
    )
  ) {
    source =
      source.replace(
        oldTypeChange,
        newTypeChange,
      );
  } else if (
    !source.includes(
      "assetId:\n          getDefaultParticipantAssetId",
    )
  ) {
    console.error(
      "Could not patch participant type change.",
    );
    process.exit(1);
  }

  /*
   * Add Model selector immediately between Type and Colour.
   */
  if (
    !source.includes(
      "<span>Model</span>",
    )
  ) {
    const anchor =
`                      <label>
                        <span>Colour</span>
                        <select`;

    if (
      !source.includes(
        anchor,
      )
    ) {
      console.error(
        "Could not locate Colour selector for Model insertion.",
      );
      process.exit(1);
    }

    const modelField =
`                      <label>
                        <span>Model</span>
                        <select
                          value={
                            selectedParticipant.assetId ??
                            getDefaultParticipantAssetId(
                              selectedParticipant.type,
                            )
                          }
                          onChange={(event) =>
                            updateParticipant(
                              selectedParticipant.id,
                              {
                                assetId:
                                  event.target
                                    .value as ReconstructionParticipantAssetId,
                              },
                            )
                          }
                        >
                          {getParticipantAssetsForType(
                            selectedParticipant.type,
                          ).map((asset) => (
                            <option
                              key={asset.id}
                              value={asset.id}
                            >
                              {asset.shortLabel}
                            </option>
                          ))}
                        </select>
                      </label>
`;

    source =
      source.replace(
        anchor,
        modelField +
          anchor,
      );
  }

  /*
   * Roster uses the actual model name rather than only the broad type.
   */
  source =
    source.replace(
      /\{participant\.type\}\s*·\s*\{participantState\.speedKmh\.toFixed\(1\)\}\s*km\/h/g,
      "{getParticipantAssetDefinition(participant).shortLabel} · {participantState.speedKmh.toFixed(1)} km/h",
    );

  write(
    relativePath,
    source,
  );

  console.log(
    `CHANGED ${relativePath}`,
  );
}

/*
 * ---------------------------------------------------------
 * 3. ForensicScenePreview:
 *    same top-down model system
 * ---------------------------------------------------------
 */
{
  const relativePath =
    "src/components/reconstruction/ForensicScenePreview.tsx";

  let source =
    fs.readFileSync(
      path.join(
        root,
        relativePath,
      ),
      "utf8",
    );

  if (
    !source.includes(
      'import { Participant2DSceneGlyph } from "./Participant2DModel";',
    )
  ) {
    const anchor =
`import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";`;

    source =
      replaceOrFail(
        source,
        anchor,
`${anchor}
import { Participant2DSceneGlyph } from "./Participant2DModel";`,
        "ForensicScenePreview world-dimensions import",
      );
  }

  const glyphStart =
    source.indexOf(
      "function ParticipantGlyph(",
    );

  const glyphEnd =
    source.indexOf(
      "function RoadGeometry(",
      glyphStart,
    );

  if (
    glyphStart < 0 ||
    glyphEnd < 0
  ) {
    console.error(
      "Could not isolate ForensicScenePreview ParticipantGlyph.",
    );
    process.exit(1);
  }

  const replacement =
`function ParticipantGlyph({
  participant,
  position,
  rotation,
  worldDimensions,
}: {
  participant: ReconstructionVehicle;
  position: ReconstructionPosition;
  rotation: number;
  worldDimensions: {
    widthMetres: number;
    heightMetres: number;
  };
}) {
  return (
    <Participant2DSceneGlyph
      participant={participant}
      position={position}
      rotation={rotation}
      worldDimensions={worldDimensions}
    />
  );
}

`;

  source =
    source.slice(
      0,
      glyphStart,
    ) +
    replacement +
    source.slice(
      glyphEnd,
    );

  const callAnchor =
`            rotation={state.rotation}
          />`;

  source =
    replaceOrFail(
      source,
      callAnchor,
`            rotation={state.rotation}
            worldDimensions={
              getReconstructionWorldDimensions(
                reconstruction,
              )
            }
          />`,
      "ForensicScenePreview ParticipantGlyph call",
    );

  write(
    relativePath,
    source,
  );

  console.log(
    `CHANGED ${relativePath}`,
  );
}

/*
 * ---------------------------------------------------------
 * 4. Reconstruction3DViewer:
 *    generic RoadSafe model factory is now primary
 * ---------------------------------------------------------
 */
{
  const relativePath =
    "src/components/reconstruction/Reconstruction3DViewer.tsx";

  let source =
    fs.readFileSync(
      path.join(
        root,
        relativePath,
      ),
      "utf8",
    );

  source =
    source.replace(
      'import { THIRD_PARTY_3D_ASSET_NOTICE } from "../../data/realisticAssetCatalog";\n',
      "",
    );

  source =
    source.replace(
      "  loadRealisticParticipantModel,\n",
      "",
    );

  if (
    !source.includes(
      'from "../../engine/assets/participant3DModelFactory";',
    )
  ) {
    const anchor =
`import { getParticipantPotholeEffect } from "../../utils/reconstructionSurfaceEffects";`;

    source =
      replaceOrFail(
        source,
        anchor,
`${anchor}
import {
  createGenericParticipant3DModel,
} from "../../engine/assets/participant3DModelFactory";
import {
  getParticipantPhysicalDimensions,
} from "../../engine/assets/participantAssetCatalog";`,
        "3D surface-effect import",
      );
  }

  /*
   * Shared physical dimensions.
   */
  const dimensionStart =
    source.indexOf(
      "function participantDimensions(",
    );

  const dimensionEnd =
    source.indexOf(
      "function worldPosition(",
      dimensionStart,
    );

  if (
    dimensionStart < 0 ||
    dimensionEnd < 0
  ) {
    console.error(
      "Could not isolate participantDimensions.",
    );
    process.exit(1);
  }

  const dimensionFunction =
`function participantDimensions(
  participant: ReconstructionVehicle,
): [number, number, number] {
  const dimensions =
    getParticipantPhysicalDimensions(
      participant,
    );

  return [
    dimensions.lengthMetres,
    dimensions.heightMetres,
    dimensions.widthMetres,
  ];
}

`;

  source =
    source.slice(
      0,
      dimensionStart,
    ) +
    dimensionFunction +
    source.slice(
      dimensionEnd,
    );

  /*
   * Replace 3D fallback model implementation with the shared RoadSafe factory.
   */
  const fallbackStart =
    source.indexOf(
      "function createFallbackParticipantModel(",
    );

  const fallbackEnd =
    source.indexOf(
      "function createParticipantHolder(",
      fallbackStart,
    );

  if (
    fallbackStart < 0 ||
    fallbackEnd < 0
  ) {
    console.error(
      "Could not isolate createFallbackParticipantModel.",
    );
    process.exit(1);
  }

  const fallback =
`function createFallbackParticipantModel(
  participant: ReconstructionVehicle,
): THREE.Group {
  return createGenericParticipant3DModel(
    participant,
    "Medium",
  );
}

`;

  source =
    source.slice(
      0,
      fallbackStart,
    ) +
    fallback +
    source.slice(
      fallbackEnd,
    );

  /*
   * Stop replacing our own generic model with manufacturer-specific third-party
   * models. Scene-object prototypes may still use the old service for now.
   */
  const loadStart =
    source.indexOf(
      "      void loadRealisticParticipantModel(",
    );

  if (
    loadStart >= 0
  ) {
    const loadEndToken =
      "        .catch(() => settleAsset(true));";

    const loadEnd =
      source.indexOf(
        loadEndToken,
        loadStart,
      );

    if (
      loadEnd < 0
    ) {
      console.error(
        "Could not isolate third-party participant loading block.",
      );
      process.exit(1);
    }

    source =
      source.slice(
        0,
        loadStart,
      ) +
      "      settleAsset(false);" +
      source.slice(
        loadEnd +
          loadEndToken.length,
      );
  }

  /*
   * Status badge now reports RoadSafe generic participant models honestly.
   */
  source =
    source.replace(
      '          title={THIRD_PARTY_3D_ASSET_NOTICE}\n',
      "",
    );

  source =
    source.replace(
      /\? `Loading realistic assets \$\{assetStatus\.loaded\}\/\$\{assetStatus\.total\}`\s*:\s*assetStatus\.failed > 0\s*\? `Realistic assets ready[^`]*`\s*:\s*"Realistic GLB\/PBR assets ready"/,
      `? \`Loading model assets \${assetStatus.loaded}/\${assetStatus.total}\`
            : assetStatus.failed > 0
              ? \`RoadSafe models ready · \${assetStatus.failed} scene fallback(s)\`
              : "RoadSafe generic model library ready"`,
    );

  write(
    relativePath,
    source,
  );

  console.log(
    `CHANGED ${relativePath}`,
  );
}

/*
 * ---------------------------------------------------------
 * 5. Verification
 * ---------------------------------------------------------
 */
{
  const relativePath =
    "scripts/verify-participant-model-foundation.mjs";

  const verifier =
`import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const required = [
  "src/engine/assets/participantAssetCatalog.ts",
  "src/engine/assets/participant3DModelFactory.ts",
  "src/components/reconstruction/Participant2DModel.tsx",
  "src/types/reconstruction.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ForensicScenePreview.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
];

const failures = [];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push("Missing " + relativePath);
  }
}

const catalog = fs.readFileSync(
  path.join(
    root,
    "src/engine/assets/participantAssetCatalog.ts",
  ),
  "utf8",
);

for (const assetId of [
  "car-sedan-generic",
  "car-hatchback-generic",
  "car-suv-generic",
  "car-pickup-generic",
  "bus-minibus-generic",
  "bus-city-generic",
  "truck-rigid-generic",
  "truck-articulated-generic",
  "truck-lorry-generic",
  "truck-tractor-generic",
  "two-wheel-motorcycle-generic",
  "two-wheel-bicycle-generic",
  "human-adult-generic",
  "human-adult-male-generic",
  "human-adult-female-generic",
  "human-child-generic",
]) {
  if (!catalog.includes(assetId)) {
    failures.push(
      "Asset catalog missing " +
        assetId,
    );
  }
}

const types = fs.readFileSync(
  path.join(
    root,
    "src/types/reconstruction.ts",
  ),
  "utf8",
);

if (
  !types.includes(
    "assetId?: ReconstructionParticipantAssetId",
  )
) {
  failures.push(
    "Reconstruction participants do not expose assetId.",
  );
}

const editor = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  ),
  "utf8",
);

if (
  !editor.includes(
    "Participant2DModel",
  )
) {
  failures.push(
    "2D editor is not using Participant2DModel.",
  );
}

if (
  !editor.includes(
    "<span>Model</span>",
  )
) {
  failures.push(
    "Participant inspector has no Model selector.",
  );
}

const preview = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/ForensicScenePreview.tsx",
  ),
  "utf8",
);

if (
  !preview.includes(
    "Participant2DSceneGlyph",
  )
) {
  failures.push(
    "Forensic preview is not using the shared 2D model.",
  );
}

const viewer = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  ),
  "utf8",
);

if (
  !viewer.includes(
    "createGenericParticipant3DModel",
  )
) {
  failures.push(
    "3D viewer is not using the RoadSafe generic model factory.",
  );
}

if (
  viewer.includes(
    "loadRealisticParticipantModel(",
  )
) {
  failures.push(
    "3D viewer still actively loads manufacturer-specific participant models.",
  );
}

console.log(
  "Participant model foundation audit.",
);

if (
  failures.length > 0
) {
  for (
    const failure of failures
  ) {
    console.error(
      "FAIL: " + failure,
    );
  }

  process.exit(1);
}

console.log(
  "PASS: one generic participant asset foundation is shared by 2D and 3D.",
);
`;

  write(
    relativePath,
    verifier,
  );

  console.log(
    `WROTE ${relativePath}`,
  );
}

backup(
  "package.json",
);

const nextPackage =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

nextPackage.scripts =
  nextPackage.scripts ?? {};

nextPackage.scripts[
  "models:verify"
] =
  "node scripts/verify-participant-model-foundation.mjs";

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(
    nextPackage,
    null,
    2,
  )}\n`,
  "utf8",
);

if (
  !changedFiles.includes(
    "package.json",
  )
) {
  changedFiles.push(
    "package.json",
  );
}

console.log(
  "CHANGED package.json",
);

function restoreAll() {
  console.log(
    "\nRestoring pre-model Phase 1 files...",
  );

  for (
    const relativePath of
    changedFiles
  ) {
    const target =
      path.join(
        root,
        relativePath,
      );

    const backupPath =
      path.join(
        backupRoot,
        relativePath,
      );

    if (
      existedBefore[
        relativePath
      ]
    ) {
      if (
        !fs.existsSync(
          backupPath,
        )
      ) {
        continue;
      }

      fs.mkdirSync(
        path.dirname(
          target,
        ),
        {
          recursive: true,
        },
      );

      fs.copyFileSync(
        backupPath,
        target,
      );

      console.log(
        `RESTORED ${relativePath}`,
      );
    } else if (
      fs.existsSync(
        target,
      )
    ) {
      fs.rmSync(
        target,
        {
          force: true,
        },
      );

      console.log(
        `REMOVED ${relativePath}`,
      );
    }
  }
}

try {
  execSync(
    "node --check scripts/verify-participant-model-foundation.mjs",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );

  execSync(
    "npm run models:verify",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );

  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  restoreAll();

  console.error(
    "\nModel Phase 1 V2 failed verification/build. All changes were restored.",
  );

  process.exit(1);
}

fs.mkdirSync(
  path.dirname(
    statePath,
  ),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date()
          .toISOString(),
      backupRoot,
      changedFiles,
      existedBefore,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
RoadSafe Model Phase 1 V2 installed successfully.

Shared generic library:
- Sedan
- Hatchback
- SUV
- Pickup
- Minibus
- Bus
- Rigid Truck
- Articulated Truck
- Lorry
- Tractor
- Motorcycle
- Bicycle
- Generic Adult
- Adult Male
- Adult Female
- Child

What changed:
- one canonical model assetId on participants;
- one shared physical dimension catalog;
- new top-down 2D model renderer;
- forensic preview uses the same 2D renderer;
- new RoadSafe-built generic 3D model factory;
- active 3D participant rendering no longer swaps in Toyota/Isuzu prototype models;
- participant inspector now has a Model selector;
- existing cases remain valid because assetId is optional and resolves to defaults.

Verify:
  npm run models:verify

Start:
  npm run dev

Rollback:
  node revoke-model-phase1.mjs
`);
