"use client";

import { useState } from "react";

export default function AdmissionPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    gender: "",
    classApplyingFor: "",
    address: "",
    dateOfBirth: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        setMessage("✅ Application submitted successfully!");
        setForm({
          fullName: "",
          email: "",
          phone: "",
          gender: "",
          classApplyingFor: "",
          address: "",
          dateOfBirth: "",
        });
      } else {
        setMessage("❌ Failed to submit application");
      }
    } catch (error) {
      console.error(error);
      setMessage("⚠️ Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-6 text-center">Admission Form</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Full Name", name: "fullName", type: "text" },
            { label: "Email", name: "email", type: "email" },
            { label: "Phone", name: "phone", type: "text" },
            { label: "Gender", name: "gender", type: "select", options: ["Male", "Female"] },
            { label: "Class Applying For", name: "classApplyingFor", type: "text" },
            { label: "Address", name: "address", type: "text" },
            { label: "Date of Birth", name: "dateOfBirth", type: "date" },
          ].map((field) => (
            <div key={field.name}>
              <label className="block mb-1 font-medium">{field.label}</label>
              {field.type === "select" ? (
                <select
                  className="w-full border rounded-lg p-2"
                  value={form[field.name as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                  required
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  className="w-full border rounded-lg p-2"
                  value={form[field.name as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                  required
                />
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        {message && <p className="mt-4 text-center text-gray-700">{message}</p>}
      </div>
    </div>
  );
}
