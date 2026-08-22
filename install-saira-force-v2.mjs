import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INDEX_CSS = path.join(ROOT, "src", "index.css");
const INDEX_HTML = path.join(ROOT, "index.html");
const FONTS_DIR = path.join(ROOT, "public", "fonts", "saira");
const SAIRA_CSS = path.join(ROOT, "src", "styles", "saira.css");

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("package.json not found. Run this from C:\\Users\\nooklyweb\\Desktop\\A-R-V1");
}
if (!fs.existsSync(INDEX_CSS) || !fs.existsSync(INDEX_HTML)) {
  fail("src/index.css or index.html is missing.");
}

const requiredFonts = [
  "Saira-Regular.ttf",
  "Saira-Medium.ttf",
  "Saira-SemiBold.ttf",
  "Saira-Bold.ttf",
  "Saira-ExtraBold.ttf",
];

for (const font of requiredFonts) {
  if (!fs.existsSync(path.join(FONTS_DIR, font))) {
    fail(
      `Missing public/fonts/saira/${font}. ` +
      "Run the original Saira installer first so the uploaded font files are copied into the project."
    );
  }
}

if (!fs.existsSync(SAIRA_CSS)) {
  fail("src/styles/saira.css is missing. Run the original Saira installer first.");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, ".roadsafe-ui-backup", `saira-force-v2-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(INDEX_CSS, path.join(backupDir, "index.css"));
fs.copyFileSync(INDEX_HTML, path.join(backupDir, "index.html"));

let css = fs.readFileSync(INDEX_CSS, "utf8");

// Keep Tailwind import first, then Saira import.
css = css.replace(/^\s*@import\s+["']\.\/styles\/saira\.css["'];\s*/m, "");
if (css.includes('@import "tailwindcss";')) {
  css = css.replace(
    '@import "tailwindcss";',
    '@import "tailwindcss";\n@import "./styles/saira.css";'
  );
} else if (!css.includes('@import "./styles/saira.css";')) {
  css = '@import "./styles/saira.css";\n' + css;
}

// Replace any surviving Rajdhani theme definitions.
css = css.replace(
  /--font-sans:\s*["']Rajdhani["']\s*,\s*sans-serif\s*;/gi,
  '--font-sans: "Saira", sans-serif;'
);
css = css.replace(
  /--font-mono:\s*["']Rajdhani["']\s*,\s*sans-serif\s*;/gi,
  '--font-mono: "Saira", sans-serif;'
);

// If the variables are absent, add them to the Tailwind theme.
if (!/--font-sans\s*:/.test(css)) {
  css = css.replace(
    /@theme\s*\{/,
    '@theme {\n  --font-sans: "Saira", sans-serif;'
  );
}
if (!/--font-mono\s*:/.test(css)) {
  css = css.replace(
    /@theme\s*\{/,
    '@theme {\n  --font-mono: "Saira", sans-serif;'
  );
}

const BEGIN = "/* ROADSAFE SAIRA FORCE V2 BEGIN */";
const END = "/* ROADSAFE SAIRA FORCE V2 END */";
const forceBlock = `${BEGIN}
:root {
  --font-sans: "Saira", sans-serif;
  --font-mono: "Saira", sans-serif;
}

html,
body,
#root,
.roadsafe-shell,
.reconstruction-editor,
.reconstruction-workspace,
.fv2-root,
.maplibregl-map,
button,
input,
select,
textarea,
table {
  font-family: "Saira", sans-serif !important;
}

/*
 * Force the application subtree to Saira so old component-level
 * font declarations cannot silently keep Rajdhani/Inter/system fonts.
 * Material Symbols is explicitly excluded so icon glyphs remain intact.
 */
#root *:not(.material-symbols-outlined) {
  font-family: "Saira", sans-serif !important;
}

.material-symbols-outlined {
  font-family: "Material Symbols Outlined" !important;
}
${END}`;

const oldBlock = new RegExp(
  `/\\* ROADSAFE SAIRA FORCE V2 BEGIN \\*/[\\s\\S]*?/\\* ROADSAFE SAIRA FORCE V2 END \\*/`,
  "m"
);
if (oldBlock.test(css)) {
  css = css.replace(oldBlock, forceBlock);
} else {
  css = css.trimEnd() + "\n\n" + forceBlock + "\n";
}

fs.writeFileSync(INDEX_CSS, css, "utf8");

// Remove Rajdhani Google Fonts links, while preserving Material Symbols.
let html = fs.readFileSync(INDEX_HTML, "utf8");
html = html.replace(
  /<link[^>]+href=["'][^"']*fonts\.googleapis\.com\/css2\?family=Rajdhani[^"']*["'][^>]*>\s*/gi,
  ""
);

// Remove Google preconnects only when they are not needed for Material Symbols.
// Since Material Symbols still uses Google Fonts in this project, we leave
// the generic preconnects alone.
fs.writeFileSync(INDEX_HTML, html, "utf8");

console.log("\n[RoadSafe] Saira Force V2 applied.");
console.log("[RoadSafe] Global family: Saira");
console.log("[RoadSafe] Weight 500 -> Saira Medium");
console.log("[RoadSafe] Weight 600 -> Saira SemiBold");
console.log("[RoadSafe] Weight 700 -> Saira Bold");
console.log("[RoadSafe] Weight 800 -> Saira ExtraBold");
console.log("[RoadSafe] Material Symbols preserved.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nNext:");
console.log("  1. Stop the Vite dev server (Ctrl+C).");
console.log("  2. Run: npm run dev");
console.log("  3. In the browser press Ctrl+Shift+R for a hard refresh.");
console.log("  4. Optional check in DevTools Console:");
console.log('     getComputedStyle(document.body).fontFamily');
