"use client";
import { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import AttendanceModal from "./AttendanceModal";

export default function AttendanceSection({ students: initialStudents }: { students?: any[] }) {
  const [showModal, setShowModal] = useState(false);
  const [students, setStudents] = useState<any[]>(initialStudents ?? []);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStudents(initialStudents ?? []);
  }, [initialStudents]);

  function formatDate(date: Date) {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = new Date(e.target.value);
    setAttendanceDate(newDate);
  }

  function markAllPresent() {
    const updated = students.map((s) => ({ ...s, status: "Present" }));
    setStudents(updated);
    setMessage("✅ All students marked Present!");
  }

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

  return (
    <div className="p-8">
      {/* --- Button to open attendance modal --- */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition"
        >
          Take Attendance
        </button>
      </div>

      {/* --- Reusable Modal Component --- */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Attendance for ${formatDate(attendanceDate)}`}
        maxWidth="max-w-5xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
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

        {message && (
          <p className="text-center mb-4 text-sm text-gray-600">{message}</p>
        )}

        {students.length === 0 ? (
          <p className="p-4 text-center text-gray-500">
            No students available.
          </p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left w-16">#</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Gender</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((stu, index) => (
                <tr key={stu._id} className="border-b">
                  <td className="p-3 font-medium">{index + 1}</td>
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
                            s._id === stu._id
                              ? { ...s, status: newStatus }
                              : s
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

        )}

        {selectedStudent && (
          <AttendanceModal
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </Modal>
    </div>
  );
}
