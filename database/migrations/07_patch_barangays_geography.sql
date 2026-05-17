-- Patch barangays for Maragusan, Montevista, Mabini, Maco (Davao de Oro).
-- Aligns an existing database with database/02_seed_geography.sql after 2026 geography corrections.
--
-- Run in SQLyog / mysql client after USE ALERTO; safe to re-run:
--   INSERTs use NOT EXISTS (idempotent).
--   DELETEs run only when no row in patients or users references that barangay_id (FK RESTRICT).
--
-- If a DELETE affects 0 rows but obsolete names should go away, reassign or clear
-- patients.barangay_id / users.barangay_id for those barangays first, then run again.
--
-- After this patch, run 03_seed_users.sql again to create barangay logins for any
-- newly inserted barangays (that script is idempotent).

USE ALERTO;

-- ---------------------------------------------------------------------------
-- Maragusan: add Cambagang, Pamintaran; remove Cambawan
-- ---------------------------------------------------------------------------

INSERT INTO barangays (municipality_id, name)
SELECT m.id, 'Cambagang'
FROM municipalities m
INNER JOIN provinces p ON p.id = m.province_id
WHERE p.name = 'Davao de Oro' AND m.name = 'Maragusan'
  AND NOT EXISTS (
    SELECT 1 FROM barangays b WHERE b.municipality_id = m.id AND b.name = 'Cambagang'
  );

INSERT INTO barangays (municipality_id, name)
SELECT m.id, 'Pamintaran'
FROM municipalities m
INNER JOIN provinces p ON p.id = m.province_id
WHERE p.name = 'Davao de Oro' AND m.name = 'Maragusan'
  AND NOT EXISTS (
    SELECT 1 FROM barangays b WHERE b.municipality_id = m.id AND b.name = 'Pamintaran'
  );

DELETE b FROM barangays b
INNER JOIN municipalities m ON m.id = b.municipality_id
INNER JOIN provinces p ON p.id = m.province_id
WHERE p.name = 'Davao de Oro' AND m.name = 'Maragusan' AND b.name = 'Cambawan'
  AND NOT EXISTS (SELECT 1 FROM patients pt WHERE pt.barangay_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.barangay_id = b.id);

-- ---------------------------------------------------------------------------
-- Montevista: add Canidkid, New Calape, New Cebulan (Sambayon), New Dalaguete
-- ---------------------------------------------------------------------------

INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name
FROM municipalities m
INNER JOIN provinces p ON p.id = m.province_id
CROSS JOIN (
  SELECT 'Canidkid' AS name
  UNION ALL SELECT 'New Calape'
  UNION ALL SELECT 'New Cebulan (Sambayon)'
  UNION ALL SELECT 'New Dalaguete'
) j
WHERE p.name = 'Davao de Oro' AND m.name = 'Montevista'
  AND NOT EXISTS (
    SELECT 1 FROM barangays b WHERE b.municipality_id = m.id AND b.name = j.name
  );

-- ---------------------------------------------------------------------------
-- Mabini: add Anitapan, Cabuyuan, Cuambog, Pangibiran;
--         remove Concepcion, Cuvia, San Vicente (Mabini only)
-- ---------------------------------------------------------------------------

INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name
FROM municipalities m
INNER JOIN provinces p ON p.id = m.province_id
CROSS JOIN (
  SELECT 'Anitapan' AS name
  UNION ALL SELECT 'Cabuyuan'
  UNION ALL SELECT 'Cuambog'
  UNION ALL SELECT 'Pangibiran'
) j
WHERE p.name = 'Davao de Oro' AND m.name = 'Mabini'
  AND NOT EXISTS (
    SELECT 1 FROM barangays b WHERE b.municipality_id = m.id AND b.name = j.name
  );

DELETE b FROM barangays b
INNER JOIN municipalities m ON m.id = b.municipality_id
INNER JOIN provinces p ON p.id = m.province_id
WHERE p.name = 'Davao de Oro' AND m.name = 'Mabini'
  AND b.name IN ('Concepcion', 'Cuvia', 'San Vicente')
  AND NOT EXISTS (SELECT 1 FROM patients pt WHERE pt.barangay_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.barangay_id = b.id);

-- ---------------------------------------------------------------------------
-- Maco: add Buanan, New Leyte, New Visayas, Panangan, Tagbaros, Teresa,
--        Ubalaz, Unangian, Uracia, Vacolan, Vancezo
-- ---------------------------------------------------------------------------

INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name
FROM municipalities m
INNER JOIN provinces p ON p.id = m.province_id
CROSS JOIN (
  SELECT 'Buanan' AS name
  UNION ALL SELECT 'New Leyte'
  UNION ALL SELECT 'New Visayas'
  UNION ALL SELECT 'Panangan'
  UNION ALL SELECT 'Tagbaros'
  UNION ALL SELECT 'Teresa'
  UNION ALL SELECT 'Ubalaz'
  UNION ALL SELECT 'Unangian'
  UNION ALL SELECT 'Uracia'
  UNION ALL SELECT 'Vacolan'
  UNION ALL SELECT 'Vancezo'
) j
WHERE p.name = 'Davao de Oro' AND m.name = 'Maco'
  AND NOT EXISTS (
    SELECT 1 FROM barangays b WHERE b.municipality_id = m.id AND b.name = j.name
  );
