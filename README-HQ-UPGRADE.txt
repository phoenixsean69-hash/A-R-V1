RoadSafe AR — HQ MODEL UPGRADE INTAKE V1
==========================================

WHY THIS EXISTS
---------------
The first 229-file intake was useful, but binary inspection showed many final
shortlist vehicles are still too low-detail for the visual quality target.

This package DOES NOT edit the RoadSafe app.

It does two things:

1. Automatically pulls stronger legally-labelled GLB candidates where the
   source exposes a direct GLB without an account:
   - higher-detail city bus
   - bus LOD candidate
   - higher-detail heavy truck
   - denser hatchback
   - alternate passenger-car body

2. Creates one HTML page containing the exact stronger free targets that
   require YOUR OWN authenticated Sketchfab/CGTrader download.

We deliberately do not ask for or handle passwords, tokens or session cookies.

RUN
---
Extract into:
C:\Users\nooklyweb\Desktop\A-R-V1

Then:

cd C:\Users\nooklyweb\Desktop\A-R-V1
node .\get-road-safe-hq-upgrade.mjs

OUTPUT
------
model-intake\hq-upgrade-v1\automatic\
model-intake\hq-upgrade-v1\HQ_UPGRADE_REPORT.txt
model-intake\hq-upgrade-v1\manual-authenticated-downloads\OPEN-MANUAL-DOWNLOADS.html

After the automatic step, open:

model-intake\hq-upgrade-v1\manual-authenticated-downloads\OPEN-MANUAL-DOWNLOADS.html

Download the chosen free authenticated assets into:

model-intake\hq-upgrade-v1\manual-authenticated-downloads\files\

Do not send passwords or API tokens.

NEXT
----
Once the high-quality source files are present, we make the approved runtime
set: normalized GLB, metric scale, standard forward axis, grounded pivot,
colorable body material, separated wheels where possible, and High/Medium/Low
visual LODs.
