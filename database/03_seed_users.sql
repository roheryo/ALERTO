-- RBAC users (run after 02_seed_geography.sql)
--
-- Barangay accounts are created for every row in `barangays` (including names
-- added by 07_patch_barangays_geography.sql). This file is idempotent: you may
-- re-run it after the geography patch to insert only missing municipality /
-- barangay users without duplicating the province admin.
--
-- Default password for ALL seeded accounts: password
-- bcrypt hash below is generated with bcryptjs (same library as backend) — bcrypt.compare('password', hash) === true.
-- Replace hashes and rotate credentials before production.

USE ALERTO;

SET @hash := '$2b$10$G5AySNZqvm8rJmbX765y3OYR7pC7ZhbAxRorgY5031/K5VqvnFEi2';

-- Province (top level; seeded / super-admin equivalent — no manager in-app)
INSERT INTO users (
  full_name, email, contact_number, username, password_hash, role,
  managed_by_user_id, province_id, municipality_id, barangay_id
)
SELECT
  'Davao de Oro Province Administrator',
  'province.admin@alerto.local',
  '09170000000',
  'ddo_province_admin',
  @hash,
  'province',
  NULL,
  (SELECT id FROM provinces WHERE name = 'Davao de Oro' LIMIT 1),
  NULL,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'ddo_province_admin');

-- One municipality account per municipality (managed by province user)
INSERT INTO users (
  full_name, email, contact_number, username, password_hash, role,
  managed_by_user_id, province_id, municipality_id, barangay_id
)
SELECT
  CONCAT(m.name, ' — Municipality'),
  CONCAT('muni.', m.id, '@alerto.local'),
  '09170000000',
  CONCAT('muni_', m.id),
  @hash,
  'municipality',
  (SELECT id FROM users WHERE username = 'ddo_province_admin' LIMIT 1),
  m.province_id,
  m.id,
  NULL
FROM municipalities m
WHERE m.province_id = (SELECT id FROM provinces WHERE name = 'Davao de Oro' LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.role = 'municipality' AND u.municipality_id = m.id
  );

-- Exactly one barangay account per barangay (managed by that barangay's municipality account)
INSERT INTO users (
  full_name, email, contact_number, username, password_hash, role,
  managed_by_user_id, province_id, municipality_id, barangay_id
)
SELECT
  CONCAT(b.name, ' — Barangay'),
  CONCAT('brgy.', b.id, '@alerto.local'),
  '09990000000',
  CONCAT('brgy_', b.id),
  @hash,
  'barangay',
  mu.id,
  mun.province_id,
  b.municipality_id,
  b.id
FROM barangays b
JOIN municipalities mun ON mun.id = b.municipality_id
JOIN users mu
  ON mu.role = 'municipality'
 AND mu.municipality_id = b.municipality_id
WHERE mun.province_id = (SELECT id FROM provinces WHERE name = 'Davao de Oro' LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.role = 'barangay' AND u.barangay_id = b.id
  );
