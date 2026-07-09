/**
 * admin-permissions.ts
 * --------------------
 * Central registry of all available admin permissions.
 * Each permission follows the namespace:action pattern (e.g. "inventory:read").
 *
 * The "*" (wildcard) permission means full access — assigned to primary admins.
 */

import type { AdminPermissionNamespace, AdminPermission } from "@/lib/types";

// ── Permission Definitions ────────────────────────────────────────────────

export interface PermissionDef {
  permission: AdminPermission;
  label: string;
  description: string;
}

export interface PermissionGroup {
  namespace: AdminPermissionNamespace;
  label: string;
  icon: string;
  description: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    namespace: "structure",
    label: "School Structure",
    icon: "🏗️",
    description: "Education levels, class levels, streams, departments, religions",
    permissions: [
      { permission: "structure:read", label: "View", description: "View school structure settings" },
      { permission: "structure:write", label: "Manage", description: "Create, edit, delete structure items" },
    ],
  },
  {
    namespace: "subjects",
    label: "Subjects",
    icon: "📚",
    description: "Subject catalog, presets, class assignments",
    permissions: [
      { permission: "subjects:read", label: "View", description: "View subjects and presets" },
      { permission: "subjects:write", label: "Manage", description: "Create, edit, delete subjects and apply to classes" },
    ],
  },
  {
    namespace: "students",
    label: "Students",
    icon: "👨‍🎓",
    description: "Student records, enrollment, profiles",
    permissions: [
      { permission: "students:read", label: "View", description: "View student profiles and records" },
      { permission: "students:write", label: "Manage", description: "Create, edit, delete student records" },
    ],
  },
  {
    namespace: "teachers",
    label: "Teachers",
    icon: "👩‍🏫",
    description: "Teacher records, profiles, assignments",
    permissions: [
      { permission: "teachers:read", label: "View", description: "View teacher profiles" },
      { permission: "teachers:write", label: "Manage", description: "Create, edit, delete teacher records" },
    ],
  },
  {
    namespace: "classes",
    label: "Classes",
    icon: "🏫",
    description: "Class management, groupings",
    permissions: [
      { permission: "classes:read", label: "View", description: "View classes" },
      { permission: "classes:write", label: "Manage", description: "Create, edit, delete classes" },
    ],
  },
  {
    namespace: "results",
    label: "Results",
    icon: "📊",
    description: "Result settings, report cards, grading",
    permissions: [
      { permission: "results:read", label: "View", description: "View results and report cards" },
      { permission: "results:write", label: "Manage", description: "Enter, edit, publish results" },
    ],
  },
  {
    namespace: "timetable",
    label: "Timetable",
    icon: "📅",
    description: "Period slots, timetable entries",
    permissions: [
      { permission: "timetable:read", label: "View", description: "View timetables" },
      { permission: "timetable:write", label: "Manage", description: "Create, edit timetable entries" },
    ],
  },
  {
    namespace: "inventory",
    label: "Inventory",
    icon: "📦",
    description: "Stock management, assets, transactions",
    permissions: [
      { permission: "inventory:read", label: "View", description: "View inventory items and stock levels" },
      { permission: "inventory:write", label: "Manage", description: "Add, edit, checkout inventory items" },
    ],
  },
  {
    namespace: "finance",
    label: "Finance",
    icon: "💰",
    description: "Billing, payments, invoices, receipts",
    permissions: [
      { permission: "finance:read", label: "View", description: "View bills, payments, and reports" },
      { permission: "finance:write", label: "Manage", description: "Create bills, record payments, issue receipts" },
    ],
  },
  {
    namespace: "notifications",
    label: "Notifications",
    icon: "🔔",
    description: "Push notifications, WhatsApp messages",
    permissions: [
      { permission: "notifications:write", label: "Send", description: "Send notifications and WhatsApp messages" },
    ],
  },
  {
    namespace: "website",
    label: "Website Builder",
    icon: "🌐",
    description: "Public school website content management",
    permissions: [
      { permission: "website:read", label: "View", description: "View website builder content" },
      { permission: "website:write", label: "Manage", description: "Edit and publish website content" },
    ],
  },
  {
    namespace: "admissions",
    label: "Admissions",
    icon: "📋",
    description: "Application management, enrollment processing",
    permissions: [
      { permission: "admissions:read", label: "View", description: "View applications and status" },
      { permission: "admissions:write", label: "Manage", description: "Process applications and enrollments" },
    ],
  },
  {
    namespace: "alumni",
    label: "Alumni",
    icon: "🎓",
    description: "Alumni records and engagement",
    permissions: [
      { permission: "alumni:read", label: "View", description: "View alumni records" },
      { permission: "alumni:write", label: "Manage", description: "Manage alumni records" },
    ],
  },
  {
    namespace: "question_bank",
    label: "Question Bank",
    icon: "❓",
    description: "Question banks, CBT exams, JAMB prep",
    permissions: [
      { permission: "question_bank:read", label: "View", description: "View question banks" },
      { permission: "question_bank:write", label: "Manage", description: "Create, edit questions and banks" },
    ],
  },
  {
    namespace: "live_classes",
    label: "Live Classes",
    icon: "🎥",
    description: "Live/virtual classroom management",
    permissions: [
      { permission: "live_classes:read", label: "View", description: "View live class schedules" },
      { permission: "live_classes:write", label: "Manage", description: "Create and manage live classes" },
    ],
  },
  {
    namespace: "lesson_notes",
    label: "Lesson Notes",
    icon: "📝",
    description: "Teacher lesson notes management",
    permissions: [
      { permission: "lesson_notes:read", label: "View", description: "View lesson notes" },
      { permission: "lesson_notes:write", label: "Manage", description: "Create, edit lesson notes" },
    ],
  },
  {
    namespace: "audit",
    label: "Audit Trail",
    icon: "📜",
    description: "Admin activity audit logs",
    permissions: [
      { permission: "audit:read", label: "View", description: "View audit trail logs" },
    ],
  },
  {
    namespace: "settings",
    label: "School Settings",
    icon: "⚙️",
    description: "General school configuration",
    permissions: [
      { permission: "settings:read", label: "View", description: "View school settings" },
      { permission: "settings:write", label: "Manage", description: "Edit school settings" },
    ],
  },
  {
    namespace: "user_management",
    label: "Admin Management",
    icon: "🔐",
    description: "Create and manage other admin users and roles",
    permissions: [
      { permission: "user_management:write", label: "Manage", description: "Create, edit, remove admin roles and assignments" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/** Get all permission strings as a flat array */
export function getAllPermissions(): AdminPermission[] {
  return PERMISSION_GROUPS.flatMap((g) =>
    g.permissions.map((p) => p.permission)
  );
}

/** Get a human-readable label for a permission string */
export function getPermissionLabel(permission: AdminPermission): string {
  for (const group of PERMISSION_GROUPS) {
    for (const p of group.permissions) {
      if (p.permission === permission) return `${group.label}: ${p.label}`;
    }
  }
  return permission;
}

/** Get the group for a given permission string */
export function getGroupForPermission(
  permission: AdminPermission
): PermissionGroup | undefined {
  return PERMISSION_GROUPS.find((g) =>
    g.permissions.some((p) => p.permission === permission)
  );
}

/** Pre-built role templates — combinations of permissions for common roles */
export const ROLE_TEMPLATES: Array<{
  name: string;
  description: string;
  permissions: AdminPermission[];
}> = [
  {
    name: "Stock Manager",
    description: "Manage inventory, assets, and stock transactions",
    permissions: ["inventory:read", "inventory:write"],
  },
  {
    name: "Finance Officer",
    description: "Manage billing, payments, invoices, and receipts",
    permissions: ["finance:read", "finance:write"],
  },
  {
    name: "Website Manager",
    description: "Manage the public school website content",
    permissions: ["website:read", "website:write"],
  },
  {
    name: "Academic Manager",
    description: "Manage students, teachers, classes, subjects, and results",
    permissions: [
      "students:read", "students:write",
      "teachers:read", "teachers:write",
      "classes:read", "classes:write",
      "subjects:read", "subjects:write",
      "results:read", "results:write",
      "structure:read",
    ],
  },
  {
    name: "Exam Officer",
    description: "Manage results, question banks, and assessments",
    permissions: [
      "results:read", "results:write",
      "question_bank:read", "question_bank:write",
    ],
  },
  {
    name: "Read Only",
    description: "View-only access to all school data",
    permissions: [
      "structure:read", "subjects:read", "students:read",
      "teachers:read", "classes:read", "results:read",
      "timetable:read", "inventory:read", "finance:read",
      "website:read", "admissions:read", "alumni:read",
      "settings:read", "audit:read", "question_bank:read",
      "live_classes:read", "lesson_notes:read",
    ],
  },
  {
    name: "Admin Manager",
    description: "Manage other admin users and their roles",
    permissions: ["user_management:write"],
  },
];
