-- Seed province, municipalities, barangays (Davao de Oro)
-- Barangay names match src/pages/Signup.jsx MUNICIPALITY_DATA for consistency with the UI.

USE ALERTO;

INSERT INTO provinces (name, code) VALUES ('Davao de Oro', '1123');

SET @p := (SELECT id FROM provinces WHERE name = 'Davao de Oro' LIMIT 1);

INSERT INTO municipalities (province_id, name) VALUES
(@p, 'Compostela'),
(@p, 'Maragusan'),
(@p, 'Monkayo'),
(@p, 'Montevista'),
(@p, 'New Bataan'),
(@p, 'Nabunturan'),
(@p, 'Laak'),
(@p, 'Mabini'),
(@p, 'Maco'),
(@p, 'Mawab'),
(@p, 'Pantukan');

-- Compostela
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Aurora' AS name UNION ALL SELECT 'Bagongon' UNION ALL SELECT 'Gabi' UNION ALL SELECT 'Lagab' UNION ALL SELECT 'Mangayon'
  UNION ALL SELECT 'Mapaca' UNION ALL SELECT 'Maparat' UNION ALL SELECT 'New Alegria' UNION ALL SELECT 'Ngan' UNION ALL SELECT 'Osmeña'
  UNION ALL SELECT 'Panansalan' UNION ALL SELECT 'Poblacion' UNION ALL SELECT 'San Jose' UNION ALL SELECT 'San Miguel'
  UNION ALL SELECT 'Siocon' UNION ALL SELECT 'Tamia'
) j WHERE m.name = 'Compostela';

-- Maragusan
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Bagong Silang' AS name UNION ALL SELECT 'Bahi' UNION ALL SELECT 'Cambawan' UNION ALL SELECT 'Coronobe' UNION ALL SELECT 'Katipunan'
  UNION ALL SELECT 'Lahi' UNION ALL SELECT 'Langgawisan' UNION ALL SELECT 'Mabugnao' UNION ALL SELECT 'Magcagong' UNION ALL SELECT 'Mahayahay'
  UNION ALL SELECT 'Mapawa' UNION ALL SELECT 'Maragusan (Poblacion)' UNION ALL SELECT 'Mauswagon' UNION ALL SELECT 'New Albay'
  UNION ALL SELECT 'New Katipunan' UNION ALL SELECT 'New Manay' UNION ALL SELECT 'New Panay' UNION ALL SELECT 'Paloc'
  UNION ALL SELECT 'Parasanon' UNION ALL SELECT 'Talian' UNION ALL SELECT 'Tandik' UNION ALL SELECT 'Tigbao' UNION ALL SELECT 'Tupaz'
  UNION ALL SELECT 'Tupaz Proper'
) j WHERE m.name = 'Maragusan';

-- Monkayo
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Awao' AS name UNION ALL SELECT 'Babag' UNION ALL SELECT 'Banlag' UNION ALL SELECT 'Baylo' UNION ALL SELECT 'Casoon'
  UNION ALL SELECT 'Haguimitan' UNION ALL SELECT 'Inambatan' UNION ALL SELECT 'Macopa' UNION ALL SELECT 'Mamunga'
  UNION ALL SELECT 'Mount Diwata' UNION ALL SELECT 'Naboc' UNION ALL SELECT 'Olaycon' UNION ALL SELECT 'Pasian'
  UNION ALL SELECT 'Poblacion' UNION ALL SELECT 'Rizal' UNION ALL SELECT 'Salvacion' UNION ALL SELECT 'San Isidro'
  UNION ALL SELECT 'San Jose' UNION ALL SELECT 'Tubo-tubo' UNION ALL SELECT 'Union' UNION ALL SELECT 'Upper Ulip'
) j WHERE m.name = 'Monkayo';

-- Montevista
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Banagbanag' AS name UNION ALL SELECT 'Banglasan' UNION ALL SELECT 'Bankerohan Norte' UNION ALL SELECT 'Bankerohan Sur'
  UNION ALL SELECT 'Camansi' UNION ALL SELECT 'Camantangan' UNION ALL SELECT 'Concepcion' UNION ALL SELECT 'Dauman'
  UNION ALL SELECT 'Kapatagan' UNION ALL SELECT 'Lebanon' UNION ALL SELECT 'Linoan' UNION ALL SELECT 'Mayaon'
  UNION ALL SELECT 'New Eagle' UNION ALL SELECT 'New Visayas' UNION ALL SELECT 'Prosperidad' UNION ALL SELECT 'San Jose'
  UNION ALL SELECT 'San Vicente' UNION ALL SELECT 'Santa Maria' UNION ALL SELECT 'Tapasan' UNION ALL SELECT 'Poblacion'
) j WHERE m.name = 'Montevista';

-- New Bataan
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Andap' AS name UNION ALL SELECT 'Bantacan' UNION ALL SELECT 'Batinao' UNION ALL SELECT 'Cabinuangan (Poblacion)'
  UNION ALL SELECT 'Camanlangan' UNION ALL SELECT 'Cogonon' UNION ALL SELECT 'Fatima' UNION ALL SELECT 'Kahayag'
  UNION ALL SELECT 'Katipunan' UNION ALL SELECT 'Magangit' UNION ALL SELECT 'Magsaysay' UNION ALL SELECT 'Manurigao'
  UNION ALL SELECT 'Pagsabangan' UNION ALL SELECT 'Panag' UNION ALL SELECT 'San Roque' UNION ALL SELECT 'Tandawan'
) j WHERE m.name = 'New Bataan';

-- Nabunturan
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Anislagan' AS name UNION ALL SELECT 'Antiquera' UNION ALL SELECT 'Basak' UNION ALL SELECT 'Bayabas' UNION ALL SELECT 'Bukal'
  UNION ALL SELECT 'Cabacungan' UNION ALL SELECT 'Cabidianan' UNION ALL SELECT 'Katipunan' UNION ALL SELECT 'Libasan'
  UNION ALL SELECT 'Linda' UNION ALL SELECT 'Magading' UNION ALL SELECT 'Magsaysay' UNION ALL SELECT 'Mainit'
  UNION ALL SELECT 'Manat' UNION ALL SELECT 'Matilo' UNION ALL SELECT 'Mipangi' UNION ALL SELECT 'New Dauis'
  UNION ALL SELECT 'New Sibonga' UNION ALL SELECT 'Ogao' UNION ALL SELECT 'Pangutosan' UNION ALL SELECT 'Poblacion'
  UNION ALL SELECT 'San Isidro' UNION ALL SELECT 'San Roque' UNION ALL SELECT 'San Vicente' UNION ALL SELECT 'Santa Maria'
  UNION ALL SELECT 'Santo Niño (Kao)' UNION ALL SELECT 'Sasa' UNION ALL SELECT 'Tagnocon'
) j WHERE m.name = 'Nabunturan';

-- Laak
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Aguinaldo' AS name UNION ALL SELECT 'Amor Cruz' UNION ALL SELECT 'Ampawid' UNION ALL SELECT 'Andap' UNION ALL SELECT 'Anitap'
  UNION ALL SELECT 'Bagong Silang' UNION ALL SELECT 'Banbanon' UNION ALL SELECT 'Belmonte' UNION ALL SELECT 'Binasbas'
  UNION ALL SELECT 'Bullucan' UNION ALL SELECT 'Cebulida' UNION ALL SELECT 'Concepcion' UNION ALL SELECT 'Datu Ampunan'
  UNION ALL SELECT 'Datu Davao' UNION ALL SELECT 'Doña Josefa' UNION ALL SELECT 'El Katipunan' UNION ALL SELECT 'Il Papa'
  UNION ALL SELECT 'Imelda' UNION ALL SELECT 'Inacayan' UNION ALL SELECT 'Kaligutan' UNION ALL SELECT 'Kapatagan'
  UNION ALL SELECT 'Kidawa' UNION ALL SELECT 'Kilagding' UNION ALL SELECT 'Kiokmay' UNION ALL SELECT 'Laak (Poblacion)'
  UNION ALL SELECT 'Langtud' UNION ALL SELECT 'Longanapan' UNION ALL SELECT 'Mabuhay' UNION ALL SELECT 'Macopa'
  UNION ALL SELECT 'Malinao' UNION ALL SELECT 'Mangloy' UNION ALL SELECT 'Melale' UNION ALL SELECT 'Naga'
  UNION ALL SELECT 'New Bethlehem' UNION ALL SELECT 'Panamoren' UNION ALL SELECT 'Sabud' UNION ALL SELECT 'San Antonio'
  UNION ALL SELECT 'Santa Emilia' UNION ALL SELECT 'Santo Niño' UNION ALL SELECT 'Sisimon'
) j WHERE m.name = 'Laak';

-- Mabini
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Cadunan' AS name UNION ALL SELECT 'Concepcion' UNION ALL SELECT 'Cuvia' UNION ALL SELECT 'Golden Valley (Maraut)'
  UNION ALL SELECT 'Libodon' UNION ALL SELECT 'Pindasan' UNION ALL SELECT 'Poblacion' UNION ALL SELECT 'San Antonio'
  UNION ALL SELECT 'San Vicente' UNION ALL SELECT 'Tagnanan (Mabini)' UNION ALL SELECT 'Del Pilar'
) j WHERE m.name = 'Mabini';

-- Maco
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Anibongan' AS name UNION ALL SELECT 'Anislagan' UNION ALL SELECT 'Binuangan' UNION ALL SELECT 'Bucana' UNION ALL SELECT 'Calabcab'
  UNION ALL SELECT 'Concepcion' UNION ALL SELECT 'Dumlan' UNION ALL SELECT 'Elizalde (Somil)' UNION ALL SELECT 'Gubatan'
  UNION ALL SELECT 'Hijo' UNION ALL SELECT 'Kinuban' UNION ALL SELECT 'Langgam' UNION ALL SELECT 'Lapu-lapu'
  UNION ALL SELECT 'Libay-libay' UNION ALL SELECT 'Limbo' UNION ALL SELECT 'Lumatab' UNION ALL SELECT 'Magangit'
  UNION ALL SELECT 'Mainit' UNION ALL SELECT 'Malamodao' UNION ALL SELECT 'Manipongol' UNION ALL SELECT 'Mapaang'
  UNION ALL SELECT 'Masara' UNION ALL SELECT 'New Asturias' UNION ALL SELECT 'New Barili' UNION ALL SELECT 'Panibasan'
  UNION ALL SELECT 'Panoraon' UNION ALL SELECT 'Pangi (Gaudencio Antonio)' UNION ALL SELECT 'Poblacion' UNION ALL SELECT 'San Juan'
  UNION ALL SELECT 'San Roque' UNION ALL SELECT 'Sangab' UNION ALL SELECT 'Taglawig'
) j WHERE m.name = 'Maco';

-- Mawab
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Andili' AS name UNION ALL SELECT 'Bawani' UNION ALL SELECT 'Concepcion' UNION ALL SELECT 'Malinawon'
  UNION ALL SELECT 'Nueva Visayas' UNION ALL SELECT 'Nuevo Iloco' UNION ALL SELECT 'Poblacion' UNION ALL SELECT 'Salvacion'
  UNION ALL SELECT 'Saosao' UNION ALL SELECT 'Sawangan' UNION ALL SELECT 'Tuboran'
) j WHERE m.name = 'Mawab';

-- Pantukan
INSERT INTO barangays (municipality_id, name)
SELECT m.id, j.name FROM municipalities m
CROSS JOIN (
  SELECT 'Araibo' AS name UNION ALL SELECT 'Bongabong' UNION ALL SELECT 'Bongbong' UNION ALL SELECT 'Kingking (Poblacion)'
  UNION ALL SELECT 'Las Arenas' UNION ALL SELECT 'Magnaga' UNION ALL SELECT 'Matiao' UNION ALL SELECT 'Napnapan'
  UNION ALL SELECT 'P. Fuentes' UNION ALL SELECT 'Tag-ugpo' UNION ALL SELECT 'Tagdangua' UNION ALL SELECT 'Tambongon'
  UNION ALL SELECT 'Tibagon'
) j WHERE m.name = 'Pantukan';
