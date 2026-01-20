"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { PieChart, TrendingUp, Users, BookOpen, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx-js-style";

type ClassRow = {
  id: number;
  name: string;
  level: string;
};

type FinalClass = ClassRow & {
  avg: number;
  pass: number;
  top: string | null;
  studentCount: number;
  genderCount: { male: number; female: number };
};

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<FinalClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimetableClass, setSelectedTimetableClass] = useState<number | null>(null);
  const [timetable, setTimetable] = useState<any>({});
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return toast.error("Please log in");

      const { data: classData } = await supabase
        .from("classes")
        .select("*, teachers(first_name, last_name)")
        .eq("teachers.user_id", user.id)
        .order("level");

      const final: FinalClass[] = [];

      for (const cls of classData ?? []) {
        const { data: studentsRaw } = await supabase
          .from("students")
          .select("id, gender, first_name, last_name")
          .eq("class_id", cls.id)
          .eq("status", "active");

        const students = studentsRaw ?? [];
        const ids = students.map((s) => s.id);

        const { data: resultsRaw } = await supabase
          .from("results")
          .select("*")
          .in("student_id", ids);

        const results = resultsRaw ?? [];

        const avg = results.length
          ? Number(
            (
              results.reduce((a, b) => a + b.total, 0) / results.length
            ).toFixed(1)
          )
          : 0;

        const pass = results.length
          ? Number(
            (
              (results.filter((r) => r.total >= 50).length / results.length) *
              100
            ).toFixed(2)
          )
          : 0;

        let top: string | null = null;
        if (results.length) {
          const best = results.reduce((a, b) => (a.total > b.total ? a : b));
          const sd = students.find((s) => s.id === best.student_id);
          top = sd ? `${sd.first_name} ${sd.last_name}` : null;
        }

        const genderCount = {
          male: students.filter((s) => s.gender === "male").length,
          female: students.filter((s) => s.gender === "female").length,
        };

        final.push({
          ...cls,
          avg,
          pass,
          top,
          genderCount,
          studentCount: ids.length,
        });
      }

      setClasses(final);
    } catch (err) {
      console.log(err);
      toast.error("Error loading classes");
    }
    setLoading(false);
  }

  async function loadTimetable(classId: number) {
    setLoadingTimetable(true);
    setSelectedTimetableClass(classId);

    const { data } = await supabase
      .from("timetable_entries")
      .select("*, subjects(name, teacher_id), classes(name)")
      .eq("class_id", classId)
      .order("period_number");

    const map: any = {};

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const SHORT = ["mon", "tue", "wed", "thu", "fri"];

    for (let p = 1; p <= 11; p++) {
      map[p] = { mon: null, tue: null, wed: null, thu: null, fri: null };
    }

    data?.forEach((row) => {
      const dayKey = row.day_of_week.toLowerCase().slice(0, 3);
      if (!map[row.period_number]) return;

      map[row.period_number][dayKey] = {
        subject: row.subjects?.name || "",
        teacher: "", // teachers not required for teacher's mode
      };
    });

    setTimetable(map);
    setIsTimetableModalOpen(true);
    setLoadingTimetable(false);
  }

  function handlePrintTimetable() {
    const printContents = document.getElementById("teacher-timetable")?.innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents || "";
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  }

  async function exportTeacherPDF() {
    const className = classes.find(c => c.id === selectedTimetableClass)?.name || "class";
    const element = document.getElementById("teacher-timetable");

    const canvas = await html2canvas(element!, { scale: 2 });
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(img, "PNG", 0, 0, width, height);
    pdf.save(`${className}-timetable.pdf`);
  }

  function exportTeacherExcel() {
    const className = classes.find(c => c.id === selectedTimetableClass)?.name || "class";
    const table = document.querySelector("#teacher-timetable table");
    const workbook = XLSX.utils.table_to_book(table);
    XLSX.writeFile(workbook, `${className}-timetable.xlsx`);
  }

  if (loading)
    return (
      <DashboardLayout role="teacher">
        <div className="flex justify-center items-center h-80 text-gray-500 text-lg">
          Loading classes...
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold mb-4">My Classes</h1>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm w-full">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="rounded-2xl shadow-sm hover:shadow-xl transition-all p-4 bg-white"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">{cls.name}</h2>
                <Badge className="bg-purple-100 text-purple-700">{cls.level}</Badge>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <Users className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Students</p>
                  <p className="font-bold text-lg">{cls.studentCount}</p>
                </div>

                <div className="p-3 bg-green-50 rounded-xl text-center">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Avg</p>
                  <p className="font-bold text-lg">{cls.avg}%</p>
                </div>

                <div className="p-3 bg-yellow-50 rounded-xl text-center">
                  <PieChart className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Pass</p>
                  <p className="font-bold text-lg">{cls.pass}%</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl text-center">
                  <Star className="w-4 h-4 mx-auto mb-1" />
                  <p className="text-xs">Top</p>
                  <p className="font-bold text-sm truncate">{cls.top || "—"}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border mb-4">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <PieChart className="w-4 h-4" /> Gender Distribution
                </p>
                <div className="flex justify-between text-sm">
                  <span>Male: {cls.genderCount.male}</span>
                  <span>Female: {cls.genderCount.female}</span>
                </div>
              </div>

              <div
                onClick={() => loadTimetable(cls.id)}
                className="p-4 border hover:bg-green-50 cursor-pointer transition rounded-xl mt-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-sm">View Timetable</span>
                </div>
                <p className="text-xs text-gray-500">Printable • Exportable</p>
              </div>

            </div>
          ))}
        </div>
      </div>
      {isTimetableModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white max-w-4xl w-full rounded-xl p-6 shadow-xl overflow-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-4">
              Timetable for {classes.find(c => c.id === selectedTimetableClass)?.name}
            </h2>

            <div className="flex gap-3 mb-4">
              <button onClick={handlePrintTimetable} className="px-4 py-2 bg-gray-800 text-white rounded">Print</button>
              <button onClick={exportTeacherPDF} className="px-4 py-2 bg-blue-600 text-white rounded">Export PDF</button>
              <button onClick={exportTeacherExcel} className="px-4 py-2 bg-green-600 text-white rounded">Export Excel</button>
            </div>

            <div id="teacher-timetable" className="border rounded-lg p-4 bg-white">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Period</th>
                    <th className="border p-2">Mon</th>
                    <th className="border p-2">Tue</th>
                    <th className="border p-2">Wed</th>
                    <th className="border p-2">Thu</th>
                    <th className="border p-2">Fri</th>
                  </tr>
                </thead>

                <tbody>
                  {Object.entries(timetable as any).map(([period, row]: [string, any]) => (
                    <tr key={period}>
                      <td className="border p-2 font-medium">Period {period}</td>
                      {["mon", "tue", "wed", "thu", "fri"].map((d) => (
                        <td key={d} className="border p-2 text-center">
                          {row[d]?.subject || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-right">
              <button
                onClick={() => setIsTimetableModalOpen(false)}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
