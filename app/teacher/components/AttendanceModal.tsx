"use client";
import { useState } from "react";

type AttendanceModalProps = {
  student: any;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function AttendanceModal({ student, onClose, onSuccess }: AttendanceModalProps) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    if (!status) {
      setMessage("⚠️ Please select a status before submitting.");
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "attendance", studentId: student._id, status }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setMessage("✅ Attendance recorded successfully!");
      if (onSuccess) onSuccess();
      setTimeout(onClose, 1000);
    } else {
      setMessage("❌ " + data.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4 text-center text-gray-800">
          Mark Attendance
        </h2>
        <p className="mb-2 text-center text-gray-600">
          Student: <strong>{student.fullName}</strong>
        </p>

        <select
          className="border rounded w-full p-2 mb-4"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Select Status</option>
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Late">Late</option>
        </select>

        {message && (
          <p
            className={`text-sm mb-3 text-center ${
              message.includes("✅") ? "text-green-600" : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-700 px-3 py-1 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            {loading ? "Saving..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
