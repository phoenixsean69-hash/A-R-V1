"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import type { RideInspectionDetails } from "@/lib/ride-inspection.service";

type LatLngTuple = [number, number];

interface InspectRidesMapProps {
  ride: RideInspectionDetails;
}

function isCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): latitude is number {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
  );
}

function FitInspectionBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
      return;
    }

    map.fitBounds(points, {
      padding: [36, 36],
      maxZoom: 16,
      animate: false,
    });
  }, [map, points]);

  return null;
}

export function InspectRidesMap({ ride }: InspectRidesMapProps) {
  const expectedRoute = useMemo<LatLngTuple[]>(
    () =>
      ride.expectedRoute
        .filter((point) =>
          isCoordinatePair(point.latitude, point.longitude),
        )
        .map((point) => [point.latitude as number, point.longitude as number]),
    [ride.expectedRoute],
  );

  const travelledPath = useMemo<LatLngTuple[]>(
    () =>
      ride.travelledPath
        .filter((point) =>
          isCoordinatePair(point.latitude, point.longitude),
        )
        .map((point) => [point.latitude as number, point.longitude as number]),
    [ride.travelledPath],
  );

  const pickup = isCoordinatePair(
    ride.pickup.latitude,
    ride.pickup.longitude,
  )
    ? ([ride.pickup.latitude, ride.pickup.longitude] as LatLngTuple)
    : null;

  const destination = isCoordinatePair(
    ride.destination.latitude,
    ride.destination.longitude,
  )
    ? ([ride.destination.latitude, ride.destination.longitude] as LatLngTuple)
    : null;

  const currentLocation = isCoordinatePair(
    ride.currentLocation?.latitude,
    ride.currentLocation?.longitude,
  )
    ? ([
        ride.currentLocation?.latitude as number,
        ride.currentLocation?.longitude as number,
      ] as LatLngTuple)
    : null;

  const allPoints = useMemo<LatLngTuple[]>(
    () => [
      ...expectedRoute,
      ...travelledPath,
      ...(pickup ? [pickup] : []),
      ...(destination ? [destination] : []),
      ...(currentLocation ? [currentLocation] : []),
    ],
    [currentLocation, destination, expectedRoute, pickup, travelledPath],
  );

  const center: LatLngTuple =
    currentLocation ||
    pickup ||
    destination ||
    expectedRoute[0] ||
    travelledPath[0] ||
    [-17.301, 31.331];

  if (allPoints.length === 0) {
    return (
      <div className="flex h-[390px] items-center justify-center bg-gray-100 px-6 text-center dark:bg-gray-950">
        <div>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
            No map coordinates yet
          </p>
          <p className="mt-2 max-w-md text-xs leading-5 text-gray-500 dark:text-gray-400">
            This ride has no pickup, destination, route, or current-location
            coordinates in Appwrite yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[390px] overflow-hidden bg-gray-100 dark:bg-gray-950">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitInspectionBounds points={allPoints} />

        {expectedRoute.length > 1 && (
          <Polyline
            positions={expectedRoute}
            pathOptions={{
              color: "#6b7280",
              weight: 6,
              opacity: 0.85,
              dashArray: "10 10",
            }}
          />
        )}

        {travelledPath.length > 1 && (
          <Polyline
            positions={travelledPath}
            pathOptions={{
              color: "#2563eb",
              weight: 7,
              opacity: 0.95,
            }}
          />
        )}

        {pickup && (
          <CircleMarker
            center={pickup}
            radius={9}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 5,
            }}
          >
            <Popup>
              <strong>Pickup</strong>
              <br />
              {ride.pickup.address || "Pickup point"}
            </Popup>
          </CircleMarker>
        )}

        {destination && (
          <CircleMarker
            center={destination}
            radius={9}
            pathOptions={{
              color: "#111827",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 5,
            }}
          >
            <Popup>
              <strong>Destination</strong>
              <br />
              {ride.destination.address || "Destination point"}
            </Popup>
          </CircleMarker>
        )}

        {currentLocation && (
          <>
            <CircleMarker
              center={currentLocation}
              radius={20}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#2563eb",
                fillOpacity: 0.16,
                weight: 1,
              }}
            />
            <CircleMarker
              center={currentLocation}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                fillColor: ride.monitoring.hasOpenSafetyAlert
                  ? "#dc2626"
                  : "#2563eb",
                fillOpacity: 1,
                weight: 4,
              }}
            >
              <Popup>
                <strong>{ride.driver.name}</strong>
                <br />
                Current driver location
                {ride.currentLocation?.speedKph !== null &&
                  ride.currentLocation?.speedKph !== undefined && (
                    <>
                      <br />
                      {Math.round(ride.currentLocation.speedKph)} km/h
                    </>
                  )}
              </Popup>
            </CircleMarker>
          </>
        )}
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <p className="text-xs font-bold text-gray-900 dark:text-white">
          Live journey map
        </p>
        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
          Blue: travelled path · Gray: expected route
        </p>
      </div>
    </div>
  );
}
