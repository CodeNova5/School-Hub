# API Client Quick Reference

## Import

```typescript
import { apiClient, apiRead, apiWrite } from '@/lib/api-client';
```

## Common Read Operations

### Get all students in a class
```typescript
const students = await apiClient.readStudents(classId);
```

### Get all subjects for a class
```typescript
const subjects = await apiClient.readSubjectClasses(classId);
```

### Get all teachers
```typescript
const teachers = await apiClient.readTeachers();
```

### Get all sessions
```typescript
const sessions = await apiClient.readSessions();
```

### Get all terms
```typescript
const terms = await apiClient.readTerms();
```

### Custom read with filters
```typescript
const data = await apiRead({
  table: 'attendance',
  select: '*',
  filters: {
    class_id: classId,
    date: selectedDate
  },
  order: [{ column: 'student_id', ascending: true }]
});
```

## Common Write Operations

### Assign teacher to subject class
```typescript
await apiClient.assignTeacher(subjectClassId, teacherId);
```

### Update subject code
```typescript
await apiClient.updateSubjectCode(subjectClassId, 'NEW-CODE');
```

### Delete subject from class
```typescript
await apiClient.deleteSubjectClass(subjectClassId);
```

### Add/Remove student from class
```typescript
// Add student to class
await apiClient.updateStudentClass(studentId, classId);

// Remove student from class
await apiClient.updateStudentClass(studentId, null);
```

### Save attendance records
```typescript
const attendanceData = [
  {
    student_id: 'student1',
    class_id: classId,
    date: '2024-01-29',
    status: 'present'
  },
  // ... more records
];

await apiClient.saveAttendance(attendanceData);
```

### Update attendance status
```typescript
await apiClient.updateAttendance(attendanceId, 'absent');
```

### Update results
```typescript
await apiClient.updateResults(resultId, 85, 'A1');
```

### Custom write with bulk operations
```typescript
// Update multiple students
const studentIds = ['id1', 'id2', 'id3'];

const updates = studentIds.map(id =>
  apiWrite({
    table: 'students',
    operation: 'update',
    data: { class_id: newClassId },
    filters: { id }
  })
);

await Promise.all(updates);
```

## Error Handling Pattern

```typescript
try {
  const data = await apiClient.readStudents(classId);
  // Use data
} catch (error) {
  console.error('Failed to read students:', error);
  toast.error('Failed to load students');
}
```

## Response Structure

All operations return data in this structure:

### Read Operations
```typescript
// Returns: T[]
const students: Student[] = await apiClient.readStudents(classId);
```

### Write Operations
```typescript
// Returns: any (varies by operation)
const result = await apiClient.updateStudentClass(id, classId);
```

## Filter Examples

### Single filter
```typescript
{
  filters: { class_id: 'class-123' }
}
```

### Multiple filters
```typescript
{
  filters: {
    class_id: 'class-123',
    status: 'active'
  }
}
```

### Null filter
```typescript
{
  filters: { class_id: null } // Select rows where class_id is NULL
}
```

### Array filter
```typescript
{
  filters: { id: ['id1', 'id2', 'id3'] } // IN query
}
```

## Order Examples

### Single column ascending
```typescript
{
  order: [{ column: 'first_name', ascending: true }]
}
```

### Single column descending
```typescript
{
  order: [{ column: 'created_at', ascending: false }]
}
```

### Multiple columns
```typescript
{
  order: [
    { column: 'class_id', ascending: true },
    { column: 'first_name', ascending: true }
  ]
}
```

## Select Examples

### All columns
```typescript
{
  select: '*'
}
```

### Specific columns
```typescript
{
  select: 'id, first_name, last_name'
}
```

### With relationships (nested selects)
```typescript
{
  select: `
    *,
    student:students(id, first_name, last_name),
    subject_class:subject_classes(id, subject:subjects(name))
  `
}
```

## Batch Operations

### Update multiple records
```typescript
const updates = studentIds.map(id =>
  apiClient.updateStudentClass(id, classId)
);
await Promise.all(updates);
```

### Delete multiple records
```typescript
const deletes = recordIds.map(id =>
  apiWrite({
    table: 'attendance',
    operation: 'delete',
    filters: { id }
  })
);
await Promise.all(deletes);
```

## Toast Notifications Pattern

```typescript
// Loading state
const toastId = toast.loading('Saving...');

try {
  await apiClient.assignTeacher(subjectClassId, teacherId);
  toast.success('Teacher assigned', { id: toastId });
} catch (error) {
  toast.error('Failed to assign teacher', { id: toastId });
}
```

## Advanced: Custom Operations

For operations not covered by convenience methods:

```typescript
// Custom read
const customData = await apiRead({
  table: 'my_custom_table',
  select: 'id, name, custom_field',
  filters: { status: 'active' },
  order: [{ column: 'name', ascending: true }]
});

// Custom write
await apiWrite({
  table: 'my_custom_table',
  operation: 'insert',
  data: {
    name: 'New Record',
    custom_field: 'value'
  }
});
```

## Debugging

### Check request/response
```typescript
// Errors are logged to console automatically
try {
  const data = await apiClient.readStudents(classId);
  console.log('Successfully loaded:', data);
} catch (error) {
  console.error('Failed with error:', error);
  // Error message shows the API error response
}
```

## Type Safety

```typescript
// Get better autocomplete and type checking
import type { Student } from '@/lib/types';

const students: Student[] = await apiClient.readStudents(classId);
```
