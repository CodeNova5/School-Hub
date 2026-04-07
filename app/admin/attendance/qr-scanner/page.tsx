"use client";

import { useState, useEffect, useRef } from "react";
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
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const presentStudentIdsRef = useRef<Set<string>>(new Set());
  const lastScanAtRef = useRef<Map<string, number>>(new Map());
  const scanCooldownMs = 1200;
  const scanThrottleMs = 80;
  const lastFrameScanRef = useRef(0);

  // State management
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [studentsByUuid, setStudentsByUuid] = useState<Map<string, Student>>(new Map());
  const [studentsByStudentCode, setStudentsByStudentCode] = useState<Map<string, Student>>(new Map());
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
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

  // Start scanning loop when camera is active
  useEffect(() => {
    if (isCameraActive) {
      const tick = () => {
        scanQRCode();
        scanRafRef.current = requestAnimationFrame(tick);
      };

      scanRafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (scanRafRef.current !== null) {
        cancelAnimationFrame(scanRafRef.current);
        scanRafRef.current = null;
      }
    };
  }, [isCameraActive, studentsByUuid, studentsByStudentCode]);

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

      const byUuid = new Map<string, Student>();
      const byStudentCode = new Map<string, Student>();
      (data || []).forEach((student: any) => {
        const studentRecord: Student = {
          id: student.id,
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          class_id: student.class_id,
          class_name: student.classes?.name || "N/A",
        };
        byUuid.set(student.id, studentRecord);
        byStudentCode.set(student.student_id.toUpperCase(), studentRecord);
      });

      setStudentsByUuid(byUuid);
      setStudentsByStudentCode(byStudentCode);
      setPresentStudentIds(new Set());
      presentStudentIdsRef.current = new Set();
      lastScanAtRef.current.clear();
      setAttendanceBatch([]);
      setRecentScans([]);
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
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
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
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    canvasCtxRef.current = null;
  }

  function scanQRCode() {
    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState < 2) return;

    const now = Date.now();
    if (now - lastFrameScanRef.current < scanThrottleMs) {
      return;
    }
    lastFrameScanRef.current = now;

    if (!canvasCtxRef.current) {
      canvasCtxRef.current = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
    }

    const context = canvasCtxRef.current;
    if (!context) return;

    try {
      const sourceWidth = Math.max(videoRef.current.videoWidth, 1);
      const sourceHeight = Math.max(videoRef.current.videoHeight, 1);
      const ratio = sourceWidth / sourceHeight;
      const targetWidth = Math.min(960, sourceWidth);
      const targetHeight = Math.max(360, Math.floor(targetWidth / Math.max(ratio, 1)));

      if (canvasRef.current.width !== targetWidth || canvasRef.current.height !== targetHeight) {
        canvasRef.current.width = targetWidth;
        canvasRef.current.height = targetHeight;
      }

      context.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight);
      const imageData = context.getImageData(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      // Use jsQR for fast QR code detection
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      if (code) {
        handleScannedCode(code.data);
      }
    } catch (error) {
      console.error("Scanning error:", error);
    }
  }

  function parseIdCardPayload(raw: string): { sid?: string; scid?: string } | null {
    const trimmed = raw.trim();

    // New compact format: SH1|<studentId>|<schoolId>
    if (trimmed.startsWith("SH1|")) {
      const parts = trimmed.split("|");
      if (parts.length >= 3) {
        return {
          sid: parts[1],
          scid: parts[2],
        };
      }
    }

    try {
      // Normalized base64url -> base64
      const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const decoded = atob(padded);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  function handleScannedCode(code: string) {
    const raw = code.trim();
    const decoded = parseIdCardPayload(raw);
    const extractedStudentUuid = decoded?.sid;
    const extractedSchoolId = decoded?.scid;
    const fallbackStudentCode = raw.toUpperCase();

    if (decoded && extractedSchoolId && schoolId && extractedSchoolId !== schoolId) {
      const wrongSchoolScan: ScanResult = {
        student_id: fallbackStudentCode,
        timestamp: Date.now(),
        status: "error",
        message: "QR is from a different school",
      };
      setRecentScans((prev) => [wrongSchoolScan, ...prev].slice(0, 10));
      toast.error("This ID card belongs to a different school");
      return;
    }

    const student = extractedStudentUuid
      ? studentsByUuid.get(extractedStudentUuid)
      : studentsByStudentCode.get(fallbackStudentCode);

    const dedupeKey = student?.id || fallbackStudentCode;
    const lastAt = lastScanAtRef.current.get(dedupeKey) || 0;
    const now = Date.now();

    if (now - lastAt < scanCooldownMs) {
      return;
    }

    lastScanAtRef.current.set(dedupeKey, now);

    if (!student) {
      const scanResult: ScanResult = {
        student_id: fallbackStudentCode,
        timestamp: now,
        status: "not_found",
        message: "Student not found for this QR",
      };
      setRecentScans((prev) => [scanResult, ...prev].slice(0, 10));
      toast.error("Student not found in selected class");
      return;
    }

    // Avoid duplicate attendance records for same student in current batch
    if (presentStudentIdsRef.current.has(student.id)) {
      return;
    }

    presentStudentIdsRef.current.add(student.id);
    setPresentStudentIds((prev) => new Set(prev).add(student.id));

    const record: AttendanceRecord = {
      student_id: student.id,
      status: "present",
      timestamp: now,
    };
    setAttendanceBatch((prev) => [...prev, record]);

    const scanResult: ScanResult = {
      student_id: student.student_id,
      timestamp: now,
      status: "success",
      message: `${student.first_name} ${student.last_name} marked present`,
    };
    setRecentScans((prev) => [scanResult, ...prev].slice(0, 10));
    toast.success(`Marked: ${student.first_name} ${student.last_name}`);
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
      setPresentStudentIds(new Set());
      presentStudentIdsRef.current = new Set();
      setRecentScans([]);
      lastScanAtRef.current.clear();
    } catch (error) {
      console.error("Error submitting attendance:", error);
      toast.error("Failed to save attendance", { id: submitToast });
    }
  }

  function clearLastScan() {
    if (attendanceBatch.length === 0) return;

    const lastRecord = attendanceBatch[attendanceBatch.length - 1];
    const lastStudentUuid = lastRecord.student_id;

    setAttendanceBatch((prev) => prev.slice(0, -1));
    setPresentStudentIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(lastStudentUuid);
      presentStudentIdsRef.current = newSet;
      return newSet;
    });

    toast.info("Last scan removed");
  }

  const totalStudents = studentsByUuid.size;
  const presentCount = presentStudentIds.size;

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
