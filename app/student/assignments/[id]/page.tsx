"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText } from "lucide-react";

export default function StudentAssignmentDetails() {
    const { id } = useParams();
    const [assignment, setAssignment] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAssignment() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { data: student } = await supabase.from("students").select("id").eq("user_id", user?.id).single();

            const { data: assignmentData } = await supabase
                .from("assignments")
                .select("*, classes(name), subjects(name)")
                .eq("id", id)
                .single();

            if (assignmentData && student) {
                const { data: submissionData } = await supabase
                    .from("assignment_submissions")
                    .select("*")
                    .eq("assignment_id", assignmentData.id)
                    .eq("student_id", student.id)
                    .single();
                setSubmission(submissionData);
            }

            setAssignment(assignmentData);
            setLoading(false);
        }

        loadAssignment();
    }, [id]);

    if (loading) {
        return (
            <DashboardLayout role="student">
                <div className="flex items-center justify-center h-96 text-muted-foreground">
                    Loading assignment...
                </div>
            </DashboardLayout>
        );
    }

    if (!assignment) return null;

    function getSubmissionLabel(type: string) {
        if (type === "text") return "Text Answer";
        if (type === "file") return "File Upload";
        return "Text + File";
    }

    const isGraded = submission && submission.graded_at;

    return (
        <DashboardLayout role="student">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">{assignment.title}</h1>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline">{assignment.classes?.name}</Badge>
                        <Badge variant="secondary">{assignment.subjects?.name}</Badge>
                        <Badge>
                            <Calendar className="h-3 w-3 mr-1 inline" />
                            Due {new Date(assignment.due_date).toLocaleDateString()}
                        </Badge>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Assignment Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="font-medium">Description</p>
                            <p className="text-muted-foreground">{assignment.description || "—"}</p>
                        </div>

                        <div>
                            <p className="font-medium">Instructions</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">
                                {assignment.instructions || "—"}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Badge variant="outline">
                                <FileText className="h-3 w-3 mr-1 inline" />
                                {getSubmissionLabel(assignment.submission_type)}
                            </Badge>
                            <Badge variant="outline">{assignment.total_marks} Marks</Badge>
                            {!assignment.allow_late_submission && (
                                <Badge variant="destructive">Late submissions not allowed</Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Action / Status Section */}
                {!submission && (
                    <Link href={`/student/assignments/${id}/submit`}>
                        <Button size="lg">Submit Assignment</Button>
                    </Link>
                )}

                {submission && !isGraded && (
                    <Card className="border-dashed">
                        <CardContent className="py-6 text-center text-muted-foreground">
                            <p className="font-medium">Submission received</p>
                            <p className="text-sm mt-1">
                                Your assignment has been submitted and is awaiting grading.
                            </p>
                        </CardContent>
                    </Card>
                )}


                {isGraded && (
                    <Card className="border-2 border-green-500 bg-green-50/40">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">Result</CardTitle>
                                <Badge className="bg-green-600 text-white">Graded</Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Grade */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Score</p>
                                    <p className="text-4xl font-bold text-green-700">
                                        {submission.grade}
                                        <span className="text-lg text-muted-foreground">
                                            {" "} / {assignment.total_marks}
                                        </span>
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Graded on</p>
                                    <p className="font-medium">
                                        {new Date(submission.graded_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Feedback */}
                            {submission.feedback && (
                                <div className="rounded-lg border bg-white p-4">
                                    <p className="text-sm font-medium mb-1 text-muted-foreground">
                                        Teacher’s Feedback
                                    </p>
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                        {submission.feedback}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

            </div>
        </DashboardLayout>
    );
}