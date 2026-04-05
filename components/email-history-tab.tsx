"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, AlertCircle, CheckCircle2, Mail, TrendingUp } from "lucide-react";
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

interface EmailHistoryTabProps {
  loading: boolean;
  stats: EmailStats | null;
}

export function EmailHistoryTab({ loading, stats }: EmailHistoryTabProps) {
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

  const getTargetLabel = (target: string, targetValue?: string, targetName?: string) => {
    switch (target) {
      case "all":
        return "All Users";
      case "role":
        return `${targetValue === "student" ? "Students" : targetValue === "teacher" ? "Teachers" : targetValue === "parent" ? "Parents" : "Admins"}`;
      case "user":
        return targetName ? `User: ${targetName}` : `User: ${targetValue}`;
      case "class":
        return `Class: ${targetValue}`;
      case "multiple_classes":
        return "Multiple Classes";
      case "class_teachers":
        return `Class Teachers: ${targetValue}`;
      default:
        return target;
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Trend Chart */}
      {!loading && stats && stats.emailTrend.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 pb-6">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Email Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.emailTrend}>
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
                  dataKey="sent"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: "#3B82F6", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Emails Sent"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Emails List */}
      <Card className="shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              Recent Emails
            </CardTitle>
            {!loading && stats && (
              <Badge variant="secondary">{stats.recentEmails.length} recent</Badge>
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
          ) : stats && stats.recentEmails.length > 0 ? (
            <div className="space-y-4">
              {stats.recentEmails.map((email) => (
                <div
                  key={email.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {email.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {email.body}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 flex-shrink-0">
                      {getTargetLabel(email.target, email.targetValue, email.targetName)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {email.successCount} sent
                      </div>
                      {email.failureCount > 0 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          {email.failureCount} failed
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatTimeAgo(email.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No emails sent yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
