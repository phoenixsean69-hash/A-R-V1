import { getAccuracyQuality } from "../../utils/geographicCoordinates";

interface LocationAccuracyBadgeProps {
  accuracyMetres: number | null;
}

export default function LocationAccuracyBadge({
  accuracyMetres,
}: LocationAccuracyBadgeProps) {
  if (accuracyMetres === null) {
    return (
      <span className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-black text-slate-300">
        Waiting for GPS
      </span>
    );
  }

  const quality = getAccuracyQuality(accuracyMetres);
  const classes = {
    Excellent: "border-emerald-600 bg-emerald-950/70 text-emerald-200",
    Good: "border-sky-600 bg-sky-950/70 text-sky-200",
    Acceptable: "border-amber-600 bg-amber-950/70 text-amber-200",
    Poor: "border-rose-700 bg-rose-950/70 text-rose-200",
  }[quality];

  return (
    <span className={`rounded-lg border px-3 py-2 text-xs font-black ${classes}`}>
      {quality} · ±{accuracyMetres.toFixed(1)}m
    </span>
  );
}
