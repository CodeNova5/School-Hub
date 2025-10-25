"use client";

export default function TeacherDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Welcome back, Teacher 👋</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow-md p-4 rounded-xl">
          <h2 className="font-semibold text-lg">Total Students</h2>
          <p className="text-3xl font-bold mt-2">45</p>
        </div>
        <div className="bg-white shadow-md p-4 rounded-xl">
          <h2 className="font-semibold text-lg">Classes Assigned</h2>
          <p className="text-3xl font-bold mt-2">2</p>
        </div>
        <div className="bg-white shadow-md p-4 rounded-xl">
          <h2 className="font-semibold text-lg">Pending Tasks</h2>
          <p className="text-3xl font-bold mt-2">5</p>
        </div>
      </div>

      <div className="mt-6 bg-white p-4 rounded-xl shadow-sm">
        <h2 className="font-semibold mb-2">Recent Activities</h2>
        <ul className="list-disc ml-6 text-gray-700">
          <li>Marked attendance for Class 2B</li>
          <li>Uploaded Mathematics Assignment 3</li>
          <li>Reviewed Homework submissions</li>
        </ul>
      </div>
    </div>
  );
}
