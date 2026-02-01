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
    <Card>
      <ClassTimetable 
        classId={classId} 
        className={className}
        showExportButtons={true}
      />
    </Card>
  );
}
