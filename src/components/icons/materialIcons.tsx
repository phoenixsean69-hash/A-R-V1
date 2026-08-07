import {
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
          `"FILL" ${fillAxis(
            fill,
          )}, "wght" ${materialWeight(
            strokeWidth,
          )}, "GRAD" 0, "opsz" ${clamp(
            Math.round(numericSize),
            20,
            48,
          )}`,
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
    `MaterialIcon(${displayName})`;

  return Component;
}

export type LucideIcon = MaterialIconComponent;

export const Activity = createMaterialIcon("monitoring", "Activity");
export const AlertCircle = createMaterialIcon("error", "AlertCircle");
export const AlertTriangle = createMaterialIcon("warning", "AlertTriangle");
export const AppWindow = createMaterialIcon("web_asset", "AppWindow");
export const Archive = createMaterialIcon("archive", "Archive");
export const ArrowLeft = createMaterialIcon("arrow_back", "ArrowLeft");
export const ArrowRight = createMaterialIcon("arrow_forward", "ArrowRight");
export const Ban = createMaterialIcon("block", "Ban");
export const BarChart3 = createMaterialIcon("bar_chart", "BarChart3");
export const Bell = createMaterialIcon("notifications", "Bell");
export const Bike = createMaterialIcon("directions_bike", "Bike");
export const BookOpen = createMaterialIcon("menu_book", "BookOpen");
export const Boxes = createMaterialIcon("inventory_2", "Boxes");
export const Building2 = createMaterialIcon("apartment", "Building2");
export const BusFront = createMaterialIcon("directions_bus", "BusFront");
export const CalendarClock = createMaterialIcon("event_upcoming", "CalendarClock");
export const CalendarDays = createMaterialIcon("calendar_month", "CalendarDays");
export const Camera = createMaterialIcon("photo_camera", "Camera");
export const Car = createMaterialIcon("directions_car", "Car");
export const CarFront = createMaterialIcon("directions_car", "CarFront");
export const Check = createMaterialIcon("check", "Check");
export const CheckCircle2 = createMaterialIcon("check_circle", "CheckCircle2");
export const ChevronDown = createMaterialIcon("expand_more", "ChevronDown");
export const ChevronLeft = createMaterialIcon("chevron_left", "ChevronLeft");
export const ChevronRight = createMaterialIcon("chevron_right", "ChevronRight");
export const ChevronUp = createMaterialIcon("expand_less", "ChevronUp");
export const Circle = createMaterialIcon("circle", "Circle");
export const CircleDot = createMaterialIcon("radio_button_checked", "CircleDot");
export const Clipboard = createMaterialIcon("content_paste", "Clipboard");
export const ClipboardCheck = createMaterialIcon("assignment_turned_in", "ClipboardCheck");
export const ClipboardList = createMaterialIcon("assignment", "ClipboardList");
export const Clock3 = createMaterialIcon("schedule", "Clock3");
export const Cloud = createMaterialIcon("cloud", "Cloud");
export const CloudSun = createMaterialIcon("partly_cloudy_day", "CloudSun");
export const Compass = createMaterialIcon("explore", "Compass");
export const Copy = createMaterialIcon("content_copy", "Copy");
export const Crosshair = createMaterialIcon("my_location", "Crosshair");
export const Database = createMaterialIcon("database", "Database");
export const Download = createMaterialIcon("download", "Download");
export const Expand = createMaterialIcon("open_in_full", "Expand");
export const ExternalLink = createMaterialIcon("open_in_new", "ExternalLink");
export const Eye = createMaterialIcon("visibility", "Eye");
export const EyeOff = createMaterialIcon("visibility_off", "EyeOff");
export const FileClock = createMaterialIcon("pending_actions", "FileClock");
export const FileJson = createMaterialIcon("data_object", "FileJson");
export const FileSearch = createMaterialIcon("find_in_page", "FileSearch");
export const FileText = createMaterialIcon("description", "FileText");
export const Film = createMaterialIcon("movie", "Film");
export const Filter = createMaterialIcon("filter_alt", "Filter");
export const Flag = createMaterialIcon("flag", "Flag");
export const Focus = createMaterialIcon("center_focus_strong", "Focus");
export const FolderKanban = createMaterialIcon("folder_managed", "FolderKanban");
export const Gauge = createMaterialIcon("speed", "Gauge");
export const Image = createMaterialIcon("image", "Image");
export const KeyRound = createMaterialIcon("key", "KeyRound");
export const Layers3 = createMaterialIcon("layers", "Layers3");
export const Lightbulb = createMaterialIcon("lightbulb", "Lightbulb");
export const ListChecks = createMaterialIcon("checklist", "ListChecks");
export const Loader2 = createMaterialIcon("progress_activity", "Loader2");
export const LoaderCircle = createMaterialIcon("progress_activity", "LoaderCircle");
export const LocateFixed = createMaterialIcon("my_location", "LocateFixed");
export const Lock = createMaterialIcon("lock", "Lock");
export const LockKeyhole = createMaterialIcon("lock", "LockKeyhole");
export const LogOut = createMaterialIcon("logout", "LogOut");
export const Map = createMaterialIcon("map", "Map");
export const MapPin = createMaterialIcon("location_on", "MapPin");
export const MapPinned = createMaterialIcon("map", "MapPinned");
export const Menu = createMaterialIcon("menu", "Menu");
export const Mic = createMaterialIcon("mic", "Mic");
export const MicOff = createMaterialIcon("mic_off", "MicOff");
export const Move = createMaterialIcon("open_with", "Move");
export const Navigation = createMaterialIcon("navigation", "Navigation");
export const Orbit = createMaterialIcon("orbit", "Orbit");
export const Pause = createMaterialIcon("pause", "Pause");
export const Pentagon = createMaterialIcon("pentagon", "Pentagon");
export const PersonStanding = createMaterialIcon("accessibility_new", "PersonStanding");
export const Pin = createMaterialIcon("keep", "Pin");
export const PinOff = createMaterialIcon("keep_off", "PinOff");
export const Play = createMaterialIcon("play_arrow", "Play");
export const Plus = createMaterialIcon("add", "Plus");
export const Printer = createMaterialIcon("print", "Printer");
export const Radio = createMaterialIcon("radio", "Radio");
export const RadioTower = createMaterialIcon("cell_tower", "RadioTower");
export const RefreshCw = createMaterialIcon("refresh", "RefreshCw");
export const RotateCcw = createMaterialIcon("rotate_left", "RotateCcw");
export const RotateCw = createMaterialIcon("rotate_right", "RotateCw");
export const Route = createMaterialIcon("route", "Route");
export const Ruler = createMaterialIcon("straighten", "Ruler");
export const Satellite = createMaterialIcon("satellite_alt", "Satellite");
export const Save = createMaterialIcon("save", "Save");
export const ScanEye = createMaterialIcon("eye_tracking", "ScanEye");
export const ScanLine = createMaterialIcon("document_scanner", "ScanLine");
export const Search = createMaterialIcon("search", "Search");
export const Settings = createMaterialIcon("settings", "Settings");
export const ShieldAlert = createMaterialIcon("gpp_maybe", "ShieldAlert");
export const ShieldCheck = createMaterialIcon("verified_user", "ShieldCheck");
export const ShieldX = createMaterialIcon("gpp_bad", "ShieldX");
export const SkipBack = createMaterialIcon("skip_previous", "SkipBack");
export const SkipForward = createMaterialIcon("skip_next", "SkipForward");
export const Skull = createMaterialIcon("skull", "Skull");
export const SlidersHorizontal = createMaterialIcon("tune", "SlidersHorizontal");
export const Smartphone = createMaterialIcon("smartphone", "Smartphone");
export const Sparkles = createMaterialIcon("auto_awesome", "Sparkles");
export const Square = createMaterialIcon("square", "Square");
export const Star = createMaterialIcon("star", "Star");
export const Timer = createMaterialIcon("timer", "Timer");
export const Trash2 = createMaterialIcon("delete", "Trash2");
export const TriangleAlert = createMaterialIcon("warning", "TriangleAlert");
export const Truck = createMaterialIcon("local_shipping", "Truck");
export const Undo2 = createMaterialIcon("undo", "Undo2");
export const Unlock = createMaterialIcon("lock_open", "Unlock");
export const Upload = createMaterialIcon("upload", "Upload");
export const UserCheck = createMaterialIcon("person_check", "UserCheck");
export const UserCog = createMaterialIcon("manage_accounts", "UserCog");
export const Users = createMaterialIcon("group", "Users");
export const Video = createMaterialIcon("videocam", "Video");
export const Waypoints = createMaterialIcon("conversion_path", "Waypoints");
export const X = createMaterialIcon("close", "X");
export const Zap = createMaterialIcon("bolt", "Zap");
export const ZoomIn = createMaterialIcon("zoom_in", "ZoomIn");
export const ZoomOut = createMaterialIcon("zoom_out", "ZoomOut");
