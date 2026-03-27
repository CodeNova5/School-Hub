"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Loader2 } from "lucide-react";
import { Download } from "lucide-react";
import { useSchoolContext } from "@/hooks/use-school-context";

export default function StudentAssignmentDetails() {
    const { id } = useParams();
    const [assignment, setAssignment] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { schoolId, isLoading: schoolLoading } = useSchoolContext();

    useEffect(() => {
        if (!schoolLoading && schoolId) {
            loadAssignment();
        }
    }, [id, schoolId, schoolLoading]);

    async function loadAssignment() {
            if (!schoolId) return;
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            const { data: student } = await supabase.from("students").select("id").eq("user_id", user?.id).eq("school_id", schoolId).maybeSingle();

            const { data: assignmentData } = await supabase
                .from("assignments")
                .select("*, classes(name), subjects(name)")
                .eq("id", id)
                .eq("school_id", schoolId)
                .single();

            if (assignmentData && student) {
                const { data: submissionData } = await supabase
                    .from("assignment_submissions")
                    .select("*")
                    .eq("assignment_id", assignmentData.id)
                    .eq("student_id", student.id)
                    .eq("school_id", schoolId)
                    .maybeSingle();
                setSubmission(submissionData);
            }

            setAssignment(assignmentData);
            setLoading(false);
        }


    function getGradeStyles(marksObtained: number, totalMarks: number) {
        if (!totalMarks || totalMarks === 0) {
            return {
                border: "border-gray-300",
                bg: "bg-muted/30",
                badge: "bg-gray-500 text-white",
                text: "text-gray-700",
                label: "Ungraded",
                percent: 0,
            };
        }

        const percent = Math.round((marksObtained / totalMarks) * 100);

        if (percent >= 70) {
            return {
                border: "border-green-500",
                bg: "bg-green-50/40",
                badge: "bg-green-600 text-white",
                text: "text-green-700",
                label: "Excellent",
                percent,
            };
        }

        if (percent >= 40) {
            return {
                border: "border-yellow-500",
                bg: "bg-yellow-50/40",
                badge: "bg-yellow-600 text-white",
                text: "text-yellow-700",
                label: "Average",
                percent,
            };
        }

        return {
            border: "border-red-500",
            bg: "bg-red-50/40",
            badge: "bg-red-600 text-white",
            text: "text-red-700",
            label: "Needs Improvement",
            percent,
        };
    }


    if (loading || schoolLoading) {
        return (
            <DashboardLayout role="student">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading assignment...</p>
                    </div>
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
   const fileUrl = submission?.file_url ?? null;

    const ext = fileUrl?.split(".").pop()?.toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
    const isPdf = ext === "pdf";
    const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
        fileUrl
    )}&embedded=true`;

    const assignmentFileUrl = assignment?.file_url ?? null;
    const assignmentExt = assignmentFileUrl?.split(".").pop()?.toLowerCase();
    const assignmentIsImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(assignmentExt);
    const assignmentIsPdf = assignmentExt === "pdf";
    const assignmentIsOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(assignmentExt);
    const assignmentGoogleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
        assignmentFileUrl
    )}&embedded=true`;

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

                        {assignment.file_url && (
                            <div>
                                <p className="font-medium mb-2">Attached File</p>
                                <div className="border rounded-lg p-4">
                                    {assignmentIsImage && (
                                        <img
                                            src={assignmentFileUrl}
                                            className="w-full max-h-96 object-contain rounded-lg border"
                                        />
                                    )}
                                    {assignmentIsPdf && (
                                        <iframe
                                            src={assignmentFileUrl}
                                            className="w-full h-[60vh] rounded-md border"
                                        />
                                    )}
                                    {assignmentIsOffice && (
                                        <iframe
                                            src={assignmentGoogleViewerUrl}
                                            className="w-full h-[60vh] rounded-md border"
                                        />
                                    )}
                                    {!assignmentIsImage && !assignmentIsPdf && !assignmentIsOffice && (
                                        <div className="flex items-center gap-4">
                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {assignment.file_url.split("/").pop()}
                                                </p>
                                                <a
                                                    href={assignmentFileUrl}
                                                    target="_blank"
                                                    className="text-sm text-primary hover:underline"
                                                >
                                                    Download File
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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

                {submission && (
                    <Card>
                        <CardHeader>
                            <CardTitle>My Submission</CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Text Answer */}
                            {submission.submission_text ? (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">
                                        Text Answer
                                    </p>
                                    <div className="rounded-lg border bg-muted/30 p-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{
                                        __html: submission.submission_text,
                                    }}>

                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No text answer submitted.
                                </p>
                            )}

                            {/* File Submission */}
                            {submission.file_url && (
                                <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6">Submitted File</h3>

                                    {!fileUrl && (
                                        <p className="text-gray-400 italic py-8 text-center">
                                            No file uploaded.
                                        </p>
                                    )}

                                    {fileUrl && (
                                        <>
                                            {/* Image */}
                                            {isImage && (
                                                <img
                                                    src={fileUrl}
                                                    className="w-full max-h-96 object-contain rounded-lg border border-gray-300"
                                                />
                                            )}

                                            {/* PDF */}
                                            {isPdf && (
                                                <iframe
                                                    src={fileUrl}
                                                    className="w-full h-[75vh] rounded-md border"
                                                    allowFullScreen
                                                />
                                            )}

                                            {/* Word / Excel / PowerPoint */}
                                            {isOffice && (
                                                <iframe
                                                    src={googleViewerUrl}
                                                    className="w-full h-[75vh] rounded-md border"
                                                    allowFullScreen
                                                />
                                            )}

                                            {/* Fallback */}
                                            {!isImage && !isPdf && !isOffice && (
                                                <div className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-gray-300 rounded-lg p-12 bg-gray-50">
                                                    <FileText className="w-12 h-12 text-gray-300" />
                                                    <p className="text-sm text-gray-500 text-center">
                                                        Preview not supported for this file type.
                                                    </p>
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Download File
                                                    </a>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                            )}

                            {!submission.submission_text && !submission.file_url && (
                                <p className="text-sm text-muted-foreground">
                                    No submission content available.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}


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


                {isGraded && (() => {
                    const styles = getGradeStyles(
                        submission.grade,            // marks obtained (e.g. 14)
                        assignment.total_marks       // total marks (e.g. 20)
                    );

                    return (
                        <Card className={`border-2 ${styles.border} ${styles.bg}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xl">Result</CardTitle>
                                    <Badge className={styles.badge}>{styles.label}</Badge>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {/* Score */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Score</p>
                                        <p className={`text-4xl font-bold ${styles.text}`}>
                                            {submission.grade}
                                            <span className="text-lg text-muted-foreground">
                                                {" "} / {assignment.total_marks}
                                            </span>
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {styles.percent}%
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
                                        <p className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{
                                            __html: submission.feedback,
                                        }}>
                                        
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })()}

            </div>
        </DashboardLayout>
    );
}