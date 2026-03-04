"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AssignmentModal } from "@/components/assignment-modal";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { AssignmentFilters } from "@/components/AssignmentFilters";
import { useSchoolContext } from "@/hooks/use-school-context";
/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  class_id: string;
  subject_id: string;
  classes?: { name: string };
  subjects?: { name: string };
  assignment_submissions?: { id: string; grade: number | null }[];

  submissionCount: number;
  gradedCount: number;
  isFullyGraded: boolean;
  hasPendingGrading: boolean;
  isOverdue: boolean;
}

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 10;

/* -------------------------------------------------------------------------- */
/* SKELETONS                                                                  */
/* -------------------------------------------------------------------------- */

function AssignmentSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-4 animate-pulse">
      <div className="h-5 w-2/3 bg-gray-200 rounded" />
      <div className="h-4 w-full bg-gray-200 rounded" />
      <div className="h-4 w-5/6 bg-gray-200 rounded" />
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
        <div className="h-5 w-24 bg-gray-200 rounded-full" />
      </div>
      <div className="flex justify-end gap-2">
        <div className="h-8 w-24 bg-gray-200 rounded" />
        <div className="h-8 w-10 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

function AssignmentSkeletonList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <AssignmentSkeleton key={i} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filtered, setFiltered] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "no-submissions" | "submitted" | "pending-grading" | "fully-graded" | "overdue"
  >("all");
  const [filters, setFilters] = useState<{
    classId?: string;
  }>({});

  const [teacherId, setTeacherId] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  type CacheKey = string;

  const assignmentsCache = new Map<
    CacheKey,
    {
      data: Assignment[];
      total: number;
      timestamp: number;
    }
  >();

  function getCacheKey(
    teacherId: string,
    page: number,
    filters: {
      classId?: string;
    }
  ) {
    return `${teacherId}-${page}-${filters.classId ?? "all"}`;
  }


  /* ---------------------------------------------------------------------- */
  /* LOAD DATA                                                              */
  /* ---------------------------------------------------------------------- */

  /* -------------------- Load assignments -------------------- */

  async function loadAssignments({ revalidate = true } = {}) {
    if (!teacherId || !schoolId) return;

    const cacheKey = getCacheKey(teacherId, page, filters);
    const cached = assignmentsCache.get(cacheKey);

    // 1️⃣ Serve cache instantly
    if (cached) {
      setAssignments(cached.data);
      setTotal(cached.total);
      if (!revalidate) return;
    }

    setLoading(!cached);

    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get current session and term
      const { data: currentSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("is_current", true)
        .eq("school_id", schoolId)
        .single();

      const { data: currentTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .eq("school_id", schoolId)
        .single();

      let query = supabase
        .from("assignments")
        .select(
          `
        *,
        classes(name),
        subjects(name),
        assignment_submissions(id, grade)
      `,
          { count: "exact" }
        )
        .eq("teacher_id", teacherId)
        .eq("school_id", schoolId);

      /* -------------------- SERVER-SIDE FILTERS -------------------- */
      if (currentSession) {
        query = query.eq("session_id", currentSession.id);
      }

      if (currentTerm) {
        query = query.eq("term_id", currentTerm.id);
      }

      if (filters.classId)
        query = query.eq("class_id", filters.classId);

      const { data, count, error } = await query
        .order("due_date", { ascending: true })
        .range(from, to);

      if (error) throw error;

      const normalized: Assignment[] =
        data?.map((a: any) => {
          const subs = a.assignment_submissions ?? [];
          const graded = subs.filter((s: any) => s.grade !== null).length;

          return {
            ...a,
            submissionCount: subs.length,
            gradedCount: graded,
            isFullyGraded: subs.length > 0 && graded === subs.length,
            hasPendingGrading: graded < subs.length,
            isOverdue: new Date(a.due_date) < new Date(),
          };
        }) || [];

      setAssignments(normalized);
      setTotal(count || 0);

      assignmentsCache.set(cacheKey, {
        data: normalized,
        total: count || 0,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }


  // Initialize teacher ID
  useEffect(() => {
    async function initTeacher() {
      const user = await getCurrentUser();
      if (user) {
        const teacher = await getTeacherByUserId(user.id);
        if (teacher) {
          setTeacherId(teacher.id);
        }
      }
    }
    initTeacher();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [page, teacherId, filters, schoolId]);


  /* ---------------------------------------------------------------------- */
  /* FILTERS                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let result = [...assignments];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(s) ||
          a.description.toLowerCase().includes(s)
      );
    }

    if (classFilter !== "all")
      result = result.filter((a) => a.class_id === classFilter);

    if (subjectFilter !== "all")
      result = result.filter((a) => a.subject_id === subjectFilter);

    if (statusFilter !== "all") {
      result = result.filter((a) => {
        if (statusFilter === "no-submissions") return a.submissionCount === 0;
        if (statusFilter === "submitted") return a.submissionCount > 0;
        if (statusFilter === "pending-grading") return a.hasPendingGrading;
        if (statusFilter === "fully-graded") return a.isFullyGraded;
        if (statusFilter === "overdue") return a.isOverdue;
        return true;
      });
    }

    setFiltered(result);
  }, [assignments, search, classFilter, subjectFilter, statusFilter]);

  /* ---------------------------------------------------------------------- */
  /* EDIT                                                                   */
  /* ---------------------------------------------------------------------- */

  function handleEdit(assignment: Assignment) {
    setEditingAssignment(assignment);
    setOpenModal(true);
  }

  /* ---------------------------------------------------------------------- */
  /* DELETE                                                                 */
  /* ---------------------------------------------------------------------- */

  async function handleDelete(id: string) {
    if (!confirm("Delete this assignment?")) return;

    const cacheKey = getCacheKey(teacherId, page, filters);

    // 1️⃣ Snapshot current state
    const previous = assignments;
    const previousTotal = total;

    // 2️⃣ Optimistic update
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    setTotal((t) => t - 1);

    if (assignmentsCache.has(cacheKey)) {
      assignmentsCache.set(cacheKey, {
        ...assignmentsCache.get(cacheKey)!,
        data: previous.filter((a) => a.id !== id),
        total: previousTotal - 1,
        timestamp: Date.now(),
      });
    }

    // 3️⃣ Server request
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) {
      // 4️⃣ Rollback on failure
      setAssignments(previous);
      setTotal(previousTotal);
      toast.error("Delete failed. Restored.");
    } else {
      toast.success("Assignment deleted");
    }
  }


  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                 */
  /* ---------------------------------------------------------------------- */

  // Calculate statistics
  const stats = {
    total: assignments.length,
    ungraded: assignments.filter(a => a.submissionCount > 0 && a.hasPendingGrading).length,
    fullyGraded: assignments.filter(a => a.isFullyGraded).length,
    overdue: assignments.filter(a => a.isOverdue).length,
    noSubmissions: assignments.filter(a => a.submissionCount === 0).length,
  };

  if (schoolLoading || loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="ml-2 text-lg text-gray-600">Loading assignments...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-4 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:gap-0 md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Assignments</h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage submissions and grading
            </p>
          </div>
          <Button onClick={() => setOpenModal(true)} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Assignment
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                Total
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                All assignments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.ungraded}</div>
              <p className="text-xs text-muted-foreground">
                Need grading
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                Graded
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-green-600">{stats.fullyGraded}</div>
              <p className="text-xs text-muted-foreground">
                Complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                Overdue
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-red-600">{stats.overdue}</div>
              <p className="text-xs text-muted-foreground">
                Past due date
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                No Subs
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.noSubmissions}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting students
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Filter Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
              <div className="relative">
                <Input
                  placeholder="Search assignments..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              {teacherId && (
                <AssignmentFilters
                  teacherId={teacherId}
                  onChange={setFilters}
                />
              )}

              <select
                className="border rounded-md px-2 md:px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="no-submissions">No submissions</option>
                <option value="submitted">Has submissions</option>
                <option value="pending-grading">Pending grading</option>
                <option value="fully-graded">Fully graded</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            
            {(search || statusFilter !== "all" || filters.classId) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setFilters({});
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              {total} Assignment{total !== 1 && "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <AssignmentSkeletonList />
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <FileText className="mx-auto h-12 w-12 mb-4" />
                <p className="font-medium">No assignments found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((a) => (
                  <div
                    key={a.id}
                    className="border rounded-lg p-3 md:p-5 hover:shadow-lg transition-all bg-white"
                  >
                    <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between mb-2">
                          <h3 className="font-semibold text-base md:text-lg text-gray-900 break-words">{a.title}</h3>
                          <div className="flex flex-wrap gap-1 md:gap-2">
                            {a.isOverdue && (
                              <Badge className="bg-red-500 text-white text-xs md:text-sm">
                                Overdue
                              </Badge>
                            )}
                            {!a.isOverdue && a.isFullyGraded && (
                              <Badge className="bg-green-500 text-white text-xs md:text-sm">
                                ✓ Graded
                              </Badge>
                            )}
                            {!a.isOverdue && a.hasPendingGrading && a.submissionCount > 0 && (
                              <Badge className="bg-yellow-500 text-white text-xs md:text-sm">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2">
                          {a.description || "No description provided"}
                        </p>

                        <div className="flex flex-wrap gap-1 md:gap-2 items-center">
                          {a.classes && (
                            <Badge variant="outline" className="font-medium text-xs">
                              <span className="text-xs">📚</span> {a.classes.name}
                            </Badge>
                          )}
                          {a.subjects && (
                            <Badge variant="secondary" className="text-xs">
                              {a.subjects.name}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {a.submissionCount} sub
                          </Badge>
                          {a.submissionCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {a.gradedCount}/{a.submissionCount} ✓
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto">
                        <Link href={`/teacher/assignments/${a.id}`} className="flex-1 md:flex-none">
                          <Button size="sm" className="w-full">
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 md:flex-none md:w-full"
                          onClick={() => handleEdit(a)}
                        >
                          <Edit className="h-4 w-4 md:mr-1" />
                          <span className="hidden md:inline">Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex-1 md:flex-none md:w-full"
                          onClick={() => handleDelete(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 pt-6 border-t">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>

                <span className="text-xs sm:text-sm text-gray-500 order-first sm:order-none">
                  Page {page} of {Math.ceil(total / PAGE_SIZE)}
                </span>

                <Button
                  variant="outline"
                  disabled={page * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AssignmentModal
        open={openModal}
        teacherId={teacherId}
        assignment={editingAssignment}
        onClose={() => {
          setOpenModal(false);
          setEditingAssignment(null);
        }}
        onSave={(updatedAssignment) => {
          const cacheKey = getCacheKey(teacherId, page, filters);

          if (editingAssignment) {
            // 1️⃣ Optimistic UI update for edit
            setAssignments((prev) =>
              prev.map((a) => (a.id === updatedAssignment.id ? updatedAssignment : a))
            );

            // 2️⃣ Update cache
            if (assignmentsCache.has(cacheKey)) {
              const cached = assignmentsCache.get(cacheKey)!;
              assignmentsCache.set(cacheKey, {
                data: cached.data.map((a) =>
                  a.id === updatedAssignment.id ? updatedAssignment : a
                ),
                total: cached.total,
                timestamp: Date.now(),
              });
            }
          } else {
            // 1️⃣ Optimistic UI update for new
            setAssignments((prev) => [updatedAssignment, ...prev]);
            setTotal((t) => t + 1);

            // 2️⃣ Update cache
            assignmentsCache.set(cacheKey, {
              data: [updatedAssignment, ...assignments],
              total: total + 1,
              timestamp: Date.now(),
            });
          }

          // 3️⃣ Close modal instantly
          setOpenModal(false);
          setEditingAssignment(null);

          // 4️⃣ Background revalidation (no spinner)
          loadAssignments({ revalidate: true });
        }}
      />

    </DashboardLayout>
  );
}
