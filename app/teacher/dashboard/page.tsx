"use client";
import { useState, useEffect } from "react";
import AttendanceManager from "../components/AttendanceManager";

interface Student {
  _id: string;
  fullName: string;
  admissionNumber: string;
  gender: string;
  averageAttendance?: number;
  email?: string;
  address?: string;
  phone?: string;
  className?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);
  const [result, setResult] = useState({ subject: "", score: "" });
  const [grade, setGrade] = useState("");

  // ✅ Fetch Students
  useEffect(() => {
    async function fetchStudents() {
      const res = await fetch("/api/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "getProfile" }),
      });
      const data = await res.json();
      if (data.success) setStudents(data.students || []);
      setLoading(false);
    }
    fetchStudents();
  }, []);

  // ✅ Grade Calculator
  const calculateGrade = (score: number) => {
    if (score >= 70) return "A";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    if (score >= 45) return "D";
    if (score >= 40) return "E";
    return "F";
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setResult({ ...result, score: val });
    const grade = calculateGrade(Number(val));
    setGrade(grade);
  };

  const handleSubmitResult = async () => {
    if (!selectedStudent) return;
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "addResult",
        studentId: selectedStudent._id,
        subject: result.subject,
        score: Number(result.score),
        grade,
      }),
    });
    const data = await res.json();
    alert(data.message || "Result submitted");
    setShowResultForm(false);
    setResult({ subject: "", score: "" });
  };

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Class Students</h1>

      <div className="mb-6 p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-2">Instructions to Manage Attendance</h2>
        <ul className="list-disc list-inside text-gray-700">
          <li>Click “View Profile” to see student info.</li>
          <li>Click “Add Result” to enter subject scores and grades.</li>
          <li>Use the attendance component below to mark or adjust attendance.</li>
        </ul>
        <AttendanceManager students={students} />
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3">Name</th>
            <th className="p-3">Admission No</th>
            <th className="p-3">Gender</th>
            <th className="p-3">Attendance %</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((stu) => (
            <tr key={stu._id} className="border-b hover:bg-gray-50">
              <td className="p-3">{stu.fullName}</td>
              <td className="p-3">{stu.admissionNumber}</td>
              <td className="p-3">{stu.gender}</td>
              <td className="p-3">{stu.averageAttendance ?? 0}%</td>
              <td className="p-3 space-x-2">
                <button
                  onClick={() => {
                    setSelectedStudent(stu);
                    setShowProfile(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View Profile
                </button>
                <button
                  onClick={() => {
                    setSelectedStudent(stu);
                    setShowResultForm(true);
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Add Result
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🧍 Student Profile Modal */}
      {showProfile && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">{selectedStudent.fullName}</h2>
            <div className="space-y-2">
              <p><strong>Admission No:</strong> {selectedStudent.admissionNumber}</p>
              <p><strong>Email:</strong> {selectedStudent.email}</p>
              <p><strong>Phone:</strong> {selectedStudent.phone}</p>
              <p><strong>Address:</strong> {selectedStudent.address}</p>
              <p><strong>Class:</strong> {selectedStudent.className}</p>
              <p><strong>Parent Name:</strong> {selectedStudent.parentName}</p>
              <p><strong>Parent Phone:</strong> {selectedStudent.parentPhone}</p>
              <p><strong>Parent Email:</strong> {selectedStudent.parentEmail}</p>
            </div>
            <button
              onClick={() => setShowProfile(false)}
              className="mt-6 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 🧮 Result Entry Modal */}
      {showResultForm && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Add Result for {selectedStudent.fullName}</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Subject"
                value={result.subject}
                onChange={(e) => setResult({ ...result, subject: e.target.value })}
                className="w-full border p-2 rounded"
              />
              <input
                type="number"
                placeholder="Score (0–100)"
                value={result.score}
                onChange={handleScoreChange}
                className="w-full border p-2 rounded"
              />
              {grade && (
                <p className="text-lg">
                  Grade: <span className="font-bold">{grade}</span>
                </p>
              )}
              <button
                onClick={handleSubmitResult}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Submit
              </button>
              <button
                onClick={() => setShowResultForm(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
