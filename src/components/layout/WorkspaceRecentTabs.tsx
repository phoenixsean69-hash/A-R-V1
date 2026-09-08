import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppWindow,
  Pin,
  PinOff,
  X,
} from "../icons/materialIcons";
import "./WorkspaceRecentTabs.css";

interface RecentWorkspaceTab {
  pathname: string;
  label: string;
  pinned: boolean;
}

interface WorkspaceRecentTabsProps {
  currentTitle: string;
  homePath: string;
}

const STORAGE_KEY =
  "roadsafe:recent-tabs-v1";
const LIMIT = 12;

function labelForPath(
  pathname: string,
  currentTitle: string,
): string {
  const known: Record<string, string> = {
    "/field": "Field Home",
    "/station": "Station Overview",
    "/cases": "Cases",
    "/scene-map": "Scene Map",
    "/evidence": "Evidence",
    "/reconstruction": "Reconstruction",
    "/footage": "Footage",
    "/reports": "Reports",
    "/analytics": "Analytics",
    "/officers": "Officers",
    "/settings": "Settings",
  };

  return known[pathname] ??
    currentTitle ??
    "Workspace";
}

function readStoredTabs(): RecentWorkspaceTab[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) return [];

    const parsed =
      JSON.parse(raw) as RecentWorkspaceTab[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (tab) =>
          typeof tab?.pathname === "string",
      )
      .map((tab) => ({
        pathname: tab.pathname,
        label:
          typeof tab.label === "string"
            ? tab.label
            : "Workspace",
        pinned: Boolean(tab.pinned),
      }))
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

function sortTabs(
  tabs: RecentWorkspaceTab[],
): RecentWorkspaceTab[] {
  return [...tabs].sort(
    (left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
      }

      return 0;
    },
  );
}

export default function WorkspaceRecentTabs({
  currentTitle,
  homePath,
}: WorkspaceRecentTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [tabs, setTabs] =
    useState<RecentWorkspaceTab[]>(
      () => readStoredTabs(),
    );

  useEffect(() => {
    setTabs((currentTabs) => {
      const existingIndex =
        currentTabs.findIndex(
          (tab) =>
            tab.pathname ===
            location.pathname,
        );

      const nextLabel =
        labelForPath(
          location.pathname,
          currentTitle,
        );

      /*
       * Selecting an existing tab must never reorder it.
       * Only update its label in place if the page title changed.
       */
      if (existingIndex >= 0) {
        const existing =
          currentTabs[existingIndex];

        if (
          existing.label === nextLabel
        ) {
          return currentTabs;
        }

        const nextTabs = [
          ...currentTabs,
        ];

        nextTabs[existingIndex] = {
          ...existing,
          label: nextLabel,
        };

        return nextTabs;
      }

      /*
       * Newly visited pages are appended.
       * Existing tabs keep their positions.
       */
      const nextTabs = [
        ...currentTabs,
        {
          pathname:
            location.pathname,
          label: nextLabel,
          pinned: false,
        },
      ];

      if (nextTabs.length <= LIMIT) {
        return nextTabs;
      }

      const removableIndex =
        nextTabs.findIndex(
          (tab) =>
            !tab.pinned &&
            tab.pathname !==
              location.pathname,
        );

      if (removableIndex >= 0) {
        nextTabs.splice(
          removableIndex,
          1,
        );
      } else {
        nextTabs.shift();
      }

      return nextTabs;
    });
  }, [
    location.pathname,
    currentTitle,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tabs),
      );
    } catch {
      // Recent tabs are convenience state.
    }
  }, [tabs]);

  useEffect(() => {
    function handleTabCommand(
      event: Event,
    ): void {
      const detail =
        (
          event as CustomEvent<{
            action?:
              | "previous"
              | "next"
              | "close";
          }>
        ).detail;

      const ordered =
        sortTabs(tabs);

      if (
        ordered.length === 0 ||
        !detail?.action
      ) {
        return;
      }

      const currentIndex =
        ordered.findIndex(
          (tab) =>
            tab.pathname ===
            location.pathname,
        );

      if (
        detail.action ===
        "previous" ||
        detail.action ===
        "next"
      ) {
        const direction =
          detail.action ===
          "next"
            ? 1
            : -1;

        const baseIndex =
          currentIndex >= 0
            ? currentIndex
            : 0;

        const targetIndex =
          (
            baseIndex +
            direction +
            ordered.length
          ) %
          ordered.length;

        const target =
          ordered[
            targetIndex
          ];

        if (
          target &&
          target.pathname !==
            location.pathname
        ) {
          navigate(
            target.pathname,
          );
        }

        return;
      }

      if (
        detail.action ===
        "close"
      ) {
        const active =
          ordered.find(
            (tab) =>
              tab.pathname ===
              location.pathname,
          );

        if (!active) {
          return;
        }

        const remaining =
          tabs.filter(
            (tab) =>
              tab.pathname !==
              active.pathname,
          );

        navigate(
          remaining[0]?.pathname ??
            homePath,
        );

        setTabs(
          remaining,
        );
      }
    }

    window.addEventListener(
      "roadsafe:recent-tabs-command",
      handleTabCommand,
    );

    return () => {
      window.removeEventListener(
        "roadsafe:recent-tabs-command",
        handleTabCommand,
      );
    };
  }, [
    homePath,
    location.pathname,
    navigate,
    tabs,
  ]);

  const orderedTabs = useMemo(
    () => sortTabs(tabs),
    [tabs],
  );

  function togglePin(
    pathname: string,
  ): void {
    setTabs((current) =>
      sortTabs(
        current.map((tab) =>
          tab.pathname === pathname
            ? {
                ...tab,
                pinned: !tab.pinned,
              }
            : tab,
        ),
      ),
    );
  }

  function closeTab(
    pathname: string,
  ): void {
    const remaining =
      tabs.filter(
        (tab) =>
          tab.pathname !== pathname,
      );

    if (
      pathname === location.pathname
    ) {
      navigate(
        remaining[0]?.pathname ??
          homePath,
      );
    }

    setTabs(remaining);
  }

  if (orderedTabs.length === 0) {
    return null;
  }

  return (
    <div
      className="roadsafe-tabbar"
      aria-label="Recent workspaces"
    >
      <div className="roadsafe-tabbar-scroll">
        {orderedTabs.map((tab) => {
          const active =
            tab.pathname ===
            location.pathname;

          return (
            <div
              key={tab.pathname}
              className={`roadsafe-tab ${
                active ? "is-active" : ""
              } ${
                tab.pinned
                  ? "is-pinned"
                  : ""
              }`}
            >
              <button
                type="button"
                className="roadsafe-tab-label"
                onClick={() => {
                  if (!active) {
                    navigate(tab.pathname);
                  }
                }}
              >
                <AppWindow
                  className="roadsafe-tab-favicon"
                  size={14}
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
              </button>

              <button
                type="button"
                className="roadsafe-tab-action"
                aria-label={
                  tab.pinned
                    ? "Unpin tab"
                    : "Pin tab"
                }
                onClick={() =>
                  togglePin(tab.pathname)
                }
              >
                {tab.pinned ? (
                  <PinOff
                    size={12}
                    strokeWidth={1.8}
                  />
                ) : (
                  <Pin
                    size={12}
                    strokeWidth={1.8}
                  />
                )}
              </button>

              <button
                type="button"
                className="roadsafe-tab-action roadsafe-tab-close"
                aria-label={`Close ${tab.label}`}
                onClick={() =>
                  closeTab(tab.pathname)
                }
              >
                <X
                  size={12}
                  strokeWidth={1.8}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}