import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = path.join(ROOT, "package.json");
const INDEX_CSS = path.join(ROOT, "src", "index.css");
const INDEX_HTML = path.join(ROOT, "index.html");
const SOURCE_CSS = path.join(HERE, "src", "styles", "saira.css");
const SOURCE_FONTS = path.join(HERE, "fonts", "saira");
const TARGET_CSS = path.join(ROOT, "src", "styles", "saira.css");
const TARGET_FONTS = path.join(ROOT, "public", "fonts", "saira");

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(PACKAGE)) fail("package.json was not found. Run this from the A-R-V1 repository root.");
if (!fs.existsSync(INDEX_CSS) || !fs.existsSync(INDEX_HTML)) fail("RoadSafe src/index.css or index.html was not found.");
if (!fs.existsSync(SOURCE_CSS) || !fs.existsSync(SOURCE_FONTS)) fail("The Saira bundle is incomplete.");

const pkg = JSON.parse(fs.readFileSync(PACKAGE, "utf8"));
if (pkg.name !== "roadsafe-ar") fail(`Expected package name roadsafe-ar, found ${pkg.name ?? "unknown"}.`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(ROOT, ".roadsafe-ui-backup", `saira-font-v1-${stamp}`);
fs.mkdirSync(backup, { recursive: true });
fs.copyFileSync(INDEX_CSS, path.join(backup, "index.css"));
fs.copyFileSync(INDEX_HTML, path.join(backup, "index.html"));

fs.mkdirSync(path.dirname(TARGET_CSS), { recursive: true });
fs.mkdirSync(TARGET_FONTS, { recursive: true });
fs.copyFileSync(SOURCE_CSS, TARGET_CSS);
for (const entry of fs.readdirSync(SOURCE_FONTS, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  fs.copyFileSync(path.join(SOURCE_FONTS, entry.name), path.join(TARGET_FONTS, entry.name));
}

let css = fs.readFileSync(INDEX_CSS, "utf8");
if (!css.includes('@import "./styles/saira.css";')) {
  css = '@import "./styles/saira.css";\n' + css;
}
css = css.replace(/--font-sans:\s*"Rajdhani",\s*sans-serif;/g, '--font-sans: "Saira", sans-serif;');
css = css.replace(/--font-mono:\s*"Rajdhani",\s*sans-serif;/g, '--font-mono: "Saira", sans-serif;');
fs.writeFileSync(INDEX_CSS, css, "utf8");

let html = fs.readFileSync(INDEX_HTML, "utf8");
html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>\s*<link\s+href="https:\/\/fonts\.googleapis\.com\/css2\?family=Rajdhani:wght@300;400;500;600;700&display=swap"\s+rel="stylesheet"\s*\/>/m, "");
fs.writeFileSync(INDEX_HTML, html, "utf8");

console.log("\n[RoadSafe] Saira Font V1 installed.");
console.log("[RoadSafe] 100 Thin -> Saira Thin");
console.log("[RoadSafe] 200 ExtraLight -> Saira ExtraLight");
console.log("[RoadSafe] 300 Light -> Saira Light");
console.log("[RoadSafe] 400 Regular -> Saira Regular");
console.log("[RoadSafe] 500 Medium -> Saira Medium");
console.log("[RoadSafe] 600 SemiBold -> Saira SemiBold");
console.log("[RoadSafe] 700 Bold -> Saira Bold");
console.log("[RoadSafe] 800 ExtraBold -> Saira ExtraBold");
console.log("[RoadSafe] 900 Black -> Saira Black");
console.log("[RoadSafe] Italic counterparts are mapped at every weight.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backup)}`);
console.log("[RoadSafe] Run npm run build to verify the project.");
