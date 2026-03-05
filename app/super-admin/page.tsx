"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  School,
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { School as SchoolType } from "@/lib/types";

interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
}

interface SchoolWithStats extends SchoolType {
  studentCount?: number;
  teacherCount?: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch all schools
      const { data: schoolsData, error: schoolsErr } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (schoolsErr) throw schoolsErr;

      // Fetch aggregate counts per school
      const enriched: SchoolWithStats[] = await Promise.all(
        (schoolsData ?? []).map(async (school: SchoolType) => {
          const [{ count: studentCount }, { count: teacherCount }] = await Promise.all([
            supabase
              .from("students")
              .select("*", { count: "exact", head: true })
              .eq("school_id", school.id),
            supabase
              .from("teachers")
              .select("*", { count: "exact", head: true })
              .eq("school_id", school.id),
          ]);
          return {
            ...school,
            studentCount: studentCount ?? 0,
            teacherCount: teacherCount ?? 0,
          };
        })
      );

      setSchools(enriched);

      // Platform-level stats
      const allStudents = enriched.reduce((s, sc) => s + (sc.studentCount ?? 0), 0);
      const allTeachers = enriched.reduce((s, sc) => s + (sc.teacherCount ?? 0), 0);
      setStats({
        totalSchools: enriched.length,
        activeSchools: enriched.filter((s) => s.is_active).length,
        suspendedSchools: enriched.filter((s) => !s.is_active).length,
        totalStudents: allStudents,
        totalTeachers: allTeachers,
      });
    } catch (err) {
      console.error("Failed to load platform data:", err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      label: "Total Schools",
      value: stats?.totalSchools ?? 0,
      icon: <School className="h-5 w-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Active Schools",
      value: stats?.activeSchools ?? 0,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Total Students",
      value: stats?.totalStudents ?? 0,
      icon: <GraduationCap className="h-5 w-5" />,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "Total Teachers",
      value: stats?.totalTeachers ?? 0,
      icon: <Users className="h-5 w-5" />,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Manage all schools on the platform</p>
        </div>
        <Link href="/super-admin/schools">
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            New School
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-1/3" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>{card.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Schools List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Schools</CardTitle>
          <Link href="/super-admin/schools">
            <Button variant="outline" size="sm">
              Manage Schools
              <ExternalLink className="h-3.5 w-3.5 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <School className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No schools registered yet.</p>
              <Link href="/super-admin/schools">
                <Button variant="link" className="mt-2">
                  Create your first school
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {schools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                      <School className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{school.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {school.subdomain
                          ? `${school.subdomain}.myapp.com`
                          : "No subdomain"}{" "}
                        · {school.studentCount} students · {school.teacherCount} teachers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={school.is_active ? "default" : "secondary"}
                      className={school.is_active ? "bg-green-500" : ""}
                    >
                      {school.is_active ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {school.is_active ? "Active" : "Suspended"}
                    </Badge>
                    <Link href={`/super-admin/schools`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
