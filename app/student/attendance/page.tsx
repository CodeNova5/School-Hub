"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import { AttendanceEntry } from "@/lib/types";

interface AttendanceStats {
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    presentPercentage: number;
}

export default function StudentAttendancePage() {
    const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
    const [filteredAttendance, setFilteredAttendance] = useState<AttendanceEntry[]>([]);
    const [stats, setStats] = useState<AttendanceStats>({
        totalDays: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        presentPercentage: 0,
    });
    const [loading, setLoading] = useState(true);
    const [studentName, setStudentName] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [searchMonth, setSearchMonth] = useState<string>("");
    const [filterDay, setFilterDay] = useState<string>("");
    const [nextTermDate, setNextTermDate] = useState<string>("");

    useEffect(() => {
        loadAttendanceData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [attendance, filterStatus, searchMonth, filterDay]);

    async function loadAttendanceData() {
        try {
            setLoading(true);

            // Get current user
            const user = await getCurrentUser();
            if (!user) {
                toast.error("Please log in to continue");
                window.location.href = "/student/login";
                return;
            }

            // Fetch student details
            const { data: studentData, error: studentError } = await supabase
                .from("students")
                .select("id, first_name, last_name")
                .eq("user_id", user.id)
                .single();

            if (studentError || !studentData) {
                toast.error("Student profile not found");
                return;
            }

            setStudentName(`${studentData.first_name} ${studentData.last_name}`);

            // Fetch attendance records
            const { data: attendanceData, error: attendanceError } = await supabase
                .from("attendance")
                .select("date, status")
                .eq("student_id", studentData.id)
                .order("date", { ascending: false });

            if (attendanceError) {
                toast.error("Failed to load attendance records");
                return;
            }

            if (attendanceData) {
                setAttendance(attendanceData);
                calculateStats(attendanceData);
            }

            // Fetch next term information
            const { data: termsData } = await supabase
                .from("terms")
                .select("start_date")
                .eq("is_current", false)
                .order("start_date", { ascending: true })
                .limit(1);

            if (termsData && termsData.length > 0) {
                setNextTermDate(termsData[0].start_date);
            }
        } catch (error) {
            console.error("Error loading attendance:", error);
            toast.error("Failed to load attendance data");
        } finally {
            setLoading(false);
        }
    }

    function calculateStats(records: AttendanceEntry[]) {
        const stats: AttendanceStats = {
            totalDays: records.length,
            present: records.filter((r) => r.status === "present").length,
            absent: records.filter((r) => r.status === "absent").length,
            late: records.filter((r) => r.status === "late").length,
            excused: records.filter((r) => r.status === "excused").length,
            presentPercentage: 0,
        };

        if (stats.totalDays > 0) {
            stats.presentPercentage = Math.round(
                ((stats.present + stats.late) / stats.totalDays) * 100
            );
        }

        setStats(stats);
    }

    function applyFilters() {
        let filtered = [...attendance];

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

        // Filter by day of week
        if (filterDay) {
            const dayIndex = parseInt(filterDay);
            filtered = filtered.filter((r) => {
                const recordDate = new Date(r.date);
                return recordDate.getDay() === dayIndex;
            });
        }

        setFilteredAttendance(filtered);
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "present":
                return "bg-green-100 text-green-800 border-green-300";
            case "absent":
                return "bg-red-100 text-red-800 border-red-300";
            case "late":
                return "bg-yellow-100 text-yellow-800 border-yellow-300";
            case "excused":
                return "bg-blue-100 text-blue-800 border-blue-300";
            default:
                return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "present":
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case "absent":
                return <XCircle className="h-5 w-5 text-red-600" />;
            case "late":
                return <Clock className="h-5 w-5 text-yellow-600" />;
            case "excused":
                return <AlertCircle className="h-5 w-5 text-blue-600" />;
            default:
                return <Calendar className="h-5 w-5 text-gray-600" />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const getMonthOptions = () => {
        const months = new Set<string>();
        attendance.forEach((record) => {
            const date = new Date(record.date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            months.add(`${year}-${month}`);
        });
        return Array.from(months).sort().reverse();
    };

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="flex items-center justify-center h-screen">
                    <p className="text-gray-500">Loading attendance records...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="student">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold">Attendance Record</h1>
                    <p className="text-gray-600 mt-1">
                        View your attendance history and statistics
                    </p>
                </div>

                {/* Attendance Alert */}
                {stats.presentPercentage < 75 && stats.totalDays > 0 && (
                    <Alert className="border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                            Your attendance percentage ({stats.presentPercentage}%) is below 75%.
                            Please maintain regular attendance to meet school requirements.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-5">
                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Days</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {stats.totalDays}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Calendar className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Present</p>
                                    <p className="text-3xl font-bold text-green-600">
                                        {stats.present}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Absent</p>
                                    <p className="text-3xl font-bold text-red-600">
                                        {stats.absent}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <XCircle className="h-6 w-6 text-red-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-yellow-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Late</p>
                                    <p className="text-3xl font-bold text-yellow-600">
                                        {stats.late}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                                    <Clock className="h-6 w-6 text-yellow-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Excused</p>
                                    <p className="text-3xl font-bold text-purple-600">
                                        {stats.excused}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                                    <AlertCircle className="h-6 w-6 text-purple-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Percentage</p>
                                    <p className="text-3xl font-bold text-indigo-600">
                                        {stats.presentPercentage}%
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <AlertCircle className="h-6 w-6 text-indigo-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Next Term Information */}
                {nextTermDate && (
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Next Term Begins</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-2">
                                        {new Date(nextTermDate).toLocaleDateString("en-US", {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </p>
                                </div>
                                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Calendar className="h-8 w-8 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Attendance Status
                                </label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="late">Late</option>
                                    <option value="excused">Excused</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-2 block">Month</label>
                                <select
                                    value={searchMonth}
                                    onChange={(e) => setSearchMonth(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
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
                                <label className="text-sm font-medium mb-2 block">Day of Week</label>
                                <select
                                    value={filterDay}
                                    onChange={(e) => setFilterDay(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Days</option>
                                    <option value="0">Sunday</option>
                                    <option value="1">Monday</option>
                                    <option value="2">Tuesday</option>
                                    <option value="3">Wednesday</option>
                                    <option value="4">Thursday</option>
                                    <option value="5">Friday</option>
                                    <option value="6">Saturday</option>
                                </select>
                            </div>
                        </div>

                        {(filterStatus || searchMonth || filterDay) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setFilterStatus("");
                                    setSearchMonth("");
                                    setFilterDay("");
                                }}
                                className="w-full"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Attendance Records */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Attendance Records
                            <span className="text-sm font-normal text-gray-600 ml-2">
                                ({filteredAttendance.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {filteredAttendance.length > 0 ? (
                            <div className="space-y-3">
                                {filteredAttendance.map((record, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0">
                                                {getStatusIcon(record.status)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {formatDate(record.date)}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {new Date(record.date).toLocaleDateString("en-US", {
                                                        weekday: "short",
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge className={`${getStatusColor(record.status)} border`}>
                                            {record.status.charAt(0).toUpperCase() +
                                                record.status.slice(1)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 text-center">
                                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg font-medium">
                                    No attendance records found
                                </p>
                                <p className="text-gray-400 text-sm mt-1">
                                    {filterStatus || searchMonth || filterDay
                                        ? "Try adjusting your filters"
                                        : "No attendance records available"}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Legend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Status Legend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                                <div>
                                    <p className="font-medium text-sm">Present</p>
                                    <p className="text-xs text-gray-600">
                                        Student attended school
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <XCircle className="h-6 w-6 text-red-600" />
                                <div>
                                    <p className="font-medium text-sm">Absent</p>
                                    <p className="text-xs text-gray-600">
                                        Student did not attend
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="h-6 w-6 text-yellow-600" />
                                <div>
                                    <p className="font-medium text-sm">Late</p>
                                    <p className="text-xs text-gray-600">
                                        Student came late
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-6 w-6 text-blue-600" />
                                <div>
                                    <p className="font-medium text-sm">Excused</p>
                                    <p className="text-xs text-gray-600">
                                        Authorized absence
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
