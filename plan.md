## Plan: Alumni Directory and Approval Workflow

Add a school-scoped alumni feature under the existing public subdomain website flow: public alumni grid, individual profile page, public application form (with image + optional social links), and admin review with approve/reject. Reuse existing admissions moderation patterns and website theming/routing conventions to minimize risk and keep UX consistent.

**Steps**
1. Phase 1 - Data model and migration foundation
2. Add a new migration in `supabase/migrations/` to create two tables:
   - `website_alumni_profiles` (published records shown publicly)
   - `website_alumni_applications` (incoming submissions + moderation state)
3. Include school scoping and moderation fields:
   - Core: `school_id`, `full_name`, `occupation`, `image_url`, `story`, `status` (`pending|approved|rejected` on applications), `submitted_at`, `reviewed_at`, `reviewed_by`.
   - Optional links: `linkedin_url`, `x_url`, `tiktok_url`, `instagram_url`, `facebook_url`, and optional generic `website_url`.
   - Slugging: `profile_slug` on profiles with unique constraint per school.
4. Add indexes for admin queue and public reads:
   - Applications: `(school_id, status, submitted_at desc)`
   - Profiles: `(school_id, profile_slug)` and `(school_id, created_at desc)`.
5. Add RLS policies aligned to existing website/admissions patterns:
   - Admin authenticated users can manage rows for their school.
   - Public anonymous users can read approved alumni profiles only.
   - Public insert is allowed only for applications (pending), with strict column check.

6. Phase 2 - API layer
7. Create public API routes for alumni:
   - `app/api/alumni/applications/submit/route.ts` for unauthenticated submissions.
   - Optional upload handling in same endpoint via multipart (or companion upload route) to support applicant image upload.
8. Apply protections reused from admissions submit:
   - IP rate limiting, required field validation, URL validation for social links, size/type validation for image upload.
   - School resolution via `x-school-id` header from middleware for subdomain context.
9. Create admin API routes:
   - `app/api/admin/alumni/applications/route.ts` (GET with status/search pagination)
   - `app/api/admin/alumni/applications/[id]/approve/route.ts`
   - `app/api/admin/alumni/applications/[id]/reject/route.ts`
10. Approval behavior:
   - On approve: create row in `website_alumni_profiles` (auto-published), mark application approved + reviewer metadata.
   - On reject: mark rejected with optional reason.
   - Enforce idempotency guard (cannot re-approve/reject already processed submissions).

11. Phase 3 - Public website pages under subdomain routing
12. Extend catch-all route logic in `app/site/[subdomain]/[[...slug]]/page.tsx` to resolve alumni routes:
   - `/site/[subdomain]/alumni` -> alumni grid page
   - `/site/[subdomain]/alumni/[profileSlug]` -> individual profile page
   - `/site/[subdomain]/alumni/apply` -> alumni application page
13. Keep existing `home`/`hall-of-fame` behavior untouched; add branch handling that fetches `website_alumni_profiles` for listing/detail.
14. Add Alumni nav links in the shared header render function and route-aware active styling.
15. Build alumni grid card UI (image, name, occupation) and detail layout (full story + social links) using existing color CSS variables from current website theme helpers.
16. Build public alumni apply form UI using existing form style conventions from admissions page, with required fields + optional social URLs.

17. Phase 4 - Admin moderation UI
18. Add admin page `app/admin/alumni/page.tsx` with queue-first workflow patterned after admissions:
   - Filters: pending/approved/rejected + search.
   - List/table of applications with image preview, name, occupation, submit date.
   - View details pane/dialog with full story and links.
   - Approve/reject actions, confirmation dialogs, toast feedback, and auto-refresh.
19. Add admin navigation entry in `components/sidebar.tsx` for `/admin/alumni`.
20. Keep API usage consistent with existing auth helper patterns (admin check + school scope), preferably reusing `checkIsAdminWithSchool` where practical.

21. Phase 5 - Hardening and rollout
22. Add lightweight server-side normalization helpers for slug generation and URL sanitization.
23. Ensure rejection reason is stored and visible in admin history.
24. Add migration-safe defaults and nullability rules so older schools work without backfill scripts.

**Relevant files**
- `supabase/migrations/20260425_hall_of_fame_page_support.sql` - pattern for website schema extension and seed behavior.
- `supabase/migrations/20260422_website_builder_v1.sql` - RLS/policy style reference for website-scoped public/admin access.
- `app/site/[subdomain]/[[...slug]]/page.tsx` - public route resolution, shared theming, nav, and page rendering branches.
- `app/admin/website-builder/page.tsx` - current website admin UX conventions and page-scoped behavior references.
- `app/api/admin/website/pages/[slug]/route.ts` - admin website API structure and school-scoped update conventions.
- `app/api/admissions/submit/route.ts` - public submit validation and rate-limit pattern.
- `app/api/admissions/approve/route.ts` - approval action pattern and processed-state guards.
- `app/api/admissions/reject/route.ts` - rejection pattern.
- `app/admin/admissions/page.tsx` - admin moderation UI interactions and dialog flow.
- `components/sidebar.tsx` - admin navigation registration.
- `app/api/upload/route.ts` - authenticated upload behavior reference for adapting alumni image upload strategy.

**Verification**
1. Run migration and verify tables, constraints, indexes, and RLS policies are created correctly.
2. Manual API checks:
   - Public submit succeeds with valid payload and fails on invalid/missing fields.
   - Rate limiting returns 429 after configured threshold.
   - Approve moves application to approved and creates profile.
   - Reject updates status/reason and cannot process same item twice.
3. Public route checks on a school subdomain:
   - Alumni list renders approved profiles in grid.
   - Profile detail renders full story by slug.
   - Apply page submits successfully and creates pending application.
4. Admin checks:
   - Pending queue shows new submissions.
   - Approve/reject actions update badges and remove from pending list.
   - Search/filter combinations return expected rows.
5. Regression checks:
   - Home and Hall of Fame routes still render as before.
   - Existing admissions workflow remains unaffected.

**Decisions**
- Use subdomain public routes (inside `/site/[subdomain]` flow).
- Auto-publish alumni profile immediately on admin approval.
- Social media links are optional fields in both application and profile display.

**Further Considerations**
1. Image upload strategy recommendation: support direct file upload in alumni submit endpoint (multipart) so applicants do not need external hosting.
2. Optional future enhancement: split approved alumni management into a second admin page for post-approval edits/reordering/highlighting.
3. Optional future enhancement: add anti-spam CAPTCHA if public alumni submissions become high volume.