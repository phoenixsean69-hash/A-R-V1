import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const FEATURE_DIR =
  path.join(
    ROOT,
    "src",
    "features",
    "forensicReconstruction",
  );

const WORKSPACE =
  path.join(
    FEATURE_DIR,
    "ForensicInvestigationWorkspace.tsx",
  );

const ROUTES =
  path.join(
    ROOT,
    "src",
    "routes",
    "caseManagementRoutes.tsx",
  );

const SIM_SERVICE =
  path.join(
    FEATURE_DIR,
    "forensicSimulationService.ts",
  );

const SIM_TYPES =
  path.join(
    FEATURE_DIR,
    "forensicSimulationTypes.ts",
  );

function fail(message) {
  console.error(
    `\n[RoadSafe] ${message}`,
  );
  process.exit(1);
}

if (
  !fs.existsSync(
    path.join(
      ROOT,
      "package.json",
    ),
  )
) {
  fail(
    "Run this installer from the A-R-V1 project root.",
  );
}

for (
  const file of [
    WORKSPACE,
    ROUTES,
    SIM_SERVICE,
    SIM_TYPES,
  ]
) {
  if (!fs.existsSync(file)) {
    fail(
      `Required file missing: ${path.relative(
        ROOT,
        file,
      )}`,
    );
  }
}

let workspace =
  fs.readFileSync(
    WORKSPACE,
    "utf8",
  );

let routes =
  fs.readFileSync(
    ROUTES,
    "utf8",
  );

if (
  !workspace.includes(
    'section === "Simulation"',
  )
) {
  fail(
    "Simulation is not active yet. Install and verify Simulation V1 first.",
  );
}

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-ui-backup",
    `forensic-reconstruction-screen-v1-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

fs.copyFileSync(
  WORKSPACE,
  path.join(
    backupDir,
    "ForensicInvestigationWorkspace.tsx",
  ),
);

fs.copyFileSync(
  ROUTES,
  path.join(
    backupDir,
    "caseManagementRoutes.tsx",
  ),
);

const payloadFiles = [
  [
    "forensicCanonicalReconstructionService.ts",
    path.join(
      FEATURE_DIR,
      "forensicCanonicalReconstructionService.ts",
    ),
  ],
  [
    "ForensicReconstructionWorkspace.tsx",
    path.join(
      FEATURE_DIR,
      "ForensicReconstructionWorkspace.tsx",
    ),
  ],
  [
    "ForensicReconstructionWorkspace.css",
    path.join(
      FEATURE_DIR,
      "ForensicReconstructionWorkspace.css",
    ),
  ],
  [
    "CaseCanonicalReconstructionPage.tsx",
    path.join(
      ROOT,
      "src",
      "pages",
      "CaseCanonicalReconstructionPage.tsx",
    ),
  ],
];

for (
  const [
    payloadName,
    destination,
  ] of payloadFiles
) {
  const source =
    path.join(
      HERE,
      "payload",
      payloadName,
    );

  if (
    !fs.existsSync(
      source,
    )
  ) {
    fail(
      `Installer payload missing ${payloadName}.`,
    );
  }

  if (
    fs.existsSync(
      destination,
    )
  ) {
    fs.copyFileSync(
      destination,
      path.join(
        backupDir,
        path.basename(
          destination,
        ),
      ),
    );
  }

  fs.copyFileSync(
    source,
    destination,
  );
}

if (
  !workspace.includes(
    'import ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";',
  )
) {
  const importAnchor =
    'import SimulationWorkspace from "./SimulationWorkspace";';

  if (
    !workspace.includes(
      importAnchor,
    )
  ) {
    fail(
      "Could not find SimulationWorkspace import.",
    );
  }

  workspace =
    workspace.replace(
      importAnchor,
      `${importAnchor}\nimport ForensicReconstructionWorkspace from "./ForensicReconstructionWorkspace";`,
    );
}

const activeStart =
  workspace.indexOf(
    "const ACTIVE = new Set<Section>([",
  );

if (
  activeStart <
  0
) {
  fail(
    "Could not find ACTIVE forensic section list.",
  );
}

const activeEnd =
  workspace.indexOf(
    "]);",
    activeStart,
  );

if (
  activeEnd <
  0
) {
  fail(
    "Could not read ACTIVE forensic section list.",
  );
}

const activeBlock =
  workspace.slice(
    activeStart,
    activeEnd + 3,
  );

if (
  !activeBlock.includes(
    '"2D / 3D / AR"',
  )
) {
  if (
    !activeBlock.includes(
      '"Simulation"',
    )
  ) {
    fail(
      "Simulation is not active. Reconstruction cannot be activated out of order.",
    );
  }

  const patched =
    activeBlock.replace(
      '  "Simulation",',
      '  "Simulation",\n  "2D / 3D / AR",',
    );

  workspace =
    workspace.slice(
      0,
      activeStart,
    ) +
    patched +
    workspace.slice(
      activeEnd + 3,
    );
}

if (
  !workspace.includes(
    'section === "2D / 3D / AR" &&',
  )
) {
  const fallbackAnchor =
    `          {!ACTIVE.has(section) && (`;

  if (
    !workspace.includes(
      fallbackAnchor,
    )
  ) {
    fail(
      "Could not locate future-module fallback.",
    );
  }

  const renderBlock =
    `          {section === "2D / 3D / AR" && (
            <ForensicReconstructionWorkspace
              investigation={investigation}
              onMessage={setMessage}
            />
          )}

`;

  workspace =
    workspace.replace(
      fallbackAnchor,
      renderBlock +
        fallbackAnchor,
    );
}

if (
  !routes.includes(
    'import CaseCanonicalReconstructionPage from "../pages/CaseCanonicalReconstructionPage";',
  )
) {
  const routeImportAnchor =
    'import CaseARReconstructionPage from "../pages/CaseARReconstructionPage";';

  if (
    !routes.includes(
      routeImportAnchor,
    )
  ) {
    fail(
      "Could not find CaseARReconstructionPage route import.",
    );
  }

  routes =
    routes.replace(
      routeImportAnchor,
      `${routeImportAnchor}\nimport CaseCanonicalReconstructionPage from "../pages/CaseCanonicalReconstructionPage";`,
    );
}

if (
  !routes.includes(
    'path=":caseId/reconstruction/canonical"',
  )
) {
  const arRouteAnchor =
    `      <Route
        path=":caseId/reconstruction/ar"
        element={
          <CaseARReconstructionPage />
        }
      />`;

  if (
    !routes.includes(
      arRouteAnchor,
    )
  ) {
    fail(
      "Could not find the existing AR route.",
    );
  }

  const canonicalRoute =
    `      <Route
        path=":caseId/reconstruction/canonical"
        element={
          <CaseCanonicalReconstructionPage />
        }
      />

`;

  routes =
    routes.replace(
      arRouteAnchor,
      canonicalRoute +
        arRouteAnchor,
    );
}

fs.writeFileSync(
  WORKSPACE,
  workspace,
  "utf8",
);

fs.writeFileSync(
  ROUTES,
  routes,
  "utf8",
);

console.log(
  "\n[RoadSafe] Forensic 2D / 3D / AR Reconstruction Screen V1 installed.",
);

console.log(
  "[RoadSafe] One simulation run can now be promoted into one canonical reconstruction.",
);

console.log(
  "[RoadSafe] 2D preview, existing Three.js 3D viewer and existing AR route share that canonical source.",
);

console.log(
  "[RoadSafe] Original forensic source records remain outside the derived reconstruction.",
);

console.log(
  `[RoadSafe] Backup: ${path.relative(
    ROOT,
    backupDir,
  )}`,
);

console.log(
  "\nRun:",
);

console.log(
  "  npm run build",
);
