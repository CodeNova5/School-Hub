"use client";
import { useState } from "react";

export default function AddStudentPage() {
  const [form, setForm] = useState({
    fullName: "",
    gender: "",
    email: "",
    address: "",
    phone: "",
    className: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
  });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Processing...");

    const res = await fetch("/api/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "addStudent", ...form }),
    });

    const data = await res.json();
    setMessage(data.message);
  };

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white shadow-lg rounded-xl p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Add Student</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="fullName" placeholder="Full Name" onChange={handleChange} required className="w-full border rounded p-2" />
        <select name="gender" onChange={handleChange} required className="w-full border rounded p-2">
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <input name="email" placeholder="Email" onChange={handleChange} className="w-full border rounded p-2" />
        <input name="address" placeholder="Address" onChange={handleChange} className="w-full border rounded p-2" />
        <input name="phone" placeholder="Phone" onChange={handleChange} className="w-full border rounded p-2" />
        <input name="className" placeholder="Class Name (e.g. JSS1)" onChange={handleChange} required className="w-full border rounded p-2" />
        <input name="parentName" placeholder="Parent Name" onChange={handleChange} className="w-full border rounded p-2" />
        <input name="parentPhone" placeholder="Parent Phone" onChange={handleChange} className="w-full border rounded p-2" />
        <input name="parentEmail" placeholder="Parent Email" onChange={handleChange} className="w-full border rounded p-2" />

        <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700 transition">
          Add Student
        </button>
      </form>

      {message && (
        <p className="mt-4 text-center text-sm font-medium text-gray-700">{message}</p>
      )}
    </div>
  );
}
