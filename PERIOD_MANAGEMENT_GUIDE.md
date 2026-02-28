# Period Management Guide

## Overview
The Period Management page allows administrators to configure school period times and breaks for each day of the week. These configurations are used for automatic timetable generation and scheduling.

## Accessing the Page
Navigate to **Admin Dashboard → Periods** or directly to `/admin/periods`

## Features

### 1. **Add New Period**
- Click the **"+ Add Period"** button in the top-right
- Fill in the following details:
  - **Day of Week**: Select from Monday through Friday
  - **Period Number**: Sequential number for this period (1, 2, 3, etc.)
  - **Start Time**: When the period begins (24-hour format)
  - **End Time**: When the period ends (must be after start time)
  - **Is Break**: Check this box if it's a break or lunch period
- Duration is calculated automatically
- Click **"Add Period"** to save

### 2. **View Periods**
Periods are displayed in two ways:
- **Card View**: Shows periods grouped by day in a grid layout
- **Table View**: Shows all periods in a comprehensive table with:
  - Day of week
  - Period number or break designation
  - Start and end times
  - Duration in minutes
  - Type (Class or Break)

### 3. **Edit Period**
- Click the **Edit icon** (pencil) next to any period
- Modify the details as needed
- Duration updates automatically as you change times
- Click **"Update Period"** to save changes

### 4. **Delete Period**
- Click the **Delete icon** (trash) next to any period
- Confirm the deletion when prompted
- ⚠️ **Warning**: Deleting a period may affect existing timetables

### 5. **Statistics**
The summary card at the top shows:
- Total classroom periods configured
- Total break slots configured
- Overall total periods

## Best Practices

1. **Consistent Scheduling**: Keep all periods on the same day consistent in duration
2. **Break Placement**: Mark lunch and break periods clearly so they're properly handled in timetable generation
3. **Sequential Numbering**: Number periods sequentially (1, 2, 3, etc.) for each day
4. **Validation Rules**:
   - Period numbers must be unique per day
   - End time must be after start time
   - All required fields must be filled

Example Configuration:
```
Monday - Friday (Same pattern):
- Period 1: 08:00 - 09:00 (Class)
- Period 2: 09:00 - 10:00 (Class)
- Break: 10:00 - 10:20 (Break)
- Period 3: 10:20 - 11:20 (Class)
- Period 4: 11:20 - 12:20 (Class)
- Lunch: 12:20 - 13:00 (Break)
- Period 5: 13:00 - 14:00 (Class)
```

## Integration
These period configurations are used by:
- **Timetable Generator**: Creates class timetables based on these slots
- **Attendance System**: Tracks attendance by period
- **Class Schedule Display**: Shows students and teachers their schedules

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot add duplicate period number for a day | Each day can only have one period with each number |
| Duration shows as invalid | Ensure end time is after start time |
| Changes not reflecting in timetables | Regenerate timetables after updating periods |

