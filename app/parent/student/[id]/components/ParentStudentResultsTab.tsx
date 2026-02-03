"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
  TrendingUp,
  Award,
  BookOpen,
  BarChart
} from "lucide-react";

interface Result {
  id: string;
  subject_class_id: string;
  term_id: string;
  session_id: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  position: number | null;
  subject_classes?: {
    subjects: {
      name: string;
    };
  };
  terms?: {
    name: string;
  };
  sessions?: {
    name: string;
  };
}

interface ParentStudentResultsTabProps {
  studentId: string;
}

export default function ParentStudentResultsTab({ studentId }: ParentStudentResultsTabProps) {
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Get sessions and terms
      const [sessionsRes, termsRes] = await Promise.all([
        supabase.from("sessions").select("*").order("start_date", { ascending: false }),
        supabase.from("terms").select("*").order("start_date", { ascending: false }),
      ]);

      setSessions(sessionsRes.data || []);
      setTerms(termsRes.data || []);

      // Get results
      const { data: resultsData, error } = await supabase
        .from("results")
        .select(`
          *,
          subject_classes!inner(
            subjects(name)
          ),
          terms(name),
          sessions(name)
        `)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResults(resultsData || []);
    } catch (error: any) {
      toast.error("Failed to load results: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading results...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredResults = results.filter((r) => {
    if (selectedSession && r.session_id !== selectedSession) return false;
    if (selectedTerm && r.term_id !== selectedTerm) return false;
    return true;
  });

  const averageScore = filteredResults.length === 0 ? 0 : 
    Math.round(filteredResults.reduce((sum, r) => sum + r.total, 0) / filteredResults.length);

  const passedSubjects = filteredResults.filter(r => r.total >= 40).length;
  const failedSubjects = filteredResults.filter(r => r.total < 40).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All Terms</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{averageScore}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredResults.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedSubjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Award className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedSubjects}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Subject</th>
                  <th className="text-left py-3 px-4">Session</th>
                  <th className="text-left py-3 px-4">Term</th>
                  <th className="text-left py-3 px-4">Exam</th>
                  <th className="text-left py-3 px-4">Total</th>
                  <th className="text-left py-3 px-4">Grade</th>
                  <th className="text-left py-3 px-4">Position</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((result) => (
                  <tr key={result.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{result.subject_classes?.subjects?.name}</td>
                    <td className="py-3 px-4">{result.sessions?.name}</td>
                    <td className="py-3 px-4">{result.terms?.name}</td>
                    <td className="py-3 px-4">{result.exam}</td>
                    <td className="py-3 px-4 font-bold">{result.total}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        result.grade === "A" ? "bg-green-100 text-green-700" :
                        result.grade === "B" ? "bg-blue-100 text-blue-700" :
                        result.grade === "C" ? "bg-yellow-100 text-yellow-700" :
                        result.grade === "D" ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {result.grade}
                      </span>
                    </td>
                    <td className="py-3 px-4">{result.position || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredResults.length === 0 && (
            <div className="text-center py-12">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No published results found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
