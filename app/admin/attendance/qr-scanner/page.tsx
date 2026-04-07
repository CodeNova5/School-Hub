"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import jsQR from "jsqr";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, X, Check, AlertCircle, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  class_name: string;
}

interface AttendanceRecord {
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  timestamp: number;
}

interface ScanResult {
  student_id: string;
  timestamp: number;
  status: "success" | "not_found" | "error";
  message: string;
}

export default function QRScannerPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // State management
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [students, setStudents] = useState<Map<string, Student>>(new Map());
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [attendanceBatch, setAttendanceBatch] = useState<AttendanceRecord[]>([]);

  // Fetch classes on mount
  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchClasses();
    }
  }, [schoolId, schoolLoading]);

  // Fetch students when class changes
  useEffect(() => {
    if (selectedClass && schoolId) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass, schoolId]);

  // Start/stop camera
  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isCameraActive]);

  // Start scanning when camera is active
  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      scanningIntervalRef.current = setInterval(() => {
        scanQRCode();
      }, 100); // Scan every 100ms for speed
    }

    return () => {
      if (scanningIntervalRef.current) {
        clearInterval(scanningIntervalRef.current);
      }
    };
  }, [isCameraActive, students, scanned]);

  async function fetchClasses() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClass(data[0].id);
      }
    } catch (error) {
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStudents(classId: string) {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_id, first_name, last_name, class_id, classes:class_id (name)")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("status", "active");

      if (error) throw error;

      const studentMap = new Map<string, Student>();
      (data || []).forEach((student: any) => {
        const studentRecord: Student = {
          id: student.id,
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          class_id: student.class_id,
          class_name: student.classes?.name || "N/A",
        };
        studentMap.set(student.student_id.toUpperCase(), studentRecord);
      });

      setStudents(studentMap);
      setScanned(new Set());
      setAttendanceBatch([]);
    } catch (error) {
      toast.error("Failed to load students");
    }
  }

  async function startCamera() {
    try {
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((error) => {
          console.error("Error playing video:", error);
        });
      }
    } catch (error) {
      toast.error("Failed to access camera");
      setIsCameraActive(false);
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  }

  function scanQRCode() {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    try {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      context.drawImage(videoRef.current, 0, 0);
      const imageData = context.getImageData(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Use jsQR for fast QR code detection
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        handleScannedCode(code.data);
      }
    } catch (error) {
      console.error("Scanning error:", error);
    }
  }

  function decodeQRCode(imageData: ImageData): string | null {
    // Simplified fallback - jsQR is used in scanQRCode
    return null;
  }

  function handleScannedCode(code: string) {
    const studentId = code.trim().toUpperCase();

    // Prevent duplicate scans within 2 seconds
    if (scanned.has(studentId)) {
      return;
    }

    const student = students.get(studentId);

    if (!student) {
      const scanResult: ScanResult = {
        student_id: studentId,
        timestamp: Date.now(),
        status: "not_found",
        message: `Student ${studentId} not found`,
      };
      setRecentScans((prev) => [scanResult, ...prev].slice(0, 10));
      toast.error(`Student ${studentId} not found`);
      return;
    }

    // Add to scanned set
    setScanned((prev) => new Set(prev).add(studentId));

    // Add to attendance batch
    const record: AttendanceRecord = {
      student_id: student.id,
      status: "present",
      timestamp: Date.now(),
    };
    setAttendanceBatch((prev) => [...prev, record]);

    // Show success scan
    const scanResult: ScanResult = {
      student_id: studentId,
      timestamp: Date.now(),
      status: "success",
      message: `${student.first_name} ${student.last_name} marked present`,
    };
    setRecentScans((prev) => [scanResult, ...prev].slice(0, 10));
    toast.success(`✓ ${student.first_name} ${student.last_name}`);

    // Remove from scanned set after 3 seconds to allow re-scan
    setTimeout(
      () => {
        setScanned((prev) => {
          const newSet = new Set(prev);
          newSet.delete(studentId);
          return newSet;
        });
      },
      3000
    );
  }

  async function submitAttendance() {
    if (attendanceBatch.length === 0) {
      toast.error("No attendance records to save");
      return;
    }

    const submitToast = toast.loading(
      `Saving ${attendanceBatch.length} attendance records...`
    );

    try {
      const records = attendanceBatch.map((record) => ({
        school_id: schoolId,
        student_id: record.student_id,
        class_id: selectedClass,
        date: selectedDate,
        status: record.status,
        marked_by: null,
      }));

      // Delete existing records for the date
      await supabase
        .from("attendance")
        .delete()
        .eq("school_id", schoolId)
        .eq("class_id", selectedClass)
        .eq("date", selectedDate);

      // Insert all records
      const { error } = await supabase.from("attendance").insert(records);

      if (error) throw error;

      toast.success(
        `✓ ${attendanceBatch.length} students marked as present`,
        { id: submitToast }
      );

      // Reset state
      setAttendanceBatch([]);
      setScanned(new Set());
      setRecentScans([]);
    } catch (error) {
      console.error("Error submitting attendance:", error);
      toast.error("Failed to save attendance", { id: submitToast });
    }
  }

  function clearLastScan() {
    if (attendanceBatch.length === 0) return;

    const lastRecord = attendanceBatch[attendanceBatch.length - 1];
    const studentId = (
      students.get(lastRecord.student_id) || {
        student_id: lastRecord.student_id,
      }
    ).student_id;

    setAttendanceBatch((prev) => prev.slice(0, -1));
    setScanned((prev) => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });

    toast.info("Last scan removed");
  }

  const totalStudents = students.size;
  const presentCount = scanned.size;

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin">
            <Camera className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 px-2 sm:px-0 pb-20">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">QR Code Attendance Scanner</h1>
          <p className="text-gray-600 mt-1">Fast and efficient attendance marking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Date and Class Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6 space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Present Today</p>
                  <p className="text-4xl font-bold text-blue-600">{presentCount}</p>
                </div>
                <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: totalStudents > 0 ? `${(presentCount / totalStudents) * 100}%` : "0%",
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {totalStudents > 0
                    ? `${totalStudents - presentCount} of ${totalStudents} students remaining`
                    : "No students in class"}
                </p>
              </CardContent>
            </Card>

            {/* Camera Control */}
            <Button
              onClick={() => setIsCameraActive(!isCameraActive)}
              className={`w-full h-12 text-base font-semibold ${
                isCameraActive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <Camera className="w-5 h-5 mr-2" />
              {isCameraActive ? "Stop Camera" : "Start Scanner"}
            </Button>

            {/* Save Button */}
            <Button
              onClick={submitAttendance}
              disabled={attendanceBatch.length === 0}
              variant="default"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-5 h-5 mr-2" />
              Save {attendanceBatch.length} Records
            </Button>

            {/* Undo Last */}
            <Button
              onClick={clearLastScan}
              disabled={attendanceBatch.length === 0}
              variant="outline"
              className="w-full"
            >
              <X className="w-5 h-5 mr-2" />
              Undo Last
            </Button>
          </div>

          {/* Right Panel - Camera Feed & Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Camera Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Scanner Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {!isCameraActive && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                      <Camera className="w-12 h-12 text-gray-400 mb-4" />
                      <p className="text-gray-300 text-center">
                        Click "Start Scanner" to begin
                      </p>
                    </div>
                  )}

                  {isCameraActive && (
                    <div className="absolute inset-0 border-2 border-green-500 pointer-events-none">
                      <div className="absolute top-4 left-4 right-4 h-1 bg-green-500 animate-pulse" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Scans */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Scans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentScans.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No scans yet. Point camera at QR code.
                    </div>
                  ) : (
                    recentScans.map((scan, idx) => (
                      <div
                        key={`${scan.student_id}-${scan.timestamp}-${idx}`}
                        className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                          scan.status === "success"
                            ? "bg-green-50 border border-green-200"
                            : scan.status === "not_found"
                              ? "bg-red-50 border border-red-200"
                              : "bg-yellow-50 border border-yellow-200"
                        }`}
                      >
                        {scan.status === "success" && (
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        )}
                        {scan.status === "not_found" && (
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        {scan.status === "error" && (
                          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{scan.message}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(scan.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
