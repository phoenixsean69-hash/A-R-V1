import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

const WorkspaceRightPanelContext =
  createContext<HTMLElement | null>(null);

interface WorkspaceRightPanelProviderProps {
  host: HTMLElement | null;
  children: ReactNode;
}

export function WorkspaceRightPanelProvider({
  host,
  children,
}: WorkspaceRightPanelProviderProps) {
  return (
    <WorkspaceRightPanelContext.Provider
      value={host}
    >
      {children}
    </WorkspaceRightPanelContext.Provider>
  );
}

export function useWorkspaceRightPanelHost():
  HTMLElement | null {
  return useContext(
    WorkspaceRightPanelContext,
  );
}
