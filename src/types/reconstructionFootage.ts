export type ReconstructionFootageQuality = "Standard" | "High";

export interface ReconstructionFootage {
  id: string;
  caseId: string;
  reconstructionId: string;
  title: string;
  description: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  recordedAt: string;
  recordedBy: string;
  playbackSpeed: number;
  quality: ReconstructionFootageQuality;
  width: number;
  height: number;
  frameRate: number;
  thumbnailDataUrl?: string;
  isPrimary: boolean;
}

export interface SaveReconstructionFootageInput {
  caseId: string;
  reconstructionId: string;
  title: string;
  description?: string;
  mimeType: string;
  durationSeconds: number;
  recordedBy?: string;
  playbackSpeed: number;
  quality: ReconstructionFootageQuality;
  width: number;
  height: number;
  frameRate: number;
  thumbnailDataUrl?: string;
  makePrimary?: boolean;
}

export interface ReconstructionRecordingPreferences {
  quality: ReconstructionFootageQuality;
  playbackSpeed: number;
  showMovementPaths: boolean;
  showMeasurements: boolean;
  showEvidenceMarkers: boolean;
  showEventCaption: boolean;
}

export const DEFAULT_RECONSTRUCTION_RECORDING_PREFERENCES: ReconstructionRecordingPreferences = {
  quality: "Standard",
  playbackSpeed: 1,
  showMovementPaths: true,
  showMeasurements: true,
  showEvidenceMarkers: true,
  showEventCaption: true,
};
