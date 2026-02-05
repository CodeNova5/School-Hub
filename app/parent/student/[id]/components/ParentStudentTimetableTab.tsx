"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

interface TimetableEntry {
  id: string;
  day: string;
  period: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  teacher_id: string;
  subjects?: {
    name: string;
  };
  teachers?: {
    first_name: string;
    last_name: string;
  };
}

interface ParentStudentTimetableTabProps {
  studentId: string;
  classId: string | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ParentStudentTimetableTab({ studentId, classId }: ParentStudentTimetableTabProps) {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (classId) {
      loadTimetable();
    } else {
      setIsLoading(false);
    }
  }, [studentId, classId]);

  async function loadTimetable() {
    setIsLoading(true);
    try {
      const { data: timetableData, error } = await supabase
        .from("timetable_entries")
        .select(`
          *,
          subjects(name),
          teachers(first_name, last_name)
        `)
        .eq("class_id", classId)
        .order("day", { ascending: true })
        .order("period");

      if (error) throw error;
      setTimetable(timetableData || []);
    } catch (error: any) {
      toast.error("Failed to load timetable: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading timetable...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!classId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Student not assigned to a class</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const periods = Array.from(new Set(timetable.map(t => t.period))).sort((a, b) => a - b);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Timetable</CardTitle>
      </CardHeader>
      <CardContent>
        {timetable.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-gray-50">Period</th>
                  {DAYS.map(day => (
                    <th key={day} className="border p-2 bg-gray-50">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(period => {
                  const periodEntry = timetable.find(t => t.period === period);
                  const timeSlot = periodEntry 
                    ? `${periodEntry.start_time} - ${periodEntry.end_time}`
                    : "";

                  return (
                    <tr key={period}>
                      <td className="border p-2 font-medium bg-gray-50">
                        <div>Period {period}</div>
                        {timeSlot && <div className="text-xs text-gray-600">{timeSlot}</div>}
                      </td>
                      {DAYS.map(day => {
                        const entry = timetable.find(
                          t => t.day === day && t.period === period
                        );

                        return (
                          <td key={day} className="border p-2">
                            {entry ? (
                              <div className="text-sm">
                                <div className="font-semibold text-blue-700">
                                  {entry.subjects?.name || "Unknown"}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {entry.teachers?.first_name} {entry.teachers?.last_name}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No timetable available</p>
            <p className="text-sm text-gray-500 mt-1">
              Timetable will be shown once it's created for the class
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
