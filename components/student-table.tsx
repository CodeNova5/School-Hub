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
import { MoreHorizontal, Eye, Edit, Calendar, ClipboardList, BookOpen, ArrowRightLeft, UserMinus, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
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
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No students found
          </div>
        ) : (
          students.map((student) => (
            <Card key={student.id} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Student Info */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="flex-shrink-0">
                      <AvatarImage src={student.photo_url} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getInitials(student.first_name, student.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{student.email}</p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(student.status)} className="flex-shrink-0">
                    {student.status}
                  </Badge>
                </div>

                {/* Student ID and Department */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Student ID</p>
                    <p className="font-mono font-medium">{student.student_id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Department</p>
                    <p className="font-medium">{student.department || 'N/A'}</p>
                  </div>
                </div>

                {/* Attendance */}
                <div className="mb-4">
                  <p className="text-gray-500 text-xs mb-2">Attendance</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${student.average_attendance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium min-w-[40px]">
                      {student.average_attendance}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <MoreHorizontal className="h-4 w-4 mr-2" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
      }
