"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Loader2, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EmailPreviewModal } from "./email-preview-modal";
import { buildEmailTemplate } from "@/lib/email-templates";

interface SendEmailPayload {
  subject: string;
  body: string;
  target: "all" | "role" | "user" | "class" | "multiple_classes" | "class_teachers";
  targetValue?: string | string[];
  targetName?: string;
}

interface ClassOption {
  id: string;
  name: string;
  level: string;
  classLevelOrder: number;
}

interface UserSearchResult {
  id: string;
  name: string;
  email?: string;
  role: "student" | "teacher" | "parent" | "admin";
  metadata?: string;
}

export function AdminSendEmailComponent() {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [payload, setPayload] = useState<SendEmailPayload>({
    subject: "",
    body: "",
    target: "all",
  });

  useEffect(() => {
    fetchClasses();
    fetchSchoolName();
  }, []);

  // Update recipient count when target or selections change
  useEffect(() => {
    updateRecipientCount();
  }, [payload.target, selectedClasses, selectedUser]);

  const fetchSchoolName = async () => {
    try {
      const { data: schoolData } = await supabase.rpc("get_my_school");
      if (schoolData) {
        setSchoolName(schoolData.name);
      }
    } catch (error) {
      console.error("Error fetching school name:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      setClassesLoading(true);

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, school_class_levels(name, order_sequence)")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching classes:", error);
        return;
      }

      if (data) {
        const formattedClasses: ClassOption[] = data.map((classItem: any) => ({
          id: classItem.id,
          name: classItem.name,
          level: classItem.school_class_levels?.name || "N/A",
          classLevelOrder: classItem.school_class_levels?.order_sequence ?? 999,
        }));

        formattedClasses.sort((a, b) => {
          if (a.classLevelOrder !== b.classLevelOrder) {
            return a.classLevelOrder - b.classLevelOrder;
          }
          return a.name.localeCompare(b.name);
        });

        setClasses(formattedClasses);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    } finally {
      setClassesLoading(false);
    }
  };

  const updateRecipientCount = async () => {
    try {
      if (payload.target === "all") {
        const { count: studentCount } = await supabase
          .from("students")
          .select("id", { count: "exact" })
          .eq("is_active", true);

        const { count: teacherCount } = await supabase
          .from("teachers")
          .select("id", { count: "exact" })
          .eq("is_active", true);

        const { count: parentCount } = await supabase
          .from("parents")
          .select("id", { count: "exact" })
          .eq("is_active", true);

        setRecipientCount((studentCount || 0) + (teacherCount || 0) + (parentCount || 0));
      } else if (payload.target === "role") {
        if (payload.targetValue === "student") {
          const { count } = await supabase
            .from("students")
            .select("id", { count: "exact" })
            .eq("is_active", true);
          setRecipientCount(count || 0);
        } else if (payload.targetValue === "teacher") {
          const { count } = await supabase
            .from("teachers")
            .select("id", { count: "exact" })
            .eq("is_active", true);
          setRecipientCount(count || 0);
        } else if (payload.targetValue === "parent") {
          const { count } = await supabase
            .from("parents")
            .select("id", { count: "exact" })
            .eq("is_active", true);
          setRecipientCount(count || 0);
        } else {
          setRecipientCount(0);
        }
      } else if (payload.target === "class") {
        if (payload.targetValue) {
          const { count } = await supabase
            .from("students")
            .select("id", { count: "exact" })
            .eq("class_id", payload.targetValue)
            .eq("is_active", true);
          setRecipientCount(count || 0);
        } else {
          setRecipientCount(0);
        }
      } else if (payload.target === "multiple_classes") {
        if (selectedClasses.length > 0) {
          const { count } = await supabase
            .from("students")
            .select("id", { count: "exact" })
            .in("class_id", selectedClasses)
            .eq("is_active", true);
          setRecipientCount(count || 0);
        } else {
          setRecipientCount(0);
        }
      } else if (payload.target === "class_teachers") {
        if (payload.targetValue) {
          const { data: classTeachers } = await supabase
            .from("class_teachers")
            .select("teacher_id")
            .eq("class_id", payload.targetValue);

          if (classTeachers && classTeachers.length > 0) {
            const teacherIds = classTeachers.map((ct: any) => ct.teacher_id);
            const { count } = await supabase
              .from("teachers")
              .select("id", { count: "exact" })
              .in("id", teacherIds)
              .eq("is_active", true);
            setRecipientCount(count || 0);
          } else {
            setRecipientCount(0);
          }
        } else {
          setRecipientCount(0);
        }
      } else if (payload.target === "user") {
        setRecipientCount(selectedUser ? 1 : 0);
      } else {
        setRecipientCount(0);
      }
    } catch (error) {
      console.error("Error updating recipient count:", error);
      setRecipientCount(0);
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setUserSearchResults([]);
      return;
    }

    try {
      setUserSearchLoading(true);
      const results: UserSearchResult[] = [];

      // Search in students table
      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, email, class_id, classes(name)")
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);

      if (students) {
        results.push(
          ...students.map((s: any) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            role: "student" as const,
            metadata: s.classes?.name || "N/A",
          }))
        );
      }

      // Search in teachers table
      const { data: teachers } = await supabase
        .from("teachers")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);

      if (teachers) {
        results.push(
          ...teachers.map((t: any) => ({
            id: t.id,
            name: `${t.first_name} ${t.last_name}`,
            email: t.email,
            role: "teacher" as const,
          }))
        );
      }

      // Search in parents table
      const { data: parents } = await supabase
        .from("parents")
        .select("id, name, email")
        .ilike("name", `%${searchTerm}%`);

      if (parents) {
        results.push(
          ...parents.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: "parent" as const,
          }))
        );
      }

      setUserSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Failed to search users");
    } finally {
      setUserSearchLoading(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setPayload({ ...payload, targetValue: user.id, targetName: user.name });
    setUserSearchInput("");
    setUserSearchResults([]);
  };

  const handleClearUserSelection = () => {
    setSelectedUser(null);
    setPayload({ ...payload, targetValue: undefined, targetName: undefined });
  };

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) => {
      if (prev.includes(classId)) {
        return prev.filter((id) => id !== classId);
      } else {
        return [...prev, classId];
      }
    });
  };

  const selectAllClasses = () => {
    setSelectedClasses(classes.map((c) => c.id));
  };

  const clearAllClasses = () => {
    setSelectedClasses([]);
  };

  const buildEmailHtml = (): string => {
    return buildEmailTemplate(payload.subject, payload.body, schoolName || undefined);
  };

  const handleSendEmail = async () => {
    try {
      if (!payload.subject.trim() || !payload.body.trim()) {
        toast.error("Subject and body are required");
        return;
      }

      if (
        (["role", "user", "class", "class_teachers"].includes(payload.target) &&
          !payload.targetValue) ||
        (payload.target === "multiple_classes" && selectedClasses.length === 0)
      ) {
        toast.error(`Please select a ${payload.target.replace("_", " ")}`);
        return;
      }

      if (recipientCount === 0) {
        toast.error("No recipients found matching the criteria");
        return;
      }

      setLoading(true);

      const requestPayload = {
        ...payload,
        ...(payload.target === "multiple_classes" && { targetValue: selectedClasses }),
      };

      const response = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      const successRate = data.successRate ? parseFloat(data.successRate) : 0;

      if (successRate === 100) {
        toast.success(
          `✅ Email sent successfully to ${data.successCount} recipient${data.successCount !== 1 ? "s" : ""}!`
        );
      } else if (successRate >= 50) {
        toast.warning(
          `⚠️ Email sent with partial success (${data.successRate}% delivered)`
        );
      } else {
        toast.error(
          `❌ Email delivery failed (${data.successRate}% delivered)`
        );
      }

      // Reset form
      setPayload({
        subject: "",
        body: "",
        target: "all",
      });
      setSelectedUser(null);
      setUserSearchInput("");
      setSelectedClasses([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Send Emails</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Send bulk emails to users or groups
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Target Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Send To
            </label>
            <Select
              value={payload.target}
              onValueChange={(value: any) => {
                setPayload({ ...payload, target: value, targetValue: undefined });
                setSelectedUser(null);
                setUserSearchInput("");
                setSelectedClasses([]);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>General</SelectLabel>
                  <SelectItem value="all">All Users</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>By Role</SelectLabel>
                  <SelectItem value="role">Specific Role</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>By Class</SelectLabel>
                  <SelectItem value="class">Single Class</SelectItem>
                  <SelectItem value="multiple_classes">Multiple Classes</SelectItem>
                  <SelectItem value="class_teachers">Class Teachers</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Individual</SelectLabel>
                  <SelectItem value="user">Specific User</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Role Selection */}
          {payload.target === "role" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Role
              </label>
              <Select
                value={String(typeof payload.targetValue === "string" ? payload.targetValue : "")}
                onValueChange={(value) => {
                  setPayload({ ...payload, targetValue: value });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="parent">Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Single Class Selection */}
          {payload.target === "class" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <Select
                value={String(typeof payload.targetValue === "string" ? payload.targetValue : "")}
                onValueChange={(value) => {
                  setPayload({ ...payload, targetValue: value });
                }}
              >
                <SelectTrigger className="w-full" disabled={classesLoading}>
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectGroup key={cls.level}>
                      <SelectLabel>{cls.level}</SelectLabel>
                      <SelectItem value={cls.id}>{cls.name}</SelectItem>
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Multiple Classes Selection */}
          {payload.target === "multiple_classes" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Classes
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllClasses}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearAllClasses}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto">
                {classesLoading ? (
                  <p className="text-sm text-gray-500">Loading classes...</p>
                ) : classes.length > 0 ? (
                  classes.map((cls) => (
                    <label key={cls.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => toggleClass(cls.id)}
                        className="rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{cls.name}</p>
                        <p className="text-xs text-gray-500">{cls.level}</p>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No classes available</p>
                )}
              </div>
            </div>
          )}

          {/* Class Teachers Selection */}
          {payload.target === "class_teachers" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <Select
                value={String(typeof payload.targetValue === "string" ? payload.targetValue : "")}
                onValueChange={(value) => {
                  setPayload({ ...payload, targetValue: value });
                }}
              >
                <SelectTrigger className="w-full" disabled={classesLoading}>
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectGroup key={cls.level}>
                      <SelectLabel>{cls.level}</SelectLabel>
                      <SelectItem value={cls.id}>{cls.name}</SelectItem>
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* User Search */}
          {payload.target === "user" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search User
              </label>
              <div className="space-y-2">
                <Input
                  placeholder="Search by name or email..."
                  value={userSearchInput}
                  onChange={(e) => {
                    setUserSearchInput(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  disabled={userSearchLoading || !!selectedUser}
                />

                {selectedUser && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{selectedUser.name}</p>
                      <p className="text-xs text-gray-600">{selectedUser.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearUserSelection}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {!selectedUser && userSearchResults.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {userSearchResults.map((user) => (
                      <button
                        key={`${user.role}-${user.id}`}
                        onClick={() => handleSelectUser(user)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-600">{user.email}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Email subject line..."
              value={payload.subject}
              onChange={(e) => setPayload({ ...payload, subject: e.target.value })}
              maxLength={100}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">{payload.subject.length}/100</p>
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Body <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Write your email message here... Line breaks will be preserved."
              value={payload.body}
              onChange={(e) => setPayload({ ...payload, body: e.target.value })}
              rows={6}
              disabled={loading}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{payload.body.length} characters</p>
          </div>

          {/* Recipient Info */}
          {recipientCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-gray-900">
                  Email will be sent to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Make sure you've selected your intended recipients before sending.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <Button
              onClick={() => setPreviewOpen(true)}
              variant="outline"
              disabled={!payload.subject.trim() || !payload.body.trim() || loading}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview Email
            </Button>

            <Button
              onClick={handleSendEmail}
              disabled={loading || recipientCount === 0}
              className="gap-2 flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email ({recipientCount})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={payload.subject}
        htmlContent={buildEmailHtml()}
        schoolName={schoolName || undefined}
      />
    </>
  );
}
