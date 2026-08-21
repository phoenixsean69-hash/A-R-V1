import { useMemo, useState } from "react";
import type { AccidentCase } from "../../types/accidentCase";
import {
  EVIDENCE_SOURCE_OPTIONS,
  FORENSIC_CONFIDENCE_OPTIONS,
  FORENSIC_PROVENANCE_OPTIONS,
  PHYSICAL_EVIDENCE_TYPE_OPTIONS,
  type EvidenceSource,
  type ForensicAccidentInvestigation,
  type ForensicConfidence,
  type ForensicProvenance,
  type PhysicalEvidenceType,
} from "./forensicInvestigationTypes";
import { ForensicInvestigationService } from "./forensicInvestigationService";
import "./ForensicInvestigationWorkspace.css";

interface Props {
  accidentCase: AccidentCase;
  initialInvestigation: ForensicAccidentInvestigation;
  onExit(): void;
}

type Section =
  | "Overview"
  | "Scene Intake"
  | "Evidence Registry"
  | "Measurements"
  | "Vehicles"
  | "Persons"
  | "Witnesses"
  | "Analysis"
  | "Hypotheses"
  | "Simulation"
  | "2D / 3D / AR"
  | "Findings"
  | "Report";

const SECTIONS: Section[] = [
  "Overview",
  "Scene Intake",
  "Evidence Registry",
  "Measurements",
  "Vehicles",
  "Persons",
  "Witnesses",
  "Analysis",
  "Hypotheses",
  "Simulation",
  "2D / 3D / AR",
  "Findings",
  "Report",
];

const ACTIVE = new Set<Section>(["Overview", "Scene Intake", "Evidence Registry"]);
const isDerived = (value: ForensicProvenance) =>
  ["Calculated", "AI Derived", "Investigator Assumption", "Simulated"].includes(value);

type SceneChoiceKey =
  | "weather"
  | "lighting"
  | "roadCondition"
  | "trafficControlState"
  | "roadGeometry";

const OTHER_CHOICE = "__other__";

const SCENE_CHOICE_OPTIONS: Record<SceneChoiceKey, readonly string[]> = {
  weather: [
    "Clear",
    "Partly cloudy",
    "Overcast",
    "Light rain",
    "Heavy rain",
    "Thunderstorm",
    "Fog / mist",
    "Dust / haze",
    "Windy",
  ],
  lighting: [
    "Daylight",
    "Dawn",
    "Dusk",
    "Dark - street-lit",
    "Dark - no street lighting",
    "Artificial / temporary lighting",
    "Glare / low sun",
  ],
  roadCondition: [
    "Dry",
    "Wet",
    "Flooded / standing water",
    "Muddy",
    "Loose gravel / loose surface",
    "Oily / contaminated",
    "Uneven / damaged",
    "Potholes present",
  ],
  trafficControlState: [
    "No traffic control",
    "Traffic signals operating",
    "Traffic signals not operating",
    "Stop sign",
    "Give Way / Yield sign",
    "Speed-control signage",
    "Police / manual control",
    "Roadworks / temporary control",
    "Pedestrian crossing control",
  ],
  roadGeometry: [
    "Straight road",
    "Curve / bend",
    "T-junction",
    "Crossroads / 4-way junction",
    "Roundabout",
    "Y-junction / fork",
    "Pedestrian crossing",
    "Bridge / culvert",
    "Incline / downgrade",
    "Multi-lane / divided road",
    "Complex / multiple features",
  ],
};

function findPresetChoice(
  key: SceneChoiceKey,
  value: string,
): string | undefined {
  const normalised = value.trim().toLowerCase();

  return SCENE_CHOICE_OPTIONS[key].find(
    (option) =>
      option.toLowerCase() === normalised,
  );
}

export default function ForensicInvestigationWorkspace({
  accidentCase,
  initialInvestigation,
  onExit,
}: Props) {
  const [investigation, setInvestigation] = useState(initialInvestigation);
  const [section, setSection] = useState<Section>("Overview");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState<EvidenceSource>("Crime Scene");
  const [type, setType] = useState<PhysicalEvidenceType>("Skid Mark");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [provenance, setProvenance] = useState<ForensicProvenance>("Observed");
  const [confidence, setConfidence] = useState<ForensicConfidence>("Unverified");
  const [notes, setNotes] = useState("");

  const [manualSceneChoices, setManualSceneChoices] =
    useState<Set<SceneChoiceKey>>(() => {
      const manual = new Set<SceneChoiceKey>();

      for (const key of Object.keys(SCENE_CHOICE_OPTIONS) as SceneChoiceKey[]) {
        const value = String(initialInvestigation.scene[key] ?? "");

        if (
          value.trim() &&
          !findPresetChoice(key, value)
        ) {
          manual.add(key);
        }
      }

      return manual;
    });

  const completion = useMemo(() => {
    const fields = [
      investigation.scene.location,
      investigation.scene.accidentDate,
      investigation.scene.accidentTime,
      investigation.scene.weather,
      investigation.scene.lighting,
      investigation.scene.roadCondition,
      investigation.scene.trafficControlState,
      investigation.scene.roadGeometry,
    ];
    const done = fields.filter((value) => value.trim()).length;
    return Math.round((done / fields.length) * 100);
  }, [investigation.scene]);

  const saveScene = () => {
    const saved = ForensicInvestigationService.save({
      ...investigation,
      scene: {
        ...investigation.scene,
        lastUpdatedAt: new Date().toISOString(),
      },
    });
    setInvestigation(saved);
    setMessage("Scene intake saved.");
  };

  const addEvidence = () => {
    if (!description.trim() || !location.trim()) {
      setMessage("Evidence needs both a description and exact location/reference.");
      return;
    }
    const saved = ForensicInvestigationService.addEvidence(investigation, {
      source,
      type,
      description: description.trim(),
      locationDescription: location.trim(),
      provenance,
      confidence,
      collected: false,
      notes: notes.trim(),
    });
    setInvestigation(saved);
    setDescription("");
    setLocation("");
    setNotes("");
    setMessage("Evidence registered.");
  };

  const field = (
    label: string,
    key: keyof typeof investigation.scene,
    placeholder = "",
  ) => (
    <label className="fv2-field">
      <span>{label}</span>
      <input
        value={String(investigation.scene[key] ?? "")}
        placeholder={placeholder}
        onChange={(event) =>
          setInvestigation((current) => ({
            ...current,
            scene: { ...current.scene, [key]: event.target.value },
          }))
        }
      />
    </label>
  );

  const sceneChoiceField = (
    label: string,
    key: SceneChoiceKey,
    manualPlaceholder: string,
  ) => {
    const currentValue =
      String(investigation.scene[key] ?? "");

    const preset =
      findPresetChoice(
        key,
        currentValue,
      );

    const manual =
      manualSceneChoices.has(key) ||
      (
        currentValue.trim().length > 0 &&
        !preset
      );

    const selectedValue =
      manual
        ? OTHER_CHOICE
        : preset ?? "";

    return (
      <label className="fv2-field">
        <span>{label}</span>

        <select
          value={selectedValue}
          onChange={(event) => {
            const value =
              event.target.value;

            if (value === OTHER_CHOICE) {
              setManualSceneChoices((current) => {
                const next =
                  new Set(current);

                next.add(key);

                return next;
              });

              setInvestigation((current) => ({
                ...current,
                scene: {
                  ...current.scene,
                  [key]: "",
                },
              }));

              return;
            }

            setManualSceneChoices((current) => {
              const next =
                new Set(current);

              next.delete(key);

              return next;
            });

            setInvestigation((current) => ({
              ...current,
              scene: {
                ...current.scene,
                [key]: value,
              },
            }));
          }}
        >
          <option value="">
            Select...
          </option>

          {SCENE_CHOICE_OPTIONS[key].map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ),
          )}

          <option value={OTHER_CHOICE}>
            Other / specify manually
          </option>
        </select>

        {manual && (
          <input
            value={currentValue}
            placeholder={manualPlaceholder}
            onChange={(event) => {
              setManualSceneChoices((current) => {
                const next =
                  new Set(current);

                next.add(key);

                return next;
              });

              setInvestigation((current) => ({
                ...current,
                scene: {
                  ...current.scene,
                  [key]: event.target.value,
                },
              }));
            }}
          />
        )}
      </label>
    );
  };

  return (
    <div className="fv2-root">
      <header className="fv2-topbar">
        <div>
          <b>ROADSAFE</b>
          <span>Forensic Accident Workspace</span>
          <small>{accidentCase.caseNumber} · {accidentCase.title}</small>
        </div>
        <button onClick={onExit}>Return to case</button>
      </header>

      <div className="fv2-layout">
        <aside className="fv2-sidebar">
          <div className="fv2-sidebar-title">Investigation <small>V2 evidence-first workflow</small></div>
          {SECTIONS.map((item) => (
            <button
              key={item}
              className={`${section === item ? "is-active" : ""} ${ACTIVE.has(item) ? "" : "is-future"}`}
              onClick={() => setSection(item)}
            >
              <span>{item}</span>
              <small>{ACTIVE.has(item) ? "Step 1" : "Later"}</small>
            </button>
          ))}
        </aside>

        <main className="fv2-main">
          {message && <div className="fv2-message">{message}<button onClick={() => setMessage("")}>×</button></div>}

          {section === "Overview" && (
            <div className="fv2-stack">
              <section className="fv2-hero">
                <div>
                  <small>RoadSafe Forensic Reconstruction V2</small>
                  <h1>Evidence before reconstruction</h1>
                  <p>Scene preservation and physical evidence now come first. Physics, 2D, 3D and AR will be generated later as analytical outputs, not treated as the starting truth.</p>
                </div>
                <strong>STEP 1<br /><span>FORENSIC FOUNDATION</span></strong>
              </section>

              <div className="fv2-stats">
                <article><span>Scene intake</span><strong>{completion}%</strong><small>core scene fields</small></article>
                <article><span>Evidence</span><strong>{investigation.evidence.length}</strong><small>registered items</small></article>
                <article><span>Derived / assumed</span><strong>{investigation.evidence.filter((item) => isDerived(item.provenance)).length}</strong><small>kept separate from observation</small></article>
              </div>

              <section className="fv2-panel">
                <header><span>Forensic provenance</span><strong>Every fact must say where it came from</strong></header>
                <div className="fv2-tags">
                  {FORENSIC_PROVENANCE_OPTIONS.map((item) => <span key={item} className={isDerived(item) ? "derived" : ""}>{item}</span>)}
                </div>
              </section>
            </div>
          )}

          {section === "Scene Intake" && (
            <section className="fv2-panel">
              <header><div><span>Scene preservation</span><strong>Initial scene intake</strong></div><button className="primary" onClick={saveScene}>Save scene intake</button></header>
              <div className="fv2-grid">
                {field("Accident location", "location")}
                <label className="fv2-field"><span>Date</span><input type="date" value={investigation.scene.accidentDate} onChange={(e) => setInvestigation((c) => ({...c, scene:{...c.scene, accidentDate:e.target.value}}))} /></label>
                <label className="fv2-field"><span>Time</span><input type="time" value={investigation.scene.accidentTime} onChange={(e) => setInvestigation((c) => ({...c, scene:{...c.scene, accidentTime:e.target.value}}))} /></label>
                {sceneChoiceField(
                  "Weather",
                  "weather",
                  "Enter another weather condition...",
                )}
                {sceneChoiceField(
                  "Lighting",
                  "lighting",
                  "Enter another lighting condition...",
                )}
                {sceneChoiceField(
                  "Road condition",
                  "roadCondition",
                  "Enter another road condition...",
                )}
                {sceneChoiceField(
                  "Traffic-control state",
                  "trafficControlState",
                  "Enter another traffic-control state...",
                )}
                {sceneChoiceField(
                  "Road geometry",
                  "roadGeometry",
                  "Describe the road geometry...",
                )}
                <label className="fv2-field full"><span>Preservation / scene notes</span><textarea rows={7} value={investigation.scene.preservationNotes} onChange={(e) => setInvestigation((c) => ({...c, scene:{...c.scene, preservationNotes:e.target.value}}))} placeholder="Record what was present before anything was moved, collected or towed." /></label>
              </div>
            </section>
          )}

          {section === "Evidence Registry" && (
            <div className="fv2-stack">
              <section className="fv2-panel">
                <header><span>Physical evidence</span><strong>Add evidence record</strong></header>
                <div className="fv2-grid">
                  <label className="fv2-field"><span>Source</span><select value={source} onChange={(e) => setSource(e.target.value as EvidenceSource)}>{EVIDENCE_SOURCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field"><span>Evidence type</span><select value={type} onChange={(e) => setType(e.target.value as PhysicalEvidenceType)}>{PHYSICAL_EVIDENCE_TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field full"><span>Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was observed?" /></label>
                  <label className="fv2-field full"><span>Exact location / reference</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where was it found? Include fixed reference points where possible." /></label>
                  <label className="fv2-field"><span>Provenance</span><select value={provenance} onChange={(e) => setProvenance(e.target.value as ForensicProvenance)}>{FORENSIC_PROVENANCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field"><span>Confidence</span><select value={confidence} onChange={(e) => setConfidence(e.target.value as ForensicConfidence)}>{FORENSIC_CONFIDENCE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="fv2-field full"><span>Notes</span><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
                </div>
                <footer><button className="primary" onClick={addEvidence}>Add evidence</button></footer>
              </section>

              <section className="fv2-panel">
                <header><span>Evidence register</span><strong>{investigation.evidence.length} item(s)</strong></header>
                {investigation.evidence.length === 0 ? <div className="fv2-empty">No evidence registered yet.</div> : (
                  <div className="fv2-tablewrap"><table><thead><tr><th>ID</th><th>Type</th><th>Description</th><th>Location</th><th>Provenance</th><th>Confidence</th><th /></tr></thead><tbody>
                    {investigation.evidence.map((record) => <tr key={record.id}>
                      <td><b>{record.code}</b></td><td>{record.type}<small>{record.source}</small></td><td>{record.description}</td><td>{record.locationDescription}</td><td><span className={`tag ${isDerived(record.provenance) ? "derived" : ""}`}>{record.provenance}</span></td><td>{record.confidence}</td><td><button className="danger" onClick={() => setInvestigation(ForensicInvestigationService.deleteEvidence(investigation, record.id))}>Remove</button></td>
                    </tr>)}
                  </tbody></table></div>
                )}
              </section>
            </div>
          )}

          {!ACTIVE.has(section) && (
            <section className="fv2-panel fv2-coming">
              <small>Forensic Reconstruction V2</small>
              <h1>{section}</h1>
              <p>This module belongs to the new workflow, but it is deliberately not active in Step 1. We are rebuilding in forensic order instead of carrying V1 assumptions forward.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
