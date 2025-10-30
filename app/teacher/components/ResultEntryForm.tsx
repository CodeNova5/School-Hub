"use client";
import { useState, useEffect } from "react";
import { subjectsByDepartment } from "@/lib/subjectMap";
import toast, { Toaster } from "react-hot-toast";

export default function ResultEntryForm({ student }: { student: any }) {
  const [results, setResults] = useState<any>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existingResults = student.results || [];
    const subjects = subjectsByDepartment[student.department] || [];

    const merged = subjects.map((subject: string) => {
      const found = existingResults.find((r: any) => r.subject === subject);
      return (
        found || {
          subject,
          welcomeTest: null,
          midTerm: null,
          vetting: null,
          exam: null,
          total: 0,
          grade: "",
        }
      );
    });

    setResults(merged);
  }, [student]);

  const calculateGrade = (total: number) => {
    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";
    return "F";
  };

  const handleChange = (index: number, field: string, value: string) => {
    let numericValue = Math.max(0, parseInt(value || "0", 10));

    // Enforce limits
    const limits: any = {
      welcomeTest: 10,
      midTerm: 20,
      vetting: 10,
      exam: 50,
    };

    const maxVal = limits[field];
    if (numericValue > maxVal) {
      numericValue = maxVal;
      toast.error(`Maximum for ${field} is ${maxVal}`, { duration: 2000 });
    }

    const updated = [...results];
    updated[index][field] = numericValue;

    const total =
      Number(updated[index].welcomeTest) +
      Number(updated[index].midTerm) +
      Number(updated[index].vetting) +
      Number(updated[index].exam);

    updated[index].total = total;
    updated[index].grade = calculateGrade(total);
    setResults(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "addResult",
        studentId: student._id,
        results,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      toast.success("Results saved successfully!");
    } else {
      toast.error(data.message || "Error saving results.");
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border mt-4 relative">
      <Toaster position="top-right" />
      <h2 className="text-xl font-semibold mb-4">
        Enter Results for {student.fullName}
      </h2>
      <table className="w-full border mb-4 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Subject</th>
            <th className="p-2">Welcome Test (10)</th>
            <th className="p-2">Mid Term (20)</th>
            <th className="p-2">Vetting (10)</th>
            <th className="p-2">Exam (50)</th>
            <th className="p-2">Total</th>
            <th className="p-2">Grade</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r: any, i: number) => (
            <tr key={i}>
              <td className="p-2">{r.subject}</td>
              {["welcomeTest", "midTerm", "vetting", "exam"].map((f) => (
                <td key={f} className="p-2">
                  <input
                    type="number"
                    value={r[f]}
                    onChange={(e) => handleChange(i, f, e.target.value)}
                    className="border w-16 p-1 rounded text-center focus:ring focus:ring-blue-300"
                    max={f === "exam" ? 50 : f === "midTerm" ? 20 : 10}
                    min={0}
                  />
                </td>
              ))}
              <td className="p-2">{r.total}</td>
              <td className="p-2 font-semibold">{r.grade}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        {saving ? "Saving..." : "Save Results"}
      </button>
    </div>
  );
}
