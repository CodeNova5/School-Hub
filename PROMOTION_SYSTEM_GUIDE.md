# Student Promotion System - Complete Guide

## Overview

The Student Promotion System allows administrators to manage the end-of-session promotion process, automatically promoting eligible students to the next class level, marking SS3 students as graduated, and tracking complete class history for academic auditing and reporting.

## Key Features

### 1. **Automated Promotions** 
- Automatic promotion based on configurable pass percentage (default: 40%)
- Bulk promotion of eligible students
- Special handling for SS3 graduates
- Manual override for edge cases

### 2. **Class History Tracking**
- Complete record of which students were in which classes during each session
- Permanent historical data that survives class changes
- Performance tracking across sessions
- Audit trail for disputes and compliance

### 3. **Flexible Configuration**
- Adjustable pass percentage threshold
- Option to require all 3 terms
- Enable/disable auto-promotion

---

## How It Works

### Promotion Process Flow

```
Session End (3rd Term Complete)
         ↓
Calculate Student Averages (across all terms with results)
         ↓
Compare to Pass Threshold (default 40%)
         ↓
┌────────┴────────┐
↓                 ↓
PASSED          FAILED
↓                 ↓
├─ SS3 → Graduate   Manual Decision Required
├─ Other → Promote to next class
└─ Record in class_history
```

### Automatic Decisions

The system automatically determines:

1. **Promotion** - Student average ≥ pass threshold
   - Student moves to next class
   - Status remains "active"
   
2. **Graduation** - SS3 student with average ≥ pass threshold
   - Student status changes to "graduated"
   - Remains in SS3 class (for record keeping)
   
3. **Needs Review** - Student average < pass threshold
   - Admin must manually decide: promote anyway OR repeat class
   - Student highlighted in UI for review

---

## Pages Walkthrough

### 📚 `/admin/promotions` - Promotions Management

**Purpose**: Process student promotions at the end of a session

**Features**:
- **Session Selection**: Choose which session to process promotions for
- **Promotion Settings**: 
  - Minimum pass percentage (configurable)
  - Require all terms checkbox
  - Auto-promote toggle
  
- **Student List**: Shows all students with:
  - Current class
  - Terms completed (e.g., 3/3)
  - Cumulative average across all terms
  - Eligibility status (Eligible, Graduating, Needs Review)
  - Proposed action (Promote, Graduate, Repeat)

- **Bulk Selection**: Select multiple students and process promotions in batch

**Statistics Cards**:
- Total Students - all active students
- Eligible for Promotion - students meeting pass threshold
- Graduating (SS3) - SS3 students eligible to graduate
- Needs Review - students below pass threshold

**Workflow**:
1. Select session (current session auto-selected)
2. Review student performance
3. Adjust settings if needed (Settings button)
4. Select students to promote (individual or bulk select)
5. Click "Promote X Students"
6. Confirm the action
7. System processes promotions and records class history

---

### 📖 `/admin/history` - Class History

**Purpose**: Query and analyze historical class memberships and student progression

**Query Modes** (6 different views):

#### 1. **Class Roster** 👥
*"Who was in this class this year?"*

Example use case:
- Show all students in JSS2 during 2024/2025 session
- Generate class lists for past years
- Identify class composition at any point in time

#### 2. **Student History** 📚
*"Which classes has this student been in?"*

Example use case:
- Track a student's progression through school
- Verify which class a student was in during a specific session
- Handle parent disputes about class placement

#### 3. **Class Statistics** 📊
*"How many students were in each class per session?"*

Example use case:
- Enrollment trends over time
- Class size analysis
- Resource planning based on historical data

#### 4. **Graduates** 🎓
*"Who graduated from SS3?"*

Example use case:
- Generate graduation lists for a specific session
- Alumni tracking
- Graduation ceremony planning

#### 5. **Repeaters** 🔄
*"Who repeated a class?"*

Example use case:
- Identify students who stayed in the same class across sessions
- Academic intervention tracking
- Performance improvement monitoring

#### 6. **Performance** 📈
*"Class performance over time"*

Example use case:
- Compare average performance across different class sets
- Identify high-performing vs struggling classes
- Track performance trends

**Filters**:
- Session - filter by academic year
- Class - specific class
- Education Level - Pre-Primary, Primary, JSS, SSS
- Promotion Status - promoted, graduated, repeated, pending, withdrawn
- Search - student name, ID, or class name

**Export**: Download filtered results to Excel for reporting

---

## Database Schema

### `class_history` Table

Stores permanent records of student class memberships per session.

**Key Columns**:
- `student_id`, `class_id`, `session_id` - the core relationship
- `student_name`, `student_number`, `class_name` - denormalized for historical accuracy
- `terms_completed` - how many terms did the student complete
- `average_score` - cumulative average across all terms
- `cumulative_grade` - A1, B2, C4, etc.
- `position` - class ranking
- `promoted` - boolean, was the student promoted?
- `promotion_status` - promoted | graduated | repeated | pending | withdrawn
- `promoted_to_class_id` - next class (if promoted)
- `promotion_notes` - explanation/reason

**Why denormalize data?**

We store student name, class name, etc. directly in the history table instead of just IDs because:
- Students can change names
- Classes can be renamed or deleted
- We need accurate historical records that don't change when current data changes

### `promotion_settings` Table

Configurable promotion rules per session.

**Columns**:
- `session_id` - which session these settings apply to
- `minimum_pass_percentage` - e.g., 40
- `require_all_terms` - must student have results for all 3 terms?
- `auto_promote` - enable automatic promotions

---

## API Endpoints

### `GET /api/admin/promotions`

**Query Parameters**:
- `sessionId` (required)

**Response**:
```json
{
  "settings": {
    "minimum_pass_percentage": 40,
    "require_all_terms": false,
    "auto_promote": true
  },
  "students": [
    {
      "student_id": "...",
      "student_name": "John Doe",
      "current_class_name": "JSS 3",
      "terms_completed": 3,
      "cumulative_average": 67.5,
      "is_eligible": true,
      "is_graduating": false,
      "needs_manual_review": false
    }
  ],
  "total_students": 150,
  "eligible_count": 120,
  "graduating_count": 45,
  "needs_review_count": 30
}
```

### `POST /api/admin/promotions`

**Body**:
```json
{
  "sessionId": "...",
  "promotions": [
    {
      "student_id": "...",
      "action": "promote", // or "graduate" or "repeat"
      "next_class_id": "...",
      "cumulative_average": 67.5,
      "cumulative_grade": "C4",
      "notes": "Promoted with 67.5% average"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "results": {
    "promoted": 100,
    "graduated": 45,
    "repeated": 5,
    "errors": []
  },
  "message": "Processed 150 students..."
}
```

### `PUT /api/admin/promotions`

Update promotion settings for a session.

**Body**:
```json
{
  "sessionId": "...",
  "minimum_pass_percentage": 45,
  "require_all_terms": true,
  "auto_promote": false
}
```

### `GET /api/admin/history`

**Query Parameters** (all optional):
- `sessionId` - filter by session
- `classId` - filter by class
- `studentId` - filter by student
- `promotionStatus` - promoted | graduated | repeated | pending | withdrawn
- `educationLevel` - Pre-Primary | Primary | JSS | SSS

**Response**:
```json
{
  "success": true,
  "history": [
    {
      "id": "...",
      "student_name": "John Doe",
      "class_name": "JSS 3",
      "session_name": "2024/2025",
      "average_score": 67.5,
      "promotion_status": "promoted",
      "promoted_at": "2025-08-15T..."
    }
  ],
  "total_records": 500
}
```

---

## Class Progression Logic

The system uses a predefined class progression map:

```
Pre-Primary:
Creche → Nursery 1 → Nursery 2 → KG 1 → KG 2 → Primary 1

Primary:
Primary 1 → Primary 2 → Primary 3 → Primary 4 → Primary 5 → Primary 6 → JSS 1

JSS (Junior Secondary):
JSS 1 → JSS 2 → JSS 3 → SS 1

SSS (Senior Secondary):
SS 1 → SS 2 → SS 3 → [GRADUATION]
```

**Department Handling**:
- When promoting from JSS 3 to SS 1, the student's department (Science/Arts/Commercial) is preserved
- The system finds the SS 1 class matching the student's department

---

## Use Cases Solved

### 🎯 Use Case 1: "Who was in this class this year?"

**Question**: Show all students in JSS2 during 2024/2025

**Solution**:
1. Go to `/admin/history`
2. Select "Class Roster" mode
3. Filter: Session = 2024/2025, Class = JSS 2
4. View results or export to Excel

### 👤 Use Case 2: "Which class was this student in last year?"

**Question**: What class was David in during 2023/2024?

**Solution**:
1. Go to `/admin/history`
2. Select "Student History" mode
3. Search for "David" in the search box
4. Filter: Session = 2023/2024
5. See David's class placement for that year

### 📈 Use Case 3: "How many students per class?"

**Question**: Show enrollment for each class in 2025

**Solution**:
1. Go to `/admin/history`
2. Select "Class Statistics" mode
3. Filter: Session = 2025
4. See breakdown by class with counts

### 🎓 Use Case 4: "Generate graduation list"

**Question**: Who graduated in 2025?

**Solution**:
1. Go to `/admin/history`
2. Select "Graduates" mode
3. Filter: Session = 2025, Status = graduated
4. Export to Excel for ceremony

### 🔄 Use Case 5: "Who repeated?"

**Question**: Find students who repeated a class

**Solution**:
1. Go to `/admin/history`
2. Select "Repeaters" mode
3. Filter: Status = repeated
4. See list of repeating students with reasons

### 📊 Use Case 6: "Performance comparison"

**Question**: Did JSS2 2024 perform better than JSS2 2023?

**Solution**:
1. Go to `/admin/history`
2. Select "Performance" mode
3. Filter: Class = JSS 2
4. Compare average scores across different sessions

### 🧠 Use Case 7: "Dispute resolution"

**Scenario**: Parent claims "My child was never in JSS2 that year!"

**Solution**:
1. Go to `/admin/history`
2. Search for the student
3. Filter by the disputed session
4. Show the permanent class history record
5. Case closed! ✅

---

## Best Practices

### When to Run Promotions

**Timing**: End of 3rd term, after all results are published

1. Ensure all term results are entered
2. Calculate class positions (from Results tab in each class)
3. Review promotion eligibility 
4. Adjust settings if needed (e.g., lower pass mark for exceptional circumstances)
5. Process promotions
6. Verify class history was recorded
7. Communicate promotions to parents/students

### Settings Recommendations

**Default Settings** (recommended for most schools):
- Minimum Pass Percentage: **40%**
- Require All Terms: **false** (allow promotion with 2/3 terms)
- Auto Promote: **true**

**Strict Settings** (for competitive schools):
- Minimum Pass Percentage: **50%** or **60%**
- Require All Terms: **true**
- Auto Promote: **true**

**Manual Review Settings** (small schools, special cases):
- Auto Promote: **false** (forces manual review of every student)

### Handling Edge Cases

**Student transferred mid-session**:
- If has results from at least 1 term → calculate average from available terms
- Manual decision: promote based on previous school records

**Student with medical exemption**:
- May have only 1 or 2 terms
- Set "Require All Terms" to false
- Manual review based on available performance

**Student just below pass mark** (e.g., 39%):
- Shows in "Needs Review" section
- Admin can manually select and promote anyway
- Add note: "Promoted on compassionate grounds"

---

## Troubleshooting

### Issue: No students showing in promotions

**Cause**: No active students or no results for selected session

**Solution**:
- Verify students exist in database
- Check that results have been entered for the session
- Ensure students are marked as "active" status

### Issue: "Needs Review" count is very high

**Cause**: Too many students below pass threshold

**Solution**:
- Review pass percentage setting (may be too high)
- Check if results were entered correctly
- Consider lowering threshold temporarily or promoting individually

### Issue: Can't find historical data

**Cause**: Promotions haven't been processed yet for that session

**Solution**:
- Class history is only created when promotions are processed
- Process promotions for the session to generate history

### Issue: Student promoted to wrong class

**Cause**: Class progression map doesn't match your school's structure

**Solution**:
- Check database migration `get_next_class()` function
- May need to customize class progression logic for your school

---

## Future Enhancements

Potential features to add:

- [ ] Email notifications to parents on promotion
- [ ] Print promotion letters in bulk
- [ ] SMS notifications for promotion results
- [ ] Parent portal section to view child's class history
- [ ] Analytics: class retention rates, promotion trends
- [ ] Bulk repeat class assignment
- [ ] Conditional promotion (e.g., summer school requirements)

---

## Summary

The promotion system provides:

✅ **Automated workflow** for end-of-session promotions  
✅ **Complete audit trail** via class history  
✅ **Flexible configuration** to match your school's policies  
✅ **Powerful queries** to answer common questions  
✅ **Data integrity** with denormalized historical records  
✅ **Compliance ready** for educational authorities  

This system transforms a typically manual, error-prone process into a streamlined, auditable, and reliable workflow. 🎉
