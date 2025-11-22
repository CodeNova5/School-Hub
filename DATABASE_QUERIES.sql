-- =====================================================
-- COMPLETE DATABASE QUERIES FOR SCHOOL MANAGEMENT SYSTEM
-- =====================================================

-- =====================================================
-- 1. CLASSES QUERIES
-- =====================================================

-- Get all classes with statistics
SELECT
  c.id,
  c.name,
  c.level,
  c.capacity,
  c.room_number,
  c.department,
  c.stream,
  c.academic_year,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as student_count,
  COUNT(DISTINCT tc.teacher_id) as teacher_count,
  COUNT(DISTINCT sc.subject_id) as subject_count,
  t.first_name || ' ' || t.last_name as class_teacher_name
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
LEFT JOIN teacher_classes tc ON tc.class_id = c.id
LEFT JOIN subject_classes sc ON sc.class_id = c.id
LEFT JOIN teachers t ON t.id = c.class_teacher_id
GROUP BY c.id, c.name, c.level, c.capacity, c.room_number, c.department, c.stream, c.academic_year, t.first_name, t.last_name
ORDER BY c.level, c.name;

-- Get classes by education level
SELECT * FROM classes
WHERE level IN ('Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6')
ORDER BY level;

-- Get SSS classes by department
SELECT * FROM classes
WHERE level IN ('SSS 1', 'SSS 2', 'SSS 3')
AND department = 'Science'
ORDER BY level;

-- Get class capacity utilization
SELECT
  c.id,
  c.name,
  c.level,
  c.capacity,
  COUNT(s.id) FILTER (WHERE s.status = 'active') as enrolled,
  c.capacity - COUNT(s.id) FILTER (WHERE s.status = 'active') as available_spots,
  ROUND((COUNT(s.id) FILTER (WHERE s.status = 'active')::numeric / c.capacity) * 100, 2) as utilization_percentage
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
GROUP BY c.id, c.name, c.level, c.capacity
ORDER BY utilization_percentage DESC;

-- =====================================================
-- 2. SUBJECTS QUERIES
-- =====================================================

-- Get all subjects with assigned classes
SELECT
  s.id,
  s.name,
  s.education_level,
  s.department,
  s.religion,
  s.is_optional,
  COUNT(DISTINCT sc.class_id) as assigned_classes_count,
  STRING_AGG(DISTINCT c.name, ', ') as class_names
FROM subjects s
LEFT JOIN subject_classes sc ON sc.subject_id = s.id
LEFT JOIN classes c ON c.id = sc.class_id
GROUP BY s.id, s.name, s.education_level, s.department, s.religion, s.is_optional
ORDER BY s.education_level, s.name;

-- Get subjects for a specific class
SELECT
  s.id,
  s.name,
  s.education_level,
  s.department,
  s.religion,
  s.is_optional
FROM subjects s
INNER JOIN subject_classes sc ON sc.subject_id = s.id
WHERE sc.class_id = 'YOUR_CLASS_ID_HERE'
ORDER BY s.name;

-- Get subjects by education level and department
SELECT * FROM subjects
WHERE education_level = 'SSS'
AND department = 'Science'
ORDER BY name;

-- Get optional subjects
SELECT * FROM subjects
WHERE is_optional = true
ORDER BY education_level, name;

-- Get subjects by religion
SELECT * FROM subjects
WHERE religion = 'Christian'
ORDER BY education_level, name;

-- =====================================================
-- 3. STUDENTS QUERIES
-- =====================================================

-- Get all active students with class info
SELECT
  s.id,
  s.student_id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.gender,
  s.department,
  s.class_id,
  c.name as class_name,
  c.level as class_level,
  s.parent_name,
  s.parent_email,
  s.parent_phone,
  s.average_attendance,
  s.status,
  s.admission_date
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.status = 'active'
ORDER BY s.first_name, s.last_name;

-- Get students by class
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  s.email,
  s.average_attendance,
  s.status
FROM students s
WHERE s.class_id = 'YOUR_CLASS_ID_HERE'
AND s.status = 'active'
ORDER BY s.last_name, s.first_name;

-- Get student with full details including results and attendance
SELECT
  s.*,
  c.name as class_name,
  c.level as class_level,
  c.department as class_department
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.id = 'YOUR_STUDENT_ID_HERE';

-- Get students admitted in current month
SELECT
  COUNT(*) as new_students,
  s.class_id,
  c.name as class_name
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE DATE_TRUNC('month', s.admission_date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY s.class_id, c.name;

-- Get students by attendance percentage range
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  s.average_attendance,
  c.name as class_name
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.average_attendance >= 80
ORDER BY s.average_attendance DESC;

-- Get student results for a specific session and term
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  result_item->>'subject' as subject,
  (result_item->>'welcomeTest')::numeric as welcome_test,
  (result_item->>'midTerm')::numeric as mid_term,
  (result_item->>'vetting')::numeric as vetting,
  (result_item->>'exam')::numeric as exam,
  (result_item->>'total')::numeric as total,
  result_item->>'grade' as grade
FROM students s,
LATERAL jsonb_array_elements(s.results) as result_item
WHERE result_item->>'session_id' = 'YOUR_SESSION_ID_HERE'
AND result_item->>'term_id' = 'YOUR_TERM_ID_HERE'
ORDER BY s.last_name, s.first_name, result_item->>'subject';

-- Get students with low attendance (below 75%)
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  s.average_attendance,
  c.name as class_name,
  s.parent_name,
  s.parent_phone,
  s.parent_email
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.average_attendance < 75
AND s.status = 'active'
ORDER BY s.average_attendance ASC;

-- =====================================================
-- 4. TEACHERS QUERIES
-- =====================================================

-- Get all teachers with their assigned classes
SELECT
  t.id,
  t.staff_id,
  t.first_name,
  t.last_name,
  t.email,
  t.phone,
  t.specialization,
  t.status,
  COUNT(DISTINCT tc.class_id) as assigned_classes_count,
  STRING_AGG(DISTINCT c.name, ', ') as class_names
FROM teachers t
LEFT JOIN teacher_classes tc ON tc.teacher_id = t.id
LEFT JOIN classes c ON c.id = tc.class_id
GROUP BY t.id, t.staff_id, t.first_name, t.last_name, t.email, t.phone, t.specialization, t.status
ORDER BY t.last_name, t.first_name;

-- Get teachers assigned to a specific class
SELECT
  t.id,
  t.staff_id,
  t.first_name,
  t.last_name,
  t.email,
  t.specialization
FROM teachers t
INNER JOIN teacher_classes tc ON tc.teacher_id = t.id
WHERE tc.class_id = 'YOUR_CLASS_ID_HERE'
AND t.status = 'active'
ORDER BY t.last_name, t.first_name;

-- Get classes assigned to a specific teacher
SELECT
  c.id,
  c.name,
  c.level,
  c.department,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as student_count
FROM classes c
INNER JOIN teacher_classes tc ON tc.class_id = c.id
LEFT JOIN students s ON s.class_id = c.id
WHERE tc.teacher_id = 'YOUR_TEACHER_ID_HERE'
GROUP BY c.id, c.name, c.level, c.department
ORDER BY c.level, c.name;

-- Get class teachers (teachers assigned as main class teacher)
SELECT
  t.id,
  t.staff_id,
  t.first_name,
  t.last_name,
  c.name as class_name,
  c.level as class_level,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as student_count
FROM teachers t
INNER JOIN classes c ON c.class_teacher_id = t.id
LEFT JOIN students s ON s.class_id = c.id
WHERE t.status = 'active'
GROUP BY t.id, t.staff_id, t.first_name, t.last_name, c.name, c.level
ORDER BY t.last_name, t.first_name;

-- =====================================================
-- 5. SESSIONS AND TERMS QUERIES
-- =====================================================

-- Get current session and terms
SELECT
  s.id as session_id,
  s.name as session_name,
  s.start_date as session_start,
  s.end_date as session_end,
  t.id as term_id,
  t.name as term_name,
  t.start_date as term_start,
  t.end_date as term_end,
  t.is_current as is_current_term
FROM sessions s
LEFT JOIN terms t ON t.session_id = s.id
WHERE s.is_current = true
ORDER BY t.start_date;

-- Get all sessions with term counts
SELECT
  s.id,
  s.name,
  s.start_date,
  s.end_date,
  s.is_current,
  COUNT(t.id) as term_count
FROM sessions s
LEFT JOIN terms t ON t.session_id = s.id
GROUP BY s.id, s.name, s.start_date, s.end_date, s.is_current
ORDER BY s.start_date DESC;

-- Get terms for a specific session
SELECT
  t.id,
  t.name,
  t.start_date,
  t.end_date,
  t.is_current
FROM terms t
WHERE t.session_id = 'YOUR_SESSION_ID_HERE'
ORDER BY t.start_date;

-- =====================================================
-- 6. STATISTICS AND ANALYTICS QUERIES
-- =====================================================

-- Get overall school statistics
SELECT
  (SELECT COUNT(*) FROM students WHERE status = 'active') as total_active_students,
  (SELECT COUNT(*) FROM students WHERE status = 'suspended') as suspended_students,
  (SELECT COUNT(*) FROM teachers WHERE status = 'active') as total_active_teachers,
  (SELECT COUNT(*) FROM classes) as total_classes,
  (SELECT COUNT(*) FROM subjects) as total_subjects,
  (SELECT ROUND(AVG(average_attendance), 2) FROM students WHERE status = 'active') as avg_attendance_percentage;

-- Get class-wise student distribution
SELECT
  c.level,
  c.name,
  c.capacity,
  COUNT(s.id) FILTER (WHERE s.status = 'active') as enrolled_students,
  c.capacity - COUNT(s.id) FILTER (WHERE s.status = 'active') as available_spots
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
GROUP BY c.id, c.level, c.name, c.capacity
ORDER BY c.level, c.name;

-- Get education level distribution
SELECT
  CASE
    WHEN c.level IN ('Nursery 1', 'Nursery 2', 'KG 1', 'KG 2') THEN 'Pre-Primary'
    WHEN c.level LIKE 'Primary%' THEN 'Primary'
    WHEN c.level LIKE 'JSS%' THEN 'JSS'
    WHEN c.level LIKE 'SSS%' THEN 'SSS'
  END as education_level,
  COUNT(DISTINCT c.id) as class_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') as student_count,
  COUNT(DISTINCT tc.teacher_id) as teacher_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
LEFT JOIN teacher_classes tc ON tc.class_id = c.id
GROUP BY education_level
ORDER BY
  CASE education_level
    WHEN 'Pre-Primary' THEN 1
    WHEN 'Primary' THEN 2
    WHEN 'JSS' THEN 3
    WHEN 'SSS' THEN 4
  END;

-- Get gender distribution
SELECT
  s.gender,
  COUNT(*) as count,
  ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM students WHERE status = 'active')) * 100, 2) as percentage
FROM students s
WHERE s.status = 'active'
GROUP BY s.gender;

-- Get attendance statistics by class
SELECT
  c.name as class_name,
  c.level,
  COUNT(s.id) as student_count,
  ROUND(AVG(s.average_attendance), 2) as avg_class_attendance,
  COUNT(*) FILTER (WHERE s.average_attendance >= 80) as students_above_80_percent,
  COUNT(*) FILTER (WHERE s.average_attendance < 75) as students_below_75_percent
FROM classes c
LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
GROUP BY c.id, c.name, c.level
ORDER BY avg_class_attendance DESC;

-- =====================================================
-- 7. USEFUL MAINTENANCE QUERIES
-- =====================================================

-- Update student average attendance (run when needed)
UPDATE students
SET average_attendance = (
  SELECT ROUND(
    (COUNT(*) FILTER (WHERE (value->>'status')::text = 'present') * 100.0 / COUNT(*))::numeric,
    2
  )
  FROM jsonb_array_elements(students.attendance)
)
WHERE jsonb_array_length(attendance) > 0;

-- Find students without a class assignment
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  s.email,
  s.status
FROM students s
WHERE s.class_id IS NULL
AND s.status = 'active';

-- Find classes without a class teacher
SELECT
  c.id,
  c.name,
  c.level,
  COUNT(s.id) FILTER (WHERE s.status = 'active') as student_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
WHERE c.class_teacher_id IS NULL
GROUP BY c.id, c.name, c.level
ORDER BY student_count DESC;

-- Find subjects not assigned to any class
SELECT
  s.id,
  s.name,
  s.education_level,
  s.department
FROM subjects s
LEFT JOIN subject_classes sc ON sc.subject_id = s.id
WHERE sc.id IS NULL
ORDER BY s.education_level, s.name;

-- =====================================================
-- 8. DATA EXPORT QUERIES
-- =====================================================

-- Export student contact list
SELECT
  s.student_id,
  s.first_name || ' ' || s.last_name as full_name,
  s.email as student_email,
  s.phone as student_phone,
  c.name as class,
  c.level,
  s.parent_name,
  s.parent_email,
  s.parent_phone,
  s.address
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.status = 'active'
ORDER BY c.level, s.last_name, s.first_name;

-- Export teacher contact list
SELECT
  t.staff_id,
  t.first_name || ' ' || t.last_name as full_name,
  t.email,
  t.phone,
  t.specialization,
  t.qualification,
  STRING_AGG(DISTINCT c.name, ', ') as assigned_classes
FROM teachers t
LEFT JOIN teacher_classes tc ON tc.teacher_id = t.id
LEFT JOIN classes c ON c.id = tc.class_id
WHERE t.status = 'active'
GROUP BY t.id, t.staff_id, t.first_name, t.last_name, t.email, t.phone, t.specialization, t.qualification
ORDER BY t.last_name, t.first_name;

-- Export class roster with student details
SELECT
  c.name as class_name,
  c.level,
  s.student_id,
  s.first_name,
  s.last_name,
  s.gender,
  s.email,
  s.phone,
  s.average_attendance,
  s.admission_date
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
WHERE s.status = 'active'
ORDER BY c.level, c.name, s.last_name, s.first_name;
