'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { AdminSendNotificationComponent } from '@/components/admin-send-notification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  target: string;
  targetValue?: string;
  successCount: number;
  failureCount: number;
  createdAt: string;
  sentBy: string;
}

interface NotificationStats {
  totalSent: number;
  todayCount: number;
  successRate: number;
  averageRecipientsPerNotification: number;
  recentNotifications: NotificationLog[];
  notificationTrend: Array<{ date: string; sent: number }>;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotificationStats();
  }, []);

  const fetchNotificationStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/notifications/stats');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch notification stats');
      }

      setStats(result.data);
    } catch (err: any) {
      console.error('Error fetching notification stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotificationStats();
    setRefreshing(false);
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return then.toLocaleDateString();
  };

  const getTargetLabel = (target: string, targetValue?: string) => {
    switch (target) {
      case 'all':
        return 'All Users';
      case 'role':
        return `${targetValue === 'student' ? 'Students' : targetValue === 'teacher' ? 'Teachers' : targetValue === 'parent' ? 'Parents' : 'Admins'}`;
      case 'user':
        return `User: ${targetValue}`;
      case 'class':
        return `Class: ${targetValue}`;
      default:
        return target;
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600 mt-1">
              Send push notifications to users and view notification history
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Quick Stats */}
        {!loading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Total Sent */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Bell className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Total Sent</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stats.totalSent.toLocaleString()}
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
                  <p className="text-sm text-gray-600">Sent Today</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stats.todayCount}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">notifications</p>
                </div>
              </CardContent>
            </Card>

            {/* Success Rate */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stats.successRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">delivery rate</p>
                </div>
              </CardContent>
            </Card>

            {/* Avg Recipients */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Avg Recipients</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stats.averageRecipientsPerNotification.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">per notification</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State for Stats */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send">Send Notification</TabsTrigger>
            <TabsTrigger value="history">Notification History</TabsTrigger>
          </TabsList>

          {/* Send Tab */}
          <TabsContent value="send" className="mt-6 space-y-6">
            <AdminSendNotificationComponent />

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-blue-600">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Real-time Delivery</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Notifications are delivered in real-time via Firebase Cloud Messaging
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-600">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Targeted Sending</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Send to specific roles, classes, or individual users
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-600">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Instant Access</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Users receive notifications instantly on their devices
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6 space-y-6">
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
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sent"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 5 }}
                        activeDot={{ r: 7 }}
                        name="Notifications Sent"
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
                    <Badge variant="secondary">{stats.recentNotifications.length} recent</Badge>
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
                ) : stats && stats.recentNotifications.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {notification.title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.body}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-2 flex-shrink-0">
                            {getTargetLabel(notification.target, notification.targetValue)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              {notification.successCount} sent
                            </div>
                            {notification.failureCount > 0 && (
                              <div className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="h-4 w-4" />
                                {notification.failureCount} failed
                              </div>
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
                    <p>No notifications sent yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
