"use client";
import { useState, useEffect } from "react";

export default function AddStudentPage() {
  const [form, setForm] = useState({
    fullName: "",
    gender: "",
    email: "",
    address: "",
    phone: "",
    className: "",
    parentFullName: "",
    parentPhone: "",
    parentEmail: "",
  });

  const [message, setMessage] = useState("");
  const [teacher, setTeacher] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  useEffect(() => {
    async function fetchTeacher() {
      try {
        const res = await fetch("/api/teacher", {
          // Fix API endpoint
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "getProfile" }),
        });
        const data = await res.json();
        if (data.success) setTeacher(data.teacher);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTeacher();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
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
    <div className="max-w-lg mx-auto mt-10 text-black bg-white shadow-lg rounded-xl p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Add New Student</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            name="fullName"
            placeholder="Enter student's full name"
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select
            name="gender"
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          >
            <option value="">Select Gender</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            name="email"
            placeholder="Student email (optional)"
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input
            name="address"
            placeholder="Home address"
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input
            name="phone"
            placeholder="Student phone number"
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Class Name</label>
          <input
            name="className"
            onChange={handleChange}
            value={teacher?.assignedClass || ""} // Add null check
            required
            className="w-full border rounded p-2"
            disabled={isLoading} // Disable input while loading
          />
        </div>

        {/* Parent / Guardian Info */}
        <div className="mt-6 border-t pt-4">
          <h2 className="text-lg font-semibold mb-2 text-blue-700">
            Parent / Guardian Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                name="parentFullName"
                placeholder="Parent or Guardian full name"
                onChange={handleChange}
                required
                className="w-full border rounded p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Phone Number
              </label>
              <input
                name="parentPhone"
                placeholder="Parent or Guardian phone"
                onChange={handleChange}
                required
                className="w-full border rounded p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="parentEmail"
                placeholder="Parent or Guardian email"
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700 transition"
        >
          Add Student
        </button>
      </form>

      {message && (
        <p className="mt-4 text-center text-sm font-medium text-gray-700">
          {message}
        </p>
      )}
    </div>
  );
}
