import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TARGET = path.join(
  ROOT,
  "src",
  "components",
  "map",
  "junctionMapLayer.ts",
);

function fail(message) {
  console.error(`\n[RoadSafe] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  fail("Run this installer from the A-R-V1 project root.");
}

if (!fs.existsSync(TARGET)) {
  fail("src/components/map/junctionMapLayer.ts was not found.");
}

let source = fs.readFileSync(TARGET, "utf8");

const requiredSignals = [
  'card.style.background',
  'riskBox.style.background',
  'new maplibregl.Popup({',
  'View Full Analysis',
];

for (const signal of requiredSignals) {
  if (!source.includes(signal)) {
    fail(
      `Expected junction popup code is missing: ${signal}. No file changed.`,
    );
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `junction-popup-exact-fix-v1-${stamp}`,
);

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(
  TARGET,
  path.join(backupDir, "junctionMapLayer.ts"),
);

// -----------------------------------------------------------------------------
// 1. Dark compact popup cards — THIS is the white tile shown in the screenshot.
// -----------------------------------------------------------------------------

source = source
  .replace(
    `  labelElement.style.color =
    "#6b7280";`,
    `  labelElement.style.color =
    "#94a3b8";`,
  )
  .replace(
    `  valueElement.style.color =
    "#292929";`,
    `  valueElement.style.color =
    "#e2e8f0";`,
  )
  .replace(
    `  card.style.border =
    "1px solid #e5e7eb";`,
    `  card.style.border =
    "1px solid #494949";`,
  )
  .replace(
    `  card.style.background =
    "#f9fafb";`,
    `  card.style.background =
    "#292929";`,
  );

// Explicit stat value colour: avoids inherited white/light-theme conflicts.
const valueWeightAnchor = `  valueElement.style.fontWeight =
    "800";`;

if (
  source.includes(valueWeightAnchor) &&
  !source.includes(
    `  valueElement.style.color =
    "#f1f5f9";`,
  )
) {
  source = source.replace(
    valueWeightAnchor,
    `${valueWeightAnchor}
  valueElement.style.color =
    "#f1f5f9";`,
  );
}

source = source
  .replace(
    `  heading.style.color = "#292929";`,
    `  heading.style.color = "#f1f5f9";`,
  )
  .replace(
    `  location.style.color = "#6b7280";`,
    `  location.style.color = "#94a3b8";`,
  )
  .replace(
    `  riskBox.style.background =
    "#f9fafb";`,
    `  riskBox.style.background =
    "#292929";`,
  )
  .replace(
    `  riskBox.style.border =
    "1px solid #e5e7eb";`,
    `  riskBox.style.border =
    "1px solid #494949";`,
  );

// Risk score text was inheriting a light/unknown colour.
const riskScoreTextAnchor = `  riskScore.textContent =
    \`Score: \${risk.riskScore}\`;`;

if (
  source.includes(riskScoreTextAnchor) &&
  !source.includes(
    `  riskScore.style.color =
    "#cbd5e1";`,
  )
) {
  source = source.replace(
    riskScoreTextAnchor,
    `${riskScoreTextAnchor}

  riskScore.style.color =
    "#cbd5e1";
  riskScore.style.fontSize =
    "13px";`,
  );
}

// Container gets its own dark surface so it never depends on MapLibre defaults.
const containerPaddingAnchor = `  container.style.padding = "6px";`;

if (
  source.includes(containerPaddingAnchor) &&
  !source.includes(
    `  container.style.background =
    "#202020";`,
  )
) {
  source = source.replace(
    containerPaddingAnchor,
    `${containerPaddingAnchor}
  container.style.background =
    "#202020";
  container.style.color =
    "#e2e8f0";
  container.style.borderRadius =
    "6px";`,
  );
}

// -----------------------------------------------------------------------------
// 2. Full-analysis button: RoadSafe orange, not old blue.
// -----------------------------------------------------------------------------

source = source
  .replace(
    `    fullAnalysisButton.style.border =
      "none";`,
    `    fullAnalysisButton.style.border =
      "1px solid #8c6039";`,
  )
  .replace(
    `    fullAnalysisButton.style.borderRadius =
      "9px";`,
    `    fullAnalysisButton.style.borderRadius =
      "6px";`,
  )
  .replace(
    `    fullAnalysisButton.style.background =
      "#2563eb";`,
    `    fullAnalysisButton.style.background =
      "#3a2c21";`,
  )
  .replace(
    `    fullAnalysisButton.style.color =
      "#ffffff";`,
    `    fullAnalysisButton.style.color =
      "#f0c49a";`,
  );

// -----------------------------------------------------------------------------
// 3. Fix the ACTUAL tiny MapLibre X and white popup shell.
// -----------------------------------------------------------------------------

const popupSetContentPattern =
  /const popup\s*=\s*new maplibregl\.Popup\(\{[\s\S]*?\}\)\.setDOMContent\([\s\S]*?\);\n\n\s*const marker\s*=/m;

const popupMatch = source.match(popupSetContentPattern);

if (!popupMatch) {
  fail(
    "Could not locate the MapLibre popup construction block. No file changed.",
  );
}

if (!source.includes("RoadSafe popup shell styling")) {
  const originalBlock = popupMatch[0];
  const markerSuffix = originalBlock.lastIndexOf("\n\n      const marker =");

  if (markerSuffix < 0) {
    fail("Could not split popup block from marker block. No file changed.");
  }

  const popupBlock = originalBlock.slice(0, markerSuffix);
  const markerBlock = originalBlock.slice(markerSuffix);

  const styling = `

      // RoadSafe popup shell styling.
      popup.on("open", () => {
        const popupElement =
          popup.getElement();

        const content =
          popupElement.querySelector(
            ".maplibregl-popup-content",
          ) as HTMLElement | null;

        if (content) {
          content.style.background =
            "#202020";
          content.style.color =
            "#e2e8f0";
          content.style.border =
            "1px solid #494949";
          content.style.borderRadius =
            "6px";
          content.style.padding =
            "10px";
          content.style.boxShadow =
            "0 18px 48px rgba(0,0,0,0.58)";
        }

        const closeButton =
          popupElement.querySelector(
            ".maplibregl-popup-close-button",
          ) as HTMLButtonElement | null;

        if (closeButton) {
          closeButton.style.width =
            "30px";
          closeButton.style.height =
            "30px";
          closeButton.style.top =
            "7px";
          closeButton.style.right =
            "7px";
          closeButton.style.display =
            "grid";
          closeButton.style.placeItems =
            "center";
          closeButton.style.padding =
            "0";
          closeButton.style.border =
            "1px solid #494949";
          closeButton.style.borderRadius =
            "4px";
          closeButton.style.background =
            "#303030";
          closeButton.style.color =
            "#cbd5e1";
          closeButton.style.fontSize =
            "18px";
          closeButton.style.fontWeight =
            "500";
          closeButton.style.lineHeight =
            "1";
          closeButton.style.cursor =
            "pointer";
        }

        const tip =
          popupElement.querySelector(
            ".maplibregl-popup-tip",
          ) as HTMLElement | null;

        if (tip) {
          // Avoid MapLibre's default white triangle clashing with the dark popup.
          tip.style.display = "none";
        }
      });`;

  source = source.replace(
    originalBlock,
    popupBlock + styling + markerBlock,
  );
}

// -----------------------------------------------------------------------------
// 4. Small spacing polish so close button never overlaps content.
// -----------------------------------------------------------------------------

source = source
  .replace(
    `  container.style.padding = "6px";`,
    `  container.style.padding = "10px 34px 10px 10px";`,
  )
  .replace(
    `  container.style.minWidth = "290px";`,
    `  container.style.minWidth = "300px";`,
  )
  .replace(
    `  container.style.maxWidth = "340px";`,
    `  container.style.maxWidth = "360px";`,
  );

fs.writeFileSync(TARGET, source, "utf8");

console.log("\n[RoadSafe] Junction Popup Exact Fix V1 applied.");
console.log("[RoadSafe] Exact white stat cards -> dark #292929.");
console.log("[RoadSafe] Stat values -> explicit readable #f1f5f9.");
console.log("[RoadSafe] Risk box -> dark RoadSafe surface.");
console.log("[RoadSafe] Popup shell -> dark #202020.");
console.log("[RoadSafe] Tiny MapLibre X -> 30x30 dark close control.");
console.log("[RoadSafe] Default white popup triangle -> removed.");
console.log("[RoadSafe] View Full Analysis button -> RoadSafe orange styling.");
console.log(`[RoadSafe] Backup: ${path.relative(ROOT, backupDir)}`);
console.log("\nRun:");
console.log("  npm run build");
