import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(message);
  }
}

const authRoutes =
  read(
    "src/components/auth/AuthRoutes.tsx",
  );

const changePassword =
  read(
    "src/pages/ChangePasswordPage.tsx",
  );

const roadLocationMap =
  read(
    "src/components/cases/RoadLocationMap.tsx",
  );

const appShell =
  read(
    "src/components/layout/AppShell.tsx",
  );

const arPage =
  read(
    "src/pages/CaseARReconstructionPage.tsx",
  );

assert(
  authRoutes.includes(
    "[RoadSafe:TypedPasswordPreferencesV1]",
  ),
  "Typed authentication preference marker is missing.",
);

assert(
  authRoutes.includes(
    "mustChangePassword?: boolean",
  ),
  "Authentication preferences do not declare mustChangePassword.",
);

assert(
  !authRoutes.includes(
    "auth.identity.user.prefs\n      ?.mustChangePassword",
  ),
  "AuthRoutes still directly reads the unknown Appwrite preference field.",
);

assert(
  changePassword.includes(
    "[RoadSafe:StablePasswordChangeIdentityV1]",
  ),
  "Stable password-change identity marker is missing.",
);

assert(
  changePassword.includes(
    "const identity =\n    auth.identity;",
  ),
  "ChangePasswordPage does not capture the narrowed identity.",
);

assert(
  changePassword.includes(
    "...userPreferences",
  ),
  "ChangePasswordPage does not use its typed preferences.",
);

assert(
  !changePassword.includes(
    "...auth.identity.user.prefs",
  ),
  "The nullable auth identity remains inside the async submit callback.",
);

assert(
  roadLocationMap.includes(
    "canvasContextAttributes:",
  ),
  "MapLibre canvasContextAttributes are missing.",
);

assert(
  roadLocationMap.includes(
    "preserveDrawingBuffer:",
  ),
  "MapLibre preserveDrawingBuffer setting was lost.",
);

assert(
  !roadLocationMap.includes(
    "maxZoom: 20,\n        preserveDrawingBuffer:",
  ),
  "preserveDrawingBuffer remains a top-level MapOptions property.",
);

assert(
  appShell.includes(
    "[RoadSafe:TypedShellNavigationV1]",
  ),
  "Typed shell navigation marker is missing.",
);

assert(
  appShell.includes(
    "useMemo<AppNavigationItem[]>",
  ),
  "Navigation useMemo does not use the shared item type.",
);

assert(
  !/\n\s*Home,\s*\n/.test(
    appShell,
  ),
  "The unused Home import remains.",
);

assert(
  !/\n\s*ScanLine,\s*\n/.test(
    arPage,
  ),
  "The unused ScanLine import remains.",
);

console.log(
  "✓ Custom Appwrite password preferences are typed",
);

console.log(
  "✓ Password-change callback uses a stable non-null identity",
);

console.log(
  "✓ MapLibre WebGL options use canvasContextAttributes",
);

console.log(
  "✓ AppShell navigation items share an optional end property",
);

console.log(
  "✓ Unused Home and ScanLine imports were removed",
);

console.log(
  "\nFull application compatibility repair verification passed.",
);
