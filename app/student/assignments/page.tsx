"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: student } = await supabase
      .from("students")
      .select("id, class_id")
      .eq("user_id", user.id)
      .single();

    const { data } = await supabase
      .from("assignments")
      .select(`
        *,
        assignment_submissions (
          id,
          submitted_at,
          graded_at
        )
      `)
      .eq("class_id", student?.class_id)
      .order("due_date", { ascending: true });

    setAssignments(data || []);
  }

  function getStatus(a: any) {
    if (!a.assignment_submissions.length) return "Not Submitted";
    if (a.assignment_submissions[0].graded_at) return "Graded";
    return "Submitted";
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Assignments</h1>

        {assignments.map((a) => (
          <Card key={a.id} className="p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{a.title}</h3>
              <p className="text-sm text-muted-foreground">
                <Calendar className="inline h-4 w-4 mr-1" />
                Due {new Date(a.due_date).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge>{getStatus(a)}</Badge>
              <Link href={`/student/assignments/${a.id}`}>
                View
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
