"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  TrendingUp,
} from "lucide-react";
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

interface WhatsAppLog {
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

interface WhatsAppStats {
  totalSent: number;
  todayCount: number;
  successRate: number;
  averageRecipientsPerMessage: number;
  recentMessages: WhatsAppLog[];
  whatsappTrend: Array<{ date: string; sent: number }>;
}

interface WhatsAppHistoryTabProps {
  loading: boolean;
  stats: WhatsAppStats | null;
}

export function WhatsAppHistoryTab({ loading, stats }: WhatsAppHistoryTabProps) {
  const formatTimeAgo = (date: string) => {
    if (!date) return "Unknown";
    const then = new Date(date);
    if (isNaN(then.getTime())) return "Invalid Date";
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return then.toLocaleDateString();
  };

  const getTargetLabel = (
    target: string,
    targetValue?: string,
    targetName?: string
  ) => {
    switch (target) {
      case "all":
        return "All Users";
      case "role":
        return targetValue === "student"
          ? "Students"
          : targetValue === "teacher"
          ? "Teachers"
          : targetValue === "parent"
          ? "Parents"
          : "Admins";
      case "user":
        return targetName ? `User: ${targetName}` : `User: ${targetValue}`;
      case "class":
        return `Class: ${targetValue}`;
      default:
        return target;
    }
  };

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      {!loading && stats && stats.whatsappTrend.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50 pb-6">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              WhatsApp Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.whatsappTrend}>
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
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ fill: "#16a34a", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Messages Sent"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Messages List */}
      <Card className="shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-green-50 pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              Recent WhatsApp Broadcasts
            </CardTitle>
            {!loading && stats && (
              <Badge variant="secondary">
                {stats.recentMessages.length} recent
              </Badge>
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
          ) : stats && stats.recentMessages.length > 0 ? (
            <div className="space-y-4">
              {stats.recentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-green-200 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{msg.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {msg.body}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-2 flex-shrink-0 bg-green-50 border-green-200 text-green-700"
                    >
                      {getTargetLabel(msg.target, msg.targetValue, msg.targetName)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {msg.successCount} delivered
                      </div>
                      {msg.failureCount > 0 && (
                        <div className="flex items-center gap-1 text-red-500 font-medium">
                          <AlertCircle className="h-4 w-4" />
                          {msg.failureCount} failed
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatTimeAgo(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-14 text-gray-400">
              <Smartphone className="h-14 w-14 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No WhatsApp broadcasts yet</p>
              <p className="text-sm mt-1">
                Start by sending your first message above
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
