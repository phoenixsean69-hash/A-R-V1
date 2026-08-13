import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PARTICIPANT_ASSET_CATALOG,
  getDefaultParticipantAssetId,
} from "../../engine/assets/participantAssetCatalog";

import {
  loadPremiumParticipantManifest,
} from "../../engine/assets/premiumParticipantAssetManifest";

import {
  sceneObjectCatalog,
  sceneObjectCategories,
} from "../../data/sceneObjectCatalog";

import type {
  AccidentReconstruction,
  ParticipantPhysicsProfile,
  ReconstructionParticipantAssetId,
  ReconstructionVehicle,
  ReconstructionVehicleType,
} from "../../types/reconstruction";

import {
  getDefaultParticipantPhysics,
} from "../../services/reconstructionPhysicsService";

import {
  writeParticipantAssetDrag,
  writeSceneObjectDrag,
} from "../../engine/assets/sceneAssetDragData";

import ParticipantAssetPreview3D from "./ParticipantAssetPreview3D";

import BufferedCommitInput from "./BufferedCommitInput";

import "./sceneCollectionAssetBrowser.css";

type AssetLibraryMode =
  | "participants"
  | "objects";

interface SceneCollectionAssetBrowserProps {
  reconstruction: AccidentReconstruction;
  selectedParticipantId: string | null;
  selectedSceneObjectId: string | null;

  onSelectParticipant(
    participantId: string,
  ): void;

  onSelectSceneObject(
    objectId: string,
  ): void;

  onUpdateParticipant(
    participantId: string,
    updates: Partial<ReconstructionVehicle>,
  ): void;

  onArmParticipantPlacement(
    assetId: ReconstructionParticipantAssetId,
    type: ReconstructionVehicleType,
  ): void;
}

export default function SceneCollectionAssetBrowser({
  reconstruction,
  selectedParticipantId,
  selectedSceneObjectId,
  onSelectParticipant,
  onSelectSceneObject,
  onUpdateParticipant,
  onArmParticipantPlacement,
}: SceneCollectionAssetBrowserProps) {
  const participantAssets =
    useMemo(
      () =>
        Object.values(
          PARTICIPANT_ASSET_CATALOG,
        ),
      [],
    );

  const [mode, setMode] =
    useState<AssetLibraryMode>(
      "participants",
    );

  const [collectionOpen, setCollectionOpen] =
    useState(true);

  const [participantsOpen, setParticipantsOpen] =
    useState(true);

  const [objectsOpen, setObjectsOpen] =
    useState(true);

  /*
   * [RoadSafe:SceneCollectionParticipantPropertiesV1]
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

  const [selectedAssetId, setSelectedAssetId] =
    useState<ReconstructionParticipantAssetId>(
      participantAssets[0].id,
    );

  const [premiumAssetIds, setPremiumAssetIds] =
    useState<
      Set<ReconstructionParticipantAssetId>
    >(new Set());

  useEffect(() => {
    let active = true;

    void loadPremiumParticipantManifest()
      .then((manifest) => {
        if (!active) return;

        setPremiumAssetIds(
          new Set(
            Object.keys(
              manifest.assets,
            ) as ReconstructionParticipantAssetId[],
          ),
        );
      })
      .catch(() => {
        if (active) {
          setPremiumAssetIds(
            new Set(),
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedAsset =
    PARTICIPANT_ASSET_CATALOG[
      selectedAssetId
    ];

  const preferredType =
    selectedAsset.supportedTypes[0];

  return (
    <div className="roadsafe-scene-collection">
      <section className="roadsafe-scene-collection__outliner">
        <header>
          <strong>Scene Collection</strong>
          <span>
            {reconstruction.vehicles.length +
              reconstruction.sceneObjects.length}
          </span>
        </header>

        <button
          type="button"
          className="roadsafe-outliner-row is-root"
          onClick={() =>
            setCollectionOpen(
              (current) => !current,
            )
          }
        >
          <span className="roadsafe-outliner-row__twisty">
            {collectionOpen
              ? "▾"
              : "▸"}
          </span>

          <span className="roadsafe-outliner-row__icon">
            ▣
          </span>

          <strong>Collection</strong>
        </button>

        {collectionOpen && (
          <div className="roadsafe-outliner-children">
            <button
              type="button"
              className="roadsafe-outliner-row is-folder"
              onClick={() =>
                setParticipantsOpen(
                  (current) => !current,
                )
              }
            >
              <span className="roadsafe-outliner-row__twisty">
                {participantsOpen
                  ? "▾"
                  : "▸"}
              </span>

              <span className="roadsafe-outliner-row__icon">
                ◉
              </span>

              <strong>Participants</strong>

              <small>
                {reconstruction.vehicles.length}
              </small>
            </button>

            {participantsOpen && (
              <div className="roadsafe-outliner-children is-nested">
                {reconstruction.vehicles.length === 0 ? (
                  <div className="roadsafe-outliner-empty">
                    No participants placed.
                  </div>
                ) : (
                  reconstruction.vehicles.map(
                    (participant) => {
                      const assetId =
                        participant.assetId ??
                        getDefaultParticipantAssetId(
                          participant.type,
                        );

                      const asset =
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

                      return (
                        <div
                          key={participant.id}
                          className="roadsafe-outliner-participant"
                        >
                        <button
                          type="button"
                          className={`roadsafe-outliner-row is-item ${
                            selectedParticipantId ===
                            participant.id
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() => {
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

                          <span className="roadsafe-outliner-row__icon is-participant">
                            ◈
                          </span>

                          <span className="roadsafe-outliner-row__label">
                            {participant.name}
                          </span>

                          <small>
                            {asset.shortLabel}
                          </small>

                          <span className="roadsafe-outliner-row__eye">
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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

                                <BufferedCommitInput
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
                      );
                    },
                  )
                )}
              </div>
            )}

            <button
              type="button"
              className="roadsafe-outliner-row is-folder"
              onClick={() =>
                setObjectsOpen(
                  (current) => !current,
                )
              }
            >
              <span className="roadsafe-outliner-row__twisty">
                {objectsOpen
                  ? "▾"
                  : "▸"}
              </span>

              <span className="roadsafe-outliner-row__icon">
                ◆
              </span>

              <strong>Scene Objects</strong>

              <small>
                {reconstruction.sceneObjects.length}
              </small>
            </button>

            {objectsOpen && (
              <div className="roadsafe-outliner-children is-nested">
                {reconstruction.sceneObjects.length === 0 ? (
                  <div className="roadsafe-outliner-empty">
                    No scene objects placed.
                  </div>
                ) : (
                  reconstruction.sceneObjects.map(
                    (object) => (
                      <button
                        key={object.id}
                        type="button"
                        className={`roadsafe-outliner-row is-item ${
                          selectedSceneObjectId ===
                          object.id
                            ? "is-selected"
                            : ""
                        }`}
                        onClick={() =>
                          onSelectSceneObject(
                            object.id,
                          )
                        }
                      >
                        <span className="roadsafe-outliner-row__twisty" />

                        <span className="roadsafe-outliner-row__icon is-object">
                          ◇
                        </span>

                        <span className="roadsafe-outliner-row__label">
                          {object.label}
                        </span>

                        <small>
                          {object.type}
                        </small>

                        <span className="roadsafe-outliner-row__eye">
                          {object.visible
                            ? "◉"
                            : "○"}
                        </span>
                      </button>
                    ),
                  )
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="roadsafe-scene-collection__asset-browser">
        <header className="roadsafe-asset-browser__header">
          <strong>Asset Library</strong>

          <div className="roadsafe-asset-browser__tabs">
            <button
              type="button"
              className={
                mode === "participants"
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setMode(
                  "participants",
                )
              }
            >
              Participants
            </button>

            <button
              type="button"
              className={
                mode === "objects"
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setMode(
                  "objects",
                )
              }
            >
              Objects
            </button>
          </div>
        </header>

        {mode === "participants" ? (
          <>
            <ParticipantAssetPreview3D
              assetId={selectedAssetId}
            />

            <div className="roadsafe-asset-browser__selected">
              <div>
                <strong>
                  {selectedAsset.shortLabel}
                </strong>

                <small>
                  {selectedAsset.family}
                  {" · "}
                  {selectedAsset.dimensions.lengthMetres}
                  m ×{" "}
                  {selectedAsset.dimensions.widthMetres}
                  m
                </small>
              </div>

              <button
                type="button"
                onClick={() =>
                  onArmParticipantPlacement(
                    selectedAsset.id,
                    preferredType,
                  )
                }
              >
                Place
              </button>
            </div>

            <p className="roadsafe-asset-browser__hint">
              Drag a model onto the 2D or 3D scene to place it exactly where it is dropped.
            </p>

            <div className="roadsafe-asset-browser__list">
              {participantAssets.map(
                (asset) => {
                  const type =
                    asset.supportedTypes[0];

                  const premium =
                    premiumAssetIds.has(
                      asset.id,
                    );

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      draggable
                      className={`roadsafe-asset-row ${
                        selectedAssetId ===
                        asset.id
                          ? "is-selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedAssetId(
                          asset.id,
                        )
                      }
                      onDragStart={(event) => {
                        setSelectedAssetId(
                          asset.id,
                        );

                        writeParticipantAssetDrag(
                          event.dataTransfer,
                          {
                            assetId:
                              asset.id,
                            type,
                          },
                        );
                      }}
                    >
                      <span className="roadsafe-asset-row__drag">
                        ⋮⋮
                      </span>

                      <span className="roadsafe-asset-row__model-icon">
                        ◈
                      </span>

                      <span className="roadsafe-asset-row__copy">
                        <strong>
                          {asset.shortLabel}
                        </strong>

                        <small>
                          {asset.family}
                        </small>
                      </span>

                      <span
                        className={`roadsafe-asset-row__quality ${
                          premium
                            ? "is-premium"
                            : ""
                        }`}
                      >
                        {premium
                          ? "HQ"
                          : "Fallback"}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </>
        ) : (
          <div className="roadsafe-object-library">
            <p className="roadsafe-asset-browser__hint">
              Drag an object directly onto the scene.
            </p>

            {sceneObjectCategories.map(
              (category) => (
                <details
                  key={category}
                  open={
                    category ===
                    "Road Hazards"
                  }
                >
                  <summary>
                    {category}
                  </summary>

                  <div className="roadsafe-asset-browser__list">
                    {sceneObjectCatalog
                      .filter(
                        (item) =>
                          item.category ===
                          category,
                      )
                      .map(
                        (item) => (
                          <button
                            key={item.type}
                            type="button"
                            draggable
                            className="roadsafe-asset-row"
                            onDragStart={(event) =>
                              writeSceneObjectDrag(
                                event.dataTransfer,
                                item.type,
                              )
                            }
                          >
                            <span className="roadsafe-asset-row__drag">
                              ⋮⋮
                            </span>

                            <span className="roadsafe-asset-row__object-icon">
                              {item.icon}
                            </span>

                            <span className="roadsafe-asset-row__copy">
                              <strong>
                                {item.label}
                              </strong>

                              <small>
                                {item.description}
                              </small>
                            </span>
                          </button>
                        ),
                      )}
                  </div>
                </details>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
