"use client";
import { useState, useEffect } from "react";
import AttendanceManager from "../components/AttendanceManager";
export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchStudents() {
      const res = await fetch("/api/teacher", {
        // Fix API endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "getProfile" }),
      });

      const data = await res.json();
      if (data.success) setStudents(data.students);
      setLoading(false);
    }
    fetchStudents();
  }, []);

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Class Students</h1>
      <div className="mb-6 p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-2">Instructions to Manage Attendance</h2>
        <ul className="list-disc list-inside text-gray-700">
          <li>Select a student from the table below to view and manage their attendance records.</li>
          <li>You can add new attendance entries, edit existing ones, or delete them as needed.</li>
          <li>The average attendance percentage is automatically calculated based on the records.</li>
          <li>Ensure to save any changes you make to keep the records up to date.</li>
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
            <tr key={stu._id} className="border-b">
              <td className="p-3">{stu.fullName}</td>
              <td className="p-3">{stu.admissionNumber}</td>
              <td className="p-3">{stu.gender}</td>
              <td className="p-3">{stu.averageAttendance ?? 0}%</td>
              <td className="p-3 space-x-2">

              </td>
            </tr>
          ))}
        </tbody>
      </table>


    </div>
  );
}
