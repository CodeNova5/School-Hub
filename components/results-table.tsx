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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead className="text-center">Welcome Test</TableHead>
              <TableHead className="text-center">Mid-Term</TableHead>
              <TableHead className="text-center">Vetting</TableHead>
              <TableHead className="text-center">Exam</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Grade</TableHead>
              <TableHead className="text-center">Position</TableHead>
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
                  <TableCell className="font-medium">{result.subject_name}</TableCell>
                  <TableCell className="text-center">{result.welcome_test}</TableCell>
                  <TableCell className="text-center">{result.mid_term_test}</TableCell>
                  <TableCell className="text-center">{result.vetting}</TableCell>
                  <TableCell className="text-center">{result.exam}</TableCell>
                  <TableCell className="text-center font-bold">{result.total}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${getGradeColor(String(result.grade || ''))}`}>
                      {result.grade}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {result.class_position ? getPositionDisplay(result.class_position) : <span className="text-gray-400">—</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Subjects</p>
            <p className="text-2xl font-bold">{results.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Average Score</p>
            <p className="text-2xl font-bold">{calculateTotalGPA()}%</p>
          </div>
          {classPosition && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Class Position</p>
              <div className="text-2xl font-bold mt-1">{getPositionDisplay(classPosition)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
