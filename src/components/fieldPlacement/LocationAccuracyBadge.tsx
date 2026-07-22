import { getAccuracyQuality } from "../../utils/geographicCoordinates";

interface LocationAccuracyBadgeProps {
  accuracyMetres: number | null;
}

export default function LocationAccuracyBadge({
  accuracyMetres,
}: LocationAccuracyBadgeProps) {
  if (accuracyMetres === null) {
    return (
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
        Waiting for GPS
      </span>
    );
  }

  const quality = getAccuracyQuality(accuracyMetres);
  const classes = {
    Excellent: "bg-emerald-100 text-emerald-800",
    Good: "bg-green-100 text-green-800",
    Acceptable: "bg-amber-100 text-amber-800",
    Poor: "bg-red-100 text-red-800",
  }[quality];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>
      {quality} · ±{accuracyMetres.toFixed(1)}m
    </span>
  );
}
