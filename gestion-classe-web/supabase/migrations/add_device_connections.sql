-- ============================================
-- Table device_connections: log each connection with device info
-- ============================================
CREATE TABLE IF NOT EXISTS device_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT NOT NULL,
  device_info TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'mobile')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE device_connections ENABLE ROW LEVEL SECURITY;

-- Users can insert their own connections
CREATE POLICY "Users can insert own device connections"
  ON device_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Dev can read all
CREATE POLICY "Dev can read all device connections"
  ON device_connections FOR SELECT
  USING (auth.jwt() ->> 'email' = 'tomicharles@gmail.com');

-- RPC to log a device connection
CREATE OR REPLACE FUNCTION log_device_connection(
  p_user_id UUID,
  p_user_email TEXT,
  p_device_info TEXT,
  p_platform TEXT DEFAULT 'web'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO device_connections (user_id, user_email, device_info, platform)
  VALUES (p_user_id, p_user_email, p_device_info, p_platform);
END;
$$;
