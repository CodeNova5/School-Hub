"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AttendanceTimeline } from "@/components/attendance-timeline";
import { 
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  X
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "late" | "excused" | "absent";
  class_id: string | null;
  session_id: string | null;
  term_id: string | null;
  notes: string | null;
}

interface ParentStudentAttendanceTabProps {
  studentId: string;
}

export default function ParentStudentAttendanceTab({ studentId }: ParentStudentAttendanceTabProps) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchMonth, setSearchMonth] = useState("");

  useEffect(() => {
    loadAttendance();
  }, [studentId]);

  useEffect(() => {
    applyFilters();
  }, [attendance, selectedDate, filterStatus, searchMonth]);

  async function loadAttendance() {
    setIsLoading(true);
    try {
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false });

      if (error) throw error;
      setAttendance(attendanceData || []);
    } catch (error: any) {
      toast.error("Failed to load attendance: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...attendance];

    // Filter by specific date
    if (selectedDate) {
      filtered = filtered.filter((r) => r.date === selectedDate);
    }

    // Filter by status
    if (filterStatus) {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    // Filter by month
    if (searchMonth) {
      filtered = filtered.filter((r) => {
        const recordDate = new Date(r.date);
        const [year, month] = searchMonth.split("-");
        return (
          recordDate.getFullYear() === parseInt(year) &&
          recordDate.getMonth() === parseInt(month) - 1
        );
      });
    }

    setFilteredAttendance(filtered);
  }

  function clearFilters() {
    setSelectedDate("");
    setFilterStatus("");
    setSearchMonth("");
  }

  function getMonthOptions() {
    const months = new Set<string>();
    attendance.forEach((record) => {
      const date = new Date(record.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      months.add(`${year}-${month}`);
    });
    return Array.from(months).sort().reverse();
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading attendance...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayAttendance = filteredAttendance.length > 0 || selectedDate || filterStatus || searchMonth 
    ? filteredAttendance 
    : attendance;

  const totalRecords = displayAttendance.length;
  const presentCount = displayAttendance.filter(a => a.status === "present").length;
  const lateCount = displayAttendance.filter(a => a.status === "late").length;
  const absentCount = displayAttendance.filter(a => a.status === "absent").length;
  const excusedCount = displayAttendance.filter(a => a.status === "excused").length;

  const attendanceRate = totalRecords === 0 ? 0 : Math.round(((presentCount + lateCount + excusedCount) / totalRecords) * 100);

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Specific Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Month
              </label>
              <select
                value={searchMonth}
                onChange={(e) => setSearchMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Months</option>
                {getMonthOptions().map((month) => {
                  const [year, monthNum] = month.split("-");
                  const monthName = new Date(
                    parseInt(year),
                    parseInt(monthNum) - 1
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <option key={month} value={month}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
            </div>
          </div>

          {(selectedDate || filterStatus || searchMonth) && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{attendanceRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Excused</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{excusedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {displayAttendance.length > 0 ? (
            <AttendanceTimeline attendance={displayAttendance} />
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No attendance records found</p>
              {(selectedDate || filterStatus || searchMonth) && (
                <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Attendance Records
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({displayAttendance.length} {displayAttendance.length === 1 ? 'record' : 'records'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {displayAttendance.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(record.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.status === "present" ? "bg-green-100 text-green-700" :
                        record.status === "late" ? "bg-yellow-100 text-yellow-700" :
                        record.status === "absent" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{record.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayAttendance.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No attendance records found</p>
              {(selectedDate || filterStatus || searchMonth) && (
                <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
