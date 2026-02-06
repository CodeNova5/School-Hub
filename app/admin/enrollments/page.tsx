"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnrollmentAnalytics } from "@/components/enrollment-analytics";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Download, TrendingUp, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function EnrollmentsPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [enrollmentTrends, setEnrollmentTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .order("start_date", { ascending: false });

      if (sessionsData) {
        setSessions(sessionsData);
        const current = sessionsData.find(s => s.is_current);
        if (current) {
          setCurrentSession(current);
          setSelectedSession(current.id);
        }
      }

      // Fetch enrollment trends
      await loadEnrollmentTrends();
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load enrollment data");
    } finally {
      setLoading(false);
    }
  }

  async function loadEnrollmentTrends() {
    try {
      // Get enrollment analytics
      const { data: analytics } = await supabase
        .from("enrollment_analytics")
        .select("*")
        .order("session_name", { ascending: false });

      if (analytics) {
        setEnrollmentTrends(analytics);
      }
    } catch (error) {
      console.error("Error loading trends:", error);
    }
  }

  async function refreshMaterializedViews() {
    try {
      setRefreshing(true);
      toast.loading("Refreshing enrollment data...", { id: "refresh" });

      // Refresh current_enrollments
      await supabase.rpc("refresh_current_enrollments");

      // Refresh enrollment_analytics
      await supabase.rpc("refresh_enrollment_analytics");

      toast.success("Enrollment data refreshed successfully", { id: "refresh" });
      await loadEnrollmentTrends();
    } catch (error: any) {
      console.error("Error refreshing views:", error);
      toast.error("Failed to refresh enrollment data", { id: "refresh" });
    } finally {
      setRefreshing(false);
    }
  }

  async function exportEnrollmentData() {
    try {
      const { data: enrollments } = await supabase
        .from("enrollment_details")
        .select("*")
        .eq("session_id", selectedSession)
        .csv();

      if (enrollments) {
        const blob = new Blob([enrollments], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `enrollments_${selectedSession}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        toast.success("Enrollment data exported");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export enrollment data");
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Enrollment Management</h1>
            <p className="text-gray-600">
              System-wide enrollment statistics and analytics
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refreshMaterializedViews}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            <Button variant="outline" onClick={exportEnrollmentData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Link href="/admin/promotions">
              <Button>
                <TrendingUp className="h-4 w-4 mr-2" />
                Bulk Promotions
              </Button>
            </Link>
          </div>
        </div>

        {/* Current Session Info */}
        {currentSession && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Session</p>
                  <h3 className="text-2xl font-bold text-blue-900">
                    {currentSession.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(currentSession.start_date).toLocaleDateString()} -{" "}
                    {new Date(currentSession.end_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="default" className="text-lg px-4 py-2">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Analytics */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="by-session">By Session</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Enrollment Analytics Component */}
            <EnrollmentAnalytics />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <Link href="/admin/promotions" className="block">
                    <Card className="hover:shadow-md transition cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-100 p-3 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">Promote Students</h4>
                            <p className="text-sm text-gray-600">
                              Year-end bulk promotion
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/admin/students" className="block">
                    <Card className="hover:shadow-md transition cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-green-100 p-3 rounded-lg">
                            <Users className="h-6 w-6 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">Manage Students</h4>
                            <p className="text-sm text-gray-600">
                              View all students
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/admin/classes" className="block">
                    <Card className="hover:shadow-md transition cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-purple-100 p-3 rounded-lg">
                            <Users className="h-6 w-6 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">Manage Classes</h4>
                            <p className="text-sm text-gray-600">
                              View class rosters
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Enrollment Trends Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollmentTrends.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group by session */}
                    {Object.entries(
                      enrollmentTrends.reduce((acc: any, item) => {
                        const key = item.session_name;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                      }, {})
                    ).map(([sessionName, items]: [string, any]) => (
                      <div key={sessionName} className="border-b pb-4 last:border-0">
                        <h4 className="font-semibold mb-3">{sessionName}</h4>
                        <div className="grid gap-3 md:grid-cols-4">
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded">
                              <p className="text-sm text-gray-600">{item.class_name}</p>
                              <p className="text-2xl font-bold">{item.enrollment_count}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {item.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No enrollment trend data available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-session" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Enrollments by Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name} ({session.is_current ? "Current" : "Archived"})
                    </option>
                  ))}
                </select>

                {selectedSession && (
                  <EnrollmentAnalytics sessionId={selectedSession} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
