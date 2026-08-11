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
  ReconstructionParticipantAssetId,
  ReconstructionVehicleType,
} from "../../types/reconstruction";

import {
  writeParticipantAssetDrag,
  writeSceneObjectDrag,
} from "../../engine/assets/sceneAssetDragData";

import ParticipantAssetPreview3D from "./ParticipantAssetPreview3D";

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

                      return (
                        <button
                          key={participant.id}
                          type="button"
                          className={`roadsafe-outliner-row is-item ${
                            selectedParticipantId ===
                            participant.id
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() =>
                            onSelectParticipant(
                              participant.id,
                            )
                          }
                        >
                          <span className="roadsafe-outliner-row__twisty" />

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
