import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/models/Admission";

export default async function AdminDashboard() {
  await dbConnect();

  const admissions = await Admission.find().sort({ createdAt: -1 }).lean();

  const total = admissions.length;
  const pending = admissions.filter((a) => a.status === "pending").length;
  const approved = admissions.filter((a) => a.status === "approved").length;
  const rejected = admissions.filter((a) => a.status === "rejected").length;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-700">
        🏫 Admin Dashboard
      </h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-blue-100 p-5 rounded-xl shadow text-center">
          <p className="text-sm text-gray-500">Total Applications</p>
          <h2 className="text-2xl font-semibold text-blue-700">{total}</h2>
        </div>

        <div className="bg-yellow-100 p-5 rounded-xl shadow text-center">
          <p className="text-sm text-gray-500">Pending</p>
          <h2 className="text-2xl font-semibold text-yellow-700">{pending}</h2>
        </div>

        <div className="bg-green-100 p-5 rounded-xl shadow text-center">
          <p className="text-sm text-gray-500">Approved</p>
          <h2 className="text-2xl font-semibold text-green-700">{approved}</h2>
        </div>

        <div className="bg-red-100 p-5 rounded-xl shadow text-center">
          <p className="text-sm text-gray-500">Rejected</p>
          <h2 className="text-2xl font-semibold text-red-700">{rejected}</h2>
        </div>
      </div>

      {/* Admissions Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm border-gray-300 rounded-lg">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Student Name</th>
              <th className="p-3">Class</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {admissions.map((app: any) => (
              <tr key={app._id} className="border-t">
                <td className="p-3">
                  {app.firstName} {app.lastName}
                </td>
                <td className="p-3">{app.classApplyingFor}</td>
                <td className="p-3">
                  {app.parentFirstName} {app.parentLastName}
                </td>
                <td className="p-3">{app.parentEmail}</td>
                <td className="p-3 capitalize">{app.status}</td>
                <td className="p-3">
                  {new Date(app.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {admissions.length === 0 && (
          <p className="text-center py-8 text-gray-500">
            No admissions yet.
          </p>
        )}
      </div>
    </div>
  );
}
