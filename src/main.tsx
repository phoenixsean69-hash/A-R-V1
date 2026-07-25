import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./styles/typographyScale.css";
import "maplibre-gl/dist/maplibre-gl.css";

import App from "./App.tsx";
import { migratePreciseSceneCollisionConfirmation } from "./utils/migratePreciseSceneCollisionConfirmation";

migratePreciseSceneCollisionConfirmation();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
