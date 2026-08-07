import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const mainPath = path.join(root, "src/main.tsx");
const cssPath = path.join(
  root,
  "src/styles/reconstruction2dTheme.css",
);

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this rollback from the RoadSafe repository root.",
  );
  process.exit(1);
}

if (fs.existsSync(mainPath)) {
  const current = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cleaned = current
    .replace(
      /^\s*import\s+["']\.\/styles\/reconstruction2dTheme\.css["'];?\s*$/gm,
      "",
    )
    .replace(/\n{3,}/g, "\n\n");

  fs.writeFileSync(
    mainPath,
    cleaned,
    "utf8",
  );

  console.log(
    "REMOVED reconstruction2dTheme.css import from src/main.tsx",
  );
}

if (fs.existsSync(cssPath)) {
  fs.rmSync(cssPath, {
    force: true,
  });

  console.log(
    "REMOVED src/styles/reconstruction2dTheme.css",
  );
}

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(
    "The 2D theme was revoked, but another existing build error remains.",
  );
  process.exit(1);
}

console.log(
  "RoadSafe 2D theme alignment has been revoked.",
);
