"use client";

import StudentAssignmentSubmission from "@/components/StudentAssignmentSubmissionModal";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function StudentAssignmentSubmitPage() {
    return (
        <DashboardLayout role="student">
            <StudentAssignmentSubmission />
        </DashboardLayout>
    );
}
