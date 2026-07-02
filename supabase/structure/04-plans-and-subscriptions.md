# Plans And Subscriptions Structure

This file covers the subscription management and plan-based feature gating system.

## Tables

### Plan Definitions
- `subscription_plans` — plan definitions with pricing, Paystack plan codes, and display metadata
  - Columns: `plan_key` ('basic', 'pro', 'premium'), `name`, `description`, `monthly_price`, `yearly_price`, `termly_price`, `monthly_paystack_plan_code`, `yearly_paystack_plan_code`, display columns (`label_short`, `color_tailwind`, `badge_color_tailwind`, `price_hint`, `border_color_tailwind`, `icon_bg_tailwind`)
- `subscription_plan_features` — customizable feature-to-plan mapping (super admin can enable/disable per plan)

### Feature & Route Management
- `subscription_features` — all feature metadata (label, icon, category, etc.) replacing hardcoded FEATURE_META
- `subscription_feature_routes` — URL-to-feature mappings for middleware plan enforcement

### School Subscriptions
- `school_subscriptions` — tracks each school's active subscription (plan, billing interval, Paystack codes, auth codes, grace period)
- `school_subscription_transactions` — subscription payment transaction records
- `plan_change_log` — audit trail for every plan change

### Manual Grants
- `school_plan_grants` — manual plan grants for cash/direct payment scenarios (term, session, or custom duration)

### Column Changes
- `schools.plan` — text column ('basic', 'pro', 'premium') with default 'basic'

## Core Functions

### Plan Helpers
- `get_school_plan(p_school_id)` — returns the plan key for a school
- `change_school_plan(p_school_id, p_new_plan, p_changed_by)` — atomic plan change + audit log
- `check_school_feature_access(p_school_id, p_feature_key)` — checks if a school has access to a feature

### Subscription Management
- `get_subscription_plans()` — returns all plans with features
- `update_subscription_plan(...)` — updates plan details with all display columns
- `toggle_plan_feature(p_plan_id, p_feature_key, p_is_enabled)` — enables/disables a feature for a plan
- `get_school_subscription(p_school_id)` — returns school subscription with plan details
- `upsert_school_subscription(...)` — creates or updates a school subscription
- `expire_school_subscription(p_school_id, p_grace_days)` — marks subscription as past_due
- `renew_school_subscription(...)` — renews subscription after successful payment
- `check_school_subscription_status(p_school_id)` — checks if subscription should be degraded
- `downgrade_school_to_basic(p_school_id)` — force downgrade after grace period expiry

### Grant Management
- `create_school_plan_grant(...)` — creates manual grant, updates plan + subscription + audit log
- `get_school_plan_grants(p_school_id, p_active_only)` — lists all plan grants with school name
- `expire_school_plan_grant(p_grant_id)` — marks a grant as inactive
- `expire_past_plan_grants()` — batch-expires grants past their expires_at

### Feature & Route Management
- `get_feature_routes()` — returns all route mappings for middleware (sorted longest-path-first)
- `get_features()` — returns all active features with metadata
- `upsert_feature(...)` — create or update a feature
- `delete_feature(p_feature_key)` — delete a feature (cascades to plan_features and routes)
- `add_feature_route(...)` — add a URL-to-feature mapping
- `delete_feature_route(p_route_id)` — delete a route mapping

### Cron/Utility
- `get_expired_grace_period_schools()` — finds schools with expired grace periods
- `get_schools_due_for_billing()` — finds schools with upcoming billing dates

## Dependency Order
- Core school table must exist first (for `schools.plan` column)
- `subscription_plans` and `subscription_plan_features` are seeded with defaults
- `school_subscriptions` links to both `schools` and `subscription_plans`
- Feature/route tables are standalone but referenced by middleware

## RLS And Access Notes
- Super admins manage plans, features, routes, grants, and subscriptions
- All authenticated users can read plans and features (needed for subscription UI)
- Schools can read their own subscription and grants
- `check_school_feature_access()` accounts for grace periods, expired status, and plan level
- Middleware uses `get_feature_routes()` to enforce plan-based access at the API/page level

## Historical Sources
- `supabase/migrations/20260626_add_plans_to_schools.sql`
- `supabase/migrations/20260626_plan_management.sql`
- `supabase/migrations/20260627_subscription_management.sql`
- `supabase/migrations/20260628_feature_routes_management.sql`
- `supabase/migrations/20260629_plan_display_info.sql`
- `supabase/migrations/20260701_school_plan_grants.sql`
- `supabase/migrations/20260701_termly_billing_subscriptions.sql`
- `supabase/migrations/20260702_fix_plan_grants_current_term.sql`
