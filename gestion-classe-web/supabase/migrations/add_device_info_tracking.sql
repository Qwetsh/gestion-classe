-- Add device_info column to user_activity
ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS device_info TEXT;

-- Update RPC to accept device info
CREATE OR REPLACE FUNCTION track_user_activity(p_user_id UUID, p_user_email TEXT, p_device_info TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_activity (user_id, user_email, last_seen_at, login_count, device_info)
  VALUES (p_user_id, p_user_email, now(), 1, p_device_info)
  ON CONFLICT (user_id)
  DO UPDATE SET
    last_seen_at = now(),
    login_count = user_activity.login_count + 1,
    user_email = p_user_email,
    device_info = COALESCE(p_device_info, user_activity.device_info);
END;
$$;
