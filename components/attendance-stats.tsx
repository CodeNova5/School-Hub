import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, ClipboardCheck, Circle } from "lucide-react";

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
}

interface AttendanceStatsProps {
  stats: AttendanceStats;
  compact?: boolean;
}

export function AttendanceStats({ stats, compact = false }: AttendanceStatsProps) {
  const total = stats.present + stats.absent + stats.late + stats.excused + stats.notMarked;
  const markedTotal = total - stats.notMarked;
  const percentage = total > 0 ? Math.round((markedTotal / total) * 100) : 0;

  const statItems = [
    {
      label: "Present",
      count: stats.present,
      icon: CheckCircle2,
      className: "bg-emerald-100 text-emerald-800",
      color: "bg-emerald-500",
    },
    {
      label: "Absent",
      count: stats.absent,
      icon: XCircle,
      className: "bg-red-100 text-red-800",
      color: "bg-red-500",
    },
    {
      label: "Late",
      count: stats.late,
      icon: Clock,
      className: "bg-amber-100 text-amber-800",
      color: "bg-amber-500",
    },
    {
      label: "Excused",
      count: stats.excused,
      icon: ClipboardCheck,
      className: "bg-blue-100 text-blue-800",
      color: "bg-blue-500",
    },
  ];

  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        {statItems.map((item) => (
          <Badge key={item.label} variant="outline" className={item.className}>
            <item.icon className="h-3 w-3 mr-1" />
            {item.label}: {item.count}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Percentage Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Attendance Progress</p>
          <p className="text-sm font-semibold text-gray-900">{percentage}%</p>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {markedTotal}/{total} students marked
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {statItems.map((item) => (
          <div key={item.label} className={`px-3 py-2 rounded-lg ${item.className}`}>
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              <div>
                <p className="text-xs opacity-75">{item.label}</p>
                <p className="text-lg font-bold">{item.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
