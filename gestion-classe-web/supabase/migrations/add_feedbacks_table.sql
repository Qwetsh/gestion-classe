-- Table for user feedback / bug reports
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'suggestion', 'autre')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS: users can insert their own feedback
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
  ON feedbacks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only tomicharles@gmail.com can read all feedbacks
CREATE POLICY "Dev can read all feedbacks"
  ON feedbacks FOR SELECT
  USING (auth.jwt() ->> 'email' = 'tomicharles@gmail.com');

-- Users can also read their own feedback
CREATE POLICY "Users can read their own feedback"
  ON feedbacks FOR SELECT
  USING (auth.uid() = user_id);
