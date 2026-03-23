-- Add archived column to feedbacks table
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Allow dev to update feedbacks (for archiving)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Dev can update feedbacks' AND tablename = 'feedbacks'
  ) THEN
    CREATE POLICY "Dev can update feedbacks"
      ON feedbacks FOR UPDATE
      USING (auth.jwt() ->> 'email' = 'tomicharles@gmail.com')
      WITH CHECK (auth.jwt() ->> 'email' = 'tomicharles@gmail.com');
  END IF;
END
$$;
