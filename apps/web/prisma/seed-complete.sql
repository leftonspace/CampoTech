-- ═══════════════════════════════════════════════════════════════════════════════
-- CAMPOTECH - COMPREHENSIVE SEED DATA - COMPLETE
-- All tables with camelCase column names for Prisma
-- ═══════════════════════════════════════════════════════════════════════════════

-- NOTES ON LIMITATIONS:
-- 1. AFIP CAE numbers are simulated (real ones come from AFIP web service)
-- 2. WhatsApp message IDs are simulated (real ones come from Meta API)
-- 3. Password hashes use placeholder (real app should use bcrypt)
-- 4. Media URLs are placeholders (real app uses cloud storage)
-- 5. Mercado Pago references are simulated

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ORGANIZATION
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO organizations (id, name, phone, email, logo, settings, "createdAt", "updatedAt") VALUES
(
  'org_campotech_demo_001',
  'Clima Total Buenos Aires SRL',
  '+5491145678900',
  'contacto@climatotal.com.ar',
  'https://storage.campotech.com/logos/clima-total.png',
  '{
    "currency": "ARS",
    "timezone": "America/Argentina/Buenos_Aires",
    "language": "es-AR",
    "fiscalCondition": "RESPONSABLE_INSCRIPTO",
    "cuit": "30-71234567-9",
    "businessName": "CLIMA TOTAL BUENOS AIRES SRL",
    "address": {
      "street": "Av. Corrientes",
      "number": "1234",
      "city": "CABA",
      "province": "Buenos Aires",
      "postalCode": "C1043AAZ"
    },
    "workingHours": {
      "start": "08:00",
      "end": "18:00"
    },
    "emergencyFee": 50
  }'::jsonb,
  NOW() - INTERVAL '6 months',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. LOCATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO locations (id, "organizationId", code, name, type, address, coordinates, timezone, phone, email, "isHeadquarters", "isActive", "coverageRadius", "createdAt", "updatedAt") VALUES
(
  'loc_hq_palermo',
  'org_campotech_demo_001',
  'HQ-PAL',
  'Casa Central Palermo',
  'HEADQUARTERS',
  '{"street": "Av. Santa Fe", "number": "3200", "city": "CABA", "province": "Buenos Aires", "postalCode": "C1425BGQ", "country": "Argentina"}'::jsonb,
  '{"lat": -34.5875, "lng": -58.4108}'::jsonb,
  'America/Argentina/Buenos_Aires',
  '+5491145678900',
  'palermo@climatotal.com.ar',
  true,
  true,
  15,
  NOW() - INTERVAL '6 months',
  NOW()
),
(
  'loc_branch_belgrano',
  'org_campotech_demo_001',
  'SUC-BEL',
  'Sucursal Belgrano',
  'BRANCH',
  '{"street": "Av. Cabildo", "number": "2100", "city": "CABA", "province": "Buenos Aires", "postalCode": "C1428AAR", "country": "Argentina"}'::jsonb,
  '{"lat": -34.5614, "lng": -58.4561}'::jsonb,
  'America/Argentina/Buenos_Aires',
  '+5491145678901',
  'belgrano@climatotal.com.ar',
  false,
  true,
  10,
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'loc_branch_sanisidro',
  'org_campotech_demo_001',
  'SUC-SI',
  'Sucursal San Isidro',
  'BRANCH',
  '{"street": "Av. Centenario", "number": "456", "city": "San Isidro", "province": "Buenos Aires", "postalCode": "B1642", "country": "Argentina"}'::jsonb,
  '{"lat": -34.4708, "lng": -58.5276}'::jsonb,
  'America/Argentina/Buenos_Aires',
  '+5491145678902',
  'sanisidro@climatotal.com.ar',
  false,
  true,
  20,
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'loc_warehouse_pp',
  'org_campotech_demo_001',
  'DEP-PP',
  'Depósito Parque Patricios',
  'WAREHOUSE',
  '{"street": "Av. Caseros", "number": "3450", "city": "CABA", "province": "Buenos Aires", "postalCode": "C1263AAN", "country": "Argentina"}'::jsonb,
  '{"lat": -34.6389, "lng": -58.4017}'::jsonb,
  'America/Argentina/Buenos_Aires',
  '+5491145678903',
  'deposito@climatotal.com.ar',
  false,
  true,
  NULL,
  NOW() - INTERVAL '5 months',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ZONES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO zones (id, "locationId", code, name, description, color, priority, "isActive", "createdAt", "updatedAt") VALUES
('zone_palermo_norte', 'loc_hq_palermo', 'PAL-N', 'Palermo Norte', 'Palermo Soho, Palermo Hollywood, Las Cañitas', '#3B82F6', 1, true, NOW(), NOW()),
('zone_palermo_sur', 'loc_hq_palermo', 'PAL-S', 'Palermo Sur', 'Palermo Viejo, Villa Crespo', '#10B981', 2, true, NOW(), NOW()),
('zone_recoleta', 'loc_hq_palermo', 'REC', 'Recoleta', 'Recoleta, Barrio Norte', '#8B5CF6', 1, true, NOW(), NOW()),
('zone_colegiales', 'loc_hq_palermo', 'COL', 'Colegiales', 'Colegiales, Chacarita', '#F59E0B', 3, true, NOW(), NOW()),
('zone_belgrano_r', 'loc_branch_belgrano', 'BEL-R', 'Belgrano R', 'Belgrano R, Belgrano C', '#EF4444', 1, true, NOW(), NOW()),
('zone_nunez', 'loc_branch_belgrano', 'NUN', 'Núñez', 'Núñez, Saavedra', '#EC4899', 2, true, NOW(), NOW()),
('zone_sanisidro_centro', 'loc_branch_sanisidro', 'SI-C', 'San Isidro Centro', 'San Isidro centro y alrededores', '#14B8A6', 1, true, NOW(), NOW()),
('zone_martinez', 'loc_branch_sanisidro', 'MTZ', 'Martínez', 'Martínez, Acassuso', '#6366F1', 2, true, NOW(), NOW()),
('zone_olivos', 'loc_branch_sanisidro', 'OLI', 'Olivos', 'Olivos, La Lucila', '#84CC16', 3, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. USERS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO users (id, email, phone, name, "passwordHash", role, specialty, "skillLevel", avatar, "isActive", "organizationId", "homeLocationId", "createdAt", "updatedAt") VALUES
(
  'user_owner_carlos',
  'carlos.garcia@climatotal.com.ar',
  '+5491155551001',
  'Carlos García',
  '$2b$10$placeholder_hash_owner_carlos',
  'OWNER',
  NULL,
  NULL,
  'https://storage.campotech.com/avatars/carlos.jpg',
  true,
  'org_campotech_demo_001',
  'loc_hq_palermo',
  NOW() - INTERVAL '6 months',
  NOW()
),
(
  'user_dispatch_maria',
  'maria.lopez@climatotal.com.ar',
  '+5491155551002',
  'María López',
  '$2b$10$placeholder_hash_maria',
  'DISPATCHER',
  NULL,
  NULL,
  'https://storage.campotech.com/avatars/maria.jpg',
  true,
  'org_campotech_demo_001',
  'loc_hq_palermo',
  NOW() - INTERVAL '5 months',
  NOW()
),
(
  'user_dispatch_lucia',
  'lucia.fernandez@climatotal.com.ar',
  '+5491155551003',
  'Lucía Fernández',
  '$2b$10$placeholder_hash_lucia',
  'DISPATCHER',
  NULL,
  NULL,
  'https://storage.campotech.com/avatars/lucia.jpg',
  true,
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'user_tech_juan',
  'juan.perez@climatotal.com.ar',
  '+5491155551010',
  'Juan Pérez',
  '$2b$10$placeholder_hash_juan',
  'TECHNICIAN',
  'REFRIGERACION',
  'OFICIAL_ESPECIALIZADO',
  'https://storage.campotech.com/avatars/juan.jpg',
  true,
  'org_campotech_demo_001',
  'loc_hq_palermo',
  NOW() - INTERVAL '6 months',
  NOW()
),
(
  'user_tech_miguel',
  'miguel.torres@climatotal.com.ar',
  '+5491155551011',
  'Miguel Torres',
  '$2b$10$placeholder_hash_miguel',
  'TECHNICIAN',
  'REFRIGERACION',
  'OFICIAL',
  'https://storage.campotech.com/avatars/miguel.jpg',
  true,
  'org_campotech_demo_001',
  'loc_hq_palermo',
  NOW() - INTERVAL '5 months',
  NOW()
),
(
  'user_tech_pablo',
  'pablo.rodriguez@climatotal.com.ar',
  '+5491155551012',
  'Pablo Rodríguez',
  '$2b$10$placeholder_hash_pablo',
  'TECHNICIAN',
  'ELECTRICISTA',
  'OFICIAL_ESPECIALIZADO',
  'https://storage.campotech.com/avatars/pablo.jpg',
  true,
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'user_tech_diego',
  'diego.martinez@climatotal.com.ar',
  '+5491155551013',
  'Diego Martínez',
  '$2b$10$placeholder_hash_diego',
  'TECHNICIAN',
  'REFRIGERACION',
  'MEDIO_OFICIAL',
  'https://storage.campotech.com/avatars/diego.jpg',
  true,
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'user_tech_martin',
  'martin.gonzalez@climatotal.com.ar',
  '+5491155551014',
  'Martín González',
  '$2b$10$placeholder_hash_martin',
  'TECHNICIAN',
  'GASISTA',
  'OFICIAL',
  'https://storage.campotech.com/avatars/martin.jpg',
  true,
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  NOW() - INTERVAL '2 months',
  NOW()
),
(
  'user_tech_lucas',
  'lucas.silva@climatotal.com.ar',
  '+5491155551015',
  'Lucas Silva',
  '$2b$10$placeholder_hash_lucas',
  'TECHNICIAN',
  'REFRIGERACION',
  'AYUDANTE',
  'https://storage.campotech.com/avatars/lucas.jpg',
  true,
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  NOW() - INTERVAL '1 month',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. EMPLOYEE SCHEDULES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Juan Pérez - Monday to Saturday
INSERT INTO employee_schedules (id, "userId", "organizationId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt") VALUES
('sched_juan_mon', 'user_tech_juan', 'org_campotech_demo_001', 1, '08:00', '17:00', true, NOW(), NOW()),
('sched_juan_tue', 'user_tech_juan', 'org_campotech_demo_001', 2, '08:00', '17:00', true, NOW(), NOW()),
('sched_juan_wed', 'user_tech_juan', 'org_campotech_demo_001', 3, '08:00', '17:00', true, NOW(), NOW()),
('sched_juan_thu', 'user_tech_juan', 'org_campotech_demo_001', 4, '08:00', '17:00', true, NOW(), NOW()),
('sched_juan_fri', 'user_tech_juan', 'org_campotech_demo_001', 5, '08:00', '17:00', true, NOW(), NOW()),
('sched_juan_sat', 'user_tech_juan', 'org_campotech_demo_001', 6, '09:00', '13:00', true, NOW(), NOW());

-- Miguel Torres - Monday to Friday
INSERT INTO employee_schedules (id, "userId", "organizationId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt") VALUES
('sched_miguel_mon', 'user_tech_miguel', 'org_campotech_demo_001', 1, '08:00', '17:00', true, NOW(), NOW()),
('sched_miguel_tue', 'user_tech_miguel', 'org_campotech_demo_001', 2, '08:00', '17:00', true, NOW(), NOW()),
('sched_miguel_wed', 'user_tech_miguel', 'org_campotech_demo_001', 3, '08:00', '17:00', true, NOW(), NOW()),
('sched_miguel_thu', 'user_tech_miguel', 'org_campotech_demo_001', 4, '08:00', '17:00', true, NOW(), NOW()),
('sched_miguel_fri', 'user_tech_miguel', 'org_campotech_demo_001', 5, '08:00', '17:00', true, NOW(), NOW());

-- Pablo Rodríguez - Monday to Saturday
INSERT INTO employee_schedules (id, "userId", "organizationId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt") VALUES
('sched_pablo_mon', 'user_tech_pablo', 'org_campotech_demo_001', 1, '09:00', '18:00', true, NOW(), NOW()),
('sched_pablo_tue', 'user_tech_pablo', 'org_campotech_demo_001', 2, '09:00', '18:00', true, NOW(), NOW()),
('sched_pablo_wed', 'user_tech_pablo', 'org_campotech_demo_001', 3, '09:00', '18:00', true, NOW(), NOW()),
('sched_pablo_thu', 'user_tech_pablo', 'org_campotech_demo_001', 4, '09:00', '18:00', true, NOW(), NOW()),
('sched_pablo_fri', 'user_tech_pablo', 'org_campotech_demo_001', 5, '09:00', '18:00', true, NOW(), NOW()),
('sched_pablo_sat', 'user_tech_pablo', 'org_campotech_demo_001', 6, '09:00', '13:00', true, NOW(), NOW());

-- Diego Martínez - Monday to Friday
INSERT INTO employee_schedules (id, "userId", "organizationId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt") VALUES
('sched_diego_mon', 'user_tech_diego', 'org_campotech_demo_001', 1, '08:00', '16:00', true, NOW(), NOW()),
('sched_diego_tue', 'user_tech_diego', 'org_campotech_demo_001', 2, '08:00', '16:00', true, NOW(), NOW()),
('sched_diego_wed', 'user_tech_diego', 'org_campotech_demo_001', 3, '08:00', '16:00', true, NOW(), NOW()),
('sched_diego_thu', 'user_tech_diego', 'org_campotech_demo_001', 4, '08:00', '16:00', true, NOW(), NOW()),
('sched_diego_fri', 'user_tech_diego', 'org_campotech_demo_001', 5, '08:00', '16:00', true, NOW(), NOW());

-- Martín González - Tuesday to Saturday
INSERT INTO employee_schedules (id, "userId", "organizationId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt") VALUES
('sched_martin_tue', 'user_tech_martin', 'org_campotech_demo_001', 2, '08:00', '17:00', true, NOW(), NOW()),
('sched_martin_wed', 'user_tech_martin', 'org_campotech_demo_001', 3, '08:00', '17:00', true, NOW(), NOW()),
('sched_martin_thu', 'user_tech_martin', 'org_campotech_demo_001', 4, '08:00', '17:00', true, NOW(), NOW()),
('sched_martin_fri', 'user_tech_martin', 'org_campotech_demo_001', 5, '08:00', '17:00', true, NOW(), NOW()),
('sched_martin_sat', 'user_tech_martin', 'org_campotech_demo_001', 6, '08:00', '14:00', true, NOW(), NOW());

-- Lucas Silva - Monday to Friday (part-time)
INSERT INTO employee_schedules (id, "userId", "organizationId", "dayOfWeek", "startTime", "endTime", "isAvailable", "createdAt", "updatedAt") VALUES
('sched_lucas_mon', 'user_tech_lucas', 'org_campotech_demo_001', 1, '13:00', '18:00', true, NOW(), NOW()),
('sched_lucas_tue', 'user_tech_lucas', 'org_campotech_demo_001', 2, '13:00', '18:00', true, NOW(), NOW()),
('sched_lucas_wed', 'user_tech_lucas', 'org_campotech_demo_001', 3, '13:00', '18:00', true, NOW(), NOW()),
('sched_lucas_thu', 'user_tech_lucas', 'org_campotech_demo_001', 4, '13:00', '18:00', true, NOW(), NOW()),
('sched_lucas_fri', 'user_tech_lucas', 'org_campotech_demo_001', 5, '13:00', '18:00', true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. SCHEDULE EXCEPTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO schedule_exceptions (id, "userId", "organizationId", date, "isAvailable", reason, "createdAt") VALUES
('exc_juan_xmas', 'user_tech_juan', 'org_campotech_demo_001', '2025-12-25', false, 'Navidad', NOW()),
('exc_juan_newyear', 'user_tech_juan', 'org_campotech_demo_001', '2026-01-01', false, 'Año Nuevo', NOW()),
('exc_miguel_xmas', 'user_tech_miguel', 'org_campotech_demo_001', '2025-12-25', false, 'Navidad', NOW()),
('exc_miguel_newyear', 'user_tech_miguel', 'org_campotech_demo_001', '2026-01-01', false, 'Año Nuevo', NOW()),
('exc_pablo_xmas', 'user_tech_pablo', 'org_campotech_demo_001', '2025-12-25', false, 'Navidad', NOW()),
('exc_pablo_newyear', 'user_tech_pablo', 'org_campotech_demo_001', '2026-01-01', false, 'Año Nuevo', NOW()),
('exc_juan_vac1', 'user_tech_juan', 'org_campotech_demo_001', '2026-01-13', false, 'Vacaciones', NOW()),
('exc_juan_vac2', 'user_tech_juan', 'org_campotech_demo_001', '2026-01-14', false, 'Vacaciones', NOW()),
('exc_juan_vac3', 'user_tech_juan', 'org_campotech_demo_001', '2026-01-15', false, 'Vacaciones', NOW()),
('exc_juan_vac4', 'user_tech_juan', 'org_campotech_demo_001', '2026-01-16', false, 'Vacaciones', NOW()),
('exc_juan_vac5', 'user_tech_juan', 'org_campotech_demo_001', '2026-01-17', false, 'Vacaciones', NOW()),
('exc_diego_sick', 'user_tech_diego', 'org_campotech_demo_001', '2025-12-10', false, 'Licencia por enfermedad', NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. CUSTOMERS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO customers (id, name, phone, email, address, notes, "organizationId", "locationId", "zoneId", "createdAt", "updatedAt") VALUES
(
  'cust_gonzalez_ana',
  'Ana González',
  '+5491144441001',
  'ana.gonzalez@gmail.com',
  '{"street": "Honduras", "number": "4800", "floor": "3", "apartment": "B", "city": "CABA", "postalCode": "C1414BNJ", "coordinates": {"lat": -34.5867, "lng": -58.4294}}'::jsonb,
  'Departamento esquina. Portero eléctrico código 3B.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'cust_martinez_roberto',
  'Roberto Martínez',
  '+5491144441002',
  'roberto.martinez@hotmail.com',
  '{"street": "Gorriti", "number": "5600", "floor": null, "apartment": null, "city": "CABA", "postalCode": "C1414BJB", "coordinates": {"lat": -34.5822, "lng": -58.4367}}'::jsonb,
  'Casa con garaje. Tiene perro.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'cust_silva_patricia',
  'Patricia Silva',
  '+5491144441003',
  'patricia.silva@gmail.com',
  '{"street": "Thames", "number": "2100", "floor": "5", "apartment": "A", "city": "CABA", "postalCode": "C1425FFC", "coordinates": {"lat": -34.5889, "lng": -58.4247}}'::jsonb,
  'Edificio con encargado 8-18hs.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_sur',
  NOW() - INTERVAL '5 months',
  NOW()
),
(
  'cust_fernandez_jorge',
  'Jorge Fernández',
  '+5491144441004',
  'jorge.fernandez@yahoo.com.ar',
  '{"street": "Av. Córdoba", "number": "5200", "floor": "8", "apartment": "C", "city": "CABA", "postalCode": "C1414BAP", "coordinates": {"lat": -34.5941, "lng": -58.4298}}'::jsonb,
  NULL,
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_sur',
  NOW() - INTERVAL '2 months',
  NOW()
),
(
  'cust_rodriguez_marta',
  'Marta Rodríguez',
  '+5491144441005',
  'marta.rodriguez@gmail.com',
  '{"street": "Juncal", "number": "2800", "floor": "4", "apartment": "D", "city": "CABA", "postalCode": "C1425AYL", "coordinates": {"lat": -34.5876, "lng": -58.3984}}'::jsonb,
  'Prefiere horarios por la tarde.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_recoleta',
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'cust_lopez_eduardo',
  'Eduardo López',
  '+5491144441006',
  NULL,
  '{"street": "Av. Callao", "number": "1500", "floor": "2", "apartment": "F", "city": "CABA", "postalCode": "C1024AAP", "coordinates": {"lat": -34.5978, "lng": -58.3923}}'::jsonb,
  'Oficina comercial. Horario L-V 9-18.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_recoleta',
  NOW() - INTERVAL '6 months',
  NOW()
),
(
  'cust_diaz_carmen',
  'Carmen Díaz',
  '+5491144441007',
  'carmen.diaz@outlook.com',
  '{"street": "Av. Federico Lacroze", "number": "2200", "floor": null, "apartment": null, "city": "CABA", "postalCode": "C1426CPF", "coordinates": {"lat": -34.5743, "lng": -58.4456}}'::jsonb,
  'Local comercial - Panadería. Llamar antes de ir.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_colegiales',
  NOW() - INTERVAL '1 month',
  NOW()
),
(
  'cust_perez_luis',
  'Luis Pérez',
  '+5491144441008',
  'luis.perez@gmail.com',
  '{"street": "Av. Cabildo", "number": "2800", "floor": "6", "apartment": "A", "city": "CABA", "postalCode": "C1428AAT", "coordinates": {"lat": -34.5578, "lng": -58.4598}}'::jsonb,
  NULL,
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  'zone_belgrano_r',
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'cust_sanchez_maria',
  'María Sánchez',
  '+5491144441009',
  'maria.sanchez@gmail.com',
  '{"street": "Juramento", "number": "2400", "floor": "10", "apartment": "B", "city": "CABA", "postalCode": "C1428DND", "coordinates": {"lat": -34.5612, "lng": -58.4534}}'::jsonb,
  'Torre nueva. Muy exigente con puntualidad.',
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  'zone_belgrano_r',
  NOW() - INTERVAL '5 months',
  NOW()
),
(
  'cust_gomez_ricardo',
  'Ricardo Gómez',
  '+5491144441010',
  'ricardo.gomez@empresa.com.ar',
  '{"street": "Av. del Libertador", "number": "7200", "floor": "3", "apartment": null, "city": "CABA", "postalCode": "C1429BMN", "coordinates": {"lat": -34.5432, "lng": -58.4623}}'::jsonb,
  'Empresa - Recepción planta baja.',
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  'zone_nunez',
  NOW() - INTERVAL '2 months',
  NOW()
),
(
  'cust_herrera_susana',
  'Susana Herrera',
  '+5491144441011',
  'susana.herrera@hotmail.com',
  '{"street": "Congreso", "number": "2100", "floor": null, "apartment": null, "city": "CABA", "postalCode": "C1428ARA", "coordinates": {"lat": -34.5589, "lng": -58.4621}}'::jsonb,
  'Casa con jardín. Timbre no funciona, golpear.',
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  'zone_belgrano_r',
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'cust_moreno_andres',
  'Andrés Moreno',
  '+5491144441012',
  'andres.moreno@gmail.com',
  '{"street": "Av. Centenario", "number": "1200", "floor": null, "apartment": null, "city": "San Isidro", "postalCode": "B1642DQD", "coordinates": {"lat": -34.4678, "lng": -58.5234}}'::jsonb,
  'Casa grande. Equipo en quincho.',
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  'zone_sanisidro_centro',
  NOW() - INTERVAL '2 months',
  NOW()
),
(
  'cust_romero_claudia',
  'Claudia Romero',
  '+5491144441013',
  'claudia.romero@yahoo.com',
  '{"street": "9 de Julio", "number": "456", "floor": "2", "apartment": "A", "city": "San Isidro", "postalCode": "B1642AZH", "coordinates": {"lat": -34.4712, "lng": -58.5267}}'::jsonb,
  NULL,
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  'zone_sanisidro_centro',
  NOW() - INTERVAL '1 month',
  NOW()
),
(
  'cust_castro_pablo',
  'Pablo Castro',
  '+5491144441014',
  'pablo.castro@gmail.com',
  '{"street": "Av. Santa Fe", "number": "800", "floor": null, "apartment": null, "city": "Martínez", "postalCode": "B1640AAP", "coordinates": {"lat": -34.4923, "lng": -58.5089}}'::jsonb,
  'Restaurante. Urgencias 24hs.',
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  'zone_martinez',
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'cust_vargas_elena',
  'Elena Vargas',
  '+5491144441015',
  'elena.vargas@outlook.com',
  '{"street": "Av. del Libertador", "number": "16500", "floor": "15", "apartment": "C", "city": "Olivos", "postalCode": "B1636DSQ", "coordinates": {"lat": -34.5089, "lng": -58.4834}}'::jsonb,
  'Torre premium. Anunciarse en seguridad.',
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  'zone_olivos',
  NOW() - INTERVAL '2 months',
  NOW()
),
(
  'cust_medina_fernando',
  'Fernando Medina',
  '+5491144441016',
  'fernando.medina@gmail.com',
  '{"street": "Rawson", "number": "2300", "floor": null, "apartment": null, "city": "Olivos", "postalCode": "B1636ECH", "coordinates": {"lat": -34.5134, "lng": -58.4912}}'::jsonb,
  'Consultorio médico. Solo mañanas.',
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  'zone_olivos',
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'cust_aguirre_diego',
  'Diego Aguirre',
  '+5491144441017',
  'diego.aguirre@gmail.com',
  '{"street": "Av. Santa Fe", "number": "4200", "floor": "7", "apartment": "E", "city": "CABA", "postalCode": "C1425BHN", "coordinates": {"lat": -34.5892, "lng": -58.4156}}'::jsonb,
  NULL,
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  NOW() - INTERVAL '2 weeks',
  NOW()
),
(
  'cust_benitez_carolina',
  'Carolina Benítez',
  '+5491144441018',
  'carolina.benitez@hotmail.com',
  '{"street": "Güemes", "number": "4400", "floor": "1", "apartment": "A", "city": "CABA", "postalCode": "C1425BMF", "coordinates": {"lat": -34.5845, "lng": -58.4189}}'::jsonb,
  'Estudio de arquitectura.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  NOW() - INTERVAL '1 week',
  NOW()
),
(
  'cust_campos_oscar',
  'Oscar Campos',
  '+5491144441019',
  NULL,
  '{"street": "Arévalo", "number": "2100", "floor": null, "apartment": null, "city": "CABA", "postalCode": "C1414CQK", "coordinates": {"lat": -34.5789, "lng": -58.4378}}'::jsonb,
  'Local de ropa. Equipo en depósito trasero.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  NOW() - INTERVAL '3 weeks',
  NOW()
),
(
  'cust_delgado_rosa',
  'Rosa Delgado',
  '+5491144441020',
  'rosa.delgado@gmail.com',
  '{"street": "Av. Pueyrredón", "number": "1800", "floor": "4", "apartment": "B", "city": "CABA", "postalCode": "C1119ACP", "coordinates": {"lat": -34.5934, "lng": -58.3978}}'::jsonb,
  'Edificio antiguo sin ascensor.',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_recoleta',
  NOW() - INTERVAL '5 weeks',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. PRODUCT CATEGORIES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO product_categories (id, "organizationId", "parentId", code, name, description, "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
('cat_refrigeracion', 'org_campotech_demo_001', NULL, 'REFR', 'Refrigeración', 'Productos para aire acondicionado y refrigeración', 1, true, NOW(), NOW()),
('cat_calefaccion', 'org_campotech_demo_001', NULL, 'CALE', 'Calefacción', 'Productos para calefacción', 2, true, NOW(), NOW()),
('cat_repuestos', 'org_campotech_demo_001', NULL, 'REP', 'Repuestos', 'Repuestos generales', 3, true, NOW(), NOW()),
('cat_consumibles', 'org_campotech_demo_001', NULL, 'CONS', 'Consumibles', 'Materiales de consumo', 4, true, NOW(), NOW()),
('cat_herramientas', 'org_campotech_demo_001', NULL, 'HERR', 'Herramientas', 'Herramientas y equipamiento', 5, true, NOW(), NOW()),
('cat_split', 'org_campotech_demo_001', 'cat_refrigeracion', 'SPLIT', 'Split / Mini Split', 'Equipos split y componentes', 1, true, NOW(), NOW()),
('cat_gases', 'org_campotech_demo_001', 'cat_refrigeracion', 'GASES', 'Gases Refrigerantes', 'Gases y refrigerantes', 2, true, NOW(), NOW()),
('cat_filtros', 'org_campotech_demo_001', 'cat_repuestos', 'FILT', 'Filtros', 'Filtros de aire y aceite', 1, true, NOW(), NOW()),
('cat_electrico', 'org_campotech_demo_001', 'cat_repuestos', 'ELEC', 'Componentes Eléctricos', 'Capacitores, placas, etc.', 2, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO products (id, "organizationId", "categoryId", sku, barcode, name, description, brand, model, "productType", "unitOfMeasure", "costPrice", "salePrice", "marginPercent", "taxRate", "trackInventory", "minStockLevel", "maxStockLevel", "reorderQty", "isActive", "createdAt", "updatedAt") VALUES
('prod_r410a_kg', 'org_campotech_demo_001', 'cat_gases', 'GAS-R410A-1KG', '7790001000101', 'Gas Refrigerante R410A (1kg)', 'Gas refrigerante ecológico R410A - envase 1kg', 'Chemours', 'R410A', 'CONSUMABLE', 'KG', 15000.00, 22500.00, 50.00, 21.00, true, 10, 50, 20, true, NOW(), NOW()),
('prod_r22_kg', 'org_campotech_demo_001', 'cat_gases', 'GAS-R22-1KG', '7790001000102', 'Gas Refrigerante R22 (1kg)', 'Gas refrigerante R22 - envase 1kg (en desuso)', 'Dupont', 'R22', 'CONSUMABLE', 'KG', 25000.00, 37500.00, 50.00, 21.00, true, 5, 20, 10, true, NOW(), NOW()),
('prod_r32_kg', 'org_campotech_demo_001', 'cat_gases', 'GAS-R32-1KG', '7790001000103', 'Gas Refrigerante R32 (1kg)', 'Gas refrigerante R32 nueva generación - envase 1kg', 'Honeywell', 'R32', 'CONSUMABLE', 'KG', 18000.00, 27000.00, 50.00, 21.00, true, 10, 40, 15, true, NOW(), NOW()),
('prod_filtro_split_std', 'org_campotech_demo_001', 'cat_filtros', 'FILT-SPLIT-STD', '7790001000201', 'Filtro de Aire Split Standard', 'Filtro de aire para equipos split 2000-3000 frigorías', 'Genérico', NULL, 'PART', 'UNIDAD', 2500.00, 4500.00, 80.00, 21.00, true, 20, 100, 30, true, NOW(), NOW()),
('prod_filtro_split_lg', 'org_campotech_demo_001', 'cat_filtros', 'FILT-SPLIT-LG', '7790001000202', 'Filtro de Aire Split Grande', 'Filtro de aire para equipos split 4500-6000 frigorías', 'Genérico', NULL, 'PART', 'UNIDAD', 3500.00, 6000.00, 71.43, 21.00, true, 15, 80, 25, true, NOW(), NOW()),
('prod_capacitor_25', 'org_campotech_demo_001', 'cat_electrico', 'CAP-25MF', '7790001000301', 'Capacitor 25 MF', 'Capacitor de arranque 25 microfaradios', 'Genérico', NULL, 'PART', 'UNIDAD', 4500.00, 8000.00, 77.78, 21.00, true, 10, 50, 15, true, NOW(), NOW()),
('prod_capacitor_35', 'org_campotech_demo_001', 'cat_electrico', 'CAP-35MF', '7790001000302', 'Capacitor 35 MF', 'Capacitor de arranque 35 microfaradios', 'Genérico', NULL, 'PART', 'UNIDAD', 5000.00, 9000.00, 80.00, 21.00, true, 10, 50, 15, true, NOW(), NOW()),
('prod_placa_samsung', 'org_campotech_demo_001', 'cat_electrico', 'PLACA-SAM-INV', '7790001000303', 'Placa Electrónica Samsung Inverter', 'Placa de control para equipos Samsung Inverter', 'Samsung', 'DB93-10956A', 'PART', 'UNIDAD', 45000.00, 75000.00, 66.67, 21.00, true, 2, 10, 3, true, NOW(), NOW()),
('prod_placa_lg', 'org_campotech_demo_001', 'cat_electrico', 'PLACA-LG-INV', '7790001000304', 'Placa Electrónica LG Inverter', 'Placa de control para equipos LG Dual Inverter', 'LG', 'EBR82870709', 'PART', 'UNIDAD', 55000.00, 90000.00, 63.64, 21.00, true, 2, 10, 3, true, NOW(), NOW()),
('prod_cano_cobre_14', 'org_campotech_demo_001', 'cat_consumibles', 'COBRE-1/4-M', '7790001000401', 'Caño de Cobre 1/4" (metro)', 'Caño de cobre para refrigeración 1/4 pulgada', 'Condor', NULL, 'CONSUMABLE', 'METRO', 3500.00, 5500.00, 57.14, 21.00, true, 50, 200, 50, true, NOW(), NOW()),
('prod_cano_cobre_38', 'org_campotech_demo_001', 'cat_consumibles', 'COBRE-3/8-M', '7790001000402', 'Caño de Cobre 3/8" (metro)', 'Caño de cobre para refrigeración 3/8 pulgada', 'Condor', NULL, 'CONSUMABLE', 'METRO', 4500.00, 7000.00, 55.56, 21.00, true, 50, 200, 50, true, NOW(), NOW()),
('prod_aislacion_9mm', 'org_campotech_demo_001', 'cat_consumibles', 'AISL-9MM-M', '7790001000403', 'Aislación Térmica 9mm (metro)', 'Aislación de espuma elastomérica 9mm', 'Armaflex', NULL, 'CONSUMABLE', 'METRO', 1200.00, 2000.00, 66.67, 21.00, true, 100, 500, 100, true, NOW(), NOW()),
('prod_cinta_aisladora', 'org_campotech_demo_001', 'cat_consumibles', 'CINTA-AISL', '7790001000404', 'Cinta Aisladora (rollo)', 'Cinta aisladora de PVC 19mm x 20m', '3M', NULL, 'CONSUMABLE', 'UNIDAD', 800.00, 1500.00, 87.50, 21.00, true, 30, 100, 30, true, NOW(), NOW()),
('prod_split_3000', 'org_campotech_demo_001', 'cat_split', 'SPLIT-3000-STD', '7790001000501', 'Split 3000 Frigorías Frío/Calor', 'Equipo split standard 3000 frigorías frío/calor', 'Surrey', 'SS12FC', 'EQUIPMENT', 'UNIDAD', 350000.00, 500000.00, 42.86, 21.00, true, 3, 15, 5, true, NOW(), NOW()),
('prod_split_4500', 'org_campotech_demo_001', 'cat_split', 'SPLIT-4500-INV', '7790001000502', 'Split Inverter 4500 Frigorías', 'Equipo split inverter 4500 frigorías clase A', 'Samsung', 'AR18TVHQAWKN', 'EQUIPMENT', 'UNIDAD', 650000.00, 900000.00, 38.46, 21.00, true, 2, 10, 3, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. WAREHOUSES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO warehouses (id, "organizationId", "locationId", "vehicleId", code, name, type, address, "contactName", "contactPhone", "isDefault", "allowNegative", "isActive", "createdAt", "updatedAt") VALUES
(
  'wh_main_pp',
  'org_campotech_demo_001',
  'loc_warehouse_pp',
  NULL,
  'DEP-PRINCIPAL',
  'Depósito Principal Parque Patricios',
  'MAIN',
  '{"street": "Av. Caseros", "number": "3450", "city": "CABA", "postalCode": "C1263AAN"}'::jsonb,
  'Roberto Sánchez',
  '+5491155552001',
  true,
  false,
  true,
  NOW() - INTERVAL '5 months',
  NOW()
),
(
  'wh_belgrano',
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  NULL,
  'DEP-BELGRANO',
  'Depósito Sucursal Belgrano',
  'SECONDARY',
  '{"street": "Av. Cabildo", "number": "2100", "city": "CABA", "postalCode": "C1428AAR"}'::jsonb,
  'María López',
  '+5491155551002',
  false,
  false,
  true,
  NOW() - INTERVAL '4 months',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. STORAGE LOCATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage_locations (id, "warehouseId", code, name, description, "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
('stor_main_a1', 'wh_main_pp', 'A-01', 'Estantería A - Nivel 1', 'Gases refrigerantes', 1, true, NOW(), NOW()),
('stor_main_a2', 'wh_main_pp', 'A-02', 'Estantería A - Nivel 2', 'Filtros y consumibles', 2, true, NOW(), NOW()),
('stor_main_b1', 'wh_main_pp', 'B-01', 'Estantería B - Nivel 1', 'Componentes eléctricos', 3, true, NOW(), NOW()),
('stor_main_b2', 'wh_main_pp', 'B-02', 'Estantería B - Nivel 2', 'Repuestos varios', 4, true, NOW(), NOW()),
('stor_main_c1', 'wh_main_pp', 'C-01', 'Estantería C - Nivel 1', 'Caños y aislaciones', 5, true, NOW(), NOW()),
('stor_main_eq', 'wh_main_pp', 'EQ-01', 'Zona Equipos', 'Equipos completos', 6, true, NOW(), NOW()),
('stor_bel_1', 'wh_belgrano', 'BEL-01', 'Estante Principal', 'Stock general', 1, true, NOW(), NOW()),
('stor_bel_2', 'wh_belgrano', 'BEL-02', 'Estante Secundario', 'Consumibles frecuentes', 2, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. INVENTORY LEVELS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO inventory_levels (id, "organizationId", "productId", "variantId", "warehouseId", "storageLocationId", "quantityOnHand", "quantityReserved", "quantityOnOrder", "quantityAvailable", "lotNumber", "unitCost", "totalCost", "lastMovementAt", "createdAt", "updatedAt") VALUES
('inv_main_r410a', 'org_campotech_demo_001', 'prod_r410a_kg', NULL, 'wh_main_pp', 'stor_main_a1', 35, 3, 20, 32, 'LOT-2025-001', 15000.00, 525000.00, NOW() - INTERVAL '2 days', NOW(), NOW()),
('inv_main_r22', 'org_campotech_demo_001', 'prod_r22_kg', NULL, 'wh_main_pp', 'stor_main_a1', 12, 0, 0, 12, 'LOT-2024-015', 25000.00, 300000.00, NOW() - INTERVAL '1 week', NOW(), NOW()),
('inv_main_r32', 'org_campotech_demo_001', 'prod_r32_kg', NULL, 'wh_main_pp', 'stor_main_a1', 25, 2, 15, 23, 'LOT-2025-002', 18000.00, 450000.00, NOW() - INTERVAL '3 days', NOW(), NOW()),
('inv_main_filtro_std', 'org_campotech_demo_001', 'prod_filtro_split_std', NULL, 'wh_main_pp', 'stor_main_a2', 65, 5, 30, 60, NULL, 2500.00, 162500.00, NOW() - INTERVAL '1 day', NOW(), NOW()),
('inv_main_filtro_lg', 'org_campotech_demo_001', 'prod_filtro_split_lg', NULL, 'wh_main_pp', 'stor_main_a2', 45, 3, 25, 42, NULL, 3500.00, 157500.00, NOW() - INTERVAL '4 days', NOW(), NOW()),
('inv_main_cap25', 'org_campotech_demo_001', 'prod_capacitor_25', NULL, 'wh_main_pp', 'stor_main_b1', 28, 2, 15, 26, NULL, 4500.00, 126000.00, NOW() - INTERVAL '5 days', NOW(), NOW()),
('inv_main_cap35', 'org_campotech_demo_001', 'prod_capacitor_35', NULL, 'wh_main_pp', 'stor_main_b1', 22, 1, 15, 21, NULL, 5000.00, 110000.00, NOW() - INTERVAL '6 days', NOW(), NOW()),
('inv_main_placa_sam', 'org_campotech_demo_001', 'prod_placa_samsung', NULL, 'wh_main_pp', 'stor_main_b1', 5, 0, 3, 5, NULL, 45000.00, 225000.00, NOW() - INTERVAL '2 weeks', NOW(), NOW()),
('inv_main_placa_lg', 'org_campotech_demo_001', 'prod_placa_lg', NULL, 'wh_main_pp', 'stor_main_b1', 4, 1, 3, 3, NULL, 55000.00, 220000.00, NOW() - INTERVAL '3 weeks', NOW(), NOW()),
('inv_main_cobre14', 'org_campotech_demo_001', 'prod_cano_cobre_14', NULL, 'wh_main_pp', 'stor_main_c1', 120, 10, 50, 110, NULL, 3500.00, 420000.00, NOW() - INTERVAL '1 week', NOW(), NOW()),
('inv_main_cobre38', 'org_campotech_demo_001', 'prod_cano_cobre_38', NULL, 'wh_main_pp', 'stor_main_c1', 95, 8, 50, 87, NULL, 4500.00, 427500.00, NOW() - INTERVAL '1 week', NOW(), NOW()),
('inv_main_aisl', 'org_campotech_demo_001', 'prod_aislacion_9mm', NULL, 'wh_main_pp', 'stor_main_c1', 280, 15, 100, 265, NULL, 1200.00, 336000.00, NOW() - INTERVAL '4 days', NOW(), NOW()),
('inv_main_cinta', 'org_campotech_demo_001', 'prod_cinta_aisladora', NULL, 'wh_main_pp', 'stor_main_a2', 55, 0, 30, 55, NULL, 800.00, 44000.00, NOW() - INTERVAL '5 days', NOW(), NOW()),
('inv_main_split3000', 'org_campotech_demo_001', 'prod_split_3000', NULL, 'wh_main_pp', 'stor_main_eq', 8, 2, 5, 6, NULL, 350000.00, 2800000.00, NOW() - INTERVAL '2 weeks', NOW(), NOW()),
('inv_main_split4500', 'org_campotech_demo_001', 'prod_split_4500', NULL, 'wh_main_pp', 'stor_main_eq', 5, 1, 3, 4, NULL, 650000.00, 3250000.00, NOW() - INTERVAL '3 weeks', NOW(), NOW()),
('inv_bel_r410a', 'org_campotech_demo_001', 'prod_r410a_kg', NULL, 'wh_belgrano', 'stor_bel_1', 8, 1, 0, 7, 'LOT-2025-001', 15000.00, 120000.00, NOW() - INTERVAL '3 days', NOW(), NOW()),
('inv_bel_filtro_std', 'org_campotech_demo_001', 'prod_filtro_split_std', NULL, 'wh_belgrano', 'stor_bel_2', 15, 2, 0, 13, NULL, 2500.00, 37500.00, NOW() - INTERVAL '2 days', NOW(), NOW()),
('inv_bel_cap25', 'org_campotech_demo_001', 'prod_capacitor_25', NULL, 'wh_belgrano', 'stor_bel_1', 8, 0, 0, 8, NULL, 4500.00, 36000.00, NOW() - INTERVAL '1 week', NOW(), NOW()),
('inv_bel_cinta', 'org_campotech_demo_001', 'prod_cinta_aisladora', NULL, 'wh_belgrano', 'stor_bel_2', 12, 0, 0, 12, NULL, 800.00, 9600.00, NOW() - INTERVAL '1 week', NOW(), NOW());
