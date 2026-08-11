import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const BROWSER_REL =
  "src/components/reconstruction/SceneCollectionAssetBrowser.tsx";

const CSS_REL =
  "src/components/reconstruction/sceneCollectionAssetBrowser.css";

const EDITOR_REL =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";

const BROWSER = path.join(
  ROOT,
  ...BROWSER_REL.split("/"),
);

const CSS = path.join(
  ROOT,
  ...CSS_REL.split("/"),
);

const EDITOR = path.join(
  ROOT,
  ...EDITOR_REL.split("/"),
);

const MARKER =
  "[RoadSafe:SceneCollectionParticipantPropertiesV1]";

const CSS_START =
  "/* [RoadSafe:SceneCollectionParticipantPropertiesV1:start] */";

const CSS_END =
  "/* [RoadSafe:SceneCollectionParticipantPropertiesV1:end] */";

function fail(
  message,
  code = 1,
) {
  console.error("");
  console.error(
    `[RoadSafe] ${message}`,
  );
  process.exit(code);
}

function replaceOnce(
  source,
  before,
  after,
  description,
) {
  if (
    source.includes(after)
  ) {
    return source;
  }

  const first =
    source.indexOf(before);

  if (first < 0) {
    fail(
      `Could not locate ${description}. No files were changed.`,
    );
  }

  const second =
    source.indexOf(
      before,
      first + before.length,
    );

  if (second >= 0) {
    fail(
      `The ${description} anchor is ambiguous. No files were changed.`,
    );
  }

  return (
    source.slice(0, first) +
    after +
    source.slice(
      first + before.length,
    )
  );
}

for (
  const [rel, file]
  of [
    [BROWSER_REL, BROWSER],
    [CSS_REL, CSS],
    [EDITOR_REL, EDITOR],
  ]
) {
  if (
    !fs.existsSync(file)
  ) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }
}

const originalBrowser =
  fs.readFileSync(
    BROWSER,
    "utf8",
  );

const originalCss =
  fs.readFileSync(
    CSS,
    "utf8",
  );

const originalEditor =
  fs.readFileSync(
    EDITOR,
    "utf8",
  );

if (
  originalBrowser.includes(
    MARKER,
  )
) {
  console.log("");
  console.log(
    "[RoadSafe] Scene Collection participant properties are already installed.",
  );
  process.exit(0);
}

let browser =
  originalBrowser;

let css =
  originalCss;

let editor =
  originalEditor;

/* ========================================================================== */
/* Preflight                                                                  */
/* ========================================================================== */

const browserRequirements = [
  "Scene Collection",
  "Participants",
  "No participants placed.",
  "roadsafe-outliner-row__icon is-participant",
  "getDefaultParticipantAssetId",
];

for (
  const requirement
  of browserRequirements
) {
  if (
    !browser.includes(
      requirement,
    )
  ) {
    fail(
      `SceneCollectionAssetBrowser.tsx is not the expected RoadSafe Outliner version (missing "${requirement}"). No files were changed.`,
    );
  }
}

if (
  !editor.includes(
    "const updateParticipant = useCallback(",
  )
) {
  fail(
    "Could not find the canonical updateParticipant(...) handler in AccidentReconstructionEditor.tsx. No files were changed.",
  );
}

/* ========================================================================== */
/* Imports + props                                                            */
/* ========================================================================== */

browser =
  replaceOnce(
    browser,
`import type {
  AccidentReconstruction,
  ReconstructionParticipantAssetId,
  ReconstructionVehicleType,
} from "../../types/reconstruction";`,
`import type {
  AccidentReconstruction,
  ParticipantPhysicsProfile,
  ReconstructionParticipantAssetId,
  ReconstructionVehicle,
  ReconstructionVehicleType,
} from "../../types/reconstruction";

import {
  getDefaultParticipantPhysics,
} from "../../services/reconstructionPhysicsService";`,
    "Scene Collection reconstruction type import",
  );

browser =
  replaceOnce(
    browser,
`  onSelectSceneObject(
    objectId: string,
  ): void;

  onArmParticipantPlacement(`,
`  onSelectSceneObject(
    objectId: string,
  ): void;

  onUpdateParticipant(
    participantId: string,
    updates: Partial<ReconstructionVehicle>,
  ): void;

  onArmParticipantPlacement(`,
    "Scene Collection participant update prop",
  );

browser =
  replaceOnce(
    browser,
`  onSelectParticipant,
  onSelectSceneObject,
  onArmParticipantPlacement,`,
`  onSelectParticipant,
  onSelectSceneObject,
  onUpdateParticipant,
  onArmParticipantPlacement,`,
    "Scene Collection participant update destructuring",
  );

/* ========================================================================== */
/* Expansion state                                                            */
/* ========================================================================== */

browser =
  replaceOnce(
    browser,
`  const [objectsOpen, setObjectsOpen] =
    useState(true);

  const [selectedAssetId, setSelectedAssetId] =`,
`  const [objectsOpen, setObjectsOpen] =
    useState(true);

  /*
   * ${MARKER}
   *
   * Each participant can expose a compact properties drawer directly in the
   * Scene Collection Outliner. The values are not duplicated state: updates
   * are sent back through AccidentReconstructionEditor.updateParticipant(...).
   */
  const [
    expandedParticipantIds,
    setExpandedParticipantIds,
  ] = useState<Set<string>>(
    new Set(),
  );

  const toggleParticipantExpanded = (
    participantId: string,
  ) => {
    setExpandedParticipantIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(
            participantId,
          )
        ) {
          next.delete(
            participantId,
          );
        } else {
          next.add(
            participantId,
          );
        }

        return next;
      },
    );
  };

  const [selectedAssetId, setSelectedAssetId] =`,
    "participant expansion state",
  );

/* ========================================================================== */
/* Resolve canonical physics inside each participant row                      */
/* ========================================================================== */

browser =
  replaceOnce(
    browser,
`                      const asset =
                        PARTICIPANT_ASSET_CATALOG[
                          assetId
                        ];

                      return (`,
`                      const asset =
                        PARTICIPANT_ASSET_CATALOG[
                          assetId
                        ];

                      const expanded =
                        expandedParticipantIds.has(
                          participant.id,
                        );

                      const physics:
                        ParticipantPhysicsProfile = {
                          ...getDefaultParticipantPhysics(
                            participant,
                          ),
                          ...(participant.physics ?? {}),
                        };

                      const updatePhysics = (
                        updates:
                          Partial<ParticipantPhysicsProfile>,
                      ) => {
                        onUpdateParticipant(
                          participant.id,
                          {
                            physics: {
                              ...physics,
                              ...updates,
                            },
                          },
                        );
                      };

                      return (`,
    "participant physics resolver",
  );

/* ========================================================================== */
/* Wrap participant row + make twisty real                                    */
/* ========================================================================== */

browser =
  replaceOnce(
    browser,
`                      return (
                        <button
                          key={participant.id}`,
`                      return (
                        <div
                          key={participant.id}
                          className="roadsafe-outliner-participant"
                        >
                        <button`,
    "participant row wrapper",
  );

browser =
  replaceOnce(
    browser,
`                          onClick={() =>
                            onSelectParticipant(
                              participant.id,
                            )
                          }
                        >
                          <span className="roadsafe-outliner-row__twisty" />

                          <span className="roadsafe-outliner-row__icon is-participant">`,
`                          onClick={() => {
                            onSelectParticipant(
                              participant.id,
                            );

                            toggleParticipantExpanded(
                              participant.id,
                            );
                          }}
                          aria-expanded={
                            expanded
                          }
                          title={
                            expanded
                              ? "Collapse participant properties"
                              : "Expand participant properties"
                          }
                        >
                          <span className="roadsafe-outliner-row__twisty">
                            {expanded
                              ? "▾"
                              : "▸"}
                          </span>

                          <span className="roadsafe-outliner-row__icon is-participant">`,
    "participant row expansion click",
  );

/* ========================================================================== */
/* Insert properties drawer after row                                         */
/* ========================================================================== */

browser =
  replaceOnce(
    browser,
`                          <span className="roadsafe-outliner-row__eye">
                            ◉
                          </span>
                        </button>
                      );`,
`                          <span className="roadsafe-outliner-row__eye">
                            ◉
                          </span>
                        </button>

                        {expanded && (
                          <div
                            className="roadsafe-outliner-participant__properties"
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                            onPointerDown={(event) =>
                              event.stopPropagation()
                            }
                          >
                            <div className="roadsafe-outliner-participant__section-heading">
                              Core
                            </div>

                            <div className="roadsafe-outliner-participant__grid">
                              <label className="is-wide">
                                <span>Name</span>

                                <input
                                  value={
                                    participant.name
                                  }
                                  onChange={(event) =>
                                    onUpdateParticipant(
                                      participant.id,
                                      {
                                        name:
                                          event.target.value,
                                      },
                                    )
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Speed km/h
                                </span>

                                <input
                                  type="number"
                                  min={0}
                                  max={250}
                                  step={1}
                                  value={
                                    participant.estimatedSpeedKmh
                                  }
                                  onChange={(event) =>
                                    onUpdateParticipant(
                                      participant.id,
                                      {
                                        estimatedSpeedKmh:
                                          Math.max(
                                            0,
                                            Math.min(
                                              250,
                                              Number(
                                                event.target.value,
                                              ),
                                            ),
                                          ),
                                      },
                                    )
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Visual scale
                                </span>

                                <input
                                  type="number"
                                  min={0.25}
                                  max={4}
                                  step={0.05}
                                  value={
                                    participant.visualScale ??
                                    1
                                  }
                                  onChange={(event) =>
                                    onUpdateParticipant(
                                      participant.id,
                                      {
                                        visualScale:
                                          Math.max(
                                            0.25,
                                            Math.min(
                                              4,
                                              Number(
                                                event.target.value,
                                              ),
                                            ),
                                          ),
                                      },
                                    )
                                  }
                                />
                              </label>
                            </div>

                            <div className="roadsafe-outliner-participant__section-heading">
                              Physics
                            </div>

                            <div className="roadsafe-outliner-participant__grid">
                              <label className="is-check">
                                <span>Enabled</span>

                                <input
                                  type="checkbox"
                                  checked={
                                    physics.enabled
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      enabled:
                                        event.target.checked,
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>Mass kg</span>

                                <input
                                  type="number"
                                  min={1}
                                  max={100000}
                                  step={5}
                                  value={
                                    physics.massKg
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      massKg:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Restitution
                                </span>

                                <input
                                  type="number"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={
                                    physics.restitution
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      restitution:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Collision μ
                                </span>

                                <input
                                  type="number"
                                  min={0}
                                  max={2}
                                  step={0.05}
                                  value={
                                    physics.collisionFriction ??
                                    0.65
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      collisionFriction:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Rolling μ
                                </span>

                                <input
                                  type="number"
                                  min={0.05}
                                  max={3}
                                  step={0.05}
                                  value={
                                    physics.rollingFriction
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      rollingFriction:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>Grip</span>

                                <input
                                  type="number"
                                  min={0}
                                  max={2}
                                  step={0.05}
                                  value={
                                    physics.lateralGrip
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      lateralGrip:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Brake m/s²
                                </span>

                                <input
                                  type="number"
                                  min={0.1}
                                  max={18}
                                  step={0.1}
                                  value={
                                    physics.brakingDecelerationMps2
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      brakingDecelerationMps2:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Radius m
                                </span>

                                <input
                                  type="number"
                                  min={0.05}
                                  max={15}
                                  step={0.05}
                                  value={
                                    physics.collisionRadiusMetres
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      collisionRadiusMetres:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Length m
                                </span>

                                <input
                                  type="number"
                                  min={0.2}
                                  max={30}
                                  step={0.05}
                                  value={
                                    physics.lengthMetres ??
                                    asset.dimensions.lengthMetres
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      lengthMetres:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Width m
                                </span>

                                <input
                                  type="number"
                                  min={0.15}
                                  max={5}
                                  step={0.05}
                                  value={
                                    physics.widthMetres ??
                                    asset.dimensions.widthMetres
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      widthMetres:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label>
                                <span>
                                  Inertia scale
                                </span>

                                <input
                                  type="number"
                                  min={0.05}
                                  max={5}
                                  step={0.05}
                                  value={
                                    physics.momentOfInertiaScale ??
                                    1
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      momentOfInertiaScale:
                                        Number(
                                          event.target.value,
                                        ),
                                    })
                                  }
                                />
                              </label>

                              <label className="is-wide">
                                <span>
                                  Collision shape
                                </span>

                                <select
                                  value={
                                    physics.collisionShape ??
                                    "Oriented Box"
                                  }
                                  onChange={(event) =>
                                    updatePhysics({
                                      collisionShape:
                                        event.target.value as
                                          ParticipantPhysicsProfile["collisionShape"],
                                    })
                                  }
                                >
                                  <option value="Oriented Box">
                                    Oriented Box
                                  </option>

                                  <option value="Circle">
                                    Circle
                                  </option>
                                </select>
                              </label>
                            </div>

                            <p className="roadsafe-outliner-participant__hint">
                              Visual scale changes the model only. Physics dimensions and mass remain independent.
                            </p>
                          </div>
                        )}
                        </div>
                      );`,
    "participant collapsible properties drawer",
  );

/* ========================================================================== */
/* Pass canonical updateParticipant into both Scene Collection instances      */
/* ========================================================================== */

const browserCallPattern =
  /(<SceneCollectionAssetBrowser[\s\S]*?onSelectSceneObject=\{handleSelectSceneObject\})([\s\S]*?onArmParticipantPlacement=\{)/g;

let patchedCalls = 0;

editor =
  editor.replace(
    browserCallPattern,
    (
      match,
      before,
      after,
    ) => {
      if (
        match.includes(
          "onUpdateParticipant={updateParticipant}",
        )
      ) {
        return match;
      }

      patchedCalls += 1;

      return (
        `${before}\n` +
        `                            onUpdateParticipant={updateParticipant}` +
        `${after}`
      );
    },
  );

if (
  patchedCalls === 0 &&
  !editor.includes(
    "onUpdateParticipant={updateParticipant}",
  )
) {
  fail(
    "Could not connect Scene Collection participant editing to updateParticipant(...). No files were changed.",
  );
}

/* ========================================================================== */
/* Compact collapsible drawer CSS                                             */
/* ========================================================================== */

const cssBlock =
`${CSS_START}
.roadsafe-outliner-participant {
  min-width: 0;
  border-bottom: 1px solid #202020;
}

.roadsafe-outliner-participant > .roadsafe-outliner-row {
  border-bottom: 0;
}

.roadsafe-outliner-participant__properties {
  margin: 0 4px 4px 18px;
  overflow: hidden;
  border: 1px solid #414141;
  border-radius: 2px;
  background: #202020;
  box-shadow: inset 2px 0 0 #574533;
}

.roadsafe-outliner-participant__section-heading {
  min-height: 21px;
  display: flex;
  align-items: center;
  padding: 3px 6px;
  border-bottom: 1px solid #181818;
  background: #292929;
  color: #929292;
  font-size: 7.5px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.roadsafe-outliner-participant__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 5px;
}

.roadsafe-outliner-participant__grid label {
  min-width: 0;
  display: grid;
  gap: 2px;
  color: #818181;
  font-size: 7px;
}

.roadsafe-outliner-participant__grid label.is-wide {
  grid-column: 1 / -1;
}

.roadsafe-outliner-participant__grid label.is-check {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 23px;
  padding: 0 5px;
  border: 1px solid #3d3d3d;
  border-radius: 2px;
  background: #242424;
}

.roadsafe-outliner-participant__grid input:not([type="checkbox"]),
.roadsafe-outliner-participant__grid select {
  width: 100%;
  height: 23px;
  min-height: 23px;
  min-width: 0;
  padding: 1px 4px;
  border: 1px solid #494949;
  border-radius: 2px;
  outline: none;
  background: #282828;
  color: #d1d1d1;
  font-size: 7.8px;
}

.roadsafe-outliner-participant__grid input:not([type="checkbox"]):focus,
.roadsafe-outliner-participant__grid select:focus {
  border-color: #84613e;
}

.roadsafe-outliner-participant__grid input[type="checkbox"] {
  width: 13px;
  height: 13px;
  accent-color: #b66c2b;
}

.roadsafe-outliner-participant__hint {
  margin: 0;
  padding: 5px 6px;
  border-top: 1px solid #181818;
  color: #6f6f6f;
  font-size: 7px;
  line-height: 1.35;
}

.roadsafe-outliner-row[aria-expanded="true"] {
  background: #303030;
}

.roadsafe-outliner-row[aria-expanded="true"].is-selected {
  background: #35445d;
}

.roadsafe-outliner-row[aria-expanded="true"]
  .roadsafe-outliner-row__twisty {
  color: #d28a4b;
}
${CSS_END}`;

const existingStart =
  css.indexOf(
    CSS_START,
  );

if (
  existingStart >= 0
) {
  const existingEnd =
    css.indexOf(
      CSS_END,
      existingStart,
    );

  if (
    existingEnd < 0
  ) {
    fail(
      "Found an incomplete Scene Collection properties CSS marker. No files were changed.",
    );
  }

  css =
    css.slice(
      0,
      existingStart,
    ) +
    cssBlock +
    css.slice(
      existingEnd +
      CSS_END.length,
    );
} else {
  css =
    `${css.trimEnd()}\n\n${cssBlock}\n`;
}

/* ========================================================================== */
/* Backup + install                                                           */
/* ========================================================================== */

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `scene-collection-participant-properties-v1-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

const backups = [
  [
    BROWSER,
    path.join(
      backupDir,
      "SceneCollectionAssetBrowser.tsx",
    ),
    originalBrowser,
  ],
  [
    CSS,
    path.join(
      backupDir,
      "sceneCollectionAssetBrowser.css",
    ),
    originalCss,
  ],
  [
    EDITOR,
    path.join(
      backupDir,
      "AccidentReconstructionEditor.tsx",
    ),
    originalEditor,
  ],
];

for (
  const [
    ,
    backup,
    content,
  ]
  of backups
) {
  fs.writeFileSync(
    backup,
    content,
    "utf8",
  );
}

fs.writeFileSync(
  BROWSER,
  browser,
  "utf8",
);

fs.writeFileSync(
  CSS,
  css,
  "utf8",
);

fs.writeFileSync(
  EDITOR,
  editor,
  "utf8",
);

console.log("");
console.log(
  "RoadSafe Scene Collection Participant Properties V1",
);
console.log(
  "===================================================",
);
console.log(
  "[OK] Participant rows now expand/collapse directly in Scene Collection.",
);
console.log(
  "[OK] Name, speed and visual scale editable there.",
);
console.log(
  "[OK] Mass and full core participant physics editable there.",
);
console.log(
  "[OK] Edits use the existing canonical updateParticipant(...) handler.",
);
console.log(
  "[OK] Speed stays synchronized with solver input.",
);
console.log(
  "[OK] Physics-affecting edits invalidate stale simulation results.",
);
console.log(
  "[OK] Visual scale remains separate from physical mass/dimensions.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

/* ========================================================================== */
/* Build; restore automatically on failure                                    */
/* ========================================================================== */

const npmCommand =
  process.platform ===
  "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log(
  "Verifying production build...",
);

const result =
  spawnSync(
    npmCommand,
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell:
        process.platform ===
        "win32",
    },
  );

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  result.error ||
  result.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed.",
  );

  if (
    output
  ) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Scene Collection changes back automatically...",
  );

  fs.writeFileSync(
    BROWSER,
    originalBrowser,
    "utf8",
  );

  fs.writeFileSync(
    CSS,
    originalCss,
    "utf8",
  );

  fs.writeFileSync(
    EDITOR,
    originalEditor,
    "utf8",
  );

  console.error(
    "[RoadSafe] Rollback complete.",
  );

  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);

console.log("");
console.log(
  "Now run:",
);

console.log(
  "  npm run dev",
);
