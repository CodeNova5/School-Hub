'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { AdminSendNotificationComponent } from '@/components/admin-send-notification';
import { AdminSendEmailComponent } from '@/components/admin-send-email';
import { AdminSendWhatsAppComponent } from '@/components/admin-send-whatsapp';
import { EmailHistoryTab } from '@/components/email-history-tab';
import { WhatsAppHistoryTab } from '@/components/whatsapp-history-tab';
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
  Smartphone,
  MessageSquare,
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

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface WhatsAppStats {
  totalSent: number;
  todayCount: number;
  successRate: number;
  averageRecipientsPerMessage: number;
  recentMessages: Array<{
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
  }>;
  whatsappTrend: Array<{ date: string; sent: number }>;
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

type ActiveModule = 'notifications' | 'emails' | 'whatsapp';

// ── Stat Card helper ──────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
  border: string;
}

function StatCard({ icon, iconBg, label, value, sub, border }: StatCardProps) {
  return (
    <Card className={`hover:shadow-lg transition-all hover:scale-[1.03] cursor-default ${border}`}>
      <CardContent className="pt-6">
        <div className="text-center">
          <div className={`inline-flex p-3 ${iconBg} rounded-xl mb-3`}>{icon}</div>
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-xs text-gray-400 mt-2">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ActiveModule>('notifications');
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [whatsappStats, setWhatsappStats] = useState<WhatsAppStats | null>(null);
  const [diagnostics, setDiagnostics] = useState<TokenDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotificationStats();
    fetchEmailStats();
    fetchWhatsAppStats();
    fetchTokenDiagnostics();
  }, []);

  const fetchTokenDiagnostics = async () => {
    try {
      const response = await fetch('/api/admin/notifications/diagnostics');
      const result = await response.json();
      if (response.ok) setDiagnostics(result.data);
    } catch (err) {
      console.error('Error fetching diagnostics:', err);
    }
  };

  const fetchNotificationStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/notifications/stats');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch notification stats');
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
      if (response.ok) setEmailStats(result.data);
    } catch (err) {
      console.error('Error fetching email stats:', err);
    }
  };

  const fetchWhatsAppStats = async () => {
    try {
      const response = await fetch('/api/admin/whatsapp/stats');
      const result = await response.json();
      if (response.ok) setWhatsappStats(result.data);
    } catch (err) {
      console.error('Error fetching WhatsApp stats:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchNotificationStats(),
      fetchEmailStats(),
      fetchWhatsAppStats(),
      fetchTokenDiagnostics(),
    ]);
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
      case 'all': return 'All Users';
      case 'role':
        return targetValue === 'student' ? 'Students'
          : targetValue === 'teacher' ? 'Teachers'
          : targetValue === 'parent' ? 'Parents'
          : 'Admins';
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

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabs: Array<{
    id: ActiveModule;
    label: string;
    icon: React.ReactNode;
    activeColor: string;
    activeBg: string;
    indicatorClass: string;
  }> = [
    {
      id: 'notifications',
      label: 'Push Notifications',
      icon: <Bell className="h-4 w-4" />,
      activeColor: 'text-blue-600',
      activeBg: 'bg-blue-100',
      indicatorClass: 'bg-gradient-to-r from-blue-400 to-blue-600',
    },
    {
      id: 'emails',
      label: 'Emails',
      icon: <Mail className="h-4 w-4" />,
      activeColor: 'text-purple-600',
      activeBg: 'bg-purple-100',
      indicatorClass: 'bg-gradient-to-r from-purple-400 to-purple-600',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <Smartphone className="h-4 w-4" />,
      activeColor: 'text-green-600',
      activeBg: 'bg-green-100',
      indicatorClass: 'bg-gradient-to-r from-green-400 to-emerald-500',
    },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Communications Hub</h1>
            <p className="text-gray-500 mt-2 text-lg">
              Manage push notifications, emails, and WhatsApp broadcasts for your institution
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

        {/* ── Module Navigation ────────────────────────────────────────────── */}
        <div className="sticky top-0 bg-white z-10 -mx-6 px-6 pt-6 pb-0">
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeModule === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveModule(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-3.5 font-semibold text-sm transition-all duration-200 relative group whitespace-nowrap ${
                    isActive ? tab.activeColor : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg transition-all ${
                      isActive ? tab.activeBg : 'bg-transparent group-hover:bg-gray-100'
                    }`}
                  >
                    {tab.icon}
                  </div>
                  {tab.label}
                  {isActive && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.indicatorClass} rounded-t-full`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Token Health (Notifications only) ────────────────────────────── */}
        {diagnostics && activeModule === 'notifications' && (
          <Card
            className={`border-l-4 ${
              diagnostics.healthScore >= 80
                ? 'border-l-green-600 bg-green-50'
                : diagnostics.healthScore >= 50
                ? 'border-l-yellow-500 bg-yellow-50'
                : 'border-l-red-600 bg-red-50'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle
                    className={`h-5 w-5 ${
                      diagnostics.healthScore >= 80
                        ? 'text-green-600'
                        : diagnostics.healthScore >= 50
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  />
                  System Token Health
                </CardTitle>
                <Badge
                  variant={
                    diagnostics.healthScore >= 80
                      ? 'default'
                      : diagnostics.healthScore >= 50
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {diagnostics.healthScore}% Healthy
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {[
                  { label: 'Total Tokens', value: diagnostics.totalTokens, color: '' },
                  { label: 'Active', value: diagnostics.activeTokens, color: 'text-green-600' },
                  { label: 'Inactive', value: diagnostics.inactiveTokens, color: 'text-red-600' },
                  { label: 'Stale', value: diagnostics.staleTokensCount, color: 'text-orange-600' },
                  { label: 'Recently Inactive', value: diagnostics.recentlyInactiveTokensCount, color: 'text-yellow-600' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                  </div>
                ))}
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

        {/* ════════════════════════════════════════════════════════════════════
            NOTIFICATIONS MODULE
        ════════════════════════════════════════════════════════════════════ */}
        {activeModule === 'notifications' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {stats && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-4 bg-blue-600 rounded-full" />
                  <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard
                    icon={<Bell className="h-6 w-6 text-blue-600" />}
                    iconBg="bg-blue-100"
                    label="Total Sent"
                    value={stats.totalSent.toLocaleString()}
                    sub="All time"
                    border="border-blue-200"
                  />
                  <StatCard
                    icon={<TrendingUp className="h-6 w-6 text-green-600" />}
                    iconBg="bg-green-100"
                    label="Sent Today"
                    value={String(stats.todayCount)}
                    sub="notifications"
                    border="border-green-200"
                  />
                  <StatCard
                    icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                    iconBg="bg-emerald-100"
                    label="Success Rate"
                    value={`${stats.successRate.toFixed(1)}%`}
                    sub="delivery rate"
                    border="border-emerald-200"
                  />
                  <StatCard
                    icon={<Users className="h-6 w-6 text-purple-600" />}
                    iconBg="bg-purple-100"
                    label="Avg Recipients"
                    value={stats.averageRecipientsPerNotification.toLocaleString()}
                    sub="per notification"
                    border="border-purple-200"
                  />
                </div>
              </div>
            )}

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

            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="border-b pb-6">
                <CardTitle className="text-xl">Send New Notification</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Reach your users instantly with push notifications
                </p>
              </CardHeader>
              <CardContent className="pt-8">
                <AdminSendNotificationComponent />
              </CardContent>
            </Card>

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
                            <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.body}</p>
                          </div>
                          <Badge variant="outline" className="ml-2 flex-shrink-0 bg-blue-50">
                            {getTargetLabel(notification.target, notification.targetValue, notification.targetName)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle2 className="h-4 w-4" />
                              {notification.successCount} delivered
                            </div>
                            {notification.failureCount > 0 && (
                              <div className="flex items-center gap-1 text-red-500 font-medium">
                                <AlertCircle className="h-4 w-4" />
                                {notification.failureCount} failed
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{formatTimeAgo(notification.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400">
                    <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No notifications sent yet</p>
                    <p className="text-sm mt-1">Start by sending your first notification above</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Bell className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-blue-600',
                  bg: 'bg-blue-50',
                  title: 'Real-time Delivery',
                  desc: 'Notifications are delivered instantly via Firebase Cloud Messaging',
                },
                {
                  icon: <Users className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-green-600',
                  bg: 'bg-green-50',
                  title: 'Targeted Sending',
                  desc: 'Send to specific roles, classes, or individual users',
                },
                {
                  icon: <Clock className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-purple-600',
                  bg: 'bg-purple-50',
                  title: 'Instant Access',
                  desc: 'Users see notifications instantly on their devices',
                },
              ].map(({ icon, border, bg, title, desc }) => (
                <Card key={title} className={`border-l-4 ${border} ${bg}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {icon}
                      <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            EMAILS MODULE
        ════════════════════════════════════════════════════════════════════ */}
        {activeModule === 'emails' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {emailStats && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-4 bg-purple-600 rounded-full" />
                  <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard
                    icon={<Mail className="h-6 w-6 text-blue-600" />}
                    iconBg="bg-blue-100"
                    label="Total Sent"
                    value={emailStats.totalSent.toLocaleString()}
                    sub="All time"
                    border="border-blue-200"
                  />
                  <StatCard
                    icon={<TrendingUp className="h-6 w-6 text-green-600" />}
                    iconBg="bg-green-100"
                    label="Sent Today"
                    value={String(emailStats.todayCount)}
                    sub="emails"
                    border="border-green-200"
                  />
                  <StatCard
                    icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                    iconBg="bg-emerald-100"
                    label="Success Rate"
                    value={`${emailStats.successRate.toFixed(1)}%`}
                    sub="delivery rate"
                    border="border-emerald-200"
                  />
                  <StatCard
                    icon={<Users className="h-6 w-6 text-purple-600" />}
                    iconBg="bg-purple-100"
                    label="Avg Recipients"
                    value={emailStats.averageRecipientsPerEmail.toLocaleString()}
                    sub="per email"
                    border="border-purple-200"
                  />
                </div>
              </div>
            )}

            <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader className="border-b pb-6">
                <CardTitle className="text-xl">Send New Email</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Send professional emails to your recipients
                </p>
              </CardHeader>
              <CardContent className="pt-8">
                <AdminSendEmailComponent />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <EmailHistoryTab loading={loading} stats={emailStats} />
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-blue-600',
                  bg: 'bg-blue-50',
                  title: 'Reliable Delivery',
                  desc: 'Emails delivered reliably via Resend',
                },
                {
                  icon: <Users className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-green-600',
                  bg: 'bg-green-50',
                  title: 'Flexible Targeting',
                  desc: 'Send to all users, by role, class, or individual recipients',
                },
                {
                  icon: <Mail className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-purple-600',
                  bg: 'bg-purple-50',
                  title: 'Email Preview',
                  desc: 'Preview emails before sending to recipients',
                },
              ].map(({ icon, border, bg, title, desc }) => (
                <Card key={title} className={`border-l-4 ${border} ${bg}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {icon}
                      <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            WHATSAPP MODULE
        ════════════════════════════════════════════════════════════════════ */}
        {activeModule === 'whatsapp' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {whatsappStats && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-4 bg-green-600 rounded-full" />
                  <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard
                    icon={<Smartphone className="h-6 w-6 text-green-600" />}
                    iconBg="bg-green-100"
                    label="Total Sent"
                    value={whatsappStats.totalSent.toLocaleString()}
                    sub="All time"
                    border="border-green-200"
                  />
                  <StatCard
                    icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
                    iconBg="bg-emerald-100"
                    label="Sent Today"
                    value={String(whatsappStats.todayCount)}
                    sub="broadcasts"
                    border="border-emerald-200"
                  />
                  <StatCard
                    icon={<CheckCircle2 className="h-6 w-6 text-teal-600" />}
                    iconBg="bg-teal-100"
                    label="Success Rate"
                    value={`${whatsappStats.successRate.toFixed(1)}%`}
                    sub="delivery rate"
                    border="border-teal-200"
                  />
                  <StatCard
                    icon={<Users className="h-6 w-6 text-cyan-600" />}
                    iconBg="bg-cyan-100"
                    label="Avg Recipients"
                    value={whatsappStats.averageRecipientsPerMessage.toLocaleString()}
                    sub="per broadcast"
                    border="border-cyan-200"
                  />
                </div>
              </div>
            )}

            {/* Send WhatsApp form */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="border-b pb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-xl">
                    <Smartphone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Send WhatsApp Broadcast</CardTitle>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Send messages via Meta WhatsApp Cloud API
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                <AdminSendWhatsAppComponent />
              </CardContent>
            </Card>

            {/* WhatsApp history */}
            <WhatsAppHistoryTab loading={loading} stats={whatsappStats} />

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Smartphone className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-green-600',
                  bg: 'bg-green-50',
                  title: 'Meta Cloud API',
                  desc: 'Messages sent via the official Meta WhatsApp Business Platform',
                },
                {
                  icon: <MessageSquare className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-emerald-600',
                  bg: 'bg-emerald-50',
                  title: 'E.164 Normalisation',
                  desc: 'Phone numbers are automatically normalised to international format before sending',
                },
                {
                  icon: <Users className="h-5 w-5 text-teal-600 mt-0.5 flex-shrink-0" />,
                  border: 'border-l-teal-600',
                  bg: 'bg-teal-50',
                  title: 'Cohort Targeting',
                  desc: 'Send to all users, specific roles, individual users, or entire classes',
                },
              ].map(({ icon, border, bg, title, desc }) => (
                <Card key={title} className={`border-l-4 ${border} ${bg}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {icon}
                      <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
