"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusModal from "@/components/StatusModal";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({
    open: false,
    message: "",
    type: "info" as "loading" | "success" | "error" | "info",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);
    setModal({ open: true, message: "Logging in...", type: "loading" });

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setModal({ open: true, message: "Login successful!", type: "success" });
        setTimeout(() => router.push("/admin/dashboard"), 1500);
      } else {
        const data = await res.json();
        const msg = data.message || "Login failed";
        setError(msg);
        setModal({ open: true, message: msg, type: "error" });
      }
    } catch {
      setModal({ open: true, message: "Network error, please try again.", type: "error" });
    } finally {
      setLoading(false);
      setTimeout(() => setModal({ open: false, message: "", type: "info" }), 2000);
    }
  };

  return (
    <div className="min-h-screen text-black flex items-center justify-center bg-gray-50 relative">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 shadow-md rounded-lg w-full max-w-sm"
      >
        <h2 className="text-xl font-semibold text-center mb-4">
          Admin Login
        </h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-3"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded mb-4"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button
          type="submit"
          disabled={loading}
          className={`w-full p-2 rounded text-white transition ${
            loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "Please wait..." : "Login"}
        </button>
      </form>

      {/* Reusable Modal */}
      <StatusModal open={modal.open} message={modal.message} type={modal.type} />
    </div>
  );
}
