import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceStats } from "./attendance-stats";
import { Users, BookOpen } from "lucide-react";

interface ClassCardProps {
  id: string;
  name: string;
  stream?: string;
  studentCount: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
  onMarkAttendance: () => void;
}

export function AttendanceClassCard({
  id,
  name,
  stream,
  studentCount,
  present,
  absent,
  late,
  excused,
  notMarked,
  onMarkAttendance,
}: ClassCardProps) {
  const stats = {
    present,
    absent,
    late,
    excused,
    notMarked,
  };

  const markedCount = present + absent + late + excused;
  const percentage = studentCount > 0 ? Math.round((markedCount / studentCount) * 100) : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{name}</h3>
              </div>
              {stream && (
                <p className="text-xs text-gray-500 ml-7 mt-1">Stream: {stream}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{percentage}%</p>
              <p className="text-xs text-gray-500">attendance</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 ml-7">
            <Users className="h-4 w-4" />
            {studentCount} students
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {markedCount}/{studentCount} marked
          </p>
        </div>

        {/* Compact Stats */}
        <AttendanceStats stats={stats} compact={true} />

        {/* Action Button */}
        <Button
          onClick={onMarkAttendance}
          className="w-full"
          size="sm"
          variant={percentage === 100 ? "outline" : "default"}
        >
          {percentage === 100 ? "Update Attendance" : "Mark Attendance"}
        </Button>
      </CardContent>
    </Card>
  );
}
