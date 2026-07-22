import StatCard from "./StatCard";
import { DashboardService } from "../../services/dashboardService";

export default function DashboardStats() {
  const stats = DashboardService.getStats();

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="Junctions"
        value={stats.totalJunctions}
      />

      <StatCard
        title="Accidents"
        value={stats.totalAccidents}
      />

      <StatCard
        title="Fatalities"
        value={stats.totalFatalities}
      />

      <StatCard
        title="Injuries"
        value={stats.totalInjuries}
      />

      <StatCard
        title="High Risk"
        value={stats.highRiskJunctions}
      />
    </div>
  );
}