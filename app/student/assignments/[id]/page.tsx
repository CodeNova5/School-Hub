"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function StudentAssignmentDetails() {
    const { id } = useParams();
    const [assignment, setAssignment] = useState<any>(null);

    useEffect(() => {
        supabase
            .from("assignments")
            .select("*")
            .eq("id", id)
            .single()
            .then(({ data }) => setAssignment(data));
    }, [id]);

    if (!assignment) return null;

    return (
        <DashboardLayout role="student">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">{assignment.title}</h1>

                <p>{assignment.description}</p>

                <div className="whitespace-pre-wrap">
                    {assignment.instructions}
                </div>

                <div className="flex gap-4">
                    <span>Submission: {assignment.submission_type}</span>
                    <span>Marks: {assignment.total_marks}</span>
                </div>

                <Link href={`/student/assignments/${id}/submit`}>
                    <Button>Submit Assignment</Button>
                </Link>

            </div>
        </DashboardLayout>
    );
}
