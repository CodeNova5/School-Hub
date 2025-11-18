"use client";

import { AttendanceEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getAttendanceStatusColor } from '@/lib/student-utils';
import { Calendar } from 'lucide-react';

interface AttendanceTimelineProps {
  attendance: AttendanceEntry[];
}

export function AttendanceTimeline({ attendance }: AttendanceTimelineProps) {
  const sortedAttendance = [...attendance].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-3">
      {sortedAttendance.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No attendance records available</p>
          </CardContent>
        </Card>
      ) : (
        sortedAttendance.map((entry, index) => (
          <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
            <div className="flex-1">
              <p className="font-medium text-sm">{formatDate(entry.date)}</p>
            </div>
            <Badge className={getAttendanceStatusColor(entry.status)}>
              {entry.status.toUpperCase()}
            </Badge>
          </div>
        ))
      )}
    </div>
  );
}
