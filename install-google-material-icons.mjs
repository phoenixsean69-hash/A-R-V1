import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const srcRoot = path.join(root, "src");
const indexHtmlPath = path.join(root, "index.html");
const mainPath = path.join(srcRoot, "main.tsx");
const dashboardPath = path.join(srcRoot, "pages", "Dashboard.tsx");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

for (const requiredPath of [
  srcRoot,
  indexHtmlPath,
  mainPath,
  dashboardPath,
]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(
      `Required project path was not found: ${path.relative(root, requiredPath)}`,
    );
    process.exit(1);
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

function backup(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const relativePath = path.relative(
    root,
    absolutePath,
  );

  const destination = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(
    absolutePath,
    destination,
  );
}

function walk(directory) {
  const files = [];

  for (
    const entry of fs.readdirSync(
      directory,
      { withFileTypes: true },
    )
  ) {
    const absolutePath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      [".ts", ".tsx", ".js", ".jsx"].includes(
        path.extname(entry.name).toLowerCase(),
      )
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

/*
 * Lucide component name -> Google Material Symbols ligature.
 *
 * The installer generates exports only for the icons actually imported by the
 * current repository. Unknown names still become a valid Google Material icon
 * ("widgets") instead of rendering broken ligature text.
 */
const MATERIAL_SYMBOL_BY_LUCIDE = {
  Activity: "monitoring",
  Airplay: "cast",
  AlarmClock: "alarm",
  AlertCircle: "error",
  AlertOctagon: "report",
  AlertTriangle: "warning",
  AlignCenter: "format_align_center",
  AlignLeft: "format_align_left",
  AlignRight: "format_align_right",
  Ambulance: "emergency",
  AppWindow: "web_asset",
  Archive: "archive",
  ArrowDown: "arrow_downward",
  ArrowDownLeft: "south_west",
  ArrowDownRight: "south_east",
  ArrowLeft: "arrow_back",
  ArrowRight: "arrow_forward",
  ArrowUp: "arrow_upward",
  ArrowUpLeft: "north_west",
  ArrowUpRight: "north_east",
  Asterisk: "asterisk",
  AtSign: "alternate_email",
  Badge: "badge",
  BadgeAlert: "notification_important",
  BadgeCheck: "verified",
  BarChart: "bar_chart",
  BarChart2: "bar_chart",
  BarChart3: "bar_chart",
  Battery: "battery_full",
  Bell: "notifications",
  BellOff: "notifications_off",
  Bike: "directions_bike",
  Bluetooth: "bluetooth",
  Bold: "format_bold",
  Book: "book",
  BookOpen: "menu_book",
  Bookmark: "bookmark",
  Box: "deployed_code",
  BoxSelect: "select",
  Boxes: "inventory_2",
  Briefcase: "work",
  Building: "domain",
  Building2: "apartment",
  Bus: "directions_bus",
  BusFront: "directions_bus",
  Cable: "cable",
  Calculator: "calculate",
  Calendar: "calendar_month",
  CalendarCheck: "event_available",
  CalendarClock: "event_upcoming",
  Camera: "photo_camera",
  CameraOff: "no_photography",
  Car: "directions_car",
  Cast: "cast",
  Check: "check",
  CheckCheck: "done_all",
  CheckCircle: "check_circle",
  CheckCircle2: "check_circle",
  ChevronDown: "expand_more",
  ChevronFirst: "first_page",
  ChevronLast: "last_page",
  ChevronLeft: "chevron_left",
  ChevronRight: "chevron_right",
  ChevronUp: "expand_less",
  ChevronsDown: "keyboard_double_arrow_down",
  ChevronsLeft: "keyboard_double_arrow_left",
  ChevronsRight: "keyboard_double_arrow_right",
  ChevronsUp: "keyboard_double_arrow_up",
  Circle: "circle",
  CircleCheck: "check_circle",
  CircleDot: "radio_button_checked",
  CircleHelp: "help",
  CirclePlus: "add_circle",
  Clipboard: "content_paste",
  ClipboardCheck: "assignment_turned_in",
  ClipboardList: "assignment",
  Clock: "schedule",
  Cloud: "cloud",
  CloudDownload: "cloud_download",
  CloudOff: "cloud_off",
  CloudUpload: "cloud_upload",
  Code: "code",
  Cog: "settings",
  Columns: "view_column",
  Columns2: "view_column_2",
  Compass: "explore",
  Construction: "construction",
  Contact: "contacts",
  Copy: "content_copy",
  Cpu: "memory",
  Crosshair: "my_location",
  Database: "database",
  Delete: "delete",
  Download: "download",
  Edit: "edit",
  Edit2: "edit",
  Edit3: "edit_note",
  Ellipsis: "more_horiz",
  ExternalLink: "open_in_new",
  Eye: "visibility",
  EyeOff: "visibility_off",
  File: "insert_drive_file",
  FileCheck: "task",
  FileDown: "file_download",
  FileImage: "image",
  FilePlus: "note_add",
  FileSearch: "find_in_page",
  FileText: "description",
  Filter: "filter_alt",
  Flag: "flag",
  Folder: "folder",
  FolderKanban: "folder_managed",
  FolderOpen: "folder_open",
  Footprints: "footprint",
  Gauge: "speed",
  GitBranch: "account_tree",
  Globe: "public",
  Grid2X2: "grid_view",
  Grip: "drag_indicator",
  GripHorizontal: "drag_handle",
  GripVertical: "drag_indicator",
  HardDrive: "hard_drive",
  Headphones: "headphones",
  Heart: "favorite",
  HelpCircle: "help",
  History: "history",
  Home: "home",
  Image: "image",
  Import: "move_to_inbox",
  Info: "info",
  Italic: "format_italic",
  Key: "key",
  Layers: "layers",
  LayoutDashboard: "dashboard",
  Lightbulb: "lightbulb",
  Link: "link",
  List: "list",
  ListChecks: "checklist",
  Loader: "progress_activity",
  Loader2: "progress_activity",
  Locate: "location_searching",
  LocateFixed: "my_location",
  Lock: "lock",
  LockOpen: "lock_open",
  LogIn: "login",
  LogOut: "logout",
  Mail: "mail",
  Map: "map",
  MapPin: "location_on",
  MapPinned: "map",
  Maximize: "fullscreen",
  Maximize2: "open_in_full",
  Menu: "menu",
  MessageCircle: "chat",
  MessageSquare: "chat_bubble",
  Mic: "mic",
  Milestone: "signpost",
  Minimize: "fullscreen_exit",
  Minimize2: "close_fullscreen",
  Minus: "remove",
  Monitor: "monitor",
  Moon: "dark_mode",
  MoreHorizontal: "more_horiz",
  MoreVertical: "more_vert",
  MousePointer: "arrow_selector_tool",
  MousePointer2: "arrow_selector_tool",
  Move: "open_with",
  Navigation: "navigation",
  Network: "hub",
  Orbit: "orbit",
  Package: "package_2",
  PanelLeft: "left_panel_open",
  PanelLeftClose: "left_panel_close",
  PanelLeftOpen: "left_panel_open",
  PanelRight: "right_panel_open",
  PanelRightClose: "right_panel_close",
  PanelRightOpen: "right_panel_open",
  Paperclip: "attach_file",
  Pause: "pause",
  Pencil: "edit",
  PersonStanding: "accessibility_new",
  Phone: "call",
  Pin: "keep",
  PinOff: "keep_off",
  Play: "play_arrow",
  Plus: "add",
  PlusCircle: "add_circle",
  Printer: "print",
  Radio: "radio",
  RadioTower: "cell_tower",
  Radar: "radar",
  Redo: "redo",
  Redo2: "redo",
  RefreshCcw: "refresh",
  RefreshCw: "refresh",
  Repeat: "repeat",
  RotateCcw: "rotate_left",
  RotateCw: "rotate_right",
  Route: "route",
  Ruler: "straighten",
  Save: "save",
  Scan: "scan",
  ScanLine: "document_scanner",
  ScanSearch: "manage_search",
  Search: "search",
  Send: "send",
  Settings: "settings",
  Share: "share",
  Shield: "shield",
  ShieldAlert: "gpp_maybe",
  ShieldCheck: "verified_user",
  Sliders: "tune",
  SlidersHorizontal: "tune",
  Smartphone: "smartphone",
  Sparkles: "auto_awesome",
  Square: "square",
  SquarePen: "edit_square",
  Star: "star",
  StopCircle: "stop_circle",
  Sun: "light_mode",
  Table: "table_view",
  Tag: "sell",
  Target: "target",
  Timer: "timer",
  TrafficCone: "traffic",
  Trash: "delete",
  Trash2: "delete",
  TriangleAlert: "warning",
  Truck: "local_shipping",
  Undo: "undo",
  Undo2: "undo",
  Unlock: "lock_open",
  Upload: "upload",
  User: "person",
  UserCheck: "person_check",
  UserCog: "manage_accounts",
  UserPlus: "person_add",
  Users: "group",
  Video: "videocam",
  VideoOff: "videocam_off",
  Volume1: "volume_down",
  Volume2: "volume_up",
  VolumeX: "volume_off",
  Wand2: "auto_fix_high",
  Waypoints: "conversion_path",
  Wifi: "wifi",
  WifiOff: "wifi_off",
  Wind: "air",
  Workflow: "account_tree",
  Wrench: "build",
  X: "close",
  XCircle: "cancel",
  Zap: "bolt",
  ZoomIn: "zoom_in",
  ZoomOut: "zoom_out",
};

const TYPE_EXPORTS = new Set([
  "LucideIcon",
  "LucideProps",
  "IconNode",
  "Icon",
]);

const sourceFiles = walk(srcRoot).filter(
  (filePath) =>
    !filePath.endsWith(
      path.join(
        "components",
        "icons",
        "materialIcons.tsx",
      ),
    ),
);

const importPattern =
  /import\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*["']lucide-react["'];?/g;

const componentNames = new Set();
const typeNames = new Set();
const affectedFiles = new Set();

function parseImportSpecifiers(
  specifierBlock,
  entireImportIsType,
) {
  return specifierBlock
    .split(",")
    .map((item) =>
      item
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim(),
    )
    .filter(Boolean)
    .map((specifier) => {
      const inlineType =
        specifier.startsWith("type ");

      const withoutType = specifier.replace(
        /^type\s+/,
        "",
      );

      const importedName = withoutType
        .split(/\s+as\s+/i)[0]
        ?.trim();

      return {
        importedName,
        isType:
          Boolean(entireImportIsType) ||
          inlineType ||
          TYPE_EXPORTS.has(importedName),
      };
    })
    .filter(
      ({ importedName }) =>
        Boolean(importedName),
    );
}

for (const filePath of sourceFiles) {
  const source = fs.readFileSync(
    filePath,
    "utf8",
  );

  let match;

  while (
    (match = importPattern.exec(source)) !==
    null
  ) {
    const entireImportIsType =
      Boolean(match[1]);

    const specifiers = parseImportSpecifiers(
      match[2],
      entireImportIsType,
    );

    for (const {
      importedName,
      isType,
    } of specifiers) {
      if (isType) {
        typeNames.add(importedName);
      } else {
        componentNames.add(importedName);
      }
    }

    affectedFiles.add(filePath);
  }

  importPattern.lastIndex = 0;
}

if (affectedFiles.size === 0) {
  console.error(
    "No lucide-react imports were found under src. The project may already be migrated.",
  );
  process.exit(1);
}

const iconModulePath = path.join(
  srcRoot,
  "components",
  "icons",
  "materialIcons.tsx",
);

const materialCssPath = path.join(
  srcRoot,
  "styles",
  "materialIcons.css",
);

function materialSymbolFor(
  lucideName,
) {
  return (
    MATERIAL_SYMBOL_BY_LUCIDE[
      lucideName
    ] ?? "widgets"
  );
}

const sortedComponentNames = Array.from(
  componentNames,
).sort();

const sortedTypeNames = Array.from(
  typeNames,
).sort();

const generatedExports =
  sortedComponentNames
    .map((componentName) => {
      const symbol =
        materialSymbolFor(componentName);

      return `export const ${componentName} = createMaterialIcon(${JSON.stringify(
        symbol,
      )}, ${JSON.stringify(
        componentName,
      )});`;
    })
    .join("\n");

const generatedTypeExports =
  sortedTypeNames
    .map((typeName) => {
      if (typeName === "LucideProps") {
        return "export type LucideProps = MaterialIconProps;";
      }

      if (typeName === "IconNode") {
        return "export type IconNode = readonly unknown[];";
      }

      return `export type ${typeName} = MaterialIconComponent;`;
    })
    .join("\n");

const materialIconModule = `import {
  forwardRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

export interface MaterialIconProps
  extends Omit<
    HTMLAttributes<HTMLSpanElement>,
    "children"
  > {
  size?: number | string;
  strokeWidth?: number;
  color?: string;
  fill?: string | number;
  absoluteStrokeWidth?: boolean;
}

export type MaterialIconComponent =
  ForwardRefExoticComponent<
    MaterialIconProps &
      RefAttributes<HTMLSpanElement>
  >;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function materialWeight(
  strokeWidth: number,
): number {
  return clamp(
    Math.round(
      160 + strokeWidth * 150,
    ),
    100,
    700,
  );
}

function filledAxis(
  fill: MaterialIconProps["fill"],
): 0 | 1 {
  if (
    fill === undefined ||
    fill === null ||
    fill === 0 ||
    fill === "0" ||
    fill === "none" ||
    fill === "transparent"
  ) {
    return 0;
  }

  return 1;
}

export function createMaterialIcon(
  symbol: string,
  displayName: string,
): MaterialIconComponent {
  const Component = forwardRef<
    HTMLSpanElement,
    MaterialIconProps
  >(
    (
      {
        size = 24,
        strokeWidth = 1.75,
        color,
        fill,
        absoluteStrokeWidth: _absoluteStrokeWidth,
        className = "",
        style,
        ...rest
      },
      ref,
    ) => {
      const numericSize =
        typeof size === "number"
          ? size
          : Number.parseFloat(
              String(size),
            ) || 24;

      const iconStyle: CSSProperties = {
        fontSize: size,
        color,
        fontVariationSettings:
          \`"FILL" \${filledAxis(fill)}, "wght" \${materialWeight(
            strokeWidth,
          )}, "GRAD" 0, "opsz" \${clamp(
            Math.round(numericSize),
            20,
            48,
          )}\`,
        ...style,
      };

      return (
        <span
          {...rest}
          ref={ref}
          className={[
            "material-symbols-outlined",
            "roadsafe-material-icon",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          style={iconStyle}
        >
          {symbol}
        </span>
      );
    },
  );

  Component.displayName =
    \`MaterialIcon(\${displayName})\`;

  return Component;
}

${generatedTypeExports}

${generatedExports}
`;

const materialCss = `/*
 * RoadSafe Google Material Symbols
 *
 * Google Fonts serves the official outlined variable icon font.
 */
.roadsafe-material-icon {
  display: inline-block;
  flex: 0 0 auto;
  width: 1em;
  height: 1em;
  overflow: hidden;
  direction: ltr;
  line-height: 1;
  letter-spacing: normal;
  text-align: center;
  text-rendering: optimizeLegibility;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  user-select: none;
  pointer-events: none;
  font-family:
    "Material Symbols Outlined";
  font-style: normal;
  font-weight: normal;
  font-feature-settings: "liga";
  -webkit-font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/*
 * Bigger, square operational statistic cards.
 */
.dashboard-material-stat-grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(190px, 1fr)
    );
  gap: 14px;
}

.dashboard-material-stat-card {
  display: flex !important;
  aspect-ratio: 1 / 1;
  min-height: 190px;
  flex-direction: column;
  align-items: flex-start !important;
  justify-content: space-between;
  gap: 16px !important;
  padding: 20px !important;
}

.dashboard-material-stat-icon {
  display: grid;
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  place-items: center;
  border: 1px solid #365d86;
  border-radius: 4px;
  background: #303030;
  color: #7fa7d0;
  box-shadow:
    inset 0 1px 0
      rgba(255, 255, 255, 0.05),
    inset 0 -1px 0
      rgba(0, 0, 0, 0.45);
}

.dashboard-material-stat-content {
  min-width: 0;
  width: 100%;
}

.dashboard-material-stat-content
  > p:nth-child(1) {
  overflow: visible !important;
  font-size: 11px !important;
  line-height: 1.35;
  white-space: normal !important;
}

.dashboard-material-stat-content
  > p:nth-child(2) {
  margin-top: 8px !important;
  font-size: 30px !important;
  line-height: 1;
}

.dashboard-material-stat-content
  > p:nth-child(3) {
  margin-top: 10px !important;
  overflow: visible !important;
  font-size: 11px !important;
  line-height: 1.4;
  white-space: normal !important;
}

@media (max-width: 520px) {
  .dashboard-material-stat-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .dashboard-material-stat-card {
    min-height: 160px;
    padding: 14px !important;
  }

  .dashboard-material-stat-icon {
    width: 60px;
    height: 60px;
    flex-basis: 60px;
  }
}
`;

backup(iconModulePath);
backup(materialCssPath);

fs.mkdirSync(
  path.dirname(iconModulePath),
  { recursive: true },
);

fs.writeFileSync(
  iconModulePath,
  materialIconModule,
  "utf8",
);

fs.writeFileSync(
  materialCssPath,
  materialCss,
  "utf8",
);

console.log(
  `GENERATED ${path.relative(root, iconModulePath)}`,
);
console.log(
  `WROTE ${path.relative(root, materialCssPath)}`,
);

for (const filePath of affectedFiles) {
  const original = fs.readFileSync(
    filePath,
    "utf8",
  );

  const relativeImportPath = path
    .relative(
      path.dirname(filePath),
      iconModulePath,
    )
    .replaceAll("\\", "/")
    .replace(/\.tsx$/, "");

  const normalizedImportPath =
    relativeImportPath.startsWith(".")
      ? relativeImportPath
      : `./${relativeImportPath}`;

  const updated = original.replace(
    /from\s*["']lucide-react["']/g,
    `from "${normalizedImportPath}"`,
  );

  if (updated !== original) {
    backup(filePath);

    fs.writeFileSync(
      filePath,
      updated,
      "utf8",
    );

    console.log(
      `MIGRATED ${path.relative(root, filePath)}`,
    );
  }
}

/*
 * Load the official Google Material Symbols font.
 */
backup(indexHtmlPath);

let indexHtml = fs.readFileSync(
  indexHtmlPath,
  "utf8",
);

indexHtml = indexHtml.replace(
  /\s*<link[^>]+fonts\.googleapis\.com[^>]+Material(?:\+|%20)(?:Icons|Symbols)[^>]*>\s*/gi,
  "\n",
);

const googleMaterialLinks = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      rel="stylesheet"
    >`;

if (
  !indexHtml.includes(
    "Material+Symbols+Outlined",
  )
) {
  indexHtml = indexHtml.replace(
    "</head>",
    `${googleMaterialLinks}\n  </head>`,
  );
}

fs.writeFileSync(
  indexHtmlPath,
  indexHtml,
  "utf8",
);

console.log("CHANGED index.html");

/*
 * Import the local icon and dashboard styling after the existing theme.
 */
backup(mainPath);

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const materialCssImport =
  'import "./styles/materialIcons.css";';

if (!mainSource.includes(materialCssImport)) {
  const navigationRailImport =
    'import "./styles/navigationRailFix.css";';

  const dockImport =
    'import "./styles/dockableContextInspector.css";';

  const darkerThemeImport =
    'import "./styles/darkerTheme.css";';

  const insertionAnchor = [
    navigationRailImport,
    dockImport,
    darkerThemeImport,
    'import "./index.css";',
  ].find((candidate) =>
    mainSource.includes(candidate),
  );

  if (!insertionAnchor) {
    console.error(
      "Could not locate the RoadSafe stylesheet imports in src/main.tsx.",
    );
    process.exit(1);
  }

  mainSource = mainSource.replace(
    insertionAnchor,
    `${insertionAnchor}\n${materialCssImport}`,
  );

  fs.writeFileSync(
    mainPath,
    mainSource,
    "utf8",
  );

  console.log("CHANGED src/main.tsx");
}

/*
 * Enlarge the six dashboard statistic cards.
 */
backup(dashboardPath);

let dashboard = fs.readFileSync(
  dashboardPath,
  "utf8",
);

dashboard = dashboard.replace(
  /className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"/,
  'className="dashboard-material-stat-grid"',
);

dashboard = dashboard.replace(
  /className="ui-panel group flex min-h-24 items-center gap-3 p-3"/,
  'className="ui-panel group dashboard-material-stat-card"',
);

dashboard = dashboard.replace(
  /className="grid h-11 w-11 shrink-0 place-items-center[^"]*"/,
  'className="dashboard-material-stat-icon"',
);

dashboard = dashboard.replace(
  /<Icon size=\{20\} strokeWidth=\{1\.55\} \/>/,
  '<Icon size={52} strokeWidth={1.6} />',
);

dashboard = dashboard.replace(
  /<div className="min-w-0">\s*<p className="truncate text-\[9px\] font-bold uppercase tracking-\[0\.12em\][^"]*">/,
  `<div className="dashboard-material-stat-content">
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#7fa7d0]">`,
);

fs.writeFileSync(
  dashboardPath,
  dashboard,
  "utf8",
);

console.log(
  "CHANGED src/pages/Dashboard.tsx",
);

/*
 * Remove the now-unused Lucide package from both manifests without requiring a
 * network install.
 */
backup(packagePath);

if (
  packageJson.dependencies &&
  packageJson.dependencies[
    "lucide-react"
  ]
) {
  delete packageJson.dependencies[
    "lucide-react"
  ];

  fs.writeFileSync(
    packagePath,
    `${JSON.stringify(
      packageJson,
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    "REMOVED lucide-react from package.json",
  );
}

const lockPath = path.join(
  root,
  "package-lock.json",
);

if (fs.existsSync(lockPath)) {
  backup(lockPath);

  const lock = JSON.parse(
    fs.readFileSync(lockPath, "utf8"),
  );

  if (
    lock.packages?.[""]?.dependencies
  ) {
    delete lock.packages[""]
      .dependencies["lucide-react"];
  }

  if (lock.packages) {
    delete lock.packages[
      "node_modules/lucide-react"
    ];
  }

  if (lock.dependencies) {
    delete lock.dependencies[
      "lucide-react"
    ];
  }

  fs.writeFileSync(
    lockPath,
    `${JSON.stringify(
      lock,
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    "REMOVED lucide-react from package-lock.json",
  );
}

const unmappedNames =
  sortedComponentNames.filter(
    (name) =>
      !MATERIAL_SYMBOL_BY_LUCIDE[name],
  );

const reportPath = path.join(
  root,
  "material-icon-migration-report.txt",
);

backup(reportPath);

const report = [
  "RoadSafe Google Material Icon Migration",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Migrated source files: ${affectedFiles.size}`,
  `Material icon exports: ${sortedComponentNames.length}`,
  `Type exports: ${sortedTypeNames.length}`,
  "",
  "Unmapped Lucide names using the valid Google fallback icon 'widgets':",
  ...(unmappedNames.length
    ? unmappedNames
    : ["None"]),
  "",
].join("\n");

fs.writeFileSync(
  reportPath,
  report,
  "utf8",
);

console.log(
  "WROTE material-icon-migration-report.txt",
);
console.log(
  `Backups saved under ${path.relative(root, backupRoot)}`,
);

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(`
The Material Icon migration was installed, but the build failed.

Restore the original files from:
  ${path.relative(root, backupRoot)}

Also inspect:
  material-icon-migration-report.txt
`);
  process.exit(1);
}

console.log(`
RoadSafe Material Icon migration completed.

Changed:
- Every lucide-react import under src now uses the local Material adapter.
- Lucide was removed from package.json and package-lock.json.
- Google Material Symbols Outlined is loaded from the official Google Fonts service.
- The six dashboard statistic cards are larger square cards.
- Dashboard statistic icons are now 52px Google Material icons.

Start RoadSafe:
  npm run dev

Review any fallback mappings:
  Get-Content .\\material-icon-migration-report.txt
`);
