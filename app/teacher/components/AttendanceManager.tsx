"use client";
import { useState, useEffect } from "react";
import AttendanceModal from "./AttendanceModal";

export default function AttendanceManager({ students: initialStudents }: { students?: any[] }) {
  const [students, setStudents] = useState<any[]>(initialStudents ?? []);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [message, setMessage] = useState("");

  // keep internal students in sync if the parent updates the prop
  useEffect(() => {
    setStudents(initialStudents ?? []);
  }, [initialStudents]);

  // 📅 Format date nicely
  function formatDate(date: Date) {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // 🕓 Change date
  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = new Date(e.target.value);
    setAttendanceDate(newDate);
  }

  // ✅ Mark all as present
  function markAllPresent() {
    const updated = students.map((s) => ({ ...s, status: "Present" }));
    setStudents(updated);
    setMessage("✅ All students marked Present!");
  }

  // 🧾 Submit attendance (for that specific date)
  async function handleSubmit() {
    setMessage("Saving attendance...");
    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "attendance",
        date: attendanceDate,
        records: students.map((s) => ({
          studentId: s._id,
          status: s.status || "Absent",
        })),
      }),
    });

    const data = await res.json();
    if (data.success) setMessage("✅ Attendance saved successfully!");
    else setMessage("❌ Error saving attendance.");
  }

  // If parent provided no students yet, show a friendly message
  if (!students || students.length === 0) return <p className="p-4">No students available.</p>;

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold">
          Attendance for {formatDate(attendanceDate)}
        </h1>

        <div className="flex items-center gap-3">
          <input
            type="date"
            className="border p-2 rounded"
            value={attendanceDate.toISOString().split("T")[0]}
            onChange={handleDateChange}
          />
          <button
            onClick={() => setAttendanceDate(new Date())}
            className="bg-gray-200 px-3 py-1 rounded"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <button
          onClick={markAllPresent}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Mark All Present
        </button>

        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save Attendance
        </button>
      </div>

      {message && <p className="text-center mb-4 text-sm text-gray-600">{message}</p>}

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Gender</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {students.map((stu) => (
            <tr key={stu._id} className="border-b">
              <td className="p-3">{stu.fullName}</td>
              <td className="p-3">{stu.gender}</td>
              <td className="p-3">{stu.status || "Not Marked"}</td>
              <td className="p-3">
                <select
                  value={stu.status || ""}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setStudents((prev) =>
                      prev.map((s) =>
                        s._id === stu._id ? { ...s, status: newStatus } : s
                      )
                    );
                  }}
                  className="border p-1 rounded"
                >
                  <option value="">Select</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedStudent && (
        <AttendanceModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
