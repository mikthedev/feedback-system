-- Add 'carryover' status for curator-skipped submissions.
-- When curator clicks "Skip", the submission is moved to carryover (status='carryover').
-- Carryover submissions are excluded from queue and require 60-min wait before user can submit again.
-- Tester role can bypass this restriction.

-- Add 'carryover' to submissions status check
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('pending', 'reviewed', 'carryover'));
