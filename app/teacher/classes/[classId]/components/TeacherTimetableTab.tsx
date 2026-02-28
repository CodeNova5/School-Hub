"use client";

import { ClassTimetable } from "@/components/class-timetable";
import { Card } from "@/components/ui/card";

interface TeacherTimetableTabProps {
  classId: string;
  className: string;
}

export default function TeacherTimetableTab({
  classId,
  className,
}: TeacherTimetableTabProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <ClassTimetable 
          classId={classId} 
          className={className}
          showExportButtons={true}
        />
      </div>
    </Card>
  );
}
