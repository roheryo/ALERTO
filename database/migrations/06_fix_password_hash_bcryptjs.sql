-- Run once if you already loaded database/03_seed_users.sql with the old @hash
-- (login always failed with "password" because that hash was not valid for bcryptjs).
-- Sets every user's password to the literal: password

USE ALERTO;

SET @hash := '$2b$10$G5AySNZqvm8rJmbX765y3OYR7pC7ZhbAxRorgY5031/K5VqvnFEi2';

UPDATE users SET password_hash = @hash, updated_at = CURRENT_TIMESTAMP;
