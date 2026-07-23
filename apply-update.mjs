import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const payloadRoot = path.join(scriptDirectory, ".roadsafe-update-payload", "src");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".roadsafe-backups", timestamp);

function fail(message) {
  console.error(`\n[RoadSafe real-scene update] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(`Required file was not found: ${path.relative(root, file)}`);
  }
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function backup(file) {
  if (!fs.existsSync(file)) return;
  const destination = path.join(backupRoot, path.relative(root, file));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

function copyPayload(relativePath) {
  const source = path.join(payloadRoot, relativePath);
  const destination = path.join(root, "src", relativePath);
  if (!fs.existsSync(source)) fail(`Update payload is missing ${relativePath}.`);
  backup(destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  const index = source.indexOf(search);
  if (index < 0) fail(`Could not find the ${label} insertion point.`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegexOnce(source, regex, replacement, label) {
  if (typeof replacement === "string" && source.includes(replacement)) {
    return source;
  }
  regex.lastIndex = 0;
  if (!regex.test(source)) fail(`Could not find the ${label} section.`);
  regex.lastIndex = 0;
  return source.replace(regex, replacement);
}

if (!fs.existsSync(path.join(root, "package.json"))) {
  fail("Run this updater from the A-R-V1 project root.");
}

const reconstructionTypesPath = path.join(root, "src/types/reconstruction.ts");
const wizardPath = path.join(root, "src/components/cases/NewCaseRoadWizard.tsx");
const roadEnvironmentPath = path.join(
  root,
  "src/components/reconstruction/RoadSceneEnvironment.tsx",
);
const viewerPath = path.join(
  root,
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
);

for (const target of [
  reconstructionTypesPath,
  wizardPath,
  roadEnvironmentPath,
  viewerPath,
]) {
  backup(target);
}

// ---------------------------------------------------------------------------
// 1. Extend the reconstruction scene type without replacing local work.
// ---------------------------------------------------------------------------
let reconstructionTypes = read(reconstructionTypesPath);
if (!reconstructionTypes.includes('from "./realSceneGeometry"')) {
  reconstructionTypes = `import type { RealSceneGeometry } from "./realSceneGeometry";\n\n${reconstructionTypes}`;
}
if (!reconstructionTypes.includes("realSceneGeometry?: RealSceneGeometry;")) {
  reconstructionTypes = replaceOnce(
    reconstructionTypes,
    "export interface RoadSceneSettings {",
    `export interface RoadSceneSettings {\n  /** Officer-selected, metre-based real-world geometry shared by 2D and 3D. */\n  realSceneGeometry?: RealSceneGeometry;`,
    "RoadSceneSettings real geometry field",
  );
}

// ---------------------------------------------------------------------------
// 2. Add mandatory area selection and extraction to the new-case wizard.
// ---------------------------------------------------------------------------
let wizard = read(wizardPath);

if (!wizard.includes("  useRef,")) {
  wizard = replaceOnce(
    wizard,
    "  useMemo,\n  useState,",
    "  useMemo,\n  useRef,\n  useState,",
    "React useRef import",
  );
}

if (!wizard.includes("realSceneExtractionService")) {
  wizard = replaceOnce(
    wizard,
    'import { RoadLayoutDetectionService } from "../../services/roadLayoutDetectionService";',
    `import { RoadLayoutDetectionService } from "../../services/roadLayoutDetectionService";\nimport { RealSceneExtractionService } from "../../services/realSceneExtractionService";`,
    "real-scene extraction service import",
  );
}

if (!wizard.includes('from "../../types/realSceneGeometry"')) {
  wizard = replaceOnce(
    wizard,
    'import type { AccidentCaseFormValues } from "../../types/accidentCase";',
    `import type { AccidentCaseFormValues } from "../../types/accidentCase";\nimport type {\n  RealSceneAreaSelection,\n  RealSceneGeometry,\n} from "../../types/realSceneGeometry";`,
    "real-scene wizard type imports",
  );
}

if (!wizard.includes("type RoadLocationMapHandle")) {
  wizard = replaceOnce(
    wizard,
    'import RoadLocationMap from "./RoadLocationMap";',
    `import RoadLocationMap, {\n  type RoadLocationMapHandle,\n} from "./RoadLocationMap";`,
    "RoadLocationMap handle import",
  );
}

if (!wizard.includes("const locationMapRef = useRef<RoadLocationMapHandle")) {
  wizard = replaceOnce(
    wizard,
    '  const [locationMessage, setLocationMessage] = useState("");',
    `  const [locationMessage, setLocationMessage] = useState("");\n  const locationMapRef = useRef<RoadLocationMapHandle | null>(null);\n  const previousSceneAnchorRef = useRef<string | null>(null);\n  const [sceneArea, setSceneArea] =\n    useState<RealSceneAreaSelection | null>(null);\n  const [realSceneGeometry, setRealSceneGeometry] =\n    useState<RealSceneGeometry | null>(null);\n  const [extractingScene, setExtractingScene] = useState(false);\n  const [sceneGeometryConfirmed, setSceneGeometryConfirmed] = useState(false);\n  const [sceneExtractionMessage, setSceneExtractionMessage] = useState("");`,
    "real-scene wizard state",
  );
}

if (!wizard.includes("A changed accident anchor invalidates the selected scene area")) {
  wizard = replaceOnce(
    wizard,
    "  const locationDisplay = useMemo(() => {",
    `  useEffect(() => {\n    const identity = selectedCoordinate\n      ? \`\${selectedCoordinate.latitude.toFixed(7)}:\${selectedCoordinate.longitude.toFixed(7)}\`\n      : null;\n\n    if (\n      previousSceneAnchorRef.current &&\n      identity &&\n      previousSceneAnchorRef.current !== identity\n    ) {\n      // A changed accident anchor invalidates the selected scene area.\n      setSceneArea(null);\n      setRealSceneGeometry(null);\n      setSceneGeometryConfirmed(false);\n      setSelectedEnvironment(null);\n      setDetectionResult(null);\n      setSceneSettings(null);\n      setSceneExtractionMessage(\n        "The accident anchor changed. Select and extract the scene area again.",\n      );\n    }\n\n    previousSceneAnchorRef.current = identity;\n  }, [selectedCoordinate]);\n\n  const locationDisplay = useMemo(() => {`,
    "scene-anchor invalidation effect",
  );
}

if (!wizard.includes("const extractSelectedScene = async () =>")) {
  wizard = replaceOnce(
    wizard,
    "  const detectRoadLayout = async (",
    `  const extractSelectedScene = async () => {\n    if (!sceneArea) {\n      setSceneExtractionMessage(\n        "Select the accident-scene area on the map first.",\n      );\n      return;\n    }\n\n    setExtractingScene(true);\n    setSceneExtractionMessage(\n      "Capturing the selected map area and extracting its real geometry…",\n    );\n\n    try {\n      const snapshot =\n        await locationMapRef.current?.captureSelectedAreaSnapshot();\n      const result = await RealSceneExtractionService.extract(\n        sceneArea,\n        snapshot ?? undefined,\n      );\n      setRealSceneGeometry(result.geometry);\n      setSceneGeometryConfirmed(false);\n      setSelectedEnvironment(null);\n      setDetectionResult(null);\n      setSceneSettings(null);\n      setSceneExtractionMessage(\n        \`Scene ready: \${result.geometry.roads.length} road section(s), \${result.geometry.buildings.length} building footprint(s), \${result.geometry.sceneWidthMetres.toFixed(1)} × \${result.geometry.sceneHeightMetres.toFixed(1)} m.\`,\n      );\n    } catch (error) {\n      setRealSceneGeometry(null);\n      setSceneGeometryConfirmed(false);\n      setSceneExtractionMessage(\n        error instanceof Error\n          ? error.message\n          : "The selected scene could not be extracted.",\n      );\n    } finally {\n      setExtractingScene(false);\n    }\n  };\n\n  const detectRoadLayout = async (`,
    "selected-area extraction function",
  );
}

if (!wizard.includes("const detectionCoordinate = sceneArea?.centre ?? selectedCoordinate;")) {
  wizard = replaceOnce(
    wizard,
    `    setDetectingRoad(true);\n    setRoadError("");`,
    `    const detectionCoordinate = sceneArea?.centre ?? selectedCoordinate;\n\n    setDetectingRoad(true);\n    setRoadError("");`,
    "selected-area detection coordinate",
  );
  wizard = replaceOnce(
    wizard,
    `        selectedCoordinate,\n        80,`,
    `        detectionCoordinate,\n        80,`,
    "road detection area centre",
  );
}

wizard = replaceOnce(
  wizard,
  `      setSceneSettings({\n        ...result.detection.suggestedSceneSettings,\n        sceneEnvironment: environment,\n        groundSurface: "Unclassified Ground",\n      });`,
  `      setSceneSettings({\n        ...result.detection.suggestedSceneSettings,\n        sceneEnvironment: environment,\n        groundSurface: "Unclassified Ground",\n        sceneWidthMetres:\n          realSceneGeometry?.sceneWidthMetres ??\n          result.detection.suggestedSceneSettings.sceneWidthMetres,\n        sceneHeightMetres:\n          realSceneGeometry?.sceneHeightMetres ??\n          result.detection.suggestedSceneSettings.sceneHeightMetres,\n        realSceneGeometry: realSceneGeometry ?? undefined,\n      });`,
  "detected scene geometry preservation",
);

wizard = replaceRegexOnce(
  wizard,
  /  const selectEnvironment = \(sceneEnvironment: SceneEnvironmentType\) => \{[\s\S]*?\n  \};\n\n  const createCaseAndScene/,
  `  const selectEnvironment = (sceneEnvironment: SceneEnvironmentType) => {\n    setSelectedEnvironment(sceneEnvironment);\n    setDetectionResult(null);\n    setRoadError("");\n\n    const sharedRealScene = realSceneGeometry\n      ? {\n          sceneWidthMetres: realSceneGeometry.sceneWidthMetres,\n          sceneHeightMetres: realSceneGeometry.sceneHeightMetres,\n          realSceneGeometry,\n        }\n      : {};\n\n    if (sceneEnvironment === "Open Ground" || sceneEnvironment === "Custom Site") {\n      setSceneSettings({\n        ...createDefaultGroundSceneSettings(sceneEnvironment),\n        ...sharedRealScene,\n      });\n      return;\n    }\n\n    setSceneSettings({\n      ...createDefaultRoadSceneSettings(),\n      ...sharedRealScene,\n      sceneEnvironment,\n      groundSurface: "Unclassified Ground",\n    });\n    void detectRoadLayout(false, sceneEnvironment);\n  };\n\n  const createCaseAndScene`,
  "real-scene environment selection",
);

wizard = replaceOnce(
  wizard,
  "    if (!selectedCoordinate || !sceneSettings) return;",
  "    if (!selectedCoordinate || !sceneSettings || !realSceneGeometry || !sceneGeometryConfirmed) return;",
  "case creation real-scene guard",
);

wizard = replaceOnce(
  wizard,
  '            description="Stand near the collision area, allow precise location, then adjust the red map pin when necessary."',
  '            description="Use GPS only to centre the map. The officer must then draw the exact accident-scene area that will be reconstructed."',
  "location-step description",
);

wizard = replaceRegexOnce(
  wizard,
  /              <RoadLocationMap\n                coordinate=\{selectedCoordinate\}[\s\S]*?              \/>/,
  `              <RoadLocationMap\n                ref={locationMapRef}\n                coordinate={selectedCoordinate}\n                currentCoordinate={geolocation.current}\n                editable\n                areaSelection={sceneArea}\n                realSceneGeometry={realSceneGeometry}\n                onAreaSelectionChange={(selection) => {\n                  setSceneArea(selection);\n                  setRealSceneGeometry(null);\n                  setSceneGeometryConfirmed(false);\n                  setSelectedEnvironment(null);\n                  setDetectionResult(null);\n                  setSceneSettings(null);\n                  setSceneExtractionMessage(\n                    selection\n                      ? "Scene boundary selected. Extract it to create the shared 2D/3D geometry."\n                      : "Select the accident-scene area on the map.",\n                  );\n                }}\n                onCoordinateChange={(coordinate) => {\n                  setSelectedCoordinate(coordinate);\n                  setLocationMessage(\n                    "The accident pin was adjusted manually on the map.",\n                  );\n                }}\n              />`,
  "area-aware location map",
);

const oldSelectedPositionCard = `              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">\n                <p className="font-black text-blue-950">Selected accident position</p>\n                <p className="mt-1 break-all font-mono text-sm text-blue-800">\n                  {locationDisplay}\n                </p>\n                <p className="mt-2 text-xs leading-5 text-blue-700">\n                  The red pin should represent the centre of the accident scene or the junction being reconstructed—not merely where the officer parked.\n                </p>\n              </div>`;

const newSelectedPositionCard = `              <div className="mt-4 grid gap-4 lg:grid-cols-2">\n                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">\n                  <p className="font-black text-blue-950">Accident scene anchor</p>\n                  <p className="mt-1 break-all font-mono text-sm text-blue-800">\n                    {locationDisplay}\n                  </p>\n                  <p className="mt-2 text-xs leading-5 text-blue-700">\n                    The red pin is a reference point. The blue selected boundary—not the pin—defines the reconstruction scene.\n                  </p>\n                </div>\n\n                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">\n                  <div className="flex flex-wrap items-start justify-between gap-3">\n                    <div>\n                      <p className="font-black text-sky-950">Selected-area scene engine</p>\n                      <p className="mt-1 text-xs leading-5 text-sky-800">\n                        Capture this exact area and preserve its real road curves, paths and mapped structures.\n                      </p>\n                    </div>\n                    {realSceneGeometry && (\n                      <span\n                        className={sceneGeometryConfirmed\n                          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800"\n                          : "rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800"}\n                      >\n                        {sceneGeometryConfirmed ? "Confirmed" : "Review"}\n                      </span>\n                    )}\n                  </div>\n\n                  <button\n                    type="button"\n                    disabled={!sceneArea || extractingScene}\n                    onClick={() => void extractSelectedScene()}\n                    className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-45"\n                  >\n                    {extractingScene\n                      ? "Extracting real scene geometry…"\n                      : realSceneGeometry\n                        ? "Re-extract Selected Scene"\n                        : "Capture and Extract Selected Scene"}\n                  </button>\n\n                  {realSceneGeometry && (\n                    <button\n                      type="button"\n                      onClick={() => {\n                        setSceneGeometryConfirmed(true);\n                        setSceneExtractionMessage(\n                          "The officer confirmed the extracted overlay for scene creation.",\n                        );\n                      }}\n                      className={sceneGeometryConfirmed\n                        ? "mt-2 w-full rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-800 transition"\n                        : "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"}\n                    >\n                      {sceneGeometryConfirmed\n                        ? "Extracted Geometry Confirmed"\n                        : "Confirm Extracted Geometry"}\n                    </button>\n                  )}\n\n                  <p className="mt-3 text-xs font-semibold leading-5 text-sky-800">\n                    {sceneExtractionMessage ||\n                      "Draw a blue scene boundary on the map before continuing."}\n                  </p>\n\n                  {realSceneGeometry && (\n                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">\n                      <div className="rounded-lg bg-white/75 p-2">\n                        <dt className="font-bold text-slate-500">Scene size</dt>\n                        <dd className="mt-1 font-black">\n                          {realSceneGeometry.sceneWidthMetres.toFixed(1)} × {realSceneGeometry.sceneHeightMetres.toFixed(1)} m\n                        </dd>\n                      </div>\n                      <div className="rounded-lg bg-white/75 p-2">\n                        <dt className="font-bold text-slate-500">Geometry</dt>\n                        <dd className="mt-1 font-black">\n                          {realSceneGeometry.roads.length} roads · {realSceneGeometry.buildings.length} buildings\n                        </dd>\n                      </div>\n                    </dl>\n                  )}\n                </div>\n              </div>`;

wizard = replaceOnce(
  wizard,
  oldSelectedPositionCard,
  newSelectedPositionCard,
  "selected-area extraction controls",
);

wizard = replaceRegexOnce(
  wizard,
  /disabled=\{!selectedCoordinate\}/,
  "disabled={!selectedCoordinate || !realSceneGeometry || !sceneGeometryConfirmed}",
  "location-step completion guard",
);

wizard = replaceOnce(
  wizard,
  '            description="The coordinate remains real in every mode. RoadSafe only generates road geometry when the officer explicitly chooses a road-based environment."',
  '            description="The selected-area geometry remains the source of truth. Environment choices control how that verified geometry is presented—not which junction template is invented."',
  "scene-environment description",
);


// ---------------------------------------------------------------------------
// 3. Make 2D use the selected-area geometry before any generic road template.
// ---------------------------------------------------------------------------
let roadEnvironment = read(roadEnvironmentPath);
if (!roadEnvironment.includes('from "./RealSceneGeometryLayer"')) {
  roadEnvironment = replaceOnce(
    roadEnvironment,
    '} from "../../types/reconstruction";',
    `} from "../../types/reconstruction";\nimport RealSceneGeometryLayer from "./RealSceneGeometryLayer";`,
    "2D real-scene renderer import",
  );
}
if (!roadEnvironment.includes("const realSceneGeometry = settings.realSceneGeometry")) {
  roadEnvironment = replaceOnce(
    roadEnvironment,
    "export default function RoadSceneEnvironment({ settings }: RoadSceneEnvironmentProps) {\n  const roadWidth",
    `export default function RoadSceneEnvironment({ settings }: RoadSceneEnvironmentProps) {\n  const realSceneGeometry = settings.realSceneGeometry?.status === "ready"\n    ? settings.realSceneGeometry\n    : null;\n\n  if (realSceneGeometry) {\n    return (\n      <>\n        <RealSceneGeometryLayer geometry={realSceneGeometry} settings={settings} />\n        <WeatherOverlay settings={settings} />\n      </>\n    );\n  }\n\n  const roadWidth`,
    "2D real-scene rendering branch",
  );
}

// ---------------------------------------------------------------------------
// 4. Make 3D extrude the same selected-area geometry before generic templates.
// ---------------------------------------------------------------------------
let viewer = read(viewerPath);
if (!viewer.includes("realSceneThreeGeometry")) {
  viewer = replaceOnce(
    viewer,
    'import { getParticipantStateAtTime, sortMovementPathPoints } from "../../utils/reconstructionGeometry";',
    `import { getParticipantStateAtTime, sortMovementPathPoints } from "../../utils/reconstructionGeometry";\nimport { addRealSceneGeometryToThreeScene } from "../../utils/realSceneThreeGeometry";`,
    "3D real-scene geometry import",
  );
}
if (!viewer.includes("addRealSceneGeometryToThreeScene({")) {
  viewer = replaceOnce(
    viewer,
    `  if (!usesGeneratedRoad(reconstruction.scene)) {\n    return;\n  }`,
    `  const realSceneGeometry = reconstruction.scene.realSceneGeometry?.status === "ready"\n    ? reconstruction.scene.realSceneGeometry\n    : null;\n\n  if (realSceneGeometry) {\n    addRealSceneGeometryToThreeScene({\n      scene,\n      geometry: realSceneGeometry,\n      heightAt: roadHeightAt,\n      showPavements: reconstruction.scene.showPavements,\n      showLaneMarkings: reconstruction.scene.showLaneMarkings,\n      wet,\n    });\n    return;\n  }\n\n  if (!usesGeneratedRoad(reconstruction.scene)) {\n    return;\n  }`,
    "3D real-scene rendering branch",
  );
}

// ---------------------------------------------------------------------------
// 5. Commit the validated patches, then copy the new source files.
// ---------------------------------------------------------------------------
write(reconstructionTypesPath, reconstructionTypes);
write(wizardPath, wizard);
write(roadEnvironmentPath, roadEnvironment);
write(viewerPath, viewer);

for (const relativePath of [
  "types/realSceneGeometry.ts",
  "services/sceneSnapshotService.ts",
  "services/realSceneExtractionService.ts",
  "components/cases/RoadLocationMap.tsx",
  "components/reconstruction/RealSceneGeometryLayer.tsx",
  "utils/realSceneThreeGeometry.ts",
]) {
  copyPayload(relativePath);
}

console.log("\nRoadSafe Real Scene V1 applied successfully.");
console.log(`Backup created at: ${path.relative(root, backupRoot)}`);
console.log("\nKeep the development server running with: npm run dev");
console.log(
  "Create a new case, draw the blue scene boundary, then choose Capture and Extract Selected Scene.",
);
