import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  authRoutes:
    "src/components/auth/AuthRoutes.tsx",

  changePassword:
    "src/pages/ChangePasswordPage.tsx",

  roadLocationMap:
    "src/components/cases/RoadLocationMap.tsx",

  appShell:
    "src/components/layout/AppShell.tsx",

  arPage:
    "src/pages/CaseARReconstructionPage.tsx",
};

function absolute(relativePath) {
  return path.join(
    root,
    relativePath,
  );
}

function read(relativePath) {
  const target =
    absolute(relativePath);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Required file is missing: ${relativePath}`,
    );
  }

  return fs
    .readFileSync(
      target,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function write(
  relativePath,
  content,
) {
  fs.writeFileSync(
    absolute(relativePath),
    content,
    "utf8",
  );
}

function replaceOnce(
  source,
  before,
  after,
  label,
) {
  const first =
    source.indexOf(before);

  if (first < 0) {
    throw new Error(
      `Could not apply "${label}". Expected source was not found.`,
    );
  }

  const second =
    source.indexOf(
      before,
      first + before.length,
    );

  if (second >= 0) {
    throw new Error(
      `Refusing ambiguous replacement for "${label}".`,
    );
  }

  return (
    source.slice(0, first) +
    after +
    source.slice(first + before.length)
  );
}

let authRoutes =
  read(files.authRoutes);

let changePassword =
  read(files.changePassword);

let roadLocationMap =
  read(files.roadLocationMap);

let appShell =
  read(files.appShell);

let arPage =
  read(files.arPage);

if (
  authRoutes.includes(
    "[RoadSafe:TypedPasswordPreferencesV1]",
  )
) {
  throw new Error(
    "The full-build compatibility repair is already installed.",
  );
}

/*
 * Appwrite's generic Models.Preferences type does not know about the custom
 * preference fields stored by RoadSafe. Narrow those fields locally without
 * weakening the complete authentication identity type.
 */
authRoutes =
  replaceOnce(
    authRoutes,
`  const mustChangePassword =
    auth.identity.user.prefs
      ?.mustChangePassword === true;`,
`  /*
   * [RoadSafe:TypedPasswordPreferencesV1]
   *
   * Appwrite preferences allow application-defined fields, while the SDK's
   * base Preferences type cannot infer RoadSafe's password-state fields.
   */
  const userPreferences =
    auth.identity.user.prefs as
      typeof auth.identity.user.prefs & {
        mustChangePassword?: boolean;
        passwordChangedAt?: string;
      };

  const mustChangePassword =
    userPreferences
      .mustChangePassword === true;`,
    "type authentication password preferences",
  );

/*
 * Capture the authenticated identity in a stable local constant. The render
 * guard then remains valid inside the asynchronous submit callback.
 */
changePassword =
  replaceOnce(
    changePassword,
`  const mustChangePassword =
    auth.identity.user.prefs
      ?.mustChangePassword === true;`,
`  /*
   * [RoadSafe:StablePasswordChangeIdentityV1]
   *
   * Capture the narrowed authenticated identity before creating the async
   * submit closure. This prevents the mutable auth context property from
   * becoming nullable again inside that closure.
   */
  const identity =
    auth.identity;

  const userPreferences =
    identity.user.prefs as
      typeof identity.user.prefs & {
        mustChangePassword?: boolean;
        passwordChangedAt?: string;
      };

  const mustChangePassword =
    userPreferences
      .mustChangePassword === true;`,
    "capture stable password-change identity",
  );

changePassword =
  replaceOnce(
    changePassword,
`          ...auth.identity.user.prefs,`,
`          ...userPreferences,`,
    "use stable typed password preferences",
  );

/*
 * MapLibre 5 places WebGL context flags under canvasContextAttributes.
 */
roadLocationMap =
  replaceOnce(
    roadLocationMap,
`        maxZoom: 20,
        preserveDrawingBuffer: true,
        attributionControl: false,`,
`        maxZoom: 20,
        canvasContextAttributes: {
          preserveDrawingBuffer:
            true,
        },
        attributionControl: false,`,
    "move preserveDrawingBuffer into canvasContextAttributes",
  );

/*
 * Remove the unused Home icon and give the navigation arrays a shared item
 * type so the optional NavLink end property is valid for every item.
 */
appShell =
  replaceOnce(
    appShell,
`  FolderKanban,
  Home,
  LogOut,`,
`  FolderKanban,
  LogOut,`,
    "remove unused Home import",
  );

appShell =
  replaceOnce(
    appShell,
`const sharedNavItems = [`,
`/*
 * [RoadSafe:TypedShellNavigationV1]
 *
 * Both station and field navigation use one explicit item shape. Only root
 * destinations need React Router's optional exact-match flag.
 */
interface AppNavigationItem {
  to: string;
  label: string;
  icon: typeof Building2;
  end?: boolean;
}

const sharedNavItems:
  AppNavigationItem[] = [`,
    "add shared navigation item type",
  );

appShell =
  replaceOnce(
    appShell,
`  const navItems = useMemo(
`,
`  const navItems =
    useMemo<AppNavigationItem[]>(
`,
    "type memoized navigation items",
  );

/*
 * Remove the unused AR-page icon import.
 */
arPage =
  replaceOnce(
    arPage,
`  AlertTriangle,
  ArrowLeft,
  ScanLine,
} from "lucide-react";`,
`  AlertTriangle,
  ArrowLeft,
} from "lucide-react";`,
    "remove unused ScanLine import",
  );

write(
  files.authRoutes,
  authRoutes,
);

write(
  files.changePassword,
  changePassword,
);

write(
  files.roadLocationMap,
  roadLocationMap,
);

write(
  files.appShell,
  appShell,
);

write(
  files.arPage,
  arPage,
);

console.log(
  "updated src/components/auth/AuthRoutes.tsx",
);

console.log(
  "updated src/pages/ChangePasswordPage.tsx",
);

console.log(
  "updated src/components/cases/RoadLocationMap.tsx",
);

console.log(
  "updated src/components/layout/AppShell.tsx",
);

console.log(
  "updated src/pages/CaseARReconstructionPage.tsx",
);

console.log(
  "Full application build compatibility repair applied.",
);
