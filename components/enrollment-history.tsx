"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  ArrowRightLeft, 
  TrendingUp, 
  XCircle,
  Clock,
  GraduationCap,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EnrollmentRecord {
  enrollment_id: string;
  class_name: string;
  session_name: string;
  term_name: string;
  status: string;
  enrollment_type: string;
  enrolled_at: string;
  completed_at: string | null;
}

interface EnrollmentHistoryProps {
  studentId: string;
  className?: string;
}

export function EnrollmentHistory({ studentId, className }: EnrollmentHistoryProps) {
  const [history, setHistory] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [studentId]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc("get_enrollment_history", { p_student_id: studentId });

      if (!error && data) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Error fetching enrollment history:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Enrollment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Enrollment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No enrollment history available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Enrollment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>

          {/* Timeline Items */}
          <div className="space-y-6">
            {history.map((record, index) => (
              <EnrollmentTimelineItem 
                key={record.enrollment_id}
                record={record}
                isFirst={index === 0}
                isLast={index === history.length - 1}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnrollmentTimelineItem({ 
  record, 
  isFirst,
  isLast 
}: { 
  record: EnrollmentRecord; 
  isFirst: boolean;
  isLast: boolean;
}) {
  const getStatusIcon = () => {
    switch (record.status) {
      case "active":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "completed":
        return <CheckCircle className="h-6 w-6 text-blue-600" />;
      case "transferred":
        return <ArrowRightLeft className="h-6 w-6 text-orange-600" />;
      case "dropped":
        return <XCircle className="h-6 w-6 text-red-600" />;
      case "graduated":
        return <GraduationCap className="h-6 w-6 text-purple-600" />;
      default:
        return <Clock className="h-6 w-6 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (record.status) {
      case "active": return "bg-green-100 border-green-300 text-green-800";
      case "completed": return "bg-blue-100 border-blue-300 text-blue-800";
      case "transferred": return "bg-orange-100 border-orange-300 text-orange-800";
      case "dropped": return "bg-red-100 border-red-300 text-red-800";
      case "graduated": return "bg-purple-100 border-purple-300 text-purple-800";
      default: return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  const getTypeIcon = () => {
    switch (record.enrollment_type) {
      case "promoted":
        return <TrendingUp className="h-3 w-3" />;
      case "transferred":
        return <ArrowRightLeft className="h-3 w-3" />;
      case "new":
        return <GraduationCap className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="relative flex gap-4">
      {/* Timeline Node */}
      <div className={cn(
        "relative z-10 flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full border-4 border-background",
        isFirst ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-card"
      )}>
        {getStatusIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className={cn(
          "border rounded-lg p-4 shadow-sm transition-all hover:shadow-md",
          isFirst && "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
        )}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {record.class_name}
                {isFirst && (
                  <Badge variant="default" className="bg-blue-600">
                    Current
                  </Badge>
                )}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{record.session_name} - {record.term_name}</span>
              </div>
            </div>

            <div className="text-right">
              <Badge 
                variant="outline" 
                className={cn("text-xs font-medium border", getStatusColor())}
              >
                {record.status}
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {getTypeIcon()}
              <span className="capitalize">{record.enrollment_type}</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Enrolled:</span> {formatDate(record.enrolled_at)}
              </div>
              {record.completed_at && (
                <div>
                  <span className="font-medium">Completed:</span> {formatDate(record.completed_at)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for modals/sidebars
export function EnrollmentHistoryCompact({ studentId }: { studentId: string }) {
  const [history, setHistory] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [studentId]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc("get_enrollment_history", { p_student_id: studentId });

      if (!error && data) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Error fetching enrollment history:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading history...</div>;
  }

  if (history.length === 0) {
    return <div className="text-sm text-muted-foreground">No enrollment history</div>;
  }

  return (
    <div className="space-y-2">
      {history.map((record, index) => (
        <div 
          key={record.enrollment_id}
          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
        >
          <div className="flex items-center gap-2">
            <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
              {record.class_name}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {record.session_name}
            </span>
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {record.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
