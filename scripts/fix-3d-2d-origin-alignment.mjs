import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const targets = [
  {
    path:
      "src/components/reconstruction/Reconstruction3DViewer.tsx",
    importAfter:
      'import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";',
    utilityImport:
      'import {\n  reconstructionHeadingToThreeYawRadians,\n  reconstructionPositionToThreeVector,\n} from "../../utils/reconstructionThreeCoordinates";',
  },
  {
    path:
      "src/components/reconstruction/ar/ARSceneFactory.ts",
    importAfter:
      'import { getReconstructionWorldDimensions } from "../../../utils/reconstructionWorldScale";',
    utilityImport:
      'import {\n  reconstructionHeadingToThreeYawRadians,\n  reconstructionPositionToThreeVector,\n} from "../../../utils/reconstructionThreeCoordinates";',
  },
];

const utilitySource =
  "src/utils/reconstructionThreeCoordinates.ts";

function read(relativePath) {
  const absolutePath =
    path.join(
      projectRoot,
      relativePath,
    );

  if (
    !fs.existsSync(
      absolutePath,
    )
  ) {
    throw new Error(
      `Required file not found: ${relativePath}`,
    );
  }

  return {
    relativePath,
    absolutePath,
    content:
      fs.readFileSync(
        absolutePath,
        "utf8",
      ),
  };
}

function replaceOnce(
  content,
  search,
  replacement,
  label,
) {
  const next =
    content.replace(
      search,
      replacement,
    );

  if (next === content) {
    throw new Error(
      `Could not apply "${label}". The file may have changed.`,
    );
  }

  return next;
}

function backup(
  files,
) {
  const timestamp =
    new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");

  const root =
    path.join(
      projectRoot,
      ".roadsafe-patch-backups",
      `coordinate-alignment-${timestamp}`,
    );

  for (
    const file
    of files
  ) {
    const destination =
      path.join(
        root,
        file.relativePath,
      );

    fs.mkdirSync(
      path.dirname(destination),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      destination,
      file.content,
      "utf8",
    );
  }

  return root;
}

function ensureUtilityImport(
  content,
  target,
) {
  if (
    content.includes(
      "reconstructionPositionToThreeVector",
    ) &&
    content.includes(
      target.utilityImport,
    )
  ) {
    return content;
  }

  return replaceOnce(
    content,
    target.importAfter,
    `${target.importAfter}\n${target.utilityImport}`,
    `${target.path} shared-coordinate import`,
  );
}

function replaceWorldPositionFunction(
  content,
  targetPath,
) {
  if (
    content.includes(
      "return reconstructionPositionToThreeVector(",
    )
  ) {
    return content;
  }

  const pattern =
    /function worldPosition\(\s*position: ReconstructionPosition,\s*width: number,\s*height: number,\s*y = 0,\s*\): THREE\.Vector3 \{\s*return new THREE\.Vector3\(\s*\(position\.x \/ 100 - 0\.5\) \*\s*width,\s*y,\s*\(0\.5 - position\.y \/ 100\) \*\s*height,\s*\);\s*\}/;

  const replacement = `function worldPosition(
  position: ReconstructionPosition,
  width: number,
  height: number,
  y = 0,
): THREE.Vector3 {
  return reconstructionPositionToThreeVector(
    position,
    width,
    height,
    y,
  );
}`;

  const next =
    content.replace(
      pattern,
      replacement,
    );

  if (next === content) {
    throw new Error(
      `Could not replace mirrored worldPosition() in ${targetPath}.`,
    );
  }

  return next;
}

function replaceParticipantYaw(
  content,
  targetPath,
) {
  if (
    content.includes(
      "reconstructionHeadingToThreeYawRadians(\n            state.rotation,",
    ) ||
    content.includes(
      "reconstructionHeadingToThreeYawRadians(\n          state.rotation,",
    )
  ) {
    return content;
  }

  const patterns = [
    {
      search: `        entry.holder.rotation.set(
          0,
          THREE.MathUtils.degToRad(state.rotation),
          0,
        );`,
      replacement: `        entry.holder.rotation.set(
          0,
          reconstructionHeadingToThreeYawRadians(
            state.rotation,
          ),
          0,
        );`,
    },
    {
      search: `        entry.holder.rotation.set(
          0,
          THREE.MathUtils.degToRad(
            state.rotation,
          ),
          0,
        );`,
      replacement: `        entry.holder.rotation.set(
          0,
          reconstructionHeadingToThreeYawRadians(
            state.rotation,
          ),
          0,
        );`,
    },
  ];

  for (
    const candidate
    of patterns
  ) {
    if (
      content.includes(
        candidate.search,
      )
    ) {
      return content.replace(
        candidate.search,
        candidate.replacement,
      );
    }
  }

  throw new Error(
    `Could not replace participant yaw conversion in ${targetPath}.`,
  );
}

try {
  const sourceUtility =
    read(utilitySource);

  const loadedTargets =
    targets.map(
      (target) =>
        read(target.path),
    );

  const backupRoot =
    backup([
      ...loadedTargets,
      ...(fs.existsSync(
        path.join(
          projectRoot,
          utilitySource,
        ),
      )
        ? [sourceUtility]
        : []),
    ]);

  /*
   * The downloaded package contains the authoritative utility file. Copy it
   * into the project before running this patch script.
   */
  const expectedUtility =
    path.join(
      projectRoot,
      utilitySource,
    );

  if (
    !fs.existsSync(
      expectedUtility,
    )
  ) {
    throw new Error(
      `Copy ${utilitySource} from the fix package into the project first.`,
    );
  }

  for (
    let index = 0;
    index <
    loadedTargets.length;
    index += 1
  ) {
    const target =
      targets[index];

    const file =
      loadedTargets[index];

    let content =
      ensureUtilityImport(
        file.content,
        target,
      );

    content =
      replaceWorldPositionFunction(
        content,
        target.path,
      );

    content =
      replaceParticipantYaw(
        content,
        target.path,
      );

    if (
      content.includes(
        "(0.5 - position.y / 100)",
      )
    ) {
      throw new Error(
        `Mirrored participant coordinates remain in ${target.path}.`,
      );
    }

    if (
      !content.includes(
        "reconstructionPositionToThreeVector(",
      ) ||
      !content.includes(
        "reconstructionHeadingToThreeYawRadians(",
      )
    ) {
      throw new Error(
        `Coordinate verification failed for ${target.path}.`,
      );
    }

    fs.writeFileSync(
      file.absolutePath,
      content,
      "utf8",
    );

    console.log(
      `Updated ${target.path}`,
    );
  }

  console.log("");
  console.log(
    "2D / 3D / AR coordinate alignment fixed.",
  );
  console.log(
    `Backups: ${path.relative(
      projectRoot,
      backupRoot,
    )}`,
  );
  console.log("");
  console.log("Run next:");
  console.log("  npm run build");
  console.log("  npm run dev");
} catch (error) {
  console.error("");
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
}
