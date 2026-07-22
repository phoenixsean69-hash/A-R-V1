interface StatCardProps {
  title: string;
  value: number;
}

export default function StatCard({
  title,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-sm border bg-white p-6 shadow-sm">
      <h3 className="text-sm text-gray-500">{title}</h3>

      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}