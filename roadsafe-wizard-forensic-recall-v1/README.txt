RoadSafe AR — Wizard → Forensic Recall V1

Requirement
If a fact/field was already entered or established in the 4-step case wizard,
the 13-step forensic workflow should not ask the investigator to enter it again.

CURRENT PROBLEM
ForensicInvestigationService.createFromCase currently recalls only:
- case number
- case title
- officer
- police station
- accident location
- accident date
- accident time

It initializes these Scene Intake values blank:
- weather
- lighting
- road condition
- traffic-control state
- road geometry

But the 4-step wizard saves those scene/environment values in the linked
AccidentReconstruction.scene object.

THIS REPAIR
Reads the case's linked reconstruction and recalls genuine overlapping fields.

Mappings:
Wizard weather
→ Scene Intake weather

Wizard timeOfDay
→ Scene Intake lighting
  Day -> Daylight
  Dawn -> Dawn
  Dusk -> Dusk
  Night -> "Night - street-lighting state not yet verified"

Wizard roadSurface
→ Scene Intake road condition
  Dry -> Dry
  Wet -> Wet
  Damaged -> Uneven / damaged

Wizard trafficControl
→ Scene Intake traffic-control state
  None -> No traffic control
  Stop Signs -> Stop sign
  Give Way Signs -> Give Way / Yield sign
  Traffic Lights -> "Traffic lights present - operating state not yet verified"

Wizard roadLayout
→ Scene Intake road geometry

IMPORTANT
The repair ONLY fills blank forensic fields.
Anything the investigator has already edited in the 13-step workflow wins.

It intentionally does NOT auto-fill:
- Fixed reference point
- Measurement directions
- Preservation notes

because those were not established by the 4-step wizard and must remain
investigator-authored forensic information.

It also hydrates EXISTING investigations, so the current case does not need
to be deleted/recreated.

FILE
src/features/forensicReconstruction/forensicInvestigationService.ts

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-wizard-forensic-recall-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-wizard-forensic-recall-v1\install-wizard-forensic-recall-v1.mjs
   npm run build

4. Reopen:
   /cases/<case-id>/reconstruction
