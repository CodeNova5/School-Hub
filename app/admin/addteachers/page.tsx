"use client";

import { useState, useEffect } from "react";

export default function TeacherRegistrationPage() {
  const [form, setForm] = useState({
    fullName: "",
    gender: "",
    username: "",
    email: "",
    address: "",
    phoneNumber: "",
    assignedClass: "",
    password: "",
    confirmPassword: "",
  });
  const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.password && form.confirmPassword) {
      setPasswordMatch(form.password === form.confirmPassword);
    } else {
      setPasswordMatch(null);
    }
  }, [form.password, form.confirmPassword]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordMatch) {
      setMessage("❌ Passwords do not match");
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setMessage("✅ Verification code sent to teacher's email!");
      setForm({
        fullName: "",
        gender: "",
        username: "",
        email: "",
        address: "",
        phoneNumber: "",
        assignedClass: "",
        password: "",
        confirmPassword: "",
      });
    } else {
      setMessage(`❌ ${data.message}`);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white p-8 rounded-2xl shadow">
      <h1 className="text-2xl font-bold text-center mb-6">Register Teacher</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="fullName"
          placeholder="Full Name"
          value={form.fullName}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />

        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <input
          name="username"
          placeholder="Username (min. 6 chars)"
          minLength={6}
          value={form.username}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />

        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />

        <input
          name="address"
          placeholder="Address"
          value={form.address}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />

        <input
          name="phoneNumber"
          placeholder="Phone Number"
          value={form.phoneNumber}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />

        <input
          name="assignedClass"
          placeholder="Assigned Class (optional)"
          value={form.assignedClass}
          onChange={handleChange}
          className="w-full border p-2 rounded"
        />

        <div>
          {passwordMatch === false && (
            <p className="text-red-500 text-sm mb-1">Passwords do not match ❌</p>
          )}
          {passwordMatch && (
            <p className="text-green-600 text-sm mb-1">Passwords match ✅</p>
          )}
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full border p-2 rounded mb-2"
            required
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700"
        >
          {loading ? "Registering..." : "Register Teacher"}
        </button>
      </form>

      {message && (
        <p className="text-center mt-4 text-sm font-medium text-gray-700">{message}</p>
      )}
    </div>
  );
}
