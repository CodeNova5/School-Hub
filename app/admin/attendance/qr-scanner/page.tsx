"use client";

import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  enhanceBrightness,
  enhanceContrast,
  calculateImageQuality,
  SCAN_RESOLUTIONS,
} from "@/lib/qr-processing";
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
  const multiCanvasRefsRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const scanRafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const presentStudentIdsRef = useRef<Set<string>>(new Set());
  const lastScanAtRef = useRef<Map<string, number>>(new Map());
  const scanCooldownMs = 1200;
  const scanThrottleMs = 80;
  const lastFrameScanRef = useRef(0);
  const failedDecodeAttemptsRef = useRef<Map<string, number>>(new Map()); // Track failures per frame

  // State management
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStatus, setSelectedStatus] = useState<"present" | "absent" | "late" | "excused">("present");
  const [studentsByUuid, setStudentsByUuid] = useState<Map<string, Student>>(new Map());
  const [studentsByStudentCode, setStudentsByStudentCode] = useState<Map<string, Student>>(new Map());
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [scanQuality, setScanQuality] = useState(0); // Visual feedback: image quality 0-100

  // Fetch students for the whole school on mount
  useEffect(() => {
    if (schoolId && !schoolLoading) {
      fetchStudents();
    }
  }, [schoolId, schoolLoading]);

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

  async function fetchStudents() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_id, first_name, last_name, class_id, classes:class_id (name)")
        .eq("school_id", schoolId)
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
      setRecentScans([]);
    } catch (error) {
      toast.error("Failed to load students");
    }
    finally {
      setLoading(false);
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
      
      // Try multi-resolution scanning in priority order
      const primaryImageData = context.getImageData(0, 0, targetWidth, targetHeight);
      const imageQuality = calculateImageQuality(primaryImageData);
      setScanQuality(imageQuality);
      
      // Attempt 1: Primary resolution (960x720) - fast path
      let code = jsQR(primaryImageData.data, primaryImageData.width, primaryImageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code) {
        handleScannedCode(code.data);
        failedDecodeAttemptsRef.current.clear();
        return;
      }

      // Attempt 2: Try alternative resolutions if primary fails
      
      // Only retry with enhancement if quality is borderline (not completely dark/bright)
      if (imageQuality > 15 && imageQuality < 85) {
        // Try enhanced brightness version
        const brightenedData = enhanceBrightness(primaryImageData, 1.4);
        code = jsQR(brightenedData.data, brightenedData.width, brightenedData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code) {
          handleScannedCode(code.data);
          failedDecodeAttemptsRef.current.clear();
          return;
        }

        // Try enhanced contrast version
        const contrastedData = enhanceContrast(primaryImageData, 1.3);
        code = jsQR(contrastedData.data, contrastedData.width, contrastedData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code) {
          handleScannedCode(code.data);
          failedDecodeAttemptsRef.current.clear();
          return;
        }

        // Try combined enhancement
        const combinedData = enhanceContrast(enhanceBrightness(primaryImageData, 1.3), 1.2);
        code = jsQR(combinedData.data, combinedData.width, combinedData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code) {
          handleScannedCode(code.data);
          failedDecodeAttemptsRef.current.clear();
          return;
        }
      }

      // Attempt 3: Try alternative resolutions (secondary and fallback)
      for (const resolution of SCAN_RESOLUTIONS.slice(1)) {
        const altCanvas = document.createElement("canvas");
        altCanvas.width = resolution.width;
        altCanvas.height = resolution.height;
        const altCtx = altCanvas.getContext("2d", { willReadFrequently: true });
        if (!altCtx) continue;

        altCtx.drawImage(videoRef.current, 0, 0, resolution.width, resolution.height);
        const altImageData = altCtx.getImageData(0, 0, resolution.width, resolution.height);

        code = jsQR(altImageData.data, altImageData.width, altImageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code) {
          handleScannedCode(code.data);
          failedDecodeAttemptsRef.current.clear();
          return;
        }
      }

      // If all attempts fail, track it but don't show error (user repositions naturally)
      failedDecodeAttemptsRef.current.set(`frame-${now}`, (failedDecodeAttemptsRef.current.get(`frame-${now}`) || 0) + 1);
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
      // Only show error if QR was successfully decoded but student doesn't exist
      // This is a real error (invalid QR or student removed from system)
      const scanResult: ScanResult = {
        student_id: fallbackStudentCode,
        timestamp: now,
        status: "not_found",
        message: "QR decoded but student not found in system",
      };
      setRecentScans((prev) => [scanResult, ...prev].slice(0, 10));
      toast.error("Student not found in system");
      return;
    }

    // Avoid duplicate attendance records for same student
    if (presentStudentIdsRef.current.has(student.id)) {
      return;
    }

    // Mark as present in UI immediately
    presentStudentIdsRef.current.add(student.id);
    setPresentStudentIds((prev) => new Set(prev).add(student.id));

    const scanResult: ScanResult = {
      student_id: student.student_id,
      timestamp: now,
      status: "success",
      message: `${student.first_name} ${student.last_name} marked present`,
    };
    setRecentScans((prev) => [scanResult, ...prev].slice(0, 10));
    toast.success(`Marked: ${student.first_name} ${student.last_name}`);
    playWelcome();

    // Save attendance to database immediately
    (async () => {
      try {
        const attendanceRecord = {
          school_id: schoolId,
          student_id: student.id,
          class_id: student.class_id,
          date: selectedDate,
          status: selectedStatus,
          marked_by: null,
        };

        // Check if record already exists for this student on this date
        const { data: existingRecord } = await supabase
          .from("attendance")
          .select("id")
          .eq("school_id", schoolId)
          .eq("student_id", student.id)
          .eq("date", selectedDate)
          .single();

        // If exists, skip insertion (already marked)
        if (!existingRecord) {
          const { error } = await supabase
            .from("attendance")
            .insert([attendanceRecord]);

          if (error) {
            console.error("Failed to save attendance to DB:", error);
            toast.error(`Could not save attendance for ${student.first_name}. Check connection.`);
            return;
          }
        }

        console.log(`✅ Attendance saved for ${student.first_name} ${student.last_name}`);

        // Send notification in background (no await)
        notifyParentAsync({
          student_id: student.id,
          status: selectedStatus,
          studentName: `${student.first_name} ${student.last_name}`,
        });
      } catch (error) {
        console.error("Unexpected error in attendance save:", error);
        toast.error("Unexpected error. Check console.");
      }
    })();
  }

  // Play a short high-pitched "Welcome" (speech if available, fallback to beep)
  function playWelcome() {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance("Welcome");
        utter.pitch = 2.0;
        utter.rate = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
        return;
      }
    } catch (e) {
      console.error("SpeechSynthesis error", e);
    }

    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1500;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.25);
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 300);
    } catch (e) {
      console.error("AudioContext error", e);
    }
  }

  // Get notification message based on attendance status
  function getNotificationMessage(
    status: string,
    studentName: string
  ): { title: string; body: string } {
    const statusMessages: Record<string, { title: string; body: string }> = {
      present: {
        title: "✅ Student Present",
        body: `${studentName} was marked present on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}.`,
      },
      absent: {
        title: "❌ Student Absent",
        body: `${studentName} was marked absent on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}. Please contact the school if this is an error.`,
      },
      late: {
        title: "⏰ Student Late",
        body: `${studentName} was marked late on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}.`,
      },
      excused: {
        title: "📋 Absence Excused",
        body: `${studentName}'s absence on ${new Date(selectedDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} has been marked as excused.`,
      },
    };
    return (
      statusMessages[status] || {
        title: "Attendance Updated",
        body: `${studentName}'s attendance has been updated.`,
      }
    );
  }

  // Send notification to parent for single student
  async function sendNotificationToParent(record: {
    student_id: string;
    status: string;
    studentName: string;
  }) {
    try {
      // Get student's parent email
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("parent_email, parent_name")
        .eq("id", record.student_id)
        .single();

      if (studentError) {
        console.error(`❌ Error fetching student ${record.student_id}:`, studentError);
        return;
      }

      if (!student?.parent_email) {
        console.warn(
          `⚠️ No parent email found for student ${record.student_id} (${record.studentName})`
        );
        return;
      }

      console.log(`🔍 Looking up parent account for email: ${student.parent_email}`);

      // Find parent user by email
      const { data: parentArray, error: parentError } = await supabase
        .from("parents")
        .select("user_id, id, is_active")
        .eq("email", student.parent_email);

      if (parentError) {
        console.error(
          `❌ Error finding parent account for ${student.parent_email}:`,
          parentError.message
        );
        return;
      }

      if (!parentArray || parentArray.length === 0) {
        console.warn(
          `⚠️ No parent account found for email ${student.parent_email}. Parent may not be registered.`
        );
        return;
      }

      const parent = parentArray[0];

      if (!parent?.user_id) {
        console.warn(
          `⚠️ Parent account exists but has no user_id for ${student.parent_email}`
        );
        return;
      }

      if (!parent.is_active) {
        console.warn(
          `⚠️ Parent account is inactive for ${student.parent_email}. They need to activate their account.`
        );
        return;
      }

      console.log(`👤 Found parent: ${parent.user_id}`);

      // Get parent's notification tokens
      const { data: tokens, error: tokensError } = await supabase
        .from("notification_tokens")
        .select("token, user_id, device_type, is_active")
        .eq("user_id", parent.user_id)
        .eq("is_active", true);

      if (tokensError) {
        console.error(
          `❌ Error fetching tokens for parent ${student.parent_email}:`,
          tokensError
        );
        return;
      }

      if (!tokens || tokens.length === 0) {
        console.warn(
          `⚠️ No active notification tokens found for parent ${student.parent_email}. Parent may not have enabled notifications.`
        );
        return;
      }

      console.log(
        `📲 Found ${tokens.length} active notification token(s) for parent ${student.parent_email}`
      );

      // Get notification message
      const { title, body } = getNotificationMessage(record.status, record.studentName);

      console.log(`📤 Sending notification to parent ${student.parent_email}...`);

      // Send notification via API
      const response = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          target: "user",
          targetValue: parent.user_id,
          data: {
            type: "attendance",
            studentId: record.student_id,
            status: record.status,
            date: selectedDate,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ API Error (${response.status}) for parent ${student.parent_email}:`,
          errorText
        );
        return;
      }

      const result = await response.json();
      if (result.success || result.successCount > 0) {
        console.log(
          `✅ Notification sent to parent ${student.parent_email}: ${result.successCount || 1} delivered`
        );
      } else {
        console.error(
          `❌ API returned error for parent ${student.parent_email}:`,
          result
        );
      }
    } catch (error) {
      console.error(`❌ Unexpected error sending notification:`, error);
    }
  }

  // Fire and forget: send notification in background with error handling
  function notifyParentAsync(record: {
    student_id: string;
    status: string;
    studentName: string;
  }) {
    sendNotificationToParent(record)
      .catch((error) => {
        console.error("Uncaught error in notification background task:", error);
        toast.error(`Notification failed for ${record.studentName}. Check console.`);
      });
  }

  // Refresh present students from database
  async function refreshPresentStudents() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("school_id", schoolId)
        .eq("date", selectedDate);

      if (error) throw error;

      const presentIds = new Set(
        ((data as Array<{ student_id: string }>) || []).map((r) => r.student_id)
      );
      setPresentStudentIds(presentIds);
      presentStudentIdsRef.current = presentIds;
    } catch (error) {
      console.error("Error refreshing present students:", error);
    }
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
                  <Label className="text-sm font-medium">Mark As</Label>
                  <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">✅ Present</SelectItem>
                      <SelectItem value="absent">❌ Absent</SelectItem>
                      <SelectItem value="late">⏰ Late</SelectItem>
                      <SelectItem value="excused">📋 Excused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* No class filter: any student can be scanned */}
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
                    : "No students found"}
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

            {/* Refresh Button */}
            <Button
              onClick={refreshPresentStudents}
              variant="outline"
              className="w-full"
            >
              <Check className="w-5 h-5 mr-2" />
              Refresh Count
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
