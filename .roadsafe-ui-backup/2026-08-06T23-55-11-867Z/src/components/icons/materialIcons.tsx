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
          `"FILL" ${filledAxis(fill)}, "wght" ${materialWeight(
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

export type AlertTriangle = MaterialIconComponent;
export type ArrowLeft = MaterialIconComponent;
export type ArrowRight = MaterialIconComponent;
export type Camera = MaterialIconComponent;
export type CheckCircle2 = MaterialIconComponent;
export type Clock3 = MaterialIconComponent;
export type ErrorInfo = MaterialIconComponent;
export type FileJson = MaterialIconComponent;
export type FileSearch = MaterialIconComponent;
export type FileText = MaterialIconComponent;
export type FormEvent = MaterialIconComponent;
export type Gauge = MaterialIconComponent;
export type Lightbulb = MaterialIconComponent;
export type ListChecks = MaterialIconComponent;
export type LucideIcon = MaterialIconComponent;
export type MapPinned = MaterialIconComponent;
export type Navigation = MaterialIconComponent;
export type Printer = MaterialIconComponent;
export type ReactNode = MaterialIconComponent;
export type ReactNode } from "react";
import {
  Activity = MaterialIconComponent;
export type ReactNode } from "react";
import {
  AlertTriangle = MaterialIconComponent;
export type ReactNode } from "react";
import { Link = MaterialIconComponent;
export type RotateCcw = MaterialIconComponent;
export type Route = MaterialIconComponent;
export type Ruler = MaterialIconComponent;
export type ShieldCheck = MaterialIconComponent;
export type Timer = MaterialIconComponent;
export type Users = MaterialIconComponent;
export type Video = MaterialIconComponent;
export type Zap = MaterialIconComponent;
export type useParams } from "react-router-dom";
import {
  Activity = MaterialIconComponent;

export const AlertCircle = createMaterialIcon("error", "AlertCircle");
export const AlertTriangle = createMaterialIcon("warning", "AlertTriangle");
export const ArcElement = createMaterialIcon("widgets", "ArcElement");
export const Archive = createMaterialIcon("archive", "Archive");
export const ArrowLeft = createMaterialIcon("arrow_back", "ArrowLeft");
export const BarChart3 = createMaterialIcon("bar_chart", "BarChart3");
export const BarElement = createMaterialIcon("widgets", "BarElement");
export const Bell = createMaterialIcon("notifications", "Bell");
export const Bike = createMaterialIcon("directions_bike", "Bike");
export const BookOpen = createMaterialIcon("menu_book", "BookOpen");
export const Boxes = createMaterialIcon("inventory_2", "Boxes");
export const Building2 = createMaterialIcon("apartment", "Building2");
export const BusFront = createMaterialIcon("directions_bus", "BusFront");
export const CalendarClock = createMaterialIcon("event_upcoming", "CalendarClock");
export const CalendarDays = createMaterialIcon("widgets", "CalendarDays");
export const Camera = createMaterialIcon("photo_camera", "Camera");
export const Car = createMaterialIcon("directions_car", "Car");
export const CarFront = createMaterialIcon("widgets", "CarFront");
export const CategoryScale = createMaterialIcon("widgets", "CategoryScale");
export const Chart = createMaterialIcon("widgets", "Chart");
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
export const Clock3 = createMaterialIcon("widgets", "Clock3");
export const Cloud = createMaterialIcon("cloud", "Cloud");
export const CloudSun = createMaterialIcon("widgets", "CloudSun");
export const Compass = createMaterialIcon("explore", "Compass");
export const Component = createMaterialIcon("widgets", "Component");
export const Copy = createMaterialIcon("content_copy", "Copy");
export const Crosshair = createMaterialIcon("my_location", "Crosshair");
export const Database = createMaterialIcon("database", "Database");
export const Doughnut = createMaterialIcon("widgets", "Doughnut");
export const Download = createMaterialIcon("download", "Download");
export const Expand = createMaterialIcon("widgets", "Expand");
export const ExternalLink = createMaterialIcon("open_in_new", "ExternalLink");
export const Eye = createMaterialIcon("visibility", "Eye");
export const EyeOff = createMaterialIcon("visibility_off", "EyeOff");
export const FileClock = createMaterialIcon("widgets", "FileClock");
export const FileJson = createMaterialIcon("widgets", "FileJson");
export const FileSearch = createMaterialIcon("find_in_page", "FileSearch");
export const FileText = createMaterialIcon("description", "FileText");
export const Filler = createMaterialIcon("widgets", "Filler");
export const Film = createMaterialIcon("widgets", "Film");
export const Filter = createMaterialIcon("filter_alt", "Filter");
export const Flag = createMaterialIcon("flag", "Flag");
export const Focus = createMaterialIcon("widgets", "Focus");
export const FolderKanban = createMaterialIcon("folder_managed", "FolderKanban");
export const Gauge = createMaterialIcon("speed", "Gauge");
export const Image = createMaterialIcon("image", "Image");
export const KeyRound = createMaterialIcon("widgets", "KeyRound");
export const Layers3 = createMaterialIcon("widgets", "Layers3");
export const Legend = createMaterialIcon("widgets", "Legend");
export const Lightbulb = createMaterialIcon("lightbulb", "Lightbulb");
export const Line = createMaterialIcon("widgets", "Line");
export const LineElement = createMaterialIcon("widgets", "LineElement");
export const LinearScale = createMaterialIcon("widgets", "LinearScale");
export const Link } from "react-router-dom";
import {
  Boxes = createMaterialIcon("widgets", "Link } from \"react-router-dom\";\nimport {\n  Boxes");
export const Loader2 = createMaterialIcon("progress_activity", "Loader2");
export const LoaderCircle = createMaterialIcon("widgets", "LoaderCircle");
export const LocateFixed = createMaterialIcon("my_location", "LocateFixed");
export const Lock = createMaterialIcon("lock", "Lock");
export const LockKeyhole = createMaterialIcon("widgets", "LockKeyhole");
export const LogOut = createMaterialIcon("logout", "LogOut");
export const Map = createMaterialIcon("map", "Map");
export const MapPin = createMaterialIcon("location_on", "MapPin");
export const MapPinned = createMaterialIcon("map", "MapPinned");
export const Menu = createMaterialIcon("menu", "Menu");
export const Mic = createMaterialIcon("mic", "Mic");
export const MicOff = createMaterialIcon("widgets", "MicOff");
export const Move = createMaterialIcon("open_with", "Move");
export const NavLink = createMaterialIcon("widgets", "NavLink");
export const Navigation = createMaterialIcon("navigation", "Navigation");
export const Orbit = createMaterialIcon("orbit", "Orbit");
export const Outlet = createMaterialIcon("widgets", "Outlet");
export const Pause = createMaterialIcon("pause", "Pause");
export const Pentagon = createMaterialIcon("widgets", "Pentagon");
export const PersonStanding = createMaterialIcon("accessibility_new", "PersonStanding");
export const Pin = createMaterialIcon("keep", "Pin");
export const PinOff = createMaterialIcon("keep_off", "PinOff");
export const Play = createMaterialIcon("play_arrow", "Play");
export const Plus = createMaterialIcon("add", "Plus");
export const PointElement = createMaterialIcon("widgets", "PointElement");
export const PolarArea = createMaterialIcon("widgets", "PolarArea");
export const Printer = createMaterialIcon("print", "Printer");
export const Radar } from "react-chartjs-2";
import { Activity = createMaterialIcon("widgets", "Radar } from \"react-chartjs-2\";\r\nimport { Activity");
export const RadialLinearScale = createMaterialIcon("widgets", "RadialLinearScale");
export const Radio = createMaterialIcon("radio", "Radio");
export const RadioTower = createMaterialIcon("cell_tower", "RadioTower");
export const RefreshCw = createMaterialIcon("refresh", "RefreshCw");
export const RotateCcw = createMaterialIcon("rotate_left", "RotateCcw");
export const RotateCw = createMaterialIcon("rotate_right", "RotateCw");
export const Route = createMaterialIcon("route", "Route");
export const Ruler = createMaterialIcon("straighten", "Ruler");
export const Satellite = createMaterialIcon("widgets", "Satellite");
export const Save = createMaterialIcon("save", "Save");
export const ScanEye = createMaterialIcon("widgets", "ScanEye");
export const ScanLine = createMaterialIcon("document_scanner", "ScanLine");
export const Search = createMaterialIcon("search", "Search");
export const Settings = createMaterialIcon("settings", "Settings");
export const ShieldAlert = createMaterialIcon("gpp_maybe", "ShieldAlert");
export const ShieldCheck = createMaterialIcon("verified_user", "ShieldCheck");
export const ShieldX = createMaterialIcon("widgets", "ShieldX");
export const SkipBack = createMaterialIcon("widgets", "SkipBack");
export const SkipForward = createMaterialIcon("widgets", "SkipForward");
export const Skull = createMaterialIcon("widgets", "Skull");
export const SlidersHorizontal = createMaterialIcon("tune", "SlidersHorizontal");
export const Smartphone = createMaterialIcon("smartphone", "Smartphone");
export const Sparkles = createMaterialIcon("auto_awesome", "Sparkles");
export const Square = createMaterialIcon("square", "Square");
export const Star = createMaterialIcon("star", "Star");
export const Suspense = createMaterialIcon("widgets", "Suspense");
export const Tooltip = createMaterialIcon("widgets", "Tooltip");
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
export const ZoomIn = createMaterialIcon("zoom_in", "ZoomIn");
export const ZoomOut = createMaterialIcon("zoom_out", "ZoomOut");
export const forwardRef = createMaterialIcon("widgets", "forwardRef");
export const getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";
import {
  useCallback = createMaterialIcon("widgets", "getReconstructionWorldDimensions } from \"../../utils/reconstructionWorldScale\";\r\nimport {\r\n  useCallback");
export const lazy = createMaterialIcon("widgets", "lazy");
export const useCallback = createMaterialIcon("widgets", "useCallback");
export const useEffect = createMaterialIcon("widgets", "useEffect");
export const useImperativeHandle = createMaterialIcon("widgets", "useImperativeHandle");
export const useLocation = createMaterialIcon("widgets", "useLocation");
export const useMemo = createMaterialIcon("widgets", "useMemo");
export const useNavigate = createMaterialIcon("widgets", "useNavigate");
export const useNavigate } from "react-router-dom";
import {
  AlertTriangle = createMaterialIcon("widgets", "useNavigate } from \"react-router-dom\";\r\nimport {\r\n  AlertTriangle");
export const useNavigate } from "react-router-dom";
import {
  ArrowRight = createMaterialIcon("widgets", "useNavigate } from \"react-router-dom\";\r\nimport {\r\n  ArrowRight");
export const useParams = createMaterialIcon("widgets", "useParams");
export const useRef = createMaterialIcon("widgets", "useRef");
export const useState = createMaterialIcon("widgets", "useState");
export const useState } from "react";
import {
  Activity = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport {\r\n  Activity");
export const useState } from "react";
import {
  Crosshair = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport {\r\n  Crosshair");
export const useState } from "react";
import { Link = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport { Link");
export const useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport { Link } from \"react-router-dom\";\r\nimport {\r\n  Activity");
export const useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport { Link } from \"react-router-dom\";\r\nimport {\r\n  CalendarClock");
export const useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport { Link } from \"react-router-dom\";\r\nimport {\r\n  Camera");
export const useState } from "react";
import { Link } from "react-router-dom";
import {
  Download = createMaterialIcon("widgets", "useState } from \"react\";\r\nimport { Link } from \"react-router-dom\";\r\nimport {\r\n  Download");
export const } from "chart.js";
import { Bar = createMaterialIcon("widgets", "} from \"chart.js\";\r\nimport { Bar");
export const } from "react";
import {
  Link = createMaterialIcon("widgets", "} from \"react\";\nimport {\n  Link");
export const } from "react";

import type {
  PointerEvent = createMaterialIcon("widgets", "} from \"react\";\r\n\r\nimport type {\r\n  PointerEvent");
export const } from "react";

import {
  Activity = createMaterialIcon("widgets", "} from \"react\";\r\n\r\nimport {\r\n  Activity");
export const } from "react";

import {
  Crosshair = createMaterialIcon("widgets", "} from \"react\";\r\n\r\nimport {\r\n  Crosshair");
export const } from "react";

import { Link } from "react-router-dom";
import {
  Activity = createMaterialIcon("widgets", "} from \"react\";\r\n\r\nimport { Link } from \"react-router-dom\";\r\nimport {\r\n  Activity");
export const } from "react";
import {
  AlertCircle = createMaterialIcon("widgets", "} from \"react\";\r\nimport {\r\n  AlertCircle");
export const } from "react";
import {
  AlertTriangle = createMaterialIcon("widgets", "} from \"react\";\r\nimport {\r\n  AlertTriangle");
export const } from "react";
import {
  Ban = createMaterialIcon("widgets", "} from \"react\";\r\nimport {\r\n  Ban");
export const } from "react";
import {
  Eye = createMaterialIcon("widgets", "} from \"react\";\r\nimport {\r\n  Eye");
export const } from "react";
import {
  Link = createMaterialIcon("widgets", "} from \"react\";\r\nimport {\r\n  Link");
export const } from "react";
import {
  createPortal = createMaterialIcon("widgets", "} from \"react\";\r\nimport {\r\n  createPortal");
export const } from "react";
import { createPortal } from "react-dom";

import {
  Activity = createMaterialIcon("widgets", "} from \"react\";\r\nimport { createPortal } from \"react-dom\";\r\n\r\nimport {\r\n  Activity");
export const } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check = createMaterialIcon("widgets", "} from \"react\";\r\nimport { useNavigate } from \"react-router-dom\";\r\nimport {\r\n  Check");
export const } from "react-dom";
import {
  Link = createMaterialIcon("widgets", "} from \"react-dom\";\r\nimport {\r\n  Link");
export const } from "react-router-dom";
import {
  AppWindow = createMaterialIcon("widgets", "} from \"react-router-dom\";\nimport {\n  AppWindow");
export const } from "react-router-dom";
import {
  AlertTriangle = createMaterialIcon("widgets", "} from \"react-router-dom\";\r\nimport {\r\n  AlertTriangle");
