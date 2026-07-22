import { useEffect, useState } from "react";

import { ReconstructionFootageService } from "../../services/reconstructionFootageService";
import type { ReconstructionFootage } from "../../types/reconstructionFootage";

interface FootagePlayerProps {
  footage: ReconstructionFootage;
  className?: string;
}

export default function FootagePlayer({ footage, className = "" }: FootagePlayerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setErrorMessage("");

    ReconstructionFootageService.createObjectUrl(footage.id)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }

        if (!url) {
          setErrorMessage("The saved video file is missing from browser storage.");
          return;
        }

        createdUrl = url;
        setObjectUrl(url);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load the footage.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [footage.id]);

  if (loading) {
    return (
      <div className={`flex aspect-video items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white ${className}`}>
        Loading reconstruction footage…
      </div>
    );
  }

  if (errorMessage || !objectUrl) {
    return (
      <div className={`flex aspect-video items-center justify-center rounded-xl border border-red-300 bg-red-50 p-6 text-center text-sm font-semibold text-red-800 ${className}`}>
        {errorMessage || "The footage cannot be played."}
      </div>
    );
  }

  return (
    <video
      src={objectUrl}
      controls
      playsInline
      preload="metadata"
      poster={footage.thumbnailDataUrl}
      className={`aspect-video w-full rounded-xl bg-black ${className}`}
    />
  );
}
