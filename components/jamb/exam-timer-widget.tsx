"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export default function ExamTimerWidget({ time, isWarning, isCritical, subject }: { time: string; isWarning: boolean; isCritical: boolean; subject?: string; }) {
  const base = "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow-sm";
  const cls = isCritical ? "bg-red-600 text-white" : isWarning ? "bg-amber-500 text-white" : "bg-blue-600 text-white";
  return (
    <div className="hidden lg:block">
      <div className="sticky top-6">
        <div className={`${base} ${cls}`}>
          <Clock className="h-4 w-4" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs opacity-90">{subject ? `${subject}` : "Exam Time"}</span>
            <span className="text-lg font-bold tracking-tight">{time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
