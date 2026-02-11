"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Student } from "@/lib/types";

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
    email: student?.email || "",
    phone: student?.phone || "",
    date_of_birth: student?.date_of_birth || "",
    gender: student?.gender || "",
    address: student?.address || "",
    parent_name: student?.parent_name || "",
    parent_email: student?.parent_email || "",
    parent_phone: student?.parent_phone || "",
  });

  const [emailChanged, setEmailChanged] = useState(false);

  // Update form data when student changes
  if (student && !isLoading) {
    if (formData.first_name !== student.first_name) {
      setFormData({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        email: student.email || "",
        phone: student.phone || "",
        date_of_birth: student.date_of_birth || "",
        gender: student.gender || "",
        address: student.address || "",
        parent_name: student.parent_name || "",
        parent_email: student.parent_email || "",
        parent_phone: student.parent_phone || "",
      });
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Track if email is being changed
    if (name === "email" && student) {
      setEmailChanged(value !== student.email);
    }

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

    if (!formData.email.trim()) {
      toast.error("Email is required");
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
            email: formData.email,
            phone: formData.phone || null,
            date_of_birth: formData.date_of_birth || null,
            gender: formData.gender || null,
            address: formData.address || null,
            parent_name: formData.parent_name,
            parent_email: formData.parent_email,
            parent_phone: formData.parent_phone || null,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update student");
        return;
      }

      toast.success(result.message);
      
      if (emailChanged) {
        toast.info("Student account has been deactivated. Verification email sent to the new address.");
      }

      onSuccess(result.student);
      setEmailChanged(false);
      onClose();
    } catch (error: any) {
      console.error("Error updating student:", error);
      toast.error("Failed to update student: " + (error.message || error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Student Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name" className="text-xs">First Name*</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="last_name" className="text-xs">Last Name*</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="text-xs">
                  Email*
                  {emailChanged && <span className="text-red-500 ml-1">*changed</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className={emailChanged ? "border-orange-500" : ""}
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_of_birth" className="text-xs">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth ? formData.date_of_birth.split('T')[0] : ""}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="gender" className="text-xs">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="border rounded-md p-2 w-full"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="address" className="text-xs">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Parent Information */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold text-sm">Parent Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parent_name" className="text-xs">Parent Name*</Label>
                <Input
                  id="parent_name"
                  name="parent_name"
                  value={formData.parent_name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="parent_email" className="text-xs">Parent Email*</Label>
                <Input
                  id="parent_email"
                  type="email"
                  name="parent_email"
                  value={formData.parent_email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="parent_phone" className="text-xs">Parent Phone</Label>
              <Input
                id="parent_phone"
                name="parent_phone"
                value={formData.parent_phone}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Email Change Warning */}
          {emailChanged && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-sm text-orange-800">
                <strong>Note:</strong> Changing the student's email will require them to verify the new email address. A verification link will be sent to the new address and will expire in 24 hours.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
