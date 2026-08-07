import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
} catch (error) {
  console.error("Could not read package.json:", error);
  process.exit(1);
}

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const requiredExistingPaths = [
  "src/main.tsx",
  "src/styles/darkerTheme.css",
  "src/components/icons/materialIcons.tsx",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
  "src/components/reconstruction/SceneObjectPalette.tsx",
];

for (const relativePath of requiredExistingPaths) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    console.error(`Required project file is missing: ${relativePath}`);
    process.exit(1);
  }
}

const replacementFiles = {"src/components/reconstruction/ReconstructionNodeEditor.tsx": "import {\n  useEffect,\n  useMemo,\n  useRef,\n  useState,\n  type PointerEvent as ReactPointerEvent,\n} from \"react\";\n\nimport {\n  Activity,\n  Camera,\n  ChevronUp,\n  Crosshair,\n  FileSearch,\n  Gauge,\n  Layers3,\n  Route,\n  Ruler,\n  Waypoints,\n} from \"../icons/materialIcons\";\n\nimport type {\n  AccidentReconstruction,\n} from \"../../types/reconstruction\";\n\ninterface ReconstructionNodeEditorProps {\n  reconstruction: AccidentReconstruction;\n  currentTime: number;\n  activeView: \"2D\" | \"3D\";\n  open: boolean;\n  selectedParticipantId: string | null;\n  selectedSceneObjectId: string | null;\n  onToggle(): void;\n  onSelectParticipant(participantId: string): void;\n  onSelectSceneObject(objectId: string): void;\n}\n\ntype NodeKind =\n  | \"case\"\n  | \"scene\"\n  | \"participant\"\n  | \"objects\"\n  | \"evidence\"\n  | \"collision\"\n  | \"physics\"\n  | \"output\";\n\ninterface NodePosition {\n  x: number;\n  y: number;\n}\n\ninterface NodeDescriptor {\n  id: string;\n  kind: NodeKind;\n  title: string;\n  subtitle: string;\n  detail: string;\n  defaultPosition: NodePosition;\n  selected?: boolean;\n  onSelect?: () => void;\n}\n\ninterface NodeConnection {\n  id: string;\n  from: string;\n  to: string;\n  state?: \"ready\" | \"pending\" | \"warning\";\n}\n\ninterface DragState {\n  id: string;\n  pointerId: number;\n  startClientX: number;\n  startClientY: number;\n  startPosition: NodePosition;\n  moved: boolean;\n}\n\nconst NODE_WIDTH = 190;\nconst NODE_HEIGHT = 86;\nconst LOGICAL_WIDTH = 1240;\n\nfunction clamp(\n  value: number,\n  minimum: number,\n  maximum: number,\n): number {\n  return Math.min(\n    maximum,\n    Math.max(minimum, value),\n  );\n}\n\nfunction NodeIcon({\n  kind,\n}: {\n  kind: NodeKind;\n}) {\n  switch (kind) {\n    case \"case\":\n      return <FileSearch size={15} />;\n    case \"scene\":\n      return <Layers3 size={15} />;\n    case \"participant\":\n      return <Route size={15} />;\n    case \"objects\":\n      return <Crosshair size={15} />;\n    case \"evidence\":\n      return <Ruler size={15} />;\n    case \"collision\":\n      return <Activity size={15} />;\n    case \"physics\":\n      return <Gauge size={15} />;\n    case \"output\":\n      return <Camera size={15} />;\n  }\n}\n\nfunction makeConnectionPath(\n  from: NodePosition,\n  to: NodePosition,\n): string {\n  const startX = from.x + NODE_WIDTH;\n  const startY = from.y + NODE_HEIGHT / 2;\n  const endX = to.x;\n  const endY = to.y + NODE_HEIGHT / 2;\n  const bend = Math.max(\n    54,\n    Math.abs(endX - startX) * 0.42,\n  );\n\n  return [\n    `M ${startX} ${startY}`,\n    `C ${startX + bend} ${startY}`,\n    `${endX - bend} ${endY}`,\n    `${endX} ${endY}`,\n  ].join(\" \");\n}\n\nexport default function ReconstructionNodeEditor({\n  reconstruction,\n  currentTime,\n  activeView,\n  open,\n  selectedParticipantId,\n  selectedSceneObjectId,\n  onToggle,\n  onSelectParticipant,\n  onSelectSceneObject,\n}: ReconstructionNodeEditorProps) {\n  const viewportRef =\n    useRef<HTMLDivElement | null>(null);\n\n  const dragRef =\n    useRef<DragState | null>(null);\n\n  const [zoom, setZoom] =\n    useState(0.86);\n\n  const nodes = useMemo<NodeDescriptor[]>(\n    () => {\n      const participantNodes =\n        reconstruction.vehicles.map(\n          (participant, index) => ({\n            id: `participant:${participant.id}`,\n            kind: \"participant\" as const,\n            title: participant.name,\n            subtitle: participant.type,\n            detail:\n              `${participant.pathPoints.length} route point(s) · ${participant.estimatedSpeedKmh.toFixed(1)} km/h`,\n            defaultPosition: {\n              x: 270,\n              y: 150 + index * 104,\n            },\n            selected:\n              selectedParticipantId ===\n              participant.id,\n            onSelect: () =>\n              onSelectParticipant(\n                participant.id,\n              ),\n          }),\n        );\n\n      const firstSelectedObject =\n        reconstruction.sceneObjects.find(\n          (object) =>\n            object.id ===\n            selectedSceneObjectId,\n        );\n\n      return [\n        {\n          id: \"case\",\n          kind: \"case\",\n          title:\n            reconstruction.accidentId ||\n            \"Accident case\",\n          subtitle:\n            reconstruction.title ||\n            \"Reconstruction\",\n          detail:\n            `${reconstruction.durationSeconds.toFixed(1)}s canonical timeline`,\n          defaultPosition: {\n            x: 28,\n            y: 126,\n          },\n        },\n        {\n          id: \"scene\",\n          kind: \"scene\",\n          title: \"Scene geometry\",\n          subtitle:\n            reconstruction.scene.sceneEnvironment,\n          detail:\n            `${reconstruction.scene.sceneWidthMetres}m × ${reconstruction.scene.sceneHeightMetres}m`,\n          defaultPosition: {\n            x: 270,\n            y: 32,\n          },\n        },\n        ...participantNodes,\n        {\n          id: \"objects\",\n          kind: \"objects\",\n          title: \"Objects & hazards\",\n          subtitle:\n            `${reconstruction.sceneObjects.length} placed`,\n          detail:\n            firstSelectedObject\n              ? `Selected: ${firstSelectedObject.label}`\n              : \"Road, environment and investigation objects\",\n          defaultPosition: {\n            x: 530,\n            y: 42,\n          },\n          selected:\n            Boolean(firstSelectedObject),\n          onSelect:\n            firstSelectedObject\n              ? () =>\n                  onSelectSceneObject(\n                    firstSelectedObject.id,\n                  )\n              : undefined,\n        },\n        {\n          id: \"evidence\",\n          kind: \"evidence\",\n          title: \"Evidence\",\n          subtitle:\n            `${reconstruction.evidenceRecords.length} record(s)`,\n          detail:\n            `${reconstruction.measurements.length} measurement(s) · ${reconstruction.photos.length} photo(s)`,\n          defaultPosition: {\n            x: 530,\n            y: 154,\n          },\n        },\n        {\n          id: \"collision\",\n          kind: \"collision\",\n          title: \"Primary collision\",\n          subtitle:\n            reconstruction.collisionSetup\n              ?.confirmed\n              ? \"Confirmed\"\n              : \"Awaiting confirmation\",\n          detail:\n            `X ${reconstruction.collisionPoint.x.toFixed(1)} · Y ${reconstruction.collisionPoint.y.toFixed(1)}`,\n          defaultPosition: {\n            x: 530,\n            y: 282,\n          },\n          selected:\n            reconstruction.collisionSetup\n              ?.confirmed,\n        },\n        {\n          id: \"physics\",\n          kind: \"physics\",\n          title: \"Physics solver\",\n          subtitle:\n            reconstruction.lastPhysicsSimulation\n              ? \"Baked\"\n              : \"Not baked\",\n          detail:\n            reconstruction.lastPhysicsSimulation\n              ? `${reconstruction.lastPhysicsSimulation.participantCollisions} collision(s)`\n              : \"Run deterministic simulation\",\n          defaultPosition: {\n            x: 794,\n            y: 190,\n          },\n          selected:\n            Boolean(\n              reconstruction.lastPhysicsSimulation,\n            ),\n        },\n        {\n          id: \"output\",\n          kind: \"output\",\n          title: `${activeView} output`,\n          subtitle:\n            `${currentTime.toFixed(2)}s / ${reconstruction.durationSeconds.toFixed(1)}s`,\n          detail:\n            `${reconstruction.timelineEvents.length} timeline event(s)`,\n          defaultPosition: {\n            x: 1030,\n            y: 190,\n          },\n          selected: true,\n        },\n      ];\n    },\n    [\n      activeView,\n      currentTime,\n      onSelectParticipant,\n      onSelectSceneObject,\n      reconstruction,\n      selectedParticipantId,\n      selectedSceneObjectId,\n    ],\n  );\n\n  const nodeSignature = useMemo(\n    () =>\n      nodes\n        .map((node) => node.id)\n        .join(\"|\"),\n    [nodes],\n  );\n\n  const [positions, setPositions] =\n    useState<Record<string, NodePosition>>(\n      {},\n    );\n\n  useEffect(() => {\n    setPositions((current) => {\n      const next: Record<\n        string,\n        NodePosition\n      > = {};\n\n      nodes.forEach((node) => {\n        next[node.id] =\n          current[node.id] ??\n          node.defaultPosition;\n      });\n\n      return next;\n    });\n  }, [nodeSignature, nodes]);\n\n  const connections = useMemo<\n    NodeConnection[]\n  >(() => {\n    const participantConnections =\n      reconstruction.vehicles.flatMap(\n        (participant) => [\n          {\n            id: `scene-to-${participant.id}`,\n            from: \"scene\",\n            to: `participant:${participant.id}`,\n            state: \"ready\" as const,\n          },\n          {\n            id: `${participant.id}-to-collision`,\n            from: `participant:${participant.id}`,\n            to: \"collision\",\n            state:\n              reconstruction.collisionSetup\n                ?.confirmed\n                ? (\"ready\" as const)\n                : (\"pending\" as const),\n          },\n        ],\n      );\n\n    return [\n      {\n        id: \"case-to-scene\",\n        from: \"case\",\n        to: \"scene\",\n        state: \"ready\",\n      },\n      {\n        id: \"scene-to-objects\",\n        from: \"scene\",\n        to: \"objects\",\n        state:\n          reconstruction.sceneObjects.length >\n          0\n            ? \"ready\"\n            : \"pending\",\n      },\n      {\n        id: \"scene-to-evidence\",\n        from: \"scene\",\n        to: \"evidence\",\n        state:\n          reconstruction.evidenceRecords\n            .length > 0\n            ? \"ready\"\n            : \"pending\",\n      },\n      ...participantConnections,\n      {\n        id: \"objects-to-collision\",\n        from: \"objects\",\n        to: \"collision\",\n        state: \"pending\",\n      },\n      {\n        id: \"evidence-to-collision\",\n        from: \"evidence\",\n        to: \"collision\",\n        state:\n          reconstruction.collisionSetup\n            ?.confirmed\n            ? \"ready\"\n            : \"warning\",\n      },\n      {\n        id: \"collision-to-physics\",\n        from: \"collision\",\n        to: \"physics\",\n        state:\n          reconstruction.lastPhysicsSimulation\n            ? \"ready\"\n            : \"pending\",\n      },\n      {\n        id: \"physics-to-output\",\n        from: \"physics\",\n        to: \"output\",\n        state:\n          reconstruction.lastPhysicsSimulation\n            ? \"ready\"\n            : \"pending\",\n      },\n    ];\n  }, [reconstruction]);\n\n  const logicalHeight = useMemo(\n    () =>\n      Math.max(\n        470,\n        170 +\n          reconstruction.vehicles.length *\n            104,\n      ),\n    [reconstruction.vehicles.length],\n  );\n\n  const resetLayout = () => {\n    const next: Record<\n      string,\n      NodePosition\n    > = {};\n\n    nodes.forEach((node) => {\n      next[node.id] =\n        node.defaultPosition;\n    });\n\n    setPositions(next);\n    setZoom(0.86);\n\n    if (viewportRef.current) {\n      viewportRef.current.scrollLeft = 0;\n      viewportRef.current.scrollTop = 0;\n    }\n  };\n\n  const fitLayout = () => {\n    const viewport =\n      viewportRef.current;\n\n    if (!viewport) {\n      return;\n    }\n\n    const widthScale =\n      (viewport.clientWidth - 28) /\n      LOGICAL_WIDTH;\n\n    const heightScale =\n      (viewport.clientHeight - 28) /\n      logicalHeight;\n\n    setZoom(\n      clamp(\n        Math.min(\n          widthScale,\n          heightScale,\n        ),\n        0.5,\n        1,\n      ),\n    );\n\n    viewport.scrollLeft = 0;\n    viewport.scrollTop = 0;\n  };\n\n  const handleNodePointerDown = (\n    event: ReactPointerEvent<HTMLElement>,\n    nodeId: string,\n  ) => {\n    if (\n      event.button !== 0\n    ) {\n      return;\n    }\n\n    const position =\n      positions[nodeId];\n\n    if (!position) {\n      return;\n    }\n\n    event.currentTarget.setPointerCapture(\n      event.pointerId,\n    );\n\n    dragRef.current = {\n      id: nodeId,\n      pointerId: event.pointerId,\n      startClientX: event.clientX,\n      startClientY: event.clientY,\n      startPosition: position,\n      moved: false,\n    };\n  };\n\n  const handleNodePointerMove = (\n    event: ReactPointerEvent<HTMLElement>,\n  ) => {\n    const drag = dragRef.current;\n\n    if (\n      !drag ||\n      drag.pointerId !==\n        event.pointerId\n    ) {\n      return;\n    }\n\n    const deltaX =\n      (event.clientX -\n        drag.startClientX) /\n      zoom;\n\n    const deltaY =\n      (event.clientY -\n        drag.startClientY) /\n      zoom;\n\n    if (\n      Math.abs(deltaX) > 2 ||\n      Math.abs(deltaY) > 2\n    ) {\n      drag.moved = true;\n    }\n\n    setPositions((current) => ({\n      ...current,\n      [drag.id]: {\n        x: clamp(\n          drag.startPosition.x +\n            deltaX,\n          0,\n          LOGICAL_WIDTH -\n            NODE_WIDTH,\n        ),\n        y: clamp(\n          drag.startPosition.y +\n            deltaY,\n          0,\n          logicalHeight -\n            NODE_HEIGHT,\n        ),\n      },\n    }));\n  };\n\n  const handleNodePointerUp = (\n    event: ReactPointerEvent<HTMLElement>,\n    node: NodeDescriptor,\n  ) => {\n    const drag = dragRef.current;\n\n    if (\n      !drag ||\n      drag.pointerId !==\n        event.pointerId\n    ) {\n      return;\n    }\n\n    dragRef.current = null;\n\n    if (\n      event.currentTarget.hasPointerCapture(\n        event.pointerId,\n      )\n    ) {\n      event.currentTarget.releasePointerCapture(\n        event.pointerId,\n      );\n    }\n\n    if (!drag.moved) {\n      node.onSelect?.();\n    }\n  };\n\n  return (\n    <section\n      className={`roadsafe-bottom-panel reconstruction-node-editor ${\n        open ? \"is-open\" : \"\"\n      }`}\n      aria-label=\"Reconstruction node editor\"\n    >\n      <header className=\"roadsafe-bottom-panel__header reconstruction-node-editor__header\">\n        <button\n          type=\"button\"\n          className=\"reconstruction-node-editor__toggle\"\n          onClick={onToggle}\n          aria-expanded={open}\n        >\n          <Waypoints size={15} />\n          <span>\n            <strong>Reconstruction Nodes</strong>\n            <small>\n              Scene, evidence, impact,\n              physics and output graph\n            </small>\n          </span>\n          <ChevronUp\n            size={14}\n            className={\n              open ? \"\" : \"is-collapsed\"\n            }\n          />\n        </button>\n\n        <div className=\"reconstruction-node-editor__summary\">\n          <span>\n            {nodes.length} nodes\n          </span>\n          <span>\n            {connections.length} links\n          </span>\n          <span>\n            {activeView} view\n          </span>\n        </div>\n      </header>\n\n      {open && (\n        <div className=\"roadsafe-bottom-panel__body reconstruction-node-editor__body\">\n          <div className=\"reconstruction-node-editor__toolbar\">\n            <button\n              type=\"button\"\n              onClick={fitLayout}\n            >\n              Fit\n            </button>\n            <button\n              type=\"button\"\n              onClick={resetLayout}\n            >\n              Reset layout\n            </button>\n            <label>\n              <span>Zoom</span>\n              <input\n                type=\"range\"\n                min={0.5}\n                max={1.25}\n                step={0.05}\n                value={zoom}\n                onChange={(event) =>\n                  setZoom(\n                    Number(\n                      event.target.value,\n                    ),\n                  )\n                }\n              />\n              <strong>\n                {Math.round(zoom * 100)}%\n              </strong>\n            </label>\n          </div>\n\n          <div\n            ref={viewportRef}\n            className=\"reconstruction-node-editor__viewport\"\n          >\n            <div\n              className=\"reconstruction-node-editor__canvas\"\n              style={{\n                width:\n                  LOGICAL_WIDTH * zoom,\n                height:\n                  logicalHeight * zoom,\n              }}\n            >\n              <div\n                className=\"reconstruction-node-editor__scale\"\n                style={{\n                  width: LOGICAL_WIDTH,\n                  height: logicalHeight,\n                  transform:\n                    `scale(${zoom})`,\n                }}\n              >\n                <svg\n                  className=\"reconstruction-node-editor__links\"\n                  width={LOGICAL_WIDTH}\n                  height={logicalHeight}\n                  viewBox={`0 0 ${LOGICAL_WIDTH} ${logicalHeight}`}\n                  aria-hidden=\"true\"\n                >\n                  {connections.map(\n                    (connection) => {\n                      const from =\n                        positions[\n                          connection.from\n                        ];\n\n                      const to =\n                        positions[\n                          connection.to\n                        ];\n\n                      if (!from || !to) {\n                        return null;\n                      }\n\n                      return (\n                        <path\n                          key={\n                            connection.id\n                          }\n                          d={makeConnectionPath(\n                            from,\n                            to,\n                          )}\n                          className={`reconstruction-node-editor__link is-${\n                            connection.state ??\n                            \"pending\"\n                          }`}\n                        />\n                      );\n                    },\n                  )}\n                </svg>\n\n                {nodes.map((node) => {\n                  const position =\n                    positions[node.id] ??\n                    node.defaultPosition;\n\n                  return (\n                    <article\n                      key={node.id}\n                      className={`reconstruction-node is-${node.kind} ${\n                        node.selected\n                          ? \"is-selected\"\n                          : \"\"\n                      }`}\n                      style={{\n                        left: position.x,\n                        top: position.y,\n                      }}\n                      onPointerDown={(\n                        event,\n                      ) =>\n                        handleNodePointerDown(\n                          event,\n                          node.id,\n                        )\n                      }\n                      onPointerMove={\n                        handleNodePointerMove\n                      }\n                      onPointerUp={(event) =>\n                        handleNodePointerUp(\n                          event,\n                          node,\n                        )\n                      }\n                      onPointerCancel={(event) =>\n                        handleNodePointerUp(\n                          event,\n                          node,\n                        )\n                      }\n                      tabIndex={0}\n                      role={\n                        node.onSelect\n                          ? \"button\"\n                          : undefined\n                      }\n                      onKeyDown={(event) => {\n                        if (\n                          node.onSelect &&\n                          (event.key ===\n                            \"Enter\" ||\n                            event.key === \" \")\n                        ) {\n                          event.preventDefault();\n                          node.onSelect();\n                        }\n                      }}\n                    >\n                      <span className=\"reconstruction-node__socket reconstruction-node__socket--input\" />\n\n                      <header className=\"reconstruction-node__header\">\n                        <NodeIcon\n                          kind={node.kind}\n                        />\n                        <strong>\n                          {node.title}\n                        </strong>\n                      </header>\n\n                      <div className=\"reconstruction-node__body\">\n                        <span>\n                          {node.subtitle}\n                        </span>\n                        <small>\n                          {node.detail}\n                        </small>\n                      </div>\n\n                      <span className=\"reconstruction-node__socket reconstruction-node__socket--output\" />\n                    </article>\n                  );\n                })}\n              </div>\n            </div>\n          </div>\n        </div>\n      )}\n    </section>\n  );\n}\n", "src/components/reconstruction/SceneObjectPalette.tsx": "import {\n  Check,\n  Crosshair,\n  LocateFixed,\n  Lock,\n  Trash2,\n  X,\n} from \"../icons/materialIcons\";\n\nimport {\n  sceneObjectCatalog,\n  sceneObjectCategories,\n} from \"../../data/sceneObjectCatalog\";\n\nimport type {\n  ReconstructionSceneObject,\n  SceneObjectType,\n} from \"../../types/reconstruction\";\nimport {\n  isTraceableSceneObjectType,\n} from \"../../utils/reconstructionGeometry\";\n\ninterface SceneObjectPaletteProps {\n  activeType: SceneObjectType | null;\n  objects: ReconstructionSceneObject[];\n  selectedObjectId: string | null;\n  onToolSelect(type: SceneObjectType): void;\n  onPlaceActiveWithGps(): void;\n  onCancelPlacement(): void;\n  onSelectObject(objectId: string): void;\n  onClearObjects(): void;\n}\n\nconst BOUNDARY_TYPES =\n  new Set<SceneObjectType>([\n    \"Pothole\",\n    \"Puddle\",\n    \"Oil Spill\",\n    \"Loose Gravel\",\n    \"Debris\",\n    \"Broken Glass\",\n    \"Bush\",\n  ]);\n\nconst MATERIAL_SYMBOL_BY_TYPE:\n  Record<SceneObjectType, string> = {\n    Pothole: \"radio_button_unchecked\",\n    \"Road Crack\": \"gesture\",\n    Puddle: \"water_drop\",\n    \"Oil Spill\": \"oil_barrel\",\n    \"Loose Gravel\": \"grain\",\n    Debris: \"deployed_code\",\n    \"Fallen Branch\": \"forest\",\n    \"Broken Glass\": \"broken_image\",\n    \"Skid Mark\": \"drag_handle\",\n    \"Tyre Mark\": \"tire_repair\",\n    \"Vehicle Part\": \"build\",\n    \"Injury Location\": \"emergency\",\n    \"Traffic Cone\": \"traffic\",\n    \"Road Barrier\": \"car_crash\",\n    \"Stop Sign\": \"stop_circle\",\n    \"Give Way Sign\": \"change_history\",\n    \"Speed Limit Sign\": \"speed\",\n    \"Traffic Light\": \"traffic\",\n    \"Street Light\": \"lightbulb\",\n    Drain: \"water_damage\",\n    Guardrail: \"horizontal_rule\",\n    \"Bus Stop\": \"directions_bus\",\n    \"Parked Vehicle\": \"local_parking\",\n    Tree: \"park\",\n    Bush: \"grass\",\n    Wall: \"view_week\",\n    Fence: \"fence\",\n    \"CCTV Camera\": \"videocam\",\n    \"Evidence Marker\": \"pin_drop\",\n    \"Measurement Point\": \"straighten\",\n    \"Witness Viewpoint\": \"visibility\",\n  };\n\nfunction gpsActionLabel(\n  type: SceneObjectType,\n): string {\n  if (isTraceableSceneObjectType(type)) {\n    return \"Walk and track with GPS\";\n  }\n\n  if (BOUNDARY_TYPES.has(type)) {\n    return \"Walk boundary with GPS\";\n  }\n\n  return \"Place at live GPS position\";\n}\n\nfunction SceneObjectIcon({\n  type,\n  size = 17,\n}: {\n  type: SceneObjectType;\n  size?: number;\n}) {\n  return (\n    <span\n      className=\"material-symbols-outlined roadsafe-material-icon blender-object-icon\"\n      style={{\n        fontSize: size,\n        fontVariationSettings:\n          '\"FILL\" 0, \"wght\" 450, \"GRAD\" 0, \"opsz\" 24',\n      }}\n      aria-hidden=\"true\"\n    >\n      {MATERIAL_SYMBOL_BY_TYPE[type]}\n    </span>\n  );\n}\n\nexport default function SceneObjectPalette({\n  activeType,\n  objects,\n  selectedObjectId,\n  onToolSelect,\n  onPlaceActiveWithGps,\n  onCancelPlacement,\n  onSelectObject,\n  onClearObjects,\n}: SceneObjectPaletteProps) {\n  const activeCatalogItem =\n    activeType\n      ? sceneObjectCatalog.find(\n          (item) =>\n            item.type === activeType,\n        ) ?? null\n      : null;\n\n  const placedCountByType =\n    objects.reduce<\n      Partial<\n        Record<SceneObjectType, number>\n      >\n    >((counts, object) => {\n      counts[object.type] =\n        (counts[object.type] ?? 0) + 1;\n      return counts;\n    }, {});\n\n  return (\n    <div className=\"blender-object-palette\">\n      <div className=\"blender-object-palette__intro\">\n        <p>\n          Tick a tool to activate scene placement.\n          Tick it again to stop. Icons and counts\n          remain compact like Blender’s Outliner.\n        </p>\n      </div>\n\n      {activeCatalogItem && (\n        <section className=\"blender-object-palette__active\">\n          <div className=\"blender-object-palette__active-copy\">\n            <span className=\"blender-object-palette__active-icon\">\n              <SceneObjectIcon\n                type={activeCatalogItem.type}\n                size={18}\n              />\n            </span>\n            <span>\n              <strong>\n                {activeCatalogItem.label}\n              </strong>\n              <small>\n                Placement tool active\n              </small>\n            </span>\n          </div>\n\n          <div className=\"blender-object-palette__active-actions\">\n            <button\n              type=\"button\"\n              onClick={onPlaceActiveWithGps}\n            >\n              <LocateFixed size={14} />\n              {gpsActionLabel(\n                activeCatalogItem.type,\n              )}\n            </button>\n            <button\n              type=\"button\"\n              onClick={onCancelPlacement}\n              aria-label=\"Stop object placement\"\n              title=\"Stop object placement\"\n            >\n              <X size={14} />\n            </button>\n          </div>\n        </section>\n      )}\n\n      <div className=\"blender-object-palette__categories\">\n        {sceneObjectCategories.map(\n          (category) => {\n            const items =\n              sceneObjectCatalog.filter(\n                (item) =>\n                  item.category ===\n                  category,\n              );\n\n            return (\n              <details\n                key={category}\n                className=\"blender-object-category\"\n                open\n              >\n                <summary>\n                  <span>{category}</span>\n                  <small>\n                    {items.reduce(\n                      (count, item) =>\n                        count +\n                        (placedCountByType[\n                          item.type\n                        ] ?? 0),\n                      0,\n                    )}\n                  </small>\n                </summary>\n\n                <div className=\"blender-object-category__items\">\n                  {items.map((item) => {\n                    const active =\n                      activeType === item.type;\n                    const count =\n                      placedCountByType[\n                        item.type\n                      ] ?? 0;\n\n                    return (\n                      <label\n                        key={item.type}\n                        className={`blender-object-option ${\n                          active\n                            ? \"is-active\"\n                            : \"\"\n                        }`}\n                        title={item.description}\n                      >\n                        <input\n                          type=\"checkbox\"\n                          checked={active}\n                          onChange={() => {\n                            if (active) {\n                              onCancelPlacement();\n                            } else {\n                              onToolSelect(\n                                item.type,\n                              );\n                            }\n                          }}\n                        />\n\n                        <span className=\"blender-object-option__check\">\n                          {active && (\n                            <Check size={11} />\n                          )}\n                        </span>\n\n                        <span className=\"blender-object-option__icon\">\n                          <SceneObjectIcon\n                            type={item.type}\n                          />\n                        </span>\n\n                        <span className=\"blender-object-option__copy\">\n                          <strong>\n                            {item.label}\n                          </strong>\n                          <small>\n                            {item.defaultSeverity}\n                          </small>\n                        </span>\n\n                        {count > 0 && (\n                          <span className=\"blender-object-option__count\">\n                            {count}\n                          </span>\n                        )}\n                      </label>\n                    );\n                  })}\n                </div>\n              </details>\n            );\n          },\n        )}\n      </div>\n\n      <section className=\"blender-placed-objects\">\n        <header className=\"blender-placed-objects__header\">\n          <span>\n            <Crosshair size={14} />\n            Placed objects\n          </span>\n          <small>{objects.length}</small>\n        </header>\n\n        <div className=\"blender-placed-objects__list\">\n          {objects.map((object) => {\n            const selected =\n              selectedObjectId === object.id;\n\n            return (\n              <label\n                key={object.id}\n                className={`blender-placed-object ${\n                  selected\n                    ? \"is-selected\"\n                    : \"\"\n                }`}\n              >\n                <input\n                  type=\"checkbox\"\n                  checked={selected}\n                  onChange={() =>\n                    onSelectObject(object.id)\n                  }\n                />\n\n                <span className=\"blender-object-option__check\">\n                  {selected && (\n                    <Check size={11} />\n                  )}\n                </span>\n\n                <span className=\"blender-object-option__icon\">\n                  <SceneObjectIcon\n                    type={object.type}\n                  />\n                </span>\n\n                <span className=\"blender-object-option__copy\">\n                  <strong>{object.label}</strong>\n                  <small>\n                    {object.type} · {object.severity}\n                  </small>\n                </span>\n\n                {object.locked && (\n                  <Lock\n                    size={12}\n                    aria-label=\"Locked\"\n                  />\n                )}\n              </label>\n            );\n          })}\n\n          {objects.length === 0 && (\n            <div className=\"blender-placed-objects__empty\">\n              No objects, hazards or evidence have\n              been placed.\n            </div>\n          )}\n        </div>\n\n        {objects.length > 0 && (\n          <footer className=\"blender-placed-objects__footer\">\n            <button\n              type=\"button\"\n              className=\"is-danger\"\n              onClick={onClearObjects}\n            >\n              <Trash2 size={13} />\n              Clear all placed objects\n            </button>\n          </footer>\n        )}\n      </section>\n    </div>\n  );\n}\n", "src/styles/reconstructionNodeEditor.css": ".reconstruction-node-editor {\n  margin: 8px;\n  border-color: var(--blender-border, #171717) !important;\n  background: var(--blender-panel, #292929) !important;\n}\n\n.reconstruction-node-editor__header {\n  min-height: 36px;\n  padding: 0;\n}\n\n.reconstruction-node-editor__toggle {\n  min-width: 0;\n  min-height: 35px;\n  flex: 1;\n  display: grid;\n  grid-template-columns: 18px minmax(0, 1fr) 16px;\n  align-items: center;\n  gap: 8px;\n  border: 0 !important;\n  background: transparent !important;\n  padding: 5px 8px !important;\n  color: var(--blender-text, #dedede) !important;\n  text-align: left;\n  box-shadow: none !important;\n}\n\n.reconstruction-node-editor__toggle > span {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n}\n\n.reconstruction-node-editor__toggle strong {\n  overflow: hidden;\n  font-size: 10px;\n  font-weight: 760;\n  letter-spacing: 0.06em;\n  text-overflow: ellipsis;\n  text-transform: uppercase;\n  white-space: nowrap;\n}\n\n.reconstruction-node-editor__toggle small {\n  margin-top: 2px;\n  overflow: hidden;\n  color: var(--blender-muted, #969696);\n  font-size: 8px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.reconstruction-node-editor__toggle .is-collapsed {\n  transform: rotate(180deg);\n}\n\n.reconstruction-node-editor__summary {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding-right: 7px;\n}\n\n.reconstruction-node-editor__summary span {\n  min-height: 22px;\n  display: inline-flex;\n  align-items: center;\n  border: 1px solid var(--blender-border-mid, #494949);\n  border-radius: 2px;\n  background: var(--blender-input, #202020);\n  padding: 2px 6px;\n  color: var(--blender-muted, #969696);\n  font-size: 8px;\n  font-weight: 700;\n}\n\n.reconstruction-node-editor__body {\n  padding: 0 !important;\n}\n\n.reconstruction-node-editor__toolbar {\n  min-height: 34px;\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  padding: 5px 7px;\n  border-bottom: 1px solid var(--blender-border, #171717);\n  background: var(--blender-section-header, #282828);\n}\n\n.reconstruction-node-editor__toolbar > button {\n  min-height: 24px;\n  padding: 3px 8px !important;\n}\n\n.reconstruction-node-editor__toolbar label {\n  min-width: 180px;\n  margin-left: auto;\n  display: grid;\n  grid-template-columns: auto minmax(80px, 150px) 38px;\n  align-items: center;\n  gap: 7px;\n  color: var(--blender-muted, #969696);\n  font-size: 8px;\n}\n\n.reconstruction-node-editor__toolbar label strong {\n  color: var(--blender-text-secondary, #c4c4c4);\n  font-size: 8px;\n  text-align: right;\n}\n\n.reconstruction-node-editor__viewport {\n  height: clamp(320px, 42vh, 540px);\n  overflow: auto;\n  background-color: #1e1e1e;\n  background-image:\n    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),\n    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),\n    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),\n    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);\n  background-position: -1px -1px;\n  background-size: 16px 16px, 16px 16px, 80px 80px, 80px 80px;\n  scrollbar-gutter: stable;\n}\n\n.reconstruction-node-editor__canvas {\n  position: relative;\n  min-width: 100%;\n  min-height: 100%;\n}\n\n.reconstruction-node-editor__scale {\n  position: absolute;\n  top: 0;\n  left: 0;\n  transform-origin: 0 0;\n}\n\n.reconstruction-node-editor__links {\n  position: absolute;\n  inset: 0;\n  overflow: visible;\n  pointer-events: none;\n}\n\n.reconstruction-node-editor__link {\n  fill: none;\n  stroke: #666;\n  stroke-width: 2;\n  vector-effect: non-scaling-stroke;\n}\n\n.reconstruction-node-editor__link.is-ready {\n  stroke: #8a8a8a;\n}\n\n.reconstruction-node-editor__link.is-pending {\n  stroke: #535353;\n  stroke-dasharray: 7 5;\n}\n\n.reconstruction-node-editor__link.is-warning {\n  stroke: #9a7651;\n  stroke-dasharray: 5 4;\n}\n\n.reconstruction-node {\n  position: absolute;\n  z-index: 2;\n  width: 190px;\n  height: 86px;\n  overflow: visible;\n  border: 1px solid #111;\n  border-radius: 3px;\n  background: #303030;\n  color: #dedede;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.05),\n    0 4px 12px rgba(0, 0, 0, 0.28);\n  cursor: grab;\n  touch-action: none;\n  user-select: none;\n}\n\n.reconstruction-node:active {\n  cursor: grabbing;\n}\n\n.reconstruction-node:focus-visible,\n.reconstruction-node.is-selected {\n  border-color: var(--blender-orange, #e8872d);\n  box-shadow:\n    inset 3px 0 0 var(--blender-orange, #e8872d),\n    0 0 0 1px rgba(232, 135, 45, 0.25),\n    0 4px 12px rgba(0, 0, 0, 0.3);\n  outline: none;\n}\n\n.reconstruction-node__header {\n  min-height: 29px;\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  padding: 5px 8px;\n  border-bottom: 1px solid #171717;\n  border-radius: 2px 2px 0 0;\n  background: #282828;\n}\n\n.reconstruction-node__header strong {\n  overflow: hidden;\n  font-size: 9px;\n  font-weight: 760;\n  letter-spacing: 0.045em;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.reconstruction-node__body {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  padding: 7px 9px;\n}\n\n.reconstruction-node__body span,\n.reconstruction-node__body small {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.reconstruction-node__body span {\n  color: #c8c8c8;\n  font-size: 9px;\n  font-weight: 700;\n}\n\n.reconstruction-node__body small {\n  margin-top: 4px;\n  color: #8d8d8d;\n  font-size: 8px;\n}\n\n.reconstruction-node__socket {\n  position: absolute;\n  top: 50%;\n  z-index: 4;\n  width: 11px;\n  height: 11px;\n  border: 2px solid #1e1e1e;\n  border-radius: 50%;\n  background: #777;\n  transform: translateY(-50%);\n  box-shadow: 0 0 0 1px #999;\n}\n\n.reconstruction-node__socket--input {\n  left: -6px;\n}\n\n.reconstruction-node__socket--output {\n  right: -6px;\n}\n\n.reconstruction-node.is-collision .reconstruction-node__socket,\n.reconstruction-node.is-physics .reconstruction-node__socket {\n  background: #9a7651;\n}\n\n.reconstruction-node.is-output .reconstruction-node__socket {\n  background: #6d846f;\n}\n\n.reconstruction-node.is-evidence .reconstruction-node__socket {\n  background: #8d7b5d;\n}\n\n@media (max-width: 900px) {\n  .reconstruction-node-editor__summary {\n    display: none;\n  }\n\n  .reconstruction-node-editor__toolbar {\n    flex-wrap: wrap;\n  }\n\n  .reconstruction-node-editor__toolbar label {\n    width: 100%;\n    margin-left: 0;\n  }\n}\n", "src/styles/blenderTotalUI.css": "/*\n * RoadSafe AR — Blender Total UI\n *\n * Final, repo-wide workstation skin. This file is intentionally imported last.\n * The Station Overview inspector is the canonical panel reference.\n *\n * Rules:\n * - charcoal editor surfaces;\n * - compact square/bevelled controls;\n * - orange only for selection/focus;\n * - restrained dark red only for destructive actions;\n * - no large blue/navy UI surfaces;\n * - semantic case-data colours may remain on tiny markers/swatches/charts.\n */\n\n:root {\n  color-scheme: dark;\n\n  --blender-shell: #1b1b1b;\n  --blender-sidebar: #242424;\n  --blender-workspace: #202020;\n  --blender-panel: #292929;\n  --blender-section: #303030;\n  --blender-section-header: #282828;\n  --blender-raised: #383838;\n  --blender-hover: #414141;\n  --blender-pressed: #252525;\n  --blender-input: #202020;\n  --blender-canvas: #181818;\n\n  --blender-border: #171717;\n  --blender-border-soft: #3c3c3c;\n  --blender-border-mid: #494949;\n  --blender-border-strong: #5c5c5c;\n\n  --blender-text: #dedede;\n  --blender-text-secondary: #c4c4c4;\n  --blender-muted: #969696;\n  --blender-disabled: #686868;\n\n  --blender-orange: #e8872d;\n  --blender-orange-soft: #6b4527;\n  --blender-orange-surface: #3b3027;\n\n  --blender-danger: #d5a5af;\n  --blender-danger-border: #5b303b;\n  --blender-danger-surface: #2d1c21;\n\n  --blender-success: #a9c4b1;\n  --blender-success-surface: #33413a;\n  --blender-warning: #c7b58d;\n  --blender-warning-surface: #463e30;\n\n  --blender-radius: 2px;\n  --blender-radius-large: 3px;\n  --blender-control-height: 28px;\n\n  /* Replace the legacy blue token family everywhere. */\n  --js-shell: var(--blender-shell);\n  --js-sidebar: var(--blender-sidebar);\n  --js-workspace: var(--blender-workspace);\n  --js-inspector: var(--blender-panel);\n  --js-panel: var(--blender-section);\n  --js-panel-raised: var(--blender-raised);\n  --js-panel-hover: var(--blender-hover);\n  --js-border-subtle: var(--blender-border);\n  --js-border-default: var(--blender-border-mid);\n  --js-border-strong: var(--blender-border-strong);\n  --js-blue-muted: var(--blender-orange);\n  --js-blue-active: var(--blender-orange);\n  --js-blue-selected: var(--blender-section);\n  --js-blue-soft-bg: var(--blender-section);\n  --js-text-primary: var(--blender-text);\n  --js-text-secondary: var(--blender-text-secondary);\n  --js-text-muted: var(--blender-muted);\n\n  --workstation-panel-surface: var(--blender-panel);\n  --workstation-panel-header: var(--blender-section-header);\n  --workstation-panel-section: var(--blender-section);\n  --workstation-panel-section-header: var(--blender-section-header);\n  --workstation-panel-raised: var(--blender-raised);\n  --workstation-input: var(--blender-input);\n  --workstation-control-top: #444;\n  --workstation-control-bottom: #343434;\n  --workstation-panel-border: var(--blender-border);\n  --workstation-panel-border-soft: var(--blender-border-soft);\n  --workstation-panel-border-strong: var(--blender-border-strong);\n  --workstation-panel-text: var(--blender-text);\n  --workstation-panel-text-secondary: var(--blender-text-secondary);\n  --workstation-panel-muted: var(--blender-muted);\n  --workstation-accent: var(--blender-orange);\n  --workstation-panel-radius: var(--blender-radius);\n}\n\nhtml,\nbody,\n#root {\n  min-height: 100%;\n  background: var(--blender-shell) !important;\n  color: var(--blender-text) !important;\n}\n\nbody {\n  scrollbar-color: #555 #222;\n  scrollbar-width: thin;\n}\n\n* {\n  box-sizing: border-box;\n}\n\n*::selection {\n  background: rgba(232, 135, 45, 0.34);\n  color: #fff;\n}\n\n*::-webkit-scrollbar {\n  width: 11px;\n  height: 11px;\n}\n\n*::-webkit-scrollbar-track {\n  background: #202020;\n}\n\n*::-webkit-scrollbar-thumb {\n  border: 2px solid #202020;\n  border-radius: 2px;\n  background: #555;\n}\n\n*::-webkit-scrollbar-thumb:hover {\n  background: #666;\n}\n\n/* --------------------------------------------------------------------------\n * Global workstation controls\n * ----------------------------------------------------------------------- */\n\nbutton,\n[role=\"button\"],\n.ui-button,\n.ui-button-primary,\n.ui-icon-button,\n.reconstruction-workspace__button,\n.reconstruction-workspace__icon-button,\n.reconstruction-timeline button,\n.reconstruction-playback button {\n  border: 1px solid var(--blender-border-mid) !important;\n  border-radius: var(--blender-radius) !important;\n  background:\n    linear-gradient(180deg, #444 0%, #343434 100%) !important;\n  color: var(--blender-text-secondary) !important;\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.07),\n    inset 0 -1px 0 rgba(0, 0, 0, 0.5) !important;\n  text-shadow: none !important;\n  transition:\n    border-color 90ms ease,\n    background-color 90ms ease,\n    color 90ms ease,\n    transform 70ms ease !important;\n}\n\nbutton:hover:not(:disabled),\n[role=\"button\"]:hover,\n.ui-button:hover,\n.ui-button-primary:hover,\n.ui-icon-button:hover {\n  border-color: #666 !important;\n  background:\n    linear-gradient(180deg, #4c4c4c 0%, #3b3b3b 100%) !important;\n  color: #fff !important;\n}\n\nbutton:active:not(:disabled),\n[role=\"button\"]:active {\n  background:\n    linear-gradient(180deg, #2d2d2d 0%, #393939 100%) !important;\n  transform: translateY(1px);\n}\n\nbutton:focus-visible,\na:focus-visible,\n[role=\"button\"]:focus-visible,\ninput:focus-visible,\nselect:focus-visible,\ntextarea:focus-visible,\nsummary:focus-visible {\n  border-color: var(--blender-orange) !important;\n  outline: none !important;\n  box-shadow: 0 0 0 1px var(--blender-orange) !important;\n}\n\nbutton:disabled,\n.ui-button:disabled,\n.ui-button-primary:disabled,\n.ui-icon-button:disabled {\n  border-color: #383838 !important;\n  background: #2b2b2b !important;\n  color: var(--blender-disabled) !important;\n  box-shadow: none !important;\n  opacity: 0.72 !important;\n  cursor: not-allowed !important;\n}\n\nbutton.is-active,\n[aria-pressed=\"true\"],\n.ui-button-primary,\n.reconstruction-workspace__view-switch button.is-active,\n.reconstruction-workspace__tools button.is-active,\n.reconstruction-timeline button.is-active {\n  border-color: var(--blender-orange) !important;\n  background:\n    linear-gradient(180deg, #46413d 0%, #39332f 100%) !important;\n  color: #fff !important;\n  box-shadow:\n    inset 3px 0 0 var(--blender-orange),\n    inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;\n}\n\n.is-danger,\nbutton[class*=\"delete\"],\nbutton[class*=\"danger\"],\n.reconstruction-workspace__delete-participant,\n.reconstruction-timeline__delete {\n  border-color: var(--blender-danger-border) !important;\n  background:\n    linear-gradient(180deg, #38242a, var(--blender-danger-surface)) !important;\n  color: var(--blender-danger) !important;\n}\n\n.is-danger:hover,\nbutton[class*=\"delete\"]:hover,\nbutton[class*=\"danger\"]:hover {\n  border-color: #74414d !important;\n  background:\n    linear-gradient(180deg, #432a31, #332026) !important;\n  color: #f0c2ca !important;\n}\n\ninput:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"range\"]),\nselect,\ntextarea,\n.ui-input {\n  min-height: var(--blender-control-height);\n  border: 1px solid var(--blender-border-mid) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-input) !important;\n  color: var(--blender-text) !important;\n  box-shadow:\n    inset 0 1px 2px rgba(0, 0, 0, 0.5) !important;\n  caret-color: var(--blender-orange);\n}\n\ninput::placeholder,\ntextarea::placeholder {\n  color: #6f6f6f !important;\n}\n\nselect {\n  color-scheme: dark;\n}\n\nselect option {\n  background: #292929;\n  color: var(--blender-text);\n}\n\ninput[type=\"checkbox\"],\ninput[type=\"radio\"] {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n  border: 1px solid var(--blender-border-strong);\n  border-radius: 2px;\n  background: var(--blender-input);\n  accent-color: var(--blender-orange) !important;\n}\n\ninput[type=\"range\"],\n.roadsafe-range {\n  height: 18px;\n  appearance: none;\n  background: transparent !important;\n  accent-color: var(--blender-orange) !important;\n}\n\ninput[type=\"range\"]::-webkit-slider-runnable-track {\n  height: 5px;\n  border: 1px solid #111;\n  border-radius: 2px;\n  background: #555;\n  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.55);\n}\n\ninput[type=\"range\"]::-webkit-slider-thumb {\n  width: 14px;\n  height: 14px;\n  margin-top: -5px;\n  appearance: none;\n  border: 1px solid #222;\n  border-radius: 50%;\n  background: var(--blender-orange);\n  box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.18),\n    0 1px 2px rgba(0, 0, 0, 0.45);\n}\n\ninput[type=\"range\"]::-moz-range-track {\n  height: 5px;\n  border: 1px solid #111;\n  border-radius: 2px;\n  background: #555;\n}\n\ninput[type=\"range\"]::-moz-range-thumb {\n  width: 14px;\n  height: 14px;\n  border: 1px solid #222;\n  border-radius: 50%;\n  background: var(--blender-orange);\n}\n\nfieldset,\n.ui-panel,\n.workstation-panel,\n.roadsafe-inspector,\n.roadsafe-bottom-panel,\nsection[class*=\"panel\"],\narticle[class*=\"card\"],\ndetails[class*=\"card\"] {\n  border-color: var(--blender-border) !important;\n  border-radius: var(--blender-radius-large) !important;\n  background: var(--blender-panel) !important;\n  color: var(--blender-text) !important;\n  box-shadow: none !important;\n}\n\nhr,\n[class*=\"divider\"],\n[class*=\"separator\"] {\n  border-color: var(--blender-border) !important;\n}\n\n/* --------------------------------------------------------------------------\n * Repo-wide neutralisation of old blue/navy utility UI\n * Inline semantic colours on vehicles, evidence, charts and scene meshes are\n * deliberately not touched.\n * ----------------------------------------------------------------------- */\n\n[class*=\"bg-blue-\"],\n[class*=\"bg-indigo-\"],\n[class*=\"bg-sky-\"],\n[class*=\"bg-cyan-\"],\n[class*=\"bg-purple-\"],\n[class*=\"bg-violet-\"],\n[class*=\"hover:bg-blue-\"],\n[class*=\"hover:bg-indigo-\"],\n[class*=\"hover:bg-sky-\"],\n[class*=\"hover:bg-cyan-\"],\n[class*=\"hover:bg-purple-\"],\n[class*=\"hover:bg-violet-\"],\n[class*=\"bg-[#02\"],\n[class*=\"bg-[#03\"],\n[class*=\"bg-[#04\"],\n[class*=\"bg-[#05\"],\n[class*=\"bg-[#06\"],\n[class*=\"bg-[#07\"],\n[class*=\"bg-[#08\"],\n[class*=\"bg-[#09\"],\n[class*=\"bg-[#0a\"],\n[class*=\"bg-[#0b\"],\n[class*=\"bg-[#0c\"],\n[class*=\"bg-[#0d\"],\n[class*=\"bg-[#10\"],\n[class*=\"bg-[#11\"],\n[class*=\"bg-[#12\"],\n[class*=\"bg-[#17\"] {\n  background-color: var(--blender-section) !important;\n  background-image: none !important;\n}\n\n[class*=\"text-blue-\"],\n[class*=\"text-indigo-\"],\n[class*=\"text-sky-\"],\n[class*=\"text-cyan-\"],\n[class*=\"text-purple-\"],\n[class*=\"text-violet-\"],\n[class*=\"text-[#7f\"],\n[class*=\"text-[#80\"],\n[class*=\"text-[#8e\"],\n[class*=\"text-[#8b\"] {\n  color: var(--blender-text-secondary) !important;\n}\n\n[class*=\"border-blue-\"],\n[class*=\"border-indigo-\"],\n[class*=\"border-sky-\"],\n[class*=\"border-cyan-\"],\n[class*=\"border-purple-\"],\n[class*=\"border-violet-\"],\n[class*=\"border-[#1a2\"],\n[class*=\"border-[#1b3\"],\n[class*=\"border-[#203\"],\n[class*=\"border-[#284\"],\n[class*=\"border-[#294\"],\n[class*=\"border-[#2a3\"],\n[class*=\"border-[#315\"] {\n  border-color: var(--blender-border-mid) !important;\n}\n\n[class*=\"ring-blue-\"],\n[class*=\"ring-indigo-\"],\n[class*=\"ring-sky-\"],\n[class*=\"ring-cyan-\"],\n[class*=\"ring-purple-\"],\n[class*=\"ring-violet-\"] {\n  --tw-ring-color: var(--blender-orange) !important;\n}\n\n[class*=\"rounded-xl\"],\n[class*=\"rounded-2xl\"],\n[class*=\"rounded-3xl\"] {\n  border-radius: var(--blender-radius-large) !important;\n}\n\n[class*=\"shadow-xl\"],\n[class*=\"shadow-2xl\"],\n[class*=\"backdrop-blur\"] {\n  backdrop-filter: none !important;\n  box-shadow: none !important;\n}\n\n/* --------------------------------------------------------------------------\n * Navigation, shell, pages, tables and dialogs\n * ----------------------------------------------------------------------- */\n\n.roadsafe-workstation,\n.roadsafe-center,\n.roadsafe-center-content,\nmain {\n  background: var(--blender-workspace) !important;\n}\n\n.roadsafe-navigation {\n  border-right-color: var(--blender-border) !important;\n  background: var(--blender-sidebar) !important;\n}\n\n.roadsafe-navigation-link {\n  border-radius: var(--blender-radius) !important;\n  background: transparent !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.roadsafe-navigation-link:hover {\n  border-color: var(--blender-border-mid) !important;\n  background: var(--blender-section) !important;\n}\n\n.roadsafe-navigation-link.is-active {\n  border-color: var(--blender-orange) !important;\n  background: var(--blender-raised) !important;\n  color: #fff !important;\n  box-shadow: inset 3px 0 0 var(--blender-orange) !important;\n}\n\n.roadsafe-navigation-link.is-active::before {\n  display: none !important;\n}\n\n.roadsafe-center-header,\n.roadsafe-page-toolbar,\n.roadsafe-navigation-brand,\n.roadsafe-inspector-header {\n  border-color: var(--blender-border) !important;\n  background:\n    linear-gradient(180deg, #303030, #272727) !important;\n}\n\n.roadsafe-brand-mark,\n.dashboard-material-stat-icon {\n  border-color: var(--blender-border-strong) !important;\n  background: var(--blender-section) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.roadsafe-inspector,\n.workstation-panel {\n  background: var(--blender-panel) !important;\n}\n\n.roadsafe-inspector-section,\n.workstation-panel__section {\n  border: 1px solid var(--blender-border) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-section) !important;\n}\n\n.roadsafe-inspector-section-heading,\n.workstation-panel__section-heading,\n.roadsafe-bottom-panel__header,\n.roadsafe-bottom-panel__footer {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section-header) !important;\n}\n\ntable,\n[role=\"table\"] {\n  border-collapse: collapse;\n  border: 1px solid var(--blender-border) !important;\n  background: var(--blender-panel) !important;\n}\n\nth,\n[role=\"columnheader\"] {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section-header) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\ntd,\n[role=\"cell\"] {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\ntr:hover td {\n  background: var(--blender-hover) !important;\n}\n\n[role=\"dialog\"],\n[class*=\"modal__panel\"],\n[class*=\"dialog__panel\"] {\n  border: 1px solid var(--blender-border-strong) !important;\n  border-radius: var(--blender-radius-large) !important;\n  background: var(--blender-panel) !important;\n  color: var(--blender-text) !important;\n  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.48) !important;\n}\n\n[class*=\"modal\"]:has(> [class*=\"panel\"]) {\n  background: rgba(0, 0, 0, 0.58) !important;\n  backdrop-filter: none !important;\n}\n\n/* --------------------------------------------------------------------------\n * Reconstruction 2D/3D/AR workstation\n * ----------------------------------------------------------------------- */\n\n.reconstruction-editor,\n.reconstruction-workspace,\n.reconstruction-workspace__body,\n.reconstruction-workspace__stage-grid,\n.reconstruction-workspace__2d-grid {\n  background: var(--blender-workspace) !important;\n  color: var(--blender-text) !important;\n}\n\n.reconstruction-workspace__header,\n.reconstruction-workspace__toolbar {\n  border-color: var(--blender-border) !important;\n  background:\n    linear-gradient(180deg, #333, #292929) !important;\n}\n\n.reconstruction-workspace__view-switch {\n  border: 1px solid var(--blender-border) !important;\n  border-radius: var(--blender-radius) !important;\n  background: #202020 !important;\n  padding: 2px !important;\n}\n\n.reconstruction-workspace__view-switch button {\n  min-height: 27px;\n  border-color: transparent !important;\n  background: transparent !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-workspace__view-switch button.is-active {\n  border-color: var(--blender-orange) !important;\n  background: var(--blender-raised) !important;\n}\n\n.reconstruction-workspace__canvas,\n.reconstruction-3d,\n.reconstruction-workspace__stage-main {\n  border-color: var(--blender-border) !important;\n  border-radius: var(--blender-radius-large) !important;\n  background: var(--blender-canvas) !important;\n}\n\n.reconstruction-workspace__tools {\n  border: 1px solid var(--blender-border) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-panel) !important;\n  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35) !important;\n}\n\n.reconstruction-workspace__tools button {\n  border: 0 !important;\n  border-bottom: 1px solid var(--blender-border) !important;\n  border-radius: 0 !important;\n  background: transparent !important;\n  color: var(--blender-muted) !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-workspace__tools button:last-child {\n  border-bottom: 0 !important;\n}\n\n.reconstruction-workspace__tools button:hover {\n  background: var(--blender-hover) !important;\n  color: var(--blender-text) !important;\n}\n\n.reconstruction-workspace__tools button.is-active {\n  border-left: 3px solid var(--blender-orange) !important;\n  background: var(--blender-raised) !important;\n  color: #fff !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-workspace__tool-hint,\n.reconstruction-workspace__map-controls,\n.reconstruction-workspace__loading {\n  border: 1px solid var(--blender-border-strong) !important;\n  border-radius: var(--blender-radius) !important;\n  background: rgba(42, 42, 42, 0.96) !important;\n  color: var(--blender-text-secondary) !important;\n  backdrop-filter: none !important;\n  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35) !important;\n}\n\n.reconstruction-workspace__map-controls button {\n  min-width: 35px;\n  min-height: 35px;\n  padding: 3px !important;\n}\n\n.reconstruction-workspace__2d-viewport {\n  border-color: var(--blender-border) !important;\n  background-color: #464f43 !important;\n}\n\n.reconstruction-workspace__panel-header,\n.reconstruction-workspace__context-title,\n.reconstruction-workspace__workspace-card-header,\n.premium-investigation-card__header,\n.reconstruction-timeline__header {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section-header) !important;\n  color: var(--blender-text) !important;\n}\n\n.reconstruction-workspace__properties,\n.reconstruction-workspace__context-panel,\n.reconstruction-workspace__participant-roster,\n.reconstruction-workspace__context-section,\n.reconstruction-workspace__workspace-card,\n.premium-investigation-card,\n.reconstruction-playback,\n.reconstruction-timeline {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-panel) !important;\n  color: var(--blender-text) !important;\n  box-shadow: none !important;\n}\n\n.reconstruction-workspace__participant-list button,\n.reconstruction-workspace__segmented-grid button,\n.reconstruction-workspace__layer-list label,\n.reconstruction-workspace__property-list > div,\n.reconstruction-workspace__telemetry-grid > div {\n  border: 1px solid var(--blender-border-soft) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-section) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.reconstruction-workspace__participant-list button.is-active,\n.reconstruction-workspace__segmented-grid button.is-active {\n  border-color: var(--blender-orange) !important;\n  background: var(--blender-raised) !important;\n  box-shadow: inset 3px 0 0 var(--blender-orange) !important;\n}\n\n.reconstruction-workspace__participant-points,\n.ui-badge,\n[class*=\"badge\"] {\n  border: 1px solid var(--blender-border-mid) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-input) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.reconstruction-playback,\n.reconstruction-timeline,\n.reconstruction-workspace__workspace-panels,\n.reconstruction-workspace__modules,\n.reconstruction-node-editor {\n  margin-inline: 8px;\n}\n\n.reconstruction-playback,\n.reconstruction-timeline,\n.reconstruction-workspace__workspace-panels,\n.premium-investigation-card {\n  border-radius: var(--blender-radius-large) !important;\n}\n\n.reconstruction-playback__scrubber,\n.reconstruction-timeline__scrubber,\n.reconstruction-timeline__viewport,\n.reconstruction-timeline__inspector,\n.reconstruction-timeline__labels,\n.reconstruction-timeline__surface,\n.reconstruction-timeline__track,\n.reconstruction-timeline__ruler {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-panel) !important;\n}\n\n.reconstruction-timeline__label,\n.reconstruction-timeline__track {\n  border-color: var(--blender-border) !important;\n}\n\n.reconstruction-timeline__marker {\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-raised) !important;\n}\n\n.reconstruction-timeline__marker.is-selected {\n  border-color: var(--blender-orange) !important;\n  box-shadow: 0 0 0 1px var(--blender-orange) !important;\n}\n\n.reconstruction-workspace__workspace-panels-toggle,\n.premium-investigation-card__header {\n  width: 100%;\n  min-height: 34px;\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section-header) !important;\n  text-align: left;\n}\n\n.reconstruction-workspace__workspace-panels-content,\n.reconstruction-workspace__modules {\n  gap: 8px !important;\n  background: var(--blender-workspace) !important;\n}\n\n.reconstruction-workspace__workspace-card-scroll,\n.reconstruction-workspace__embedded-panel,\n.premium-investigation-card__body,\n.premium-audit-metric,\n.premium-physics-card__metrics > div,\n.premium-hypotheses-card__row,\n.premium-documentation-card__rows > div {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section) !important;\n}\n\n.premium-investigation-card__number,\n.reconstruction-workspace__workspace-card-icon,\n.reconstruction-workspace__workspace-panels-icon {\n  border: 1px solid var(--blender-border-strong) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-raised) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.premium-investigation-card__action {\n  border-color: var(--blender-border-mid) !important;\n  background:\n    linear-gradient(180deg, #444, #343434) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.reconstruction-detail-modal__panel,\n.reconstruction-detail-modal__header,\n.reconstruction-detail-modal__body,\n.attached-officer-notes,\n.attached-reconstruction-guide {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-panel) !important;\n}\n\n/* 3D view chrome. Keep the actual WebGL scene and participant colours. */\n.reconstruction-3d {\n  background: var(--blender-panel) !important;\n}\n\n.reconstruction-3d > div[class*=\"bg-[#03\"],\n.reconstruction-3d > div[class*=\"bg-[#05\"],\n.reconstruction-3d [class*=\"backdrop-blur\"] {\n  background: rgba(42, 42, 42, 0.92) !important;\n  backdrop-filter: none !important;\n}\n\n/* AR view chrome. Camera/video content remains untouched. */\n.roadsafe-ar-workstation,\n.roadsafe-ar-workstation > div[class*=\"overflow-y-auto\"] {\n  background: var(--blender-shell) !important;\n}\n\n.roadsafe-ar-workstation .ui-panel,\n.roadsafe-ar-workstation article,\n.roadsafe-ar-workstation section,\n.roadsafe-ar-workstation [class*=\"rounded-md\"] {\n  border-color: var(--blender-border-mid) !important;\n  background: var(--blender-panel) !important;\n  color: var(--blender-text) !important;\n  box-shadow: none !important;\n}\n\n.roadsafe-ar-workstation [class*=\"absolute\"][class*=\"z-30\"],\n.roadsafe-ar-workstation [class*=\"absolute\"][class*=\"z-40\"] {\n  color: var(--blender-text) !important;\n}\n\n/* --------------------------------------------------------------------------\n * Objects, Hazards & Evidence — Outliner-like checkbox palette\n * ----------------------------------------------------------------------- */\n\n.blender-object-palette {\n  padding: 0;\n  color: var(--blender-text-secondary);\n}\n\n.blender-object-palette__intro {\n  padding: 7px 8px;\n  border-bottom: 1px solid var(--blender-border);\n  background: var(--blender-section-header);\n}\n\n.blender-object-palette__intro p {\n  margin: 0;\n  color: var(--blender-muted);\n  font-size: 9px;\n  line-height: 1.45;\n}\n\n.blender-object-palette__active {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  margin: 7px;\n  padding: 6px;\n  border: 1px solid var(--blender-orange);\n  border-radius: var(--blender-radius);\n  background: var(--blender-orange-surface);\n  box-shadow: inset 3px 0 0 var(--blender-orange);\n}\n\n.blender-object-palette__active-copy,\n.blender-object-palette__active-actions {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.blender-object-palette__active-copy > span:last-child,\n.blender-object-option__copy {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n}\n\n.blender-object-palette__active-copy strong,\n.blender-object-option__copy strong {\n  overflow: hidden;\n  color: var(--blender-text);\n  font-size: 9px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.blender-object-palette__active-copy small,\n.blender-object-option__copy small {\n  margin-top: 1px;\n  color: var(--blender-muted);\n  font-size: 8px;\n}\n\n.blender-object-palette__active-icon,\n.blender-object-option__icon {\n  width: 24px;\n  height: 24px;\n  flex: 0 0 24px;\n  display: grid;\n  place-items: center;\n  color: var(--blender-text-secondary);\n}\n\n.blender-object-palette__active-actions button {\n  min-height: 26px;\n  padding: 3px 7px !important;\n}\n\n.blender-object-palette__categories {\n  border-top: 1px solid var(--blender-border);\n}\n\n.blender-object-category {\n  border-bottom: 1px solid var(--blender-border);\n  background: var(--blender-panel);\n}\n\n.blender-object-category > summary,\n.blender-placed-objects__header {\n  min-height: 29px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 5px 8px;\n  background: var(--blender-section-header);\n  color: var(--blender-text-secondary);\n  font-size: 9px;\n  font-weight: 760;\n  letter-spacing: 0.05em;\n  text-transform: uppercase;\n  cursor: pointer;\n}\n\n.blender-object-category > summary::marker {\n  color: var(--blender-muted);\n}\n\n.blender-object-category > summary small,\n.blender-placed-objects__header small {\n  min-width: 22px;\n  padding: 2px 5px;\n  border: 1px solid var(--blender-border-mid);\n  border-radius: var(--blender-radius);\n  background: var(--blender-input);\n  color: var(--blender-muted);\n  text-align: center;\n}\n\n.blender-object-category__items,\n.blender-placed-objects__list {\n  display: grid;\n  padding: 3px;\n}\n\n.blender-object-option,\n.blender-placed-object {\n  min-height: 31px;\n  display: grid;\n  grid-template-columns: 16px 24px minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 5px;\n  padding: 3px 6px;\n  border: 1px solid transparent;\n  border-radius: var(--blender-radius);\n  background: transparent;\n  cursor: pointer;\n}\n\n.blender-object-option:hover,\n.blender-placed-object:hover {\n  border-color: var(--blender-border-soft);\n  background: var(--blender-hover);\n}\n\n.blender-object-option.is-active,\n.blender-placed-object.is-selected {\n  border-color: var(--blender-orange);\n  background: var(--blender-raised);\n  box-shadow: inset 3px 0 0 var(--blender-orange);\n}\n\n.blender-object-option > input,\n.blender-placed-object > input {\n  position: absolute;\n  opacity: 0;\n  pointer-events: none;\n}\n\n.blender-object-option__check {\n  width: 14px;\n  height: 14px;\n  display: grid;\n  place-items: center;\n  border: 1px solid var(--blender-border-strong);\n  border-radius: 2px;\n  background: var(--blender-input);\n  color: #fff;\n}\n\n.is-active > .blender-object-option__check,\n.is-selected > .blender-object-option__check {\n  border-color: var(--blender-orange);\n  background: var(--blender-orange);\n}\n\n.blender-object-option__count {\n  min-width: 22px;\n  padding: 2px 5px;\n  border: 1px solid var(--blender-border-mid);\n  border-radius: var(--blender-radius);\n  background: var(--blender-input);\n  color: var(--blender-muted);\n  font-size: 8px;\n  text-align: center;\n}\n\n.blender-placed-objects {\n  border-top: 1px solid var(--blender-border);\n}\n\n.blender-placed-objects__header span {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.blender-placed-objects__empty {\n  margin: 5px;\n  padding: 12px 8px;\n  border: 1px dashed var(--blender-border-mid);\n  color: var(--blender-muted);\n  font-size: 9px;\n  text-align: center;\n}\n\n.blender-placed-objects__footer {\n  padding: 5px 7px;\n  border-top: 1px solid var(--blender-border);\n  background: var(--blender-section-header);\n}\n\n.blender-placed-objects__footer button {\n  width: 100%;\n  min-height: 27px;\n}\n\n/* --------------------------------------------------------------------------\n * Route inspector: Station Overview language, no blue panels\n * ----------------------------------------------------------------------- */\n\n.roadsafe-route-inspector {\n  color: var(--blender-text-secondary);\n  font-size: 9px;\n}\n\n.roadsafe-route-inspector__section,\n.roadsafe-route-point-card,\n.roadsafe-route-inspector__metric,\n.roadsafe-route-inspector__message,\n.roadsafe-route-inspector__notice,\n.roadsafe-route-inspector__gps-box,\n.roadsafe-route-inspector__read-only-box,\n.roadsafe-route-inspector__physics-grid > div {\n  border: 1px solid var(--blender-border) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-section) !important;\n  color: var(--blender-text-secondary) !important;\n  box-shadow: none !important;\n}\n\n.roadsafe-route-inspector__section {\n  margin: 5px 0 0;\n  padding: 7px;\n}\n\n.roadsafe-route-inspector__section:first-of-type {\n  margin-top: 0;\n}\n\n.roadsafe-route-inspector__heading {\n  color: var(--blender-text-secondary) !important;\n  font-size: 9px !important;\n}\n\n.roadsafe-route-inspector__description,\n.roadsafe-route-inspector small {\n  color: var(--blender-muted) !important;\n}\n\n.roadsafe-route-inspector__badge,\n.roadsafe-route-inspector__chip,\n.roadsafe-route-action,\n.roadsafe-route-point-card__status {\n  border-color: var(--blender-border-mid) !important;\n  background: var(--blender-input) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n.roadsafe-route-inspector__toolbar,\n.roadsafe-route-inspector__edit-actions,\n.roadsafe-route-inspector__direction-grid {\n  gap: 4px !important;\n}\n\n.roadsafe-route-point-card {\n  padding: 6px !important;\n}\n\n.roadsafe-route-point-card.is-selected {\n  border-color: var(--blender-orange) !important;\n  background: var(--blender-raised) !important;\n  box-shadow: inset 3px 0 0 var(--blender-orange) !important;\n}\n\n.roadsafe-route-point-card__diamond,\nbutton[data-roadsafe-route-diamond=\"true\"] {\n  border-color: var(--blender-orange) !important;\n  background: var(--blender-raised) !important;\n}\n\n.roadsafe-participant-header-actions {\n  border-color: var(--blender-border) !important;\n  background: var(--blender-section-header) !important;\n}\n\n.roadsafe-participant-header-actions__button,\n.roadsafe-participant-header-actions__icon {\n  border-color: var(--blender-border-mid) !important;\n  background: var(--blender-raised) !important;\n  color: var(--blender-text-secondary) !important;\n}\n\n/* --------------------------------------------------------------------------\n * Motion and animation feedback\n * ----------------------------------------------------------------------- */\n\n@keyframes blender-selected-pulse {\n  0%, 100% {\n    box-shadow: 0 0 0 0 rgba(232, 135, 45, 0.18);\n  }\n  50% {\n    box-shadow: 0 0 0 3px rgba(232, 135, 45, 0.1);\n  }\n}\n\n[aria-busy=\"true\"],\n.is-loading,\n.material-symbols-outlined[class*=\"Loader\"] {\n  animation: blender-selected-pulse 1.1s ease-in-out infinite;\n}\n\n.reconstruction-workspace__toast {\n  border: 1px solid var(--blender-border-strong) !important;\n  border-left: 3px solid var(--blender-orange) !important;\n  border-radius: var(--blender-radius) !important;\n  background: var(--blender-panel) !important;\n  color: var(--blender-text) !important;\n}\n\n.reconstruction-workspace__toast.is-error {\n  border-left-color: #a55463 !important;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *,\n  *::before,\n  *::after {\n    scroll-behavior: auto !important;\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n  }\n}\n\n@media (max-width: 900px) {\n  .reconstruction-playback,\n  .reconstruction-timeline,\n  .reconstruction-workspace__workspace-panels,\n  .reconstruction-workspace__modules,\n  .reconstruction-node-editor {\n    margin-inline: 4px;\n  }\n\n  .blender-object-option,\n  .blender-placed-object {\n    min-height: 36px;\n  }\n}\n", "src/styles/workstationPanelSystem.css": "/*\n * RoadSafe canonical workstation panel system\n *\n * Source of truth: Station Overview -> Context inspector / Active investigation.\n * Every right panel, bottom panel, timeline, playback strip and node editor\n * must consume this system. Large navy/blue UI surfaces are prohibited.\n */\n\n:root {\n  --workstation-panel-surface: #292929;\n  --workstation-panel-header: #202020;\n  --workstation-panel-section: #303030;\n  --workstation-panel-section-header: #282828;\n  --workstation-panel-raised: #383838;\n  --workstation-input: #202020;\n  --workstation-control-top: #444444;\n  --workstation-control-bottom: #343434;\n  --workstation-panel-border: #171717;\n  --workstation-panel-border-soft: #3c3c3c;\n  --workstation-panel-border-strong: #555555;\n  --workstation-panel-text: #d6d6d6;\n  --workstation-panel-text-secondary: #c4c4c4;\n  --workstation-panel-muted: #929292;\n  --workstation-accent: #e8872d;\n  --workstation-danger-border: #5b303b;\n  --workstation-danger-surface: #2d1c21;\n  --workstation-danger-text: #dba9b4;\n  --workstation-panel-radius: 2px;\n}\n\n.workstation-panel,\n.roadsafe-inspector,\n.roadsafe-bottom-panel {\n  overflow: hidden;\n  border: 1px solid var(--workstation-panel-border);\n  border-radius: var(--workstation-panel-radius);\n  background: var(--workstation-panel-surface);\n  color: var(--workstation-panel-text);\n}\n\n.workstation-panel__header,\n.roadsafe-inspector-header,\n.roadsafe-bottom-panel__header {\n  min-height: 34px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 5px 7px;\n  border-bottom: 1px solid var(--workstation-panel-border);\n  background: var(--workstation-panel-header);\n}\n\n.workstation-panel__scroll,\n.roadsafe-inspector-scroll,\n.roadsafe-bottom-panel__body {\n  min-height: 0;\n  background: var(--workstation-panel-surface);\n}\n\n.roadsafe-inspector-scroll {\n  overflow-x: hidden;\n  overflow-y: auto;\n}\n\n.workstation-panel__section,\n.roadsafe-inspector-section {\n  overflow: hidden;\n  border: 1px solid var(--workstation-panel-border);\n  border-radius: var(--workstation-panel-radius);\n  background: var(--workstation-panel-section);\n}\n\n.workstation-panel__section-heading,\n.roadsafe-inspector-section-heading,\n.roadsafe-bottom-panel__section-heading {\n  min-height: 29px;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 5px 7px;\n  border-bottom: 1px solid var(--workstation-panel-border);\n  background: var(--workstation-panel-section-header);\n  color: var(--workstation-panel-text-secondary);\n  font-size: 9px;\n  font-weight: 760;\n  letter-spacing: 0.055em;\n  text-transform: uppercase;\n}\n\n.workstation-panel__section-body,\n.roadsafe-inspector-section-body {\n  padding: 7px;\n}\n\n.workstation-panel__footer,\n.roadsafe-inspector-footer,\n.roadsafe-bottom-panel__footer {\n  min-height: 30px;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 5px 7px;\n  border-top: 1px solid var(--workstation-panel-border);\n  background: var(--workstation-panel-section-header);\n}\n\n.workstation-panel__row {\n  min-height: 29px;\n  display: grid;\n  grid-template-columns: minmax(90px, 0.9fr) minmax(0, 1.1fr);\n  align-items: center;\n  gap: 8px;\n  padding: 5px 7px;\n  border-bottom: 1px solid var(--workstation-panel-border);\n  color: var(--workstation-panel-muted);\n  font-size: 9px;\n}\n\n.workstation-panel__row:last-child {\n  border-bottom: 0;\n}\n\n.workstation-panel__row > :last-child {\n  min-width: 0;\n  color: var(--workstation-panel-text-secondary);\n  text-align: right;\n}\n\n.workstation-panel__control {\n  min-height: 27px;\n  border: 1px solid var(--workstation-panel-border-strong);\n  border-radius: var(--workstation-panel-radius);\n  background:\n    linear-gradient(\n      180deg,\n      var(--workstation-control-top),\n      var(--workstation-control-bottom)\n    );\n  color: var(--workstation-panel-text-secondary);\n}\n\n.workstation-panel__control.is-selected {\n  border-color: var(--workstation-accent);\n  background: var(--workstation-panel-raised);\n  box-shadow: inset 3px 0 0 var(--workstation-accent);\n}\n\n.workstation-panel :is(button, a, input, select, textarea):focus-visible,\n.roadsafe-inspector :is(button, a, input, select, textarea):focus-visible,\n.roadsafe-bottom-panel :is(button, a, input, select, textarea):focus-visible {\n  border-color: var(--workstation-accent) !important;\n  outline: none;\n  box-shadow: 0 0 0 1px var(--workstation-accent) !important;\n}\n\n.workstation-panel__danger {\n  border-color: var(--workstation-danger-border) !important;\n  background: var(--workstation-danger-surface) !important;\n  color: var(--workstation-danger-text) !important;\n}\n", "scripts/verify-blender-ui.mjs": "import fs from \"node:fs\";\nimport path from \"node:path\";\n\nconst root = process.cwd();\nconst srcRoot = path.join(root, \"src\");\nconst failures = [];\nconst warnings = [];\n\nfunction requireFile(relativePath) {\n  const absolutePath = path.join(root, relativePath);\n  if (!fs.existsSync(absolutePath)) {\n    failures.push(`Missing required file: ${relativePath}`);\n    return \"\";\n  }\n  return fs.readFileSync(absolutePath, \"utf8\");\n}\n\nfunction walk(directory) {\n  if (!fs.existsSync(directory)) return [];\n  const output = [];\n  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {\n    const absolutePath = path.join(directory, entry.name);\n    if (entry.isDirectory()) {\n      output.push(...walk(absolutePath));\n    } else if (entry.isFile()) {\n      output.push(absolutePath);\n    }\n  }\n  return output;\n}\n\nconst mainSource = requireFile(\"src/main.tsx\");\nconst totalThemeSource = requireFile(\"src/styles/blenderTotalUI.css\");\nconst panelSource = requireFile(\"src/styles/workstationPanelSystem.css\");\nconst nodeSource = requireFile(\n  \"src/components/reconstruction/ReconstructionNodeEditor.tsx\",\n);\nconst nodeCssSource = requireFile(\n  \"src/styles/reconstructionNodeEditor.css\",\n);\nconst paletteSource = requireFile(\n  \"src/components/reconstruction/SceneObjectPalette.tsx\",\n);\nconst editorSource = requireFile(\n  \"src/components/reconstruction/AccidentReconstructionEditor.tsx\",\n);\nconst arSource = requireFile(\n  \"src/components/reconstruction/ar/ARReconstructionViewer.tsx\",\n);\n\nconst cssImports = Array.from(\n  mainSource.matchAll(/^import\\s+[\"']([^\"']+\\.css)[\"'];?$/gm),\n  (match) => match[1],\n);\n\nif (cssImports.at(-1) !== \"./styles/blenderTotalUI.css\") {\n  failures.push(\n    \"src/styles/blenderTotalUI.css must be the final CSS import in src/main.tsx.\",\n  );\n}\n\nfor (const token of [\n  \"--blender-orange: #e8872d\",\n  \"--js-blue-active: var(--blender-orange)\",\n  \"input[type=\\\"range\\\"]::-webkit-slider-thumb\",\n  \".roadsafe-navigation-link.is-active\",\n  \".roadsafe-ar-workstation\",\n  \".blender-object-option\",\n  \".roadsafe-route-inspector\",\n]) {\n  if (!totalThemeSource.includes(token)) {\n    failures.push(`blenderTotalUI.css is missing required rule: ${token}`);\n  }\n}\n\nif (!panelSource.includes(\"Station Overview\")) {\n  failures.push(\n    \"workstationPanelSystem.css must document Station Overview as the canonical panel source.\",\n  );\n}\n\nfor (const token of [\n  \"ReconstructionNodeEditor\",\n  \"nodeEditorOpen\",\n  \"<ReconstructionNodeEditor\",\n]) {\n  if (!editorSource.includes(token)) {\n    failures.push(\n      `AccidentReconstructionEditor.tsx is missing node integration token: ${token}`,\n    );\n  }\n}\n\nfor (const token of [\n  \"reconstruction-node-editor\",\n  \"onPointerMove\",\n  \"NodeConnection\",\n]) {\n  if (!nodeSource.includes(token)) {\n    failures.push(`ReconstructionNodeEditor.tsx is missing: ${token}`);\n  }\n}\n\nif (!nodeCssSource.includes(\"--blender-orange\")) {\n  failures.push(\"The reconstruction node editor is not using Blender tokens.\");\n}\n\nfor (const token of [\n  'type=\"checkbox\"',\n  \"material-symbols-outlined\",\n  \"blender-object-option\",\n  \"MATERIAL_SYMBOL_BY_TYPE\",\n]) {\n  if (!paletteSource.includes(token)) {\n    failures.push(`SceneObjectPalette.tsx is missing: ${token}`);\n  }\n}\n\nif (!arSource.includes(\"roadsafe-ar-workstation\")) {\n  failures.push(\n    \"ARReconstructionViewer.tsx is missing the Blender workstation root hook.\",\n  );\n}\n\nconst sourceFiles = walk(srcRoot).filter(\n  (absolutePath) =>\n    /\\.(?:ts|tsx|js|jsx|css)$/.test(absolutePath) &&\n    path.basename(absolutePath) !== \"blenderTotalUI.css\",\n);\n\nlet legacyCoolUtilityCount = 0;\nlet legacyNavyUtilityCount = 0;\nlet lucideImportCount = 0;\nlet scannedLineCount = 0;\n\nconst uiMarkupFiles = sourceFiles.filter((absolutePath) =>\n  /\\.(?:ts|tsx|js|jsx)$/.test(absolutePath),\n);\n\nconst coolUtilityPattern =\n  /\\b(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|via|to|outline|divide|fill|stroke|accent)-(?:blue|indigo|sky|cyan|purple|violet)-\\d{2,3}(?:\\/\\d+)?/gi;\nconst navyUtilityPattern =\n  /bg-\\[#(?:0[0-9a-f]{5}|1[0-9a-f]{5})\\](?:\\/\\d+)?/gi;\n\nfor (const absolutePath of sourceFiles) {\n  const source = fs.readFileSync(absolutePath, \"utf8\");\n  scannedLineCount += source.split(/\\r?\\n/).length;\n  if (uiMarkupFiles.includes(absolutePath)) {\n    legacyCoolUtilityCount += (source.match(coolUtilityPattern) ?? []).length;\n    legacyNavyUtilityCount += (source.match(navyUtilityPattern) ?? []).length;\n  }\n  lucideImportCount += (source.match(/from\\s+[\"']lucide-react[\"']/g) ?? []).length;\n}\n\nif (lucideImportCount > 0) {\n  failures.push(\n    `${lucideImportCount} lucide-react import(s) remain. Google Material Symbols are required.`,\n  );\n}\n\nif (legacyCoolUtilityCount > 0) {\n  failures.push(\n    `${legacyCoolUtilityCount} old cool-colour Tailwind UI token(s) remain after migration.`,\n  );\n}\n\nif (legacyNavyUtilityCount > 0) {\n  failures.push(\n    `${legacyNavyUtilityCount} old navy arbitrary-background token(s) remain after migration.`,\n  );\n}\n\nconst widgetsFallbacks = (\n  requireFile(\"src/components/icons/materialIcons.tsx\")\n    .match(/createMaterialIcon\\(\"widgets\"/g) ?? []\n).length;\n\nif (widgetsFallbacks > 0) {\n  warnings.push(\n    `${widgetsFallbacks} generic Material Symbol fallback(s) remain; they are not old icon-library assets, but should be mapped when new icon names are added.`,\n  );\n}\n\nconst summary = {\n  uiFilesScanned: sourceFiles.length,\n  linesScanned: scannedLineCount,\n  legacyCoolUtilityCount,\n  legacyNavyUtilityCount,\n  lucideImportCount,\n  widgetsFallbacks,\n  warnings,\n  failures,\n};\n\nconst reportDirectory = path.join(root, \".roadsafe-ui-audit\");\nfs.mkdirSync(reportDirectory, { recursive: true });\nfs.writeFileSync(\n  path.join(reportDirectory, \"blender-ui-verification.json\"),\n  `${JSON.stringify(summary, null, 2)}\\n`,\n  \"utf8\",\n);\n\nconsole.log(\n  `Blender UI audit: ${sourceFiles.length} UI source files, ${scannedLineCount} lines.`,\n);\n\nfor (const warning of warnings) {\n  console.warn(`WARNING: ${warning}`);\n}\n\nif (failures.length > 0) {\n  for (const failure of failures) {\n    console.error(`FAIL: ${failure}`);\n  }\n  process.exit(1);\n}\n\nconsole.log(\"PASS: RoadSafe UI conforms to the Blender workstation guardrails.\");\n", "docs/BLENDER_UI_STANDARD.md": "# RoadSafe AR Blender Workstation UI Standard\n\n## Canonical reference\n\nThe **Station Overview → Context inspector → Active investigation** panel is the source of truth for every RoadSafe interface surface.\n\nThis standard applies to:\n\n- application navigation and toolbars;\n- dashboard cards and tables;\n- case forms and wizards;\n- maps and map controls;\n- 2D, 3D and AR reconstruction views;\n- right-side inspectors;\n- playback and timeline panels;\n- bottom drawers and node editors;\n- modals, dialogs and evidence workspaces;\n- objects, hazards and evidence palettes.\n\n## Surface hierarchy\n\n| Role | Value |\n| --- | --- |\n| Shell | `#1B1B1B` |\n| Sidebar | `#242424` |\n| Panel | `#292929` |\n| Section | `#303030` |\n| Section header | `#282828` |\n| Raised/selected surface | `#383838` |\n| Input | `#202020` |\n| Border | `#171717` |\n| Strong border | `#555555` |\n| Primary text | `#DEDEDE` |\n| Secondary text | `#C4C4C4` |\n| Muted text | `#969696` |\n| Interaction accent | `#E8872D` |\n\n## Mandatory rules\n\n1. Large blue, navy, indigo, cyan, purple or violet UI surfaces are prohibited.\n2. Orange is used only for focus, selected rows, active tools and active node outlines.\n3. Red is reserved for destructive actions, collision warnings and critical status.\n4. Semantic case-data colours may remain on small vehicle swatches, chart lines, evidence markers and physical-scene objects.\n5. Controls are compact, square or lightly rounded, and lightly bevelled.\n6. Inputs are recessed charcoal fields with orange focus outlines.\n7. Sliders use a gray track and orange thumb.\n8. Right panels and bottom panels use the shared `workstation-panel`, `roadsafe-inspector` and `roadsafe-bottom-panel` structures.\n9. Glassmorphism, broad blur, large shadows and oversized web-card rounding are prohibited.\n10. All icons use Google Material Symbols.\n11. 2D, 3D and AR views use the same visual language and canonical timeline.\n12. New UI must pass `npm run ui:verify` before commit.\n\n## Objects, hazards and evidence\n\nThe reconstruction palette behaves like a Blender Outliner:\n\n- each tool is a checkbox row;\n- every row has a Material icon;\n- the active placement tool has an orange edge;\n- placed counts appear as compact badges;\n- checking a tool activates placement;\n- checking it again stops placement;\n- true object and vehicle colours remain data, not interface decoration.\n\n## Reconstruction nodes\n\nThe node editor visualizes the canonical investigation flow:\n\n`Case → Scene → Participants / Objects / Evidence → Collision → Physics → Output`\n\nNodes are draggable, zoomable and connected with Bezier links. Node selection synchronizes with participant and scene-object selection where applicable.\n"};

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".roadsafe-ui-backup", timestamp);
const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-blender-total-ui.json",
);

const trackedPaths = [];
const trackedPathSet = new Set();
const existedBefore = {};

function track(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (trackedPathSet.has(normalized)) return;
  trackedPathSet.add(normalized);
  trackedPaths.push(normalized);

  const sourcePath = path.join(root, normalized);
  const existed = fs.existsSync(sourcePath);
  existedBefore[normalized] = existed;

  if (!existed) return;

  const destinationPath = path.join(backupRoot, normalized);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function write(relativePath, content) {
  track(relativePath);
  const destinationPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, content, "utf8");
  console.log(`WROTE ${relativePath}`);
}

function transform(relativePath, transformSource) {
  const absolutePath = path.join(root, relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const updated = transformSource(source);
  if (updated === source) {
    console.log(`UNCHANGED ${relativePath}`);
    return false;
  }
  track(relativePath);
  fs.writeFileSync(absolutePath, updated, "utf8");
  console.log(`CHANGED ${relativePath}`);
  return true;
}

function restoreAll() {
  console.log("\nRestoring the pre-installation files...");
  for (const relativePath of trackedPaths) {
    const destinationPath = path.join(root, relativePath);
    const backupPath = path.join(backupRoot, relativePath);

    if (existedBefore[relativePath]) {
      if (!fs.existsSync(backupPath)) {
        console.error(`Backup file is missing: ${backupPath}`);
        continue;
      }
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(backupPath, destinationPath);
      console.log(`RESTORED ${relativePath}`);
    } else if (fs.existsSync(destinationPath)) {
      fs.rmSync(destinationPath, { force: true, recursive: true });
      console.log(`REMOVED ${relativePath}`);
    }
  }
}

let rollbackPerformed = false;

function rollbackAfterFailure(error) {
  if (!rollbackPerformed) {
    rollbackPerformed = true;
    try {
      restoreAll();
    } catch (restoreError) {
      console.error("Rollback also encountered an error:", restoreError);
    }
  }
  console.error(
    "\nThe Total Blender UI migration stopped before completion.",
  );
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

process.once("uncaughtException", rollbackAfterFailure);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolutePath));
    else if (entry.isFile()) output.push(absolutePath);
  }
  return output;
}

for (const [relativePath, content] of Object.entries(replacementFiles)) {
  write(relativePath, content);
}

/*
 * Remove the old blue token family at its source. The final global stylesheet
 * also enforces these values, but changing the root tokens prevents legacy
 * components from flashing blue before the final CSS finishes loading.
 */
transform("src/styles/darkerTheme.css", (source) => {
  const replacements = {
    "--js-blue-muted": "#e8872d",
    "--js-blue-active": "#e8872d",
    "--js-blue-selected": "#383838",
    "--js-blue-soft-bg": "#303030",
  };

  let updated = source;
  for (const [name, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`${name}\\s*:\\s*[^;]+;`, "g");
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, `${name}: ${value};`);
    } else {
      updated = updated.replace(
        /:root\s*\{/,
        `:root {\n  ${name}: ${value};`,
      );
    }
  }
  return updated;
});

/* Improve all previously generic Material Symbols fallbacks. */
transform("src/components/icons/materialIcons.tsx", (source) => {
  const mappings = {
    CalendarDays: "calendar_month",
    CarFront: "directions_car",
    Clock3: "schedule",
    CloudSun: "partly_cloudy_day",
    Expand: "open_in_full",
    FileClock: "pending_actions",
    FileJson: "data_object",
    Film: "movie",
    Focus: "center_focus_strong",
    KeyRound: "key",
    Layers3: "layers",
    LoaderCircle: "progress_activity",
    LockKeyhole: "lock",
    MicOff: "mic_off",
    Pentagon: "pentagon",
    Satellite: "satellite_alt",
    ScanEye: "eye_tracking",
    ShieldX: "gpp_bad",
    SkipBack: "skip_previous",
    SkipForward: "skip_next",
    Skull: "skull",
  };

  let updated = source;
  for (const [name, symbol] of Object.entries(mappings)) {
    updated = updated.replace(
      new RegExp(
        `createMaterialIcon\\(\\"widgets\\",\\s*\\"${name}\\"\\)`,
        "g",
      ),
      `createMaterialIcon("${symbol}", "${name}")`,
    );
  }
  return updated;
});

/* Attach an explicit AR workstation hook without changing AR logic. */
transform(
  "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
  (source) => {
    if (source.includes("roadsafe-ar-workstation")) return source;

    const exact =
      'className="relative h-[100dvh] min-h-[620px] w-full overflow-hidden bg-[#02050c]"';

    if (source.includes(exact)) {
      return source.replace(
        exact,
        'className="roadsafe-ar-workstation relative h-[100dvh] min-h-[620px] w-full overflow-hidden"',
      );
    }

    return source.replace(
      /className="([^"]*h-\[100dvh\][^"]*)"/,
      'className="roadsafe-ar-workstation $1"',
    );
  },
);

/* Add the real draggable node editor to the reconstruction workspace. */
transform(
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  (source) => {
    let updated = source.replace(/\r\n/g, "\n");

    if (!updated.includes('from "./ReconstructionNodeEditor"')) {
      const importAnchor = 'import AccidentTimeline from "./AccidentTimeline";';
      if (!updated.includes(importAnchor)) {
        throw new Error(
          "Could not locate the AccidentTimeline import in AccidentReconstructionEditor.tsx.",
        );
      }
      updated = updated.replace(
        importAnchor,
        `${importAnchor}\nimport ReconstructionNodeEditor from "./ReconstructionNodeEditor";`,
      );
    }

    if (!updated.includes("const [nodeEditorOpen")) {
      const statePattern =
        /const \[workspaceSettingsOpen, setWorkspaceSettingsOpen\] = useState\(true\);/;
      if (!statePattern.test(updated)) {
        throw new Error(
          "Could not locate workspaceSettingsOpen state in AccidentReconstructionEditor.tsx.",
        );
      }
      updated = updated.replace(
        statePattern,
        (match) =>
          `${match}\n  const [nodeEditorOpen, setNodeEditorOpen] = useState(true);`,
      );
    }

    if (!updated.includes('aria-label="Toggle reconstruction nodes"')) {
      const labelMatch = /\n\s*Objects & Evidence\s*\n\s*<\/button>/.exec(updated);
      if (!labelMatch) {
        throw new Error(
          "Could not locate the Objects & Evidence toolbar button.",
        );
      }
      const labelIndex = labelMatch.index;
      const buttonStart = updated.lastIndexOf("<button", labelIndex);
      if (buttonStart < 0) {
        throw new Error(
          "Could not locate the Objects & Evidence button start.",
        );
      }

      const nodeButton = `          <button
            type="button"
            onClick={() => setNodeEditorOpen((value) => !value)}
            className={\`reconstruction-workspace__button \${
              nodeEditorOpen ? "is-active" : ""
            }\`}
            aria-label="Toggle reconstruction nodes"
            aria-pressed={nodeEditorOpen}
          >
            <Layers3 size={14} />
            Nodes
          </button>

`;

      updated =
        updated.slice(0, buttonStart) +
        nodeButton +
        updated.slice(buttonStart);
    }

    if (!updated.includes("<ReconstructionNodeEditor")) {
      const panelMatch = /<section\s+className=\{`reconstruction-workspace__workspace-panels \${/.exec(updated);
      const markerIndex = panelMatch?.index ?? -1;
      if (markerIndex < 0) {
        throw new Error(
          "Could not locate the Workspace Panels section for node editor insertion.",
        );
      }

      const nodeEditor = `        <ReconstructionNodeEditor
          reconstruction={reconstruction}
          currentTime={currentTime}
          activeView={activeReconstructionView}
          open={nodeEditorOpen}
          selectedParticipantId={selectedParticipantId}
          selectedSceneObjectId={selectedSceneObjectId}
          onToggle={() => setNodeEditorOpen((value) => !value)}
          onSelectParticipant={(participantId) =>
            handleSelectParticipant(participantId)
          }
          onSelectSceneObject={handleSelectSceneObject}
        />

`;

      updated =
        updated.slice(0, markerIndex) +
        nodeEditor +
        updated.slice(markerIndex);
    }

    return updated;
  },
);

/* Ensure the complete Blender skin is imported after every legacy stylesheet. */
transform("src/main.tsx", (source) => {
  let updated = source.replace(/\r\n/g, "\n")
    .replace(
      /^\s*import\s+["']\.\/styles\/reconstructionNodeEditor\.css["'];?\s*$/gm,
      "",
    )
    .replace(
      /^\s*import\s+["']\.\/styles\/blenderTotalUI\.css["'];?\s*$/gm,
      "",
    )
    .replace(/\n{3,}/g, "\n\n");

  const cssImports = Array.from(
    updated.matchAll(/^import\s+["'][^"']+\.css["'];?$/gm),
  );

  if (cssImports.length === 0) {
    throw new Error("Could not locate CSS imports in src/main.tsx.");
  }

  const last = cssImports.at(-1);
  const insertAt = last.index + last[0].length;
  const imports =
    '\nimport "./styles/reconstructionNodeEditor.css";' +
    '\nimport "./styles/blenderTotalUI.css";';

  return updated.slice(0, insertAt) + imports + updated.slice(insertAt);
});

/* Add the repository-wide verification command. */
track("package.json");
packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.scripts = packageJson.scripts ?? {};
packageJson.scripts["ui:verify"] =
  "node scripts/verify-blender-ui.mjs";
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
console.log("CHANGED package.json");

/*
 * Repo-wide markup normalization. This scans every UI source file and replaces
 * old cool-tone Tailwind utility tokens. Semantic inline data colours are not
 * touched because this operates only on utility-class spellings.
 */
const srcFiles = walk(path.join(root, "src")).filter((absolutePath) =>
  /\.(?:ts|tsx|js|jsx)$/.test(absolutePath),
);

const coolUtilityPattern =
  /\b((?:[a-z0-9-]+:)*)(bg|text|border|ring|from|via|to|outline|divide|fill|stroke|accent)-(blue|indigo|sky|cyan|purple|violet)-\d{2,3}(?:\/\d+)?/gi;

const navyUtilityPattern =
  /\b((?:[a-z0-9-]+:)*)bg-\[#(?:0[0-9a-f]{5}|1[0-9a-f]{5})\](?:\/\d+)?/gi;

const blueTextArbitraryPattern =
  /\b((?:[a-z0-9-]+:)*)text-\[#(?:7[0-9a-f]{5}|8[0-9a-f]{5})\]/gi;

const blueBorderArbitraryPattern =
  /\b((?:[a-z0-9-]+:)*)border-\[#(?:1[0-9a-f]{5}|2[0-9a-f]{5}|3[0-9a-f]{5})\]/gi;

const normalizedFiles = [];
let normalizedTokenCount = 0;

for (const absolutePath of srcFiles) {
  const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
  const source = fs.readFileSync(absolutePath, "utf8");
  let updated = source;

  updated = updated.replace(
    coolUtilityPattern,
    (_match, variants, kind) => {
      normalizedTokenCount += 1;
      const value =
        kind.toLowerCase() === "text"
          ? "#c4c4c4"
          : kind.toLowerCase() === "border" ||
              kind.toLowerCase() === "divide" ||
              kind.toLowerCase() === "outline" ||
              kind.toLowerCase() === "stroke"
            ? "#494949"
            : kind.toLowerCase() === "ring" ||
                kind.toLowerCase() === "accent"
              ? "#e8872d"
              : kind.toLowerCase() === "fill"
                ? "#c4c4c4"
                : "#303030";
      return `${variants}${kind}-[${value}]`;
    },
  );

  updated = updated.replace(
    navyUtilityPattern,
    (_match, variants) => {
      normalizedTokenCount += 1;
      return `${variants}bg-[#303030]`;
    },
  );

  updated = updated.replace(
    blueTextArbitraryPattern,
    (_match, variants) => {
      normalizedTokenCount += 1;
      return `${variants}text-[#c4c4c4]`;
    },
  );

  updated = updated.replace(
    blueBorderArbitraryPattern,
    (_match, variants) => {
      normalizedTokenCount += 1;
      return `${variants}border-[#494949]`;
    },
  );

  if (updated !== source) {
    track(relativePath);
    fs.writeFileSync(absolutePath, updated, "utf8");
    normalizedFiles.push(relativePath);
  }
}

console.log(
  `NORMALIZED ${normalizedTokenCount} legacy cool-tone UI token(s) across ${normalizedFiles.length} source file(s).`,
);

const auditDirectory = path.join(root, ".roadsafe-ui-audit");
track(".roadsafe-ui-audit/blender-total-migration.json");
fs.mkdirSync(auditDirectory, { recursive: true });
fs.writeFileSync(
  path.join(auditDirectory, "blender-total-migration.json"),
  `${JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      normalizedTokenCount,
      normalizedFiles,
      replacementFiles: Object.keys(replacementFiles),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

try {
  execSync("node scripts/verify-blender-ui.mjs", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch (error) {
  if (!rollbackPerformed) {
    rollbackPerformed = true;
    restoreAll();
  }
  console.error(`
The total Blender UI migration did not pass verification or the production build.
Every changed file has been restored automatically.
`);
  process.exit(1);
}

process.removeListener("uncaughtException", rollbackAfterFailure);

fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      version: 1,
      installedAt: new Date().toISOString(),
      backupRoot,
      trackedPaths,
      existedBefore,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
RoadSafe Total Blender UI installed successfully.

Applied repo-wide:
- charcoal Blender workstation surfaces;
- compact bevelled buttons and toolbars;
- orange selection/focus instead of blue;
- recessed inputs, orange sliders and square checkboxes;
- Station Overview right/bottom panel standard;
- 2D, 3D and AR chrome normalization;
- Material Symbols guardrails;
- checkbox-based Objects, Hazards & Evidence palette;
- real draggable reconstruction node editor;
- repository UI verification command.

Run:
  npm run dev

Verify again:
  npm run ui:verify

Rollback:
  node revoke-roadsafe-blender-total-ui.mjs
`);
