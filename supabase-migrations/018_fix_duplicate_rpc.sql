-- Drop the old overloaded versions (VARCHAR parameter) that conflict with the TEXT versions
DROP FUNCTION IF EXISTS get_student_academy(VARCHAR);
DROP FUNCTION IF EXISTS submit_academy_test(VARCHAR, JSONB, JSONB);
