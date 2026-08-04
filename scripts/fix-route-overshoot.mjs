import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const relativePath = "src/utils/reconstructionRoadRouting.ts";
const absolutePath = path.join(projectRoot, relativePath);

if (!fs.existsSync(absolutePath)) {
  throw new Error(`Missing file: ${relativePath}`);
}

const original = fs.readFileSync(absolutePath, "utf8");
const functionMarker = "export function createRoadAlignedParticipantRoute({";
const functionIndex = original.indexOf(functionMarker);

if (functionIndex < 0) {
  throw new Error("Could not find createRoadAlignedParticipantRoute().");
}

let updated = original;

/*
 * Step 1: make routePoints mutable so we can trim it.
 */
const routePointsDeclaration = /const routePoints\s*=/;

if (!routePointsDeclaration.test(updated.slice(functionIndex))) {
  throw new Error("Could not find routePoints declaration inside createRoadAlignedParticipantRoute().");
}

updated =
  updated.slice(0, functionIndex) +
  updated
    .slice(functionIndex)
    .replace(routePointsDeclaration, "let routePoints =");

/*
 * Step 2: inject trimming logic before cumulative distances are computed.
 */
const cumulativeMarker = "  const cumulative: number[] = [0];";
const cumulativeIndex = updated.indexOf(cumulativeMarker, functionIndex);

if (cumulativeIndex < 0) {
  throw new Error("Could not find cumulative-distance block.");
}

if (!updated.includes("[RoadSafe:TrimRouteAtCollision]")) {
  const trimBlock = `  /*
   * [RoadSafe:TrimRouteAtCollision]
   *
   * Generated road samples can continue past the closest approach to the
   * collision and only afterward snap back to Point Z. That makes the route
   * appear to overshoot the impact point and return.
   *
   * Trim the generated route at the first closest-approach sample, then let
   * the exact Point Z remain the final route endpoint.
   */
  const impactLocal =
    sceneToLocalMetres(
      impactPoint.position,
      geometry,
    );

  const routeDistancesToImpact =
    routePoints.map((point) =>
      distance(point, impactLocal),
    );

  const minimumDistanceToImpact =
    routeDistancesToImpact.reduce(
      (best, current) =>
        Math.min(best, current),
      Number.POSITIVE_INFINITY,
    );

  const nearestRouteIndex =
    routeDistancesToImpact.findIndex(
      (distanceToImpact) =>
        distanceToImpact <=
        minimumDistanceToImpact + 0.35,
    );

  if (nearestRouteIndex >= 1) {
    routePoints =
      routePoints.slice(
        0,
        nearestRouteIndex + 1,
      );
  }

`;

  updated =
    updated.slice(0, cumulativeIndex) +
    trimBlock +
    updated.slice(cumulativeIndex);
}

/*
 * Step 3: backup + write.
 */
const timestamp = new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replaceAll(".", "-");

const backupPath = path.join(
  projectRoot,
  ".roadsafe-patch-backups",
  `route-overshoot-${timestamp}`,
  relativePath,
);

fs.mkdirSync(path.dirname(backupPath), { recursive: true });
fs.writeFileSync(backupPath, original, "utf8");
fs.writeFileSync(absolutePath, updated, "utf8");

/*
 * Step 4: verify.
 */
const verification = fs.readFileSync(absolutePath, "utf8");

const requiredMarkers = [
  "let routePoints =",
  "[RoadSafe:TrimRouteAtCollision]",
  "const routeDistancesToImpact =",
  "const nearestRouteIndex =",
];

for (const marker of requiredMarkers) {
  if (!verification.includes(marker)) {
    throw new Error(`Verification failed: ${marker}`);
  }
}

console.log("");
console.log("Route overshoot fix applied successfully.");
console.log(`Backup: ${path.relative(projectRoot, backupPath)}`);