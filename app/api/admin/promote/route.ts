import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { cookies } from "next/headers";

// Helper to check admin permission
async function checkIsAdmin() {
  const cookieStore = await cookies();
  
  // Get access token from cookies
  const accessToken = cookieStore.get('sb-access-token')?.value;
  const refreshToken = cookieStore.get('sb-refresh-token')?.value;

  if (!accessToken) {
    throw new Error("Unauthorized");
  }

  // Create supabase client with user's session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("is_admin");

  if (error || !data) {
    throw new Error("Admin access required");
  }

  return { user, supabase };
}

/**
 * POST /api/admin/promote
 * Promote students to next class/session (NON-DESTRUCTIVE)
 * 
 * Body:
 * - action: 'promote-class' | 'promote-selected'
 * - sourceClassId?: uuid (for promote-class)
 * - targetClassId: uuid
 * - studentIds?: uuid[] (for promote-selected)
 * - targetSessionId?: uuid (optional, defaults to next session)
 * - targetTermId?: uuid (optional, defaults to first term of session)
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase } = await checkIsAdmin();

    const body = await req.json();
    const { 
      action, 
      sourceClassId, 
      targetClassId, 
      studentIds,
      targetSessionId,
      targetTermId 
    } = body;

    if (!action || !targetClassId) {
      return NextResponse.json(
        { error: "Missing required fields: action, targetClassId" },
        { status: 400 }
      );
    }

    // Get current session and term
    const { data: currentSession, error: sessionError } = await supabase
      .from("sessions")
      .select("id, end_date")
      .eq("is_current", true)
      .single();

    if (sessionError || !currentSession) {
      return NextResponse.json(
        { error: "No current session found" },
        { status: 400 }
      );
    }

    const { data: currentTerm, error: termError } = await supabase
      .from("terms")
      .select("id")
      .eq("is_current", true)
      .single();

    if (termError || !currentTerm) {
      return NextResponse.json(
        { error: "No current term found" },
        { status: 400 }
      );
    }

    // Determine target session (default to next session or provided)
    let finalTargetSessionId = targetSessionId;
    let finalTargetTermId = targetTermId;

    if (!finalTargetSessionId) {
      // Find or create next session
      const { data: nextSession, error: nextSessionError } = await supabase
        .from("sessions")
        .select("id")
        .gt("start_date", currentSession.end_date)
        .order("start_date", { ascending: true })
        .limit(1)
        .single();

      if (nextSessionError || !nextSession) {
        return NextResponse.json(
          { error: "No next session found. Please create next academic session first." },
          { status: 400 }
        );
      }

      finalTargetSessionId = nextSession.id;
    }

    if (!finalTargetTermId) {
      // Get first term of target session
      const { data: firstTerm, error: firstTermError } = await supabase
        .from("terms")
        .select("id")
        .eq("session_id", finalTargetSessionId)
        .order("start_date", { ascending: true })
        .limit(1)
        .single();

      if (firstTermError || !firstTerm) {
        return NextResponse.json(
          { error: "No term found for target session" },
          { status: 400 }
        );
      }

      finalTargetTermId = firstTerm.id;
    }

    // Get target class details
    const { data: targetClass, error: targetClassError } = await supabase
      .from("classes")
      .select("id, name, education_level, department")
      .eq("id", targetClassId)
      .single();

    if (targetClassError || !targetClass) {
      return NextResponse.json(
        { error: "Target class not found" },
        { status: 400 }
      );
    }

    let studentsToPromote: string[] = [];

    // Determine which students to promote
    if (action === "promote-class") {
      if (!sourceClassId) {
        return NextResponse.json(
          { error: "sourceClassId required for promote-class action" },
          { status: 400 }
        );
      }

      // Get all active students in source class
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", sourceClassId)
        .eq("session_id", currentSession.id)
        .eq("term_id", currentTerm.id)
        .eq("status", "active");

      if (enrollmentsError) {
        return NextResponse.json(
          { error: "Failed to fetch students: " + enrollmentsError.message },
          { status: 500 }
        );
      }

      studentsToPromote = (enrollments || []).map((e: any) => e.student_id);

    } else if (action === "promote-selected") {
      if (!studentIds || studentIds.length === 0) {
        return NextResponse.json(
          { error: "studentIds required for promote-selected action" },
          { status: 400 }
        );
      }

      studentsToPromote = studentIds;

    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'promote-class' or 'promote-selected'" },
        { status: 400 }
      );
    }

    if (studentsToPromote.length === 0) {
      return NextResponse.json({
        success: true,
        promoted: 0,
        failed: 0,
        message: "No students to promote"
      });
    }

    // Promote each student
    let promoted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const studentId of studentsToPromote) {
      try {
        // Get student details
        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("id, student_id, first_name, last_name, department, religion")
          .eq("id", studentId)
          .single();

        if (studentError || !student) {
          errors.push(`Student ${studentId}: not found`);
          failed++;
          continue;
        }

        // Get old enrollment
        const { data: oldEnrollment } = await supabase
          .from("enrollments")
          .select("id, class_id")
          .eq("student_id", studentId)
          .eq("session_id", currentSession.id)
          .eq("term_id", currentTerm.id)
          .single();

        // Mark current enrollment as completed
        if (oldEnrollment) {
          await supabase
            .from("enrollments")
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq("id", oldEnrollment.id);
        }

        // Create new enrollment in target class for next session
        const { error: enrollmentError } = await supabase
          .from("enrollments")
          .insert({
            student_id: studentId,
            class_id: targetClassId,
            session_id: finalTargetSessionId,
            term_id: finalTargetTermId,
            status: 'active',
            enrollment_type: 'promoted',
            previous_enrollment_id: oldEnrollment?.id || null,
            notes: `Promoted from ${oldEnrollment ? 'previous class' : 'initial enrollment'} to ${targetClass.name} for new session`
          });

        if (enrollmentError) {
          // Handle unique constraint violation (already promoted)
          if (enrollmentError.code === '23505') {
            errors.push(`Student ${student.student_id}: already enrolled in target session/term`);
            failed++;
            continue;
          }
          throw enrollmentError;
        }

        // Fetch available subject_classes for target class
        const { data: subjectClasses, error: scError } = await supabase
          .from("subject_classes")
          .select(`
            id,
            subject_id,
            subjects (
              id,
              name,
              is_optional,
              department,
              religion
            )
          `)
          .eq("class_id", targetClassId);

        if (scError) throw scError;

        // Filter subjects based on student's department and religion
        const filteredSubjects = (subjectClasses || []).filter((sc: any) => {
          const subject = sc.subjects;
          
          if (subject.department && student.department) {
            if (subject.department !== student.department) return false;
          }

          if (subject.religion && student.religion) {
            if (subject.religion !== student.religion) return false;
          }

          return true;
        });

        // Auto-assign compulsory subjects
        const subjectsToAssign = filteredSubjects
          .filter((sc: any) => !sc.subjects.is_optional)
          .map((sc: any) => ({
            student_id: studentId,
            subject_class_id: sc.id,
          }));

        if (subjectsToAssign.length > 0) {
          await supabase
            .from("student_subjects")
            .insert(subjectsToAssign);
        }

        promoted++;

      } catch (error: any) {
        console.error(`Failed to promote student ${studentId}:`, error);
        errors.push(`Student ${studentId}: ${error.message}`);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      promoted,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Promoted ${promoted} student(s) to ${targetClass.name}. ${failed > 0 ? `${failed} failed.` : ''}`
    });

  } catch (error: any) {
    console.error("Error in promote endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to promote students" },
      { status: 500 }
    );
  }
}
