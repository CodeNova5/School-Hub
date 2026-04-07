# Unified GitHub File Upload API

## Overview

All file uploads to GitHub are now handled through a single, unified API endpoint: `/api/upload`

This consolidation replaced three separate endpoints:
- ❌ `/api/upload-student-image` (REMOVED)
- ❌ `/api/upload-file` (REMOVED)  
- ✅ `/api/upload` (UNIFIED ENDPOINT)

## Key Features

- **Single endpoint** for all GitHub file uploads
- **Multi-repository support** - handles uploads to multiple GitHub repositories
- **Multiple upload types** with specific path and repository logic
- **Authentication** - requires user to be logged in
- **Base64 encoding** - handles file conversion automatically

## API Endpoint

**POST** `/api/upload`

## Upload Types

The endpoint supports the following upload types via the `type` form field:

### 1. Student Photo
- **Type**: `student_photo`
- **Repository**: School-Deck-Assets
- **Path**: `students/{student_id}.jpg`
- **Required Fields**:
  - `file`: Image file
  - `type`: "student_photo"
  - `student_id`: Unique student identifier

**Example**:
```javascript
const formData = new FormData();
formData.append("file", imageFile);
formData.append("type", "student_photo");
formData.append("student_id", "student_john_doe_1234567890");

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
// Returns: { success: true, fileUrl: "https://raw.githubusercontent.com/...", message: "..." }
```

### 2. Assignment File (Student Submission)
- **Type**: `assignment_file`
- **Repository**: School-Deck-Assets
- **Path**: `assignments/{assignment_id}/{student_id}-{filename}`
- **Required Fields**:
  - `file`: File submission
  - `type`: "assignment_file"
  - `assignment_id`: Assignment ID
  - `student_id`: Student ID

**Example**:
```javascript
const formData = new FormData();
formData.append("file", submissionFile);
formData.append("type", "assignment_file");
formData.append("assignment_id", "assign_123");
formData.append("student_id", "student_456");

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

### 3. Teacher Assignment File
- **Type**: `teacher_assignment_file`
- **Repository**: School-Deck-Assets
- **Path**: `assignments/{assignment_id}/{filename}`
- **Required Fields**:
  - `file`: Assignment file
  - `type`: "teacher_assignment_file"
  - `assignment_id`: Assignment ID

**Example**:
```javascript
const formData = new FormData();
formData.append("file", assignmentFile);
formData.append("type", "teacher_assignment_file");
formData.append("assignment_id", "assign_789");

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

### 4. School Logo
- **Type**: `school_logo`
- **Repository**: School-Assets
- **Path**: `logos/{school_id}.png`
- **Required Fields**:
  - `file`: Logo image
  - `type`: "school_logo"
  - `school_id`: School ID

**Example**:
```javascript
const formData = new FormData();
formData.append("file", logoFile);
formData.append("type", "school_logo");
formData.append("school_id", "school_001");

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

### 5. Admin Signature
- **Type**: `admin_signature`
- **Repository**: School-Assets
- **Path**: `signatures/{admin_id}.png`
- **Required Fields**:
  - `file`: Signature image
  - `type`: "admin_signature"
  - `admin_id`: Admin ID

**Example**:
```javascript
const formData = new FormData();
formData.append("file", signatureFile);
formData.append("type", "admin_signature");
formData.append("admin_id", "admin_001");

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

## Response Format

### Success Response
```json
{
  "success": true,
  "fileUrl": "https://raw.githubusercontent.com/CodeNova5/School-Deck-Assets/main/students/student_john_doe_1234567890.jpg",
  "message": "student photo uploaded successfully"
}
```

### Error Response
```json
{
  "error": "Upload failed",
  "details": "Error message details"
}
```

## Error Codes

| Status | Error | Cause |
|--------|-------|-------|
| 401 | Unauthorized | User not authenticated |
| 400 | file and type are required | Missing required form fields |
| 400 | Unsupported upload type | Invalid type value provided |
| 400 | {field} is required | Type-specific field missing |
| 500 | Upload failed | GitHub API error or network issue |

## GitHub Repositories

The unified endpoint uploads to two repositories:

### 1. School-Deck-Assets
- **Owner**: CodeNova5
- **Repo**: School-Deck-Assets
- **Used for**: Student photos, assignments
- **Base URL**: `https://raw.githubusercontent.com/CodeNova5/School-Deck-Assets/main/`

### 2. School-Assets
- **Owner**: CodeNova5
- **Repo**: School-Assets
- **Used for**: School logos, signatures
- **Base URL**: `https://raw.githubusercontent.com/CodeNova5/School-Assets/main/`

## Implementation Details

### Backend
- **File**: [app/api/upload/route.ts](app/api/upload/route.ts)
- **Library**: [lib/github.ts](lib/github.ts)
- **Dependencies**: 
  - `@octokit/rest`: GitHub API client
  - `@supabase/auth-helpers-nextjs`: User authentication

### Frontend Usage
All file uploads should use this pattern:

```typescript
async function uploadFile(file: File, uploadType: string, metadata: Record<string, string>) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", uploadType);
  
  // Add type-specific metadata
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, value);
  });

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    return result.fileUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

## Currently Using This Endpoint

The following components use the unified upload endpoint:
- [app/admin/students/page.tsx](app/admin/students/page.tsx) - Student photo uploads
- [app/admin/settings/page.tsx](app/admin/settings/page.tsx) - Logo and signature uploads
- [components/StudentAssignmentSubmissionModal.tsx](components/StudentAssignmentSubmissionModal.tsx) - Assignment submissions
- [components/assignment-modal.tsx](components/assignment-modal.tsx) - Teacher assignments

## Adding New Upload Types

To add a new upload type:

1. Add the type to the `UploadType` union in [app/api/upload/route.ts](app/api/upload/route.ts)
2. Add a new case in the switch statement with:
   - Path construction logic
   - Commit message template
   - Repository selection
3. Update this documentation with the new type details

Example:
```typescript
case "new_upload_type": {
  const identifier = form.get("identifier") as string;
  if (!identifier) throw new Error("identifier is required");
  
  path = `folder/${identifier}.ext`;
  commitMessage = `Upload description`;
  repository = "student-assets"; // or "school-assets"
  break;
}
```

## Environment Variables Required

- `GITHUB_TOKEN`: GitHub personal access token with repo write permissions
- Must be set in `.env.local`

## Security Considerations

- ✅ User authentication required
- ✅ All uploads require valid GitHub credentials
- ✅ Files are stored in public GitHub repositories
- ✅ Rate limited by GitHub API
- ⚠️ Ensure proper access controls on GitHub repositories
- ⚠️ Validate file types and sizes on the frontend before upload

## Migration Guide

If you have code using the old endpoints, migrate as follows:

### Before (Old):
```javascript
// Student image
const response = await fetch('/api/upload-student-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    base64Content: base64,
    fileName: fileName,
    commitMessage: 'message',
  }),
});
```

### After (New):
```javascript
// Student image
const formData = new FormData();
formData.append("file", file);
formData.append("type", "student_photo");
formData.append("student_id", "identifier");

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

## Testing

To test the endpoint:

```bash
# Using curl
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/file.jpg" \
  -F "type=student_photo" \
  -F "student_id=student_001"
```

## Support

For issues or questions about the unified upload endpoint:
1. Check this documentation first
2. Review the endpoint implementation in [app/api/upload/route.ts](app/api/upload/route.ts)
3. Check the GitHub helper library in [lib/github.ts](lib/github.ts)
4. Review error messages and logs
