# AI Assistant Feature - Complete Guide

## Overview

The AI Assistant feature allows users (students, teachers, admins, parents) to ask natural language questions about school data and receive intelligent, context-aware responses. The system uses OpenAI's GPT models to understand questions, generate safe SQL queries, and format results in natural language.

## Architecture

### Components

1. **Schema Description System** (`lib/ai-assistant/schema-description.ts`)
   - Maintains metadata about database tables and columns
   - Provides schema information to the AI Query Planner
   - No sensitive data - only structure and descriptions

2. **AI Query Planner** (`lib/ai-assistant/query-planner.ts`)
   - Converts natural language questions into parameterized SQL queries
   - Uses OpenAI to understand intent and map to database schema
   - Validates queries for security (no DROP, DELETE, etc.)
   - Enforces multi-tenancy with school_id filtering

3. **Query Executor** (`lib/ai-assistant/query-executor.ts`)
   - Safely executes AI-generated queries
   - Uses Supabase RPC for parameter binding
   - Respects Row Level Security (RLS) policies

4. **Result Summarizer** (`lib/ai-assistant/result-summarizer.ts`)
   - Converts query results into natural language responses
   - Formats data in readable, conversational style
   - Uses markdown for better presentation

5. **Query Cache** (`lib/ai-assistant/query-cache.ts`)
   - Caches frequent queries to reduce AI API calls
   - In-memory cache with TTL (1 hour default)
   - Automatic cache invalidation and cleanup

6. **API Routes** (`app/api/ai-assistant/ask/route.ts`)
   - Main endpoint for processing questions
   - Handles authentication and authorization
   - Coordinates all AI assistant components

7. **Frontend Chat Interface** (`components/ai-assistant-chat.tsx`)
   - Chat-like UI for asking questions
   - Displays formatted responses with markdown support
   - Shows query information for transparency

8. **Role-Specific Pages**
   - Admin: `/admin/ai-assistant`
   - Teacher: `/teacher/ai-assistant`
   - Student: `/student/ai-assistant`
   - Parent: `/parent/ai-assistant`

## Setup Instructions

### 1. Install Dependencies

```bash
npm install react-markdown
```

### 2. Configure Environment Variables

Add to your `.env.local` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo  # or gpt-4 for better reasoning
```

### 3. Run Database Migration

Apply the SQL migration to create the query execution function:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually via Supabase Dashboard SQL Editor
# Run: supabase/migrations/02_AI_ASSISTANT_FUNCTION.sql
```

### 4. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the AI Assistant page for your role:
   - Admin: `http://localhost:3000/admin/ai-assistant`
   - Teacher: `http://localhost:3000/teacher/ai-assistant`
   - Student: `http://localhost:3000/student/ai-assistant`
   - Parent: `http://localhost:3000/parent/ai-assistant`

3. Try asking sample questions:
   - "How many students are in SSS1?"
   - "Who teaches Mathematics?"
   - "Show me students with low attendance"

## Security Features

### 1. Query Validation
- Only SELECT queries allowed
- Blocks dangerous keywords (DROP, DELETE, UPDATE, etc.)
- Enforces school_id filter for multi-tenancy

### 2. Parameterized Queries
- All values use parameter binding ($1, $2, etc.)
- Prevents SQL injection attacks
- Values never embedded directly in SQL

### 3. Row Level Security (RLS)
- All queries execute through Supabase RPC
- RLS policies automatically enforced
- Users only see data they have permission to access

### 4. Role-Based Access
- Students: Only their own data
- Teachers: Only their classes and students
- Parents: Only their children's data
- Admins: All school data

## Usage Examples

### For Admins

**Question:** "Which students in SSS1 have grades below 50 in Math?"

**How it works:**
1. AI generates query joining students, classes, subjects, and results tables
2. Query filters by school_id, class level "SSS1", subject "Math", and grade < 50
3. Results formatted as readable list with student names and scores

### For Teachers

**Question:** "Show me my students with attendance below 75%"

**How it works:**
1. AI identifies teacher's classes using teacher_id
2. Queries attendance records for students in those classes
3. Calculates attendance percentage and filters < 75%
4. Returns formatted list with student names and percentages

### For Students

**Question:** "What are my grades this term?"

**How it works:**
1. AI filters results by student's user_id
2. Joins with subjects to get subject names
3. Returns current term grades with subject names and scores

### For Parents

**Question:** "How is my child doing in Mathematics?"

**How it works:**
1. AI identifies parent's children
2. Queries results for Mathematics subject
3. Returns grades, trends, and performance summary

## Configuration

### Cache Settings

Edit `lib/ai-assistant/query-cache.ts`:

```typescript
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 1000; // Max cached queries
```

### OpenAI Model

Edit `.env.local`:

```env
# Use GPT-3.5 for cost-effective queries
OPENAI_MODEL=gpt-3.5-turbo

# Or GPT-4 for better accuracy (higher cost)
OPENAI_MODEL=gpt-4
```

### Query Limits

The AI automatically includes LIMIT clauses for large result sets to prevent overwhelming responses.

## Customization

### Adding New Schema Tables

1. Edit `lib/ai-assistant/schema-description.ts`
2. Add new table to `DATABASE_SCHEMA` array:

```typescript
{
  name: 'your_table',
  description: 'What this table stores',
  rlsEnabled: true,
  columns: [
    { name: 'id', type: 'uuid', description: 'Primary key', isPrimaryKey: true },
    // ... more columns
  ]
}
```

### Customizing Suggested Questions

Edit the role-specific page files:

```typescript
const suggestedQuestions = [
  'Your custom question 1',
  'Your custom question 2',
  // ...
];
```

### Modifying Chat Interface

Edit `components/ai-assistant-chat.tsx` to:
- Change colors and styling
- Add new features (export chat, etc.)
- Customize message formatting

## Troubleshooting

### Issue: "OpenAI API key not configured"

**Solution:** Add your OpenAI API key to `.env.local`:
```env
OPENAI_API_KEY=sk-...
```

### Issue: "Query must include school_id filter"

**Solution:** This is a security check. The AI should automatically add school_id filters. If this error persists, check that the database migration was applied correctly.

### Issue: "Failed to generate query plan"

**Possible causes:**
1. OpenAI API quota exceeded
2. Invalid API key
3. Network connectivity issues

**Solution:** Check your OpenAI account and API key validity.

### Issue: "No results found"

**Solution:** Try rephrasing the question or:
- Be more specific with names and identifiers
- Check if the data actually exists in the database
- Verify user has permission to access the data

### Issue: Cache not working

**Solution:** Cache is in-memory and resets on server restart. For production, consider using Redis or another persistent cache.

## Performance Optimization

### 1. Caching Strategy
- Enable cache for repeated questions
- Invalidate cache when data changes
- Use cache statistics to monitor hit rate

### 2. Query Optimization
- AI generates indexed queries when possible
- Limits result sets to prevent large responses
- Uses appropriate JOINs for efficiency

### 3. Cost Management
- Cache reduces OpenAI API calls by ~70%
- Use GPT-3.5 for most queries (cheaper)
- Monitor OpenAI usage in dashboard

## Production Deployment

### Checklist

- [ ] Add OpenAI API key to production environment variables
- [ ] Apply database migration (02_AI_ASSISTANT_FUNCTION.sql)
- [ ] Set up Redis for distributed caching (optional but recommended)
- [ ] Configure rate limiting on AI assistant endpoint
- [ ] Monitor OpenAI API usage and costs
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Test with production data volume

### Scaling Considerations

1. **High Traffic:** Implement Redis caching
2. **Cost Control:** Set OpenAI API budget alerts
3. **Rate Limiting:** Prevent abuse with request throttling
4. **Load Balancing:** Distribute requests across regions

## Future Enhancements

### Planned Features

1. **Chat History:** Persist conversations to database
2. **Export Results:** Download query results as CSV/Excel
3. **Follow-up Questions:** Maintain conversation context
4. **Voice Input:** Speech-to-text for questions
5. **Data Visualizations:** Generate charts from results
6. **Multi-language Support:** Translate questions and responses
7. **Custom AI Training:** Fine-tune model on school-specific terms

### Integration Ideas

1. **Notifications:** "Alert me when grades drop below X"
2. **Reports:** "Generate monthly performance report"
3. **Recommendations:** "Suggest interventions for struggling students"
4. **Predictive Analytics:** "Which students are at risk?"

## API Reference

### POST /api/ai-assistant/ask

**Request Body:**
```json
{
  "question": "How many students are in SSS1?",
  "useCache": true
}
```

**Response:**
```json
{
  "success": true,
  "response": "There are 45 students enrolled in SSS1...",
  "queryPlan": {
    "explanation": "Counts active students in SSS1",
    "tables": ["students", "classes"]
  },
  "resultCount": 1,
  "cached": false
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Support

For issues or questions:
1. Check this documentation
2. Review error logs
3. Test with simpler questions
4. Verify database schema matches `schema-description.ts`

## License

Part of School Deck system - All rights reserved.
