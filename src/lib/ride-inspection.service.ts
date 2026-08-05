"use client";

import { Functions } from "appwrite";

import { rawClient } from "@/lib/appwrite/config";

const functions = new Functions(rawClient);

const rideInspectionFunctionId =
  process.env.NEXT_PUBLIC_APPWRITE_RIDES_DRIVER_FUNCTION_ID?.trim() ||
  "rides-driver-api";

type HttpMethod = "GET";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface FunctionExecutionLike {
  responseStatusCode?: number;
  responseBody?: string;
  response?: string;
  stdout?: string;
}

interface FunctionsAdapter {
  createExecution(args: {
    functionId: string;
    body: string;
    async: boolean;
    xpath: string;
    method: HttpMethod;
    headers: Record<string, string>;
  }): Promise<FunctionExecutionLike>;
}

export interface RideInspectionPoint {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface RideInspectionDriver {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  status: string;
  verificationStatus: string;
  isOnline: boolean;
  rating: number | null;
  completedTrips: number | null;
  lastSeenAt: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface RideInspectionVehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  color: string;
  capacity: number;
  availableSeats: number;
  vehicleType: string;
  status: string;
  conditionStatus: string;
  roadworthinessStatus: string;
  hasSeatbelts: boolean | null;
  hasAirConditioning: boolean | null;
  allowsLuggage: boolean | null;
}

export interface RideInspectionStudent {
  id: string;
  name: string;
  phone: string;
}

export interface RideInspectionLocation {
  id: string;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speedKph: number | null;
  accuracyMeters: number | null;
  recordedAt: string | null;
  sequence: number | null;
  source: string;
  batteryLevel: number | null;
  networkType: string;
  isMocked: boolean | null;
}

export interface RideInspectionCounts {
  bookings: number;
  openIncidents: number;
  openSafetyAlerts: number;
  routePoints: number;
  travelledPoints: number;
}

export interface RideInspectionMonitoring {
  hasLocation: boolean;
  locationAgeSeconds: number | null;
  locationFresh: boolean;
  locationStale: boolean;
  locationCriticallyStale: boolean;
  overdue: boolean;
  overdueMinutes: number;
  hasBookingData: boolean;
  hasTravelledPath: boolean;
  hasExpectedRoute: boolean;
  hasOpenIncident: boolean;
  hasOpenSafetyAlert: boolean;
}

export interface RideInspectionSummary {
  id: string;
  organizationId: string;
  status: string;
  rideType: string;
  schoolLocation: string;
  departureTime: string | null;
  estimatedArrivalTime: string | null;
  startedAt: string | null;
  passengerCount: number;
  pickup: RideInspectionPoint;
  destination: RideInspectionPoint;
  driver: RideInspectionDriver;
  vehicle: RideInspectionVehicle;
  student: RideInspectionStudent | null;
  currentLocation: RideInspectionLocation | null;
  counts: RideInspectionCounts;
  monitoring: RideInspectionMonitoring;
  updatedAt: string | null;
}

export interface RideInspectionBooking {
  id: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  status: string;
  seatCount: number;
  pickupAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  destinationAddress: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  paymentStatus: string;
  bookingReference: string;
  bookedAt: string | null;
  boardedAt: string | null;
  trackingStartedAt: string | null;
  trackingEndedAt: string | null;
}

export interface RideInspectionIncident {
  id: string;
  category: string;
  description: string;
  reporterType: string;
  status: string;
  priority: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface RideInspectionEvent {
  id: string;
  eventType: string;
  message: string;
  actorType: string;
  createdAt: string | null;
}

export interface RideInspectionSafetyAlert {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  expectedLatitude: number | null;
  expectedLongitude: number | null;
  actualLatitude: number | null;
  actualLongitude: number | null;
  distanceFromRouteMeters: number | null;
  deviationDurationSeconds: number | null;
  driverExplanation: string;
  studentResponse: string;
  detectedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface RideInspectionWaypoint {
  id: string;
  waypointType: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  stopOrder: number | null;
}

export interface RideInspectionRoutePoint {
  id: string;
  sequence: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RideInspectionDetails extends RideInspectionSummary {
  institutionId: string;
  completedAt: string | null;
  fare: number | null;
  currency: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  bookingOpen: boolean;
  expectedDistanceKm: number | null;
  expectedDurationMinutes: number | null;
  routeCorridorMeters: number | null;
  bookings: RideInspectionBooking[];
  travelledPath: RideInspectionLocation[];
  expectedRoute: RideInspectionRoutePoint[];
  waypoints: RideInspectionWaypoint[];
  incidents: RideInspectionIncident[];
  events: RideInspectionEvent[];
  safetyAlerts: RideInspectionSafetyAlert[];
  createdAt: string | null;
}

export interface RideInspectionListResponse {
  rides: RideInspectionSummary[];
  total: number;
  generatedAt: string;
}

function parseExecutionBody<T>(execution: FunctionExecutionLike): T {
  const statusCode = Number(execution.responseStatusCode ?? 200);
  const rawBody =
    execution.responseBody ??
    execution.response ??
    execution.stdout ??
    "";

  let payload: ApiEnvelope<T>;

  try {
    payload = JSON.parse(rawBody || "{}") as ApiEnvelope<T>;
  } catch {
    throw new Error(
      statusCode >= 400
        ? "Ride inspection request failed."
        : "Ride inspection service returned an invalid response.",
    );
  }

  if (statusCode >= 400 || payload.ok === false) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Ride inspection request failed with status ${statusCode}.`,
    );
  }

  if (payload.data === undefined) {
    throw new Error("Ride inspection service returned no data.");
  }

  return payload.data;
}

async function executeRideInspectionRequest<T>(path: string): Promise<T> {
  const execution = await (
    functions as unknown as FunctionsAdapter
  ).createExecution({
    functionId: rideInspectionFunctionId,
    body: "",
    async: false,
    xpath: path,
    method: "GET",
    headers: {
      "content-type": "application/json",
    },
  });

  return parseExecutionBody<T>(execution);
}

export async function listInspectableRides(): Promise<RideInspectionListResponse> {
  return executeRideInspectionRequest<RideInspectionListResponse>(
    "/organization/rides/inspection",
  );
}

export async function getInspectableRide(
  rideId: string,
): Promise<RideInspectionDetails> {
  return executeRideInspectionRequest<RideInspectionDetails>(
    `/organization/rides/${encodeURIComponent(rideId)}/inspection`,
  );
}
