"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface SendWhatsAppPayload {
  title: string;
  body: string;
  target: "all" | "role" | "user" | "class";
  targetValue?: string;
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
  phone?: string;
  role: "student" | "teacher" | "parent";
  metadata?: string;
}

export function AdminSendWhatsAppComponent() {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [payload, setPayload] = useState<SendWhatsAppPayload>({
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
        .select("id, name, school_class_levels(name, order_sequence)")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching classes:", error);
        return;
      }

      if (data) {
        const formatted: ClassOption[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          level: c.school_class_levels?.name ?? "N/A",
          classLevelOrder: c.school_class_levels?.order_sequence ?? 999,
        }));

        formatted.sort((a, b) =>
          a.classLevelOrder !== b.classLevelOrder
            ? a.classLevelOrder - b.classLevelOrder
            : a.name.localeCompare(b.name)
        );

        setClasses(formatted);
      }
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    } finally {
      setClassesLoading(false);
    }
  };

  const searchUsers = async (term: string) => {
    if (!term.trim()) {
      setUserSearchResults([]);
      return;
    }

    try {
      setUserSearchLoading(true);
      const results: UserSearchResult[] = [];

      const [{ data: students }, { data: teachers }, { data: parents }] =
        await Promise.all([
          supabase
            .from("students")
            .select("id, first_name, last_name, phone, classes(name)")
            .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`),
          supabase
            .from("teachers")
            .select("id, first_name, last_name, phone")
            .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`),
          supabase
            .from("parents")
            .select("id, name, phone")
            .ilike("name", `%${term}%`),
        ]);

      if (students) {
        results.push(
          ...students.map((s: any) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            phone: s.phone,
            role: "student" as const,
            metadata: (s as any).classes?.name ?? "N/A",
          }))
        );
      }
      if (teachers) {
        results.push(
          ...teachers.map((t: any) => ({
            id: t.id,
            name: `${t.first_name} ${t.last_name}`,
            phone: t.phone,
            role: "teacher" as const,
          }))
        );
      }
      if (parents) {
        results.push(
          ...parents.map((p: any) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            role: "parent" as const,
          }))
        );
      }

      setUserSearchResults(results);
    } catch (err) {
      console.error("Error searching users:", err);
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

  const handleClearUser = () => {
    setSelectedUser(null);
    setPayload({ ...payload, targetValue: undefined, targetName: undefined });
  };

  const handleSend = async () => {
    if (!payload.title.trim() || !payload.body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (
      (payload.target === "role" ||
        payload.target === "user" ||
        payload.target === "class") &&
      !payload.targetValue
    ) {
      toast.error(`Please select a ${payload.target}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed to send WhatsApp messages");

      if (data.warning) {
        toast.warning(`⚠️ ${data.warning}`);
      } else {
        const rate = parseFloat(data.successRate ?? "100");
        if (rate === 100) {
          toast.success(
            `✅ WhatsApp sent! (${data.successCount}/${data.totalRecipients} delivered)`
          );
        } else if (rate >= 50) {
          toast.warning(
            `⚠️ Partial delivery (${data.successRate}%). ${data.failureCount} failed.`
          );
        } else {
          toast.error(
            `❌ Low delivery rate (${data.successRate}%). Check phone numbers in user profiles.`
          );
        }
      }

      setPayload({ title: "", body: "", target: "all" });
      setSelectedUser(null);
      setUserSearchInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send WhatsApp messages");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Target Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Send To
        </label>
        <Select
          value={payload.target}
          onValueChange={(value: any) => {
            setPayload({ ...payload, target: value, targetValue: undefined, targetName: undefined });
            setSelectedUser(null);
            setUserSearchInput("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="role">By Role (Students / Teachers / Parents)</SelectItem>
            <SelectItem value="user">Specific User</SelectItem>
            <SelectItem value="class">Specific Class</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Role picker */}
      {payload.target === "role" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <Select
            value={payload.targetValue}
            onValueChange={(v) => setPayload({ ...payload, targetValue: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="parent">Parents</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* User search */}
      {payload.target === "user" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search User by Name
          </label>
          {selectedUser ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{selectedUser.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                  </span>
                  {selectedUser.phone && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {selectedUser.phone}
                    </span>
                  )}
                  {selectedUser.metadata && (
                    <span className="text-xs text-gray-400">
                      ({selectedUser.metadata})
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearUser}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Type user name to search…"
                value={userSearchInput}
                onChange={(e) => {
                  setUserSearchInput(e.target.value);
                  searchUsers(e.target.value);
                }}
              />
              {userSearchLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}
              {userSearchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-md">
                  {userSearchResults.map((user) => (
                    <button
                      key={`${user.role}-${user.id}`}
                      onClick={() => handleSelectUser(user)}
                      className="w-full text-left hover:bg-green-50 px-3 py-2.5 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                            {user.phone ? (
                              <span className="text-xs text-gray-500">{user.phone}</span>
                            ) : (
                              <span className="text-xs text-red-400 italic">no phone</span>
                            )}
                          </div>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {userSearchInput && userSearchResults.length === 0 && !userSearchLoading && (
                <p className="text-sm text-red-500">
                  No users found matching "{userSearchInput}"
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Class picker */}
      {payload.target === "class" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
          <Select
            value={payload.targetValue}
            onValueChange={(v) => setPayload({ ...payload, targetValue: v })}
            disabled={classesLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={classesLoading ? "Loading classes…" : "Select a class"}
              />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — Level {c.level}
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
          placeholder="Message subject / heading"
          value={payload.title}
          onChange={(e) => setPayload({ ...payload, title: e.target.value })}
          maxLength={100}
        />
        <p className="text-xs text-gray-400 mt-1">{payload.title.length}/100</p>
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message *
        </label>
        <Textarea
          placeholder="Type your WhatsApp message here…"
          value={payload.body}
          onChange={(e) => setPayload({ ...payload, body: e.target.value })}
          maxLength={1024}
          rows={5}
        />
        <p className="text-xs text-gray-400 mt-1">{payload.body.length}/1024</p>
      </div>

      {/* Info Alert */}
      <Alert className="border-green-200 bg-green-50">
        <AlertCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 text-sm">
          Messages are sent to phone numbers stored in user profiles. Only users with a valid phone number will receive the broadcast. Numbers are automatically normalized to international format (E.164).
        </AlertDescription>
      </Alert>

      {/* Send Button */}
      <Button
        onClick={handleSend}
        disabled={loading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold transition-all duration-200"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send WhatsApp Message
          </>
        )}
      </Button>
    </div>
  );
}
