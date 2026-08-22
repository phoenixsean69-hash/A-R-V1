RoadSafe AR — Finish Forensic V2 Repair

Use this after seeing:
  [RoadSafe] FindingsWorkspace.tsx is missing.

This package fixes the actual missing implementation instead of bypassing the check.

It installs:
- forensicFindingsTypes.ts
- forensicFindingsService.ts
- FindingsWorkspace.tsx
- FindingsWorkspace.css
- forensicReportTypes.ts
- forensicReportService.ts
- ReportWorkspace.tsx
- ReportWorkspace.css

It then activates:
- 2D / 3D / AR
- Findings
- Report

It creates a backup of any touched existing files.

Install
1. Extract the ZIP.
2. Copy roadsafe-finish-forensic-v2 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the A-R-V1 root run:
   node .\roadsafe-finish-forensic-v2\finish-forensic-v2.mjs
   npm run build

After a successful build, refresh the app. The last three sidebar items should no longer display LATER.
