"use client";

import { Student } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Edit, BookOpen, ArrowRightLeft, UserMinus, AlertTriangle } from 'lucide-react';

interface StudentTableProps {
  students: Student[];
  onViewDetails: (student: Student) => void;
  onEditStudent?: (student: Student) => void;
  onManageSubjects?: (student: Student) => void;
  onTransferStudent?: (student: Student) => void;
  onRemoveStudent?: (student: Student) => void;
  onDeleteStudent?: (student: Student) => void;
}

export function StudentTable({
  students,
  onViewDetails,
  onEditStudent,
  onManageSubjects,
  onTransferStudent,
  onRemoveStudent,
  onDeleteStudent
}: StudentTableProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const actionsMenu = (student: Student) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onViewDetails(student)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        {onEditStudent && (
          <DropdownMenuItem onClick={() => onEditStudent(student)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Student
          </DropdownMenuItem>
        )}
        {onManageSubjects && (
          <DropdownMenuItem onClick={() => onManageSubjects(student)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Manage Subjects
          </DropdownMenuItem>
        )}
        {onTransferStudent && (
          <DropdownMenuItem onClick={() => onTransferStudent(student)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer Student
          </DropdownMenuItem>
        )}
        {onRemoveStudent && (
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => onRemoveStudent(student)}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Remove from Class
          </DropdownMenuItem>
        )}
        {onDeleteStudent && (
          <DropdownMenuItem
            className="text-red-700 focus:text-red-700"
            onClick={() => onDeleteStudent(student)}
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-red-700" />
            Delete Completely
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <div className="hidden sm:block rounded-md border">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.photo_url} />
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {getInitials(student.first_name, student.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{student.student_id}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{student.department || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${student.average_attendance}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium min-w-[40px]">
                          {student.average_attendance}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(student.status)}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{actionsMenu(student)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="sm:hidden">
        {students.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            No students found
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((student) => (
              <div key={student.id} className="rounded-xl border px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={student.photo_url} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getInitials(student.first_name, student.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{student.email}</p>
                    </div>
                  </div>
                  <div className="ml-2">{actionsMenu(student)}</div>
                </div>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between text-xs uppercase tracking-wide text-gray-500">
                    <span>Student ID</span>
                    <span className="font-mono">{student.student_id}</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase tracking-wide text-gray-500">
                    <span>Department</span>
                    <span>{student.department || 'N/A'}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="w-full max-w-[140px]">
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${student.average_attendance}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{student.average_attendance}%</span>
                </div>
                <div className="mt-3">
                  <Badge variant={getStatusVariant(student.status)}>
                    {student.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
