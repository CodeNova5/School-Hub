<div align="center">
  <h1>🎓 School Hub (School Deck)</h1>
  <p><strong>A modern multi-portal school management platform built with Next.js + Supabase.</strong></p>
  <p>
    Student • Parent • Teacher • Admin • Super Admin
  </p>
</div>

---

## ✨ Overview

School Hub is a full-featured education management system designed for multi-tenant schools.  
It provides role-based dashboards, academic workflows, communication tools, finance support, and AI-assisted school operations.

## 🚀 Core Features

- **Multi-portal experience** for:
  - Students
  - Parents
  - Teachers
  - School admins
  - Super admins
- **Academics & classroom workflows**
  - Assignments and submissions
  - Results and publication
  - Timetables and periods
  - Attendance tracking
- **Admissions & school website support**
- **Notifications & messaging**
  - In-app notifications
  - Firebase push notifications
  - Email delivery via Resend
- **Finance module foundation**
- **AI Assistant** for natural-language school data queries
- **JAMB/CBT tools** and bulk import utilities

## 🧱 Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling/UI:** Tailwind CSS, Radix UI, shadcn/ui patterns
- **Backend/Data:** Supabase (Auth, Postgres, RLS, RPC)
- **Integrations:** Firebase Admin, Resend, Groq, Paystack, reCAPTCHA

## 📁 Project Structure

```text
app/                 # Next.js app routes (admin, teacher, student, parent, api, etc.)
components/          # Reusable UI and feature components
lib/                 # Shared business logic, API helpers, integrations
supabase/migrations/ # Core SQL schema and feature migrations
migrations/          # Additional SQL scripts/utilities
public/              # Static assets
```

## ⚙️ Getting Started

### 1) Prerequisites

- Node.js 18+ (Node.js 20 recommended)
- npm
- Supabase project

### 2) Install dependencies

```bash
npm ci
```

### 3) Configure environment variables

Create a `.env.local` file in the project root.

#### Required (core app)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Common optional integrations

```env
# AI assistant
GROQ_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=

# Push notifications (JSON string)
FIREBASE_SERVICE_ACCOUNT_KEY=

# Payments / Security
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
```

### 4) Run the app

```bash
npm run dev
```

Open: `http://localhost:3000`

## 🗄️ Database Setup

- Start with: `supabase/migrations/00_COMPLETE_DATABASE_SETUP.sql`
- Apply subsequent migrations in `supabase/migrations/` in order.
- Additional utility SQL scripts are available in `/migrations` and root `*.sql` files.

## 🧪 Scripts

```bash
npm run dev         # Start dev server
npm run lint        # Lint project
npm run typecheck   # TypeScript check
npm run build       # Production build
npm run start       # Start production server
npm run jamb:import # Import JAMB questions
```

## 📚 Useful Documentation in this Repo

- `AI_ASSISTANT_QUICK_START.md`
- `PARENT_PORTAL_GUIDE.md`
- `TIMETABLE_AUTO_GENERATION_GUIDE.md`
- `RESULTS_PUBLICATION_GUIDE.md`
- `FIREBASE_NOTIFICATIONS_QUICK_START.md`
- `FIREBASE_ADMIN_COMPLETE_CHECKLIST.md`
- `UNIFIED_FILE_UPLOAD_API.md`

## 🤝 Contributing

1. Create a feature branch.
2. Make focused changes.
3. Run lint/typecheck/build as needed.
4. Open a PR with clear context.

---

If you’d like, I can also generate:
- a **minimal README** version for external/public display, and
- a **developer README** split with deeper setup for contributors.
