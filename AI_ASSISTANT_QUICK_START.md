# AI Assistant Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
npm install react-markdown
```

### Step 2: Add Environment Variables

Create or edit `.env.local` in your project root:

```env
# Add these lines
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
```

**Where to get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

### Step 3: Apply Database Migration

Run one of these commands:

**Option A - Using Supabase CLI:**
```bash
supabase db push
```

**Option B - Manual via Supabase Dashboard:**
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the sidebar
3. Create a new query
4. Copy contents of `supabase/migrations/02_AI_ASSISTANT_FUNCTION.sql`
5. Paste and run

### Step 4: Start Development Server

```bash
npm run dev
```

### Step 5: Test It Out! 🎉

Navigate to the AI Assistant page for your role:

- **Admin:** http://localhost:3000/admin/ai-assistant
- **Teacher:** http://localhost:3000/teacher/ai-assistant
- **Student:** http://localhost:3000/student/ai-assistant
- **Parent:** http://localhost:3000/parent/ai-assistant

## 🎯 Try These Sample Questions

### For Admins
- "How many students are enrolled in SSS1?"
- "Which teachers teach Mathematics?"
- "Show me students with attendance below 75%"
- "What are the average grades for Primary 6?"

### For Teachers
- "Which students in my class have low grades?"
- "Show me students who haven't submitted their assignments"
- "What is the average attendance in my classes?"

### For Students
- "What are my grades this term?"
- "Show me my attendance record"
- "Which assignments are due soon?"

### For Parents
- "How is my child doing academically?"
- "Show me their attendance this month"
- "Which subjects need improvement?"

## 🔧 Troubleshooting

### "OpenAI API key not configured"
**Fix:** Add your OpenAI API key to `.env.local`

### "Failed to execute query"
**Fix:** Make sure you ran the database migration (Step 3)

### Dependencies errors
**Fix:** Run `npm install` to install all packages

### "Unauthorized" error
**Fix:** Make sure you're logged in to the portal

## 📊 What's Included

✅ **Schema Description System** - Database structure for AI understanding  
✅ **AI Query Planner** - Converts questions to SQL  
✅ **Safe Query Executor** - Runs queries with RLS protection  
✅ **Result Summarizer** - Formats results in natural language  
✅ **Query Cache** - Reduces API calls by 70%  
✅ **Chat Interface** - Beautiful, responsive UI  
✅ **Role-Based Pages** - Customized for each user type  

## 💰 Cost Estimation

Using GPT-3.5-turbo:
- ~$0.002 per question (without cache)
- ~$0.0006 per question (with 70% cache hit rate)
- 1000 questions/month ≈ $0.60-$2.00

**Cost-saving tips:**
- Cache is enabled by default
- Use GPT-3.5 instead of GPT-4
- Set usage limits in OpenAI dashboard

## 🔒 Security Features

- ✅ Only SELECT queries allowed
- ✅ SQL injection protection via parameterized queries
- ✅ Row Level Security (RLS) enforced
- ✅ Multi-tenancy with school_id filtering
- ✅ Role-based data access

## 📚 Next Steps

1. ✅ Complete setup above
2. 📖 Read full documentation: [`AI_ASSISTANT_GUIDE.md`](./AI_ASSISTANT_GUIDE.md)
3. 🎨 Customize suggested questions in page files
4. 📊 Add more tables to `schema-description.ts`
5. 🚀 Deploy to production

## 🆘 Need Help?

Check the comprehensive guide: [`AI_ASSISTANT_GUIDE.md`](./AI_ASSISTANT_GUIDE.md)

---

**Ready to go? Start with Step 1 above! 🚀**
