RoadSafe AR — Saira Font V1

This package was prepared against the current A-R-V1 main branch styling, which still used Rajdhani globally.

What it does
- Installs local Saira font files into public/fonts/saira.
- Adds src/styles/saira.css with @font-face mappings for weights 100 through 900 and all italics.
- Changes the global Tailwind theme font from Rajdhani to Saira.
- Keeps weight semantics intact:
  100 Thin
  200 ExtraLight
  300 Light
  400 Regular
  500 Medium
  600 SemiBold
  700 Bold
  800 ExtraBold
  900 Black
- Removes the old external Rajdhani Google Fonts request.
- Leaves Material Symbols unchanged.
- Creates a backup under .roadsafe-ui-backup before changing index.css/index.html.

Install
1. Extract this ZIP.
2. Copy the extracted folder anywhere convenient.
3. Open PowerShell in the A-R-V1 repository root.
4. Run:
   node "FULL_PATH_TO_EXTRACTED_FOLDER\install-saira-font-v1.mjs"
5. Then run:
   npm run build

The font is local, so RoadSafe does not depend on Google Fonts to render Saira.
