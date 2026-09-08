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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
          title="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="roadsafe-workspace-title">
          <p className="roadsafe-eyebrow">
            {stationClient
              ? "Station workspace"
              : "Field workspace"}
          </p>

          <h1 title={title}>{title}</h1>

          <p title={description}>
            {description}
          </p>
        </div>
      </div>

      <div className="roadsafe-workspace-header-right">
        {activeCase && (
          <Link
            to={`/cases/${activeCase.id}`}
            className="roadsafe-active-case-chip"
            title={`Active case ${activeCase.caseNumber}`}
          >
            <span>Active case</span>
            <strong>{activeCase.caseNumber}</strong>
            <small>
              {formatDate(activeCase.accidentDate)}
            </small>
          </Link>
        )}

        <div
          className="roadsafe-header-clock"
          aria-label="Current date and time"
        >
          <strong>
            {now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <span>
            {now.toLocaleDateString([], {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        <Link
          to={homePath}
          className="ui-icon-button roadsafe-header-icon roadsafe-header-square-button"
          aria-label="Open dashboard"
          title="Open dashboard"
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
            <span>{activeCases}</span>
          )}
        </Link>

        {inspectorAvailable && (
          <button
            type="button"
            className="ui-button roadsafe-inspector-toggle"
            onClick={onToggleInspector}
            aria-label="Toggle case inspector"
            aria-pressed={inspectorOpen}
            title="Toggle case inspector"
          >
            <ClipboardList size={16} />
            <span className="roadsafe-inspector-toggle-label">
              Inspector
            </span>
            {inspectorOpen ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronLeft size={14} />
            )}
          </button>
        )}

        <div className="roadsafe-profile-menu">
          <button
            type="button"
            className="roadsafe-profile-trigger"
            onClick={() =>
              setProfileOpen((value) => !value)
            }
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <span className="roadsafe-profile-avatar">
              {initials}
            </span>

            <span className="roadsafe-profile-copy">
              <small title={roleLabel(role)}>
                {roleLabel(role)}
              </small>
              <strong title={displayName}>
                {displayName}
              </strong>
            </span>

            <ChevronDown
              className="roadsafe-profile-chevron"
              size={14}
            />
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
                Investigation cases
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
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}