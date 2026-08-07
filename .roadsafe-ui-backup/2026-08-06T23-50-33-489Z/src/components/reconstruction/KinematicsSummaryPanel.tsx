import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Gauge,
  RotateCcw,
  Route,
  Timer,
  Zap,
} from "lucide-react";

import type {
  CollisionKinematicsSummary,
  ReconstructionVehicle,
} from "../../types/reconstruction";

interface KinematicsSummaryPanelProps {
  kinematics: CollisionKinematicsSummary;
  participants: ReconstructionVehicle[];
}

function participantName(
  participantId: string,
  participants: ReconstructionVehicle[],
): string {
  return (
    participants.find((participant) => participant.id === participantId)?.name ??
    "Participant"
  );
}

function formatVector(x: number, y: number, unit: string): string {
  return `${x.toFixed(2)}, ${y.toFixed(2)} ${unit}`;
}

function MetricCard({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className="rounded-sm border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[11px] font-black uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <strong className="mt-2 block text-base font-black text-slate-950">
        {value}
      </strong>
      {note && <p className="mt-1 text-[11px] leading-4 text-slate-500">{note}</p>}
    </article>
  );
}

export default function KinematicsSummaryPanel({
  kinematics,
  participants,
}: KinematicsSummaryPanelProps) {
  return (
    <section className="rounded-sm border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
            Collision kinematics
          </p>
          <h3 className="mt-1 text-lg font-black text-blue-950">
            Real-contact energy, impulse and rebound
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-blue-900/75">
            Values are calculated at the actual collision frame. Force is shown as
            an estimated range because it depends on the assumed contact duration.
          </p>
        </div>

        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-blue-900">
          {kinematics.outcome}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Gauge size={15} />}
          label="Relative impact speed"
          value={`${kinematics.relativeImpactSpeedKmh.toFixed(1)} km/h`}
          note={`${kinematics.impactAngleDegrees.toFixed(1)}° approach angle`}
        />
        <MetricCard
          icon={<Activity size={15} />}
          label="Total impulse"
          value={`${kinematics.totalImpulseNs.toFixed(0)} N·s`}
          note={`${kinematics.normalImpulseNs.toFixed(0)} normal · ${kinematics.frictionImpulseNs.toFixed(0)} friction`}
        />
        <MetricCard
          icon={<Zap size={15} />}
          label="Estimated average force"
          value={`${kinematics.estimatedAverageForceRangeKn.minimum.toFixed(1)}–${kinematics.estimatedAverageForceRangeKn.maximum.toFixed(1)} kN`}
          note={`${kinematics.assumedContactDurationRangeMs.minimum.toFixed(0)}–${kinematics.assumedContactDurationRangeMs.maximum.toFixed(0)} ms assumed contact`}
        />
        <MetricCard
          icon={<Route size={15} />}
          label="Energy dissipated"
          value={`${kinematics.dissipatedKineticEnergyKj.toFixed(1)} kJ`}
          note={`${kinematics.totalIncomingKineticEnergyKj.toFixed(1)} kJ in · ${kinematics.totalOutgoingKineticEnergyKj.toFixed(1)} kJ out`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-sm border border-blue-100 bg-white">
        <table className="min-w-[1040px] w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-3 py-2.5">Participant</th>
              <th className="px-3 py-2.5">Speed before → after</th>
              <th className="px-3 py-2.5">Delta-v</th>
              <th className="px-3 py-2.5">Impulse vector</th>
              <th className="px-3 py-2.5">Kinetic energy</th>
              <th className="px-3 py-2.5">Rebound / travel</th>
              <th className="px-3 py-2.5">Time to rest</th>
              <th className="px-3 py-2.5">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {kinematics.participants.map((participant) => (
              <tr
                key={participant.participantId}
                className="border-t border-slate-100 align-top"
              >
                <td className="px-3 py-3">
                  <strong className="text-slate-950">
                    {participantName(participant.participantId, participants)}
                  </strong>
                  <small className="mt-1 block text-slate-500">
                    {participant.massKg.toFixed(0)} kg
                  </small>
                </td>
                <td className="px-3 py-3 font-bold text-slate-800">
                  <span>{participant.incomingSpeedKmh.toFixed(1)} km/h</span>
                  <ArrowRight size={13} className="mx-1 inline" />
                  <span>{participant.outgoingSpeedKmh.toFixed(1)} km/h</span>
                </td>
                <td className="px-3 py-3">
                  <strong>{participant.deltaVMetresPerSecond.toFixed(2)} m/s</strong>
                  <small className="mt-1 block text-slate-500">
                    {formatVector(
                      participant.deltaVelocityMps.x,
                      participant.deltaVelocityMps.y,
                      "m/s",
                    )}
                  </small>
                </td>
                <td className="px-3 py-3">
                  <strong>{participant.impulseMagnitudeNs.toFixed(0)} N·s</strong>
                  <small className="mt-1 block text-slate-500">
                    {formatVector(
                      participant.impulseNs.x,
                      participant.impulseNs.y,
                      "N·s",
                    )}
                  </small>
                </td>
                <td className="px-3 py-3">
                  <strong>
                    {participant.totalIncomingKineticEnergyKj.toFixed(1)} →{" "}
                    {participant.totalOutgoingKineticEnergyKj.toFixed(1)} kJ
                  </strong>
                  <small className="mt-1 block text-slate-500">
                    Rotation: {participant.incomingRotationalKineticEnergyKj.toFixed(2)} →{" "}
                    {participant.outgoingRotationalKineticEnergyKj.toFixed(2)} kJ
                  </small>
                </td>
                <td className="px-3 py-3">
                  <strong>
                    {participant.postImpactTravelDistanceMetres.toFixed(2)} m
                  </strong>
                  <small className="mt-1 block text-slate-500">
                    {participant.postImpactDisplacementMetres.toFixed(2)} m direct displacement
                  </small>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                    <Timer size={13} />
                    {participant.timeToRestSeconds === undefined
                      ? "Not settled"
                      : `${participant.timeToRestSeconds.toFixed(2)} s`}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-black text-blue-900">
                    <RotateCcw size={12} />
                    {participant.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
        The displayed force is an average-force estimate, not a measured peak
        force. Lost kinetic energy is reported as dissipated motion energy and
        must not be described as crush energy without measured deformation and
        vehicle stiffness data.
      </div>
    </section>
  );
}
