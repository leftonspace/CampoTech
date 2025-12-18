-- ═══════════════════════════════════════════════════════════════════════════════
-- CAMPOTECH - COMPREHENSIVE SEED DATA - PART 1
-- Organization, Locations, Zones, Users, Schedules
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
