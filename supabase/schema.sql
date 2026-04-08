-- ============================================================
-- Digital Mailbox Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Profiles table (auto-linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT,
  full_name   TEXT,
  box_number  TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mail items table
CREATE TABLE IF NOT EXISTS public.mail_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  received_date   TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'pending_action', 'processing', 'completed', 'archived')),
  action          TEXT
                  CHECK (action IN (
                    'scan_requested', 'scan_completed',
                    'forward_requested', 'forwarded',
                    'shred_requested', 'shredded',
                    NULL
                  )),
  image_url       TEXT NOT NULL,
  scan_files      TEXT[],          -- array of scanned file URLs
  tracking_number TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mail timeline / history
CREATE TABLE IF NOT EXISTS public.mail_timeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_item_id  UUID REFERENCES public.mail_items(id) ON DELETE CASCADE NOT NULL,
  action        TEXT NOT NULL,
  performed_by  UUID REFERENCES public.profiles(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mail_items_customer_id ON public.mail_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_mail_items_status ON public.mail_items(status);
CREATE INDEX IF NOT EXISTS idx_mail_timeline_mail_item_id ON public.mail_timeline(mail_item_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_timeline ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own; admins see all
CREATE POLICY "users_own_profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "admins_all_profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Mail items: customers see only their own; admins see all
CREATE POLICY "customers_own_mail" ON public.mail_items
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "admins_all_mail" ON public.mail_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Timeline: same rules as mail items
CREATE POLICY "customers_own_timeline" ON public.mail_timeline
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mail_items
      WHERE id = mail_item_id AND customer_id = auth.uid()
    )
  );

CREATE POLICY "admins_all_timeline" ON public.mail_timeline
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- NOTE: The backend uses the service_role key which bypasses RLS.
-- RLS is a second layer of protection for direct DB access.
-- ============================================================
