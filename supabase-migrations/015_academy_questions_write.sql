-- Allow authenticated users (teachers) to manage questions & answers

CREATE POLICY "academy_questions_insert" ON academy_questions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "academy_questions_update" ON academy_questions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "academy_questions_delete" ON academy_questions
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "academy_answers_insert" ON academy_answers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "academy_answers_update" ON academy_answers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "academy_answers_delete" ON academy_answers
  FOR DELETE TO authenticated USING (true);
