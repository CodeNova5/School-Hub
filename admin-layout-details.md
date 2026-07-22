# School Management Site (Admin) - Layout & Design Details

## 1. Site Overview
- **Name**: Prism
- **Tagline**: Multi-Tenant Platform
- **Description**: Comprehensive school management system for school groups, districts, and education organizations.
- **Tech Stack**: Next.js, Tailwind CSS, Shadcn UI, Supabase (Database & Auth).
- **Target Users**: Admins (Super Admin, Sub-Admins with granular permissions), Teachers, Students, Parents.

## 2. Admin Dashboard Layout
The admin portal follows a consistent layout pattern across all pages.

### 2.1 Layout Structure
- **Sidebar**: Fixed left sidebar (collapsible).
  - **Expanded**: 64px width (`md:w-64`).
  - **Collapsed**: 80px width (`md:w-20`).
  - **Mobile**: Slide-in drawer with overlay.
- **Header**: Sticky top header.
  - Contains: Mobile menu toggle, App Name/Logo.
  - **Desktop**: Not fixed, flows with content (based on `components/app-header.tsx`).
  - **Mobile**: Fixed top bar.
- **Main Content**: Right of the sidebar, scrollable area.
  - **Padding**: Responsive padding (`p-4 sm:p-6 md:p-8`).
  - **Background**: Light gray (`bg-gray-50`).

### 2.2 Design System & Styling
- **Framework**: Tailwind CSS with Shadcn UI components.
- **Colors**:
  - Primary: Blue (`#2563eb`, `blue-600`).
  - Secondary: Emerald (`#059669`, `emerald-600`).
  - Accent: Violet (`#7c3aed`, `violet-600`).
  - Gradients: Often used for headers and buttons (e.g., `from-blue-600 to-indigo-600`).
- **Typography**:
  - Headings: `text-2xl font-bold tracking-tight text-slate-900`.
  - Subheadings: `text-sm text-slate-500`.
  - Labels: `text-[11px] font-semibold uppercase tracking-widest text-slate-400`.
- **Components**: Cards, Buttons, Dialogs, Tables, Badges, Avatars, Skeletons.

## 3. Admin Navigation (Sidebar Items)
The sidebar organizes features into logical groups. Visibility is controlled by `AdminPermission`.

### 3.1 Core Modules
- **Dashboard** (`/admin`): Overview, Stats, Charts, Recent Activities.
- **AI Assistant** (`/admin/ai-assistant`): AI-powered tools.
- **Sessions & Terms** (`/admin/sessions`): Academic calendar management.
- **Classes** (`/admin/classes`): Class list and details.
- **Subjects** (`/admin/subjects`): Subject catalog.
- **Periods** (`/admin/periods`): Daily schedule slots.
- **Timetable** (`/admin/timetable`): Class scheduling.

### 3.2 People Management
- **Students** (`/admin/students`): Student records, enrollment.
- **Families** (`/admin/families`): Family grouping.
- **Parents & Guardians** (`/admin/parents`): Parent records.
- **Teachers** (`/admin/teachers`): Staff records.
- **Admin Management** (`/admin/admin-users`): Sub-admin creation and roles.

### 3.3 Operations
- **Attendance** (`/admin/attendance`): Manual and QR-based attendance.
- **Reports** (`/admin/reports`): Report cards and grading.
- **Promotions** (`/admin/promotions`): Class promotion logic.
- **History** (`/admin/history`): Class history tracking.
- **Admissions** (`/admin/admissions`): Application processing.
- **Alumni** (`/admin/alumni`): Alumni records.

### 3.4 Finance & Assets
- **Finance** (`/admin/finance`): Billing, Payments, Receipts.
- **Payroll** (`/admin/payroll`): Staff salary management.
- **Inventory** (`/admin/inventory`): Stock and asset management.

### 3.5 System & Config
- **Notifications** (`/admin/notifications`): Messaging (Push, WhatsApp).
- **Calendar** (`/admin/calendar`): School events.
- **School Structure** (`/admin/school-config`): Levels, Departments, Streams.
- **Settings** (`/admin/settings`): General school config.
- **Subscription** (`/admin/subscription`): Plan management.
- **Audit Trail** (`/admin/audit-logs`): System logs.

### 3.6 Advanced Features
- **JAMB CBT Access** (`/admin/jamb`): Exam prep tools.
- **Question Bank** (`/admin/question-bank`): Exam question management.
- **Website Builder** (`/admin/website-builder`): Public site CMS.

## 4. Page Layout Patterns
Most pages follow a consistent structure to ensure predictability.

### 4.1 List View (e.g., Students, Teachers)
- **Header**:
  - Title + Subtitle (Left).
  - Action Buttons (Right): Primary action (e.g., "Add Student"), Secondary action (e.g., "Export").
- **Stats Bar**: Grid of 3-4 StatCards summarizing the list (e.g., Total, Active, Inactive).
- **Filter/Search Bar**: Search input + Dropdowns (Status, Class, Department).
- **Data Table**: Sortable, paginated table with row actions.

### 4.2 Detail View (e.g., Student Profile, Teacher Profile)
- **Back Button**: To return to list.
- **Header Section**: Avatar, Name, ID, Status Badge, Key Actions (Edit, Delete).
- **Tabs**: Overview, Results, Attendance, Finance, etc.
- **Content Area**: Detailed information cards or data grids.

### 4.3 Dashboard (`/admin`)
- **Top Bar**: Subscription/Limit banners (if applicable).
- **Header**: Welcome message, Quick Action buttons (Notifications, Manage Students, View Admissions).
- **Stats Grid**: Key metrics (Students, Teachers, Attendance Rate).
- **Charts Section**: Enrollment Trends, Class Distribution, Performance.
- **Activity Feed**: Recent events (New students, Admissions, Holidays).
- **Quick Actions**: Common tasks.
- **Key Metrics Tabs**: Detailed breakdown of system status.

## 5. Key UI Components
- **Card**: White background, rounded corners (`rounded-2xl`), subtle border/shadow.
- **Button**: Rounded (`rounded-xl`), variations (Primary, Outline, Ghost).
- **Input**: Rounded (`rounded-xl`), clean borders, focus rings.
- **Dialog**: Modal windows for forms (e.g., Add Teacher).
- **Table**: Clean rows, hover states, responsive.
- **Badge**: Status indicators (Active, Pending, etc.).
- **Avatar**: User photos or initials fallback.
- **Skeleton**: Loading states for better UX.

## 6. Data Models (Core Entities)
- **School**: Multi-tenant root entity.
- **Student**: Personal info, enrollment, class assignment.
- **Teacher**: Staff info, specialization, assigned classes.
- **Class**: Group of students, assigned teacher.
- **Subject**: Academic course, linked to classes.
- **Result**: Student grades per subject/term.
- **FinanceBill**: Student fees.
- **InventoryItem**: School assets.
- **Event**: School calendar events.
