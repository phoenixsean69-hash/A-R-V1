import { useEffect, useState } from "react";

import { ReconstructionFootageService } from "../../services/reconstructionFootageService";
import type { ReconstructionFootage } from "../../types/reconstructionFootage";

interface FootagePlayerProps {
  footage: ReconstructionFootage;
  className?: string;
}

type FootagePlayerSourceProps = FootagePlayerProps;

function FootagePlayerSource({
  footage,
  className = "",
}: FootagePlayerSourceProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    ReconstructionFootageService.createObjectUrl(footage.id)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }

        if (!url) {
          setErrorMessage(
            "The saved video file is missing from browser storage.",
          );
          return;
        }

        createdUrl = url;
        setObjectUrl(url);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the footage.",
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
      <div
        className={`flex aspect-video items-center justify-center rounded-md border border-[#1d2c4b] bg-[#050914] text-sm font-bold text-white ${className}`}
      >
        Loading reconstruction footage…
      </div>
    );
  }

  if (errorMessage || !objectUrl) {
    return (
      <div
        className={`flex aspect-video items-center justify-center rounded-md border border-[#713646] bg-[#321722] p-6 text-center text-sm font-semibold text-[#e7a0af] ${className}`}
      >
        {errorMessage || "The footage cannot be played."}
      </div>
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      poster={footage.thumbnailDataUrl}
      onError={() => setErrorMessage(
        `This browser could not decode ${footage.mimeType || "the saved video format"}. Download the recording to preserve the original file.`,
      )}
      className={`aspect-video w-full rounded-md border border-[#1d2c4b] bg-black ${className}`}
    >
      <source src={objectUrl} type={footage.mimeType || "video/webm"} />
      Your browser does not support HTML video playback.
    </video>
  );
}

export default function FootagePlayer(props: FootagePlayerProps) {
  return <FootagePlayerSource key={props.footage.id} {...props} />;
}
