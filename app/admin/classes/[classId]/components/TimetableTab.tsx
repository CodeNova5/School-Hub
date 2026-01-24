"use client";

import { ClassTimetable } from "@/components/class-timetable";

interface TimetableTabProps {
  classId: string;
  className: string;
}

export function TimetableTab({ classId, className }: TimetableTabProps) {
  return (
    <ClassTimetable 
      classId={classId} 
      className={className}
      showExportButtons={true}
    />
  );
}
