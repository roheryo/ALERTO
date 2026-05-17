-- Derive usernames from full_name / geography for easy identification.
-- Safe to re-run: usernames are recomputed from current full_name and place names.
--
-- Patterns:
--   province:     davao_de_oro_province_administrator
--   municipality: {municipality_slug}_municipality   (e.g. compostela_municipality)
--   barangay:     {municipality_slug}_{barangay_slug} (e.g. compostela_poblacion)
--
-- Default password unchanged (password). Log in with the new username or existing email.

USE ALERTO;

-- Province administrator
UPDATE users
SET username = 'davao_de_oro_province_administrator'
WHERE role = 'province';

-- Municipality accounts (full_name is "{Municipality} — Municipality")
UPDATE users u
JOIN municipalities m ON m.id = u.municipality_id
SET u.username = CONCAT(
  LOWER(
    TRIM(
      BOTH '_'
      FROM REGEXP_REPLACE(
        REGEXP_REPLACE(m.name, '[^a-zA-Z0-9]+', '_'),
        '_+',
        '_'
      )
    )
  ),
  '_municipality'
)
WHERE u.role = 'municipality';

-- Barangay accounts (full_name is "{Barangay} — Barangay"; prefix municipality for uniqueness)
UPDATE users u
JOIN barangays b ON b.id = u.barangay_id
JOIN municipalities m ON m.id = b.municipality_id
SET u.username = CONCAT(
  LOWER(
    TRIM(
      BOTH '_'
      FROM REGEXP_REPLACE(
        REGEXP_REPLACE(m.name, '[^a-zA-Z0-9]+', '_'),
        '_+',
        '_'
      )
    )
  ),
  '_',
  LOWER(
    TRIM(
      BOTH '_'
      FROM REGEXP_REPLACE(
        REGEXP_REPLACE(b.name, '[^a-zA-Z0-9]+', '_'),
        '_+',
        '_'
      )
    )
  )
)
WHERE u.role = 'barangay';
