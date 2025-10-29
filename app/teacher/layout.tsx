
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-blue-700 text-white p-5">
        <h2 className="text-xl font-bold mb-6">Teacher Portal</h2>
        <ul className="space-y-3">
          <li><a href="/teacher/dashboard" className="hover:text-yellow-300">Dashboard</a></li>
          <li><a href="/teacher/students" className="hover:text-yellow-300">My Students</a></li>
          <li><a href="/teacher/announcements" className="hover:text-yellow-300">Announcements</a></li>
          <li><a href="/teacher/settings" className="hover:text-yellow-300">Settings</a></li>
        </ul>
      </aside>
      <main className="flex-1 bg-gray-50 text-black p-8">{children}</main>
    </div>
  );
}
