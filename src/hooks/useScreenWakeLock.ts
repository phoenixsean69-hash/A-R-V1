import { useCallback, useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike extends EventTarget {
  released: boolean;
  release: () => Promise<void>;
}

interface WakeLockApiLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

export function useScreenWakeLock(active: boolean): {
  supported: boolean;
  locked: boolean;
  error: string;
} {
  const wakeLockApi =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as unknown as { wakeLock?: WakeLockApiLike }).wakeLock;
  const supported = Boolean(wakeLockApi);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setLocked(false);

    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // The browser may already have released the lock.
      }
    }
  }, []);

  useEffect(() => {
    if (!active || !supported || !wakeLockApi) {
      const timer = window.setTimeout(() => {
        void release();
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;

    void wakeLockApi
      .request("screen")
      .then((sentinel) => {
        if (cancelled) {
          void sentinel.release();
          return;
        }

        sentinelRef.current = sentinel;
        setLocked(true);
        setError("");
        sentinel.addEventListener("release", () => setLocked(false));
      })
      .catch((wakeLockError: unknown) => {
        if (cancelled) return;
        setError(
          wakeLockError instanceof Error
            ? wakeLockError.message
            : "The screen wake lock could not be enabled.",
        );
      });

    return () => {
      cancelled = true;
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release();
      }
    };
  }, [active, release, supported, wakeLockApi]);

  return { supported, locked, error };
}
