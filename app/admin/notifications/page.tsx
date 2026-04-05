'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { AdminSendNotificationComponent } from '@/components/admin-send-notification';
import { AdminSendEmailComponent } from '@/components/admin-send-email';
import { EmailHistoryTab } from '@/components/email-history-tab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
  RefreshCw,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationsSkeleton } from '@/components/skeletons';
import {
  LineChart,
  Line,
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
  targetName?: string;
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

interface EmailLog {
  id: string;
  title: string;
  body: string;
  target: string;
  targetValue?: string;
  targetName?: string;
  successCount: number;
  failureCount: number;
  createdAt: string;
  sentBy: string;
}

interface EmailStats {
  totalSent: number;
  todayCount: number;
  successRate: number;
  averageRecipientsPerEmail: number;
  recentEmails: EmailLog[];
  emailTrend: Array<{ date: string; sent: number }>;
}

interface TokenDiagnostics {
  totalTokens: number;
  activeTokens: number;
  inactiveTokens: number;
  staleTokensCount: number;
  recentlyInactiveTokensCount: number;
  healthScore: number;
  recommendations: string[];
  roleStats: Record<string, { active: number; inactive: number }>;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<'notifications' | 'emails'>('notifications');
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [diagnostics, setDiagnostics] = useState<TokenDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotificationStats();
    fetchEmailStats();
    fetchTokenDiagnostics();
  }, []);

  const fetchTokenDiagnostics = async () => {
    try {
      const response = await fetch('/api/admin/notifications/diagnostics');
      const result = await response.json();

      if (response.ok) {
        setDiagnostics(result.data);
      }
    } catch (err: any) {
      console.error('Error fetching diagnostics:', err);
    }
  };

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

  const fetchEmailStats = async () => {
    try {
      const response = await fetch('/api/admin/emails/stats');
      const result = await response.json();

      if (response.ok) {
        setEmailStats(result.data);
      }
    } catch (err: any) {
      console.error('Error fetching email stats:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotificationStats();
    await fetchEmailStats();
    await fetchTokenDiagnostics();
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

  const getTargetLabel = (target: string, targetValue?: string, targetName?: string) => {
    switch (target) {
      case 'all':
        return 'All Users';
      case 'role':
        return `${targetValue === 'student' ? 'Students' : targetValue === 'teacher' ? 'Teachers' : targetValue === 'parent' ? 'Parents' : 'Admins'}`;
      case 'user':
        return targetName ? `User: ${targetName}` : `User: ${targetValue}`;
      case 'class':
        return `Class: ${targetValue}`;
      default:
        return target;
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <NotificationsSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Communications Hub</h1>
            <p className="text-gray-600 mt-2 text-lg">
              Manage notifications and emails for your institution
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start md:self-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Module Navigation */}
        <div className="sticky top-0 bg-white z-10 -mx-6 px-6 pt-6 pb-0">
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveModule('notifications')}
              className={`flex items-center gap-2.5 px-5 py-3.5 font-semibold text-sm transition-all duration-300 relative group ${
                activeModule === 'notifications'
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className={`p-2 rounded-lg transition-all ${
                activeModule === 'notifications'
                  ? 'bg-blue-100'
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <Bell className={`h-5 w-5 ${
                  activeModule === 'notifications'
                    ? 'text-blue-600'
                    : 'text-gray-600 group-hover:text-gray-800'
                }`} />
              </div>
              Push Notifications
              {activeModule === 'notifications' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-full"></div>
              )}
            </button>
            <button
              onClick={() => setActiveModule('emails')}
              className={`flex items-center gap-2.5 px-5 py-3.5 font-semibold text-sm transition-all duration-300 relative group ${
                activeModule === 'emails'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className={`p-2 rounded-lg transition-all ${
                activeModule === 'emails'
                  ? 'bg-purple-100'
                  : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <Mail className={`h-5 w-5 ${
                  activeModule === 'emails'
                    ? 'text-purple-600'
                    : 'text-gray-600 group-hover:text-gray-800'
                }`} />
              </div>
              Emails
              {activeModule === 'emails' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-t-full"></div>
              )}
            </button>
          </div>
        </div>

        {/* Token Health Check - Global */}
        {diagnostics && activeModule === 'notifications' && (
          <Card className={`border-l-4 ${
            diagnostics.healthScore >= 80 
              ? 'border-l-green-600 bg-green-50' 
              : diagnostics.healthScore >= 50 
              ? 'border-l-yellow-600 bg-yellow-50' 
              : 'border-l-red-600 bg-red-50'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className={`h-5 w-5 ${
                    diagnostics.healthScore >= 80 
                      ? 'text-green-600' 
                      : diagnostics.healthScore >= 50 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                  }`} />
                  System Token Health
                </CardTitle>
                <Badge variant={
                  diagnostics.healthScore >= 80 
                    ? 'default' 
                    : diagnostics.healthScore >= 50 
                    ? 'secondary' 
                    : 'destructive'
                }>
                  {diagnostics.healthScore}% Healthy
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Total Tokens</p>
                  <p className="text-2xl font-bold mt-1">{diagnostics.totalTokens}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Active</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{diagnostics.activeTokens}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Inactive</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{diagnostics.inactiveTokens}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Stale</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{diagnostics.staleTokensCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Recently Inactive</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{diagnostics.recentlyInactiveTokensCount}</p>
                </div>
              </div>
              
              {diagnostics.recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Recommendations:</p>
                  {diagnostics.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <ArrowRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* NOTIFICATIONS MODULE */}
        {activeModule === 'notifications' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Notifications Stats */}
            {stats && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-1 bg-blue-600 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Total Sent */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-blue-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-blue-100 rounded-lg mb-3">
                          <Bell className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Total Sent</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {stats.totalSent.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">All time</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Today Count */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-green-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-green-100 rounded-lg mb-3">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Sent Today</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {stats.todayCount}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">notifications</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Success Rate */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-emerald-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-emerald-100 rounded-lg mb-3">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Success Rate</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {stats.successRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-2">delivery rate</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Avg Recipients */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-purple-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-purple-100 rounded-lg mb-3">
                          <Users className="h-6 w-6 text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Avg Recipients</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {stats.averageRecipientsPerNotification.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">per notification</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Notification Trend Chart */}
            {stats && stats.notificationTrend.length > 0 && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-6 border-b">
                  <CardTitle className="flex items-center gap-2 text-xl">
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
                        strokeWidth={3}
                        dot={{ fill: '#3B82F6', r: 5 }}
                        activeDot={{ r: 7 }}
                        name="Notifications Sent"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Send Notification Section */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="border-b pb-6">
                <CardTitle className="text-xl">Send New Notification</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Reach your users instantly with push notifications
                </p>
              </CardHeader>
              <CardContent className="pt-8">
                <AdminSendNotificationComponent />
              </CardContent>
            </Card>

            {/* Recent Notifications List */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 pb-6 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    Recent Notifications
                  </CardTitle>
                  {stats && (
                    <Badge variant="secondary" className="text-sm">
                      {stats.recentNotifications.length} recent
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {stats && stats.recentNotifications.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {notification.title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {notification.body}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-2 flex-shrink-0 bg-blue-50">
                            {getTargetLabel(notification.target, notification.targetValue, notification.targetName)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle2 className="h-4 w-4" />
                              {notification.successCount} delivered
                            </div>
                            {notification.failureCount > 0 && (
                              <div className="flex items-center gap-1 text-red-600 font-medium">
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
                  <div className="text-center py-16 text-gray-500">
                    <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No notifications sent yet</p>
                    <p className="text-sm mt-1">Start by sending your first notification above</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-blue-600 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Real-time Delivery</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Notifications are delivered instantly via Firebase Cloud Messaging
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-600 bg-green-50">
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

              <Card className="border-l-4 border-l-purple-600 bg-purple-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Instant Access</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Users see notifications instantly on their devices
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* EMAILS MODULE */}
        {activeModule === 'emails' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Email Stats */}
            {emailStats && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-1 bg-purple-600 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Total Sent */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-blue-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-blue-100 rounded-lg mb-3">
                          <Mail className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Total Sent</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {emailStats.totalSent.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">All time</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Today Count */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-green-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-green-100 rounded-lg mb-3">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Sent Today</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {emailStats.todayCount}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">emails</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Success Rate */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-emerald-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-emerald-100 rounded-lg mb-3">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Success Rate</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {emailStats.successRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-2">delivery rate</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Avg Recipients */}
                  <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-purple-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="inline-flex p-3 bg-purple-100 rounded-lg mb-3">
                          <Users className="h-6 w-6 text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Avg Recipients</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {emailStats.averageRecipientsPerEmail.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">per email</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Send Email Section */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader className="border-b pb-6">
                <CardTitle className="text-xl">Send New Email</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Send professional emails to your recipients
                </p>
              </CardHeader>
              <CardContent className="pt-8">
                <AdminSendEmailComponent />
              </CardContent>
            </Card>

            {/* Email History */}
            <div className="space-y-4">
              <EmailHistoryTab loading={loading} stats={emailStats} />
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-blue-600 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Reliable Delivery</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Emails delivered reliably via Resend
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-600 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Flexible Targeting</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Send to all users, by role, class, or individual recipients
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-600 bg-purple-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Email Preview</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Preview emails before sending to recipients
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
