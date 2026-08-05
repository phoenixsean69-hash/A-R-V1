import fs from "node:fs";

const filePath =
  "src/utils/reconstructionRoadRouting.ts";

let source =
  fs.readFileSync(
    filePath,
    "utf8",
  ).replace(
    /\r\n/g,
    "\n",
  );

const oldGuard = `  if (
    !activeGeometry ||
    route.length < 2
  ) {
    return route;
  }

  const metricPoints =`;

const newGuard = `  const geometry =
    activeGeometry;

  if (
    !geometry ||
    route.length < 2
  ) {
    return route;
  }

  const metricPoints =`;

if (!source.includes(oldGuard)) {
  throw new Error(
    "Could not locate the activeGeometry guard.",
  );
}

source =
  source.replace(
    oldGuard,
    newGuard,
  );

const activeGeometryUses = [
  `          activeGeometry,
        ),`,
  `      activeGeometry,
    );`,
];

const geometryUses = [
  `          geometry,
        ),`,
  `      geometry,
    );`,
];

for (
  let index = 0;
  index < activeGeometryUses.length;
  index += 1
) {
  if (
    !source.includes(
      activeGeometryUses[index],
    )
  ) {
    throw new Error(
      `Could not locate activeGeometry use ${index + 1}.`,
    );
  }

  source =
    source.replace(
      activeGeometryUses[index],
      geometryUses[index],
    );
}

fs.writeFileSync(
  filePath,
  source,
  "utf8",
);

console.log(
  "✓ activeGeometry captured as a stable local RealSceneGeometry.",
);
