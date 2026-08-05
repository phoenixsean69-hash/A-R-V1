"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CarFront,
  CheckCircle2,
  Clock3,
  Gauge,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Siren,
  UserRound,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";

import {
  getInspectableRide,
  listInspectableRides,
  type RideInspectionDetails,
  type RideInspectionMonitoring,
  type RideInspectionSummary,
} from "@/lib/ride-inspection.service";

const InspectRidesMap = dynamic(
  () =>
    import("./inspect-rides-map").then((module) => module.InspectRidesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[390px] items-center justify-center bg-gray-100 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    ),
  },
);

type RideFilter = "all" | "attention" | "normal";

type SafetyState = "good" | "warning" | "unknown";

const ACTIVE_STATUSES = new Set(["active", "boarding", "delayed"]);

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isRideAttention(monitoring: RideInspectionMonitoring): boolean {
  return (
    monitoring.hasOpenIncident ||
    monitoring.hasOpenSafetyAlert ||
    monitoring.locationCriticallyStale ||
    monitoring.overdue
  );
}

function readableStatus(status: string): string {
  const normalized = normalize(status);

  if (normalized === "active") return "On the way";
  if (normalized === "boarding") return "Picking up student";
  if (normalized === "delayed") return "Delayed";

  return status || "Unknown";
}

function statusClasses(status: string): string {
  const normalized = normalize(status);

  if (normalized === "active") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (normalized === "delayed") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return "not available";

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return "not available";

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.round(hours / 24);

  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatTime(value?: string | null): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-ZW", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not available";
  }

  return String(Math.round(value));
}

function getJourneyLabel(ride: RideInspectionSummary): string {
  const pickup =
    ride.pickup.address.trim() ||
    ride.schoolLocation.trim() ||
    "Pickup not recorded";
  const destination =
    ride.destination.address.trim() || "Destination not recorded";

  return `${pickup} to ${destination}`;
}

function getSelectedSummary(
  rides: RideInspectionSummary[],
  selectedRideId: string | null,
): RideInspectionSummary | null {
  if (!selectedRideId) return null;

  return rides.find((ride) => ride.id === selectedRideId) ?? null;
}

export function InspectRidesPanel() {
  const [rides, setRides] = useState<RideInspectionSummary[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] =
    useState<RideInspectionDetails | null>(null);
  const [filter, setFilter] = useState<RideFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRideList = useCallback(
    async ({
      silent = false,
      showToast = false,
    }: {
      silent?: boolean;
      showToast?: boolean;
    } = {}) => {
      if (!silent) setListLoading(true);
      setListError("");

      try {
        const response = await listInspectableRides();

        if (!mountedRef.current) return;

        const activeRides = response.rides.filter((ride) =>
          ACTIVE_STATUSES.has(normalize(ride.status)),
        );

        setRides(activeRides);
        setLastRefreshAt(new Date());

        setSelectedRideId((current) => {
          if (
            current &&
            activeRides.some((ride) => ride.id === current)
          ) {
            return current;
          }

          return activeRides[0]?.id ?? null;
        });

        if (showToast) {
          toast.success("Live ride data refreshed.");
        }
      } catch (caughtError) {
        if (!mountedRef.current) return;

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load live rides.";

        setListError(message);

        if (showToast) {
          toast.error(message);
        }
      } finally {
        if (mountedRef.current && !silent) {
          setListLoading(false);
        }
      }
    },
    [],
  );

  const loadRideDetails = useCallback(
    async (
      rideId: string,
      {
        silent = false,
      }: {
        silent?: boolean;
      } = {},
    ) => {
      if (!silent) setDetailsLoading(true);
      setDetailsError("");

      try {
        const details = await getInspectableRide(rideId);

        if (!mountedRef.current) return;

        setSelectedRide((current) => {
          if (current && current.id !== rideId) {
            return current;
          }

          return details;
        });
      } catch (caughtError) {
        if (!mountedRef.current) return;

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load ride details.";

        setDetailsError(message);
      } finally {
        if (mountedRef.current && !silent) {
          setDetailsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadRideList();
  }, [loadRideList]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadRideList({ silent: true });
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [loadRideList]);

  useEffect(() => {
    if (!selectedRideId) {
      setSelectedRide(null);
      setDetailsError("");
      return;
    }

    setSelectedRide(null);
    void loadRideDetails(selectedRideId);

    const interval = window.setInterval(() => {
      void loadRideDetails(selectedRideId, { silent: true });
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [loadRideDetails, selectedRideId]);

  const filteredRides = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return rides.filter((ride) => {
      const attention = isRideAttention(ride.monitoring);

      if (filter === "attention" && !attention) return false;
      if (filter === "normal" && attention) return false;

      if (!query) return true;

      return [
        ride.driver.name,
        ride.student?.name,
        ride.student?.id,
        ride.vehicle.make,
        ride.vehicle.model,
        ride.vehicle.registrationNumber,
        ride.pickup.address,
        ride.destination.address,
        ride.schoolLocation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filter, rides, searchTerm]);

  const selectedSummary = useMemo(
    () => getSelectedSummary(rides, selectedRideId),
    [rides, selectedRideId],
  );

  const attentionCount = useMemo(
    () =>
      rides.filter((ride) => isRideAttention(ride.monitoring)).length,
    [rides],
  );

  const studentsOnBoard = useMemo(
    () =>
      rides.reduce(
        (total, ride) => total + Math.max(0, ride.counts.bookings),
        0,
      ),
    [rides],
  );

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadRideList({ silent: true });

      if (selectedRideId) {
        await loadRideDetails(selectedRideId, { silent: true });
      }

      toast.success("Live ride data refreshed.");
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  };

  const openPhone = (phone: string, label: string) => {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      toast.error(`${label} phone number is not available.`);
      return;
    }

    window.location.href = `tel:${normalizedPhone}`;
  };

  const selectedAttention = selectedRide
    ? isRideAttention(selectedRide.monitoring)
    : false;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Navigation className="h-5 w-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">Live ride inspection</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  Real data
                </span>
              </div>

              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Monitor boarding, active, and delayed rides connected to your
                organization. Data comes from the live rides-driver-api.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh live data
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InspectionSummaryCard
          icon={Navigation}
          label="Rides being watched"
          value={rides.length}
          detail="Boarding, active or delayed"
        />
        <InspectionSummaryCard
          icon={ShieldAlert}
          label="Needs attention"
          value={attentionCount}
          detail="Safety, location or overdue warning"
          warning={attentionCount > 0}
        />
        <InspectionSummaryCard
          icon={Users}
          label="Students in rides"
          value={studentsOnBoard}
          detail="Confirmed booking records"
        />
        <InspectionSummaryCard
          icon={Signal}
          label="Monitoring status"
          value={listError ? "Issue" : "Online"}
          detail={
            lastRefreshAt
              ? `Updated ${formatRelativeTime(lastRefreshAt.toISOString())}`
              : "Waiting for first refresh"
          }
          warning={Boolean(listError)}
        />
      </section>

      {listError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-200">
                Live ride data could not be loaded
              </p>
              <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">
                {listError}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Current student rides</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Select a ride to inspect its journey and safety checks.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {filteredRides.length}
              </span>
            </div>

            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search driver, student or vehicle"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-950"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { id: "all", label: "All rides" },
                { id: "attention", label: "Needs attention" },
                { id: "normal", label: "Normal" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id as RideFilter)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    filter === item.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[760px] space-y-3 overflow-y-auto p-3">
            {listLoading && rides.length === 0 && (
              <div className="flex min-h-56 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm font-semibold">
                    Loading live rides
                  </p>
                </div>
              </div>
            )}

            {!listLoading &&
              filteredRides.map((ride) => {
                const selected = selectedRideId === ride.id;
                const attention = isRideAttention(ride.monitoring);

                return (
                  <button
                    key={ride.id}
                    type="button"
                    onClick={() => setSelectedRideId(ride.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-50 shadow-sm dark:bg-blue-950/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-950/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                          <CarFront className="h-5 w-5 text-blue-600" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-bold">
                            {ride.driver.name || "Unknown driver"}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {[ride.vehicle.make, ride.vehicle.model]
                              .filter(Boolean)
                              .join(" ") || "Vehicle not recorded"}{" "}
                            ·{" "}
                            {ride.vehicle.registrationNumber ||
                              "Registration unavailable"}
                          </p>
                        </div>
                      </div>

                      {attention ? (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {ride.pickup.address || "Pickup not recorded"}
                      </span>
                      <span>→</span>
                      <span className="truncate">
                        {ride.destination.address ||
                          "Destination not recorded"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClasses(
                          ride.status,
                        )}`}
                      >
                        {readableStatus(ride.status)}
                      </span>

                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        Location{" "}
                        {formatRelativeTime(
                          ride.currentLocation?.recordedAt ||
                            ride.updatedAt,
                        )}
                      </span>
                    </div>

                    {attention && (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                        {ride.monitoring.hasOpenSafetyAlert
                          ? "Open safety alert"
                          : ride.monitoring.hasOpenIncident
                            ? "Open incident report"
                            : ride.monitoring.locationCriticallyStale
                              ? "Location signal is critically stale"
                              : ride.monitoring.overdue
                                ? `Ride is ${ride.monitoring.overdueMinutes} minutes overdue`
                                : "Ride needs attention"}
                      </div>
                    )}
                  </button>
                );
              })}

            {!listLoading && filteredRides.length === 0 && (
              <div className="py-12 text-center">
                <Search className="mx-auto h-7 w-7 text-gray-300" />
                <p className="mt-3 text-sm font-semibold">
                  {rides.length === 0
                    ? "No live rides for this organization"
                    : "No matching rides"}
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {rides.length === 0
                    ? "A ride will appear here when it belongs to this organization and its status is boarding, active, or delayed."
                    : "Change the search or monitoring filter."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {!selectedRideId && (
            <section className="flex min-h-[520px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div>
                <Navigation className="mx-auto h-9 w-9 text-gray-300" />
                <p className="mt-4 font-bold">No ride selected</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
                  Select a live ride from the list to inspect its driver,
                  student booking, map, route, location and safety data.
                </p>
              </div>
            </section>
          )}

          {selectedRideId && detailsLoading && !selectedRide && (
            <section className="flex min-h-[520px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-semibold">
                  Loading ride inspection
                </p>
              </div>
            </section>
          )}

          {selectedRideId && detailsError && !selectedRide && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-bold text-red-800 dark:text-red-200">
                    Ride details could not be loaded
                  </p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {detailsError}
                  </p>
                </div>
              </div>
            </section>
          )}

          {selectedRide && (
            <>
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="border-b border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">
                          {selectedRide.driver.name || "Unknown driver"}
                        </h2>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(
                            selectedRide.status,
                          )}`}
                        >
                          {readableStatus(selectedRide.status)}
                        </span>

                        {selectedAttention && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                            Needs attention
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {selectedRide.student
                          ? `${selectedRide.student.name} · confirmed booking`
                          : "No student booking is currently linked to this ride"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openPhone(
                            selectedRide.driver.phone,
                            "Driver",
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <Phone className="h-4 w-4" />
                        Call driver
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openPhone(
                            selectedRide.student?.phone || "",
                            "Student",
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                        disabled={!selectedRide.student?.phone}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Contact student
                      </button>
                    </div>
                  </div>
                </div>

                <InspectRidesMap ride={selectedRide} />

                <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-gray-800">
                  <MetricBox
                    icon={Gauge}
                    label="Current speed"
                    value={
                      selectedRide.currentLocation?.speedKph === null ||
                      selectedRide.currentLocation?.speedKph === undefined
                        ? "Not available"
                        : `${Math.round(
                            selectedRide.currentLocation.speedKph,
                          )} km/h`
                    }
                  />
                  <MetricBox
                    icon={Clock3}
                    label="Expected arrival"
                    value={formatTime(
                      selectedRide.estimatedArrivalTime,
                    )}
                  />
                  <MetricBox
                    icon={Route}
                    label="Route data"
                    value={
                      selectedRide.monitoring.hasExpectedRoute
                        ? `${selectedRide.counts.routePoints} points`
                        : "Not available"
                    }
                  />
                  <MetricBox
                    icon={Wifi}
                    label="Last location"
                    value={formatRelativeTime(
                      selectedRide.currentLocation?.recordedAt,
                    )}
                  />
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Journey information</h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Real trip, passenger, driver and vehicle information.
                      </p>
                    </div>
                    <UserRound className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 space-y-3">
                    <ReadableDetail
                      label="Student"
                      value={
                        selectedRide.student
                          ? `${selectedRide.student.name}${
                              selectedRide.student.id
                                ? ` (${selectedRide.student.id})`
                                : ""
                            }`
                          : "No booking record available"
                      }
                    />
                    <ReadableDetail
                      label="Driver"
                      value={`${selectedRide.driver.name || "Unknown driver"} · ${
                        selectedRide.driver.phone ||
                        "Phone unavailable"
                      }`}
                    />
                    <ReadableDetail
                      label="Vehicle"
                      value={`${selectedRide.vehicle.color || ""} ${
                        [selectedRide.vehicle.make, selectedRide.vehicle.model]
                          .filter(Boolean)
                          .join(" ") || "Vehicle not recorded"
                      } · ${
                        selectedRide.vehicle.registrationNumber ||
                        "Registration unavailable"
                      }`.trim()}
                    />
                    <ReadableDetail
                      label="Journey"
                      value={getJourneyLabel(selectedRide)}
                    />
                    <ReadableDetail
                      label="Passengers"
                      value={
                        selectedRide.monitoring.hasBookingData
                          ? `${selectedRide.passengerCount} confirmed ${
                              selectedRide.passengerCount === 1
                                ? "passenger"
                                : "passengers"
                            }`
                          : "No confirmed booking rows yet"
                      }
                    />
                    <ReadableDetail
                      label="Expected trip"
                      value={
                        selectedRide.expectedDistanceKm !== null ||
                        selectedRide.expectedDurationMinutes !== null
                          ? [
                              selectedRide.expectedDistanceKm !== null
                                ? `${selectedRide.expectedDistanceKm.toFixed(
                                    1,
                                  )} km`
                                : null,
                              selectedRide.expectedDurationMinutes !== null
                                ? `${selectedRide.expectedDurationMinutes} minutes`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "Distance and duration not recorded"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">Safety monitoring</h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Checks based only on the currently stored ride data.
                      </p>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 space-y-3">
                    <SafetyCheck
                      state={
                        selectedRide.monitoring.hasBookingData
                          ? "good"
                          : "unknown"
                      }
                      title="Student booking"
                      detail={
                        selectedRide.student
                          ? `${selectedRide.student.name} is linked to this ride.`
                          : "No student booking row is available yet."
                      }
                    />
                    <SafetyCheck
                      state={
                        selectedRide.monitoring.hasOpenSafetyAlert
                          ? "warning"
                          : selectedRide.monitoring.hasExpectedRoute
                            ? "good"
                            : "unknown"
                      }
                      title="Expected route"
                      detail={
                        selectedRide.monitoring.hasOpenSafetyAlert
                          ? `${selectedRide.counts.openSafetyAlerts} open safety ${
                              selectedRide.counts.openSafetyAlerts === 1
                                ? "alert"
                                : "alerts"
                            }.`
                          : selectedRide.monitoring.hasExpectedRoute
                            ? "No open route safety alert is recorded."
                            : "Expected route points have not been recorded."
                      }
                    />
                    <SafetyCheck
                      state={
                        !selectedRide.monitoring.hasLocation
                          ? "unknown"
                          : selectedRide.monitoring.locationFresh
                            ? "good"
                            : "warning"
                      }
                      title="Location signal"
                      detail={
                        !selectedRide.monitoring.hasLocation
                          ? "No current location is available."
                          : selectedRide.monitoring.locationFresh
                            ? `Location updated ${formatRelativeTime(
                                selectedRide.currentLocation?.recordedAt,
                              )}.`
                            : `Location is stale. Last update was ${formatRelativeTime(
                                selectedRide.currentLocation?.recordedAt,
                              )}.`
                      }
                    />
                    <SafetyCheck
                      state={
                        selectedRide.currentLocation?.speedKph === null ||
                        selectedRide.currentLocation?.speedKph === undefined
                          ? "unknown"
                          : selectedRide.currentLocation.speedKph <= 80
                            ? "good"
                            : "warning"
                      }
                      title="Vehicle speed"
                      detail={
                        selectedRide.currentLocation?.speedKph === null ||
                        selectedRide.currentLocation?.speedKph === undefined
                          ? "Current speed is not available."
                          : selectedRide.currentLocation.speedKph <= 80
                            ? `Current recorded speed is ${Math.round(
                                selectedRide.currentLocation.speedKph,
                              )} km/h.`
                            : `Current recorded speed is ${Math.round(
                                selectedRide.currentLocation.speedKph,
                              )} km/h and needs attention.`
                      }
                    />
                    <SafetyCheck
                      state={
                        selectedRide.monitoring.hasOpenIncident
                          ? "warning"
                          : "good"
                      }
                      title="Incident reports"
                      detail={
                        selectedRide.monitoring.hasOpenIncident
                          ? `${selectedRide.counts.openIncidents} open ${
                              selectedRide.counts.openIncidents === 1
                                ? "incident"
                                : "incidents"
                            } recorded.`
                          : "No open incident is recorded."
                      }
                    />
                    <SafetyCheck
                      state={
                        selectedRide.monitoring.overdue
                          ? "warning"
                          : "good"
                      }
                      title="Expected arrival"
                      detail={
                        selectedRide.monitoring.overdue
                          ? `Ride is ${selectedRide.monitoring.overdueMinutes} minutes past its expected arrival time.`
                          : "Ride is not currently marked overdue."
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300">
                      <Siren className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold">Safety actions</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Contact people immediately when a ride needs
                        intervention.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toast(
                          "Concern recording is not connected to a write route yet.",
                          { icon: "ℹ️" },
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <BellRing className="h-4 w-4" />
                      Record concern
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toast(
                          "Security alerting is not connected to a notification route yet.",
                          { icon: "ℹ️" },
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Alert security
                    </button>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">Recent ride events</h3>
                    <Activity className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedRide.events.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/60"
                      >
                        <p className="text-sm font-semibold">
                          {event.message || event.eventType}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {event.actorType || "system"} ·{" "}
                          {formatRelativeTime(event.createdAt)}
                        </p>
                      </div>
                    ))}

                    {selectedRide.events.length === 0 && (
                      <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-950/60 dark:text-gray-400">
                        No ride events have been recorded.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">Monitoring data</h3>
                    <Signal className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 space-y-3">
                    <ReadableDetail
                      label="Travelled path"
                      value={
                        selectedRide.monitoring.hasTravelledPath
                          ? `${selectedRide.counts.travelledPoints} recorded location points`
                          : "No ride-location rows recorded"
                      }
                    />
                    <ReadableDetail
                      label="Expected route"
                      value={
                        selectedRide.monitoring.hasExpectedRoute
                          ? `${selectedRide.counts.routePoints} expected route points`
                          : "No expected route points recorded"
                      }
                    />
                    <ReadableDetail
                      label="GPS accuracy"
                      value={
                        selectedRide.currentLocation?.accuracyMeters ===
                          null ||
                        selectedRide.currentLocation?.accuracyMeters ===
                          undefined
                          ? "Not available"
                          : `${formatNumber(
                              selectedRide.currentLocation.accuracyMeters,
                            )} metres`
                      }
                    />
                    <ReadableDetail
                      label="Location source"
                      value={
                        selectedRide.currentLocation?.source ||
                        "Not available"
                      }
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {!selectedRide && selectedSummary && !detailsLoading && !detailsError && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="font-bold">{selectedSummary.driver.name}</p>
              <p className="mt-1 text-sm text-gray-500">
                Waiting for detailed ride data.
              </p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

interface InspectionSummaryCardProps {
  icon: typeof Navigation;
  label: string;
  value: number | string;
  detail: string;
  warning?: boolean;
}

function InspectionSummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}: InspectionSummaryCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          warning
            ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300"
            : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {detail}
      </p>
    </div>
  );
}

function MetricBox({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/60">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4 text-blue-600" />
        {label}
      </div>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}

function ReadableDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/60">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-6">{value}</p>
    </div>
  );
}

function SafetyCheck({
  state,
  title,
  detail,
}: {
  state: SafetyState;
  title: string;
  detail: string;
}) {
  const warning = state === "warning";
  const unknown = state === "unknown";

  return (
    <div
      className={`rounded-xl border p-3 ${
        warning
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/60"
      }`}
    >
      <div className="flex items-start gap-3">
        {warning ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
        ) : unknown ? (
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        )}

        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
