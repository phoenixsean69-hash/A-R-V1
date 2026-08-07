RoadSafe AR — MODEL INTAKE V2 EXTRACTION FIX
==============================================

Your V1 downloads are reusable. Do NOT delete model-intake/raw.

V1 extraction bug:
  Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1]

In this powershell.exe -Command invocation, $args[0] and $args[1] were empty.

V2 extraction:
1. Tries Windows tar.exe first:
     tar.exe -xf <zip> -C <destination>
2. If tar.exe fails, falls back to Expand-Archive with fully quoted literal
   paths embedded directly in the PowerShell command.
3. Verifies that extraction produced files.
4. Reuses already-downloaded archives automatically, so the 33 MB human bundle
   and all vehicle packs are not downloaded again.

Run:
  cd C:\Users\nooklyweb\Desktop\A-R-V1
  node .\get-road-safe-models.mjs

Expected reuse lines:
  SKIP human-base-meshes-bundle-v1.0.0.zip (...)
  EXTRACT ...
  EXTRACTED ...

RoadSafe AR — HQ / FREE MODEL INTAKE V2
==========================================

PURPOSE
-------
Get the actual external source models into the A-R-V1 repository BEFORE any
more renderer/integration work.

This package DOES NOT edit src/, package.json, physics, timeline, or UI.

It creates:
  model-intake/
    raw/
    extracted/
    reports/
    MODEL_INTAKE_MANIFEST.json
    SOURCE_PROVENANCE.json

WHY MULTIPLE SOURCES?
---------------------
There is no single free CC0 library that gives every RoadSafe category at the
same realism/quality level.

The intake therefore collects:
1. Blender Studio Human Base Meshes
   - highest-detail human source in this intake
   - realistic male/female base meshes
   - CC0

2. Kenney Car Kit
   - clean glTF vehicle source
   - CC0
   - useful vehicle parts/wheels/debris

3. RGSDev Vehicles
   - sedan, hatchback, SUV, pickup, truck, truck+trailer, bus
   - separated wheels
   - CC0

4. Byzmod Vehicle Pack
   - cars, trucks, bus, van, motorcycle
   - CC0
   - also attempts the source's optional original/non-flat-shaded car archive

5. Quaternius Public Transport
   - bus/bicycle/public transport candidates
   - CC0

6. Quaternius Animated Human
   - rigged/animated reference model
   - walk/run/idle/etc
   - CC0

7. Optional public-domain GLB discovery
   - car
   - pickup
   - truck
   - motorcycle
   The downloader checks the source page HTML for an exposed .glb URL.
   These are optional: if a site hides the binary behind JavaScript, the core
   intake still succeeds.

INSTALL / DOWNLOAD
------------------
1. Extract this ZIP into:
   C:\Users\nooklyweb\Desktop\A-R-V1

2. Run from the repository root:

   node .\get-road-safe-models.mjs

   OR:

   powershell -ExecutionPolicy Bypass -File .\get-road-safe-models.ps1

3. Wait for downloads/extraction.

4. At the end you should see:

   PASS: core free/CC0 model intake is present.

5. Then inspect:

   model-intake\reports\MODEL_INTAKE_REPORT.txt

RE-RUN
------
Existing downloads larger than 10 KB are skipped.

Force re-download:
   node .\get-road-safe-models.mjs --force

Skip optional page-scraped GLB discovery:
   node .\get-road-safe-models.mjs --direct-only

IMPORTANT
---------
Do NOT manually move everything into public/assets/models.

These are source candidates. Next we select ONE suitable model per RoadSafe
asset category, then normalize:
- physical scale
- forward axis
- ground pivot
- material naming
- colourable body material
- wheel separation
- LOD/triangle budget
- legal/source metadata

After that, only the approved normalized runtime assets go into the app.

LICENSE / SOURCE POLICY
-----------------------
The automatic core intake is limited to CC0/Public Domain sources. The model
files themselves remain governed by their source license. SOURCE_PROVENANCE.json
keeps the source pages and license labels alongside the intake.
