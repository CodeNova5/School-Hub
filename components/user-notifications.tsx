"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  Heart,
  MessageCircle,
  Share2,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  link?: string;
  target: string;
  targetValue?: string;
  createdAt: string;
  sentBy: string;
}

interface GroupedNotifications {
  today: NotificationItem[];
  thisWeek: NotificationItem[];
  thisMonth: NotificationItem[];
  earlier: NotificationItem[];
}

interface UserNotificationsProps {
  role: "student" | "teacher" | "parent";
}

export function UserNotificationsComponent({ role }: UserNotificationsProps) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<GroupedNotifications>({
    today: [],
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchNotifications();
    }
  }, [role, schoolId, schoolLoading]);

  const groupNotificationsByTime = (
    notifications: NotificationItem[]
  ): GroupedNotifications => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(now);
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const grouped: GroupedNotifications = {
      today: [],
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };

    notifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);

      if (notifDate >= today) {
        grouped.today.push(notification);
      } else if (notifDate >= thisWeekStart) {
        grouped.thisWeek.push(notification);
      } else if (notifDate >= thisMonthStart) {
        grouped.thisMonth.push(notification);
      } else {
        grouped.earlier.push(notification);
      }
    });

    return grouped;
  };

  const fetchNotifications = async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      setError(null);

      const { data: notificationsData, error: fetchError } = await supabase
        .from("notification_logs")
        .select("*")
        .eq("school_id", schoolId)
        .or(
          `and(target.eq.all),and(target.eq.role,target_value.eq.${role})`
        )
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message || "Failed to fetch notifications");
      }

      const formatted = (notificationsData || []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        imageUrl: n.image_url,
        link: n.link,
        target: n.target,
        targetValue: n.target_value,
        createdAt: n.created_at,
        sentBy: n.sent_by,
      }));

      setTotalCount(formatted.length);
      const grouped = groupNotificationsByTime(formatted);
      setNotifications(grouped);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return "now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return then.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const NotificationCard = ({ notification }: { notification: NotificationItem }) => (
    <div
      className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200 border-b hover:border-gray-300"
      onClick={() => {
        if (notification.link) {
          window.location.href = notification.link;
        }
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="relative h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-sm">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-12 w-12 rounded-full object-contain"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm line-clamp-2">
              {notification.title}
            </p>
            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
              {notification.body}
            </p>
          </div>
          <div className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">
            {formatTimeAgo(notification.createdAt)}
          </div>
        </div>
      </div>

      {/* Right Icon */}
      <div className="flex-shrink-0">
        {notification.link && (
          <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
            <MoreHorizontal className="h-4 w-4 text-gray-600" />
          </div>
        )}
      </div>
    </div>
  );

  const NotificationGroup = ({
    title,
    notifications: notifs,
  }: {
    title: string;
    notifications: NotificationItem[];
  }) => {
    if (notifs.length === 0) return null;

    return (
      <div>
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {title}
          </p>
        </div>
        <div className="bg-white">
          {notifs.map((notif) => (
            <NotificationCard key={notif.id} notification={notif} />
          ))}
        </div>
      </div>
    );
  };

  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="hover:bg-gray-100"
          >
            <RefreshCw
              className={`h-5 w-5 text-gray-600 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="bg-white">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 border-b">
                <div className="flex gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white p-12 text-center">
            <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-red-600 font-medium mb-2">Error loading notifications</p>
            <p className="text-sm text-gray-600">{error}</p>
            <Button onClick={handleRefresh} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : totalCount === 0 ? (
          <div className="bg-white p-12 text-center">
            <div className="flex justify-center mb-4">
              <Bell className="h-16 w-16 text-gray-300" />
            </div>
            <p className="text-gray-900 font-semibold mb-1">No notifications</p>
            <p className="text-sm text-gray-600">
              You're all caught up! You'll see notifications here when you get new messages.
            </p>
          </div>
        ) : (
          <div className="bg-white border-r border-l border-gray-200">
            {/* Today */}
            <NotificationGroup
              title="Today"
              notifications={notifications.today}
            />

            {/* This Week */}
            <NotificationGroup
              title="This Week"
              notifications={notifications.thisWeek}
            />

            {/* This Month */}
            <NotificationGroup
              title="This Month"
              notifications={notifications.thisMonth}
            />

            {/* Earlier */}
            <NotificationGroup
              title="Earlier"
              notifications={notifications.earlier}
            />
          </div>
        )}
      </div>
    </div>
  );
}
