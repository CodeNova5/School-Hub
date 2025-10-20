"use client";

import { useState } from "react";

export default function AddStudentPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    gender: "",
    email: "",
    address: "",
    phone: "",
    className: "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/teacher/addstudent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const result = await res.json();
    if (result.success) {
      setMessage("✅ Student added successfully!");
      setFormData({
        fullName: "",
        gender: "",
        email: "",
        address: "",
        phone: "",
        className: "",
        parentName: "",
        parentEmail: "",
        parentPhone: "",
      });
    } else {
      setMessage("❌ Failed to add student. Please try again.");
    }
  };

  return (
    <div className="max-w-3xl text-black mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">Add Student</h1>

      {message && (
        <div className="text-center mb-4 font-medium text-sm text-green-600">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          value={formData.fullName}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />

        <select
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <input
          type="email"
          name="email"
          placeholder="Student Email"
          value={formData.email}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />

        <input
          type="text"
          name="phone"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />

        <input
          type="text"
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />

        <input
          type="text"
          name="className"
          placeholder="Class Name (e.g. JSS1)"
          value={formData.className}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />

        <h3 className="font-semibold mt-4">Parent/Guardian Info</h3>

        <input
          type="text"
          name="parentName"
          placeholder="Parent Name"
          value={formData.parentName}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />

        <input
          type="email"
          name="parentEmail"
          placeholder="Parent Email"
          value={formData.parentEmail}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />

        <input
          type="text"
          name="parentPhone"
          placeholder="Parent Phone"
          value={formData.parentPhone}
          onChange={handleChange}
          className="w-full border rounded p-2"
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700"
        >
          Add Student
        </button>
      </form>
    </div>
  );
}
