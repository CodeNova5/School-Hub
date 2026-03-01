"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Bell, Send, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface SendNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  link?: string;
  target: "all" | "role" | "user" | "class";
  targetValue?: string;
  data?: Record<string, string>;
}

interface ClassOption {
  id: string;
  name: string;
  level: string;
}

interface UserSearchResult {
  id: string;
  name: string;
  email?: string;
  role: "student" | "teacher" | "parent" | "admin";
  metadata?: string;
}

interface LinkOption {
  label: string;
  value: string;
  group: string;
}

export function AdminSendNotificationComponent() {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [payload, setPayload] = useState<SendNotificationPayload>({
    title: "",
    body: "",
    target: "all",
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setClassesLoading(true);
      
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, level")
        .order("level", { ascending: true });

      if (error) {
        console.error("Error fetching classes:", error);
        return;
      }

      if (data) {
        setClasses(data);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    } finally {
      setClassesLoading(false);
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
        .select("id, name, email, class")
        .ilike("name", `%${searchTerm}%`);

      if (students) {
        results.push(
          ...students.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            role: "student" as const,
            metadata: s.class,
          }))
        );
      }

      // Search in teachers table
      const { data: teachers } = await supabase
        .from("teachers")
        .select("id, name, email")
        .ilike("name", `%${searchTerm}%`);

      if (teachers) {
        results.push(
          ...teachers.map((t) => ({
            id: t.id,
            name: t.name,
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
          ...parents.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: "parent" as const,
          }))
        );
      }

      // Search in admins table
      const { data: admins } = await supabase
        .from("admins")
        .select("id, name, email")
        .ilike("name", `%${searchTerm}%`);

      if (admins) {
        results.push(
          ...admins.map((a) => ({
            id: a.id,
            name: a.name,
            email: a.email,
            role: "admin" as const,
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
    setPayload({ ...payload, targetValue: user.id });
    setUserSearchInput("");
    setUserSearchResults([]);
  };

  const handleClearUserSelection = () => {
    setSelectedUser(null);
    setPayload({ ...payload, targetValue: undefined });
  };

  const handleSendNotification = async () => {
    try {
      if (!payload.title.trim() || !payload.body.trim()) {
        toast.error("Title and body are required");
        return;
      }

      if (
        (payload.target === "role" || payload.target === "user" || payload.target === "class") &&
        !payload.targetValue
      ) {
        toast.error(`Please select a ${payload.target}`);
        return;
      }

      setLoading(true);

      const response = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send notification");
      }

      // Show detailed success message with diagnostics
      const successRate = data.successRate ? parseFloat(data.successRate) : 0;
      let successMessage = `Notification sent! (${data.successCount}/${data.totalTokens} reached)`;
      
      // Add warnings if success rate is low
      if (successRate < 100 && successRate >= 50) {
        toast.warning(
          `⚠️ Low delivery rate (${data.successRate}%). ${data.diagnostics?.recommendation || ""}`
        );
      } else if (successRate < 50 && successRate > 0) {
        toast.error(
          `❌ Very low delivery rate (${data.successRate}%). ${data.diagnostics?.recommendation || "Check token health."}`
        );
      } else if (successRate === 0 && data.totalTokens > 0) {
        toast.error(
          `❌ No notifications delivered. ${data.diagnostics?.recommendation || "Tokens may be invalid."}`
        );
      } else if (data.totalTokens === 0) {
        toast.warning(
          `⚠️ No active tokens found. Users need to register for notifications.`
        );
      } else {
        toast.success(successMessage);
      }

      // Reset form
      setPayload({
        title: "",
        body: "",
        target: "all",
      });
      setSelectedUser(null);
      setUserSearchInput("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send notification";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle>Send Notifications</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Send push notifications to users
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
          <Select value={payload.target} onValueChange={(value: any) => {
            setPayload({ ...payload, target: value, targetValue: undefined });
            setSelectedUser(null);
            setUserSearchInput("");
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="role">By Role (Students/Teachers/Parents)</SelectItem>
              <SelectItem value="user">Specific User</SelectItem>
              <SelectItem value="class">Specific Class</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target Value Selection */}
        {payload.target === "role" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <Select value={payload.targetValue} onValueChange={(value) => 
              setPayload({ ...payload, targetValue: value })
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="parent">Parents</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {payload.target === "user" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search User by Name
            </label>
            
            {selectedUser ? (
              // Selected user display
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{selectedUser.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                    </span>
                    {selectedUser.email && (
                      <span className="text-xs text-gray-600">{selectedUser.email}</span>
                    )}
                    {selectedUser.metadata && (
                      <span className="text-xs text-gray-500">({selectedUser.metadata})</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearUserSelection}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              // Search input
              <div className="space-y-2">
                <Input
                  placeholder="Type user name to search..."
                  value={userSearchInput}
                  onChange={(e) => {
                    setUserSearchInput(e.target.value);
                    searchUsers(e.target.value);
                  }}
                />

                {/* Search Results */}
                {userSearchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white">
                    {userSearchResults.map((user) => (
                      <button
                        key={`${user.role}-${user.id}`}
                        onClick={() => handleSelectUser(user)}
                        className="w-full text-left hover:bg-blue-50 px-3 py-2 border-b last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </span>
                              {user.email && (
                                <span className="text-xs text-gray-600">{user.email}</span>
                              )}
                              {user.metadata && (
                                <span className="text-xs text-gray-500">({user.metadata})</span>
                              )}
                            </div>
                          </div>
                          <CheckCircle className="h-4 w-4 text-blue-500 ml-2 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {userSearchLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}

                {userSearchInput && userSearchResults.length === 0 && !userSearchLoading && (
                  <p className="text-sm text-red-500">No users found matching "{userSearchInput}"</p>
                )}
              </div>
            )}
          </div>
        )}

        {payload.target === "class" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class
            </label>
            <Select value={payload.targetValue} onValueChange={(value) => 
              setPayload({ ...payload, targetValue: value })
            } disabled={classesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={classesLoading ? "Loading classes..." : "Select a class"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((classItem) => (
                  <SelectItem key={classItem.id} value={classItem.id}>
                    {classItem.name} - Level {classItem.level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {classes.length === 0 && !classesLoading && (
              <p className="text-xs text-red-500 mt-1">No classes available</p>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <Input
            placeholder="Notification title"
            value={payload.title}
            onChange={(e) => setPayload({ ...payload, title: e.target.value })}
            maxLength={100}
          />
          <p className="text-xs text-gray-500 mt-1">
            {payload.title.length}/100 characters
          </p>
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message *
          </label>
          <Textarea
            placeholder="Notification message"
            value={payload.body}
            onChange={(e) => setPayload({ ...payload, body: e.target.value })}
            maxLength={500}
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-1">
            {payload.body.length}/500 characters
          </p>
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image URL (Optional)
          </label>
          <Input
            placeholder="https://example.com/image.png"
            value={payload.imageUrl || ""}
            onChange={(e) => setPayload({ ...payload, imageUrl: e.target.value })}
          />
        </div>

        {/* Link */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Link (Optional)
          </label>
          <div className="space-y-2">
            {payload.target === "all" ? (
              <>
                <Select value={payload.link || "/"} onValueChange={(value) => 
                  setPayload({ ...payload, link: value })
                }>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    <SelectItem value="/">🏠 Home (Root)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Or enter custom URL (e.g., https://...)"
                  value={payload.link && payload.link !== "/" && payload.link !== "" ? payload.link : ""}
                  onChange={(e) => setPayload({ ...payload, link: e.target.value })}
                  className="text-xs"
                />
              </>
            ) : (
              <>
                <Select value={payload.link || ""} onValueChange={(value) => 
                  setPayload({ ...payload, link: value })
                }>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a destination page" />
                  </SelectTrigger>
                  <SelectContent className="w-full max-h-96">
                    {/* Student Role */}
                    {payload.target === "role" && payload.targetValue === "student" && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold text-slate-500">Student Pages</SelectLabel>
                        <SelectItem value="/student">📊 Dashboard</SelectItem>
                        <SelectItem value="/student/timetable">📅 Timetable</SelectItem>
                        <SelectItem value="/student/subjects">📚 Subjects</SelectItem>
                        <SelectItem value="/student/results">⭐ Results</SelectItem>
                        <SelectItem value="/student/assignments">📝 Assignments</SelectItem>
                        <SelectItem value="/student/attendance">✓ Attendance</SelectItem>
                        <SelectItem value="/student/calendar">📆 Calendar</SelectItem>
                      </SelectGroup>
                    )}

                    {/* Teacher Role */}
                    {payload.target === "role" && payload.targetValue === "teacher" && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold text-slate-500">Teacher Pages</SelectLabel>
                        <SelectItem value="/teacher">📊 Dashboard</SelectItem>
                        <SelectItem value="/teacher/classes">🏫 Classes</SelectItem>
                        <SelectItem value="/teacher/students">👥 Students</SelectItem>
                        <SelectItem value="/teacher/subjects">📚 Subjects</SelectItem>
                        <SelectItem value="/teacher/results">⭐ Results</SelectItem>
                        <SelectItem value="/teacher/assignments">📝 Assignments</SelectItem>
                        <SelectItem value="/teacher/timetable">📅 Timetable</SelectItem>
                        <SelectItem value="/teacher/calendar">📆 Calendar</SelectItem>
                      </SelectGroup>
                    )}

                    {/* Parent Role */}
                    {payload.target === "role" && payload.targetValue === "parent" && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold text-slate-500">Parent Pages</SelectLabel>
                        <SelectItem value="/parent">📊 Dashboard</SelectItem>
                        <SelectItem value="/parent/children">👨‍👩‍👧 My Children</SelectItem>
                        <SelectItem value="/parent/calendar">📆 Calendar</SelectItem>
                      </SelectGroup>
                    )}

                    {/* Admin Role */}
                    {payload.target === "role" && payload.targetValue === "admin" && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold text-slate-500">Admin Pages</SelectLabel>
                        <SelectItem value="/admin">📊 Dashboard</SelectItem>
                        <SelectItem value="/admin/manage-admins">👥 Manage Admins</SelectItem>
                        <SelectItem value="/admin/students">🎓 Students</SelectItem>
                        <SelectItem value="/admin/teachers">👨‍🏫 Teachers</SelectItem>
                        <SelectItem value="/admin/classes">🏫 Classes</SelectItem>
                        <SelectItem value="/admin/subjects">📚 Subjects</SelectItem>
                        <SelectItem value="/admin/timetable">📅 Timetable</SelectItem>
                        <SelectItem value="/admin/notifications">🔔 Notifications</SelectItem>
                        <SelectItem value="/admin/promotions">📈 Promotions</SelectItem>
                        <SelectItem value="/admin/admissions">📋 Admissions</SelectItem>
                        <SelectItem value="/admin/history">📜 History</SelectItem>
                        <SelectItem value="/admin/calendar">📆 Calendar</SelectItem>
                        <SelectItem value="/admin/settings">⚙️ Settings</SelectItem>
                      </SelectGroup>
                    )}

                    {/* Class Target (show student pages) */}
                    {payload.target === "class" && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold text-slate-500">Student Pages</SelectLabel>
                        <SelectItem value="/student">📊 Dashboard</SelectItem>
                        <SelectItem value="/student/timetable">📅 Timetable</SelectItem>
                        <SelectItem value="/student/subjects">📚 Subjects</SelectItem>
                        <SelectItem value="/student/results">⭐ Results</SelectItem>
                        <SelectItem value="/student/assignments">📝 Assignments</SelectItem>
                        <SelectItem value="/student/attendance">✓ Attendance</SelectItem>
                        <SelectItem value="/student/calendar">📆 Calendar</SelectItem>
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Or enter custom URL (e.g., https://...)"
                  value={payload.link || ""}
                  onChange={(e) => setPayload({ ...payload, link: e.target.value })}
                  className="text-xs"
                />
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {payload.target === "all" 
              ? "For 'All Users', defaults to home. Or enter a custom URL."
              : "Select a destination or enter a custom URL. Users will be directed here when clicking the notification."}
          </p>
        </div>

        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Notifications will be sent to all users with active notification tokens. Users must have granted notification permission first.
          </AlertDescription>
        </Alert>

        {/* Send Button */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSendNotification}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
