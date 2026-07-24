export default function ReconstructionGuide() {
  return (
    <details className="mt-5 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none bg-gradient-to-r from-blue-950 via-indigo-900 to-violet-900 px-5 py-4 text-white marker:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Collapsible README
            </p>
            <h2 className="mt-1 text-lg font-black">
              How to Construct and Record Scene Footage on This Page
            </h2>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">
            Open / Close
          </span>
        </div>
      </summary>

      <div className="space-y-6 p-5 text-sm leading-6 text-gray-700">
        <section>
          <h3 className="font-black text-gray-950">1. Confirm the road and physical scale</h3>
          <p className="mt-1">
            Review the detected road layout, lane count, driving side, road rotation and scene dimensions. GPS placement and measurement distances depend on the scene width and height being realistic.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">2. Establish the primary collision point</h3>
          <p className="mt-1">
            Use <strong>Place Collision Point on Scene</strong> to click the physical impact location, or derive a suggestion from participant Impact points. Review the point, add an officer note, confirm it and lock it. The officer remains responsible for approving the marker.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">3. Add participants and define their approach</h3>
          <p className="mt-1">
            Add every vehicle, pedestrian, cyclist, officer or witness. Record where each participant came from and where they were heading. Create path points for Start, Cruise, Brake, Swerve, Impact and Stop, then drag them into position or capture them using Field GPS Placement.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">4. Add hazards, evidence and measurements</h3>
          <p className="mt-1">
            Place potholes, poles, barriers, parked vehicles, oil, gravel, debris, skid marks and evidence markers. Trace curved skid marks manually or by walking with GPS. Add measurements between braking, impact and final-rest positions.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">5. Run physics assistance</h3>
          <p className="mt-1">
            Confirm participant masses, collision parameters and the assumed contact-duration range, then run physics. RoadSafe preserves the officer-authored route, keeps post-impact solver samples internal, and calculates impulse, kinetic-energy change, estimated average force, delta-v and post-impact travel distance.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">6. Review playback and the accident sequence</h3>
          <p className="mt-1">
            Use the timeline slider, Play, Pause and slow-motion controls. Confirm that participants reach the primary collision point at compatible times, interact with hazards correctly and stop in plausible final positions. Edit generated points whenever field evidence indicates a different result.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">7. Save before recording</h3>
          <p className="mt-1">
            Press <strong>Save Reconstruction</strong>. Confirm that the case contains participants, evidence, measurements, timeline events, field GPS records and reviewed kinematics. Internal physics samples remain hidden from the investigator route-point list while still driving 2D, 3D and footage playback.
          </p>
        </section>

        <section>
          <h3 className="font-black text-gray-950">8. Construct the final footage</h3>
          <ol className="mt-2 space-y-2 pl-5">
            <li><strong>1.</strong> Press <strong>Record Footage</strong>.</li>
            <li><strong>2.</strong> Choose 720p or 1080p and the required playback speed.</li>
            <li><strong>3.</strong> Decide whether to show movement paths, measurements, evidence markers and event captions.</li>
            <li><strong>4.</strong> Start recording and allow the countdown to finish.</li>
            <li><strong>5.</strong> Do not edit the reconstruction while recording.</li>
            <li><strong>6.</strong> Preview the result, then save it to the linked accident case.</li>
            <li><strong>7.</strong> Open <strong>Saved Footage</strong> to replay, download or mark a recording as primary.</li>
          </ol>
        </section>

        <section className="rounded-sm border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <h3 className="font-black">Quality checklist before final footage</h3>
          <p className="mt-1">
            Collision point confirmed and locked · Participant origin and destination completed · Impact times aligned · Speeds reviewed · Potholes and solid objects positioned · Evidence documented · Physics output reviewed · Final resting positions checked · Reconstruction saved.
          </p>
        </section>
      </div>
    </details>
  );
}
