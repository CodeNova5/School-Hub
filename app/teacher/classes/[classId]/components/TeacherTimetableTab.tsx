"use client";

import { ClassTimetable } from "@/components/class-timetable";
import { Card } from "@/components/ui/card";

interface TeacherTimetableTabProps {
  classId: string;
  className: string;
  schoolId?: string | null;
}

export default function TeacherTimetableTab({
  classId,
  className,
  schoolId,
}: TeacherTimetableTabProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <ClassTimetable 
          classId={classId} 
          className={className}
          showExportButtons={true}
          schoolId={schoolId}
        />
      </div>
    </Card>
  );
}
