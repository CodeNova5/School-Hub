"use client";

import StudentAssignmentSubmission from "@/components/StudentAssignmentSubmission";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function StudentAssignmentSubmitPage() {
    return (
        <DashboardLayout role="student">
            <StudentAssignmentSubmission />
        </DashboardLayout>
    );
}
