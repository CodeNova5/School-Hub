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
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No results available for selected term
                </TableCell>
              </TableRow>
            ) : (
              results.map((result, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{result.subject}</TableCell>
                  <TableCell className="text-center">{result.welcome_test}</TableCell>
                  <TableCell className="text-center">{result.mid_term_test}</TableCell>
                  <TableCell className="text-center">{result.vetting}</TableCell>
                  <TableCell className="text-center">{result.exam}</TableCell>
                  <TableCell className="text-center font-bold">{result.total}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${getGradeColor(result.grade)}`}>
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
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-600">Total Subjects</p>
            <p className="text-2xl font-bold">{results.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Score</p>
            <p className="text-2xl font-bold">{calculateTotalGPA()}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
