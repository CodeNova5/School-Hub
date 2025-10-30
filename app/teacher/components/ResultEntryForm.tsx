"use client";
import { useState } from "react";
import { subjectsByDepartment } from "@/lib/subjectMap";

export default function ResultEntryForm({ student }: { student: any }) {
  const [results, setResults] = useState<any>(
    subjectsByDepartment[student.department].map((subject) => ({
      subject,
      welcomeTest: 0,
      midTerm: 0,
      vetting: 0,
      exam: 0,
      total: 0,
      grade: "",
    }))
  );
  const [saving, setSaving] = useState(false);

  const calculateGrade = (total: number) => {
    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";
    return "F";
  };

  const handleChange = (index: number, field: string, value: number) => {
    const updated = [...results];
    updated[index][field] = value;
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
    alert(data.message);
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border mt-4">
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
                    onChange={(e) => handleChange(i, f, Number(e.target.value))}
                    className="border w-16 p-1 rounded"
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
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        {saving ? "Saving..." : "Save Results"}
      </button>
    </div>
  );
}
