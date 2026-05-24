"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Student } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserRound, Phone, CalendarDays, MapPin, BadgeCheck, Sparkles } from "lucide-react";

interface EditStudentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedStudent: Student) => void;
}

export function EditStudentModal({
  student,
  isOpen,
  onClose,
  onSuccess,
}: EditStudentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: student?.first_name || "",
    last_name: student?.last_name || "",
    phone: student?.phone || "",
    date_of_birth: student?.date_of_birth || "",
    gender: student?.gender || "",
    address: student?.address || "",
    status: student?.status || "active",
  });

  // Only update formData when the student changes
  useEffect(() => {
    if (student) {
      setFormData({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        phone: student.phone || "",
        date_of_birth: student.date_of_birth || "",
        gender: student.gender || "",
        address: student.address || "",
        status: student.status || "active",
      });
    }
  }, [student]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const setField = (name: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!student) return;

    // Validation
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/update-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          updates: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone || null,
            date_of_birth: formData.date_of_birth || null,
            gender: formData.gender || null,
            address: formData.address || null,
            status: formData.status || "active",
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Failed to update student");
      }

      toast.success("Student updated");
      if (typeof onSuccess === "function") {
        // prefer returned student object, fallback to local formData
        onSuccess(data.student || { ...student, ...formData } as Student);
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "An error occurred while updating the student");
    } finally {
      setIsLoading(false);
    }
  };

  // Render
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl overflow-hidden p-0 gap-0 rounded-3xl border-0 bg-white shadow-2xl">
        <DialogHeader className="border-b bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Edit Student</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                Update core identity and contact details in a clean, focused layout.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Profile
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[1.4fr_0.9fr]">
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Student Information</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-xs font-medium text-slate-600">First Name*</Label>
                      <Input
                        id="first_name"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="h-11 rounded-xl bg-white"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-xs font-medium text-slate-600">Last Name*</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="h-11 rounded-xl bg-white"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-xs font-medium text-slate-600">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="h-11 rounded-xl bg-white"
                        placeholder="08012345678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth" className="text-xs font-medium text-slate-600">Date of Birth</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth ? formData.date_of_birth.split('T')[0] : ""}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="h-11 rounded-xl bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-xs font-medium text-slate-600">Gender</Label>
                      <Select value={formData.gender} onValueChange={(value) => setField('gender', value)} disabled={isLoading}>
                        <SelectTrigger id="gender" className="h-11 rounded-xl bg-white">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-xs font-medium text-slate-600">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setField('status', value)} disabled={isLoading}>
                        <SelectTrigger id="status" className="h-11 rounded-xl bg-white">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="graduated">Graduated</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-xs font-medium text-slate-600">Address</Label>
                    <Textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="min-h-28 rounded-xl bg-white resize-none"
                      placeholder="Enter residential address"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="border-t bg-slate-50 px-6 py-6 md:border-l md:border-t-0">
            <div className="sticky top-6 space-y-4">
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Live Preview</h3>
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 text-white shadow-lg">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Student Name</p>
                    <p className="mt-1 text-2xl font-semibold leading-tight">
                      {(formData.first_name || 'First name')} {(formData.last_name || 'Last name')}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                        {formData.status || 'status'}
                      </Badge>
                      <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                        {formData.gender || 'gender'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-700">Phone</p>
                        <p>{formData.phone || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-700">Date of Birth</p>
                        <p>{formData.date_of_birth ? formData.date_of_birth.split('T')[0] : 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-700">Address</p>
                        <p className="line-clamp-3">{formData.address || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
                Updates here affect the student profile only. Parent and email changes are managed separately in the Danger Zone.
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} disabled={isLoading} className="h-11 flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading} className="h-11 flex-1 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
