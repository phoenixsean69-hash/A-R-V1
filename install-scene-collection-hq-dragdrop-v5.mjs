import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const packagePath = path.join(root, "package.json");

const editorPath = path.join(
  root,
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
);

const viewerPath = path.join(
  root,
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
);

const pointZPath = path.join(
  root,
  "src/utils/reconstructionPointZIntegration.ts",
);

const filesToInstall = [
  ["sceneAssetDragData.ts", "src/engine/assets/sceneAssetDragData.ts"],
  [
    "premiumParticipantAssetManifest.ts",
    "src/engine/assets/premiumParticipantAssetManifest.ts",
  ],
  [
    "premiumParticipantAssetService.ts",
    "src/services/premiumParticipantAssetService.ts",
  ],
  [
    "ParticipantAssetPreview3D.tsx",
    "src/components/reconstruction/ParticipantAssetPreview3D.tsx",
  ],
  [
    "SceneCollectionAssetBrowser.tsx",
    "src/components/reconstruction/SceneCollectionAssetBrowser.tsx",
  ],
  [
    "sceneCollectionAssetBrowser.css",
    "src/components/reconstruction/sceneCollectionAssetBrowser.css",
  ],
  [
    "prepare-premium-participant-assets.mjs",
    "scripts/prepare-premium-participant-assets.mjs",
  ],
];

const runtimeRoot = path.join(
  root,
  "public/assets/roadsafe-premium-participants",
);

const backupRoot = path.join(root, ".roadsafe-ui-backup");

const statePath = path.join(
  backupRoot,
  "last-scene-collection-hq-dragdrop-v5.json",
);

const buildLogPath = path.join(
  backupRoot,
  "scene-collection-hq-dragdrop-v5-build.log",
);

let rollbackOnFail = null;

function fail(message) {
  console.error(message);

  if (rollbackOnFail) {
    try {
      rollbackOnFail();
    } catch (restoreError) {
      console.error(
        `Automatic rollback also failed: ${String(restoreError)}`,
      );
    }
  }

  process.exit(1);
}

function restoreAfterUnexpectedInstallerError(
  error,
) {
  console.error("");
  console.error(
    `Unexpected installer error: ${String(
      error instanceof Error
        ? error.stack ?? error.message
        : error,
    )}`,
  );

  if (rollbackOnFail) {
    try {
      rollbackOnFail();

      console.error(
        "Automatic rollback completed after unexpected installer error.",
      );
    } catch (restoreError) {
      console.error(
        `Automatic rollback also failed: ${String(restoreError)}`,
      );
    }
  }

  process.exit(1);
}

process.on(
  "uncaughtException",
  restoreAfterUnexpectedInstallerError,
);

process.on(
  "unhandledRejection",
  restoreAfterUnexpectedInstallerError,
);

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    fail(`Could not locate ${label}. No files changed.`);
  }

  return source.replace(before, after);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureNamedTypeImport(
  source,
  modulePath,
  symbol,
) {
  const modulePattern =
    escapeRegExp(modulePath);

  const importPattern =
    new RegExp(
      `import\\s+type\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*["']${modulePattern}["']\\s*;?`,
      "m",
    );

  const match =
    source.match(
      importPattern,
    );

  if (!match) {
    const insertionPoint =
      source.indexOf("\n\n");

    const statement =
      `import type { ${symbol} } from "${modulePath}";\n`;

    return insertionPoint >= 0
      ? source.slice(
          0,
          insertionPoint + 2,
        ) +
          statement +
          source.slice(
            insertionPoint + 2,
          )
      : statement + source;
  }

  const full =
    match[0];

  const body =
    match[1];

  const hasSymbol =
    new RegExp(
      `(?:^|[,\\s])${escapeRegExp(symbol)}(?:[,\\s]|$)`,
    ).test(body);

  if (hasSymbol) {
    return source;
  }

  const closingIndex =
    full.lastIndexOf("}");

  if (closingIndex < 0) {
    fail(
      `Could not patch type import ${symbol} from ${modulePath}.`,
    );
  }

  const prefix =
    full
      .slice(
        0,
        closingIndex,
      )
      .replace(
        /\s*$/,
        "",
      );

  const separator =
    prefix.endsWith(",")
      ? ""
      : ",";

  const replacement =
    `${prefix}${separator}\n  ${symbol},\n${full.slice(
      closingIndex,
    )}`;

  return source.replace(
    full,
    replacement,
  );
}

function ensurePendingPlacementAssetId(
  source,
) {
  if (
    source.includes(
      "assetId?: ReconstructionParticipantAssetId;",
    )
  ) {
    return source;
  }

  /*
   * Structural interface scan instead of a whitespace-sensitive regex.
   * This works whether the declaration is one-line, multiline, CRLF/LF,
   * or has comments/extra fields.
   */
  const nameIndex =
    source.indexOf(
      "PendingParticipantPlacement",
    );

  if (nameIndex < 0) {
    fail(
      "Could not locate PendingParticipantPlacement declaration.",
    );
  }

  const interfaceIndex =
    source.lastIndexOf(
      "interface",
      nameIndex,
    );

  if (
    interfaceIndex < 0 ||
    nameIndex - interfaceIndex > 80
  ) {
    fail(
      "PendingParticipantPlacement exists, but it is not an interface declaration.",
    );
  }

  const openingBrace =
    source.indexOf(
      "{",
      nameIndex,
    );

  if (openingBrace < 0) {
    fail(
      "Could not locate PendingParticipantPlacement opening brace.",
    );
  }

  let depth = 0;
  let closingBrace = -1;

  for (
    let index = openingBrace;
    index < source.length;
    index += 1
  ) {
    const character =
      source[index];

    if (character === "{") {
      depth += 1;
    } else if (
      character === "}"
    ) {
      depth -= 1;

      if (depth === 0) {
        closingBrace =
          index;
        break;
      }
    }
  }

  if (closingBrace < 0) {
    fail(
      "Could not locate PendingParticipantPlacement closing brace.",
    );
  }

  const interfaceBody =
    source.slice(
      openingBrace + 1,
      closingBrace,
    );

  if (
    !/\btype\s*:\s*ReconstructionVehicleType\s*;?/.test(
      interfaceBody,
    ) ||
    !/\bindex\s*:\s*number\s*;?/.test(
      interfaceBody,
    )
  ) {
    fail(
      "PendingParticipantPlacement declaration was found, but its expected type/index fields were not found.",
    );
  }

  const lineStart =
    source.lastIndexOf(
      "\n",
      closingBrace - 1,
    ) + 1;

  const closingIndent =
    source
      .slice(
        lineStart,
        closingBrace,
      )
      .match(
        /^\s*/,
      )?.[0] ?? "";

  const fieldIndent =
    `${closingIndent}  `;

  const insertion =
    `${fieldIndent}assetId?: ReconstructionParticipantAssetId;\n`;

  return (
    source.slice(
      0,
      closingBrace,
    ) +
    insertion +
    source.slice(
      closingBrace,
    )
  );
}

function findBalancedClosingBrace(
  source,
  openingBrace,
  label,
) {
  if (
    openingBrace < 0 ||
    source[openingBrace] !== "{"
  ) {
    fail(
      `Could not locate opening brace for ${label}.`,
    );
  }

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (
    let index = openingBrace;
    index < source.length;
    index += 1
  ) {
    const character =
      source[index];

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
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  fail(
    `Could not locate closing brace for ${label}.`,
  );
}

function ensureImportBeforeInterface(
  source,
  interfaceName,
  importStatement,
  uniqueMarker,
) {
  const interfaceIndex =
    source.indexOf(
      `interface ${interfaceName}`,
    );

  if (interfaceIndex < 0) {
    fail(
      `Could not locate ${interfaceName}.`,
    );
  }

  const importRegion =
    source.slice(
      0,
      interfaceIndex,
    );

  if (
    importRegion.includes(
      uniqueMarker,
    )
  ) {
    return source;
  }

  return (
    source.slice(
      0,
      interfaceIndex,
    ) +
    `${importStatement.trim()}\n\n` +
    source.slice(
      interfaceIndex,
    )
  );
}

function ensureInterfaceFields(
  source,
  interfaceName,
  uniqueMarker,
  fields,
) {
  if (
    source.includes(
      uniqueMarker,
    )
  ) {
    return source;
  }

  const interfaceIndex =
    source.indexOf(
      `interface ${interfaceName}`,
    );

  if (interfaceIndex < 0) {
    fail(
      `Could not locate ${interfaceName} declaration.`,
    );
  }

  const openingBrace =
    source.indexOf(
      "{",
      interfaceIndex,
    );

  const closingBrace =
    findBalancedClosingBrace(
      source,
      openingBrace,
      interfaceName,
    );

  return (
    source.slice(
      0,
      closingBrace,
    ) +
    `\n${fields.trimEnd()}\n` +
    source.slice(
      closingBrace,
    )
  );
}

function ensureViewerDestructuredProps(
  source,
  propNames,
) {
  const functionIndex =
    source.indexOf(
      "function Reconstruction3DViewer",
    );

  if (functionIndex < 0) {
    fail(
      "Could not locate Reconstruction3DViewer function.",
    );
  }

  const parameterOpenParen =
    source.indexOf(
      "(",
      functionIndex,
    );

  const destructureOpen =
    source.indexOf(
      "{",
      parameterOpenParen,
    );

  const destructureClose =
    findBalancedClosingBrace(
      source,
      destructureOpen,
      "Reconstruction3DViewer parameter destructuring",
    );

  const destructure =
    source.slice(
      destructureOpen + 1,
      destructureClose,
    );

  const missing =
    propNames.filter(
      (propName) =>
        !new RegExp(
          `\\b${escapeRegExp(
            propName,
          )}\\b`,
        ).test(
          destructure,
        ),
    );

  if (
    missing.length ===
    0
  ) {
    return source;
  }

  const insertion =
    missing
      .map(
        (name) =>
          `  ${name},`,
      )
      .join(
        "\n",
      );

  return (
    source.slice(
      0,
      destructureClose,
    ) +
    `${insertion}\n` +
    source.slice(
      destructureClose,
    )
  );
}

function ensureViewerDropRefs(
  source,
) {
  if (
    source.includes(
      "onDropParticipantAssetRef",
    )
  ) {
    return source;
  }

  const match =
    source.match(
      /^([ \t]*)const\s+onSelectRef\s*=\s*useRef\([^;\n]*\);[ \t]*$/m,
    );

  if (!match) {
    fail(
      "Could not locate onSelectRef declaration structurally.",
    );
  }

  const indent =
    match[1];

  const replacement =
`${match[0]}
${indent}const onDropParticipantAssetRef =
${indent}  useRef(onDropParticipantAsset);
${indent}const onDropSceneObjectRef =
${indent}  useRef(onDropSceneObject);

${indent}useEffect(() => {
${indent}  onDropParticipantAssetRef.current =
${indent}    onDropParticipantAsset;
${indent}}, [onDropParticipantAsset]);

${indent}useEffect(() => {
${indent}  onDropSceneObjectRef.current =
${indent}    onDropSceneObject;
${indent}}, [onDropSceneObject]);`;

  return source.replace(
    match[0],
    replacement,
  );
}

function ensurePremiumParticipantLoad(
  source,
) {
  if (
    source.includes(
      "loadPremiumParticipantModel(participant)",
    )
  ) {
    return source;
  }

  const loopIndex =
    source.indexOf(
      "reconstruction.vehicles.forEach",
    );

  if (loopIndex < 0) {
    fail(
      "Could not locate reconstruction participant render loop.",
    );
  }

  const entryIndex =
    source.indexOf(
      "participantEntries.set",
      loopIndex,
    );

  if (entryIndex < 0) {
    fail(
      "Could not locate participantEntries.set inside participant loop.",
    );
  }

  const settleIndex =
    source.indexOf(
      "settleAsset(false);",
      entryIndex,
    );

  const pathIndex =
    source.indexOf(
      "if (effectiveShowPaths)",
      entryIndex,
    );

  if (
    settleIndex < 0 ||
    (
      pathIndex >= 0 &&
      settleIndex >
        pathIndex
    )
  ) {
    fail(
      "Could not isolate the participant fallback settlement statement.",
    );
  }

  const settleEnd =
    settleIndex +
    "settleAsset(false);".length;

  const replacement =
`void loadPremiumParticipantModel(participant)
        .then((premiumModel) => {
          if (!premiumModel) {
            settleAsset(false);
            return;
          }

          if (disposed) {
            disposeObjectTree(
              premiumModel,
            );
            return;
          }

          const previousModels = [
            ...entry.modelRoot.children,
          ];

          previousModels.forEach(
            (object) => {
              entry.modelRoot.remove(
                object,
              );

              disposeObjectTree(
                object,
              );
            },
          );

          entry.modelRoot.add(
            premiumModel,
          );

          settleAsset(false);
        })
        .catch(() =>
          settleAsset(true),
        );`;

  return (
    source.slice(
      0,
      settleIndex,
    ) +
    replacement +
    source.slice(
      settleEnd,
    )
  );
}

function ensureThreeDropHandlers(
  source,
) {
  if (
    source.includes(
      "const handleSceneAssetDrop",
    )
  ) {
    return source;
  }

  const registrationPattern =
    /renderer\.domElement\.addEventListener\(\s*["']pointerdown["']\s*,\s*handlePointerDown\s*\);/m;

  const registrationMatch =
    source.match(
      registrationPattern,
    );

  if (!registrationMatch) {
    fail(
      "Could not locate 3D pointerdown registration structurally.",
    );
  }

  const dropHandlers =
`const handleSceneAssetDragOver = (
      event: DragEvent,
    ) => {
      const dataTransfer =
        event.dataTransfer;

      if (
        !dataTransfer ||
        !hasRoadSafeSceneAssetDrag(
          dataTransfer,
        )
      ) {
        return;
      }

      event.preventDefault();

      dataTransfer.dropEffect =
        "copy";
    };

    const handleSceneAssetDrop = (
      event: DragEvent,
    ) => {
      const dataTransfer =
        event.dataTransfer;

      if (!dataTransfer) {
        return;
      }

      const payload =
        readRoadSafeSceneAssetDrag(
          dataTransfer,
        );

      if (!payload) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect =
        renderer.domElement
          .getBoundingClientRect();

      pointer.x =
        (
          (
            event.clientX -
            rect.left
          ) /
          rect.width
        ) *
          2 -
        1;

      pointer.y =
        -(
          (
            event.clientY -
            rect.top
          ) /
          rect.height
        ) *
          2 +
        1;

      raycaster.setFromCamera(
        pointer,
        camera,
      );

      const point =
        raycaster.ray.intersectPlane(
          new THREE.Plane(
            new THREE.Vector3(
              0,
              1,
              0,
            ),
            0,
          ),
          new THREE.Vector3(),
        );

      if (!point) {
        return;
      }

      const position: ReconstructionPosition = {
        x: clamp(
          (
            point.x /
              width +
            0.5
          ) *
            100,
          0,
          100,
        ),
        y: clamp(
          (
            point.z /
              height +
            0.5
          ) *
            100,
          0,
          100,
        ),
      };

      if (
        payload.kind ===
        "participant"
      ) {
        onDropParticipantAssetRef.current?.(
          payload.assetId,
          payload.type,
          position,
        );

        return;
      }

      onDropSceneObjectRef.current?.(
        payload.type,
        position,
      );
    };

    renderer.domElement.addEventListener(
      "dragover",
      handleSceneAssetDragOver,
    );

    renderer.domElement.addEventListener(
      "drop",
      handleSceneAssetDrop,
    );

    `;

  source =
    source.replace(
      registrationMatch[0],
      `${dropHandlers}${registrationMatch[0]}`,
    );

  const cleanupPattern =
    /renderer\.domElement\.removeEventListener\(\s*["']pointerdown["']\s*,\s*handlePointerDown\s*\);/m;

  const cleanupMatch =
    source.match(
      cleanupPattern,
    );

  if (!cleanupMatch) {
    fail(
      "Could not locate 3D pointerdown cleanup structurally.",
    );
  }

  const cleanup =
`${cleanupMatch[0]}

      renderer.domElement.removeEventListener(
        "dragover",
        handleSceneAssetDragOver,
      );

      renderer.domElement.removeEventListener(
        "drop",
        handleSceneAssetDrop,
      );`;

  return source.replace(
    cleanupMatch[0],
    cleanup,
  );
}

if (!fs.existsSync(packagePath)) {
  fail(
    "Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1",
  );
}

const pkg = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (pkg.name !== "roadsafe-ar") {
  fail(
    `Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`,
  );
}

for (const required of [
  editorPath,
  viewerPath,
  pointZPath,
]) {
  if (!fs.existsSync(required)) {
    fail(`Required file missing: ${required}`);
  }
}

if (
  !fs.existsSync(
    path.join(root, "model-intake", "extracted"),
  )
) {
  fail(
    "model-intake/extracted is missing. The HQ model intake must be present first.",
  );
}

fs.mkdirSync(backupRoot, { recursive: true });

const originalEditor = fs.readFileSync(editorPath, "utf8");
const originalViewer = fs.readFileSync(viewerPath, "utf8");
const originalPointZ = fs.readFileSync(pointZPath, "utf8");

const interruptedPayloadFiles =
  new Set();

for (const [sourceName, destination] of filesToInstall) {
  const sourcePath =
    path.join(
      scriptDir,
      sourceName,
    );

  const destinationPath =
    path.join(
      root,
      destination,
    );

  if (
    fs.existsSync(sourcePath) &&
    fs.existsSync(destinationPath) &&
    fs.readFileSync(sourcePath, "utf8") ===
      fs.readFileSync(destinationPath, "utf8")
  ) {
    interruptedPayloadFiles.add(
      destination,
    );
  }
}

if (interruptedPayloadFiles.size > 0) {
  console.log(
    `Detected ${interruptedPayloadFiles.size} exact payload file(s) left by the interrupted V3 run. V4 will resume safely.`,
  );
}

const originalFiles = Object.fromEntries(
  filesToInstall.map(([, destination]) => {
    const full =
      path.join(
        root,
        destination,
      );

    return [
      destination,
      interruptedPayloadFiles.has(
        destination,
      )
        ? null
        : fs.existsSync(full)
          ? fs.readFileSync(
              full,
              "utf8",
            )
          : null,
    ];
  }),
);

const runtimeExisted = fs.existsSync(runtimeRoot);

let editor = originalEditor;
let viewer = originalViewer;
let pointZ = originalPointZ;

rollbackOnFail = () => {
  fs.writeFileSync(editorPath, originalEditor, "utf8");
  fs.writeFileSync(viewerPath, originalViewer, "utf8");
  fs.writeFileSync(pointZPath, originalPointZ, "utf8");

  for (const [destination, original] of Object.entries(
    originalFiles,
  )) {
    const full = path.join(root, destination);

    if (original === null) {
      fs.rmSync(full, { force: true });
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, original, "utf8");
    }
  }

  if (!runtimeExisted) {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
};

/* ------------------------------------------------------------------ */
/* Write new source files first. They are included in rollback state.  */
/* ------------------------------------------------------------------ */

for (const [sourceName, destination] of filesToInstall) {
  const sourcePath = path.join(scriptDir, sourceName);
  const destinationPath = path.join(root, destination);

  if (!fs.existsSync(sourcePath)) {
    fail(`Installer payload missing: ${sourceName}`);
  }

  fs.mkdirSync(path.dirname(destinationPath), {
    recursive: true,
  });

  fs.writeFileSync(
    destinationPath,
    fs.readFileSync(sourcePath, "utf8"),
    "utf8",
  );

  console.log(`WROTE ${destination}`);
}

/* ------------------------------------------------------------------ */
/* Pending click placement preserves exact selected assetId.           */
/* V3 patches type imports by module/symbol and scans the interface structurally.     */
/* ------------------------------------------------------------------ */

pointZ = ensureNamedTypeImport(
  pointZ,
  "../types/reconstruction",
  "ReconstructionParticipantAssetId",
);

pointZ = ensurePendingPlacementAssetId(pointZ);

if (
  !pointZ.includes(
    "assetId?: ReconstructionParticipantAssetId;",
  )
) {
  fail(
    "PendingParticipantPlacement structural patch did not persist.",
  );
}

console.log(
  "PATCHED PendingParticipantPlacement.assetId structurally.",
);

/* ------------------------------------------------------------------ */
/* Editor imports.                                                     */
/* ------------------------------------------------------------------ */

if (
  !editor.includes(
    'import SceneCollectionAssetBrowser from "./SceneCollectionAssetBrowser";',
  )
) {
  editor = replaceOnce(
    editor,
    'import SceneSettingsPanel from "./SceneSettingsPanel";',
    `import SceneSettingsPanel from "./SceneSettingsPanel";
import SceneCollectionAssetBrowser from "./SceneCollectionAssetBrowser";`,
    "SceneSettingsPanel import",
  );
}

if (!editor.includes("PARTICIPANT_ASSET_CATALOG")) {
  editor = replaceOnce(
    editor,
    `import {
  getDefaultParticipantAssetId,`,
    `import {
  PARTICIPANT_ASSET_CATALOG,
  getDefaultParticipantAssetId,`,
    "participant asset catalog import",
  );
}

if (!editor.includes("readRoadSafeSceneAssetDrag")) {
  editor = replaceOnce(
    editor,
    'import ReconstructionBottomDock from "./ReconstructionBottomDock";',
    `import ReconstructionBottomDock from "./ReconstructionBottomDock";
import {
  hasRoadSafeSceneAssetDrag,
  readRoadSafeSceneAssetDrag,
} from "../../engine/assets/sceneAssetDragData";`,
    "ReconstructionBottomDock import",
  );
}

if (!editor.includes("DragEvent as ReactDragEvent")) {
  const reactImport =
    'import type { DragEvent as ReactDragEvent } from "react";\n';

  const firstReactImport = editor.indexOf('from "react";');

  if (firstReactImport >= 0) {
    const lineEnd = editor.indexOf("\n", firstReactImport);
    const insertionPoint = lineEnd >= 0 ? lineEnd + 1 : editor.length;
    editor =
      editor.slice(0, insertionPoint) +
      reactImport +
      editor.slice(insertionPoint);
  } else {
    editor = reactImport + editor;
  }
}

/* ------------------------------------------------------------------ */
/* New scene drag-active state.                                        */
/* ------------------------------------------------------------------ */

if (!editor.includes("sceneAssetDragActive")) {
  editor = replaceOnce(
    editor,
    `  const [sceneExpanded, setSceneExpanded] = useState(false);`,
    `  const [sceneExpanded, setSceneExpanded] = useState(false);
  const [sceneAssetDragActive, setSceneAssetDragActive] = useState(false);`,
    "sceneExpanded state",
  );
}

/* ------------------------------------------------------------------ */
/* Replace old add helper with exact-asset armed placement.             */
/* ------------------------------------------------------------------ */

const oldAddStart =
  "  const handleAddParticipant = useCallback(() => {";

if (editor.includes(oldAddStart)) {
  const oldAddIndex = editor.indexOf(oldAddStart);

  const oldAddEndMarker =
    "  const handleDeleteParticipant = useCallback(() => {";

  const oldAddEnd = editor.indexOf(
    oldAddEndMarker,
    oldAddIndex,
  );

  if (oldAddEnd < 0) {
    fail(
      "Could not isolate handleAddParticipant. No files changed.",
    );
  }

  editor =
    editor.slice(0, oldAddIndex) +
`  const handleArmLibraryParticipantPlacement = useCallback(
    (
      assetId: ReconstructionParticipantAssetId,
      type: ReconstructionVehicleType,
    ) => {
      setIsPlaying(false);
      setActiveReconstructionView("2D");
      setActiveWorkspaceTool("Select");

      setPendingParticipantPlacement({
        type,
        index: reconstruction.vehicles.length + 1,
        assetId,
      });

      setParticipantPlacementMessage(
        \`Click the exact starting position for \${PARTICIPANT_ASSET_CATALOG[assetId].shortLabel}, or drag it directly onto the scene.\`,
      );

      setParticipantGpsBusy(false);
      setActiveSceneObjectType(null);
      setTraceToolObjectId(null);
      setRouteDrawingParticipantId(null);
      setMeasurementToolActive(false);
      setMeasurementDraftStart(null);
      setCollisionPlacementActive(false);
      setActiveEvidencePlacementId(null);
    },
    [reconstruction.vehicles.length],
  );

` +
    editor.slice(oldAddEnd);
}

/* Remove obsolete add-dropdown state after the old Participants UI is gone. */
editor = editor.replace(
  /  const \[newParticipantType, setNewParticipantType\] =\s*\n\s*useState<ReconstructionVehicleType>\("Car"\);\s*\n/m,
  "",
);

/* ------------------------------------------------------------------ */
/* Pending click placement: attach assetId.                            */
/* ------------------------------------------------------------------ */

if (
  !editor.includes(
    "pendingParticipantPlacement.assetId ??",
  )
) {
  const firstCreate =
`      const participant = createParticipantAtConfirmedPosition({
        type: pendingParticipantPlacement.type,`;

  if (editor.includes(firstCreate)) {
    editor = editor.replace(
      firstCreate,
`      const participantBase = createParticipantAtConfirmedPosition({
        type: pendingParticipantPlacement.type,`,
    );

    editor = replaceOnce(
      editor,
`      setReconstruction((current) => ({
        ...current,
        lastPhysicsSimulation: undefined,
        vehicles: [...current.vehicles, participant],
      }));`,
`      const participant: ReconstructionVehicle = {
        ...participantBase,
        assetId:
          pendingParticipantPlacement.assetId ??
          getDefaultParticipantAssetId(
            pendingParticipantPlacement.type,
          ),
      };

      setReconstruction((current) => ({
        ...current,
        lastPhysicsSimulation: undefined,
        vehicles: [...current.vehicles, participant],
      }));`,
      "first pending participant append",
    );
  }

  const gpsCreate =
`        const participant = createParticipantAtConfirmedPosition({
          type: pendingParticipantPlacement.type,`;

  if (editor.includes(gpsCreate)) {
    editor = editor.replace(
      gpsCreate,
`        const participantBase = createParticipantAtConfirmedPosition({
          type: pendingParticipantPlacement.type,`,
    );

    editor = replaceOnce(
      editor,
      `        const pointOne = participant.pathPoints[0];`,
      `        const participant: ReconstructionVehicle = {
          ...participantBase,
          assetId:
            pendingParticipantPlacement.assetId ??
            getDefaultParticipantAssetId(
              pendingParticipantPlacement.type,
            ),
        };

        const pointOne = participant.pathPoints[0];`,
      "GPS participant pointOne",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Direct participant/object creation from drag payload.                */
/* Insert after clientToScenePosition is already defined, by using the  */
/* known handleDeleteParticipant anchor which is later in component.    */
/* ------------------------------------------------------------------ */

const libraryHelperAnchor =
  "  const handleDeleteParticipant = useCallback(() => {";

if (!editor.includes("const createLibraryParticipantAt")) {
  if (!editor.includes(libraryHelperAnchor)) {
    fail(
      "Could not locate library helper insertion anchor.",
    );
  }

  editor = editor.replace(
    libraryHelperAnchor,
`  const createLibraryParticipantAt = useCallback(
    (
      assetId: ReconstructionParticipantAssetId,
      type: ReconstructionVehicleType,
      startPosition: ReconstructionPosition,
    ) => {
      let createdParticipantId: string | null = null;
      let createdPointId: string | null = null;

      setIsPlaying(false);

      setReconstruction((current) => {
        const asset =
          PARTICIPANT_ASSET_CATALOG[assetId];

        const participant =
          createParticipantAtConfirmedPosition({
            type,
            index: current.vehicles.length + 1,
            startPosition,
            collisionPosition: current.collisionPoint,
            durationSeconds: current.durationSeconds,
            createId,
            getDefaultSpeed,
            getDefaultRole,
            isHumanParticipant,
            worldDimensions:
              getReconstructionWorldDimensions(current),
          });

        const withAsset: ReconstructionVehicle = {
          ...participant,
          assetId,
          name:
            \`\${asset.shortLabel} \${current.vehicles.length + 1}\`,
        };

        createdParticipantId = withAsset.id;
        createdPointId =
          withAsset.pathPoints[0]?.id ?? null;

        return {
          ...current,
          lastPhysicsSimulation: undefined,
          vehicles: [
            ...current.vehicles,
            withAsset,
          ],
        };
      });

      window.requestAnimationFrame(() => {
        if (!createdParticipantId) return;

        setSelectedParticipantId(createdParticipantId);
        setSelectedPathPointId(createdPointId);
        setSelectedSceneObjectId(null);
        setActiveWorkspaceTool("Select");
      });
    },
    [],
  );

  const createLibrarySceneObjectAt = useCallback(
    (
      type: SceneObjectType,
      position: ReconstructionPosition,
    ) => {
      let objectId: string | null = null;

      setReconstruction((current) => {
        const object = createSceneObject(
          type,
          position,
          current.sceneObjects.length + 1,
        );

        objectId = object.id;

        return {
          ...current,
          sceneObjects: [
            ...current.sceneObjects,
            object,
          ],
        };
      });

      window.requestAnimationFrame(() => {
        if (!objectId) return;

        setSelectedSceneObjectId(objectId);
        setSelectedParticipantId(null);
        setSelectedPathPointId(null);
        setActiveWorkspaceTool("Select");
      });
    },
    [],
  );

  const handleLibrarySceneDragOver = useCallback(
    (
      event: ReactDragEvent<HTMLDivElement>,
    ) => {
      if (
        !event.dataTransfer ||
        !hasRoadSafeSceneAssetDrag(
          event.dataTransfer,
        )
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setSceneAssetDragActive(true);
    },
    [],
  );

  const handleLibrarySceneDrop = useCallback(
    (
      event: ReactDragEvent<HTMLDivElement>,
    ) => {
      if (!event.dataTransfer) return;

      const payload =
        readRoadSafeSceneAssetDrag(
          event.dataTransfer,
        );

      if (!payload) return;

      event.preventDefault();
      event.stopPropagation();

      setSceneAssetDragActive(false);

      const position =
        clientToScenePosition(
          event.clientX,
          event.clientY,
        );

      if (!position) return;

      if (payload.kind === "participant") {
        createLibraryParticipantAt(
          payload.assetId,
          payload.type,
          position,
        );
        return;
      }

      createLibrarySceneObjectAt(
        payload.type,
        position,
      );
    },
    [
      clientToScenePosition,
      createLibraryParticipantAt,
      createLibrarySceneObjectAt,
    ],
  );

${libraryHelperAnchor}`,
  );
}

/* ------------------------------------------------------------------ */
/* Replace 2D Participants contents with Blender Scene Collection.      */
/* ------------------------------------------------------------------ */

const participantsStartToken =
  '                    {workspace2DPropertiesTab === "participants" && (';

const participantsEndToken =
  '                    {workspace2DPropertiesTab === "selection" && (';

const participantsStart = editor.indexOf(
  participantsStartToken,
);

const participantsEnd = editor.indexOf(
  participantsEndToken,
  participantsStart,
);

if (participantsStart < 0 || participantsEnd < 0) {
  fail(
    "Could not isolate 2D Participants panel. No files changed.",
  );
}

editor =
  editor.slice(0, participantsStart) +
`                    {workspace2DPropertiesTab === "participants" && (
                      <SceneCollectionAssetBrowser
                        reconstruction={reconstruction}
                        selectedParticipantId={selectedParticipantId}
                        selectedSceneObjectId={selectedSceneObjectId}
                        onSelectParticipant={handleSelectParticipant}
                        onSelectSceneObject={handleSelectSceneObject}
                        onArmParticipantPlacement={
                          handleArmLibraryParticipantPlacement
                        }
                      />
                    )}

` +
  editor.slice(participantsEnd);

/* ------------------------------------------------------------------ */
/* 3D Participant tab gets Scene Collection above selected details.     */
/* ------------------------------------------------------------------ */

const threeDParticipantOpen =
`                    {workspacePropertiesTab === "participant" && (
                      <>`;

if (
  !editor.includes(
    "roadsafe-3d-scene-collection-browser",
  )
) {
  editor = replaceOnce(
    editor,
    threeDParticipantOpen,
`${threeDParticipantOpen}
                        <div className="roadsafe-3d-scene-collection-browser">
                          <SceneCollectionAssetBrowser
                            reconstruction={reconstruction}
                            selectedParticipantId={selectedParticipantId}
                            selectedSceneObjectId={selectedSceneObjectId}
                            onSelectParticipant={handleSelectParticipant}
                            onSelectSceneObject={handleSelectSceneObject}
                            onArmParticipantPlacement={
                              handleArmLibraryParticipantPlacement
                            }
                          />
                        </div>`,
    "3D Participant property fragment",
  );
}

/* ------------------------------------------------------------------ */
/* 2D viewport accepts drag/drop.                                      */
/* ------------------------------------------------------------------ */

if (!editor.includes("onDrop={handleLibrarySceneDrop}")) {
  editor = replaceOnce(
    editor,
`              onPointerCancel={handleSceneGesturePointerEnd}
              className={\`reconstruction-workspace__2d-viewport`,
`              onPointerCancel={handleSceneGesturePointerEnd}
              onDragOver={handleLibrarySceneDragOver}
              onDragEnter={handleLibrarySceneDragOver}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                  setSceneAssetDragActive(false);
                }
              }}
              onDrop={handleLibrarySceneDrop}
              className={\`reconstruction-workspace__2d-viewport`,
    "2D viewport pointer event block",
  );

  const oldViewportClassEnding =
    '              } ${sceneCursorClass}`}';

  const newViewportClassEnding =
    [
      '              } ${sceneCursorClass} ${',
      '                sceneAssetDragActive',
      '                  ? "is-library-drop-target"',
      '                  : ""',
      '              }`}',
    ].join("\n");

  editor = replaceOnce(
    editor,
    oldViewportClassEnding,
    newViewportClassEnding,
    "2D viewport className ending",
  );

  if (
    !editor.includes(
      "sceneAssetDragActive",
    ) ||
    !editor.includes(
      "is-library-drop-target",
    )
  ) {
    fail(
      "2D viewport drag/drop class patch did not persist.",
    );
  }

  console.log(
    "PATCHED 2D viewport drag/drop class without installer interpolation.",
  );
}

/* ------------------------------------------------------------------ */
/* Pass drop callbacks to 3D viewer.                                   */
/* ------------------------------------------------------------------ */

if (
  !editor.includes(
    "onDropParticipantAsset={createLibraryParticipantAt}",
  )
) {
  editor = replaceOnce(
    editor,
`                  workspaceLayers={workspaceLayers}
                  workspaceTool={activeWorkspaceTool}
                />`,
`                  workspaceLayers={workspaceLayers}
                  workspaceTool={activeWorkspaceTool}
                  onDropParticipantAsset={createLibraryParticipantAt}
                  onDropSceneObject={createLibrarySceneObjectAt}
                />`,
    "Reconstruction3DViewer workspace props",
  );
}

/* ------------------------------------------------------------------ */
/* 3D viewer — STRUCTURAL patch phase.                                 */
/*                                                                      */
/* V5 deliberately does not use exact source-format anchors here.       */
/* It operates on declarations / brace boundaries / semantic markers.   */
/* ------------------------------------------------------------------ */

{
  const interfaceIndex =
    viewer.indexOf(
      "interface Reconstruction3DViewerProps",
    );

  if (interfaceIndex < 0) {
    fail(
      "Could not locate Reconstruction3DViewerProps declaration.",
    );
  }

  const importRegion =
    viewer.slice(
      0,
      interfaceIndex,
    );

  const missingViewerTypes =
    [
      "ReconstructionParticipantAssetId",
      "ReconstructionVehicleType",
      "SceneObjectType",
    ].filter(
      (symbol) =>
        !new RegExp(
          `\\b${escapeRegExp(
            symbol,
          )}\\b`,
        ).test(
          importRegion,
        ),
    );

  if (
    missingViewerTypes.length >
    0
  ) {
    viewer =
      ensureImportBeforeInterface(
        viewer,
        "Reconstruction3DViewerProps",
        `import type {
  ${missingViewerTypes.join(",\n  ")},
} from "../../types/reconstruction";`,
        missingViewerTypes[0],
      );
  }

  viewer =
    ensureImportBeforeInterface(
      viewer,
      "Reconstruction3DViewerProps",
      `import {
  loadPremiumParticipantModel,
} from "../../services/premiumParticipantAssetService";`,
      "loadPremiumParticipantModel",
    );

  viewer =
    ensureImportBeforeInterface(
      viewer,
      "Reconstruction3DViewerProps",
      `import {
  hasRoadSafeSceneAssetDrag,
  readRoadSafeSceneAssetDrag,
} from "../../engine/assets/sceneAssetDragData";`,
      "readRoadSafeSceneAssetDrag",
    );

  viewer =
    ensureInterfaceFields(
      viewer,
      "Reconstruction3DViewerProps",
      "onDropParticipantAsset?:",
`  onDropParticipantAsset?: (
    assetId: ReconstructionParticipantAssetId,
    type: ReconstructionVehicleType,
    position: ReconstructionPosition,
  ) => void;

  onDropSceneObject?: (
    type: SceneObjectType,
    position: ReconstructionPosition,
  ) => void;`,
    );

  viewer =
    ensureViewerDestructuredProps(
      viewer,
      [
        "onDropParticipantAsset",
        "onDropSceneObject",
      ],
    );

  viewer =
    ensureViewerDropRefs(
      viewer,
    );

  viewer =
    ensurePremiumParticipantLoad(
      viewer,
    );

  viewer =
    ensureThreeDropHandlers(
      viewer,
    );

  console.log(
    "PATCHED Reconstruction3DViewer structurally: props, callbacks, premium models and drag/drop.",
  );
}

/* ------------------------------------------------------------------ */
/* Structural guards.                                                  */
/* ------------------------------------------------------------------ */

for (const token of [
  "<SceneCollectionAssetBrowser",
  "createLibraryParticipantAt",
  "handleLibrarySceneDrop",
  "handleArmLibraryParticipantPlacement",
  "onDropParticipantAsset={createLibraryParticipantAt}",
]) {
  if (!editor.includes(token)) {
    fail(`Editor guard failed: ${token}`);
  }
}

for (const token of [
  "loadPremiumParticipantModel(participant)",
  "const handleSceneAssetDrop",
  "onDropParticipantAssetRef",
  "readRoadSafeSceneAssetDrag",
]) {
  if (!viewer.includes(token)) {
    fail(`3D viewer guard failed: ${token}`);
  }
}

if (
  !pointZ.includes(
    "assetId?: ReconstructionParticipantAssetId;",
  )
) {
  fail(
    "Pending participant placement assetId guard failed.",
  );
}

/* ------------------------------------------------------------------ */
/* Parse COMPLETE transformed source before writing modifications.      */
/* ------------------------------------------------------------------ */

try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");

  const sources = [
    ["AccidentReconstructionEditor.tsx", editor, ts.ScriptKind.TSX],
    ["Reconstruction3DViewer.tsx", viewer, ts.ScriptKind.TSX],
    ["reconstructionPointZIntegration.ts", pointZ, ts.ScriptKind.TS],
  ];

  for (const [name, content, kind] of sources) {
    const sf = ts.createSourceFile(
      name,
      content,
      ts.ScriptTarget.Latest,
      true,
      kind,
    );

    const diagnostics = sf.parseDiagnostics ?? [];

    if (diagnostics.length > 0) {
      const details = diagnostics
        .slice(0, 20)
        .map((diagnostic) => {
          const message =
            ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n",
            );

          if (typeof diagnostic.start !== "number") {
            return message;
          }

          const p = sf.getLineAndCharacterOfPosition(
            diagnostic.start,
          );

          return (
            `${name}:${p.line + 1}:${p.character + 1} ${message}`
          );
        })
        .join("\n");

      fail(`TSX/TS parse audit failed:\n${details}`);
    }
  }

  console.log(
    "Scene Collection HQ drag/drop parse audit: PASS",
  );
} catch (error) {
  if (
    String(error).includes(
      "Cannot find module 'typescript'",
    )
  ) {
    console.warn(
      "TypeScript parser unavailable; structural guards passed.",
    );
  } else {
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Backup state before modifying existing repo files.                  */
/* ------------------------------------------------------------------ */

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      editorPath: path.relative(root, editorPath),
      viewerPath: path.relative(root, viewerPath),
      pointZPath: path.relative(root, pointZPath),
      originalEditor,
      originalViewer,
      originalPointZ,
      originalFiles,
      runtimeExisted,
    },
    null,
    2,
  ),
  "utf8",
);

function restore() {
  fs.writeFileSync(editorPath, originalEditor, "utf8");
  fs.writeFileSync(viewerPath, originalViewer, "utf8");
  fs.writeFileSync(pointZPath, originalPointZ, "utf8");

  for (const [destination, original] of Object.entries(
    originalFiles,
  )) {
    const full = path.join(root, destination);

    if (original === null) {
      fs.rmSync(full, { force: true });
    } else {
      fs.writeFileSync(full, original, "utf8");
    }
  }

  if (!runtimeExisted) {
    fs.rmSync(runtimeRoot, {
      recursive: true,
      force: true,
    });
  }

  console.log(
    "RESTORED pre-Scene-Collection files.",
  );
}

fs.writeFileSync(editorPath, editor, "utf8");
fs.writeFileSync(viewerPath, viewer, "utf8");
fs.writeFileSync(pointZPath, pointZ, "utf8");

/* ------------------------------------------------------------------ */
/* Prepare the real model-intake files for browser/runtime loading.    */
/* ------------------------------------------------------------------ */

console.log("");
console.log(
  "Preparing HQ participant runtime models from model-intake...",
);

const prepareResult = spawnSync(
  process.execPath,
  [
    path.join(
      root,
      "scripts/prepare-premium-participant-assets.mjs",
    ),
  ],
  {
    cwd: root,
    encoding: "utf8",
    shell: false,
  },
);

if (prepareResult.stdout) {
  process.stdout.write(prepareResult.stdout);
}

if (prepareResult.stderr) {
  process.stderr.write(prepareResult.stderr);
}

if (prepareResult.status !== 0) {
  console.error("");
  console.error(
    "Premium model preparation failed. Restoring changes...",
  );

  restore();
  fs.rmSync(statePath, { force: true });

  process.exit(prepareResult.status ?? 1);
}

/* ------------------------------------------------------------------ */
/* Full build.                                                        */
/* ------------------------------------------------------------------ */

console.log("");
console.log("Running full project build...");

const command =
  process.platform === "win32"
    ? {
        executable:
          process.env.ComSpec ||
          "C:\\Windows\\System32\\cmd.exe",
        args: ["/d", "/s", "/c", "npm run build"],
      }
    : {
        executable: "npm",
        args: ["run", "build"],
      };

const build = spawnSync(
  command.executable,
  command.args,
  {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: false,
    env: process.env,
  },
);

const buildOutput = [
  "RoadSafe Blender Scene Collection HQ Drag/Drop V5",
  "=================================================",
  `platform: ${process.platform}`,
  `status: ${String(build.status)}`,
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
  "",
].join("\n");

fs.writeFileSync(
  buildLogPath,
  buildOutput,
  "utf8",
);

if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);

if (build.status === null || build.status !== 0) {
  console.error("");
  console.error(
    `Build failed. Full output kept at: ${path.relative(
      root,
      buildLogPath,
    )}`,
  );

  console.error("Restoring changes...");

  restore();
  fs.rmSync(statePath, { force: true });

  process.exit(build.status ?? 1);
}

rollbackOnFail = null;

console.log("");
console.log(
  "RoadSafe Blender Scene Collection HQ Drag/Drop V5 installed successfully.",
);

console.log("");
console.log("Participants right panel:");
console.log("- Blender-style Scene Collection hierarchy;");
console.log("- placed Participants + Scene Objects;");
console.log("- HQ 3D model preview;");
console.log("- draggable participant/object Asset Library.");

console.log("");
console.log("Placement:");
console.log("- drag directly onto 2D;");
console.log("- drag directly onto 3D;");
console.log("- click Place keeps exact selected assetId;");
console.log("- existing click/GPS placement remains available.");

console.log("");
console.log("3D rendering:");
console.log("- premium model-intake model loads first when available;");
console.log("- procedural RoadSafe model remains fallback.");

console.log("");
console.log("Start:");
console.log("  npm run dev");

console.log("");
console.log("Rollback:");
console.log(
  "  node revoke-scene-collection-hq-dragdrop-v5.mjs",
);
