import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  DockviewReact,
  themeAbyss,
} from "dockview-react";

import type {
  DockviewReadyEvent,
  IDockviewPanelProps,
} from "dockview-react";

import "dockview-react/dist/styles/dockview.css";

import WorkspaceHeader from "../WorkspaceHeader";
import WorkspaceInspector from "./WorkspaceInspector";
import WorkspaceNavigation from "./WorkspaceNavigation";
import WorkspaceRecentTabs from "./WorkspaceRecentTabs";

import {
  WorkspaceRightPanelProvider,
} from "./WorkspaceRightPanelContext";

import type {
  AccidentCase,
} from "../../types/accidentCase";

import type {
  AccidentReconstruction,
} from "../../types/reconstruction";

interface RoadSafeGlobalDockProps {
  title: string;
  description: string;
  stationClient: boolean;
  stationAdmin: boolean;
  homePath: string;
  desktopCollapsed: boolean;

  activeCase:
    AccidentCase | null | undefined;

  activeReconstruction:
    AccidentReconstruction | null | undefined;

  activeCases: number;
  stationName: string;
  inspectorAvailable: boolean;
  inspectorOpen: boolean;
  inspectorDocked: boolean;
  isDashboard: boolean;
  isReconstructionWorkspace: boolean;
  usesReconstructionContextPanel: boolean;

  onToggleDesktopCollapsed():
    void;

  onCloseMobile():
    void;

  onOpenMobile():
    void;

  onToggleInspector():
    void;

  onToggleInspectorDock():
    void;

  onCloseInspector():
    void;

  children:
    ReactNode;
}

type GlobalDockApi =
  DockviewReadyEvent["api"];

interface GlobalDockModel
  extends RoadSafeGlobalDockProps {
  workspaceRightPanelHost:
    HTMLElement | null;

  setWorkspaceRightPanelHost(
    host: HTMLElement | null,
  ): void;

  openNavigation():
    void;
}

const GlobalDockContext =
  createContext<
    GlobalDockModel | null
  >(
    null,
  );

const LAYOUT_VERSION =
  "roadsafe:global-dock:v1";

function useGlobalDock():
  GlobalDockModel {
  const model =
    useContext(
      GlobalDockContext,
    );

  if (!model) {
    throw new Error(
      "RoadSafe global Dockview context is unavailable.",
    );
  }

  return model;
}

function addWorkspace(
  api: GlobalDockApi,
  title: string,
) {
  const existing =
    api.getPanel(
      "roadsafe-workspace",
    );

  if (existing) {
    existing.api.setTitle(
      title,
    );

    return existing;
  }

  return api.addPanel({
    id:
      "roadsafe-workspace",
    component:
      "workspace",
    title,
    renderer:
      "always",
    minimumWidth:
      420,
    minimumHeight:
      320,
  });
}

function addNavigation(
  api: GlobalDockApi,
  collapsed: boolean,
) {
  const existing =
    api.getPanel(
      "roadsafe-navigation",
    );

  if (existing) {
    return existing;
  }

  const workspace =
    addWorkspace(
      api,
      "Workspace",
    );

  return api.addPanel({
    id:
      "roadsafe-navigation",
    component:
      "navigation",
    title:
      "Navigation",
    renderer:
      "always",
    initialWidth:
      collapsed
        ? 60
        : 218,
    minimumWidth:
      54,
    maximumWidth:
      360,
    position: {
      referencePanel:
        workspace.id,
      direction:
        "left",
    },
  });
}

function addInspector(
  api: GlobalDockApi,
  docked: boolean,
) {
  const existing =
    api.getPanel(
      "roadsafe-inspector",
    );

  if (existing) {
    return existing;
  }

  const workspace =
    addWorkspace(
      api,
      "Workspace",
    );

  return api.addPanel({
    id:
      "roadsafe-inspector",
    component:
      "inspector",
    title:
      "Inspector",
    renderer:
      "always",
    initialWidth:
      310,
    minimumWidth:
      230,
    maximumWidth:
      430,
    ...(docked
      ? {
          position: {
            referencePanel:
              workspace.id,
            direction:
              "right" as const,
          },
        }
      : {
          floating: {
            position: {
              right:
                18,
              top:
                62,
            },
            width:
              330,
            height:
              620,
          },
        }),
  });
}

function addContext(
  api: GlobalDockApi,
) {
  const existing =
    api.getPanel(
      "roadsafe-context",
    );

  if (existing) {
    return existing;
  }

  const workspace =
    addWorkspace(
      api,
      "Workspace",
    );

  return api.addPanel({
    id:
      "roadsafe-context",
    component:
      "context",
    title:
      "Context",
    renderer:
      "always",
    initialWidth:
      310,
    minimumWidth:
      235,
    maximumWidth:
      430,
    position: {
      referencePanel:
        workspace.id,
      direction:
        "right",
    },
  });
}

function removePanel(
  api: GlobalDockApi,
  id: string,
): void {
  const panel =
    api.getPanel(
      id,
    );

  if (panel) {
    api.removePanel(
      panel,
    );
  }
}

function NavigationPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useGlobalDock();

  return (
    <div className="roadsafe-global-dock-navigation">
      <WorkspaceNavigation
        homePath={
          model.homePath
        }
        stationClient={
          model.stationClient
        }
        stationAdmin={
          model.stationAdmin
        }
        desktopCollapsed={
          model.desktopCollapsed
        }
        activeCase={
          model.activeCase
        }
        onToggleDesktopCollapsed={
          model.onToggleDesktopCollapsed
        }
        onCloseMobile={
          model.onCloseMobile
        }
      />
    </div>
  );
}

function WorkspacePanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useGlobalDock();

  return (
    <div
      className={`roadsafe-global-dock-workspace ${
        model.isReconstructionWorkspace
          ? "is-editor"
          : ""
      }`}
    >
      {!model.isReconstructionWorkspace && (
        <WorkspaceHeader
          title={
            model.title
          }
          description={
            model.description
          }
          stationClient={
            model.stationClient
          }
          homePath={
            model.homePath
          }
          activeCase={
            model.activeCase
          }
          activeCases={
            model.activeCases
          }
          inspectorAvailable={
            model.inspectorAvailable
          }
          inspectorOpen={
            model.inspectorOpen
          }
          onToggleInspector={
            model.onToggleInspector
          }
          onOpenNavigation={
            model.openNavigation
          }
        />
      )}

      {!model.isReconstructionWorkspace && (
        <WorkspaceRecentTabs
          currentTitle={
            model.title
          }
          homePath={
            model.homePath
          }
        />
      )}

      <main
        className={`roadsafe-workspace-main ${
          model.isReconstructionWorkspace
            ? "is-editor"
            : ""
        }`}
      >
        <div
          className={`roadsafe-page-stage ${
            model.isDashboard
              ? "is-dashboard"
              : ""
          } ${
            model.isReconstructionWorkspace
              ? "is-editor"
              : ""
          }`}
        >
          <WorkspaceRightPanelProvider
            host={
              model.workspaceRightPanelHost
            }
          >
            {
              model.children
            }
          </WorkspaceRightPanelProvider>
        </div>
      </main>
    </div>
  );
}

function InspectorPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useGlobalDock();

  return (
    <div className="roadsafe-global-dock-inspector">
      <WorkspaceInspector
        activeCase={
          model.activeCase ??
          undefined
        }
        activeReconstruction={
          model.activeReconstruction ??
          undefined
        }
        activeCases={
          model.activeCases
        }
        stationName={
          model.stationName
        }
        docked={
          model.inspectorDocked
        }
        onToggleDock={
          model.onToggleInspectorDock
        }
        onClose={
          model.onCloseInspector
        }
      />
    </div>
  );
}

function ContextPanel(
  _props:
    IDockviewPanelProps,
) {
  const model =
    useGlobalDock();

  return (
    <div className="roadsafe-global-dock-context">
      <aside
        ref={
          model.setWorkspaceRightPanelHost
        }
        className="roadsafe-workspace-context-slot"
        aria-label="Reconstruction context inspector"
      />
    </div>
  );
}

const GLOBAL_DOCK_COMPONENTS = {
  navigation:
    NavigationPanel,
  workspace:
    WorkspacePanel,
  inspector:
    InspectorPanel,
  context:
    ContextPanel,
};

export default function RoadSafeGlobalDock(
  props:
    RoadSafeGlobalDockProps,
) {
  const dockApiRef =
    useRef<
      GlobalDockApi | null
    >(
      null,
    );

  const layoutSubscriptionRef =
    useRef<{
      dispose():
        void;
    } | null>(
      null,
    );

  const removeSubscriptionRef =
    useRef<{
      dispose():
        void;
    } | null>(
      null,
    );

  const propsRef =
    useRef(
      props,
    );

  propsRef.current =
    props;

  const [
    workspaceRightPanelHost,
    setWorkspaceRightPanelHost,
  ] =
    useState<
      HTMLElement | null
    >(
      null,
    );

  const layoutKey =
    `${LAYOUT_VERSION}:${
      props.stationClient
        ? "station"
        : "field"
    }`;

  const reconcilePanels =
    (
      api:
        GlobalDockApi,
    ) => {
      const current =
        propsRef.current;

      const workspace =
        addWorkspace(
          api,
          current.title,
        );

      workspace.api.setTitle(
        current.title,
      );

      if (
        current.isReconstructionWorkspace
      ) {
        removePanel(
          api,
          "roadsafe-navigation",
        );
      } else {
        addNavigation(
          api,
          current.desktopCollapsed,
        );
      }

      if (
        current.usesReconstructionContextPanel
      ) {
        removePanel(
          api,
          "roadsafe-inspector",
        );

        addContext(
          api,
        );
      } else {
        removePanel(
          api,
          "roadsafe-context",
        );

        if (
          current.inspectorAvailable &&
          current.inspectorOpen
        ) {
          addInspector(
            api,
            current.inspectorDocked,
          );
        } else {
          removePanel(
            api,
            "roadsafe-inspector",
          );
        }
      }

      workspace.api.setActive();
    };

  const openNavigation =
    () => {
      props.onOpenMobile();

      const api =
        dockApiRef.current;

      if (
        !api ||
        props.isReconstructionWorkspace
      ) {
        return;
      }

      const navigation =
        addNavigation(
          api,
          props.desktopCollapsed,
        );

      navigation.api.setActive();
    };

  useEffect(
    () => {
      return () => {
        layoutSubscriptionRef.current?.dispose();
        removeSubscriptionRef.current?.dispose();
      };
    },
    [],
  );

  useEffect(
    () => {
      const api =
        dockApiRef.current;

      if (!api) {
        return;
      }

      reconcilePanels(
        api,
      );
    },
    [
      props.title,
      props.isReconstructionWorkspace,
      props.usesReconstructionContextPanel,
      props.inspectorAvailable,
      props.inspectorOpen,
    ],
  );

  useEffect(
    () => {
      const api =
        dockApiRef.current;

      if (
        !api ||
        props.isReconstructionWorkspace
      ) {
        return;
      }

      const navigation =
        api.getPanel(
          "roadsafe-navigation",
        );

      navigation?.api.setSize({
        width:
          props.desktopCollapsed
            ? 60
            : 218,
      });
    },
    [
      props.desktopCollapsed,
      props.isReconstructionWorkspace,
    ],
  );

  const previousInspectorDockedRef =
    useRef(
      props.inspectorDocked,
    );

  useEffect(
    () => {
      const api =
        dockApiRef.current;

      if (!api) {
        previousInspectorDockedRef.current =
          props.inspectorDocked;

        return;
      }

      if (
        previousInspectorDockedRef.current ===
        props.inspectorDocked
      ) {
        return;
      }

      previousInspectorDockedRef.current =
        props.inspectorDocked;

      if (
        props.usesReconstructionContextPanel ||
        !props.inspectorAvailable ||
        !props.inspectorOpen
      ) {
        return;
      }

      removePanel(
        api,
        "roadsafe-inspector",
      );

      addInspector(
        api,
        props.inspectorDocked,
      );
    },
    [
      props.inspectorDocked,
      props.inspectorAvailable,
      props.inspectorOpen,
      props.usesReconstructionContextPanel,
    ],
  );

  const onReady =
    (
      event:
        DockviewReadyEvent,
    ) => {
      dockApiRef.current =
        event.api;

      let restored =
        false;

      const stored =
        window.localStorage.getItem(
          layoutKey,
        );

      if (stored) {
        try {
          event.api.fromJSON(
            JSON.parse(
              stored,
            ),
          );

          restored =
            true;
        } catch (
          error
        ) {
          console.warn(
            "RoadSafe could not restore the global Dockview layout.",
            error,
          );

          window.localStorage.removeItem(
            layoutKey,
          );
        }
      }

      if (!restored) {
        addWorkspace(
          event.api,
          props.title,
        );
      }

      reconcilePanels(
        event.api,
      );

      layoutSubscriptionRef.current?.dispose();

      layoutSubscriptionRef.current =
        event.api.onDidLayoutChange(
          () => {
            try {
              window.localStorage.setItem(
                layoutKey,
                JSON.stringify(
                  event.api.toJSON(),
                ),
              );
            } catch (
              error
            ) {
              console.warn(
                "RoadSafe could not persist the global Dockview layout.",
                error,
              );
            }
          },
        );

      removeSubscriptionRef.current?.dispose();

      removeSubscriptionRef.current =
        event.api.onDidRemovePanel(
          (
            panel,
          ) => {
            window.setTimeout(
              () => {
                const current =
                  propsRef.current;

                if (
                  panel.id ===
                  "roadsafe-inspector"
                ) {
                  if (
                    !event.api.getPanel(
                      "roadsafe-inspector",
                    ) &&
                    current.inspectorOpen &&
                    !current.usesReconstructionContextPanel
                  ) {
                    current.onCloseInspector();
                  }

                  return;
                }

                if (
                  panel.id ===
                  "roadsafe-workspace"
                ) {
                  if (
                    !event.api.getPanel(
                      "roadsafe-workspace",
                    )
                  ) {
                    addWorkspace(
                      event.api,
                      current.title,
                    );
                  }

                  return;
                }

                if (
                  panel.id ===
                    "roadsafe-navigation" &&
                  !current.isReconstructionWorkspace &&
                  !event.api.getPanel(
                    "roadsafe-navigation",
                  )
                ) {
                  addNavigation(
                    event.api,
                    current.desktopCollapsed,
                  );

                  return;
                }

                if (
                  panel.id ===
                    "roadsafe-context" &&
                  current.usesReconstructionContextPanel &&
                  !event.api.getPanel(
                    "roadsafe-context",
                  )
                ) {
                  addContext(
                    event.api,
                  );
                }
              },
              0,
            );
          },
        );
    };

  const model =
    useMemo<
      GlobalDockModel
    >(
      () => ({
        ...props,
        workspaceRightPanelHost,
        setWorkspaceRightPanelHost,
        openNavigation,
      }),
      [
        props,
        workspaceRightPanelHost,
      ],
    );

  return (
    <GlobalDockContext.Provider
      value={
        model
      }
    >
      <div
        className={`roadsafe-global-dock-root ${
          props.isReconstructionWorkspace
            ? "is-editor"
            : ""
        }`}
      >
        <DockviewReact
          className="roadsafe-global-dockview"
          theme={{
            ...themeAbyss,
            tabAnimation:
              "smooth",
          }}
          components={
            GLOBAL_DOCK_COMPONENTS
          }
          onReady={
            onReady
          }
        />
      </div>
    </GlobalDockContext.Provider>
  );
}
