import { getAccuracyQuality } from "../../utils/geographicCoordinates";

interface LocationAccuracyBadgeProps {
  accuracyMetres: number | null;
}

export default function LocationAccuracyBadge({
  accuracyMetres,
}: LocationAccuracyBadgeProps) {
  if (accuracyMetres === null) {
    return <span className="field-mode-accuracy">Waiting for GPS</span>;
  }

  const quality = getAccuracyQuality(accuracyMetres);
  const qualityClass = {
    Excellent: "field-mode-accuracy--excellent",
    Good: "field-mode-accuracy--good",
    Acceptable: "field-mode-accuracy--acceptable",
    Poor: "field-mode-accuracy--poor",
  }[quality];

  return (
    <span className={`field-mode-accuracy ${qualityClass}`}>
      {quality} · ±{accuracyMetres.toFixed(1)}m
    </span>
  );
}
