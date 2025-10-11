export default function TeacherDashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4 text-blue-700">Welcome, Teacher 👩‍🏫</h1>
      <p className="text-gray-700">
        Here you can manage your class, view students, and track progress.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="font-semibold text-lg mb-2">My Class</h2>
          <p>View and manage your assigned students.</p>
        </div>
        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="font-semibold text-lg mb-2">Announcements</h2>
          <p>See updates from the school admin.</p>
        </div>
        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="font-semibold text-lg mb-2">Settings</h2>
          <p>Update your account information.</p>
        </div>
      </div>
    </div>
  );
}
