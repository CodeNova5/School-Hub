# Holiday Sync Feature

## Overview
The admin calendar includes automatic synchronization of Nigerian public holidays using the Calendrific API.

## Setup

### 1. Get Calendrific API Key
1. Visit [Calendrific](https://calendarific.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Free tier includes 1,000 requests per month (more than enough for yearly syncs)

### 2. Configure Environment Variable
Add your API key to `.env.local`:
```bash
CALENDRIFIC_API_KEY=your_api_key_here
```

### 3. Usage
1. Navigate to Admin → Calendar
2. Click the "Sync Holidays" button
3. The system will:
   - Fetch all Nigerian public holidays for the current year
   - Filter for national and public holidays only
   - Check if holidays are already synced (prevents duplicates)
   - Add them to the database as "holiday" type events
   - Mark them as all-day events

## Features

- ✅ One-click sync for current year
- ✅ Automatic duplicate prevention
- ✅ Only syncs national/public holidays
- ✅ Includes holiday descriptions
- ✅ All holidays marked as all-day events
- ✅ Location set to "Nigeria"

## API Endpoint

**POST** `/api/sync-holidays`

### Response
```json
{
  "success": true,
  "message": "Successfully synced X Nigerian holidays for 2026",
  "count": 12,
  "holidays": [...]
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

## Notes

- Holidays are only synced once per year
- If holidays already exist for the current year, sync will be skipped
- All synced holidays are marked with `event_type: "holiday"`
- The feature uses the Calendrific API v2

## Calendrific API Documentation
https://calendarific.com/api-documentation
