"use client";
import { useState, useEffect } from "react";
import AttendanceManager from "../components/AttendanceManager";
import ResultEntryForm from "../components/ResultEntryForm";
import { X } from "lucide-react";

interface Student {
  _id: string;
  fullName: string;
  admissionNumber: string;
  gender: string;
  department?: string;
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

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Class Students</h1>

      <div className="mb-6 p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-2">Instructions</h2>
        <ul className="list-disc list-inside text-gray-700">
          <li>Click “View Profile” to see student info.</li>
          <li>Click “Enter Results” to record scores.</li>
        </ul>
        <AttendanceManager students={students} />
      </div>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3">Name</th>
            <th className="p-3">Admission No</th>
            <th className="p-3">Gender</th>
            <th className="p-3">Department</th>
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
              <td className="p-3">{stu.department || "—"}</td>
              <td className="p-3">{stu.averageAttendance ?? 0}%</td>
              <td className="p-3 space-x-2">
                <button
                  onClick={() => {
                    setSelectedStudent(stu);
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Enter Results
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🧮 Result Entry Modal */}
      {selectedStudent && (
        <ResultEntryForm
          student={selectedStudent}
          modal={true}
          onClose={() => setSelectedStudent(null)} // ✅ Reset when closed
        />
      )}
    </div>
  );
}
