-- Enable Row Level Security on all Prisma-managed public tables.
-- Rationale: Supabase exposes the public schema via PostgREST/the anon key.
-- These tables are accessed ONLY server-side through Prisma (the postgres
-- owner/service role, which BYPASSES RLS), so enabling RLS with no policies
-- is a safe, deny-by-default lockdown of the Data API surface and resolves
-- the Supabase "RLS disabled in public" security advisor. The app is
-- unaffected because the table owner bypasses RLS (no FORCE).

ALTER TABLE IF EXISTS public."advertisements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_error_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."article_workflow_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."articles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."breaking_news" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."contact_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."editorial_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."home_section_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."home_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."media_folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."page_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."preview_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."publish_job_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."redirects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."search_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."site_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."static_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."users" ENABLE ROW LEVEL SECURITY;
