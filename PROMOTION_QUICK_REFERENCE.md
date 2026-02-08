# Promotion System - Quick Reference

## 🚀 Quick Start

### Step 1: Process Promotions
1. Navigate to **Admin → Promotions**
2. Select the **session** (current session auto-selected)
3. Review the **4 stat cards**:
   - Total Students
   - Eligible for Promotion (≥40% average)
   - Graduating (SS3 students)
   - Needs Review (<40% average)
4. Use **filters** to narrow down students:
   - Search by name/ID
   - Filter by status (Eligible / Needs Review)
   - Filter by class
5. **Select students** to promote:
   - Click checkbox next to each student, OR
   - Click "Select All" to bulk select
6. Click **"Promote X Students"**
7. **Confirm** the action
8. ✅ Done! Students promoted and history recorded

### Step 2: View Class History
1. Navigate to **Admin → History**
2. Choose a **query mode**:
   - Class Roster - see who was in a class
   - Student History - track individual student
   - Class Statistics - enrollment numbers
   - Graduates - list of graduates
   - Repeaters - who repeated
   - Performance - class performance trends
3. Apply **filters**:
   - Session, Class, Education Level, Status
4. **Search** for specific students/classes
5. **Export to Excel** if needed

---

## 📊 Promotion Logic at a Glance

```
Student Average ≥ 40%  →  ✅ ELIGIBLE
    ↓
Is SS3?
    ├─ Yes → Mark as GRADUATED
    └─ No → PROMOTE to next class

Student Average < 40%  →  ⚠️ NEEDS REVIEW
    ↓
Admin decides:
    ├─ Promote anyway (manual override)
    └─ Repeat class
```

---

## 🎯 Common Tasks

### Task: Promote all eligible students
1. Go to Promotions page
2. Select session
3. Filter: Status = "Eligible"
4. Click "Select All"
5. Click "Promote X Students"
6. Confirm

### Task: Find who graduated in 2024/2025
1. Go to History page
2. Query mode: **Graduates**
3. Filter: Session = 2024/2025
4. Export to Excel

### Task: Check which class a student was in last year
1. Go to History page
2. Query mode: **Student History**
3. Search for student name
4. Filter by session
5. See class placement

### Task: Lower the pass percentage
1. Go to Promotions page
2. Click **Settings** button
3. Change "Minimum Pass Percentage" (e.g., from 40% to 35%)
4. Save

### Task: Manually promote a struggling student
1. Go to Promotions page
2. Filter: Status = "Needs Review"
3. Find the student
4. Check their checkbox
5. Click "Promote 1 Student"
6. Confirm (note will say "repeated" but you can still promote)

---

## 📋 Default Settings

| Setting | Default | Notes |
|---------|---------|-------|
| Minimum Pass % | 40% | Configurable per session |
| Require All Terms | No | Students with 2/3 terms can still be promoted |
| Auto Promote | Yes | Eligible students auto-promoted when selected |

---

## 🔍 Understanding Student Status

| Badge | Meaning | Action |
|-------|---------|--------|
| ✅ **Eligible** | Average ≥ 40% | Auto-promoted on selection |
| 🎓 **Graduating** | SS3 student with ≥40% | Marked as "graduated" |
| ⚠️ **Review** | Average < 40% | Manual decision required |

---

## 💡 Pro Tips

1. **Process promotions AFTER all results are published**
   - Ensure all 3 terms have results entered
   - Calculate class positions first

2. **Use filters to work in batches**
   - Filter by class to promote one class at a time
   - Filter by status to handle edge cases separately

3. **Export data before making changes**
   - Go to History page and export current state
   - Backup in case you need to reference later

4. **Check "Needs Review" students carefully**
   - Some may be just below threshold (38-39%)
   - Consider promoting on compassionate grounds
   - Add notes explaining decision

5. **Class history is permanent**
   - Once recorded, it's your audit trail
   - Cannot be deleted (by design)
   - Use it to resolve disputes

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| No students showing | Check: Students exist? Results entered? Students are "active"? |
| Too many "Needs Review" | Lower pass percentage in Settings |
| Can't find history | Process promotions first - history created during promotion |
| Wrong class progression | Check your database migration for class mapping |

---

## 📞 Support

For issues not covered here, check the full guide:  
📖 **PROMOTION_SYSTEM_GUIDE.md**

---

**Last updated**: February 2026  
**Version**: 1.0
