"use client";
import { useState, useEffect } from "react";
import AttendanceManager from "../components/AttendanceManager";
import ResultEntryForm from "../components/ResultEntryForm"; // ✅ Import new result component
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
  const [showResultForm, setShowResultForm] = useState(false);

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

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Class Students</h1>

      <div className="mb-6 p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-2">Instructions to Manage Students</h2>
        <ul className="list-disc list-inside text-gray-700">
          <li>Click “View Profile” to see detailed student information.</li>
          <li>Click “Enter Results” to record test and exam scores by subject.</li>
          <li>Use the attendance manager below to mark or edit attendance.</li>
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
                  Enter Results
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
              <p><strong>Department:</strong> {selectedStudent.department}</p>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-auto">
          <div className="relative bg-white w-full max-w-5xl rounded-xl shadow-lg p-6">

            {/* ❌ Cancel icon fixed at top-right */}
            <button
              onClick={() => setShowResultForm(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <X size={30} />
            </button>
            <ResultEntryForm student={selectedStudent} />
          </div>
        </div>
      )}
    </div>
  );
}