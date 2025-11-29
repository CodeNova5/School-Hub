"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, Users, TrendingUp, TrendingDown, Award, BookOpen } from "lucide-react";

export default function SubjectAnalyticsPage({ params }: any) {
  const subjectId = params.id;

  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  const [results, setResults] = useState<any[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setIsLoading(true);

    const { data: sessionData } = await supabase.from("sessions").select("*").order("name");
    const { data: termData } = await supabase.from("terms").select("*").order("name");
    const { data: subjectData } = await supabase.from("subjects").select("*").eq("id", subjectId).single();

    setSessions(sessionData || []);
    setTerms(termData || []);
    setSubject(subjectData || null);

    const currentSession = sessionData?.find((s) => s.is_current);
    const currentTerm = termData?.find((t) => t.is_current);

    setSelectedSession(currentSession?.id || "");
    setSelectedTerm(currentTerm?.id || "");

    loadResults(subjectId, currentSession?.id, currentTerm?.id);
  }

  async function loadResults(subId: string, sessionId?: string, termId?: string) {
    let query: any = supabase
      .from("results")
      .select(`*, students(first_name, last_name, student_id)`)
      .eq("subject_id", subId);

    if (sessionId) query = query.eq("session_id", sessionId);
    if (termId) query = query.eq("term_id", termId);

    const { data } = await query;

    setResults(data || []);
    setIsLoading(false);
  }

  const avgScore =
    results.length > 0 ? (results.reduce((a, b) => a + b.total, 0) / results.length).toFixed(1) : 0;

  const passRate =
    results.length > 0
      ? Math.round(
          (results.filter((r) => !["D7", "E8", "F9"].includes(r.grade)).length / results.length) * 100
        )
      : 0;

  const highestScore = results.length > 0 ? Math.max(...results.map((r) => r.total)) : 0;
  const lowestScore = results.length > 0 ? Math.min(...results.map((r) => r.total)) : 0;

  const gradeDistribution = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"].map((g) => ({
    grade: g,
    count: results.filter((r) => r.grade === g).length,
  }));

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Subject Analytics</h1>
        <p className="text-gray-600">Detailed performance report for: {subject?.name}</p>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Select
              value={selectedSession}
              onValueChange={(val) => {
                setSelectedSession(val);
                loadResults(subjectId, val, selectedTerm);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s: any) => (
                  <SelectItem value={s.id} key={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedTerm}
              onValueChange={(val) => {
                setSelectedTerm(val);
                loadResults(subjectId, selectedSession, val);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms
                  .filter((t: any) => t.session_id === selectedSession)
                  .map((t: any) => (
                    <SelectItem value={t.id} key={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <Users className="h-6 w-6 mb-2 text-blue-600" />
              <p className="text-3xl font-bold">{results.length}</p>
              <p className="text-gray-500 text-sm">Students Offering This Subject</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <TrendingUp className="h-6 w-6 mb-2 text-green-600" />
              <p className="text-3xl font-bold">{avgScore}</p>
              <p className="text-gray-500 text-sm">Average Score</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <Award className="h-6 w-6 mb-2 text-purple-600" />
              <p className="text-3xl font-bold">{highestScore}</p>
              <p className="text-gray-500 text-sm">Highest Score</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <TrendingDown className="h-6 w-6 mb-2 text-red-600" />
              <p className="text-3xl font-bold">{lowestScore}</p>
              <p className="text-gray-500 text-sm">Lowest Score</p>
            </CardContent>
          </Card>
        </div>

        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gradeDistribution}>
                <XAxis dataKey="grade" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Students</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-gray-500">No results found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Student</th>
                      <th className="p-2 text-left">Score</th>
                      <th className="p-2 text-left">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 10)
                      .map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">
                            {r.students.first_name} {r.students.last_name} ({r.students.student_id})
                          </td>
                          <td className="p-2">{r.total}</td>
                          <td className="p-2">{r.grade}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
