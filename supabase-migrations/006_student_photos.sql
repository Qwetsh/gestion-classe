-- Migration: Student Photos
-- Description: Add photo storage support for students

-- 1. Add photo_path column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN students.photo_path IS 'Path to student photo in Supabase Storage (student-photos bucket)';

-- 2. Create storage bucket (done via Supabase Dashboard)
-- Bucket name: student-photos
-- Public: false
-- File size limit: 1MB
-- MIME type: image/*

-- 3. Storage RLS Policies (execute in SQL Editor)
-- Users can only access photos in their own folder (user_id/student_id.jpg)

CREATE POLICY "Users can upload student photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own student photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own student photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own student photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
