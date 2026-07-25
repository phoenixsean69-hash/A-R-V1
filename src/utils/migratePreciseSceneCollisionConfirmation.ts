const RECONSTRUCTION_STORAGE_KEY = "roadsafe-ar-reconstructions";

interface StoredCoordinate {
  latitude?: unknown;
  longitude?: unknown;
  accuracyMetres?: unknown;
}

interface StoredPosition {
  x?: unknown;
  y?: unknown;
}

interface StoredBounds {
  north?: unknown;
  south?: unknown;
  east?: unknown;
  west?: unknown;
}

interface StoredRealSceneGeometry {
  status?: unknown;
  sceneWidthMetres?: unknown;
  sceneHeightMetres?: unknown;
  selection?: {
    bounds?: StoredBounds;
  };
}

interface StoredCollisionSetup {
  confirmed?: unknown;
  locked?: unknown;
  toleranceMetres?: unknown;
  notes?: unknown;
  lastCalculatedAt?: unknown;
}

interface StoredReconstruction {
  siteCoordinate?: StoredCoordinate;
  collisionPoint?: StoredPosition;
  collisionSetup?: StoredCollisionSetup;
  scene?: {
    realSceneGeometry?: StoredRealSceneGeometry;
  };
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isStoredReconstruction(value: unknown): value is StoredReconstruction {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getExpectedScenePosition(
  reconstruction: StoredReconstruction,
): { x: number; y: number; widthMetres: number; heightMetres: number } | null {
  const coordinate = reconstruction.siteCoordinate;
  const geometry = reconstruction.scene?.realSceneGeometry;
  const bounds = geometry?.selection?.bounds;

  if (!coordinate || geometry?.status !== "ready" || !bounds) return null;

  const latitude = finiteNumber(coordinate.latitude);
  const longitude = finiteNumber(coordinate.longitude);
  const north = finiteNumber(bounds.north);
  const south = finiteNumber(bounds.south);
  const east = finiteNumber(bounds.east);
  const west = finiteNumber(bounds.west);
  const widthMetres = finiteNumber(geometry.sceneWidthMetres);
  const heightMetres = finiteNumber(geometry.sceneHeightMetres);

  if (
    latitude === null ||
    longitude === null ||
    north === null ||
    south === null ||
    east === null ||
    west === null ||
    widthMetres === null ||
    heightMetres === null ||
    east <= west ||
    north <= south ||
    widthMetres <= 0 ||
    heightMetres <= 0
  ) {
    return null;
  }

  return {
    x: clamp(((longitude - west) / (east - west)) * 100, 0, 100),
    y: clamp(((north - latitude) / (north - south)) * 100, 0, 100),
    widthMetres,
    heightMetres,
  };
}

function isAuthoritativeStoredCollisionPoint(
  reconstruction: StoredReconstruction,
): boolean {
  const collisionPoint = reconstruction.collisionPoint;
  const expected = getExpectedScenePosition(reconstruction);

  if (!collisionPoint || !expected) return false;

  const x = finiteNumber(collisionPoint.x);
  const y = finiteNumber(collisionPoint.y);

  if (x === null || y === null || x < 0 || x > 100 || y < 0 || y > 100) {
    return false;
  }

  const differenceXMetres = ((x - expected.x) / 100) * expected.widthMetres;
  const differenceYMetres = ((y - expected.y) / 100) * expected.heightMetres;
  const differenceMetres = Math.hypot(differenceXMetres, differenceYMetres);

  const reportedAccuracy = Math.max(
    0,
    finiteNumber(reconstruction.siteCoordinate?.accuracyMetres) ?? 0,
  );
  const allowedDifferenceMetres = Math.max(0.35, reportedAccuracy * 0.25);

  return differenceMetres <= allowedDifferenceMetres;
}

function confidenceFromAccuracy(
  accuracyMetres: number,
): "High" | "Medium" | "Low" {
  if (accuracyMetres <= 5) return "High";
  if (accuracyMetres <= 10) return "Medium";
  return "Low";
}

/**
 * Repairs the older split state where the precise collision coordinate was
 * saved correctly but `collisionSetup.confirmed` was left false.
 */
export function migratePreciseSceneCollisionConfirmation(): void {
  try {
    const storedValue = localStorage.getItem(RECONSTRUCTION_STORAGE_KEY);
    if (!storedValue) return;

    const parsed = JSON.parse(storedValue) as unknown;
    if (!Array.isArray(parsed)) return;

    let changed = false;
    const migrated = parsed.map((value) => {
      if (!isStoredReconstruction(value)) return value;
      if (value.collisionSetup?.confirmed === true) return value;
      if (!isAuthoritativeStoredCollisionPoint(value)) return value;

      const accuracyMetres = Math.max(
        0,
        finiteNumber(value.siteCoordinate?.accuracyMetres) ?? 0,
      );
      const previousNotes =
        typeof value.collisionSetup?.notes === "string"
          ? value.collisionSetup.notes.trim()
          : "";
      const migrationNote =
        "Confirmed automatically from the officer-verified precise map anchor.";
      const existingTolerance = finiteNumber(
        value.collisionSetup?.toleranceMetres,
      );

      changed = true;

      return {
        ...value,
        collisionSetup: {
          ...value.collisionSetup,
          source: "Manual",
          confirmed: true,
          locked:
            typeof value.collisionSetup?.locked === "boolean"
              ? value.collisionSetup.locked
              : false,
          toleranceMetres: Math.max(
            0.5,
            Math.min(
              10,
              existingTolerance ?? (accuracyMetres > 0 ? accuracyMetres : 2),
            ),
          ),
          confidence: confidenceFromAccuracy(accuracyMetres),
          notes: previousNotes
            ? previousNotes.includes(migrationNote)
              ? previousNotes
              : `${previousNotes} ${migrationNote}`
            : migrationNote,
          lastCalculatedAt:
            typeof value.collisionSetup?.lastCalculatedAt === "string"
              ? value.collisionSetup.lastCalculatedAt
              : new Date().toISOString(),
        },
      };
    });

    if (changed) {
      localStorage.setItem(
        RECONSTRUCTION_STORAGE_KEY,
        JSON.stringify(migrated),
      );
    }
  } catch (error) {
    console.warn(
      "RoadSafe could not migrate precise collision confirmation state:",
      error,
    );
  }
}
