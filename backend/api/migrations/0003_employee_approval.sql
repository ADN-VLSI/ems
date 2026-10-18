ALTER TABLE employees
ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
CHECK (approval_status IN ('pending', 'approved'));

UPDATE employees
SET approval_status = 'approved'
WHERE lower(github_username) = 'foez-ahmed';
