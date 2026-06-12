-- =============================================
-- Moleculla Guide Leads Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create guide_leads table
CREATE TABLE IF NOT EXISTS public.guide_leads (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  guide_slug TEXT NOT NULL,
  source_url TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guide_leads_email ON public.guide_leads (email);
CREATE INDEX IF NOT EXISTS idx_guide_leads_guide_slug ON public.guide_leads (guide_slug);
CREATE INDEX IF NOT EXISTS idx_guide_leads_created_at ON public.guide_leads (created_at);

-- 3. Enable RLS (the edge function uses service role key, so it bypasses RLS)
ALTER TABLE public.guide_leads ENABLE ROW LEVEL SECURITY;

-- 4. Create storage bucket for guides
INSERT INTO storage.buckets (id, name, public)
VALUES ('guides', 'guides', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policy: service role can read/write (edge function uses this)
-- No additional policies needed since we use service role key in the edge function

-- =============================================
-- After running this SQL:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Open the "guides" bucket
-- 3. Create folder: copper-dry-body-brushing
-- 4. Upload: moleculla-copper-dry-body-brushing-guide.pdf
-- 5. Create folder: hormone-balance
-- 6. Upload: moleculla-hormone-balance-guide.pdf
-- =============================================
