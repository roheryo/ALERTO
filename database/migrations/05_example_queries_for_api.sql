-- Reference queries when wiring Node + mysql2 (RBAC roles: province | municipality | barangay)

USE ALERTO;

-- List patients with place names (parameterize scope from JWT).
/*
SELECT
  p.id,
  p.name,
  p.age,
  p.sex,
  p.birthdate,
  p.civil_status AS civilStatus,
  p.province,
  m.name AS municipality,
  b.name AS barangay,
  p.purok,
  p.birthplace,
  p.disease_type AS diseaseType,
  p.date_started AS dateStarted,
  p.created_at,
  p.updated_at
FROM patients p
JOIN municipalities m ON m.id = p.municipality_id
JOIN barangays b ON b.id = p.barangay_id
WHERE 1 = 1
  -- barangay role:
  -- AND p.barangay_id = :user_barangay_id
  -- municipality role:
  -- AND p.municipality_id = :user_municipality_id
  -- province role:
  -- AND m.province_id = :user_province_id
ORDER BY p.id DESC;
*/

-- Login: fetch user with jurisdiction (no public registration)
/*
SELECT
  u.id,
  u.username,
  u.full_name AS fullName,
  u.email,
  u.contact_number AS contactNumber,
  u.role,
  u.province_id AS provinceId,
  u.municipality_id AS municipalityId,
  u.barangay_id AS barangayId,
  p.name AS provinceName,
  m.name AS municipalityName,
  b.name AS barangayName
FROM users u
LEFT JOIN provinces p ON p.id = u.province_id
LEFT JOIN municipalities m ON m.id = u.municipality_id
LEFT JOIN barangays b ON b.id = u.barangay_id
WHERE u.username = ? AND u.is_active = 1
LIMIT 1;
*/
