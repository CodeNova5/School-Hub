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
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

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

interface NotificationStats {
  totalReceived: number;
  todayCount: number;
  recentNotifications: NotificationItem[];
  notificationTrend: Array<{ date: string; received: number }>;
}

interface UserNotificationsProps {
  role: "student" | "teacher" | "parent";
}

export function UserNotificationsComponent({ role }: UserNotificationsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [role]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch notifications visible to this role
      // RLS policy ensures only notifications sent to "all" or to this specific role are returned
      const { data: notifications, error: fetchError } = await supabase
        .from("notification_logs")
        .select("*")
        .or(
          `and(target.eq.all),and(target.eq.role,target_value.eq.${role})`
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchError) {
        throw new Error(fetchError.message || "Failed to fetch notifications");
      }

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCount = (notifications || []).filter(
        (n) => new Date(n.created_at) >= today
      ).length;

      // Get the last 7 days of data for trend
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        return date;
      }).reverse();

      const notificationTrend = last7Days.map((date) => {
        const count = (notifications || []).filter((n) => {
          const nDate = new Date(n.created_at);
          nDate.setHours(0, 0, 0, 0);
          return nDate.getTime() === date.getTime();
        }).length;

        return {
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          received: count,
        };
      });

      // Format the response
      const recentNotifications = (notifications || []).map((n) => ({
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

      setStats({
        totalReceived: notifications?.length || 0,
        todayCount,
        recentNotifications: recentNotifications.slice(0, 10),
        notificationTrend,
      });
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

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return then.toLocaleDateString();
  };

  const getRoleLabel = (role: "student" | "teacher" | "parent") => {
    const labels = {
      student: "Student",
      teacher: "Teacher",
      parent: "Parent",
    };
    return labels[role];
  };

  const getNotificationIcon = (index: number) => {
    const icons = [Heart, MessageCircle, Share2, Bell];
    return icons[index % icons.length];
  };

  const getRandomColor = (index: number) => {
    const colors = [
      "bg-gradient-to-br from-pink-400 to-red-500",
      "bg-gradient-to-br from-blue-400 to-purple-500",
      "bg-gradient-to-br from-green-400 to-emerald-500",
      "bg-gradient-to-br from-yellow-400 to-orange-500",
      "bg-gradient-to-br from-cyan-400 to-blue-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar with Logo */}
      <div className="w-16 md:w-72 bg-white border-r border-gray-200 flex flex-col items-center md:items-start p-4 md:p-6 sticky top-0 h-screen">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center">
          <img src="/logo.png" alt="Logo" className="h-10 md:h-12 w-auto" />
        </div>

        {/* Navigation */}
        <nav className="space-y-6 flex-1 hidden md:block w-full">
          <div className="flex items-center gap-4 text-gray-700 hover:text-gray-900 cursor-pointer transition">
            <Bell className="h-6 w-6" />
            <span className="font-semibold">Notifications</span>
          </div>
          <div className="flex items-center gap-4 text-gray-600 hover:text-gray-900 cursor-pointer transition">
            <MessageCircle className="h-6 w-6" />
            <span>Messages</span>
          </div>
          <div className="flex items-center gap-4 text-gray-600 hover:text-gray-900 cursor-pointer transition">
            <Heart className="h-6 w-6" />
            <span>Likes</span>
          </div>
        </nav>

        {/* Settings */}
        <div className="flex items-center justify-center md:justify-start w-full gap-4 text-gray-600 hover:text-gray-900 cursor-pointer mt-auto transition">
          <Settings className="h-6 w-6" />
          <span className="hidden md:block">Settings</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur border-b border-gray-200 px-4 md:px-6 py-4 z-40">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <Button
              size="icon"
              variant="ghost"
              className="hover:bg-gray-100 rounded-full h-10 w-10"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Notifications Feed */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            // Loading Skeleton
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 p-4 md:p-5 hover:bg-gray-50 transition">
                  <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Error State
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <X className="h-12 w-12 text-red-400 mb-3" />
              <p className="text-gray-600 font-medium text-center">{error}</p>
            </div>
          ) : stats && stats.recentNotifications.length > 0 ? (
            // Notifications List
            stats.recentNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className="flex gap-3 p-4 md:p-5 hover:bg-gray-50 transition cursor-pointer group"
                onClick={() => {
                  if (notification.link) {
                    window.location.href = notification.link;
                  }
                }}
              >
                {/* Avatar */}
                <div
                  className={`${getRandomColor(index)} h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm`}
                >
                  {React.createElement(getNotificationIcon(index), {
                    className: "h-6 w-6 text-white",
                  })}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm md:text-base">
                        <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition">
                          {notification.title}
                        </span>
                        <span className="text-gray-600 ml-1 truncate">
                          {notification.body}
                        </span>
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {/* Image Thumbnail */}
                    {notification.imageUrl && (
                      <img
                        src={notification.imageUrl}
                        alt={notification.title}
                        className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                  </div>

                  {/* Full Message on Hover */}
                  {notification.link && (
                    <p className="text-xs text-blue-600 font-semibold mt-2 group-hover:underline">
                      View →
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="bg-gradient-to-br from-gray-200 to-gray-300 rounded-full p-8 mb-4">
                <Bell className="h-12 w-12 text-gray-500" />
              </div>
              <p className="text-gray-600 font-semibold text-lg">
                No notifications yet
              </p>
              <p className="text-gray-400 text-sm mt-1">
                When you get notifications, they'll show up here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
