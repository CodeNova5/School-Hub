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
      case 'suspended':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Student ID</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Parent Contact</TableHead>
            <TableHead>Attendance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
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
                  <div className="text-sm">
                    <p className="font-medium">{student.parent_name}</p>
                    <p className="text-gray-500">{student.parent_email}</p>
                    <p className="text-gray-500">{student.parent_phone}</p>
                  </div>
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
  );
}