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
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.password && form.confirmPassword) {
      setPasswordMatch(form.password === form.confirmPassword);
    } else {
      setPasswordMatch(null);
    }
  }, [form.password, form.confirmPassword]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
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
    <div className="max-w-lg mx-auto mt-10 bg-white text-black p-8 rounded-2xl shadow">
      <h1 className="text-2xl font-bold text-center mb-6">Register Teacher</h1>

      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="space-y-4"
      >
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block mb-1 font-medium">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            placeholder="Full Name"
            value={form.fullName}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="off"
          />
        </div>

        {/* Gender */}
        <div>
          <label htmlFor="gender" className="block mb-1 font-medium">
            Gender
          </label>
          <select
            id="gender"
            name="gender"
            value={form.gender}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="off"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block mb-1 font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            placeholder="Username (min. 6 chars)"
            minLength={6}
            value={form.username}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="off"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block mb-1 font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="off"
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block mb-1 font-medium">
            Address
          </label>
          <input
            id="address"
            name="address"
            placeholder="Address"
            value={form.address}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="off"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="phoneNumber" className="block mb-1 font-medium">
            Phone Number
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            placeholder="Phone Number"
            value={form.phoneNumber}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="off"
          />
        </div>

        {/* Assigned Class */}
        <div>
          <label htmlFor="assignedClass" className="block mb-1 font-medium">
            Assigned Class (optional)
          </label>
          <select
            id="assignedClass"
            name="assignedClass"
            value={form.assignedClass}
            onChange={handleChange}
            className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
            autoComplete="off"
          >
            <option value="">-- Select Class (optional) --</option>

            <optgroup label="PRE-PRIMARY EDUCATION">
              <option value="Creche">Creche</option>
              <option value="Kindergarten 1">Kindergarten 1</option>
              <option value="Kindergarten 2">Kindergarten 2</option>
              <option value="Nursery 1">Nursery 1</option>
              <option value="Nursery 2">Nursery 2</option>
            </optgroup>

            <optgroup label="PRIMARY EDUCATION">
              <option value="Primary 1">Primary 1</option>
              <option value="Primary 2">Primary 2</option>
              <option value="Primary 3">Primary 3</option>
              <option value="Primary 4">Primary 4</option>
              <option value="Primary 5">Primary 5</option>
              <option value="Primary 6">Primary 6</option>
            </optgroup>

            <optgroup label="JUNIOR SECONDARY SCHOOL">
              <option value="JSS 1">JSS 1</option>
              <option value="JSS 2">JSS 2</option>
              <option value="JSS 3">JSS 3</option>
            </optgroup>

            <optgroup label="SENIOR SECONDARY SCHOOL">
              <option value="SS 1">SS 1</option>
              <option value="SS 2">SS 2</option>
              <option value="SS 3">SS 3</option>
            </optgroup>
          </select>
        </div>

        {/* Password Section */}
        <div>
          <label className="block mb-1 font-medium">Password</label>

          {passwordMatch === false && (
            <p className="text-red-500 text-sm mb-1">Passwords do not match ❌</p>
          )}
          {passwordMatch && (
            <p className="text-green-600 text-sm mb-1">Passwords match ✅</p>
          )}

          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full border p-2 rounded mb-2"
            required
            autoComplete="new-password"
          />

          <input
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            required
            autoComplete="new-password"
          />

          {/* Toggle show password */}
          <div className="mt-2 flex items-center space-x-2">
            <input
              id="showPassword"
              type="checkbox"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
              className="h-4 w-4"
            />
            <label htmlFor="showPassword" className="text-sm text-gray-700">
              Show Password
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          disabled={loading}
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700"
        >
          {loading ? "Registering..." : "Register Teacher"}
        </button>
      </form>

      {message && (
        <p className="text-center mt-4 text-sm font-medium text-gray-700">
          {message}
        </p>
      )}
    </div>
  );
}
