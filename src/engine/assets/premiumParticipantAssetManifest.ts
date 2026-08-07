import type {
  ReconstructionParticipantAssetId,
} from "../../types/reconstruction";

export type PremiumParticipantRuntimeFormat = "glb" | "fbx";

export interface PremiumParticipantRuntimeAsset {
  assetId: ReconstructionParticipantAssetId;
  url: string;
  format: PremiumParticipantRuntimeFormat;
  sourceFile: string;
  sourceName: string;
  license: string;
  bytes: number;
}

export interface PremiumParticipantRuntimeManifest {
  generatedAt: string;
  intakeRoot: string;
  assets: Partial<
    Record<
      ReconstructionParticipantAssetId,
      PremiumParticipantRuntimeAsset
    >
  >;
}

const MANIFEST_URL =
  "/assets/roadsafe-premium-participants/manifest.json";

let manifestPromise:
  | Promise<PremiumParticipantRuntimeManifest>
  | null = null;

export function loadPremiumParticipantManifest():
  Promise<PremiumParticipantRuntimeManifest> {
  if (manifestPromise) return manifestPromise;

  manifestPromise = fetch(MANIFEST_URL, {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Premium participant manifest unavailable (${response.status}).`,
        );
      }

      return (
        await response.json()
      ) as PremiumParticipantRuntimeManifest;
    })
    .catch((error) => {
      manifestPromise = null;
      throw error;
    });

  return manifestPromise;
}

export async function getPremiumParticipantRuntimeAsset(
  assetId: ReconstructionParticipantAssetId,
): Promise<PremiumParticipantRuntimeAsset | null> {
  try {
    const manifest =
      await loadPremiumParticipantManifest();

    return manifest.assets[assetId] ?? null;
  } catch {
    return null;
  }
}
