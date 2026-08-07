import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  fs.readFileSync(
    path.join(scriptDir, "HQ_MODEL_TARGETS.json"),
    "utf8",
  ),
);

const packagePath = path.join(repoRoot, "package.json");
if (!fs.existsSync(packagePath)) {
  console.error("Run this from C:\\Users\\nooklyweb\\Desktop\\A-R-V1");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (packageJson.name !== "roadsafe-ar") {
  console.error(`Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`);
  process.exit(1);
}

const targetRoot = path.join(repoRoot, "model-intake", "hq-upgrade-v1");
const autoRoot = path.join(targetRoot, "automatic");
const manualRoot = path.join(targetRoot, "manual-authenticated-downloads");

fs.mkdirSync(autoRoot, { recursive: true });
fs.mkdirSync(manualRoot, { recursive: true });

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RoadSafeAR-HQ-Intake/1.0";

async function fetchResponse(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
        },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 900));
      }
    }
  }

  throw lastError;
}

function decodeHtml(value) {
  return value
    .replaceAll("\\/", "/")
    .replaceAll("&amp;", "&")
    .replaceAll("&#038;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function absoluteUrl(candidate, sourcePage) {
  try {
    return new URL(decodeHtml(candidate), sourcePage).toString();
  } catch {
    return null;
  }
}

function discoverGlbCandidates(html, sourcePage) {
  const normalized = decodeHtml(html);
  const found = new Set();

  const patterns = [
    /https?:\/\/[^"'<>\\\s]+\.glb(?:\?[^"'<>\\\s]*)?/gi,
    /(?:src|href|url|model|asset)\s*[:=]\s*["']([^"']+\.glb(?:\?[^"']*)?)["']/gi,
    /["'](\/[^"']+\.glb(?:\?[^"']*)?)["']/gi,
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(normalized)) !== null) {
      const candidate = match[1] ?? match[0];
      const url = absoluteUrl(candidate, sourcePage);
      if (url) found.add(url);
    }
  }

  return [...found].filter((url) => !url.includes("placeholder"));
}

async function download(url, outputPath) {
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10_000) {
    console.log(`SKIP ${path.basename(outputPath)} (${fs.statSync(outputPath).size} bytes)`);
    return;
  }

  const response = await fetchResponse(url);

  if (!response.body) {
    throw new Error("No response body.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(`Received HTML instead of GLB from ${url}`);
  }

  const temporary = `${outputPath}.part`;
  fs.rmSync(temporary, { force: true });

  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(temporary),
  );

  const size = fs.statSync(temporary).size;
  if (size < 10_000) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`Downloaded file is suspiciously small (${size} bytes).`);
  }

  fs.renameSync(temporary, outputPath);
  console.log(`DOWNLOADED ${path.basename(outputPath)} (${size} bytes)`);
}

async function discoverAndDownload(source) {
  console.log(`DISCOVER ${source.name}`);

  const page = await fetchResponse(source.sourcePage);
  const html = await page.text();
  const candidates = discoverGlbCandidates(html, source.sourcePage);

  if (candidates.length === 0) {
    throw new Error(`No GLB URL exposed by ${source.sourcePage}`);
  }

  let lastError;

  for (const candidate of candidates) {
    try {
      const outputPath = path.join(autoRoot, source.fileName);
      await download(candidate, outputPath);

      return {
        ...source,
        status: "ready",
        downloadedFile: path
          .relative(repoRoot, outputPath)
          .replaceAll("\\", "/"),
        actualBytes: fs.statSync(outputPath).size,
        discoveredUrl: candidate,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`No usable GLB found for ${source.name}.`);
}

const results = [];

console.log("");
console.log("RoadSafe AR — HQ upgrade intake");
console.log("===============================");
console.log("");

for (const source of config.automaticSources) {
  try {
    results.push(await discoverAndDownload(source));
  } catch (error) {
    console.error(
      `FAIL ${source.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    results.push({
      ...source,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  console.log("");
}

const manualManifestPath = path.join(
  manualRoot,
  "MANUAL_DOWNLOAD_TARGETS.json",
);

fs.writeFileSync(
  manualManifestPath,
  `${JSON.stringify(config.manualAuthenticatedTargets, null, 2)}\n`,
  "utf8",
);

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>RoadSafe HQ Manual Model Downloads</title>
<style>
body{font-family:Arial,sans-serif;background:#202020;color:#eee;max-width:900px;margin:36px auto;padding:0 20px}
.card{border:1px solid #555;background:#292929;padding:16px;margin:12px 0;border-radius:8px}
a{color:#f2a34b}
small{color:#bbb}
</style>
</head>
<body>
<h1>RoadSafe HQ authenticated model targets</h1>
<p>These hosts require your own login for the actual free download. Do not share account tokens/passwords.</p>
${config.manualAuthenticatedTargets.map((item) => `
<div class="card">
<h2>${item.category}: ${item.name}</h2>
<p>${item.why}</p>
<p><strong>License:</strong> ${item.license}</p>
<p><a href="${item.url}" target="_blank">Open source download page</a></p>
<small>${item.downloadConstraint}</small>
</div>`).join("")}
</body>
</html>`;

fs.writeFileSync(
  path.join(manualRoot, "OPEN-MANUAL-DOWNLOADS.html"),
  html,
  "utf8",
);

const report = [
  "RoadSafe AR — HQ UPGRADE REPORT",
  "================================",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "AUTOMATIC DOWNLOADS",
  ...results.flatMap((item) => [
    `[${item.status}] ${item.category} — ${item.name}`,
    `  license: ${item.license}`,
    `  expected geometry: ${item.reportedVertices.toLocaleString()} verts / ${item.reportedTriangles.toLocaleString()} tris`,
    item.downloadedFile ? `  file: ${item.downloadedFile}` : `  error: ${item.error}`,
    "",
  ]),
  "AUTHENTICATED HIGH-QUALITY TARGETS",
  ...config.manualAuthenticatedTargets.flatMap((item) => [
    `${item.category} — ${item.name}`,
    `  provider: ${item.provider}`,
    `  license: ${item.license}`,
    `  page: ${item.url}`,
    `  why: ${item.why}`,
    "",
  ]),
  "IMPORTANT",
  "Do not integrate these automatically.",
  "After downloads, inspect geometry/materials/rigging, then normalize scale/axis/pivot and build LODs.",
  "",
];

fs.writeFileSync(
  path.join(targetRoot, "HQ_UPGRADE_REPORT.txt"),
  report.join("\n"),
  "utf8",
);

fs.writeFileSync(
  path.join(targetRoot, "HQ_UPGRADE_MANIFEST.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), automatic: results, manual: config.manualAuthenticatedTargets }, null, 2)}\n`,
  "utf8",
);

const failures = results.filter((item) => item.status !== "ready");

console.log("===============================");
console.log(`Automatic HQ assets ready: ${results.length - failures.length}/${results.length}`);
console.log(`Manual authenticated targets prepared: ${config.manualAuthenticatedTargets.length}`);
console.log("");
console.log(`Report: model-intake\\hq-upgrade-v1\\HQ_UPGRADE_REPORT.txt`);
console.log(`Manual links: model-intake\\hq-upgrade-v1\\manual-authenticated-downloads\\OPEN-MANUAL-DOWNLOADS.html`);
console.log("");

if (failures.length > 0) {
  console.error("Some automatic HQ assets could not be downloaded. Successful ones were kept.");
  process.exit(1);
}

console.log("PASS: automatic HQ upgrade assets downloaded.");
