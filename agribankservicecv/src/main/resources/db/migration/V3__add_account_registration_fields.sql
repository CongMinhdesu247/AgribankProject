-- Add stable employee codes for the separate employee/IT sign-in flow.
-- The existing password column will store scrypt hashes after successful login.
ALTER TABLE users
    ADD COLUMN employee_code VARCHAR(30) NULL AFTER username;

UPDATE users
SET employee_code = UPPER(username)
WHERE employee_code IS NULL OR TRIM(employee_code) = '';

ALTER TABLE users
    MODIFY COLUMN employee_code VARCHAR(30) NOT NULL,
    ADD UNIQUE KEY uq_users_employee_code (employee_code);
