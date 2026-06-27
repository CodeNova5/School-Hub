# Subscription Billing System — Architecture & Deployment Guide

> **Last updated:** July 2026  
> **Context:** This system replaces the standard monthly/yearly recurring card model with a **termly billing** approach using Paystack **stored authorization codes**, designed specifically for the Nigerian school calendar.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [System Flow: End-to-End](#3-system-flow-end-to-end)
4. [File Index](#4-file-index)
5. [Environment Variables](#5-environment-variables)
6. [Cron Jobs](#6-cron-jobs)
7. [API Endpoints](#7-api-endpoints)
8. [Email Notifications](#8-email-notifications)
9. [Deployment Checklist](#9-deployment-checklist)
10. [Next Steps / Future Work](#10-next-steps--future-work)

---

## 1. Architecture Overview

### Core Concept
Instead of traditional recurring card subscriptions (monthly/yearly), this system uses **Paystack stored authorization codes** (`AUTH_xxxxx`) to charge schools on a **per-term** basis aligned with the academic calendar.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Billing Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────────┐     │
│  │ SCHOOL    │────▶│ PAYSTACK │────▶│ STORED AUTH CODE    │     │
│  │ subscribes│     │ checkout │     │ (AUTH_xxxxx) saved   │     │
│  │ via       │     │          │     │ in school_subscriptions│    │
│  │ /checkout │     │          │     │                      │     │
│  └──────────┘     └──────────┘     └──────────┬───────────┘     │
│                                                │                  │
│                    ┌───────────────────────────┘                  │
│                    ▼                                             │
│  ┌──────────────────────────────────────────────────┐           │
│  │           CRON: /api/cron/charge-subscriptions    │           │
│  │  (runs daily/weekly, charged due subscriptions)   │           │
│  │                                                   │           │
│  │  1. Fetch schools due via get_schools_due_for_billing RPC    │
│  │  2. For each: POST /transaction/charge_authorization         │
│  │  3. Success → renew_school_subscription() + email           │
│  │  4. Failure → expire_school_subscription() + email alarm    │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │     CRON: /api/cron/subscription-reminders        │           │
│  │  (runs daily, sends T-7 renewal reminder emails)  │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Termly over Monthly** | Schools operate on 3-term academic years. Monthly billing doesn't align with school calendars and creates confusion during holidays. |
| **Stored auth codes over Paystack Subscriptions** | Native Paystack subscriptions create fixed-interval recurring charges that can't skip holidays. Stored auth codes give us full control over when to charge. |
| **7-day grace period over immediate lockout** | Schools cannot be locked out mid-operation. A grace period allows payment recovery without operational disruption. |
| **Cron-based charging over webhook-only** | The cron endpoing proactively retries charges. The webhook serves as a real-time confirmation channel. |

---

## 2. Database Schema

### New / Modified Tables

#### `subscription_plans` (modified)
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `plan_key` | TEXT UNIQUE | `'basic'`, `'pro'`, or `'premium'` |
| `name` | TEXT | Display name |
| `description` | TEXT | Plan description |
| `monthly_price` | NUMERIC | Price in kobo (legacy) |
| **`termly_price`** | **NUMERIC** | **NEW — Price per academic term** |
| `yearly_price` | NUMERIC | Price for full year |
| `monthly_paystack_plan_code` | TEXT | Legacy Paystack plan code |
| `yearly_paystack_plan_code` | TEXT | Legacy Paystack plan code |
| `is_active` | BOOLEAN | |
| `sort_order` | INTEGER | Display order |
| `label_short`, `color_tailwind`, etc. | TEXT | Display styling |

#### `school_subscriptions` (modified)
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `school_id` | UUID FK→schools | One row per school |
| `plan_id` | UUID FK→subscription_plans | Current plan |
| `billing_interval` | TEXT | `'termly'` (new) or `'yearly'` |
| **`auth_code`** | **TEXT** | **NEW — Stored Paystack authorization code** |
| **`customer_email`** | **TEXT** | **NEW — Payer email** |
| **`customer_code`** | **TEXT** | **NEW — Paystack customer code** |
| **`next_billing_date`** | **TIMESTAMPTZ** | **NEW — When to next charge** |
| **`grace_period_ends_at`** | **TIMESTAMPTZ** | **NEW — End of grace period after failed payment** |
| **`current_term_id`** | **UUID FK→terms** | **NEW — Current academic term** |
| `paystack_subscription_code` | TEXT | Legacy |
| `paystack_customer_code` | TEXT | Legacy |
| `status` | TEXT | `'active'`, `'past_due'`, `'cancelled'`, `'expired'`, `'trialing'` |
| `current_period_start` | TIMESTAMPTZ | |
| `current_period_end` | TIMESTAMPTZ | |

#### `school_subscription_transactions` (NEW)
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `school_id` | UUID FK→schools | |
| `plan_id` | UUID FK→subscription_plans | |
| `billing_interval` | TEXT | `'termly'` or `'yearly'` |
| `reference` | TEXT UNIQUE | `SUB-{timestamp}-{random}` or `SUB-CRON-{timestamp}-{random}` |
| `amount` | NUMERIC | Amount in kobo |
| `status` | TEXT | `'pending'`, `'success'`, `'failed'`, `'abandoned'` |
| `auth_code` | TEXT | Authorization code received from Paystack |
| `paid_at` | TIMESTAMPTZ | |
| `metadata` | JSONB | Paystack response data |
| `created_by` | UUID FK→auth.users | |

### New Database Functions (RPCs)

| RPC | Purpose |
|-----|---------|
| `get_schools_due_for_billing()` | Returns active schools where `next_billing_date <= now()`, has valid `auth_code` |
| `get_expired_grace_period_schools()` | Returns schools where `status = 'past_due'` and `grace_period_ends_at < now()` |
| `expire_school_subscription(school_id, grace_days)` | Sets status to `'past_due'`, calculates grace period end |
| `renew_school_subscription(school_id, plan_id, ...)` | Renews subscription, updates dates, clears grace period |
| `downgrade_school_to_basic(school_id)` | Forces downgrade to Basic plan (after grace period expiry) |
| `check_school_subscription_status(school_id)` | Returns whether a school should be degraded |
| `check_school_feature_access(school_id, feature_key)` | **Updated** — now accounts for grace period and degraded status |

---

## 3. System Flow: End-to-End

### A. Initial Purchase (Checkout Flow)

```
User on /subscription
    │
    ├── Selects plan + billing interval (termly/yearly)
    │
    ▼
/checkout?plan=pro&interval=termly
    │
    ├── Shows order summary, price breakdown
    │
    ▼
POST /api/school/subscription/initialize
    │
    ├── Creates Paystack customer (if new)
    ├── Creates pending school_subscription_transactions record
    ├── Returns Paystack authorization URL
    │
    ▼
Paystack Checkout Page
    │
    ├── User enters card details
    ├── Payment processed
    │
    ▼
Paystack redirects to callback URL:
/checkout?reference=SUB-xxx&plan=pro&interval=termly
    │
    ▼
Checkout page useEffect fires:
GET /api/school/subscription/verify?reference=SUB-xxx
    │
    ├── Verifies with Paystack /transaction/verify
    ├── Stores authorization_code in school_subscriptions.auth_code
    ├── Upserts school_subscriptions record via RPC
    ├── Updates school.plan
    │
    ▼
Redirect to /checkout/success?plan=pro&interval=termly
```

### B. Recurring Charge (Cron Flow)

```
Cron Scheduler (daily at midnight)
    │
    ▼
GET/POST /api/cron/charge-subscriptions
(Protected by CRON_SECRET header)
    │
    ├── RPC: get_schools_due_for_billing()
    │   Returns schools with:
    │   - status = 'active'
    │   - auth_code IS NOT NULL
    │   - next_billing_date <= now()
    │
    ├── For each school (rate-limited to 100ms gap):
    │   ├── Create pending school_subscription_transactions
    │   ├── POST Paystack /transaction/charge_authorization
    │   │   { authorization_code, email, amount, reference, queue: true }
    │   │
    │   ├── ON SUCCESS:
    │   │   ├── Update transaction → status='success'
    │   │   ├── RPC: renew_school_subscription()
    │   │   ├── Update school.plan
    │   │   └── Email: sendPaymentSuccessConfirmation()
    │   │
    │   └── ON FAILURE:
    │       ├── Update transaction → status='failed'
    │       ├── RPC: expire_school_subscription(grace_days=7)
    │       └── Email: sendPaymentFailureAlert()
    │
    ▼
Returns JSON summary
{ processed, succeeded, failed, skipped, results[], duration_ms }
```

### C. Renewal Reminder (Cron Flow)

```
Cron Scheduler (daily at 8am)
    │
    ▼
GET/POST /api/cron/subscription-reminders
(Protected by CRON_SECRET header)
    │
    ├── Query school_subscriptions (single joined query):
    │   - status = 'active'
    │   - auth_code IS NOT NULL
    │   - next_billing_date BETWEEN T+6 AND T+8 days
    │
    ├── For each school:
    │   ├── Email: sendRenewalReminder(school_id)
    │   │   Subject: "Your Pro Subscription Renewal — School Name"
    │   │   Body: Plan, amount, scheduled date, "no action needed"
    │   └── Log to email_logs
    │
    ▼
Returns JSON summary
{ sent, failed, skipped, results[], duration_ms }
```

### D. Grace Period Workflow

```
Day 0: Charge fails via cron
    │
    ├── RPC: expire_school_subscription(grace_days=7)
    │   ├── status → 'past_due'
    │   ├── grace_period_ends_at → now + 7 days
    │   └── current_period_end → now
    │
    └── Email: sendPaymentFailureAlert()
        "Your payment failed. Grace period ends in 7 days."

Day 1-6: School in grace period
    │
    ├── check_school_feature_access() returns has_access = true
    │   (grace period still active — all features work)
    ├── School admin sees dashboard banner "Pay Now" (TBD)
    └── School can retry payment via checkout flow

Day 7: Grace period expires
    │
    ├── Cron: downgrade_school_to_basic()
    │   ├── school.plan → 'basic'
    │   └── school_subscriptions.status → 'expired'
    │
    └── check_school_feature_access() returns has_access = false
        (paid features locked, core features remain available)
```

---

## 4. File Index

### New Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260701_termly_billing_subscriptions.sql` | Database migration: schema changes, new columns, RPCs |
| `app/api/school/subscription/initialize/route.ts` | Paystack checkout initialization for subscription purchase |
| `app/api/school/subscription/verify/route.ts` | Verify payment and activate subscription |
| `app/api/cron/charge-subscriptions/route.ts` | Batch charge stored authorization codes |
| `app/api/cron/subscription-reminders/route.ts` | Send T-7 renewal reminder emails |
| `app/checkout/page.tsx` | Checkout page with plan review and Paystack payment |
| `app/checkout/success/page.tsx` | Payment success confirmation page |
| `lib/subscription-email.ts` | Email templates: reminder, failure alert, success confirmation |

### Modified Files

| File | Change |
|------|--------|
| `app/api/finance/paystack/webhook/route.ts` | Added subscription payment handling (SUB- prefix references) |
| `app/api/plans/route.ts` | Added `termly_price` to response |
| `app/subscription/page.tsx` | Changed billing toggle from Monthly/Yearly → Termly/Yearly |
| `app/super-admin/subscription/page.tsx` | Added `termly_price` to edit dialog and plan card display |
| `hooks/use-plan-display-info.ts` | Added `termly_price` to `PlanDisplayInfo` interface |

### Key Existing Files Used

| File | Purpose |
|------|---------|
| `lib/email.ts` | Resend email client (`sendEmailSafe`) |
| `lib/email-templates.ts` | HTML email template builder |
| `lib/plan-features.ts` | Plan upgrade path helper |
| `lib/route-enforcer.ts` | Middleware route-to-feature matching |
| `middleware.ts` | Plan enforcement for pages and API routes |
| `hooks/use-plan-features.ts` | Client-side feature access checking |
| `components/feature-locked-page.tsx` | Upgrade prompt UI |

---

## 5. Environment Variables

### Required

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All API routes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All API routes | Service role client (bypasses RLS) |
| `PAYSTACK_SECRET_KEY` | Initialize, verify, webhook, cron | Paystack API authentication |
| `CRON_SECRET` | Both cron endpoints | Authorization for cron job calls |
| `RESEND_API_KEY` | Email notifications | Transactional email delivery |

### Optional

| Variable | Default | Used By | Purpose |
|----------|---------|---------|---------|
| `RESEND_FROM_EMAIL` | `noreply@mail.schooldeck.tech` | All emails | Sender email address |
| `RESEND_FROM_NAME` | `School Deck` | All emails | Sender display name |

---

## 6. Cron Jobs

### Job 1: `POST/GET /api/cron/charge-subscriptions`

| Property | Value |
|----------|-------|
| **Schedule** | Daily or weekly (recommended: daily at midnight `0 0 * * *`) |
| **Auth** | `CRON_SECRET` via `Authorization: Bearer <secret>` or `x-api-key: <secret>` |
| **Idempotent** | Yes — uses unique references per run, `ON CONFLICT` on upsert |
| **Rate limit** | 100ms between Paystack calls (max 10 req/s) |
| **Timeout** | Allow 30+ seconds (depends on number of schools) |
| **Logs** | Console output + `school_subscription_transactions` table |

**Example call:**
```bash
curl -X POST https://yourdomain.com/api/cron/charge-subscriptions \
  -H "x-api-key: your-cron-secret"
```

**Example response:**
```json
{
  "success": true,
  "message": "Processed 12 schools (10 succeeded, 2 failed, 0 skipped)",
  "processed": 12,
  "succeeded": 10,
  "failed": 2,
  "skipped": 0,
  "results": [
    { "school_id": "...", "school_name": "Bright Stars Academy", "plan_key": "pro", "amount": 99700, "reference": "SUB-CRON-1719000000-ABC123", "status": "success" },
    { "school_id": "...", "school_name": "Royal College", "plan_key": "premium", "amount": 233000, "reference": "SUB-CRON-1719000000-DEF456", "status": "failed", "gateway_response": "Insufficient funds" }
  ],
  "duration_ms": 3450
}
```

### Job 2: `POST/GET /api/cron/subscription-reminders`

| Property | Value |
|----------|-------|
| **Schedule** | Daily (recommended: morning `0 8 * * *`) |
| **Auth** | `CRON_SECRET` via `Authorization: Bearer <secret>` or `x-api-key: <secret>` |
| **Idempotent** | Yes — sends at most once per school per day |
| **Timeout** | Allow 30+ seconds |
| **Logs** | Console output + `email_logs` table |

**Example call:**
```bash
curl -X GET https://yourdomain.com/api/cron/subscription-reminders \
  -H "Authorization: Bearer your-cron-secret"
```

### Setup: Vercel Cron Jobs

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/charge-subscriptions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/subscription-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Setup: cron-job.org

Create two cron jobs:
1. **URL:** `https://yourdomain.com/api/cron/charge-subscriptions`  
   **Schedule:** `0 0 * * *`  
   **Headers:** `x-api-key: your-cron-secret`
2. **URL:** `https://yourdomain.com/api/cron/subscription-reminders`  
   **Schedule:** `0 8 * * *`  
   **Headers:** `x-api-key: your-cron-secret`

---

## 7. API Endpoints

### Subscription Purchase

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/school/subscription/initialize` | POST | Admin session | Initialize Paystack checkout |
| `/api/school/subscription/verify` | GET | Admin session | Verify payment, activate subscription |

**Initialize — Request:**
```json
{
  "planId": "pro",
  "billingInterval": "termly"
}
```

**Initialize — Response:**
```json
{
  "authorizationUrl": "https://checkout.paystack.com/abc123",
  "accessCode": "abc123",
  "reference": "SUB-1719000000-ABC123"
}
```

### Cron

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/charge-subscriptions` | GET/POST | CRON_SECRET | Batch charge due subscriptions |
| `/api/cron/subscription-reminders` | GET/POST | CRON_SECRET | Send T-7 renewal reminders |

### Plan Information (existing)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/plans` | GET | Authenticated | Plan display info (now includes `termly_price`) |
| `/api/features` | GET | Authenticated | Feature metadata |
| `/api/school/plan-features` | GET | Authenticated | Plan-to-feature mapping |

### Super Admin (existing)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/super-admin/subscription-plans` | GET | Super admin | List plans (now includes `termly_price`) |
| `/api/super-admin/subscription-plans/[id]` | PATCH | Super admin | Update plan (now supports `termly_price`) |
| `/api/super-admin/subscription-plans/sync-paystack` | POST | Super admin | Sync plans to Paystack |
| `/api/super-admin/features` | GET/POST | Super admin | Manage feature metadata |
| `/api/super-admin/feature-routes` | GET/POST/DELETE | Super admin | Manage route mappings |

### Webhook (existing, modified)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/finance/paystack/webhook` | POST | Paystack signature | Handle payment events (now handles subscription payments with `SUB-` prefix) |

---

## 8. Email Notifications

All emails use **Resend** via `lib/email.ts` and are logged to the `email_logs` table.

### Email Types

| Type | Trigger | Recipient | Subject |
|------|---------|-----------|---------|
| `renewal_reminder` | T-7 days cron | School admin | "Your [Plan] Subscription Renewal — [School]" |
| `payment_failure` | Failed cron charge | School admin | "⚠️ Payment Failed — [Plan] Subscription — [School]" |
| `payment_success` | Successful cron charge | School admin | "✅ Payment Received — [Plan] Subscription — [School]" |

### Email Content Details

**Renewal Reminder:**
- Plan name, billing interval (Termly/Yearly)
- Amount in ₦
- Scheduled charge date
- Message: "No action needed if you have a saved payment method"
- CTA: Update payment method via dashboard

**Payment Failure Alert:**
- Plan name, amount
- Failure reason (from Paystack gateway_response)
- 7-day grace period end date
- Step-by-step instructions to update payment method

**Payment Success Confirmation:**
- Plan name, amount
- Valid-until date
- Message: "All features are available"

---

## 9. Deployment Checklist

### Before Deploying

- [ ] Run the new migration: `supabase/migrations/20260701_termly_billing_subscriptions.sql`
- [ ] Verify `termly_price` is seeded correctly for Pro (₦99,700) and Premium (₦233,000)
- [ ] Set environment variables (see [Section 5](#5-environment-variables))
- [ ] Configure cron job schedule (see [Section 6](#6-cron-jobs))

### After Deploying

- [ ] Verify `/api/plans` returns `termly_price` field
- [ ] Test checkout flow end-to-end:
  1. Navigate to `/subscription?plan=basic`
  2. Select Pro plan with termly billing
  3. Complete Paystack checkout
  4. Verify redirect to `/checkout/success`
  5. Check `school_subscriptions` has `auth_code` populated
- [ ] Verify super admin can edit `termly_price` in subscription management UI
- [ ] Test webhook: Trigger a Paystack test payment with `SUB-` reference prefix
- [ ] Test cron auth: Call cron endpoints with correct and incorrect `CRON_SECRET`
- [ ] Verify email delivery: Trigger `sendRenewalReminder` manually with a test school
- [ ] Check `email_logs` table for logged email records

### Rollback Plan

If issues arise:

1. **Disable cron jobs** — Remove them from cron scheduler
2. **Revert UI changes** — Subscription page still shows Monthly/Yearly toggle (old behavior is preserved)
3. **Revert migration** — Run a reverse migration to drop new columns:
   ```sql
   ALTER TABLE school_subscriptions 
     DROP COLUMN auth_code,
     DROP COLUMN customer_email,
     DROP COLUMN customer_code,
     DROP COLUMN next_billing_date,
     DROP COLUMN grace_period_ends_at,
     DROP COLUMN current_term_id;
   ALTER TABLE subscription_plans DROP COLUMN termly_price;
   DROP TABLE IF EXISTS school_subscription_transactions;
   ```
4. **Restore middleware** — Revert `check_school_feature_access` to original (no grace period logic)

---

## 10. Next Steps / Future Work

### High Priority

- [ ] **Grace period dashboard banner** — Component on admin dashboard that checks `check_school_subscription_status()` and shows "Pay Now" CTA with countdown when status is `past_due`
- [ ] **Admin subscription dashboard** — Page at `/admin/subscription` showing current plan, renewal dates, billing history with downloadable receipts, "Renew Term" button

### Medium Priority

- [ ] **Auto-downgrade cron** — Extend the cron job to call `get_expired_grace_period_schools()` and `downgrade_school_to_basic()` for schools past their grace period
- [ ] **Payment method update UI** — Allow school admins to update their stored card without re-subscribing (via Paystack's update customer endpoint)
- [ ] **Super admin subscription analytics** — Dashboard showing schools per plan, MRR, churn rate, failed payment trends

### Low Priority

- [ ] **Manual "charge now" button** — In super admin panel to trigger immediate billing for a specific school
- [ ] **SMS notifications** — Add SMS fallback for payment failure alerts (via WhatsApp logs infrastructure)
- [ ] **Invoice PDF generation** — Auto-generate and attach invoice PDF to payment success emails

---

## Appendix: Reference Numbers

### Current Pricing (Seeded)
| Plan | Monthly (legacy) | Termly (NEW) | Yearly |
|------|-----------------|--------------|--------|
| Basic | ₦0 | ₦0 | ₦0 |
| Pro | ₦29,900 | ₦99,700 | ₦299,000 |
| Premium | ₦69,900 | ₦233,000 | ₦699,000 |

### Transaction Reference Prefixes
| Prefix | Source | Example |
|--------|--------|---------|
| `SUB-` | Initial checkout via `/initialize` | `SUB-1719000000-ABC123` |
| `SUB-CRON-` | Cron auto-charge | `SUB-CRON-1719000000-DEF456` |
