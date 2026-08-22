RoadSafe AR — Activate Remaining Forensic Screens V1

This repair is for the case where the sidebar still shows:

2D / 3D / AR   LATER
Findings       LATER
Report         LATER

even though those modules have already been installed.

What it does
- Verifies these files exist:
  ForensicReconstructionWorkspace.tsx
  FindingsWorkspace.tsx
  ReportWorkspace.tsx

- Ensures their imports are present.
- Adds all three sections to the forensic ACTIVE set.
- Ensures their render blocks exist.
- Keeps the existing forensic workflow order unchanged.
- Creates a backup before editing the workspace.

Install
1. Extract this ZIP.
2. Copy:
   roadsafe-activate-remaining-forensic-v1

   into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the A-R-V1 root run:

   node .\roadsafe-activate-remaining-forensic-v1\activate-remaining-forensic-v1.mjs
   npm run build
