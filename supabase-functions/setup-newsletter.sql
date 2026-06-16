-- =============================================
-- Moleculla Newsletter Signups
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. Table to store subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- 3. Allow anonymous visitors to INSERT (subscribe) only.
--    They cannot read, update, or delete rows — so the list stays private.
DROP POLICY IF EXISTS "anon can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "anon can subscribe"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4. Grant table privileges so the API role can see/insert into the table.
--    Without this GRANT, PostgREST hides the table from the schema cache and
--    inserts fail with "Could not find the table ... in the schema cache".
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.newsletter_subscribers_id_seq TO anon, authenticated;

-- 5. Refresh the API schema cache.
NOTIFY pgrst, 'reload schema';

-- =============================================
-- After running this, the homepage subscribe form works immediately.
-- View subscribers in Supabase Dashboard > Table Editor > newsletter_subscribers
-- (a duplicate email returns 409, which the form treats as "already subscribed").
-- =============================================
