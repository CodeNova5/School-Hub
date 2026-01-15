# Religion Mode Implementation - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Database Migration
- [ ] Run the migration SQL in Supabase SQL Editor
- [ ] Verify `religion` column exists in `timetable_entries` table
- [ ] Verify new unique index `unique_class_period_dept_religion` is created
- [ ] Test constraint by trying to insert duplicate entries

### 2. Subjects Configuration
- [ ] Ensure CRS subject exists with `religion = 'Christian'`
- [ ] Ensure IRS subject exists with `religion = 'Muslim'`
- [ ] Verify subjects are linked to appropriate classes via `subject_classes`
- [ ] Verify teachers are assigned to CRS and IRS subjects

### 3. Code Deployment
- [ ] Commit changes to repository
- [ ] Deploy updated code to production/staging
- [ ] Clear browser cache if needed
- [ ] Test in development environment first

## 🧪 Testing Checklist

### Manual Entry Tests
- [ ] Add single CRS entry - should save successfully
- [ ] Add single IRS entry - should save successfully
- [ ] Add both CRS and IRS in same period - should save successfully
- [ ] Try to add both department and religion modes - should be mutually exclusive
- [ ] Edit existing religion mode entry - should load correctly
- [ ] Delete religion mode entry - should delete both subjects

### Auto-Generation Tests
- [ ] Generate timetable for class with CRS/IRS
- [ ] Verify religious subjects appear in generated timetable
- [ ] Verify no teacher clashes occur
- [ ] Verify subjects are distributed across the week

### Display Tests
- [ ] View class timetable - should show "CRS / IRS" format
- [ ] Export PDF - should include religious subjects
- [ ] All entries table - should display religious subjects correctly
- [ ] Teacher names should display for each religious subject

### Edge Cases
- [ ] Class with only CRS (no IRS) - should work
- [ ] Class with only IRS (no CRS) - should work
- [ ] Class with neither CRS nor IRS - should work normally
- [ ] Teacher assigned to both CRS and IRS - should detect clash
- [ ] Edit from regular subject to religion mode - should work
- [ ] Edit from department mode to religion mode - should work
- [ ] Edit from religion mode to regular subject - should work

## 📊 Database Queries for Verification

### Check migration status
\`\`\`sql
-- Verify religion column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'timetable_entries' 
AND column_name = 'religion';

-- Verify unique index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'timetable_entries' 
AND indexname = 'unique_class_period_dept_religion';
\`\`\`

### Check subjects
\`\`\`sql
-- List all religious subjects
SELECT s.id, s.name, s.religion, s.education_level, 
       COUNT(sc.id) as linked_classes
FROM subjects s
LEFT JOIN subject_classes sc ON sc.subject_id = s.id
WHERE s.religion IS NOT NULL
GROUP BY s.id, s.name, s.religion, s.education_level;
\`\`\`

### Check timetable entries
\`\`\`sql
-- List all religion mode entries
SELECT 
    te.id,
    c.name as class_name,
    ps.day_of_week,
    ps.period_number,
    s.name as subject_name,
    te.religion,
    t.first_name || ' ' || t.last_name as teacher
FROM timetable_entries te
JOIN classes c ON c.id = te.class_id
JOIN period_slots ps ON ps.id = te.period_slot_id
JOIN subject_classes sc ON sc.id = te.subject_class_id
JOIN subjects s ON s.id = sc.subject_id
LEFT JOIN teachers t ON t.id = sc.teacher_id
WHERE te.religion IS NOT NULL
ORDER BY c.name, ps.day_of_week, ps.period_number;
\`\`\`

## 🔧 Troubleshooting

### Issue: "religion column does not exist"
**Solution**: Run the migration SQL script

### Issue: Religious subjects not appearing in dropdown
**Solution**: 
1. Check subject has `religion` field set
2. Verify subject is linked to class in `subject_classes`
3. Check that teacher is assigned

### Issue: Cannot save both CRS and IRS
**Solution**: Check that unique index was created correctly with COALESCE

### Issue: Teacher clash not detected
**Solution**: Verify teacher_id is set in subject_classes table

### Issue: Subjects not displaying correctly
**Solution**: Clear browser cache and refresh page

## 📝 Rollback Plan (if needed)

If issues occur, you can rollback using:

\`\`\`sql
-- Remove religion column
ALTER TABLE timetable_entries DROP COLUMN IF EXISTS religion;

-- Restore old unique index
DROP INDEX IF EXISTS unique_class_period_dept_religion;
CREATE UNIQUE INDEX unique_class_period_dept 
ON timetable_entries (class_id, period_slot_id, COALESCE(department, 'NONE'));
\`\`\`

Then redeploy previous code version.

## ✨ Post-Deployment

- [ ] Notify administrators about new feature
- [ ] Provide quick guide to users
- [ ] Monitor for any errors in logs
- [ ] Collect user feedback
- [ ] Update documentation

## 📞 Support Information

If issues arise:
1. Check error logs in Supabase dashboard
2. Verify database constraints are correct
3. Test with a single class first
4. Check browser console for JavaScript errors
5. Verify all migrations ran successfully

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
**Version**: 1.0.0
**Feature**: Religion Mode (CRS/IRS Simultaneous Scheduling)
