"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { Class, Department, Religion } from "@/lib/types";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  School,
  Sparkles,
  Users,
} from "lucide-react";


function splitFullName(fullName: string) {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  );
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}>{children}</div>;
}

function StyledInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={
        "h-11 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:outline-none " +
        (props.className ?? "")
      }
    />
  );
}

function StyledSelect(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={
        "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200 " +
        (props.className ?? "")
      }
    />
  );
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200 " +
        (props.className ?? "")
      }
    />
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
          <Icon className="h-5 w-5 text-sky-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function NewStudentPage() {
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
  const router = useRouter();

  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    guardian_name: "",
    guardian_email: "",
    guardian_phone: "",
    relationship_type: "Mother",
    address: "",
    notes: "",
    class_id: "",
    department_id: "",
    religion_id: "",
    admission_date: new Date().toISOString().split("T")[0],
  });

  const [otherGuardians, setOtherGuardians] = useState<Array<Record<string, any>>>([]);

  useEffect(() => {
    if (!schoolId) {
      return;
    }

    async function loadOptions() {
      setIsLoadingOptions(true);
      try {
        const [classesRes, departmentsRes, religionsRes] = await Promise.all([
          supabase
            .from("classes")
            .select("id, name")
            .eq("school_id", schoolId)
            .order("name", { ascending: true }),
          supabase
            .from("school_departments")
            .select("id, name")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("school_religions")
            .select("id, name")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .order("name", { ascending: true }),
        ]);

        if (classesRes.error) throw classesRes.error;
        if (departmentsRes.error) throw departmentsRes.error;
        if (religionsRes.error) throw religionsRes.error;

        setClasses((classesRes.data || []) as Class[]);
        setDepartments((departmentsRes.data || []) as Department[]);
        setReligions((religionsRes.data || []) as Religion[]);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load form options");
      } finally {
        setIsLoadingOptions(false);
      }
    }

    loadOptions();
  }, [schoolId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!schoolId) {
      toast.error("Unable to determine your school");
      return;
    }

    if (!formData.full_name.trim()) {
      toast.error("Student full name is required");
      return;
    }

    if (!formData.gender.trim()) {
      toast.error("Gender is required");
      return;
    }

    if (!formData.guardian_name.trim() || !formData.guardian_email.trim()) {
      toast.error("Guardian name and email are required");
      return;
    }

    if (!formData.relationship_type.trim()) {
      toast.error("Relationship type is required");
      return;
    }

    const { firstName, lastName } = splitFullName(formData.full_name);

    if (!firstName || !lastName) {
      toast.error("Enter at least a first and last name");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/create-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          school_id: schoolId,
          first_name: firstName,
          last_name: lastName,
          email: formData.email,
          guardian_name: formData.guardian_name,
          guardian_email: formData.guardian_email,
          guardian_phone: formData.guardian_phone,
          relationship_type: formData.relationship_type,
          is_primary_contact: true,
          has_legal_custody: false,
          can_pickup: true,
          phone: formData.phone,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          address: formData.address,
          class_id: formData.class_id || null,
          department_id: formData.department_id || null,
          religion_id: formData.religion_id || null,
          guardians: [
            {
              guardian_name: formData.guardian_name,
              guardian_email: formData.guardian_email,
              guardian_phone: formData.guardian_phone,
              relationship_type: formData.relationship_type,
              is_primary_contact: true,
              has_legal_custody: false,
              can_pickup: true,
            },
            ...otherGuardians,
          ],
          admission_date: formData.admission_date,
          notes: formData.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create student");
      }

      toast.success(result?.message || `Student created successfully. ID: ${result.studentId}`);
      router.push("/admin/students");
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create student");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (schoolLoading || isLoadingOptions) {
    return (
      <DashboardLayout role="admin">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Loading student form</p>
              <p className="text-xs text-slate-500">Preparing school options and defaults</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (schoolError || !schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-semibold text-rose-700">{schoolError || "Unable to determine your school"}</p>
            <p className="mt-2 text-sm text-slate-500">Please refresh the page or sign in again.</p>
            <Button className="mt-5 rounded-xl" onClick={() => router.push("/admin/students")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-sky-700 to-blue-700 px-6 py-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Add New Student</h1>
              <p className="mt-1 text-sm text-sky-100">Fill in the student information to create a new profile</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.info("Bulk import is not wired up yet.")}
                className="h-11 rounded-xl border-white/20 bg-white text-sky-700 shadow-sm hover:bg-sky-50 hover:text-sky-800"
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Import Existing Students
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Sparkles className="h-5 w-5 text-sky-600" />
                Student Enrollment Details
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Use this one-page form to capture core student, guardian, and academic details.
              </p>
            </CardHeader>

            <CardContent className="space-y-6 px-6 py-6">
              <SectionCard
                title="Personal Information"
                description="Capture the student's core identity details"
                icon={Users}
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <FieldGroup className="lg:col-span-2">
                    <FieldLabel htmlFor="full_name" required>
                      Full Name
                    </FieldLabel>
                    <StyledInput
                      id="full_name"
                      value={formData.full_name}
                      onChange={(event) => setFormData((current) => ({ ...current, full_name: event.target.value }))}
                      placeholder="Enter student's full name"
                      required
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="gender" required>
                      Gender
                    </FieldLabel>
                    <StyledSelect
                      id="gender"
                      value={formData.gender}
                      onChange={(event) => setFormData((current) => ({ ...current, gender: event.target.value }))}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="others">Others</option>
                    </StyledSelect>
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="date_of_birth">Date of Birth</FieldLabel>
                    <StyledInput
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(event) => setFormData((current) => ({ ...current, date_of_birth: event.target.value }))}
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                    <StyledInput
                      id="phone"
                      value={formData.phone}
                      onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="e.g. +234 801 234 5678"
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="email">Student Email</FieldLabel>
                    <StyledInput
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                      placeholder="student@example.com"
                    />
                  </FieldGroup>

                  <FieldGroup className="lg:col-span-2">
                    <FieldLabel htmlFor="address">Address</FieldLabel>
                    <StyledInput
                      id="address"
                      value={formData.address}
                      onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
                      placeholder="e.g. 123 Main Street, Lagos"
                    />
                  </FieldGroup>

                  <FieldGroup className="lg:col-span-3">
                    <FieldLabel htmlFor="notes">Important Notes</FieldLabel>
                    <StyledTextarea
                      id="notes"
                      value={formData.notes}
                      onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="e.g. Allergic to peanuts, needs front-row seating, uses glasses..."
                    />
                  </FieldGroup>
                </div>
              </SectionCard>

              <SectionCard
                title="Parent / Guardian"
                description="Primary guardian and additional contacts"
                icon={Users}
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <FieldGroup>
                    <FieldLabel htmlFor="guardian_name" required>
                      Guardian Name
                    </FieldLabel>
                    <StyledInput
                      id="guardian_name"
                      value={formData.guardian_name}
                      onChange={(event) => setFormData((current) => ({ ...current, guardian_name: event.target.value }))}
                      placeholder="e.g. Mr. John Doe"
                      required
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="guardian_email" required>
                      Guardian Email
                    </FieldLabel>
                    <StyledInput
                      id="guardian_email"
                      type="email"
                      value={formData.guardian_email}
                      onChange={(event) => setFormData((current) => ({ ...current, guardian_email: event.target.value }))}
                      placeholder="guardian@example.com"
                      required
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="guardian_phone">Guardian Phone</FieldLabel>
                    <StyledInput
                      id="guardian_phone"
                      value={formData.guardian_phone}
                      onChange={(event) => setFormData((current) => ({ ...current, guardian_phone: event.target.value }))}
                      placeholder="e.g. +234 801 234 5678"
                    />
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="relationship_type" required>
                      Relationship
                    </FieldLabel>
                    <StyledSelect
                      id="relationship_type"
                      value={formData.relationship_type}
                      onChange={(event) => setFormData((current) => ({ ...current, relationship_type: event.target.value }))}
                      required
                    >
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Legal Guardian">Legal Guardian</option>
                      <option value="Emergency Contact">Emergency Contact</option>
                      <option value="Guardian">Guardian</option>
                    </StyledSelect>
                  </FieldGroup>

                  <div className="lg:col-span-3">
                    <div className="mt-3 space-y-3">
                      {otherGuardians.map((g, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <FieldLabel required>Guardian Name</FieldLabel>
                              <StyledInput
                                value={g.guardian_name}
                                onChange={(e) => {
                                  const next = [...otherGuardians];
                                  next[idx] = { ...next[idx], guardian_name: e.target.value };
                                  setOtherGuardians(next);
                                }}
                                placeholder="e.g. Mrs. Jane Doe"
                              />
                            </div>

                            <div>
                              <FieldLabel required>Guardian Email</FieldLabel>
                              <StyledInput
                                type="email"
                                value={g.guardian_email}
                                onChange={(e) => {
                                  const next = [...otherGuardians];
                                  next[idx] = { ...next[idx], guardian_email: e.target.value };
                                  setOtherGuardians(next);
                                }}
                                placeholder="guardian@example.com"
                              />
                            </div>

                            <div>
                              <FieldLabel>Phone</FieldLabel>
                              <StyledInput
                                value={g.guardian_phone}
                                onChange={(e) => {
                                  const next = [...otherGuardians];
                                  next[idx] = { ...next[idx], guardian_phone: e.target.value };
                                  setOtherGuardians(next);
                                }}
                                placeholder="e.g. +234 801 234 5678"
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-end">
                            <Button type="button" variant="outline" onClick={() => {
                              const next = [...otherGuardians];
                              next.splice(idx, 1);
                              setOtherGuardians(next);
                            }}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div>
                        <Button type="button" onClick={() => setOtherGuardians((cur) => ([...cur, { guardian_name: "", guardian_email: "", guardian_phone: "", relationship_type: "Guardian", is_primary_contact: false, has_legal_custody: false, can_pickup: true }]))}>
                          Add another guardian
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Academic Placement"
                description="Select the student's class, department, religion, and admission date"
                icon={BookOpen}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FieldGroup>
                    <FieldLabel htmlFor="class_id">Class</FieldLabel>
                    <StyledSelect
                      id="class_id"
                      value={formData.class_id}
                      onChange={(event) => setFormData((current) => ({ ...current, class_id: event.target.value }))}
                    >
                      <option value="">Select Class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </StyledSelect>
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="department_id">Department</FieldLabel>
                    <StyledSelect
                      id="department_id"
                      value={formData.department_id}
                      onChange={(event) => setFormData((current) => ({ ...current, department_id: event.target.value }))}
                    >
                      <option value="">Select Department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </StyledSelect>
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="religion_id">Religion</FieldLabel>
                    <StyledSelect
                      id="religion_id"
                      value={formData.religion_id}
                      onChange={(event) => setFormData((current) => ({ ...current, religion_id: event.target.value }))}
                    >
                      <option value="">Select Religion</option>
                      {religions.map((religion) => (
                        <option key={religion.id} value={religion.id}>
                          {religion.name}
                        </option>
                      ))}
                    </StyledSelect>
                  </FieldGroup>

                  <FieldGroup>
                    <FieldLabel htmlFor="admission_date" required>
                      Admission Date
                    </FieldLabel>
                    <StyledInput
                      id="admission_date"
                      type="date"
                      value={formData.admission_date}
                      onChange={(event) => setFormData((current) => ({ ...current, admission_date: event.target.value }))}
                      required
                    />
                  </FieldGroup>
                </div>
              </SectionCard>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                <div className="flex items-start gap-2">
                  <School className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    This page uses the existing student creation API. The admission number is shown here for the admin workflow, while the backend still handles the internal record creation and parent activation flow.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin/students")}
                  className="rounded-xl"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-slate-950 px-6 text-white hover:bg-slate-800"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Create Student
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
