"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, Search } from "lucide-react";

export default function AdminDashboard() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [filteredAdmissions, setFilteredAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClass, setFilterClass] = useState("all");

  // Fetch all admissions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admission");
        const data = await res.json();
        setAdmissions(data);
        setFilteredAdmissions(data);
      } catch (error) {
        console.error("Error fetching admissions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  
  const updateStatus = async (id: string, newStatus: string) => {
    const res = await fetch("/api/admission/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Status updated successfully");
      setAdmissions((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, status: newStatus } : item
        )
      );
    } else {
      alert(data.message || "Failed to update");
    }
  };


  // Filter Logic
  useEffect(() => {
    const lowerSearch = searchQuery.toLowerCase();
    const filtered = admissions.filter((a) => {
      const matchSearch =
        a.firstName.toLowerCase().includes(lowerSearch) ||
        a.lastName.toLowerCase().includes(lowerSearch) ||
        a.parentFirstName.toLowerCase().includes(lowerSearch);
      const matchStatus =
        filterStatus === "all" ? true : a.status === filterStatus;
      const matchClass =
        filterClass === "all" ? true : a.classApplyingFor === filterClass;
      return matchSearch && matchStatus && matchClass;
    });
    setFilteredAdmissions(filtered);
  }, [searchQuery, filterStatus, filterClass, admissions]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <DashboardCard title="Total Applications" value={total} color="blue" />
        <DashboardCard title="Pending" value={pending} color="yellow" />
        <DashboardCard title="Approved" value={approved} color="green" />
        <DashboardCard title="Rejected" value={rejected} color="red" />
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow p-4 mb-8 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center border rounded-lg px-3 py-2 w-full md:w-1/3">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search by name or parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full outline-none text-sm"
          />
        </div>

        <div className="flex gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Classes</option>
            <option value="Creche">Creche</option>
            <option value="Kindergarten 1">Kindergarten 1</option>
            <option value="Kindergarten 2">Kindergarten 2</option>
            <option value="Nursery 1">Nursery 1</option>
            <option value="Nursery 2">Nursery 2</option>
            <option value="Primary 1">Primary 1</option>
            <option value="Primary 2">Primary 2</option>
            <option value="Primary 3">Primary 3</option>
            <option value="Primary 4">Primary 4</option>
            <option value="Primary 5">Primary 5</option>
            <option value="Primary 6">Primary 6</option>
            <option value="JSS1">JSS1</option>
            <option value="JSS2">JSS2</option>
            <option value="JSS3">JSS3</option>
            <option value="SS1">SS1</option>
            <option value="SS2">SS2</option>
            <option value="SS3">SS3</option>
          </select>
        </div>
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
            ) : filteredAdmissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  No admissions found.
                </td>
              </tr>
            ) : (
              filteredAdmissions.map((a) => (
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
