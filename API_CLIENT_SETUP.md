# API Client Setup for Admin Tabs

## Overview

The admin tabs now have centralized API access through the `apiClient` utility. All data read and write operations go through a unified API layer instead of direct Supabase calls.

## Architecture

### Files Modified

1. **`lib/api-client.ts`** (New)
   - Centralized API client with generic read/write operations
   - Convenience methods for common queries
   - Error handling and response formatting

2. **`app/admin/classes/[classId]/page.tsx`**
   - Updated to use `apiClient` instead of direct Supabase
   - Cleaner code with fewer HTTP requests
   - Centralized error handling

3. **Tab Components** (Updated)
   - `SubjectsTab.tsx` - Subject management with API
   - `StudentsTab.tsx` - Already compatible
   - `AttendanceTab.tsx` - Attendance tracking with API
   - `ResultsTab.tsx` - Results management with API
   - `TimetableTab.tsx` - Delegates to ClassTimetable component

### API Routes Used

- **`POST /api/admin-read`** - Read operations with filtering and ordering
- **`POST /api/admin-operation`** - Write operations (insert, update, delete)

## Usage

### Generic Operations

```typescript
import { apiRead, apiWrite } from '@/lib/api-client';

// Read data
const data = await apiRead({
  table: 'students',
  select: '*',
  filters: { class_id: 'xyz' },
  order: [{ column: 'first_name', ascending: true }]
});

// Write data
await apiWrite({
  table: 'students',
  operation: 'update',
  data: { class_id: null },
  filters: { id: 'student-id' }
});
```

### Convenience Methods

```typescript
import { apiClient } from '@/lib/api-client';

// Read operations
const students = await apiClient.readStudents(classId);
const teachers = await apiClient.readTeachers();
const subjects = await apiClient.readSubjectClasses(classId);
const sessions = await apiClient.readSessions();
const terms = await apiClient.readTerms();

// Write operations
await apiClient.updateStudentClass(studentId, classId);
await apiClient.assignTeacher(subjectClassId, teacherId);
await apiClient.deleteSubjectClass(subjectClassId);
await apiClient.updateSubjectCode(subjectClassId, code);
```

## Key Features

### Error Handling
- All API calls have try-catch blocks
- Errors are logged to console and shown via toast notifications
- Consistent error messages

### Response Formatting
- All responses are normalized to arrays
- Handles both single and multiple results

### Filter Support
Multiple filter types:
- Equality: `{ column: value }`
- Null checks: `{ column: null }`
- Arrays: `{ column: [value1, value2] }`

### Ordering
- Ascending and descending support
- Multiple column ordering

## Tab-Specific Updates

### SubjectsTab
- Uses `apiClient` for subject updates
- Manages optional subject enrollments
- Supports subject editing and teacher assignment

### AttendanceTab
- Fetches students and attendance records via API
- Saves attendance with bulk operations
- Deletes previous records before inserting new ones

### ResultsTab
- Reads results with nested selects
- Updates class positions for students
- Supports session/term filtering

### StudentsTab
- Inherits API operations from parent component
- No direct API calls needed

## Migration from Supabase

### Before (Direct Supabase)
```typescript
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('class_id', classId)
  .order('first_name');
```

### After (API Client)
```typescript
const data = await apiClient.readStudents(classId);
```

## Benefits

1. **Centralized**: All data operations in one place
2. **Type-Safe**: Better TypeScript support with interfaces
3. **Consistent**: Uniform error handling and responses
4. **Maintainable**: Easy to add new operations
5. **Testable**: Easier to mock API calls
6. **Scalable**: Simple to add authentication/authorization layers

## Adding New Operations

To add a new convenience method:

```typescript
// In lib/api-client.ts
export const apiClient = {
  // ... existing methods
  
  readMyData: (id: string) =>
    apiRead({
      table: 'my_table',
      select: '*',
      filters: { id },
    }),
};
```

## Security Notes

- The API uses service role credentials on the backend
- RLS (Row Level Security) is bypassed for admin operations
- Ensure proper authentication is in place before using these endpoints
- All operations should be logged for audit trails

## Testing

### Local Development
1. Verify environment variables are set
2. Check API routes are running
3. Test operations in tabs
4. Monitor console for errors

### Error Scenarios
- Network failures
- Invalid filters
- Database constraints
- Missing data

## Future Enhancements

- [ ] Add caching layer
- [ ] Implement request batching
- [ ] Add pagination support
- [ ] Enhanced error recovery
- [ ] Rate limiting
- [ ] Request logging
