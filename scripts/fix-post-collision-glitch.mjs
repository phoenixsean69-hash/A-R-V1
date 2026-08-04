import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const files = {
  physics: "src/services/reconstructionPhysicsService.ts",
  geometry: "src/utils/reconstructionGeometry.ts",
  playbackDom: "src/utils/reconstructionPlaybackDom.ts",
  editor: "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  threeD: "src/components/reconstruction/Reconstruction3DViewer.tsx",
  ar: "src/components/reconstruction/ar/ARSceneFactory.ts",
};

function readFile(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Required file was not found: ${relativePath}`);
  }

  return {
    relativePath,
    absolutePath,
    content: fs.readFileSync(absolutePath, "utf8"),
  };
}

function gitBlobSha(content) {
  const body = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${body.length}\0`, "utf8");

  return crypto
    .createHash("sha1")
    .update(Buffer.concat([header, body]))
    .digest("hex");
}

function replaceOnce(content, search, replacement, label) {
  const next =
    search instanceof RegExp
      ? content.replace(search, replacement)
      : content.replace(search, replacement);

  if (next === content) {
    throw new Error(
      `Could not apply "${label}". The repository code may have changed.`,
    );
  }

  return next;
}

function insertBeforeOnce(content, marker, insertion, label) {
  if (content.includes(insertion.trim())) {
    return content;
  }

  const index = content.indexOf(marker);

  if (index < 0) {
    throw new Error(
      `Could not apply "${label}". Marker was not found: ${marker}`,
    );
  }

  return `${content.slice(0, index)}${insertion}${content.slice(index)}`;
}

function backupFiles(loadedFiles) {
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  const backupRoot = path.join(
    projectRoot,
    ".roadsafe-patch-backups",
    `post-collision-${stamp}`,
  );

  for (const file of loadedFiles) {
    const backupPath = path.join(backupRoot, file.relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, file.content, "utf8");
  }

  return backupRoot;
}

function patchPhysicsService(file) {
  let content = file.content;

  const helpers = `
/*
 * RoadSafe post-collision stability invariant:
 * every physics takeover or secondary contact gets one authoritative sample at
 * the exact contact time. Any already-recorded pre-contact sample from the same
 * simulation step is removed before that transition is stored.
 */
function maximumAngularVelocityDegreesPerSecond(
  body: SimulationBody,
): number {
  switch (body.participant.type) {
    case "Bus":
      return 70;
    case "Truck":
      return 85;
    case "Car":
      return 180;
    case "Motorcycle":
    case "Bicycle":
      return 320;
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return 540;
    default:
      return 180;
  }
}

function stabiliseBodyAngularVelocity(
  body: SimulationBody,
): void {
  if (
    !Number.isFinite(
      body.angularVelocityDegreesPerSecond,
    )
  ) {
    body.angularVelocityDegreesPerSecond = 0;
    return;
  }

  const maximum =
    maximumAngularVelocityDegreesPerSecond(body);

  body.angularVelocityDegreesPerSecond = clamp(
    body.angularVelocityDegreesPerSecond,
    -maximum,
    maximum,
  );
}

function normaliseDegrees(
  degrees: number,
): number {
  if (!Number.isFinite(degrees)) {
    return 0;
  }

  return ((degrees % 360) + 360) % 360;
}

function recordPhysicsTransition(
  body: SimulationBody,
  timeSeconds: number,
  width: number,
  height: number,
  action: MovementPathPoint["action"],
  label: string,
  linkedSceneObjectId?: string,
): number {
  const previousLength = body.points.length;

  /*
   * A point may already have been recorded at the end of this simulation step
   * before swept collision resolution moved the body back to its exact contact
   * pose. Delete that stale future sample before storing the corrected state.
   */
  body.points = body.points.filter(
    (point) =>
      point.timeSeconds <
      timeSeconds - 0.0001,
  );

  stabiliseBodyAngularVelocity(body);
  body.rotation = normaliseDegrees(body.rotation);

  body.points.push({
    id: createId("physics-transition"),
    label,
    position: scenePosition(
      body.position,
      width,
      height,
    ),
    timeSeconds: Number(
      timeSeconds.toFixed(4),
    ),
    speedKmh: Number(
      mpsToKmh(
        magnitude(body.velocity),
      ).toFixed(1),
    ),
    rotation: Number(
      body.rotation.toFixed(1),
    ),
    action,
    linkedSceneObjectId,
    notes:
      "Physics takes over from the participant's guided route at the exact collision state. [RoadSafe:PostCollisionTransitionV1]",
  });

  return (
    body.points.length -
    previousLength
  );
}

`;

  if (!content.includes("[RoadSafe:PostCollisionTransitionV1]")) {
    content = insertBeforeOnce(
      content,
      "const playbackPhysicsSignatureCache = new Map<string, string>();",
      helpers,
      "exact post-collision transition helpers",
    );
  }

  if (!content.includes("stabiliseBodyAngularVelocity(body);\n}")) {
    content = replaceOnce(
      content,
      `  body.angularVelocityDegreesPerSecond +=
    (angularDeltaRadiansPerSecond * 180) / Math.PI;
}`,
      `  body.angularVelocityDegreesPerSecond +=
    (angularDeltaRadiansPerSecond * 180) / Math.PI;

  stabiliseBodyAngularVelocity(body);
}`,
      "angular impulse stabilisation",
    );
  }

  content = content.replace(
    "rotation: Number(body.rotation.toFixed(1)),",
    "rotation: Number(normaliseDegrees(body.rotation).toFixed(1)),",
  );

  const initialTransitionBlock = `  /*
   * Store the exact state where physics begins. Previously the first hidden
   * sample was not written until one simulation step later, which made
   * playback bridge from an authored route point directly to a displaced
   * post-impact body and caused a visible snap.
   */
  bodies.forEach((body) => {
    generatedPathPoints += recordPhysicsTransition(
      body,
      impactTime,
      width,
      height,
      body.primaryResponseAction ?? "Slide",
      body.primaryResponseLabel ??
        "Physics takeover after primary impact",
    );

    simulatedDurationSeconds = Math.max(
      simulatedDurationSeconds,
      impactTime,
    );
  });

`;

  if (!content.includes("Store the exact state where physics begins")) {
    content = insertBeforeOnce(
      content,
      `  for (
    let time = impactTime + step;`,
      initialTransitionBlock,
      "initial physics transition sample",
    );
  }

  if (!content.includes("stabiliseBodyAngularVelocity(body);\n\n      body.rotation +=")) {
    content = replaceOnce(
      content,
      `      body.rotation += body.angularVelocityDegreesPerSecond * step;`,
      `      stabiliseBodyAngularVelocity(body);

      body.rotation += body.angularVelocityDegreesPerSecond * step;`,
      "per-step angular velocity cap",
    );
  }

  if (!content.includes("body.rotation = normaliseDegrees(body.rotation);")) {
    content = replaceOnce(
      content,
      `      body.rotation = blendRotation(
        body.rotation,
        travelHeading,
        body.profile.lateralGrip * step * 1.35,
      );`,
      `      body.rotation = blendRotation(
        body.rotation,
        travelHeading,
        body.profile.lateralGrip * step * 1.35,
      );

      body.rotation = normaliseDegrees(
        body.rotation,
      );`,
      "post-step rotation normalisation",
    );
  }

  const staticObjectTransition = `
          const exactObjectContactTime =
            time -
            step +
            step * contact.alpha;

          generatedPathPoints +=
            recordPhysicsTransition(
              body,
              exactObjectContactTime,
              width,
              height,
              "Ricochet",
              \`Impact with \${object.label}\`,
              object.id,
            );

          simulatedDurationSeconds = Math.max(
            simulatedDurationSeconds,
            exactObjectContactTime,
          );
`;

  if (!content.includes("exactObjectContactTime")) {
    content = replaceOnce(
      content,
      /(\s+collisionEvents\.push\(\s+createPhysicsCollisionEvent\(\{[\s\S]*?type: "Participant-Object"[\s\S]*?\}\),\s+\);\n)(\s+action = "Ricochet";\n\s+label = `Impact with \$\{object\.label\}`;)/,
      `$1${staticObjectTransition}$2`,
      "exact participant-object transition sample",
    );
  }

  const participantTransitionBlock = `        /*
         * The integration loop may already have recorded a sample at "time"
         * before swept contact resolution rewound both bodies to contactTime.
         * Replace that stale sample with corrected post-impulse states for both
         * participants at the exact same timestamp.
         */
        generatedPathPoints +=
          recordPhysicsTransition(
            left,
            contactTime,
            width,
            height,
            left.primaryResponseAction ??
              "Deflect",
            left.primaryResponseLabel ??
              \`Post-impact response after contact with \${right.participant.name}\`,
          );

        generatedPathPoints +=
          recordPhysicsTransition(
            right,
            contactTime,
            width,
            height,
            right.primaryResponseAction ??
              "Deflect",
            right.primaryResponseLabel ??
              \`Post-impact response after contact with \${left.participant.name}\`,
          );

`;

  if (!content.includes("Replace that stale sample with corrected post-impulse states")) {
    content = insertBeforeOnce(
      content,
      `        // The collision event is the authoritative impact record.`,
      participantTransitionBlock,
      "exact participant-participant transition samples",
    );
  }

  content = content.replace(
    `        point.timeSeconds > impactTime + 0.0001,`,
    `        point.timeSeconds >= impactTime - 0.0001,`,
  );

  if (
    !content.includes(
      `point.timeSeconds >= impactTime - 0.0001`,
    )
  ) {
    throw new Error(
      "The exact impact transition is still being filtered from playback.",
    );
  }

  return {
    ...file,
    content,
  };
}

function patchImpactEffectState(file) {
  let content = file.content;

  if (!content.includes("participantIds: string[];")) {
    content = replaceOnce(
      content,
      `  position: ReconstructionPosition;
  progress: number;`,
      `  position: ReconstructionPosition;
  participantIds: string[];
  progress: number;`,
      "impact participant IDs type",
    );
  }

  if (
    !content.includes(
      "participantIds:\n      participantCollisionEvent?.participantIds ??",
    )
  ) {
    content = replaceOnce(
      content,
      `    position:
      participantCollisionEvent
        ?.contactPoint ??
      reconstruction.collisionPoint,
    progress: clamp(`,
      `    position:
      participantCollisionEvent
        ?.contactPoint ??
      reconstruction.collisionPoint,
    participantIds:
      participantCollisionEvent
        ?.participantIds ?? [],
    progress: clamp(`,
      "impact participant IDs result",
    );
  }

  return {
    ...file,
    content,
  };
}

function patchPlaybackDom(file) {
  let content = file.content;

  const oldBlock = /  const nearImpact =[\s\S]*?  const rotationShake =\n    Math\.sin\(impactPhase \* 0\.83\) \* impactShake \* 0\.8 \+\n    pothole\.rollDegrees;/;

  const newBlock = `  const participantWasInImpact =
    impactEffect.participantIds.includes(
      participant.id,
    );

  /*
   * The collision trajectory already contains the physical displacement.
   * Do not add a second screen-space translation shake to the body; that made
   * participants appear to teleport around the solver path. Keep only a small,
   * short angular body recoil while the separate impact overlay provides the
   * visual flash.
   */
  const impactEnvelope =
    impactEffect.active &&
    participantWasInImpact
      ? Math.max(
          0,
          1 -
            impactEffect.progress /
              0.34,
        ) *
        impactEffect.intensity
      : 0;

  const impactRotation =
    Math.sin(
      impactEffect.progress *
        Math.PI *
        3,
    ) *
    impactEnvelope *
    1.25;

  const potholePhase =
    timeSeconds * 25 +
    participantIndex * 1.9;

  const shakeX =
    Math.sin(potholePhase) *
    pothole.screenShakePixels;

  const shakeY =
    Math.abs(
      Math.sin(
        potholePhase * 1.7,
      ),
    ) *
    pothole.screenShakePixels *
    0.7;

  const rotationShake =
    impactRotation +
    pothole.rollDegrees;`;

  if (!content.includes("participantWasInImpact")) {
    content = replaceOnce(
      content,
      oldBlock,
      newBlock,
      "2D post-impact body stability",
    );
  }

  return {
    ...file,
    content,
  };
}

function patchEditorRender(file) {
  let content = file.content;

  const oldBlock = /                const nearImpact =\n[\s\S]*?                const rotationShake = Math\.sin\(shakePhase \* 0\.83\) \* shakeStrength \* 0\.8;/;

  const newBlock = `                const participantWasInImpact =
                  impactEffect.participantIds.includes(
                    participant.id,
                  );

                const impactEnvelope =
                  impactEffect.active &&
                  participantWasInImpact
                    ? Math.max(
                        0,
                        1 -
                          impactEffect.progress /
                            0.34,
                      ) *
                      impactEffect.intensity
                    : 0;

                const rotationShake =
                  Math.sin(
                    impactEffect.progress *
                      Math.PI *
                      3 +
                      participantIndex *
                        0.18,
                  ) *
                  impactEnvelope *
                  1.25;

                /*
                 * Position is controlled only by the reconstruction path.
                 * Collision emphasis is rotational plus the independent impact
                 * overlay, so React rerenders cannot overwrite the native-frame
                 * DOM path with a second translated body position.
                 */
                const shakeX = 0;
                const shakeY = 0;`;

  if (!content.includes("Position is controlled only by the reconstruction path")) {
    content = replaceOnce(
      content,
      oldBlock,
      newBlock,
      "React 2D post-impact body stability",
    );
  }

  return {
    ...file,
    content,
  };
}

const stableImpactPose3D = `function applyImpactPose(
  entry: ParticipantRenderEntry,
  currentTime: number,
  impactTime: number | undefined,
  speedKmh: number,
  enabled: boolean,
): void {
  const root = entry.modelRoot;

  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);

  if (
    !enabled ||
    impactTime === undefined ||
    currentTime < impactTime
  ) {
    return;
  }

  const elapsed = currentTime - impactTime;
  const severity = clamp(speedKmh / 70, 0.2, 1);

  const human = [
    "Pedestrian",
    "Officer",
    "Witness",
  ].includes(entry.participant.type);

  const twoWheeler = [
    "Bicycle",
    "Motorcycle",
  ].includes(entry.participant.type);

  if (human) {
    const launchVelocity = clamp(
      3.6 + speedKmh / 25,
      4,
      7.2,
    );

    const flightDuration =
      (2 * launchVelocity) / 9.81;

    const flightRotationX =
      Math.PI * (1.5 + severity * 1.1);

    const flightRotationZ =
      Math.PI * (0.55 + severity * 0.45);

    if (elapsed <= flightDuration) {
      const progress = clamp(
        elapsed / flightDuration,
        0,
        1,
      );

      root.position.y = Math.max(
        0,
        launchVelocity * elapsed -
          4.905 * elapsed * elapsed,
      );

      root.rotation.x =
        flightRotationX * progress;

      root.rotation.z =
        flightRotationZ * progress;

      return;
    }

    /*
     * Continue from the landing orientation rather than snapping from several
     * radians of airborne rotation directly to PI / 2.
     */
    const settleProgress =
      THREE.MathUtils.smoothstep(
        elapsed - flightDuration,
        0,
        0.45,
      );

    root.position.y =
      THREE.MathUtils.lerp(
        0,
        0.12,
        settleProgress,
      );

    root.rotation.x =
      THREE.MathUtils.lerp(
        flightRotationX,
        flightRotationX +
          Math.PI / 2,
        settleProgress,
      );

    root.rotation.z =
      THREE.MathUtils.lerp(
        flightRotationZ,
        flightRotationZ + 0.2,
        settleProgress,
      );

    return;
  }

  if (twoWheeler) {
    const tipProgress =
      THREE.MathUtils.smoothstep(
        elapsed,
        0,
        0.9,
      );

    root.rotation.x =
      tipProgress *
      Math.PI *
      0.45;

    root.rotation.z =
      tipProgress *
      severity *
      1.5;

    const hopDuration = 0.42;

    root.position.y =
      elapsed < hopDuration
        ? Math.sin(
            Math.PI *
              (elapsed / hopDuration),
          ) *
          0.35 *
          severity
        : 0;

    return;
  }

  /*
   * One suspension compression/rebound cycle is enough for a vehicle impact.
   * The old repeating sine wave looked like frame jitter because it moved the
   * model independently of the already-physical post-impact trajectory.
   */
  const recoilDuration = 0.52;

  if (elapsed >= recoilDuration) {
    return;
  }

  const progress = clamp(
    elapsed / recoilDuration,
    0,
    1,
  );

  const compression =
    Math.sin(Math.PI * progress) *
    (1 - progress * 0.35);

  const rebound =
    Math.sin(
      Math.PI * 2 * progress,
    ) *
    (1 - progress);

  root.position.y =
    compression *
    0.11 *
    severity;

  root.rotation.z =
    rebound *
    0.035 *
    severity;

  root.rotation.x =
    -compression *
    0.025 *
    severity;
}

`;

function patchThreeDViewer(file) {
  let content = file.content;

  if (!content.includes("One suspension compression/rebound cycle")) {
    content = replaceOnce(
      content,
      /function applyImpactPose\([\s\S]*?\n}\n\nfunction Reconstruction3DViewer\(/,
      `${stableImpactPose3D}function Reconstruction3DViewer(`,
      "stable 3D impact pose",
    );
  }

  if (!content.includes("effectiveShowPhysics,\n        );")) {
    content = replaceOnce(
      content,
      `        applyImpactPose(entry, timeRef.current, impact?.time, impact?.speed ?? entry.participant.estimatedSpeedKmh);`,
      `        applyImpactPose(
          entry,
          timeRef.current,
          impact?.time,
          impact?.speed ??
            entry.participant.estimatedSpeedKmh,
          effectiveShowPhysics,
        );`,
      "3D physics-effect visibility",
    );
  }

  content = content.replace(
    `        if (potholeEffect.active) {`,
    `        if (
          effectiveShowPhysics &&
          potholeEffect.active
        ) {`,
  );

  return {
    ...file,
    content,
  };
}

const stableImpactPoseAR = stableImpactPose3D
  .replace(
    "entry: ParticipantRenderEntry,",
    "entry: ParticipantEntry,",
  );

function patchARScene(file) {
  let content = file.content;

  if (!content.includes("One suspension compression/rebound cycle")) {
    content = replaceOnce(
      content,
      /function applyImpactPose\([\s\S]*?\n}\n\nexport function createARReconstructionScene\(/,
      `${stableImpactPoseAR}export function createARReconstructionScene(`,
      "stable AR impact pose",
    );
  }

  return {
    ...file,
    content,
  };
}

function writePatchedFiles(filesToWrite) {
  for (const file of filesToWrite) {
    fs.writeFileSync(
      file.absolutePath,
      file.content,
      "utf8",
    );

    console.log(
      `Updated ${file.relativePath}`,
    );
  }
}

function verify(filesToVerify) {
  const byPath = new Map(
    filesToVerify.map((file) => [
      file.relativePath,
      file.content,
    ]),
  );

  const physics =
    byPath.get(files.physics) ?? "";

  const geometry =
    byPath.get(files.geometry) ?? "";

  const playbackDom =
    byPath.get(files.playbackDom) ?? "";

  const editor =
    byPath.get(files.editor) ?? "";

  const threeD =
    byPath.get(files.threeD) ?? "";

  const ar =
    byPath.get(files.ar) ?? "";

  const assertions = [
    [
      physics.includes(
        "[RoadSafe:PostCollisionTransitionV1]",
      ),
      "exact collision transition marker",
    ],
    [
      physics.includes(
        "point.timeSeconds >= impactTime - 0.0001",
      ),
      "exact transition retained in playback",
    ],
    [
      physics.includes(
        "Replace that stale sample with corrected post-impulse states",
      ),
      "secondary collision stale-sample replacement",
    ],
    [
      physics.includes(
        "maximumAngularVelocityDegreesPerSecond",
      ),
      "bounded angular impulse",
    ],
    [
      geometry.includes(
        "participantIds: string[];",
      ),
      "impact participant targeting",
    ],
    [
      playbackDom.includes(
        "Do not add a second screen-space translation shake",
      ),
      "native-frame 2D stability",
    ],
    [
      editor.includes(
        "Position is controlled only by the reconstruction path",
      ),
      "React-render 2D stability",
    ],
    [
      threeD.includes(
        "One suspension compression/rebound cycle",
      ),
      "3D finite recoil",
    ],
    [
      ar.includes(
        "One suspension compression/rebound cycle",
      ),
      "AR finite recoil",
    ],
  ];

  for (const [passed, label] of assertions) {
    if (!passed) {
      throw new Error(
        `Post-patch verification failed: ${label}`,
      );
    }
  }
}

try {
  const loaded = [
    readFile(files.physics),
    readFile(files.geometry),
    readFile(files.playbackDom),
    readFile(files.editor),
    readFile(files.threeD),
    readFile(files.ar),
  ];

  console.log("Current Git blob SHAs:");
  for (const file of loaded) {
    console.log(
      `- ${file.relativePath}: ${gitBlobSha(file.content)}`,
    );
  }

  const alreadyPatched = loaded.every(
    (file) =>
      file.content.includes(
        "[RoadSafe:PostCollisionTransitionV1]",
      ) ||
      ![
        files.physics,
        files.geometry,
        files.playbackDom,
        files.editor,
        files.threeD,
        files.ar,
      ].includes(file.relativePath),
  );

  if (
    loaded[0].content.includes(
      "[RoadSafe:PostCollisionTransitionV1]",
    ) &&
    loaded[1].content.includes(
      "participantIds: string[];",
    ) &&
    loaded[2].content.includes(
      "Do not add a second screen-space translation shake",
    ) &&
    loaded[3].content.includes(
      "Position is controlled only by the reconstruction path",
    ) &&
    loaded[4].content.includes(
      "One suspension compression/rebound cycle",
    ) &&
    loaded[5].content.includes(
      "One suspension compression/rebound cycle",
    )
  ) {
    console.log("");
    console.log(
      "The post-collision stability fix is already applied.",
    );
    process.exit(0);
  }

  const backupRoot =
    backupFiles(loaded);

  const patched = [
    patchPhysicsService(loaded[0]),
    patchImpactEffectState(loaded[1]),
    patchPlaybackDom(loaded[2]),
    patchEditorRender(loaded[3]),
    patchThreeDViewer(loaded[4]),
    patchARScene(loaded[5]),
  ];

  verify(patched);
  writePatchedFiles(patched);

  console.log("");
  console.log(
    "Post-collision stability fix applied successfully.",
  );
  console.log(
    `Backups: ${path.relative(projectRoot, backupRoot)}`,
  );
  console.log("");
  console.log("Run next:");
  console.log("  npm run build");
  console.log("  npm run dev");
} catch (error) {
  console.error("");
  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : error,
  );
  process.exitCode = 1;
}
