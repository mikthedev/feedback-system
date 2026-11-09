-- =============================================================================
-- Top of the Month (TOTM)
-- Monthly curated selection, Featured Artist recognition, queue skips.
-- =============================================================================

-- Calendar month container (YYYY-MM)
CREATE TABLE IF NOT EXISTS totm_months (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'active', 'finalized')),
  review_count INTEGER NOT NULL DEFAULT 0,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (year, month)
);

-- Selected tracks for a month (active or historical)
CREATE TABLE IF NOT EXISTS totm_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  totm_month_id UUID NOT NULL REFERENCES totm_months(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  twitch_user_id TEXT NOT NULL,
  artist_name TEXT,
  song_title TEXT,
  genre TEXT,
  soundcloud_url TEXT NOT NULL,
  audience_score DECIMAL(3,1),
  curator_score DECIMAL(3,1) NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 10),
  review_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submission_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Active month: hidden from public when SoundCloud unavailable
  removed_from_active BOOLEAN NOT NULL DEFAULT false,
  removed_from_active_at TIMESTAMP WITH TIME ZONE,
  -- Historical: marked unavailable instead of deleted
  soundcloud_unavailable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (totm_month_id, submission_id),
  UNIQUE (totm_month_id, twitch_user_id),
  UNIQUE (totm_month_id, rank)
);

-- Permanent Featured Artist recognition (one row per Twitch ID, never duplicated)
CREATE TABLE IF NOT EXISTS totm_featured_artists (
  twitch_user_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_totm_month_id UUID REFERENCES totm_months(id) ON DELETE SET NULL,
  first_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  featured_email_sent_at TIMESTAMP WITH TIME ZONE,
  twitch_vip_granted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_totm_featured_artists_user_id
  ON totm_featured_artists(user_id);

-- Monthly queue skip rewards (one per artist per finalized month; stackable across months)
CREATE TABLE IF NOT EXISTS totm_queue_skips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  twitch_user_id TEXT NOT NULL,
  totm_month_id UUID NOT NULL REFERENCES totm_months(id) ON DELETE CASCADE,
  earned_year INTEGER NOT NULL,
  earned_month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'activated', 'consumed')),
  activated_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  activated_at TIMESTAMP WITH TIME ZONE,
  consumed_at TIMESTAMP WITH TIME ZONE,
  reward_email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (totm_month_id, twitch_user_id)
);

CREATE INDEX IF NOT EXISTS idx_totm_queue_skips_user_status
  ON totm_queue_skips(user_id, status);

-- Idempotent finalisation ledger
CREATE TABLE IF NOT EXISTS totm_finalization_log (
  totm_month_id UUID PRIMARY KEY REFERENCES totm_months(id) ON DELETE CASCADE,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  skips_granted INTEGER NOT NULL DEFAULT 0,
  featured_preserved INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track which submission used a TOTM skip (for queue placement + consume/restore)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS totm_skip_id UUID REFERENCES totm_queue_skips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_totm_skip_id
  ON submissions(totm_skip_id)
  WHERE totm_skip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_totm_months_year_month ON totm_months(year, month);
CREATE INDEX IF NOT EXISTS idx_totm_entries_month_rank ON totm_entries(totm_month_id, rank);
CREATE INDEX IF NOT EXISTS idx_totm_entries_month_active
  ON totm_entries(totm_month_id)
  WHERE removed_from_active = false;

DROP TRIGGER IF EXISTS update_totm_months_updated_at ON totm_months;
CREATE TRIGGER update_totm_months_updated_at
  BEFORE UPDATE ON totm_months
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_totm_entries_updated_at ON totm_entries;
CREATE TRIGGER update_totm_entries_updated_at
  BEFORE UPDATE ON totm_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_totm_featured_artists_updated_at ON totm_featured_artists;
CREATE TRIGGER update_totm_featured_artists_updated_at
  BEFORE UPDATE ON totm_featured_artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_totm_queue_skips_updated_at ON totm_queue_skips;
CREATE TRIGGER update_totm_queue_skips_updated_at
  BEFORE UPDATE ON totm_queue_skips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE totm_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_featured_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_queue_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_finalization_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'totm_months',
    'totm_entries',
    'totm_featured_artists',
    'totm_queue_skips',
    'totm_finalization_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS block_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS block_authenticated ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;
