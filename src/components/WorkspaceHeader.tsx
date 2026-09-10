import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  AppWindow,
  Bell,
  ClipboardList,
  Clock3,
  FolderKanban,
  LogOut,
  Menu,
} from "./icons/materialIcons";

import { useAuth } from "../context/AuthContext";
import type { AccidentCase } from "../types/accidentCase";
import { roleLabel } from "../types/auth";

import "./WorkspaceHeader.css";

interface WorkspaceHeaderProps {
  title: string;
  description: string;
  stationClient: boolean;
  homePath: string;
  activeCase?: AccidentCase | null;
  activeCases: number;
  inspectorAvailable: boolean;
  inspectorOpen: boolean;
  onToggleInspector(): void;
  onOpenNavigation(): void;
}

export default function WorkspaceHeader({
  title,
  description,
  stationClient,
  homePath,
  activeCase,
  activeCases,
  inspectorAvailable,
  inspectorOpen,
  onToggleInspector,
  onOpenNavigation,
}: WorkspaceHeaderProps) {
  const auth = useAuth();
  const location = useLocation();

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [now, setNow] =
    useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      1_000,
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  const identity = auth.identity;
  const role = identity?.role ?? "unassigned";

  const displayName =
    identity?.user.name ||
    identity?.user.email ||
    "RoadSafe User";

  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "RS",
    [displayName],
  );

  return (
    <header className="roadsafe-workspace-header">
      <div className="roadsafe-workspace-header-left">
        <button
          type="button"
          className="ui-icon-button roadsafe-mobile-menu-button roadsafe-header-square-button"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
          title="Navigation"
        >
          <Menu size={18} />
        </button>

        <div
          className="roadsafe-workspace-title"
          aria-label={`${title}. ${description}`}
        >
          <span className="roadsafe-workspace-title-icon">
            <AppWindow
              size={17}
              strokeWidth={1.7}
            />
          </span>

          <div className="roadsafe-workspace-title-copy">
            <h1 title={title}>
              {title}
            </h1>

            <small>
              {stationClient
                ? "STATION"
                : "FIELD"}
            </small>
          </div>
        </div>
      </div>

      <div className="roadsafe-workspace-header-right">
        {activeCase && (
          <Link
            to={`/cases/${activeCase.id}`}
            className="roadsafe-active-case-chip roadsafe-icon-first-case-chip"
            title={`Active case ${activeCase.caseNumber}`}
            aria-label={`Open active case ${activeCase.caseNumber}`}
          >
            <ClipboardList
              size={14}
              strokeWidth={1.8}
            />

            <strong>
              {activeCase.caseNumber}
            </strong>
          </Link>
        )}

        <div
          className="roadsafe-header-clock roadsafe-icon-first-clock"
          aria-label="Current time"
          title={now.toLocaleDateString()}
        >
          <Clock3
            size={14}
            strokeWidth={1.7}
          />

          <strong>
            {now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
        </div>

        <Link
          to={homePath}
          className="ui-icon-button roadsafe-header-icon roadsafe-header-square-button"
          aria-label="Open dashboard"
          title="Dashboard"
        >
          <AppWindow size={17} />
        </Link>

        <Link
          to="/cases"
          className="ui-icon-button roadsafe-header-icon roadsafe-header-square-button roadsafe-notification-button"
          aria-label={`${activeCases} active cases`}
          title={`${activeCases} active case${activeCases === 1 ? "" : "s"}`}
        >
          <Bell size={17} />

          {activeCases > 0 && (
            <span>
              {activeCases}
            </span>
          )}
        </Link>

        {inspectorAvailable && (
          <button
            type="button"
            className="ui-icon-button roadsafe-inspector-toggle roadsafe-header-square-button"
            onClick={onToggleInspector}
            aria-label={
              inspectorOpen
                ? "Close case inspector"
                : "Open case inspector"
            }
            aria-pressed={inspectorOpen}
            title={
              inspectorOpen
                ? "Close inspector"
                : "Open inspector"
            }
          >
            <ClipboardList
              size={17}
              fill={inspectorOpen ? 1 : 0}
            />
          </button>
        )}

        <div className="roadsafe-profile-menu">
          <button
            type="button"
            className="roadsafe-profile-trigger roadsafe-profile-trigger--icon-first"
            onClick={() =>
              setProfileOpen((value) => !value)
            }
            aria-label={`Account: ${displayName}`}
            title={`${displayName} - ${roleLabel(role)}`}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <span className="roadsafe-profile-avatar">
              {initials}
            </span>
          </button>

          {profileOpen && (
            <div
              className="roadsafe-profile-popover"
              role="menu"
            >
              <div className="roadsafe-profile-popover-head">
                <strong title={displayName}>
                  {displayName}
                </strong>

                <span title={identity?.user.email}>
                  {identity?.user.email}
                </span>
              </div>

              <Link
                to="/cases"
                role="menuitem"
                onClick={() =>
                  setProfileOpen(false)
                }
              >
                <FolderKanban size={14} />
                <span>Cases</span>
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  void auth.signOut();
                }}
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
