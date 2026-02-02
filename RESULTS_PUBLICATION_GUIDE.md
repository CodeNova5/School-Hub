# Results Publication System Guide

## Overview

The Results Publication System gives administrators and teachers complete control over when and what result components students can view. By default, **all results are hidden from students** until explicitly published.

## Key Features

### 1. **Component-Based Publishing**
- Administrators and teachers can selectively publish individual result components:
  - Welcome Test (10 marks)
  - Mid-Term Test (20 marks)
  - Vetting (10 marks)
  - Exam (60 marks)

### 2. **Flexible Calculation Modes**
When publishing results, you can choose how grades and positions are calculated:
- **Welcome Test Only** - Based on 10 marks
- **Welcome + Mid-Term** - Based on 30 marks
- **Welcome + Mid-Term + Vetting** - Based on 40 marks
- **All Components** - Based on 100 marks

### 3. **Incomplete Results Detection**
Before publishing, the system identifies students who have incomplete results for the selected components, preventing confusion.

### 4. **Master Publication Toggle**
Even after selecting components, results remain invisible to students until you enable the "Make Results Visible to Students" toggle.

## How to Publish Results

### For Administrators

1. Navigate to **Admin Dashboard → Classes → [Select Class] → Results Tab**
2. Select the **Session** and **Term**
3. Click the **"Publish Results"** button
4. In the dialog:
   - **Select Components**: Check the components you want to publish (e.g., only Welcome Test and Mid-Term)
   - **Choose Calculation Mode**: Select how grades should be calculated
   - **Check Completions**: Click "Check Student Completions" to identify students with missing scores
   - **Review Warnings**: If any students have incomplete data, you'll see a warning with details
   - **Enable Publication**: Toggle "Make Results Visible to Students" to ON
5. Click **"Save Publication Settings"**

### For Teachers

The process is identical for teachers, accessible via:
**Teacher Dashboard → Classes → [Select Class] → Results Tab**

## Student Experience

### Before Publication
Students see a message: 
> "Results Not Yet Published - Your results for this term are being prepared and have not been published yet."

### After Publication
Students can view:
- Only the components you've published
- Grades calculated based on your selected calculation mode
- Class positions (if calculated)
- Teacher and principal remarks

### No Results Entered
If no results exist for the student:
> "No Results Available - Results for the selected session and term have not been uploaded yet."

## Component Visibility Rules

| User Role | Can See All Components | Can Publish Results |
|-----------|------------------------|---------------------|
| Admin | ✅ Yes (always) | ✅ Yes |
| Teacher | ✅ Yes (always) | ✅ Yes (for their classes) |
| Student | ❌ Only published components | ❌ No |

## Calculation Mode Impact

The calculation mode affects:
- **Total Score Display**: Shows out of 10, 30, 40, or 100
- **Grade Assignment**: Percentage calculated from selected components
- **Class Position**: Ranked by performance in selected components only

### Example
If you publish "Welcome Test Only" with calculation mode "Welcome Test Only":
- A student scoring 8/10 = 80% = Grade A1
- Positions are based on welcome test scores only

## Important Notes

### ⚠️ Key Points

1. **Default State**: Results are NOT visible to students by default
2. **Admin/Teacher Access**: Admins and teachers can always see all components regardless of publication settings
3. **Per Class/Term/Session**: Publication settings are specific to each combination of class, session, and term
4. **Incomplete Detection**: Use the "Check Student Completions" feature before publishing to ensure all students have scores
5. **Position Calculation**: Calculate positions BEFORE publishing for accurate ranking

## Workflow Recommendation

### Best Practice Steps

1. **Enter Results**: Teachers enter all result components
2. **Calculate Positions**: Admin/Teacher calculates class positions
3. **Review Completeness**: Check for incomplete results using the publication dialog
4. **Fix Missing Data**: Ensure all students have scores for components you want to publish
5. **Select Components**: Choose which components to publish
6. **Set Calculation Mode**: Choose appropriate grading scale
7. **Publish**: Enable "Make Results Visible to Students"
8. **Notify Students**: Inform students that results are available

## Database Schema

### `results_publication` Table

```sql
- id: UUID (Primary Key)
- class_id: UUID (Foreign Key → classes)
- session_id: UUID (Foreign Key → sessions)
- term_id: UUID (Foreign Key → terms)
- welcome_test_published: BOOLEAN
- mid_term_test_published: BOOLEAN
- vetting_published: BOOLEAN
- exam_published: BOOLEAN
- is_published: BOOLEAN (Master switch)
- calculation_mode: TEXT
- published_by: UUID (Foreign Key → auth.users)
- published_at: TIMESTAMPTZ
```

## Migration

Run the migration file to set up the system:
```bash
supabase migration up
```

File: `supabase/migrations/20260202_results_publication.sql`

## Troubleshooting

### Students Can't See Results
- ✅ Check if `is_published` is enabled
- ✅ Verify at least one component is checked as published
- ✅ Confirm correct session and term are selected
- ✅ Ensure results exist in the database

### Incomplete Results Warning
- ✅ Review the list of students with missing data
- ✅ Enter missing scores before publishing
- ✅ Or exclude incomplete components from publication

### Grades Don't Match Expectations
- ✅ Verify the calculation mode matches the components published
- ✅ Ensure positions were calculated with the same mode
- ✅ Check that all component scores are entered correctly

## Security

- **Row-Level Security (RLS)**: Enabled on `results_publication` table
- **Admin Access**: Full control over all publication settings
- **Teacher Access**: Can manage publication for classes they teach
- **Student Access**: Read-only access to published settings for their class

## Support

For issues or questions, contact your system administrator or refer to the main documentation.
