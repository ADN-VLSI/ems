ALTER TABLE employees ADD COLUMN official_email TEXT;

UPDATE employees
SET role = 'employee'
WHERE role = 'admin' AND lower(github_username) <> 'foez-ahmed';

UPDATE employees
SET role = 'admin'
WHERE lower(github_username) = 'foez-ahmed';
