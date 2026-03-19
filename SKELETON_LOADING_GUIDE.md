# Skeleton Loading System Guide

This guide explains how to implement skeleton preview with shimmer animation for pages during initial load in the School Hub application.

## Overview

The skeleton loading system provides visual feedback to users while content is loading. Each skeleton element has a smooth shimmer animation that creates a professional loading experience.

## Components

### 1. Skeleton Component (Enhanced)
**Location:** `components/ui/skeleton.tsx`

The base skeleton component now supports two variants:

```tsx
<Skeleton variant="shimmer" className="h-10 w-full" />
<Skeleton variant="default" className="h-10 w-full" /> // or just <Skeleton>
```

**Variants:**
- `shimmer`: Shows animated shimmer/light effect moving across the skeleton
- `default`: Shows pulse animation (lighter effect)

### 2. DashboardSkeleton Component
**Location:** `components/dashboard-skeleton.tsx`

Pre-built skeleton layout matching the admin dashboard structure. Use this when loading dashboard pages.

**Features:**
- Header with title and button placeholders
- Stats cards skeleton
- Chart placeholders (line, pie, bar)
- Activities section skeleton
- System status section skeleton
- Quick actions skeleton
- Key metrics summary skeleton

**Usage:**

```tsx
import { DashboardSkeleton } from '@/components/dashboard-skeleton';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return (
      <DashboardLayout role="admin">
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout role="admin">
      {/* Your dashboard content */}
    </DashboardLayout>
  );
}
```

### 3. Generic SkeletonLoader Component
**Location:** `components/skeleton-loader.tsx`

Flexible component for different page types without custom skinning.

**Supported Types:**

#### List View
```tsx
<SkeletonLoader type="list" count={5} />
```
Displays 5 list items with avatar, title, and description placeholders.

#### Detail View
```tsx
<SkeletonLoader type="detail" />
```
Shows form-like layout with fields and action buttons.

#### Table View
```tsx
<SkeletonLoader type="table" count={8} />
```
Displays table header and 8 row skeletons.

#### Grid View
```tsx
<SkeletonLoader type="grid" count={6} />
```
Shows 3-column grid with 6 card skeletons.

## Shimmer Animation Details

### CSS Keyframes
The shimmer animation is defined in `tailwind.config.ts`:

```typescript
keyframes: {
  shimmer: {
    '100%': {
      transform: 'translateX(100%)',
    },
  },
}
```

### Animation Timing
- Duration: 2 seconds
- Iteration: Infinite
- Direction: Left to right

### Visual Effect
The shimmer creates a light gradient that moves across the skeleton element, creating a subtle wave-like loading effect.

## Customization

### Multiple Variations

You can create different skeleton layouts by combining basic skeletons:

```tsx
function TeacherDashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton variant="shimmer" className="h-8 w-48" />
        <Skeleton variant="shimmer" className="h-4 w-80 mt-2" />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton variant="shimmer" className="h-4 w-24" />
              <Skeleton variant="shimmer" className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Gradient Background Effect
All skeletons use a subtle gradient:
```tsx
className="bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
```

This creates depth alongside the shimmer animation.

## Implementation Examples

### Example 1: Student Dashboard
```tsx
import { SkeletonLoader } from '@/components/skeleton-loader';
import { DashboardLayout } from '@/components/dashboard-layout';

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchData().then(data => {
      setDashboardData(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DashboardLayout role="student">
        <SkeletonLoader type="dashboard" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      {/* Your actual content */}
    </DashboardLayout>
  );
}
```

### Example 2: Student List Page
```tsx
import { SkeletonLoader } from '@/components/skeleton-loader';

export default function StudentsList() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchStudents().then(data => {
      setStudents(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <SkeletonLoader type="list" count={10} />
    );
  }

  return (
    <div className="space-y-4">
      {students.map(student => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  );
}
```

### Example 3: Teacher Details Page
```tsx
import { SkeletonLoader } from '@/components/skeleton-loader';

export default function TeacherDetail() {
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState(null);

  useEffect(() => {
    fetchTeacher().then(data => {
      setTeacher(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <SkeletonLoader type="detail" />;
  }

  return (
    <TeacherForm initialData={teacher} />
  );
}
```

## Best Practices

1. **Match Loading Content Type** - Use the skeleton type that best matches your actual content layout
2. **Set Appropriate Count** - Use `count` prop to show the correct number of items
3. **Consistent Design** - Use variant="shimmer" for better visual consistency
4. **Clear Transition** - Content should smoothly replace skeleton without layout shifts
5. **Loading States** - Only show skeletons during actual data loading, not on error states

## Files Modified/Created

1. **Modified:**
   - `components/ui/skeleton.tsx` - Added shimmer variant
   - `tailwind.config.ts` - Added shimmer keyframes and animation
   - `app/admin/page.tsx` - Updated to use DashboardSkeleton

2. **Created:**
   - `components/dashboard-skeleton.tsx` - Dashboard-specific skeleton layout
   - `components/skeleton-loader.tsx` - Generic skeleton loader with multiple types

## Browser Support

The shimmer animation uses standard CSS transforms and is supported in all modern browsers:
- Chrome 26+
- Firefox 16+
- Safari 9+
- Edge 12+

## Performance

- Skeleton animations use GPU-accelerated CSS transforms
- Minimal repaints and reflows
- No JavaScript animation loops
- Smooth 60fps animation

## Troubleshooting

### Shimmer not animating
- Ensure `tailwind.config.ts` has the shimmer animation defined
- Check that the class `animate-shimmer` is applied
- Clear Next.js cache: `rm -rf .next`

### Skeleton too wide or narrow
- Use Tailwind width utilities: `w-full`, `w-64`, `w-1/2`
- Combine with responsive prefixes: `md:w-1/3`, `lg:w-1/4`

### Layout shift when content loads
- Ensure skeleton dimensions match content dimensions
- Use `aspect-ratio` for images
- Set fixed heights for known content

## Future Enhancements

- Skeleton variants for specific UI patterns
- Configurable shimmer speed
- Dark mode adapted skeletons
- Preset skeleton templates for common components
