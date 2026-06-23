"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Save,
  Camera,
  X,
  UserCheck,
  AlertTriangle,
  BookOpen,
  UserCog,
  Trash2,
  Shield,
  Briefcase,
  GraduationCap,
  Mail,
  Phone,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

type SubjectAssignment = {
  classId: string;
  className: string;
  subjects: Array<{ id: string; name: string }>;
};

type TeacherDetail = {
  id: string;
  staff_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  qualification: string;
  specialization: string;
  photo_url?: string;
  status: "active" | "on_leave" | "inactive";
  created_at: string;
};

export default function AdminTeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.teacherId as string;
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  // Data
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; class_teacher_id?: string }>>([]);
  const [subjectClasses, setSubjectClasses] = useState<Array<any>>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<SubjectAssignment[]>([]);
  const [assignedClassId, setAssignedClassId] = useState<string>("");
  const [assignedClassName, setAssignedClassName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Edit form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    qualification: "",
    specialization: "",
    address: "",
    status: "active" as "active" | "on_leave" | "inactive",
  });
  const [saving, setSaving] = useState(false);

  // Photo
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPhotoSaved, setShowPhotoSaved] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Class assignment
  const [assignClassOpen, setAssignClassOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Subject assignment
  const [assignSubjectOpen, setAssignSubjectOpen] = useState(false);
  const [selectedClassForSubject, setSelectedClassForSubject] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (schoolId && teacherId) loadData();
  }, [schoolId, teacherId]);

  useEffect(() => {
    if (!editing && teacher) {
      setForm({
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        email: teacher.email,
        phone: teacher.phone || "",
        qualification: teacher.qualification || "",
        specialization: teacher.specialization || "",
        address: teacher.address || "",
        status: teacher.status,
      });
    }
  }, [editing, teacher]);

  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  async function loadData() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [teacherRes, classesRes, subjectClassesRes] = await Promise.all([
        supabase.from("teachers").select("*").eq("school_id", schoolId).eq("id", teacherId).single(),
        supabase.from("classes").select("id, name, class_teacher_id").eq("school_id", schoolId).order("name"),
        supabase
          .from("subject_classes")
          .select("id, subject_id, class_id, teacher_id, subjects!subject_classes_subject_id_fkey(id, name), classes(id, name)")
          .eq("school_id", schoolId),
      ]);

      if (teacherRes.error) throw teacherRes.error;
      if (!teacherRes.data) {
        toast.error("Teacher not found");
        router.push("/admin/teachers");
        return;
      }

      const teacherData = teacherRes.data as TeacherDetail;
      setTeacher(teacherData);
      setForm({
        first_name: teacherData.first_name,
        last_name: teacherData.last_name,
        email: teacherData.email,
        phone: teacherData.phone || "",
        qualification: teacherData.qualification || "",
        specialization: teacherData.specialization || "",
        address: teacherData.address || "",
        status: teacherData.status,
      });

      setClasses(classesRes.data || []);

      const allSubjectClasses = subjectClassesRes.data || [];
      setSubjectClasses(allSubjectClasses);

      // Find assigned class
      const assignedClass = (classesRes.data || []).find(
        (c: any) => c.class_teacher_id === teacherData.id
      );
      if (assignedClass) {
        setAssignedClassId(assignedClass.id);
        setAssignedClassName(assignedClass.name);
      }

      // Build subject assignments
      const teacherSCs = allSubjectClasses.filter((sc: any) => sc.teacher_id === teacherData.id);
      const subjectsByClass: Record<string, SubjectAssignment> = {};
      teacherSCs.forEach((sc: any) => {
        if (sc.classes && sc.subjects) {
          if (!subjectsByClass[sc.class_id]) {
            subjectsByClass[sc.class_id] = {
              classId: sc.class_id,
              className: sc.classes.name,
              subjects: [],
            };
          }
          subjectsByClass[sc.class_id].subjects.push({
            id: sc.subjects.id,
            name: sc.subjects.name,
          });
        }
      });
      setTeacherAssignments(Object.values(subjectsByClass));
    } catch (error: any) {
      toast.error("Failed to load teacher: " + (error.message || "Unknown error"));
      router.push("/admin/teachers");
    } finally {
      setLoading(false);
    }
  }

  // ── Photo handling ──

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    await uploadPhoto(file);
  }

  async function handleCameraCapture() {
    try {
      if (!cameraStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        setCameraStream(stream);
        setIsCameraOpen(true);
      } else {
        if (canvasRef.current && videoRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d")?.drawImage(video, 0, 0);

          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], `teacher_${Date.now()}.jpg`, { type: "image/jpeg" });
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setImagePreview(URL.createObjectURL(file));
            await uploadPhoto(file);
            cameraStream.getTracks().forEach((t) => t.stop());
            setCameraStream(null);
            setIsCameraOpen(false);
          });
        }
      }
    } catch {
      toast.error("Failed to access camera");
    }
  }

  async function uploadPhoto(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "teacher_photo");
      fd.append("teacher_id", teacherId);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Update teacher record with photo URL
      const updateRes = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-teacher",
          teacherId,
          teacherData: { photo_url: data.fileUrl },
          oldEmail: teacher?.email,
        }),
      });

      if (!updateRes.ok) {
        const updateData = await updateRes.json();
        throw new Error(updateData.error || "Failed to save photo URL");
      }

      setTeacher((prev) => (prev ? { ...prev, photo_url: data.fileUrl } : prev));
      setShowPhotoSaved(true);
      setTimeout(() => setShowPhotoSaved(false), 3000);
      toast.success("Photo uploaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Photo upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  function closeCamera() {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setIsCameraOpen(false);
  }

  // ── Edit ──

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-teacher",
          teacherId,
          teacherData: {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone || null,
            qualification: form.qualification || null,
            specialization: form.specialization || null,
            address: form.address || null,
            status: form.status,
          },
          oldEmail: teacher?.email,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update");

      toast.success(result.emailChanged ? "Teacher updated! Verification sent to new email." : "Teacher updated successfully");
      setEditing(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update teacher");
    } finally {
      setSaving(false);
    }
  }

  // ── Class assignment ──

  async function handleAssignClass() {
    if (!selectedClassId) {
      toast.error("Please select a class");
      return;
    }
    try {
      // Remove from existing class
      await supabase
        .from("classes")
        .update({ class_teacher_id: null })
        .eq("school_id", schoolId)
        .eq("class_teacher_id", teacherId);

      // Assign to new class
      const { error } = await supabase
        .from("classes")
        .update({ class_teacher_id: teacherId })
        .eq("school_id", schoolId)
        .eq("id", selectedClassId);

      if (error) throw error;

      toast.success("Class teacher assigned successfully");
      setAssignClassOpen(false);
      setSelectedClassId("");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign class");
    }
  }

  // ── Subject assignment ──

  async function handleAssignSubject() {
    if (!selectedClassForSubject || !selectedSubjectId) {
      toast.error("Please select both a class and a subject");
      return;
    }

    const sc = subjectClasses.find(
      (s: any) => s.class_id === selectedClassForSubject && s.subject_id === selectedSubjectId
    );

    if (!sc) {
      toast.error("Subject not available for this class");
      return;
    }

    try {
      const { error } = await supabase
        .from("subject_classes")
        .update({ teacher_id: teacherId })
        .eq("school_id", schoolId)
        .eq("id", sc.id);

      if (error) throw error;

      toast.success("Subject assigned successfully");
      setAssignSubjectOpen(false);
      setSelectedClassForSubject("");
      setSelectedSubjectId("");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign subject");
    }
  }

  // ── Delete ──

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from("teachers")
        .delete()
        .eq("school_id", schoolId)
        .eq("id", teacherId);

      if (deleteError) throw deleteError;

      if (teacher?.user_id) {
        try {
          await supabase.auth.admin.deleteUser(teacher.user_id);
        } catch {
          // Best effort
        }
      }

      toast.success("Teacher deleted successfully");
      router.push("/admin/teachers");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete teacher");
    } finally {
      setDeleting(false);
    }
  }

  function getInitials(first: string, last: string) {
    return `${first?.[0] || "?"}${last?.[0] || "?"}`.toUpperCase();
  }

  if (schoolLoading || loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Loading teacher profile</p>
              <p className="text-xs text-slate-500">Fetching staff details and assignments</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!teacher) return null;

  const availableClassesForAssign = classes.filter((c) => c.id !== assignedClassId);

  return (
    <DashboardLayout role="admin">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/teachers")} className="rounded-xl gap-2 text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{teacher.first_name} {teacher.last_name}</h1>
              <p className="text-sm text-slate-500">{teacher.specialization || teacher.qualification || "Teacher"}</p>
            </div>
          </div>
          <Badge
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              teacher.status === "active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : teacher.status === "on_leave"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-700 border-slate-200"
            }`}
          >
            {teacher.status}
          </Badge>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Sidebar (second on mobile, first on desktop) ── */}
          <div className="space-y-6 lg:col-span-1 order-2 lg:order-1">
            {/* Photo card */}
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl ring-2 ring-slate-200">
                    <AvatarImage src={imagePreview || teacher.photo_url || ""} />
                    <AvatarFallback className="rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-3xl font-bold text-indigo-700">
                      {getInitials(teacher.first_name, teacher.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        if (imagePreview) URL.revokeObjectURL(imagePreview);
                        setImageFile(null);
                        setImagePreview("");
                      }}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2 w-full">
                  {isCameraOpen && cameraStream && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-950 p-2">
                      <video ref={videoRef} autoPlay playsInline className="h-40 w-full rounded-lg bg-black object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="flex-1 rounded-lg bg-white text-slate-900 hover:bg-slate-100" onClick={handleCameraCapture} disabled={uploadingImage}>
                          Capture
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={closeCamera}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isCameraOpen && (
                    <>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                        <Camera className="h-4 w-4" />
                        {imagePreview ? "Change Photo" : "Upload Photo"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoFile} disabled={uploadingImage} />
                      </label>
                      <Button type="button" variant="outline" size="sm" className="w-full rounded-xl" onClick={handleCameraCapture} disabled={uploadingImage}>
                        <Camera className="mr-2 h-3.5 w-3.5" />
                        Open Camera
                      </Button>
                    </>
                  )}

                  {uploadingImage && (
                    <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </div>
                  )}

                  {showPhotoSaved && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Photo saved
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick info card */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Shield className="h-4 w-4" />
                  Staff Details
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Staff ID</p>
                      <p className="font-mono font-semibold text-slate-800">{teacher.staff_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-semibold text-slate-800 truncate">{teacher.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-semibold text-slate-800">{teacher.phone || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {teacherAssignments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Subjects Taught</p>
                      <p className="text-sm font-semibold text-slate-800">{teacherAssignments.reduce((t, a) => t + a.subjects.length, 0)} subjects across {teacherAssignments.length} classes</p>
                    </div>
                  </>
                )}

                {assignedClassName && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Class Teacher</p>
                      <Badge variant="outline" className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold">
                        {assignedClassName}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Main content (first on mobile, second on desktop) ── */}
          <div className="space-y-6 lg:col-span-2 order-1 lg:order-2">

            {/* ── Edit Profile ── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Profile Information</CardTitle>
                  <CardDescription>Update the teacher's core details</CardDescription>
                </div>
                <Button
                  variant={editing ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (editing) {
                      handleSave();
                    } else {
                      setEditing(true);
                    }
                  }}
                  disabled={saving}
                  className="rounded-xl"
                >
                  {saving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : editing ? (
                    <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Edit Profile</>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                {editing ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="first_name" className="text-xs font-semibold text-slate-600">First Name*</Label>
                        <Input id="first_name" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name" className="text-xs font-semibold text-slate-600">Last Name*</Label>
                        <Input id="last_name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-semibold text-slate-600">Email*</Label>
                        <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-semibold text-slate-600">Phone</Label>
                        <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="qualification" className="text-xs font-semibold text-slate-600">Qualification</Label>
                        <Input id="qualification" value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} className="h-11 rounded-xl" placeholder="e.g. B.Ed, M.Sc" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specialization" className="text-xs font-semibold text-slate-600">Specialization</Label>
                        <Input id="specialization" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} className="h-11 rounded-xl" placeholder="e.g. Mathematics" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-xs font-semibold text-slate-600">Address</Label>
                      <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-xs font-semibold text-slate-600">Status</Label>
                      <select
                        id="status"
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="active">Active</option>
                        <option value="on_leave">On Leave</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="outline" onClick={() => setEditing(false)} disabled={saving} className="rounded-xl">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">First Name</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.first_name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Name</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.last_name}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.phone || "N/A"}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Qualification</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.qualification || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Specialization</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.specialization || "N/A"}</p>
                      </div>
                    </div>
                    {teacher.address && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Address</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{teacher.address}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Class Assignment ── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Class Teacher</CardTitle>
                  <CardDescription>Assign or change the class this teacher leads</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setAssignClassOpen(!assignClassOpen); setSelectedClassId(""); }} className="rounded-xl">
                  <UserCog className="mr-2 h-4 w-4" />
                  {assignedClassId ? "Change Class" : "Assign Class"}
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                {assignClassOpen ? (
                  <div className="space-y-4">
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">Select a class...</option>
                      {availableClassesForAssign.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">Note: This replaces any existing class teacher assignment.</p>
                    <div className="flex gap-2">
                      <Button onClick={handleAssignClass} disabled={!selectedClassId} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                        Assign
                      </Button>
                      <Button variant="outline" onClick={() => setAssignClassOpen(false)} className="rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {assignedClassName ? (
                      <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <GraduationCap className="h-5 w-5 text-indigo-600" />
                        <div>
                          <p className="text-sm font-semibold text-indigo-900">Class Teacher of</p>
                          <p className="text-lg font-bold text-indigo-700">{assignedClassName}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Not assigned to any class as class teacher.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Subject Assignments ── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Subject Teaching</CardTitle>
                  <CardDescription>Subjects this teacher is assigned to teach</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setAssignSubjectOpen(!assignSubjectOpen); setSelectedClassForSubject(""); setSelectedSubjectId(""); }} className="rounded-xl">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Assign Subject
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {assignSubjectOpen && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <select
                      value={selectedClassForSubject}
                      onChange={(e) => { setSelectedClassForSubject(e.target.value); setSelectedSubjectId(""); }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">Select a class...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {selectedClassForSubject && (
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="">Select a subject...</option>
                        {subjectClasses
                          .filter((sc: any) => sc.class_id === selectedClassForSubject)
                          .map((sc: any) => (
                            <option key={sc.id} value={sc.subject_id}>{sc.subjects?.name}</option>
                          ))}
                      </select>
                    )}
                    <p className="text-xs text-slate-500">Note: This replaces any existing teacher for this subject.</p>
                    <div className="flex gap-2">
                      <Button onClick={handleAssignSubject} disabled={!selectedSubjectId} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">Assign</Button>
                      <Button variant="outline" onClick={() => setAssignSubjectOpen(false)} className="rounded-xl">Cancel</Button>
                    </div>
                  </div>
                )}

                {teacherAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {teacherAssignments.map((assignment, idx) => (
                      <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                        <div className="bg-amber-100 px-4 py-2.5 border-b border-amber-200">
                          <p className="font-semibold text-amber-900 text-sm">{assignment.className}</p>
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          {assignment.subjects.map((subject, sIdx) => (
                            <Badge key={sIdx} variant="secondary" className="bg-amber-200 text-amber-900 font-medium rounded-full">
                              {subject.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Not assigned to any subjects yet.</p>
                )}
              </CardContent>
            </Card>

            {/* ── Danger Zone ── */}
            <Card className="border-rose-200 bg-rose-50/30 shadow-sm">
              <CardHeader className="border-b border-rose-100 bg-rose-50/50 p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                  <CardTitle className="text-base font-bold text-rose-900">Danger Zone</CardTitle>
                </div>
                <CardDescription className="text-sm text-rose-800">Irreversible actions for this teacher record.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-white p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-rose-900">Delete Teacher</p>
                    <p className="text-xs text-rose-700">Permanently remove {teacher.first_name} {teacher.last_name} and their user account.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="rounded-xl shrink-0">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Delete Teacher</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-rose-700">{teacher.first_name} {teacher.last_name}</span>?
              This will permanently remove the teacher and their user account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white">
              {deleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
