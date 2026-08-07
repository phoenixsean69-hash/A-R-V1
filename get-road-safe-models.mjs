import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const packagePath = path.join(repoRoot, "package.json");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceConfigPath = path.join(scriptDir, "MODEL_SOURCES.json");

if (!fs.existsSync(packagePath)) {
  console.error("Run this script from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (packageJson.name !== "roadsafe-ar") {
  console.error(`Expected package "roadsafe-ar", found "${packageJson.name ?? "unknown"}".`);
  process.exit(1);
}

if (!fs.existsSync(sourceConfigPath)) {
  console.error("MODEL_SOURCES.json is missing beside this script.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8"));
const force = process.argv.includes("--force");
const directOnly = process.argv.includes("--direct-only");

const intakeRoot = path.join(repoRoot, "model-intake");
const rawRoot = path.join(intakeRoot, "raw");
const extractedRoot = path.join(intakeRoot, "extracted");
const reportsRoot = path.join(intakeRoot, "reports");

for (const directory of [intakeRoot, rawRoot, extractedRoot, reportsRoot]) {
  fs.mkdirSync(directory, { recursive: true });
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 RoadSafeARModelIntake/1.0";

function humanBytes(bytes) {
  if (!Number.isFinite(bytes)) return "unknown";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

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
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }
  }
  throw lastError;
}

async function downloadFile(url, outputPath) {
  if (!force && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10_000) {
    console.log(`SKIP ${path.basename(outputPath)} (${humanBytes(fs.statSync(outputPath).size)})`);
    return {
      downloaded: false,
      bytes: fs.statSync(outputPath).size,
      url,
    };
  }

  const temporary = `${outputPath}.part`;
  fs.rmSync(temporary, { force: true });

  const response = await fetchResponse(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/html") && !outputPath.toLowerCase().endsWith(".html")) {
    throw new Error(`Expected model/archive but received HTML from ${url}`);
  }

  if (!response.body) {
    throw new Error(`No response body from ${url}`);
  }

  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(temporary),
  );

  const size = fs.statSync(temporary).size;
  if (size < 1_000) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`Downloaded file is suspiciously small (${size} bytes): ${url}`);
  }

  fs.renameSync(temporary, outputPath);
  console.log(`DOWNLOADED ${path.basename(outputPath)} (${humanBytes(size)})`);

  return {
    downloaded: true,
    bytes: size,
    url: response.url || url,
    contentType,
  };
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

async function discoverAndDownloadGlb(source, outputPath) {
  console.log(`DISCOVER ${source.name}`);
  const pageResponse = await fetchResponse(source.sourcePage);
  const html = await pageResponse.text();
  const candidates = discoverGlbCandidates(html, source.sourcePage);

  if (candidates.length === 0) {
    throw new Error(`No .glb URL exposed in page HTML: ${source.sourcePage}`);
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const result = await downloadFile(candidate, outputPath);
      return {
        ...result,
        discoveredFrom: source.sourcePage,
        candidateCount: candidates.length,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`No usable GLB candidate found for ${source.id}`);
}

function powerShellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function expandZip(zipPath, destination) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Archive does not exist: ${zipPath}`);
  }

  fs.mkdirSync(destination, { recursive: true });

  /*
   * Windows 10/11 ships bsdtar as tar.exe and it can extract ZIP archives.
   * Prefer it because arguments are passed directly by execFileSync, avoiding
   * PowerShell's -Command positional-argument ambiguity.
   */
  try {
    execFileSync(
      "tar.exe",
      [
        "-xf",
        zipPath,
        "-C",
        destination,
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
        windowsHide: true,
      },
    );

    return;
  } catch {
    console.warn(
      `tar.exe extraction failed for ${path.basename(zipPath)}; trying PowerShell fallback...`,
    );
  }

  /*
   * Fallback: inject fully quoted literal paths into the command itself.
   * V1 incorrectly referenced $args[0]/$args[1]; powershell.exe -Command did
   * not populate those values in this invocation style.
   */
  const command =
    `Expand-Archive -LiteralPath ${powerShellLiteral(zipPath)} ` +
    `-DestinationPath ${powerShellLiteral(destination)} -Force`;

  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        command,
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
        windowsHide: true,
      },
    );
  } catch {
    throw new Error(
      `Could not extract ${path.basename(zipPath)} with tar.exe or PowerShell.`,
    );
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(absolute));
    } else if (entry.isFile()) {
      output.push(absolute);
    }
  }
  return output;
}

const MODEL_EXTENSIONS = new Set([
  ".glb",
  ".gltf",
  ".fbx",
  ".obj",
  ".blend",
  ".dae",
  ".stl",
]);

function modelFilesUnder(directory) {
  return walk(directory)
    .filter((file) => MODEL_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"));
}

const results = [];
let requiredFailures = 0;

console.log("");
console.log("RoadSafe AR — HQ/free model intake V2");
console.log("==================================");
console.log(`Target: ${intakeRoot}`);
console.log("");

for (const source of config.sources) {
  if (directOnly && source.kind === "discover-glb") continue;

  const record = {
    id: source.id,
    name: source.name,
    license: source.license,
    sourcePage: source.sourcePage,
    categories: source.categories,
    tier: source.tier,
    required: Boolean(source.required),
    status: "pending",
  };

  try {
    if (source.kind === "archive") {
      const outputPath = path.join(rawRoot, source.fileName);
      const download = await downloadFile(source.downloadUrl, outputPath);

      const destination = path.join(extractedRoot, source.id);
      console.log(`EXTRACT ${source.fileName}`);
      expandZip(outputPath, destination);

      const extractedFiles = walk(destination);
      if (extractedFiles.length === 0) {
        throw new Error(
          `Archive extracted but produced no files: ${source.fileName}`,
        );
      }

      console.log(
        `EXTRACTED ${source.fileName} (${extractedFiles.length} file(s))`,
      );

      record.status = "ready";
      record.downloadUrl = download.url;
      record.bytes = fs.statSync(outputPath).size;
      record.rawFile = path.relative(repoRoot, outputPath).replaceAll("\\", "/");
      record.extractedTo = path.relative(repoRoot, destination).replaceAll("\\", "/");
      record.modelFiles = modelFilesUnder(destination);
    } else if (source.kind === "discover-glb") {
      const outputPath = path.join(rawRoot, source.fileName);
      const download = await discoverAndDownloadGlb(source, outputPath);

      const destination = path.join(extractedRoot, source.id);
      fs.mkdirSync(destination, { recursive: true });
      const copiedPath = path.join(destination, source.fileName);
      fs.copyFileSync(outputPath, copiedPath);

      record.status = "ready";
      record.downloadUrl = download.url;
      record.bytes = fs.statSync(outputPath).size;
      record.rawFile = path.relative(repoRoot, outputPath).replaceAll("\\", "/");
      record.extractedTo = path.relative(repoRoot, destination).replaceAll("\\", "/");
      record.modelFiles = [path.relative(repoRoot, copiedPath).replaceAll("\\", "/")];
    } else {
      throw new Error(`Unknown source kind "${source.kind}"`);
    }
  } catch (error) {
    record.status = source.required ? "FAILED_REQUIRED" : "unavailable_optional";
    record.error = error instanceof Error ? error.message : String(error);

    if (source.required) {
      requiredFailures += 1;
      console.error(`FAIL ${source.name}: ${record.error}`);
    } else {
      console.warn(`OPTIONAL SKIP ${source.name}: ${record.error}`);
    }
  }

  results.push(record);
  console.log("");
}

const manifest = {
  generatedAt: new Date().toISOString(),
  repo: packageJson.name,
  intakeRoot: path.relative(repoRoot, intakeRoot).replaceAll("\\", "/"),
  requiredFailures,
  results,
};

const manifestPath = path.join(intakeRoot, "MODEL_INTAKE_MANIFEST.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const allModels = results.flatMap((result) =>
  (result.modelFiles ?? []).map((file) => ({
    sourceId: result.id,
    license: result.license,
    tier: result.tier,
    file,
  })),
);

const extensionCounts = {};
for (const item of allModels) {
  const ext = path.extname(item.file).toLowerCase() || "(none)";
  extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
}

const reportLines = [
  "RoadSafe AR — MODEL INTAKE REPORT",
  "=================================",
  "",
  `Generated: ${manifest.generatedAt}`,
  `Sources ready: ${results.filter((item) => item.status === "ready").length}/${results.length}`,
  `Required failures: ${requiredFailures}`,
  `Candidate model files: ${allModels.length}`,
  "",
  "Model file counts:",
  ...Object.entries(extensionCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ext, count]) => `  ${ext}: ${count}`),
  "",
  "Sources:",
  ...results.flatMap((result) => [
    `  [${result.status}] ${result.name}`,
    `    license: ${result.license}`,
    `    tier: ${result.tier}`,
    `    candidates: ${(result.modelFiles ?? []).length}`,
    result.error ? `    note: ${result.error}` : null,
  ].filter(Boolean)),
  "",
  "Candidate files:",
  ...allModels.map((item) => `  ${item.file}  [${item.license}; ${item.tier}]`),
  "",
  "NEXT STEP:",
  "Do not move these into public/assets yet.",
  "First review MODEL_INTAKE_REPORT.txt and choose one source model per RoadSafe asset category.",
  "Then normalize scale, forward axis, ground pivot, materials and triangle budget before runtime integration.",
  "",
];

const reportPath = path.join(reportsRoot, "MODEL_INTAKE_REPORT.txt");
fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");

const sourceSnapshotPath = path.join(intakeRoot, "SOURCE_PROVENANCE.json");
fs.writeFileSync(
  sourceSnapshotPath,
  `${JSON.stringify(config, null, 2)}\n`,
  "utf8",
);

console.log("==================================");
console.log("MODEL INTAKE COMPLETE");
console.log(`Ready sources: ${results.filter((item) => item.status === "ready").length}/${results.length}`);
console.log(`Candidate model files: ${allModels.length}`);
console.log(`Required failures: ${requiredFailures}`);
console.log("");
console.log(`Manifest: ${path.relative(repoRoot, manifestPath)}`);
console.log(`Report:   ${path.relative(repoRoot, reportPath)}`);
console.log("");

if (requiredFailures > 0) {
  console.error("One or more core CC0 sources failed. Successful downloads were kept.");
  process.exit(1);
}

console.log("PASS: core free/CC0 model intake is present.");
console.log("");
console.log("Paste the final report summary back into ChatGPT before model integration.");
