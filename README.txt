RoadSafe AR — Station Overview Panel Standard

The Station Overview inspector is now the canonical design for:

- every right-side context inspector;
- every bottom panel;
- reconstruction participant editors;
- route-point editors;
- playback strips;
- timelines;
- future evidence and properties trays.

Design rules

- No large navy or blue backgrounds.
- Panel surface: charcoal #292929.
- Section surface: #303030.
- Section headers: #282828.
- Inputs: #202020.
- Controls: compact gray Blender-style bevels.
- Selection and keyboard focus: orange #E8872D.
- Destructive actions: restrained dark red only.
- Participant colour swatches remain true to the selected participant colour
  because they represent case data rather than interface decoration.

Full replacement files

- src/components/reconstruction/AccidentReconstructionEditor.tsx
- src/styles/reconstruction2DWorkstation.css
- src/styles/workstationPanelSystem.css
- src/main.tsx

Controlled local transformation

- src/components/reconstruction/ParticipantPathPanel.tsx

The installer removes only the embedded legacy navy/blue <style> block from
ParticipantPathPanel.tsx. All route, speed, GPS, physics and point-editing logic
is preserved.

Install

Extract into:

C:\Users\nooklyweb\Desktop\A-R-V1

Run:

node install-station-panel-reconstruction.mjs

The installer runs npm run build. If the build fails, every changed file is
restored automatically.

Start:

npm run dev

Rollback:

node revoke-station-panel-reconstruction.mjs
