RoadSafe AR — Forensic Hypotheses V1

1. Extract the ZIP.
2. Copy the folder roadsafe-hypotheses-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1
3. From the A-R-V1 root run:
   node .\roadsafe-hypotheses-v1\install-forensic-hypotheses-v1.mjs
4. Then run:
   npm run build

This activates Hypotheses after Analysis and adds:
- competing crash hypotheses
- fixed Investigator Assumption provenance
- support/conflict evidence links
- missing evidence and assumptions
- proposed impact regions
- proposed event sequence
- side-by-side comparison
- selection for later physics/simulation

The installer creates a backup before modifying files.
