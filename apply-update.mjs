import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const payloadRoot = path.join(scriptDirectory, ".roadsafe-update-payload", "src");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".roadsafe-backups", timestamp);

function fail(message) {
  console.error(`\n[RoadSafe wizard V2] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Required file was not found: ${path.relative(root, file)}`);
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
  if (!fs.existsSync(source)) fail(`Update payload is missing: src/${relativePath}`);
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

function replaceRegex(source, regex, replacement, label, optional = false) {
  if (typeof replacement === "string" && source.includes(replacement)) return source;
  regex.lastIndex = 0;
  if (!regex.test(source)) {
    if (optional) return source;
    fail(`Could not find the ${label} section.`);
  }
  regex.lastIndex = 0;
  return source.replace(regex, replacement);
}

if (!fs.existsSync(path.join(root, "package.json"))) {
  fail("Run this updater from the A-R-V1 project root.");
}

const wizardPath = path.join(root, "src/components/cases/NewCaseRoadWizard.tsx");
const viewerPath = path.join(root, "src/components/reconstruction/Reconstruction3DViewer.tsx");

let wizard = read(wizardPath);
let viewer = read(viewerPath);
backup(wizardPath);
backup(viewerPath);

// ---------------------------------------------------------------------------
// 1. Make the complete wizard use the native RoadSafe workspace shell.
// ---------------------------------------------------------------------------
if (!wizard.includes('import "./NewCaseRoadWizard.css";')) {
  const mapImportEnd = 'from "./RoadLocationMap";';
  wizard = replaceOnce(
    wizard,
    mapImportEnd,
    `${mapImportEnd}\n\nimport "./NewCaseRoadWizard.css";`,
    "wizard stylesheet import",
  );
}

if (!wizard.includes("const wizardRootRef = useRef<HTMLDivElement")) {
  wizard = replaceOnce(
    wizard,
    "  const locationMapRef = useRef<RoadLocationMapHandle | null>(null);",
    `  const locationMapRef = useRef<RoadLocationMapHandle | null>(null);\n  const wizardRootRef = useRef<HTMLDivElement | null>(null);`,
    "wizard root ref",
  );
}

if (!wizard.includes("RoadSafe case-wizard page shell")) {
  wizard = replaceRegex(
    wizard,
    /  const locationDisplay = useMemo\(\(\) =>/,
    `  useEffect(() => {\n    // RoadSafe case-wizard page shell: theme the route container as one workspace.\n    const rootElement = wizardRootRef.current;\n    const pageElement = rootElement?.parentElement ?? null;\n    document.body.classList.add("roadsafe-case-wizard-open");\n    pageElement?.classList.add("roadsafe-case-page-shell");\n\n    return () => {\n      document.body.classList.remove("roadsafe-case-wizard-open");\n      pageElement?.classList.remove("roadsafe-case-page-shell");\n    };\n  }, []);\n\n  const locationDisplay = useMemo(() =>`,
    "wizard page-shell effect",
  );
}

wizard = replaceRegex(
  wizard,
  /return \(\s*<div>\s*<WizardProgress step=\{step\} \/>/,
  `return (\n    <div ref={wizardRootRef} className="roadsafe-case-wizard">\n      <WizardProgress step={step} />\n\n      {step === 2 && (\n        <div className="roadsafe-wizard-command" role="status">\n          <span className="roadsafe-wizard-command__number">1–2</span>\n          <div>\n            <strong>Mark the accident spot, then select the complete scene area.</strong>\n            <p>Place the red accident marker first. Next, draw the blue boundary around everything that must appear in the reconstruction. Only that selected area will be captured, extracted and used in 2D and 3D.</p>\n          </div>\n        </div>\n      )}`,
  "wizard root and location command",
);

wizard = wizard
  .replace('title="Confirm the physical accident location"', 'title="Mark the accident spot and select the complete scene area"')
  .replace(
    'description="Use GPS only to centre the map. The officer must then draw the exact accident-scene area that will be reconstructed."',
    'description="GPS may centre the map, but the officer remains in control: mark the collision spot, then draw the exact boundary that RoadSafe must reproduce."',
  )
  .replace('"Current Location",\n    "Scene Environment",\n    "Create Scene",', '"Mark Scene",\n    "Verify Geometry",\n    "Create Case",')
  .replace(
    '"Scene boundary selected. Extract it to create the shared 2D/3D geometry."',
    '"Scene boundary selected. This exact area—not a larger generated map—will become the shared 2D/3D reconstruction scene."',
  );

wizard = replaceRegex(
  wizard,
  /`Scene ready: \$\{result\.geometry\.roads\.length\} road section\(s\), \$\{result\.geometry\.buildings\.length\} building footprint\(s\), \$\{result\.geometry\.sceneWidthMetres\.toFixed\(1\)\} × \$\{result\.geometry\.sceneHeightMetres\.toFixed\(1\)\} m\.`/,
  "`Scene ready: ${result.geometry.roads.length} road section(s), ${result.geometry.buildings.length} building footprint(s), ${result.geometry.vegetation?.length ?? 0} vegetation item(s), ${result.geometry.landCover?.length ?? 0} mapped land-cover area(s), ${result.geometry.sceneWidthMetres.toFixed(1)} × ${result.geometry.sceneHeightMetres.toFixed(1)} m.`",
  "scene extraction summary",
  true,
);

if (!wizard.includes("realSceneGeometry.landCover.length} land cover")) {
  wizard = wizard.replace(
    '{realSceneGeometry.roads.length} roads · {realSceneGeometry.buildings.length} buildings',
    '{realSceneGeometry.roads.length} roads · {realSceneGeometry.buildings.length} buildings · {realSceneGeometry.vegetation?.length ?? 0} vegetation · {realSceneGeometry.landCover?.length ?? 0} land cover',
  );
}

if (!wizard.includes('label="Selected scene size"')) {
  wizard = replaceRegex(
    wizard,
    /\s*<SummaryRow\s+label="Environment"\s+value=\{sceneSettings\.sceneEnvironment\}\s*\/>/,
    `
                <SummaryRow
                  label="Selected scene size"
                  value={\`\${realSceneGeometry?.sceneWidthMetres.toFixed(1) ?? sceneSettings.sceneWidthMetres.toFixed(1)} × \${realSceneGeometry?.sceneHeightMetres.toFixed(1) ?? sceneSettings.sceneHeightMetres.toFixed(1)} m\`}
                />
                <SummaryRow
                  label="Mapped content"
                  value={realSceneGeometry
                    ? \`\${realSceneGeometry.buildings.length} buildings · \${realSceneGeometry.vegetation?.length ?? 0} vegetation · \${realSceneGeometry.landCover?.length ?? 0} land-cover areas\`
                    : "No extracted map content"}
                />
                <SummaryRow
                  label="Environment"
                  value={sceneSettings.sceneEnvironment}
                />`,
    "final exact-area summary",
    true,
  );
}

wizard = wizard.replace(
  /value=\{\s*usesGeneratedRoad\(sceneSettings\)[\s\S]*?"Real-location ground only"\s*\}/,
  'value="Officer-selected exact map area with verified extracted geometry"',
);

// ---------------------------------------------------------------------------
// 2. Force the 3D ground itself to match the exact selected dimensions.
// ---------------------------------------------------------------------------
if (!viewer.includes("const exactSelectedSceneGround")) {
  viewer = replaceOnce(
    viewer,
    "  const roadHeightAt = reconstruction.scene.conformRoadToTerrain\n    ? terrainHeightAt\n    : () => 0;",
    `  const roadHeightAt = reconstruction.scene.conformRoadToTerrain\n    ? terrainHeightAt\n    : () => 0;\n  const realSceneGeometry = reconstruction.scene.realSceneGeometry?.status === "ready"\n    ? reconstruction.scene.realSceneGeometry\n    : null;\n  const exactSelectedSceneGround = Boolean(realSceneGeometry);`,
    "exact selected-ground state",
  );

  viewer = viewer.replace(
    "  if (terrainSurface) {",
    "  if (terrainSurface && !exactSelectedSceneGround) {",
  );

  viewer = viewer.replace(
    "    const groundWidth = width * 1.7;\n    const groundDepth = height * 1.7;",
    "    const groundWidth = exactSelectedSceneGround ? width : width * 1.7;\n    const groundDepth = exactSelectedSceneGround ? height : height * 1.7;",
  );

  viewer = viewer.replace(
    `    const ground = new THREE.Mesh(\n      new THREE.PlaneGeometry(groundWidth, groundDepth),`,
    `    const ground = terrainSurface && exactSelectedSceneGround\n      ? createConformingSurfaceMesh(\n          groundWidth,\n          groundDepth,\n          0,\n          0,\n          terrainHeightAt,\n          -0.02,\n          new THREE.MeshStandardMaterial({\n            map: groundTexture,\n            color: groundSurfaceColour(reconstruction.scene.groundSurface),\n            roughness: 1,\n          }),\n          3,\n        )\n      : new THREE.Mesh(\n          new THREE.PlaneGeometry(groundWidth, groundDepth),`,
  );

  viewer = viewer.replace(
    `    );\n    ground.rotation.x = -Math.PI / 2;\n    ground.receiveShadow = true;\n    scene.add(ground);`,
    `        );\n    if (!(terrainSurface && exactSelectedSceneGround)) {\n      ground.rotation.x = -Math.PI / 2;\n    }\n    ground.receiveShadow = true;\n    scene.add(ground);`,
  );

  viewer = viewer.replace(
    `  const realSceneGeometry = reconstruction.scene.realSceneGeometry?.status === "ready"\n    ? reconstruction.scene.realSceneGeometry\n    : null;\n\n  if (realSceneGeometry) {`,
    "  if (realSceneGeometry) {",
  );
}

write(wizardPath, wizard);
write(viewerPath, viewer);

// ---------------------------------------------------------------------------
// 3. Copy V2 extraction, rendering and UI files.
// ---------------------------------------------------------------------------
for (const relativePath of [
  "types/realSceneGeometry.ts",
  "services/realSceneExtractionService.ts",
  "components/cases/RoadLocationMap.tsx",
  "components/cases/NewCaseRoadWizard.css",
  "components/reconstruction/RealSceneGeometryLayer.tsx",
  "utils/realSceneThreeGeometry.ts",
]) {
  copyPayload(relativePath);
}

console.log("\nRoadSafe case wizard + Real Scene V2 applied successfully.");
console.log(`Backup created at: ${path.relative(root, backupRoot)}`);
console.log("\nKeep your existing development server running: npm run dev");
console.log("Open /cases/new, mark the red spot, select the blue area, extract it, review it, and confirm it.");
