-- Optional demo case logs (run after 03_seed_users.sql)

USE ALERTO;

INSERT INTO patients (
  name, age, sex, birthdate, civil_status, province,
  municipality_id, barangay_id, purok, birthplace,
  disease_type, date_started, created_by
)
SELECT
  'Juan Dela Cruz',
  '34',
  'Male',
  '1991-05-10',
  'Married',
  'Davao de Oro',
  m.id,
  b.id,
  'Purok 2',
  'Nabunturan',
  'Dengue',
  '2026-05-01',
  (SELECT u.id FROM users u
   JOIN barangays bb ON bb.id = u.barangay_id
   JOIN municipalities mm ON mm.id = bb.municipality_id
   WHERE u.role = 'barangay' AND mm.name = 'Nabunturan' AND bb.name = 'Basak'
   LIMIT 1)
FROM municipalities m
JOIN barangays b ON b.municipality_id = m.id AND b.name = 'Basak'
WHERE m.name = 'Nabunturan' LIMIT 1;

INSERT INTO patients (
  name, age, sex, birthdate, civil_status, province,
  municipality_id, barangay_id, purok, birthplace,
  disease_type, date_started, created_by
)
SELECT
  'Maria Santos',
  '28',
  'Female',
  '1998-02-14',
  'Single',
  'Davao de Oro',
  m.id,
  b.id,
  'Purok 1',
  'Monkayo',
  'Influenza-like illness (ILI)',
  '2026-05-05',
  (SELECT u.id FROM users u
   JOIN barangays bb ON bb.id = u.barangay_id
   JOIN municipalities mm ON mm.id = bb.municipality_id
   WHERE u.role = 'barangay' AND mm.name = 'Monkayo' AND bb.name = 'Awao'
   LIMIT 1)
FROM municipalities m
JOIN barangays b ON b.municipality_id = m.id AND b.name = 'Awao'
WHERE m.name = 'Monkayo' LIMIT 1;

INSERT INTO patients (
  name, age, sex, birthdate, civil_status, province,
  municipality_id, barangay_id, purok, birthplace,
  disease_type, date_started, created_by
)
SELECT
  'Pedro Reyes',
  '45',
  'Male',
  '1981-11-20',
  'Married',
  'Davao de Oro',
  m.id,
  b.id,
  NULL,
  'Compostela',
  'Acute Watery Diarrhea',
  '2026-05-08',
  (SELECT u.id FROM users u
   JOIN barangays bb ON bb.id = u.barangay_id
   JOIN municipalities mm ON mm.id = bb.municipality_id
   WHERE u.role = 'barangay' AND mm.name = 'Compostela' AND bb.name = 'Poblacion'
   LIMIT 1)
FROM municipalities m
JOIN barangays b ON b.municipality_id = m.id AND b.name = 'Poblacion'
WHERE m.name = 'Compostela' LIMIT 1;
