"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

      const response = await fetch(`/api/notifications?role=${role}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch notifications");
      }

      setStats(result.data);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError(err.message);
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

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">
            View announcements and messages for {getRoleLabel(role).toLowerCase()}s
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Received */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center">
                <Bell className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Total Received</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.totalReceived.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">All time</p>
              </div>
            </CardContent>
          </Card>

          {/* Today Count */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Received Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.todayCount}
                </p>
                <p className="text-xs text-gray-500 mt-2">notifications</p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Count */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Recent</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.recentNotifications.length}
                </p>
                <p className="text-xs text-gray-500 mt-2">recent messages</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State for Stats */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notification Trend Chart */}
      {!loading && stats && stats.notificationTrend.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 pb-6">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Notification Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.notificationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="received"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: "#3B82F6", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Notifications Received"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Notifications List */}
      <Card className="shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              Recent Notifications
            </CardTitle>
            {!loading && stats && (
              <Badge variant="secondary">{stats.recentNotifications.length} messages</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-300" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : stats && stats.recentNotifications.length > 0 ? (
            <div className="space-y-4">
              {stats.recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow group cursor-pointer"
                  onClick={() => {
                    if (notification.link) {
                      window.location.href = notification.link;
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.body}
                      </p>
                      {notification.imageUrl && (
                        <img
                          src={notification.imageUrl}
                          alt={notification.title}
                          className="mt-3 max-h-48 rounded-lg object-cover"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="text-xs text-gray-500">
                      {notification.link && (
                        <span className="text-blue-600 font-medium">Click to view →</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No notifications yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
