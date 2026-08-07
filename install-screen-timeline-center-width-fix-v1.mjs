import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const packagePath = path.join(root, "package.json");
const componentPath = path.join(
  root,
  "src/components/reconstruction/ReconstructionTimelineDock.tsx",
);
const cssPath = path.join(
  root,
  "src/components/reconstruction/reconstructionTimelineDock.css",
);

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
);
const statePath = path.join(
  backupRoot,
  "last-screen-timeline-center-width-fix-v1.json",
);

function fail(message) {
  console.error(message);
  process.exit(1);
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
  componentPath,
  cssPath,
]) {
  if (!fs.existsSync(required)) {
    fail(
      `Required Screen Timeline V5 file missing: ${required}`,
    );
  }
}

const originalComponent =
  fs.readFileSync(componentPath, "utf8");

const originalCss =
  fs.readFileSync(cssPath, "utf8");

let component = originalComponent;
let css = originalCss;

/* ------------------------------------------------------------------ */
/* COMPONENT: measure the actual right Properties host width.          */
/* ------------------------------------------------------------------ */

const oldEffect = `  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shell =
      document.querySelector<HTMLElement>(
        ".roadsafe-workstation",
      );

    if (!shell) {
      return;
    }

    shell.classList.add(
      "has-reconstruction-screen-timeline",
    );

    shell.style.setProperty(
      "--rs-screen-timeline-height",
      \`\${effectiveHeight}px\`,
    );

    return () => {
      shell.classList.remove(
        "has-reconstruction-screen-timeline",
      );

      shell.style.removeProperty(
        "--rs-screen-timeline-height",
      );
    };
  }, [effectiveHeight]);`;

const newEffect = `  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shell =
      document.querySelector<HTMLElement>(
        ".roadsafe-workstation",
      );

    const propertiesHost =
      document.querySelector<HTMLElement>(
        ".roadsafe-workspace-context-slot",
      );

    if (!shell) {
      return;
    }

    shell.classList.add(
      "has-reconstruction-screen-timeline",
    );

    shell.style.setProperty(
      "--rs-screen-timeline-height",
      \`\${effectiveHeight}px\`,
    );

    const updatePropertiesWidth = () => {
      if (!propertiesHost) {
        shell.style.setProperty(
          "--rs-screen-properties-width",
          "0px",
        );

        return;
      }

      const rect =
        propertiesHost.getBoundingClientRect();

      const visible =
        rect.width > 0 &&
        getComputedStyle(
          propertiesHost,
        ).display !== "none";

      shell.style.setProperty(
        "--rs-screen-properties-width",
        visible
          ? \`\${Math.round(rect.width)}px\`
          : "0px",
      );
    };

    updatePropertiesWidth();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(
            updatePropertiesWidth,
          )
        : null;

    if (
      resizeObserver &&
      propertiesHost
    ) {
      resizeObserver.observe(
        propertiesHost,
      );
    }

    window.addEventListener(
      "resize",
      updatePropertiesWidth,
    );

    return () => {
      resizeObserver?.disconnect();

      window.removeEventListener(
        "resize",
        updatePropertiesWidth,
      );

      shell.classList.remove(
        "has-reconstruction-screen-timeline",
      );

      shell.style.removeProperty(
        "--rs-screen-timeline-height",
      );

      shell.style.removeProperty(
        "--rs-screen-properties-width",
      );
    };
  }, [effectiveHeight]);`;

if (!component.includes(newEffect)) {
  if (!component.includes(oldEffect)) {
    fail(
      "Could not locate Screen Timeline shell sizing effect. No files changed.",
    );
  }

  component =
    component.replace(
      oldEffect,
      newEffect,
    );
}

/* ------------------------------------------------------------------ */
/* CSS: timeline ends at the Properties column, not screen edge.       */
/* ------------------------------------------------------------------ */

const rightZero =
`  right: 0 !important;
  bottom: 0 !important;`;

const rightMeasured =
`  right:
    var(
      --rs-screen-properties-width,
      0px
    ) !important;
  bottom: 0 !important;`;

if (!css.includes(rightMeasured)) {
  if (!css.includes(rightZero)) {
    fail(
      "Could not locate Timeline right edge rule. No files changed.",
    );
  }

  css =
    css.replace(
      rightZero,
      rightMeasured,
    );
}

/* ------------------------------------------------------------------ */
/* CSS: ONLY the centre workspace shortens above Timeline.             */
/* Properties now uses its own full-height territory.                  */
/* ------------------------------------------------------------------ */

const oldSharedHeightBlock = `.roadsafe-workstation.has-reconstruction-screen-timeline
  > .roadsafe-center,
.roadsafe-workstation.has-reconstruction-screen-timeline
  > .roadsafe-workspace-context-slot {
  height:
    calc(
      100dvh -
      var(--rs-screen-timeline-height)
    ) !important;

  max-height:
    calc(
      100dvh -
      var(--rs-screen-timeline-height)
    ) !important;

  min-height: 0 !important;
}`;

const newCenterHeightBlock = `.roadsafe-workstation.has-reconstruction-screen-timeline
  > .roadsafe-center {
  height:
    calc(
      100dvh -
      var(--rs-screen-timeline-height)
    ) !important;

  max-height:
    calc(
      100dvh -
      var(--rs-screen-timeline-height)
    ) !important;

  min-height: 0 !important;
}

/*
 * The Properties column is NOT part of the Timeline's territory.
 * It keeps its normal full screen height.
 */
.roadsafe-workstation.has-reconstruction-screen-timeline
  > .roadsafe-workspace-context-slot {
  height: 100dvh !important;
  max-height: 100dvh !important;
}`;

if (!css.includes(newCenterHeightBlock)) {
  if (!css.includes(oldSharedHeightBlock)) {
    fail(
      "Could not locate shared centre/Properties height rule. No files changed.",
    );
  }

  css =
    css.replace(
      oldSharedHeightBlock,
      newCenterHeightBlock,
    );
}

/*
 * V5 had another rule forcing children of the Properties host to fill the
 * shortened host. That is now fine as long as the host itself is full height.
 */

/* ------------------------------------------------------------------ */
/* Guards.                                                             */
/* ------------------------------------------------------------------ */

for (const token of [
  "--rs-screen-properties-width",
  "ResizeObserver",
  "propertiesHost.getBoundingClientRect",
]) {
  if (!component.includes(token)) {
    fail(
      `Component verification failed: ${token}`,
    );
  }
}

for (const token of [
  "--rs-screen-properties-width",
  "> .roadsafe-center {",
  "> .roadsafe-workspace-context-slot {",
  "height: 100dvh !important",
]) {
  if (!css.includes(token)) {
    fail(
      `CSS verification failed: ${token}`,
    );
  }
}

if (
  css.includes(
`.roadsafe-workstation.has-reconstruction-screen-timeline
  > .roadsafe-center,
.roadsafe-workstation.has-reconstruction-screen-timeline
  > .roadsafe-workspace-context-slot {`
  )
) {
  fail(
    "Old shared centre/Properties height rule still exists.",
  );
}

fs.mkdirSync(
  backupRoot,
  { recursive: true },
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      installedAt:
        new Date().toISOString(),
      componentPath:
        path.relative(
          root,
          componentPath,
        ),
      cssPath:
        path.relative(
          root,
          cssPath,
        ),
      originalComponent,
      originalCss,
    },
    null,
    2,
  ),
  "utf8",
);

fs.writeFileSync(
  componentPath,
  component,
  "utf8",
);

fs.writeFileSync(
  cssPath,
  css,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Screen Timeline centre-width fix installed.",
);
console.log("");
console.log(
  "Timeline now:");
console.log(
  "- starts after the left navigation;");
console.log(
  "- ends exactly before the right Properties host;");
console.log(
  "- automatically follows Properties width changes;");
console.log(
  "- no longer shortens the Properties panel vertically;");
console.log(
  "- only reduces the centre workspace height.");
console.log("");
console.log(
  "Refresh/start:");
console.log(
  "  npm run dev");
console.log("");
console.log(
  "Optional build check:");
console.log(
  "  npm run build");
console.log("");
console.log(
  "Rollback:");
console.log(
  "  node revoke-screen-timeline-center-width-fix-v1.mjs");
