/**
 * Enrollment System Utilities
 * Helper functions for querying students via enrollments
 */

import { supabase } from '@/lib/supabase';

export interface EnrollmentQuery {
    classId?: string;
    sessionId?: string;
    termId?: string;
    status?: 'active' | 'transferred' | 'completed' | 'dropped' | 'graduated';
}

/**
 * Get students enrolled in a class for current session/term
 */
export async function getCurrentClassStudents(classId: string) {


    const { data, error } = await supabase
        .from("current_enrollments")
        .select("*")
        .eq("class_id", classId);

    if (error) throw error;
    return data || [];
}

/**
 * Get students enrolled in a class for specific session/term
 */
export async function getClassStudents(
    classId: string,
    sessionId: string,
    termId: string
) {

    const { data, error } = await supabase
        .from("enrollment_details")
        .select("*")
        .eq("class_id", classId)
        .eq("session_id", sessionId)
        .eq("term_id", termId);

    if (error) throw error;
    return data || [];
}

/**
 * Get unassigned students (no active enrollment in current session/term)
 */
export async function getUnassignedStudents() {


    // Get current session and term
    const { data: currentSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("is_current", true)
        .single();

    const { data: currentTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .single();

    if (!currentSession || !currentTerm) {
        return [];
    }

    // Get all active students
    const { data: allStudents, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .eq("status", "active");

    if (studentsError || !allStudents) return [];

    // Get students with active enrollments
    const { data: enrolledStudents, error: enrolledError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("session_id", currentSession.id)
        .eq("term_id", currentTerm.id)
        .eq("status", "active");

    if (enrolledError) return [];

    const enrolledIds = new Set((enrolledStudents || []).map(e => e.student_id));

    // Filter out enrolled students
    return allStudents.filter(s => !enrolledIds.has(s.id));
}

/**
 * Get student's current class
 */
export async function getStudentCurrentClass(studentId: string) {
    const { data, error } = await supabase
        .rpc("get_student_current_class", { p_student_id: studentId });

    if (error) throw error;
    return data;
}

/**
 * Get student's class for specific session/term
 */
export async function getStudentClass(
    studentId: string,
    sessionId: string,
    termId: string
) {
    const { data, error } = await supabase
        .rpc("get_student_class", {
            p_student_id: studentId,
            p_session_id: sessionId,
            p_term_id: termId
        });

    if (error) throw error;
    return data;
}

/**
 * Get student's enrollment history
 */
export async function getStudentEnrollmentHistory(studentId: string) {

    const { data, error } = await supabase
        .rpc("get_enrollment_history", { p_student_id: studentId });

    if (error) throw error;
    return data || [];
}

/**
 * Create enrollment for student
 */
export async function enrollStudent(
    studentId: string,
    classId: string,
    sessionId: string,
    termId: string,
    enrollmentType: 'new' | 'promoted' | 'transferred' | 'repeated' | 'returned' = 'new'
) {
    const { data, error } = await supabase
        .from("enrollments")
        .insert({
            student_id: studentId,
            class_id: classId,
            session_id: sessionId,
            term_id: termId,
            status: 'active',
            enrollment_type: enrollmentType
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Check if student is enrolled
 */
export async function isStudentEnrolled(studentId: string) {
    const { data, error } = await supabase
        .rpc("is_student_enrolled", { p_student_id: studentId });

    if (error) return false;
    return data === true;
}
