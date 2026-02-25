"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  BookOpen,
  Award,
  LogIn,
  Zap,
  Shield,
  BarChart3,
  GraduationCap,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Portal {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  loginUrl: string;
  color: string;
  features: string[];
  badge?: string;
}

const portals: Portal[] = [
  {
    id: "student",
    name: "Student Portal",
    description: "Access your assignments, grades, attendance and academic progress",
    icon: BookOpen,
    loginUrl: "/student/login",
    color: "from-blue-600 to-blue-700",
    features: ["Track Assignments", "View Grades", "Check Attendance", "Class Timetable"],
  },
  {
    id: "parent",
    name: "Parent Portal",
    description: "Monitor your child's performance and stay updated on school activities",
    icon: Users,
    loginUrl: "/parent/login",
    color: "from-green-600 to-green-700",
    features: ["Child Progress", "Attendance Report", "Fee Status", "Communications"],
  },
  {
    id: "teacher",
    name: "Teacher Portal",
    description: "Manage classes, create assignments, and track student performance",
    icon: Award,
    loginUrl: "/teacher/login",
    color: "from-purple-600 to-purple-700",
    features: ["Class Management", "Assignments", "Grade & Attendance", "Resources"],
  },
  {
    id: "admin",
    name: "Admin Portal",
    description: "Full control over school management, users, and settings",
    icon: Shield,
    loginUrl: "/admin/login",
    color: "from-red-600 to-red-700",
    features: ["User Management", "Analytics", "Settings", "Reports"],
    badge: "Admin",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-white">School Hub</h1>
                <p className="text-xs text-slate-400">Education Management System</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          {/* Hero section */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-white">
              Welcome to School Hub
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Choose your portal to access your personalized dashboard. We've tailored each experience for students, parents, teachers, and administrators.
            </p>
          </div>

          {/* Portal cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <Link href={portal.loginUrl} key={portal.id}>
                  <Card className="relative h-full bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer group overflow-hidden">
                    {/* Gradient background on hover */}
                    <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${portal.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>

                    <CardHeader className="relative pb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-3 bg-gradient-to-br ${portal.color} rounded-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        {portal.badge && (
                          <Badge className="bg-slate-700 text-slate-200 text-xs">
                            {portal.badge}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-white text-lg">{portal.name}</CardTitle>
                      <CardDescription className="text-slate-400 text-sm">
                        {portal.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="relative">
                      <div className="space-y-3">
                        {/* Features list */}
                        <div className="space-y-2">
                          {portal.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                              <div className="w-1.5 h-1.5 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full"></div>
                              {feature}
                            </div>
                          ))}
                        </div>

                        {/* Login button */}
                        <button className="w-full mt-4 group/btn inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white rounded-lg transition-all duration-200 font-medium text-sm">
                          <LogIn className="w-4 h-4" />
                          Sign In
                          <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Info section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-slate-700/50">
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-block p-3 bg-blue-500/10 rounded-lg">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white">Fast & Responsive</h3>
              <p className="text-sm text-slate-400">
                Lightning-fast performance optimized for mobile and desktop devices
              </p>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <div className="inline-block p-3 bg-purple-500/10 rounded-lg">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white">Secure & Private</h3>
              <p className="text-sm text-slate-400">
                Enterprise-grade security to protect your data and privacy
              </p>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <div className="inline-block p-3 bg-green-500/10 rounded-lg">
                <BarChart3 className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-white">Insightful Analytics</h3>
              <p className="text-sm text-slate-400">
                Comprehensive reports to monitor progress and performance
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-700/50 backdrop-blur-sm bg-slate-900/30 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400">
                © 2026 School Hub. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Support
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
