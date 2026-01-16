# 🎓 AI Timetable Generator - User Guide

## Quick Start

### Step 1: Select Your Class
Choose the class you want to generate a timetable for. The system will load all subjects assigned to that class.

### Step 2: Configure Subject Frequencies

#### Setting Weekly Periods
- Use the **+** and **-** buttons or type directly to set how many periods per week each subject needs
- The system suggests defaults based on subject type (e.g., Math gets 4, Science gets 3)

#### Understanding AI Priority Badges

The system shows you how constrained each subject is:

| Badge | Meaning | Example |
|-------|---------|---------|
| 🔴 **Critical** | Only 1 day available | Yoruba (Monday only) |
| 🟠 **High** | Only 2 days available | Agricultural Science (Tue/Thu) |
| 🔵 **Medium** | 3-4 days or special pairing | CRS/IRS, Departmental groups |
| ⚪ **Low** | All days available | English, Mathematics |

**Why it matters**: The AI schedules Critical subjects first to ensure they get their limited slots, then works down the priority list.

#### Configuring Day Restrictions

Click the **▶** arrow next to any subject to expand day settings:
- Select which days the subject can be taught
- Toggle individual days on/off
- Use "Select All" to allow any day
- At least 1 day must be selected

**Examples**:
- **Yoruba**: Monday & Wednesday only
- **Chess**: Thursday only  
- **Music**: Tuesday only
- **French**: Thursday only
- **Most core subjects**: All days

> 💡 **Tip**: The fewer days allowed, the higher the AI priority. Only restrict days if there's a real constraint (e.g., specialist teacher only available certain days).

#### Special Features

##### CRS/IRS Pairing (Automatic)
- Christian Religious Studies and Islamic Religious Studies are automatically paired
- They share the same time slot (students split by religion)
- Frequencies are synced - changing one updates the other
- Day restrictions apply to both

##### Departmental Grouping (SSS Classes)
For senior classes, you can group departmental subjects:

1. Click **Add Group** and name it (e.g., "Science Group 1")
2. Assign subjects to the group using the dropdown (e.g., Physics, Chemistry, Biology)
3. All subjects in a group share the same period
4. Students attend based on their department

**Benefits**:
- Reduces total periods needed
- Allows flexible department choices
- Optimizes teacher utilization

### Step 3: Advanced AI Settings

#### Avoid Consecutive Same Subjects
✅ **Recommended: ON**
- Prevents scheduling Math right after Math, etc.
- Gives students variety throughout the day

#### Prevent Teacher Double-Booking
✅ **Recommended: ON**  
- Ensures teachers aren't assigned to multiple classes at the same time
- Hard constraint - will never violate this if enabled

#### Balance Teacher Workload
✅ **Recommended: ON**
- Distributes periods evenly across the week
- Avoids overloading teachers on any single day
- Recommends max 6 periods per teacher per day

#### Enable Departmental Grouping
☑️ **Optional** (SSS classes only)
- Turn on if you created departmental groups in Step 2
- AI will schedule grouped subjects together

### Step 4: Review & Confirm

#### Understanding the Preview

The timetable grid shows:
- **Single subjects**: Just the subject name and teacher
- **Paired (CRS/IRS)**: "CRS / IRS" with both teacher names
- **Grouped subjects**: Primary subject shown (hover/check for full list)

#### Conflict Indicators

##### 🟢 Green Success Box
```
✅ Perfect Timetable Generated!
All subjects successfully scheduled with no conflicts.
```
**Action**: Review and confirm - you're all set!

##### 🟡 Yellow Warning Box
```
🟡 WARNING: English only assigned 3/4 periods (restricted to: Mon, Wed)
🟡 WARNING: Mr. Smith has 7 periods on Tuesday (recommended max: 6)
```
**Action**: These are optimization suggestions. The timetable works but could be improved. Consider:
- Adjusting day restrictions
- Reducing some frequencies
- Redistributing manually if needed

##### 🔴 Red Error Box
```
🔴 ERROR: Unable to fully schedule Physics - 0/3 assigned (restricted to: Thursday)
```
**Action**: Critical issue. Options:
- **Add more allowed days** for the problematic subject
- **Reduce frequency** if possible
- **Check teacher conflicts** 
- Click **Regenerate** to try again with different optimization

#### What the AI Does Behind the Scenes

When you see conflicts, the AI has already:
1. ✅ Tried to find the best slot for each subject
2. ✅ Attempted smart swaps with less-constrained subjects
3. ✅ Redistributed assignments across days
4. ✅ Made multiple passes with different strategies

If it still shows a conflict, there may be a genuine scheduling impossibility.

### Using the Regenerate Button

Click **🔄 Regenerate** to:
- Try a different assignment order
- Use alternative optimization strategies  
- Get a fresh solution

Sometimes a second or third generation finds a better solution due to the randomization in tie-breaking.

## Pro Tips 🎯

### 1. Start Flexible, Add Constraints Gradually
- First, allow all subjects on all days
- Generate and see the result
- Then add day restrictions only where necessary
- Regenerate to see the impact

### 2. Realistic Frequencies
```
✅ Good:
- Math: 4-5 periods
- English: 4 periods  
- Sciences: 3 periods each
- Electives: 2 periods

❌ Problematic:
- Trying to fit 15 subjects × 3 periods = 45 periods in 40 available slots
```

### 3. Day Restriction Best Practices
- **DO**: Restrict subjects that genuinely need it (special rooms, shared teachers)
- **DON'T**: Arbitrarily restrict to "spread out the week" - let the AI optimize this

### 4. Understanding the Statistics

On Step 2, you'll see:
```
Critical Priority: 2
High Priority: 1
Medium Priority: 4
Low Priority: 8
```

**Ideal distribution**: More Low priority subjects = more flexibility for AI = better results

**Concerning**: Many Critical/High priorities = tight constraints = possible conflicts

### 5. If You Get Many Conflicts

**Checklist**:
- [ ] Are day restrictions really necessary?
- [ ] Is total periods > available slots?
- [ ] Do multiple subjects want the same rare slot?
- [ ] Are teachers over-committed?

**Solutions**:
1. Expand day restrictions for flexible subjects
2. Reduce frequencies slightly
3. Add more teachers to subjects (reduce per-teacher load)
4. Consider departmental grouping to save slots

## Advanced Scenarios

### Scenario 1: Specialist Teacher (Part-Time)
**Problem**: Music teacher only available on Tuesday

**Solution**:
1. Set Music to "Tuesday only" (Critical priority)
2. Reduce Music frequency to 1-2 periods max
3. AI will schedule Music first, others work around it

### Scenario 2: Lab Sharing
**Problem**: Physics, Chemistry, Biology share one lab

**Solution**:
1. Don't use day restrictions
2. Instead, enable Departmental Grouping
3. Group PHY/CHEM/BIO together
4. All three scheduled in same slot, students split by department

### Scenario 3: Core Subject Emphasis
**Problem**: Want Math/English in morning hours

**Solution**:
1. Enable "Balance Difficulty" in Step 3
2. AI automatically prioritizes core subjects for early periods
3. No manual configuration needed

## FAQs

**Q: Why does the AI show Medium priority for subjects with no day restrictions?**  
A: Some subjects like CRS/IRS get Medium priority because they need special handling (pairing). Departmental grouped subjects also get Medium priority.

**Q: Can I manually edit the generated timetable?**  
A: Not in the wizard, but you can edit individual entries after confirming and saving.

**Q: What happens when I click "Confirm & Save"?**  
A: The system deletes the old timetable for this class and saves the new one. This is permanent.

**Q: How many times can I regenerate?**  
A: Unlimited! Keep trying until you get a satisfactory result.

**Q: Does the AI learn from previous generations?**  
A: Currently no - each generation is independent. Future versions may include learning capabilities.

## Troubleshooting

### "Unable to fully schedule [Subject]"

**Causes**:
- Too few available days
- Teacher double-booked
- All suitable slots already full

**Fixes**:
1. Add more allowed days
2. Reduce frequency
3. Check if teacher has conflicts in other classes
4. Regenerate (might find alternative placement)

### "Teacher has 7+ periods on [Day]"

**Causes**:
- Many subjects assigned to same teacher
- Day restrictions forcing clustering

**Fixes**:
- This is usually just a warning, not an error
- Consider if some periods can move to other days
- Check if teacher restrictions can be relaxed

### Timetable Looks Random/Unbalanced

**Causes**:
- Advanced settings disabled
- Too many conflicts forcing suboptimal choices

**Fixes**:
1. Enable "Avoid Consecutive"
2. Enable "Balance Difficulty"  
3. Enable "Balance Workload"
4. Reduce constraints and regenerate

## Best Practices Summary

✅ **DO**:
- Use realistic frequencies based on curriculum
- Only restrict days when truly necessary
- Enable all AI optimization settings
- Review conflicts carefully before confirming
- Use departmental grouping for senior classes
- Regenerate if first attempt has issues

❌ **DON'T**:
- Over-constrain subjects unnecessarily
- Ignore error messages (warnings are okay)
- Expect perfect solution with impossible constraints
- Assign more total periods than available slots
- Use day restrictions to "balance" - AI does this better

## Support

If you encounter issues:
1. Check this guide
2. Review the AI_TIMETABLE_SYSTEM.md for technical details
3. Try regenerating with fewer constraints
4. Contact administrator if persistent problems occur

---

**Remember**: The AI is very smart, but it can't violate the laws of physics! Give it reasonable constraints and it will find an optimal solution. 🎓✨

