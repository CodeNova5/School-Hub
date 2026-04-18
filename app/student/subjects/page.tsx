"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
	BookOpen,
	GraduationCap,
	Loader2,
	Search,
	User,
	Filter,
	Layers,
} from "lucide-react";

type SubjectItem = {
	subjectClassId: string;
	subjectId: string;
	subjectName: string;
	subjectCode: string;
	teacherName: string;
	isOptional: boolean;
	category: "Required" | "Optional";
};

function getTeacherName(teacher: any): string {
	if (!teacher) return "Not assigned";
	return [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || "Not assigned";
}

export default function StudentSubjectsPage() {
	const [loading, setLoading] = useState(true);
	const [studentName, setStudentName] = useState("");
	const [className, setClassName] = useState("");
	const [subjects, setSubjects] = useState<SubjectItem[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [filter, setFilter] = useState<"all" | "required" | "optional">("all");
	const { schoolId, isLoading: schoolLoading } = useSchoolContext();

	useEffect(() => {
		if (!schoolLoading && schoolId) {
			loadSubjects();
		}
	}, [schoolId, schoolLoading]);

	async function loadSubjects() {
		if (!schoolId) return;

		try {
			setLoading(true);

			const user = await getCurrentUser();
			if (!user) {
				toast.error("Please log in to continue");
				return;
			}

			const { data: student, error: studentError } = await supabase
				.from("students")
				.select(
					`
						id,
						first_name,
						last_name,
						class_id,
						department_id,
						religion_id,
						classes (
							id,
							name
						)
					`,
				)
				.eq("user_id", user.id)
				.eq("school_id", schoolId)
				.single();

			if (studentError || !student) {
				toast.error("Student profile not found");
				return;
			}

			setStudentName(`${student.first_name} ${student.last_name}`);
			const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
			setClassName(classData?.name || "");

let nextSubjects: SubjectItem[] = [];

				// Get all subject classes for the student's class
				const { data: classSubjectClasses, error: classSubjectError } = await supabase
					.from("subject_classes")
					.select(
						`
							id,
							subject_id,
							subject_code,
							is_optional,
							department_id,
							religion_id,
							subjects!subject_classes_subject_id_fkey (
								id,
								name,
								subject_code
							),
							teachers (
								first_name,
								last_name
							)
						`,
					)
					.eq("class_id", student.class_id)
					.eq("school_id", schoolId);

				if (classSubjectError) {
					console.error("Error fetching subject classes:", classSubjectError);
				} else if (classSubjectClasses) {
					nextSubjects = classSubjectClasses
						.filter((row: any) => {
							// Skip optional subjects
							if (row.is_optional) return false;

							// If department_id is set, only include if student matches
							if (row.department_id && student.department_id !== row.department_id) {
								return false;
							}

							// If religion_id is set, only include if student matches
							if (row.religion_id && student.religion_id !== row.religion_id) {
								return false;
							}

							return true;
						})
						.map((row: any) => {
							const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
							const teacher = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;

							if (!subject) return null;

							return {
								subjectClassId: row.id,
								subjectId: subject.id,
								subjectName: subject.name || "Unnamed subject",
								subjectCode: row.subject_code || subject.subject_code || "N/A",
								teacherName: getTeacherName(teacher),
								isOptional: false,
								category: "Required",
							} as SubjectItem;
						})
						.filter(Boolean) as SubjectItem[];
			}



			const deduped = Array.from(
				new Map(nextSubjects.map((item) => [item.subjectClassId, item])).values(),
			).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

			setSubjects(deduped);

			if (deduped.length === 0) {
				toast.info("No subjects found for your profile");
			}
		} catch (error) {
			console.error("Error loading subjects:", error);
			toast.error("Failed to load subjects");
		} finally {
			setLoading(false);
		}
	}

	const filteredSubjects = useMemo(() => {
		return subjects.filter((subject) => {
			const matchesSearch =
				subject.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				subject.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
				subject.teacherName.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesFilter =
				filter === "all" ||
				(filter === "required" && !subject.isOptional) ||
				(filter === "optional" && subject.isOptional);

			return matchesSearch && matchesFilter;
		});
	}, [subjects, searchTerm, filter]);

	const stats = useMemo(() => {
		const required = subjects.filter((s) => !s.isOptional).length;
		const optional = subjects.filter((s) => s.isOptional).length;
		const teachers = new Set(subjects.map((s) => s.teacherName).filter((name) => name !== "Not assigned"));

		return {
			total: subjects.length,
			required,
			optional,
			teachers: teachers.size,
		};
	}, [subjects]);

	if (loading || schoolLoading) {
		return (
			<DashboardLayout role="student">
				<div className="flex items-center justify-center min-h-[60vh]">
					<div className="text-center">
						<Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
						<p className="text-gray-600">Loading your subjects...</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout role="student">
			<div className="space-y-4 sm:space-y-6">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Subjects</h1>
					<p className="text-sm sm:text-base text-gray-600 mt-1">
						Subjects assigned to {studentName || "you"} {className ? `in ${className}` : ""}
					</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
					<Card className="border-l-4 border-l-blue-500">
						<CardContent className="pt-4 sm:pt-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs sm:text-sm text-gray-600">Total Subjects</p>
									<p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
								</div>
								<BookOpen className="h-8 w-8 text-blue-600" />
							</div>
						</CardContent>
					</Card>

					<Card className="border-l-4 border-l-green-500">
						<CardContent className="pt-4 sm:pt-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs sm:text-sm text-gray-600">Required</p>
									<p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.required}</p>
								</div>
								<GraduationCap className="h-8 w-8 text-green-600" />
							</div>
						</CardContent>
					</Card>

					<Card className="border-l-4 border-l-amber-500">
						<CardContent className="pt-4 sm:pt-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs sm:text-sm text-gray-600">Optional</p>
									<p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.optional}</p>
								</div>
								<Layers className="h-8 w-8 text-amber-600" />
							</div>
						</CardContent>
					</Card>

					<Card className="border-l-4 border-l-purple-500">
						<CardContent className="pt-4 sm:pt-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-xs sm:text-sm text-gray-600">Teachers</p>
									<p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.teachers}</p>
								</div>
								<User className="h-8 w-8 text-purple-600" />
							</div>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<div className="relative md:col-span-2">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
								<Input
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									placeholder="Search by subject, code or teacher"
									className="pl-10"
								/>
							</div>
							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									variant={filter === "all" ? "default" : "outline"}
									onClick={() => setFilter("all")}
									className="flex-1"
								>
									<Filter className="h-4 w-4 mr-1" />
									All
								</Button>
								<Button
									type="button"
									size="sm"
									variant={filter === "required" ? "default" : "outline"}
									onClick={() => setFilter("required")}
									className="flex-1"
								>
									Required
								</Button>
								<Button
									type="button"
									size="sm"
									variant={filter === "optional" ? "default" : "outline"}
									onClick={() => setFilter("optional")}
									className="flex-1"
								>
									Optional
								</Button>
							</div>
						</div>
					</CardHeader>

					<CardContent className="p-3 sm:p-6">
						{filteredSubjects.length === 0 ? (
							<div className="text-center py-10">
								<BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
								<p className="text-gray-600 font-medium">No subjects found</p>
								<p className="text-gray-500 text-sm mt-1">
									Try adjusting your search or filter options.
								</p>
							</div>
						) : (
							<>
								<div className="space-y-3 md:hidden">
									{filteredSubjects.map((subject) => (
										<div key={subject.subjectClassId} className="border rounded-lg p-4 bg-white">
											<div className="flex items-start justify-between gap-3">
												<div>
													<h3 className="font-semibold text-gray-900 text-base">{subject.subjectName}</h3>
													<p className="text-sm text-gray-500 mt-0.5">{subject.subjectCode}</p>
												</div>
												<Badge
													variant={subject.isOptional ? "secondary" : "default"}
													className={subject.isOptional ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}
												>
													{subject.category}
												</Badge>
											</div>
											<div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
												<User className="h-4 w-4" />
												<span>{subject.teacherName}</span>
											</div>
										</div>
									))}
								</div>

								<div className="hidden md:block overflow-x-auto rounded-lg border">
									<table className="w-full border-collapse bg-white">
										<thead>
											<tr className="bg-gray-100">
												<th className="text-left border-b p-3 text-sm font-semibold text-gray-700">Subject</th>
												<th className="text-left border-b p-3 text-sm font-semibold text-gray-700">Code</th>
												<th className="text-left border-b p-3 text-sm font-semibold text-gray-700">Category</th>
												<th className="text-left border-b p-3 text-sm font-semibold text-gray-700">Teacher</th>
											</tr>
										</thead>
										<tbody>
											{filteredSubjects.map((subject) => (
												<tr key={subject.subjectClassId} className="hover:bg-gray-50">
													<td className="border-b p-3 text-sm font-medium text-gray-900">{subject.subjectName}</td>
													<td className="border-b p-3 text-sm text-gray-600">{subject.subjectCode}</td>
													<td className="border-b p-3 text-sm">
														<Badge
															variant={subject.isOptional ? "secondary" : "default"}
															className={subject.isOptional ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}
														>
															{subject.category}
														</Badge>
													</td>
													<td className="border-b p-3 text-sm text-gray-700">{subject.teacherName}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</DashboardLayout>
	);
}
