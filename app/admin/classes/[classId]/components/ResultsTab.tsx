"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface ResultsTabProps {
  classId: string;
  className: string;
  students: any[];
  schoolId: string | null;
}

export function ResultsTab({ classId, className }: ResultsTabProps) {
  const router = useRouter();

  function handleGoToReports() {
    router.push(`/admin/reports?classId=${classId}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-indigo-50 border border-indigo-100 mb-5">
          <ExternalLink className="h-8 w-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          Results Moved to Report Cards
        </h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          View and manage all results for <strong>{className}</strong> on the
          dedicated Report Cards page with full filtering, exports, and
          cumulative views.
        </p>
        <Button
          onClick={handleGoToReports}
          size="lg"
          className="rounded-xl gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open Report Cards
        </Button>
      </CardContent>
    </Card>
  );
}
