"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch all admissions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admissions");
        const data = await res.json();
        setAdmissions(data);
      } catch (error) {
        console.error("Error fetching admissions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Update admission status
  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admissions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAdmissions((prev) =>
          prev.map((a) => (a._id === id ? { ...a, status } : a))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const total = admissions.length;
  const pending = admissions.filter((a) => a.status === "pending").length;
  const approved = admissions.filter((a) => a.status === "approved").length;
  const rejected = admissions.filter((a) => a.status === "rejected").length;

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-bold mb-10 text-center text-blue-800">
        🏫 School Admin Dashboard
      </h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <DashboardCard title="Total Applications" value={total} color="blue" />
        <DashboardCard title="Pending" value={pending} color="yellow" />
        <DashboardCard title="Approved" value={approved} color="green" />
        <DashboardCard title="Rejected" value={rejected} color="red" />
      </div>

      {/* Admissions Table */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border">
        <table className="min-w-full text-sm text-gray-800">
          <thead className="bg-gray-100 uppercase text-xs text-gray-600">
            <tr>
              <th className="p-4 text-left">Student</th>
              <th className="p-4 text-left">Class</th>
              <th className="p-4 text-left">Parent</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  <Loader2 className="animate-spin inline mr-2" />
                  Loading applications...
                </td>
              </tr>
            ) : admissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  No admissions yet.
                </td>
              </tr>
            ) : (
              admissions.map((a) => (
                <tr
                  key={a._id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="p-4 font-medium">
                    {a.firstName} {a.lastName}
                  </td>
                  <td className="p-4">{a.classApplyingFor}</td>
                  <td className="p-4">
                    {a.parentFirstName} {a.parentLastName}
                  </td>
                  <td className="p-4">{a.parentEmail}</td>
                  <td
                    className={`p-4 font-semibold capitalize ${
                      a.status === "approved"
                        ? "text-green-600"
                        : a.status === "rejected"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {a.status}
                  </td>
                  <td className="p-4 space-x-3">
                    <button
                      onClick={() => updateStatus(a._id, "approved")}
                      disabled={updatingId === a._id}
                      className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {updatingId === a._id ? (
                        <Loader2 className="animate-spin inline w-4 h-4" />
                      ) : (
                        <CheckCircle className="inline w-4 h-4 mr-1" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(a._id, "rejected")}
                      disabled={updatingId === a._id}
                      className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {updatingId === a._id ? (
                        <Loader2 className="animate-spin inline w-4 h-4" />
                      ) : (
                        <XCircle className="inline w-4 h-4 mr-1" />
                      )}
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <div
      className={`p-6 rounded-xl shadow text-center font-semibold ${colors[color]}`}
    >
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <h2 className="text-3xl">{value}</h2>
    </div>
  );
}
