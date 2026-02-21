"use client";

import { useState } from "react";
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
} from "@/components/ui/select";
import { Bell, Send, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SendNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  link?: string;
  target: "all" | "role" | "user" | "class";
  targetValue?: string;
  data?: Record<string, string>;
}

export function AdminSendNotificationComponent() {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<SendNotificationPayload>({
    title: "",
    body: "",
    target: "all",
  });

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

      toast.success(
        `Notification sent successfully! (${data.successCount} recipient${
          data.successCount !== 1 ? "s" : ""
        })`
      );

      // Reset form
      setPayload({
        title: "",
        body: "",
        target: "all",
      });
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
          <Select value={payload.target} onValueChange={(value: any) => 
            setPayload({ ...payload, target: value, targetValue: undefined })
          }>
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
              User ID
            </label>
            <Input
              placeholder="Enter user ID"
              value={payload.targetValue || ""}
              onChange={(e) =>
                setPayload({ ...payload, targetValue: e.target.value })
              }
            />
          </div>
        )}

        {payload.target === "class" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class
            </label>
            <Input
              placeholder="Enter class ID"
              value={payload.targetValue || ""}
              onChange={(e) =>
                setPayload({ ...payload, targetValue: e.target.value })
              }
            />
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
          <Input
            placeholder="/student/assignments or https://..."
            value={payload.link || ""}
            onChange={(e) => setPayload({ ...payload, link: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Where users will be taken when they click the notification
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
