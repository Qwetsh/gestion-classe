-- ============================================
-- 1. User Activity tracking
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_email TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  login_count INTEGER DEFAULT 1 NOT NULL
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own activity
CREATE POLICY "Users can upsert their own activity"
  ON user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON user_activity FOR UPDATE
  USING (auth.uid() = user_id);

-- Dev can read all activity
CREATE POLICY "Dev can read all activity"
  ON user_activity FOR SELECT
  USING (auth.jwt() ->> 'email' = 'tomicharles@gmail.com');

-- ============================================
-- 2. Error Logs
-- ============================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  page_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert error logs
CREATE POLICY "Users can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only dev can read
CREATE POLICY "Dev can read all error logs"
  ON error_logs FOR SELECT
  USING (auth.jwt() ->> 'email' = 'tomicharles@gmail.com');

-- ============================================
-- 3. Announcements
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success')),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active announcements
CREATE POLICY "Authenticated users can read announcements"
  ON announcements FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only dev can insert/update/delete
CREATE POLICY "Dev can manage announcements"
  ON announcements FOR ALL
  USING (auth.jwt() ->> 'email' = 'tomicharles@gmail.com');

-- ============================================
-- 4. RPC: Track user activity (upsert + increment)
-- ============================================
CREATE OR REPLACE FUNCTION track_user_activity(p_user_id UUID, p_user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_activity (user_id, user_email, last_seen_at, login_count)
  VALUES (p_user_id, p_user_email, now(), 1)
  ON CONFLICT (user_id)
  DO UPDATE SET last_seen_at = now(), login_count = user_activity.login_count + 1, user_email = p_user_email;
END;
$$;

-- ============================================
-- 5. RPC: DB stats (row counts per table)
-- ============================================
CREATE OR REPLACE FUNCTION get_table_row_counts()
RETURNS TABLE(table_name TEXT, row_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'classes'::text, count(*) FROM classes
  UNION ALL
  SELECT 'students'::text, count(*) FROM students
  UNION ALL
  SELECT 'sessions'::text, count(*) FROM sessions
  UNION ALL
  SELECT 'events'::text, count(*) FROM events
  UNION ALL
  SELECT 'feedbacks'::text, count(*) FROM feedbacks
  UNION ALL
  SELECT 'user_activity'::text, count(*) FROM user_activity
  UNION ALL
  SELECT 'error_logs'::text, count(*) FROM error_logs
  UNION ALL
  SELECT 'announcements'::text, count(*) FROM announcements;
$$;
