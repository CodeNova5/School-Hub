import { DashboardLayout } from '@/components/dashboard-layout';
import { TeacherLessonNotes } from '@/components/teacher-lesson-notes';

export default function TeacherLessonNotesPage() {
  return (
    <DashboardLayout role="teacher">
      <TeacherLessonNotes />
    </DashboardLayout>
  );
}
