import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));

const MAP_FILE = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "AccidentMap.tsx",
);

const LAYER_FILE = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "junctionMapLayer.ts",
);

const CARD_FILE = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "JunctionQuickCard.tsx",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

for (const file of [MAP_FILE, LAYER_FILE]) {
  if (!fs.existsSync(file)) {
    fail(
      `Required file missing: ${path.relative(ROOT, file)}`,
    );
  }
}

const layerPayload = path.join(
  HERE,
  "payload",
  "junctionMapLayer.ts",
);

const cardPayload = path.join(
  HERE,
  "payload",
  "JunctionQuickCard.tsx",
);

if (
  !fs.existsSync(layerPayload) ||
  !fs.existsSync(cardPayload)
) {
  fail("Installer payload is incomplete.");
}

let mapSource = fs.readFileSync(
  MAP_FILE,
  "utf8",
);

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `custom-junction-quick-card-v1-${stamp}`,
);

fs.mkdirSync(
  backupDir,
  { recursive: true },
);

for (const file of [
  MAP_FILE,
  LAYER_FILE,
  CARD_FILE,
]) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(
      file,
      path.join(
        backupDir,
        path.basename(file),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Validate current AccidentMap structure before writing.
// -----------------------------------------------------------------------------

const modalImportPattern =
  /import\s+JunctionAnalysisModal\s+from\s+["']\.\/JunctionAnalysisModal["'];?/;

if (
  !modalImportPattern.test(
    mapSource,
  )
) {
  fail(
    "Could not locate JunctionAnalysisModal import. No project file changed.",
  );
}

const selectedJunctionStatePattern =
  /const\s*\[\s*selectedJunctionId\s*,\s*setSelectedJunctionId\s*,?\s*\]\s*=\s*useState\s*<\s*string\s*\|\s*null\s*>\s*\(\s*null\s*,?\s*\)\s*;/m;

if (
  !selectedJunctionStatePattern.test(
    mapSource,
  )
) {
  fail(
    "Could not locate selectedJunctionId state. No project file changed.",
  );
}

const addMarkersSignal =
  /addJunctionMarkers\([\s\S]*?handleOpenJunctionAnalysis[\s\S]*?\)/m;

if (
  !addMarkersSignal.test(
    mapSource,
  ) &&
  !mapSource.includes(
    "handleOpenJunctionQuickCard",
  )
) {
  fail(
    "Could not locate junction-marker callback wiring. No project file changed.",
  );
}

const modalRenderSignal =
  /\{selectedJunctionId\s*&&\s*\(/m;

if (
  !modalRenderSignal.test(
    mapSource,
  )
) {
  fail(
    "Could not locate the full junction analysis render block. No project file changed.",
  );
}

// -----------------------------------------------------------------------------
// Import our card.
// -----------------------------------------------------------------------------

const quickCardImport =
  'import JunctionQuickCard from "./JunctionQuickCard";';

if (
  !mapSource.includes(
    quickCardImport,
  )
) {
  mapSource = mapSource.replace(
    modalImportPattern,
    (match) =>
      `${match}\n${quickCardImport}`,
  );
}

// -----------------------------------------------------------------------------
// Add separate quick-card state + handlers.
// -----------------------------------------------------------------------------

if (
  !mapSource.includes(
    "quickJunctionId",
  )
) {
  mapSource = mapSource.replace(
    selectedJunctionStatePattern,
    (match) =>
      `${match}

  const [
    quickJunctionId,
    setQuickJunctionId,
  ] = useState<string | null>(
    null,
  );`,
  );
}

if (
  !mapSource.includes(
    "handleOpenJunctionQuickCard",
  )
) {
  const closeHandlerPattern =
    /const\s+handleCloseJunctionAnalysis\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[\]\s*\);/m;

  const closeMatch =
    mapSource.match(
      closeHandlerPattern,
    );

  if (!closeMatch) {
    fail(
      "Could not locate handleCloseJunctionAnalysis handler. No project file changed.",
    );
  }

  const newHandlers = `${closeMatch[0]}

  const handleOpenJunctionQuickCard =
    useCallback(
      (junctionId: string) => {
        setQuickJunctionId(
          junctionId,
        );
      },
      [],
    );

  const handleCloseJunctionQuickCard =
    useCallback(() => {
      setQuickJunctionId(
        null,
      );
    }, []);

  const handleQuickCardFullAnalysis =
    useCallback(
      (junctionId: string) => {
        setQuickJunctionId(
          null,
        );

        setSelectedJunctionId(
          junctionId,
        );
      },
      [],
    );`;

  mapSource =
    mapSource.replace(
      closeMatch[0],
      newHandlers,
    );
}

// -----------------------------------------------------------------------------
// All marker creation now opens QUICK CARD, not the full modal.
// -----------------------------------------------------------------------------

mapSource =
  mapSource.replace(
    /\bhandleOpenJunctionAnalysis\b/g,
    "handleOpenJunctionQuickCard",
  );

// Restore the actual full-analysis handler name if the replacement touched its
// declaration. We no longer need the original open handler at all, so remove
// any now-renamed duplicate handler that sets selectedJunctionId directly.
const duplicateQuickPattern =
  /const\s+handleOpenJunctionQuickCard\s*=\s*useCallback\(\s*\(junctionId:\s*string\)\s*=>\s*\{\s*setSelectedJunctionId\([\s\S]*?\},\s*\[\]\s*,?\s*\);/m;

mapSource =
  mapSource.replace(
    duplicateQuickPattern,
    "",
  );

// Ensure our intended quick handler exists after cleanup.
if (
  !mapSource.includes(
    "setQuickJunctionId(\n          junctionId,",
  )
) {
  fail(
    "Quick-card handler repair failed in memory. No project file changed.",
  );
}

// -----------------------------------------------------------------------------
// Render our custom card before the full modal.
// -----------------------------------------------------------------------------

if (
  !mapSource.includes(
    "<JunctionQuickCard",
  )
) {
  const renderAnchorMatch =
    mapSource.match(
      modalRenderSignal,
    );

  if (!renderAnchorMatch) {
    fail(
      "Could not locate full-analysis render anchor. No project file changed.",
    );
  }

  const cardRender = `{quickJunctionId && (
        <JunctionQuickCard
          junctionId={quickJunctionId}
          onClose={
            handleCloseJunctionQuickCard
          }
          onViewFullAnalysis={() =>
            handleQuickCardFullAnalysis(
              quickJunctionId,
            )
          }
        />
      )}

      `;

  mapSource =
    mapSource.replace(
      renderAnchorMatch[0],
      cardRender +
        renderAnchorMatch[0],
    );
}

// -----------------------------------------------------------------------------
// Write files.
// -----------------------------------------------------------------------------

fs.copyFileSync(
  layerPayload,
  LAYER_FILE,
);

fs.copyFileSync(
  cardPayload,
  CARD_FILE,
);

fs.writeFileSync(
  MAP_FILE,
  mapSource,
  "utf8",
);

console.log(
  "\n[RoadSafe] Custom Junction Quick Card V1 installed.",
);
console.log(
  "[RoadSafe] MapLibre junction popup -> REMOVED.",
);
console.log(
  "[RoadSafe] Marker click -> custom React quick card.",
);
console.log(
  "[RoadSafe] View Full Analysis -> existing full modal.",
);
console.log(
  "[RoadSafe] Popup triangle / popup X / white popup shell -> GONE.",
);
console.log(
  `[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`,
);
console.log("\nRun:");
console.log("  npm run build");
