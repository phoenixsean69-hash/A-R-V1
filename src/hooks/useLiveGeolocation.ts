import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GeoCoordinate } from "../types/fieldPlacement";

export type GeolocationPermissionState =
  | PermissionState
  | "unsupported"
  | "unknown";

export interface LiveGeolocationState {
  supported: boolean;
  permission: GeolocationPermissionState;
  isWatching: boolean;
  current: GeoCoordinate | null;
  error: string;
  sampleCount: number;
  start: () => void;
  stop: () => void;
  clearSamples: () => void;
  getSamplesSince: (timestampMilliseconds: number) => GeoCoordinate[];
}

function positionToCoordinate(position: GeolocationPosition): GeoCoordinate {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMetres: position.coords.accuracy,
    altitudeMetres: position.coords.altitude,
    headingDegrees: position.coords.heading,
    speedMetresPerSecond: position.coords.speed,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

export function useLiveGeolocation(): LiveGeolocationState {
  const supported =
    typeof navigator !== "undefined" && "geolocation" in navigator;
  const watchIdRef = useRef<number | null>(null);
  const samplesRef = useRef<GeoCoordinate[]>([]);

  const [permission, setPermission] =
    useState<GeolocationPermissionState>(supported ? "unknown" : "unsupported");
  const [isWatching, setIsWatching] = useState(false);
  const [current, setCurrent] = useState<GeoCoordinate | null>(null);
  const [error, setError] = useState("");
  const [sampleCount, setSampleCount] = useState(0);

  useEffect(() => {
    if (!supported || !("permissions" in navigator)) return;

    let active = true;
    let permissionStatus: PermissionStatus | null = null;

    void navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (!active) return;
        permissionStatus = status;
        setPermission(status.state);
        status.onchange = () => setPermission(status.state);
      })
      .catch(() => setPermission("unknown"));

    return () => {
      active = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && supported) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, [supported]);

  const start = useCallback(() => {
    if (!supported || watchIdRef.current !== null) return;

    setError("");
    setIsWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinate = positionToCoordinate(position);
        samplesRef.current = [...samplesRef.current.slice(-199), coordinate];
        setSampleCount(samplesRef.current.length);
        setCurrent(coordinate);
        setError("");
      },
      (positionError) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. Allow location access in the browser and try again.",
          2: "The device could not determine its location. Move outdoors or enable device location services.",
          3: "The location request timed out. Keep the device still and try again.",
        };
        setError(
          messages[positionError.code] ??
            positionError.message ??
            "Unable to read the current location.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1_000,
        timeout: 20_000,
      },
    );
  }, [supported]);

  const clearSamples = useCallback(() => {
    samplesRef.current = [];
    setSampleCount(0);
  }, []);

  const getSamplesSince = useCallback((timestampMilliseconds: number) => {
    return samplesRef.current.filter(
      (sample) =>
        new Date(sample.capturedAt).getTime() >= timestampMilliseconds,
    );
  }, []);

  useEffect(() => stop, [stop]);

  return {
    supported,
    permission,
    isWatching,
    current,
    error,
    sampleCount,
    start,
    stop,
    clearSamples,
    getSamplesSince,
  };
}
