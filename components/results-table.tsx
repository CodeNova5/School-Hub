"use client";

import { Result } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getGradeColor } from '@/lib/student-utils';
import { Key } from 'react';
import { Medal } from 'lucide-react';

interface ResultsTableProps {
  results: Result[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const calculateTotalGPA = () => {
    if (results.length === 0) return 0;
    const totalScore = results.reduce((sum, r) => sum + r.total, 0);
    const maxScore = results.length * 100;
    return ((totalScore / maxScore) * 100).toFixed(2);
  };

  const getPositionDisplay = (position: number | null | undefined) => {
    if (!position) return null;

    if (position === 1) {
      return (
        <div className="flex items-center justify-center gap-1">
          <Medal className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          <span className="font-bold text-yellow-600">1st</span>
        </div>
      );
    }
    if (position === 2) {
      return (
        <div className="flex items-center justify-center gap-1">
          <Medal className="h-5 w-5 text-gray-400 fill-gray-400" />
          <span className="font-bold text-gray-600">2nd</span>
        </div>
      );
    }
    if (position === 3) {
      return (
        <div className="flex items-center justify-center gap-1">
          <Medal className="h-5 w-5 text-amber-600 fill-amber-600" />
          <span className="font-bold text-amber-700">3rd</span>
        </div>
      );
    }
    return <span className="font-semibold text-gray-700">{position}th</span>;
  };

  // Get the class position from the first result (all results for a student have the same position)
  const classPosition = results.length > 0 ? results[0].class_position : null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs md:text-sm">Subject</TableHead>
              <TableHead className="text-center text-xs md:text-sm whitespace-nowrap">Welcome Test</TableHead>
              <TableHead className="text-center text-xs md:text-sm whitespace-nowrap">Mid-Term</TableHead>
              <TableHead className="text-center text-xs md:text-sm whitespace-nowrap">Vetting</TableHead>
              <TableHead className="text-center text-xs md:text-sm whitespace-nowrap">Exam</TableHead>
              <TableHead className="text-center text-xs md:text-sm whitespace-nowrap">Total</TableHead>
              <TableHead className="text-center text-xs md:text-sm whitespace-nowrap">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No results available for selected term
                </TableCell>
              </TableRow>
            ) : (
              results.map((result: Result, index: Key | null | undefined) => (
                <TableRow key={index}>
                  <TableCell className="font-medium text-xs md:text-sm">{result.subject_name}</TableCell>
                  <TableCell className="text-center text-xs md:text-sm">{result.welcome_test}</TableCell>
                  <TableCell className="text-center text-xs md:text-sm">{result.mid_term_test}</TableCell>
                  <TableCell className="text-center text-xs md:text-sm">{result.vetting}</TableCell>
                  <TableCell className="text-center text-xs md:text-sm">{result.exam}</TableCell>
                  <TableCell className="text-center font-bold text-xs md:text-sm">{result.total}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold text-xs md:text-sm ${getGradeColor(String(result.grade || ''))}`}>
                      {result.grade}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="p-3 md:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs md:text-sm text-gray-600">Total Subjects</p>
            <p className="text-xl md:text-2xl font-bold">{results.length}</p>
          </div>
          <div className="p-3 md:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs md:text-sm text-gray-600">Average Score</p>
            <p className="text-xl md:text-2xl font-bold">{calculateTotalGPA()}%</p>
          </div>
          {classPosition && (
            <div className="p-3 md:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <p className="text-xs md:text-sm text-blue-600 font-medium">Class Position</p>
              <div className="text-xl md:text-2xl font-bold mt-1">{getPositionDisplay(classPosition)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
