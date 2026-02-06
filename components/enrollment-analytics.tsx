"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  ArrowRightLeft, 
  UserCheck,
  UserX,
  GraduationCap,
  Loader2
} from "lucide-react";

interface EnrollmentStats {
  total_active: number;
  total_completed: number;
  total_transferred: number;
  total_dropped: number;
  by_class: Array<{
    class_id: string;
    class_name: string;
    count: number;
  }>;
  recent_changes: Array<{
    student_name: string;
    from_class: string;
    to_class: string;
    change_type: string;
    changed_at: string;
  }>;
}

export function EnrollmentAnalytics() {
  const [stats, setStats] = useState<EnrollmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {

      // Get current session and term
      const { data: currentSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("is_current", true)
        .single();

      const { data: currentTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .single();

      if (!currentSession || !currentTerm) {
        setLoading(false);
        return;
      }

      // Get enrollment counts by status
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("status, class_id, classes(name)")
        .eq("session_id", currentSession.id)
        .eq("term_id", currentTerm.id);

      if (!enrollments) {
        setLoading(false);
        return;
      }

      const statusCounts = {
        active: 0,
        completed: 0,
        transferred: 0,
        dropped: 0
      };

      const classCounts: Record<string, { name: string; count: number }> = {};

      enrollments.forEach((e: any) => {
        // Count by status
        if (e.status in statusCounts) {
          statusCounts[e.status as keyof typeof statusCounts]++;
        }

        // Count by class (active only)
        if (e.status === "active") {
          if (!classCounts[e.class_id]) {
            classCounts[e.class_id] = {
              name: e.classes?.name || "Unknown",
              count: 0
            };
          }
          classCounts[e.class_id].count++;
        }
      });

      // Get recent enrollment changes (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentChanges } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          enrollment_type,
          enrolled_at,
          classes(name),
          students(first_name, last_name)
        `)
        .gte("enrolled_at", thirtyDaysAgo.toISOString())
        .in("enrollment_type", ["transferred", "promoted"])
        .order("enrolled_at", { ascending: false })
        .limit(5);

      setStats({
        total_active: statusCounts.active,
        total_completed: statusCounts.completed,
        total_transferred: statusCounts.transferred,
        total_dropped: statusCounts.dropped,
        by_class: Object.entries(classCounts).map(([id, data]) => ({
          class_id: id,
          class_name: data.name,
          count: data.count
        })).sort((a, b) => b.count - a.count),
        recent_changes: (recentChanges || []).map((c: any) => ({
          student_name: `${c.students?.first_name} ${c.students?.last_name}`,
          from_class: "",
          to_class: c.classes?.name || "",
          change_type: c.enrollment_type,
          changed_at: c.enrolled_at
        }))
      });

    } catch (error) {
      console.error("Error fetching enrollment stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No enrollment data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Enrollments"
          value={stats.total_active}
          icon={<UserCheck className="h-4 w-4" />}
          color="green"
        />
        <StatsCard
          title="Completed"
          value={stats.total_completed}
          icon={<GraduationCap className="h-4 w-4" />}
          color="blue"
        />
        <StatsCard
          title="Transfers"
          value={stats.total_transferred}
          icon={<ArrowRightLeft className="h-4 w-4" />}
          color="orange"
        />
        <StatsCard
          title="Dropped"
          value={stats.total_dropped}
          icon={<UserX className="h-4 w-4" />}
          color="red"
        />
      </div>

      {/* Class Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Students by Class
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.by_class.length > 0 ? (
            <div className="space-y-3">
              {stats.by_class.slice(0, 5).map((cls) => (
                <div key={cls.class_id} className="flex items-center justify-between">
                  <span className="font-medium">{cls.class_name}</span>
                  <Badge variant="secondary">{cls.count} students</Badge>
                </div>
              ))}
              {stats.by_class.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{stats.by_class.length - 5} more classes
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No class data available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Changes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Enrollment Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recent_changes.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_changes.map((change, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{change.student_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {change.to_class} • {new Date(change.changed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {change.change_type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent changes
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  color: "green" | "blue" | "orange" | "red";
}) {
  const colorClasses = {
    green: "bg-green-100 text-green-600",
    blue: "bg-blue-100 text-blue-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600"
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-2">{value.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact widget version
export function EnrollmentStatsWidget() {
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveCount();
  }, []);

  async function fetchActiveCount() {
    try {
      
      const { data: currentSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("is_current", true)
        .single();

      const { data: currentTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .single();

      if (currentSession && currentTerm) {
        const { count } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("session_id", currentSession.id)
          .eq("term_id", currentTerm.id)
          .eq("status", "active");

        setActiveCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching enrollment count:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
      <UserCheck className="h-5 w-5 text-green-600" />
      <div>
        <p className="text-xs text-green-800 font-medium">Active Enrollments</p>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-green-600 mt-1" />
        ) : (
          <p className="text-lg font-bold text-green-900">{activeCount}</p>
        )}
      </div>
    </div>
  );
}
