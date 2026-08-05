import fs from "node:fs";

const packagePath =
  "package.json";

const packageJson =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      "utf8",
    ),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "physics:verify"
] =
  "node scripts/verify-phase0-foundation.mjs && tsc -p tsconfig.phase0.json";

packageJson.scripts[
  "physics:verify:full"
] =
  "node scripts/verify-phase0-foundation.mjs && npm run build";

fs.writeFileSync(
  packagePath,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(
  "Phase 0 package scripts updated.",
);