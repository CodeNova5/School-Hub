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
} from "lucide-react";
import { AssignmentFilters } from "@/components/AssignmentFilters";
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

const PAGE_SIZE = 2;

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

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "no-submissions" | "submitted" | "pending-grading" | "fully-graded" | "overdue"
  >("all");
  const [filters, setFilters] = useState<{
    sessionId?: string;
    termId?: string;
    classId?: string;
  }>({});

  const [teacherId, setTeacherId] = useState("");
  const [openModal, setOpenModal] = useState(false);
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
      sessionId?: string;
      termId?: string;
      classId?: string;
    }
  ) {
    return `${teacherId}-${page}-${filters.sessionId ?? "all"}-${filters.termId ?? "all"
      }-${filters.classId ?? "all"}`;
  }


  /* ---------------------------------------------------------------------- */
  /* LOAD DATA                                                              */
  /* ---------------------------------------------------------------------- */

  /* -------------------- Load assignments -------------------- */

  async function loadAssignments({ revalidate = true } = {}) {
    if (!teacherId) return;

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
        .eq("teacher_id", teacherId);

      /* -------------------- SERVER-SIDE FILTERS -------------------- */
      if (filters.sessionId)
        query = query.eq("session_id", filters.sessionId);

      if (filters.termId)
        query = query.eq("term_id", filters.termId);

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
  }, [page, teacherId, filters]);


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
      .eq("id", id);

    if (error) {
      // 4️⃣ Rollback on failure
      setAssignments(previous);
      setTotal(previousTotal);
      toast.error("Delete failed. Restored.");
    } else {
      toast.success("Assignment deleted");
    }
  }

  function invalidateAssignmentsCache() {
    assignmentsCache.clear();
  }



  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-gray-600">
              Manage submissions and grading
            </p>
          </div>
          <Button onClick={() => setOpenModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Assignment
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap gap-4">
              {teacherId && (
                <AssignmentFilters
                  teacherId={teacherId}
                  onChange={setFilters}
                />
              )}


              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />

              <select
                className="border rounded-md px-3 py-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="no-submissions">No submissions</option>
                <option value="submitted">Submitted</option>
                <option value="pending-grading">Pending grading</option>
                <option value="fully-graded">Fully graded</option>
                <option value="overdue">Overdue</option>
              </select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {total} Assignment{total !== 1 && "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <AssignmentSkeletonList />
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <FileText className="mx-auto h-12 w-12 mb-4" />
                No assignments found
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((a) => (
                  <div
                    key={a.id}
                    className="border rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{a.title}</h3>
                        <p className="text-sm text-gray-600">
                          {a.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {a.classes && (
                            <Badge variant="outline">{a.classes.name}</Badge>
                          )}
                          {a.subjects && (
                            <Badge variant="secondary">{a.subjects.name}</Badge>
                          )}
                          {a.isOverdue && (
                            <Badge className="bg-red-100 text-red-700">
                              Overdue
                            </Badge>
                          )}
                          {a.hasPendingGrading && (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              Pending grading
                            </Badge>
                          )}
                          {a.isFullyGraded && (
                            <Badge className="bg-green-100 text-green-700">
                              Fully graded
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Link href={`/teacher/assignments/${a.id}`}>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="destructive"
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
              <div className="flex justify-between items-center pt-6">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="text-sm text-gray-500">
                  Page {page} of {Math.ceil(total / PAGE_SIZE)}
                </span>

                <Button
                  variant="outline"
                  disabled={page * PAGE_SIZE >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
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
        onClose={() => setOpenModal(false)}
        onSave={(newAssignment) => {
          const cacheKey = getCacheKey(teacherId, page, filters);

          // 1️⃣ Optimistic UI update
          setAssignments((prev) => [newAssignment, ...prev]);
          setTotal((t) => t + 1);

          // 2️⃣ Update cache
          assignmentsCache.set(cacheKey, {
            data: [newAssignment, ...assignments],
            total: total + 1,
            timestamp: Date.now(),
          });

          // 3️⃣ Close modal instantly
          setOpenModal(false);

          // 4️⃣ Background revalidation (no spinner)
          loadAssignments({ revalidate: true });
        }}
      />

    </DashboardLayout>
  );
}
