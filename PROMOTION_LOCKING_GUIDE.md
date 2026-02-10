# Promotion Locking System Guide

## Overview

The promotion system includes safeguards to prevent accidental changes and maintain data integrity:

1. **Current Session Only**: Promotions can only be processed for the current academic session
2. **24-Hour Undo Window**: After processing, you have 24 hours to undo all changes
3. **Session Locking**: After 24 hours, the session is permanently locked from further promotion actions

## Key Features

### 1. Current Session Restriction

**What it does:**
- Only the current session appears in the session selector
- Non-current sessions cannot be selected or modified

**Why:**
- Prevents accidental modification of past academic records
- Ensures promotion decisions are made for the active session only
- Maintains historical data integrity

### 2. 24-Hour Undo Window

**What it does:**
- After processing promotions, an "Undo Promotions" button appears
- You can completely reverse all promotion actions within 24 hours
- A countdown timer shows remaining time

**What gets undone:**
- Students are restored to their original classes
- Graduated students are returned to active status
- All class history records for that session are removed
- The session becomes unlocked for re-processing

**How to undo:**
1. Navigate to Admin → Promotions
2. Select the session (if not already selected)
3. Click the **"Undo Promotions"** button (red/destructive button)
4. Confirm the action
5. All students are restored to their previous state

**Example scenario:**
```
Time: Monday 10:00 AM
Action: Process promotions for 200 students

Time: Monday 2:00 PM
Realization: Some students were incorrectly marked
Action: Click "Undo Promotions"
Result: All 200 students restored to original classes

Time: Can re-process with correct data
```

### 3. Session Locking (After 24 Hours)

**What it does:**
- Exactly 24 hours after processing, the session becomes permanently locked
- No further promotion actions can be taken
- A red warning banner displays the locked status

**Why:**
- Provides a reasonable window for corrections
- Prevents modifications after students/parents may have received notifications
- Ensures finality of academic records
- Maintains data integrity for reporting and compliance

**Visual indicators:**
- 🔴 Red warning banner: "Session Locked"
- Disabled "Promote" button
- Display of when promotions were processed

## Workflow

### Normal Promotion Flow

1. **Select Current Session**
   - Only current session is available
   - Cannot select past or future sessions

2. **Review Student Data**
   - Filter and search students
   - Review eligibility based on settings
   - Select students to promote/graduate/repeat

3. **Process Promotions**
   - Click "Promote X Students"
   - Review and customize actions in confirmation dialog
   - Confirm and process

4. **Timestamp Recorded**
   - System records `last_processed_at` timestamp
   - 24-hour countdown begins
   - Orange banner shows remaining time

5. **Within 24 Hours**
   - Option to undo available
   - Can reverse all changes
   - Can re-process if needed

6. **After 24 Hours**
   - Session automatically locks
   - No further changes possible
   - Records are final

### Emergency Undo Flow

```
Graph of decision flow:

Promotions Processed
        ↓
  [Within 24 hours?]
        ↓
    Yes → Click "Undo Promotions"
          → Confirm Action
          → All Changes Reversed
          → Can Re-Process
        
    No  → Session Locked
          → Changes Are Final
          → Contact System Administrator
```

## Technical Details

### Database Schema

**promotion_settings table:**
```sql
- session_id (uuid, FK to sessions)
- minimum_pass_percentage (numeric)
- require_all_terms (boolean)
- auto_promote (boolean)
- last_processed_at (timestamptz) -- NEW: tracks processing time
- created_at (timestamptz)
- updated_at (timestamptz)
```

### API Endpoints

**GET /api/admin/promotions**
- Returns promotion data with locking status
- Calculates `is_locked` and `can_undo` flags
- Response includes `last_processed_at` timestamp

**POST /api/admin/promotions**
- Processes promotions
- Validates session is current
- Checks if session is locked
- Records `last_processed_at` timestamp
- Returns processing results

**DELETE /api/admin/promotions**
- Undoes all promotions (24-hour window only)
- Validates session is current
- Checks 24-hour window
- Restores students to original classes
- Removes class history records
- Clears `last_processed_at` timestamp

**PUT /api/admin/promotions**
- Updates promotion settings
- Does not affect locking status

### State Management

Frontend tracks:
```typescript
- isLocked: boolean         // Session locked (>24 hours)
- canUndo: boolean          // Within undo window (<24 hours)
- lastProcessedAt: string   // Timestamp of processing
```

## User Interface

### Status Indicators

**🟢 Not Yet Processed**
- No warnings displayed
- All buttons enabled
- Ready to process promotions

**🟠 Recently Processed (< 24 hours)**
- Orange warning banner
- Shows countdown: "X hours remaining to undo"
- "Undo Promotions" button visible (red)
- Can still process if undone first

**🔴 Locked (> 24 hours)**
- Red error banner
- "Session Locked" message
- All action buttons disabled
- Shows processing date/time

### Button States

**"Promote X Students" button:**
- Enabled: When students selected AND session not locked
- Disabled: When session is locked OR no students selected

**"Undo Promotions" button:**
- Visible: Only when within 24-hour window
- Color: Destructive/red (indicates danger)
- Icon: Alert triangle

## Best Practices

### Before Processing

1. **Double-check selection criteria**
   - Review filters and search parameters
   - Verify student eligibility
   - Check promotion settings (pass percentage, etc.)

2. **Review special cases**
   - Students near pass mark
   - Students with incomplete terms
   - Graduating students (SSS 3)

3. **Communicate timeline**
   - Inform staff about 24-hour undo window
   - Plan for potential corrections

### During 24-Hour Window

1. **Monitor for issues**
   - Check for parent/student complaints
   - Verify class rosters
   - Review graduation lists

2. **Act quickly if problems found**
   - Don't wait until last minute
   - Use undo feature if significant issues discovered

3. **Document decisions**
   - Keep notes on special cases
   - Record reasons for manual overrides

### After Locking

1. **Accept finality**
   - Changes cannot be reversed through UI
   - Database-level intervention requires administrator

2. **Handle edge cases**
   - Individual student corrections via student management
   - Manual class updates if absolutely necessary

3. **Plan for next session**
   - Review what went well
   - Adjust promotion settings if needed
   - Update procedures based on learnings

## Troubleshooting

### "Session Locked" Error

**Problem:** Cannot process promotions, seeing locked message

**Solution:**
- Check `last_processed_at` timestamp in promotion_settings
- If within 24 hours: Undo and re-process
- If after 24 hours: Cannot modify through UI
- Contact system administrator for database-level changes

### Cannot Undo Promotions

**Problem:** Undo button not appearing or disabled

**Checklist:**
1. Is it actually within 24 hours?
2. Were promotions actually processed? (check `last_processed_at`)
3. Is this the current session?
4. Are you logged in as admin?

### Accidentally Locked Too Early

**Problem:** Need to undo but 24 hours have passed

**Options:**
1. **Database-level fix** (requires technical admin):
   ```sql
   -- Reset last_processed_at to extend window
   UPDATE promotion_settings 
   SET last_processed_at = NOW() - INTERVAL '1 hour'
   WHERE session_id = '<session_id>';
   ```

2. **Manual corrections:**
   - Update individual students via student management
   - Document all manual changes

## Security Considerations

- Only admins can access promotion features
- All actions are logged in class_history
- Undo operations are auditable
- Session-level locking prevents unauthorized changes

## Related Documentation

- [Promotion System Guide](PROMOTION_SYSTEM_GUIDE.md)
- [Promotion Quick Reference](PROMOTION_QUICK_REFERENCE.md)
- [Student Management](README.md)

## Support

For technical issues or questions:
1. Check this guide
2. Review error messages in browser console
3. Contact system administrator
4. Check database logs if needed
