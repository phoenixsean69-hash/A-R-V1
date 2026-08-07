import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const srcRoot = path.join(root, "src");
const adapterRelative =
  "src/components/icons/materialIcons.tsx";
const adapterPath = path.join(root, adapterRelative);
const cssRelative =
  "src/styles/materialIcons.css";
const cssPath = path.join(root, cssRelative);
const mainPath = path.join(srcRoot, "main.tsx");
const indexHtmlPath = path.join(root, "index.html");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this repair from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
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

if (!fs.existsSync(srcRoot)) {
  console.error("The src directory was not found.");
  process.exit(1);
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
  const results = [];

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
      results.push(...walk(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      [".ts", ".tsx", ".js", ".jsx"].includes(
        path.extname(entry.name).toLowerCase(),
      )
    ) {
      results.push(absolutePath);
    }
  }

  return results;
}

const MATERIAL_SYMBOL_BY_NAME = {
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
  Ban: "block",
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

const TYPE_NAMES = new Set([
  "LucideIcon",
  "LucideProps",
  "IconNode",
  "Icon",
]);

const sourceFiles = walk(srcRoot).filter(
  (filePath) =>
    path.resolve(filePath) !==
    path.resolve(adapterPath),
);

const componentNames = new Set();
const typeNames = new Set();
const migratedFiles = new Set();

/*
 * Strict import parser:
 * - the specifier section cannot cross a closing brace;
 * - the module source must be lucide-react or materialIcons;
 * - unrelated React, Router, Chart.js and local imports cannot be captured.
 */
const iconImportPattern =
  /import\s+(type\s+)?\{([^{}]*)\}\s*from\s*["']([^"']*(?:lucide-react|materialIcons))["'];?/g;

function parseSpecifiers(
  block,
  wholeImportIsType,
) {
  return block
    .split(",")
    .map((entry) =>
      entry
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim(),
    )
    .filter(Boolean)
    .map((entry) => {
      const inlineType =
        entry.startsWith("type ");

      const withoutType = entry.replace(
        /^type\s+/,
        "",
      );

      const importedName =
        withoutType
          .split(/\s+as\s+/i)[0]
          ?.trim();

      return {
        importedName,
        isType:
          Boolean(wholeImportIsType) ||
          inlineType ||
          TYPE_NAMES.has(importedName),
      };
    })
    .filter(
      ({ importedName }) =>
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
          importedName ?? "",
        ),
    );
}

for (const filePath of sourceFiles) {
  let source = fs.readFileSync(
    filePath,
    "utf8",
  );

  let match;

  while (
    (match = iconImportPattern.exec(source)) !==
    null
  ) {
    const specifiers = parseSpecifiers(
      match[2],
      Boolean(match[1]),
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
  }

  iconImportPattern.lastIndex = 0;

  if (
    source.includes(
      'from "lucide-react"',
    ) ||
    source.includes(
      "from 'lucide-react'",
    )
  ) {
    const relativeAdapter = path
      .relative(
        path.dirname(filePath),
        adapterPath,
      )
      .replaceAll("\\", "/")
      .replace(/\.tsx$/, "");

    const importPath =
      relativeAdapter.startsWith(".")
        ? relativeAdapter
        : `./${relativeAdapter}`;

    const updated = source.replace(
      /from\s*["']lucide-react["']/g,
      `from "${importPath}"`,
    );

    if (updated !== source) {
      backup(filePath);

      fs.writeFileSync(
        filePath,
        updated,
        "utf8",
      );

      migratedFiles.add(
        path.relative(root, filePath),
      );
    }
  }
}

if (
  componentNames.size === 0 &&
  typeNames.size === 0
) {
  console.error(
    "No Material or Lucide icon imports were found in src. Restore the pre-migration backup before running this repair.",
  );
  process.exit(1);
}

const sortedComponents = Array.from(
  componentNames,
).sort();

const sortedTypes = Array.from(
  typeNames,
).sort();

const valueExports = sortedComponents
  .map((name) => {
    const symbol =
      MATERIAL_SYMBOL_BY_NAME[name] ??
      "widgets";

    return `export const ${name} = createMaterialIcon(${JSON.stringify(
      symbol,
    )}, ${JSON.stringify(name)});`;
  })
  .join("\n");

const typeExports = sortedTypes
  .map((name) => {
    if (name === "LucideProps") {
      return "export type LucideProps = MaterialIconProps;";
    }

    if (name === "IconNode") {
      return "export type IconNode = readonly unknown[];";
    }

    return `export type ${name} = MaterialIconComponent;`;
  })
  .join("\n");

const adapterSource = `import {
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

function fillAxis(
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
        absoluteStrokeWidth:
          _absoluteStrokeWidth,
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
          \`"FILL" \${fillAxis(
            fill,
          )}, "wght" \${materialWeight(
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
          aria-hidden={
            rest["aria-label"]
              ? undefined
              : true
          }
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

${typeExports}

${valueExports}
`;

backup(adapterPath);

fs.mkdirSync(
  path.dirname(adapterPath),
  { recursive: true },
);

fs.writeFileSync(
  adapterPath,
  adapterSource,
  "utf8",
);

console.log(
  `REPAIRED ${adapterRelative}`,
);
console.log(
  `Generated ${sortedComponents.length} Material icon component exports.`,
);
console.log(
  `Generated ${sortedTypes.length} icon type exports.`,
);

const cssSource = `/*
 * RoadSafe Google Material Symbols
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

.dashboard-material-stat-grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(210px, 1fr)
    );
  gap: 14px;
}

.dashboard-material-stat-card {
  display: flex !important;
  aspect-ratio: 1 / 1;
  min-height: 210px;
  flex-direction: column;
  align-items: flex-start !important;
  justify-content: space-between;
  gap: 18px !important;
  padding: 22px !important;
}

.dashboard-material-stat-icon {
  display: grid;
  width: 82px;
  height: 82px;
  flex: 0 0 82px;
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
  font-size: 32px !important;
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
    grid-template-columns:
      1fr 1fr;
    gap: 10px;
  }

  .dashboard-material-stat-card {
    min-height: 165px;
    padding: 14px !important;
  }

  .dashboard-material-stat-icon {
    width: 62px;
    height: 62px;
    flex-basis: 62px;
  }
}
`;

backup(cssPath);

fs.mkdirSync(
  path.dirname(cssPath),
  { recursive: true },
);

fs.writeFileSync(
  cssPath,
  cssSource,
  "utf8",
);

if (fs.existsSync(mainPath)) {
  backup(mainPath);

  let mainSource = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cssImport =
    'import "./styles/materialIcons.css";';

  if (!mainSource.includes(cssImport)) {
    const anchor =
      'import "./styles/darkerTheme.css";';

    if (mainSource.includes(anchor)) {
      mainSource = mainSource.replace(
        anchor,
        `${anchor}\n${cssImport}`,
      );
    } else {
      mainSource =
        `${cssImport}\n${mainSource}`;
    }

    fs.writeFileSync(
      mainPath,
      mainSource,
      "utf8",
    );
  }
}

if (fs.existsSync(indexHtmlPath)) {
  backup(indexHtmlPath);

  let html = fs.readFileSync(
    indexHtmlPath,
    "utf8",
  );

  if (
    !html.includes(
      "Material+Symbols+Outlined",
    )
  ) {
    html = html.replace(
      "</head>",
      `    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      rel="stylesheet"
    >
  </head>`,
    );

    fs.writeFileSync(
      indexHtmlPath,
      html,
      "utf8",
    );
  }
}

const unmapped = sortedComponents.filter(
  (name) =>
    !MATERIAL_SYMBOL_BY_NAME[name],
);

const reportPath = path.join(
  root,
  "material-icon-repair-report.txt",
);

backup(reportPath);

fs.writeFileSync(
  reportPath,
  [
    "RoadSafe Material Icon Repair",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Component exports: ${sortedComponents.length}`,
    `Type exports: ${sortedTypes.length}`,
    `Previously unmigrated source files repaired: ${migratedFiles.size}`,
    "",
    "Fallback icon names:",
    ...(unmapped.length
      ? unmapped
      : ["None"]),
    "",
  ].join("\n"),
  "utf8",
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
The malformed adapter was replaced, but another build error remains.

Your original files are backed up under:
  ${path.relative(root, backupRoot)}

Paste the new build output only; the original 169 syntax errors should now be gone.
`);
  process.exit(1);
}

console.log(`
Material Icon repair completed successfully.

The malformed generated imports and exports have been removed.

Start RoadSafe:
  npm run dev

Repair report:
  Get-Content .\\material-icon-repair-report.txt
`);
