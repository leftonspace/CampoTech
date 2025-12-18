-- ═══════════════════════════════════════════════════════════════════════════════
-- CAMPOTECH - COMPREHENSIVE SEED DATA - PART 2
-- Vehicles, Jobs, Invoices, Payments, Reviews
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. VEHICLES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO vehicles (id, "organizationId", "plateNumber", make, model, year, vin, color, status, "currentMileage", "fuelType", "insuranceCompany", "insuranceExpiry", "vtvExpiry", "registrationExpiry", "lastServiceDate", "nextServiceDate", notes, "createdAt", "updatedAt") VALUES
(
  'veh_001_partner',
  'org_campotech_demo_001',
  'AC123BD',
  'Peugeot',
  'Partner',
  2022,
  '9P3PH4A6000123456',
  'Blanco',
  'ACTIVE',
  45000,
  'DIESEL',
  'La Segunda',
  '2026-06-15',
  '2026-03-20',
  '2026-08-10',
  '2025-10-15',
  '2026-01-15',
  'Vehículo principal Juan. Caja de herramientas completa.',
  NOW() - INTERVAL '6 months',
  NOW()
),
(
  'veh_002_kangoo',
  'org_campotech_demo_001',
  'AD456EF',
  'Renault',
  'Kangoo',
  2021,
  '8A1KA0KN000654321',
  'Gris',
  'ACTIVE',
  62000,
  'DIESEL',
  'La Segunda',
  '2026-05-22',
  '2026-02-18',
  '2026-07-05',
  '2025-11-20',
  '2026-02-20',
  'Vehículo Miguel. Escalera en techo.',
  NOW() - INTERVAL '5 months',
  NOW()
),
(
  'veh_003_berlingo',
  'org_campotech_demo_001',
  'AE789GH',
  'Citroën',
  'Berlingo',
  2023,
  '9C8BA0BA000789012',
  'Azul',
  'ACTIVE',
  28000,
  'DIESEL',
  'Federación Patronal',
  '2026-09-10',
  '2026-07-15',
  '2026-11-20',
  '2025-12-01',
  '2026-03-01',
  'Vehículo Pablo. Nuevo, bajo km.',
  NOW() - INTERVAL '4 months',
  NOW()
),
(
  'veh_004_partner2',
  'org_campotech_demo_001',
  'AF012JK',
  'Peugeot',
  'Partner',
  2020,
  '9P3PH4A6000345678',
  'Blanco',
  'ACTIVE',
  78000,
  'DIESEL',
  'San Cristóbal',
  '2026-04-30',
  '2026-01-25',
  '2026-05-15',
  '2025-09-10',
  '2026-01-10',
  'Vehículo Diego y Martín (compartido).',
  NOW() - INTERVAL '3 months',
  NOW()
),
(
  'veh_005_fiorino',
  'org_campotech_demo_001',
  'AG345LM',
  'Fiat',
  'Fiorino',
  2019,
  '9BD17164000567890',
  'Blanco',
  'MAINTENANCE',
  95000,
  'GASOLINE',
  'San Cristóbal',
  '2026-02-28',
  '2025-12-10',
  '2026-03-20',
  '2025-12-05',
  NULL,
  'En taller por problemas de embrague. VTV próxima a vencer.',
  NOW() - INTERVAL '6 months',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. VEHICLE ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO vehicle_assignments (id, "vehicleId", "userId", "assignedFrom", "assignedUntil", "isPrimaryDriver", notes, "createdAt", "updatedAt") VALUES
('vassign_juan_partner', 'veh_001_partner', 'user_tech_juan', NOW() - INTERVAL '6 months', NULL, true, 'Asignación permanente', NOW(), NOW()),
('vassign_miguel_kangoo', 'veh_002_kangoo', 'user_tech_miguel', NOW() - INTERVAL '5 months', NULL, true, 'Asignación permanente', NOW(), NOW()),
('vassign_pablo_berlingo', 'veh_003_berlingo', 'user_tech_pablo', NOW() - INTERVAL '4 months', NULL, true, 'Asignación permanente', NOW(), NOW()),
('vassign_diego_partner2', 'veh_004_partner2', 'user_tech_diego', NOW() - INTERVAL '3 months', NULL, true, 'Comparte con Martín', NOW(), NOW()),
('vassign_martin_partner2', 'veh_004_partner2', 'user_tech_martin', NOW() - INTERVAL '2 months', NULL, false, 'Comparte con Diego', NOW(), NOW()),
('vassign_lucas_aux', 'veh_002_kangoo', 'user_tech_lucas', NOW() - INTERVAL '1 month', NULL, false, 'Apoyo - acompaña a Miguel', NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. VEHICLE MAINTENANCE RECORDS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO vehicle_maintenance (id, "vehicleId", "maintenanceType", description, "mileageAtService", cost, vendor, "invoiceNumber", "scheduledDate", "completedDate", "nextServiceDate", "nextServiceMileage", notes, "createdById", "createdAt", "updatedAt") VALUES
('vmaint_001', 'veh_001_partner', 'OIL_CHANGE', 'Cambio de aceite y filtros', 45000, 35000.00, 'Lubricentro Express', 'FC-2025-1234', NULL, '2025-10-15', '2026-01-15', 55000, 'Aceite sintético 5W30', 'user_owner_carlos', NOW() - INTERVAL '2 months', NOW()),
('vmaint_002', 'veh_002_kangoo', 'SCHEDULED_SERVICE', 'Service 60.000 km', 60000, 85000.00, 'Renault Oficial', 'FAC-98765', NULL, '2025-11-20', '2026-02-20', 75000, 'Service completo según manual', 'user_owner_carlos', NOW() - INTERVAL '1 month', NOW()),
('vmaint_003', 'veh_003_berlingo', 'TIRE_ROTATION', 'Rotación y balanceo de cubiertas', 25000, 12000.00, 'Gomería Central', 'REC-456', NULL, '2025-12-01', NULL, NULL, NULL, 'user_owner_carlos', NOW() - INTERVAL '3 weeks', NOW()),
('vmaint_004', 'veh_005_fiorino', 'REPAIR', 'Reparación de embrague', 95000, 120000.00, 'Taller Mecánico Rodríguez', 'FC-2025-890', '2025-12-05', NULL, NULL, NULL, 'En reparación - presupuesto aprobado', 'user_owner_carlos', NOW() - INTERVAL '2 weeks', NOW()),
('vmaint_005', 'veh_004_partner2', 'BRAKE_SERVICE', 'Cambio de pastillas delanteras', 75000, 28000.00, 'Frenos y Embragues SRL', 'FAC-321', NULL, '2025-09-10', '2026-03-10', 90000, NULL, 'user_owner_carlos', NOW() - INTERVAL '3 months', NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 16. VEHICLE STOCKS (Technician's van inventory)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO vehicle_stocks (id, "organizationId", "technicianId", "productId", quantity, "minLevel", "maxLevel", "lastRefilledAt", "createdAt", "updatedAt") VALUES
-- Juan's vehicle
('vs_juan_r410a', 'org_campotech_demo_001', 'user_tech_juan', 'prod_r410a_kg', 5, 2, 8, NOW() - INTERVAL '3 days', NOW(), NOW()),
('vs_juan_r32', 'org_campotech_demo_001', 'user_tech_juan', 'prod_r32_kg', 3, 1, 5, NOW() - INTERVAL '3 days', NOW(), NOW()),
('vs_juan_filtro_std', 'org_campotech_demo_001', 'user_tech_juan', 'prod_filtro_split_std', 6, 3, 10, NOW() - INTERVAL '1 week', NOW(), NOW()),
('vs_juan_cap25', 'org_campotech_demo_001', 'user_tech_juan', 'prod_capacitor_25', 3, 2, 5, NOW() - INTERVAL '2 weeks', NOW(), NOW()),
('vs_juan_cinta', 'org_campotech_demo_001', 'user_tech_juan', 'prod_cinta_aisladora', 4, 2, 6, NOW() - INTERVAL '1 week', NOW(), NOW()),
-- Miguel's vehicle
('vs_miguel_r410a', 'org_campotech_demo_001', 'user_tech_miguel', 'prod_r410a_kg', 4, 2, 8, NOW() - INTERVAL '5 days', NOW(), NOW()),
('vs_miguel_filtro_std', 'org_campotech_demo_001', 'user_tech_miguel', 'prod_filtro_split_std', 5, 3, 10, NOW() - INTERVAL '1 week', NOW(), NOW()),
('vs_miguel_filtro_lg', 'org_campotech_demo_001', 'user_tech_miguel', 'prod_filtro_split_lg', 3, 2, 6, NOW() - INTERVAL '1 week', NOW(), NOW()),
('vs_miguel_cap35', 'org_campotech_demo_001', 'user_tech_miguel', 'prod_capacitor_35', 2, 1, 4, NOW() - INTERVAL '2 weeks', NOW(), NOW()),
-- Pablo's vehicle
('vs_pablo_r410a', 'org_campotech_demo_001', 'user_tech_pablo', 'prod_r410a_kg', 3, 2, 6, NOW() - INTERVAL '4 days', NOW(), NOW()),
('vs_pablo_cap25', 'org_campotech_demo_001', 'user_tech_pablo', 'prod_capacitor_25', 4, 2, 6, NOW() - INTERVAL '1 week', NOW(), NOW()),
('vs_pablo_cap35', 'org_campotech_demo_001', 'user_tech_pablo', 'prod_capacitor_35', 3, 2, 5, NOW() - INTERVAL '1 week', NOW(), NOW()),
('vs_pablo_cinta', 'org_campotech_demo_001', 'user_tech_pablo', 'prod_cinta_aisladora', 5, 2, 8, NOW() - INTERVAL '5 days', NOW(), NOW()),
-- Diego's vehicle
('vs_diego_r410a', 'org_campotech_demo_001', 'user_tech_diego', 'prod_r410a_kg', 2, 2, 5, NOW() - INTERVAL '6 days', NOW(), NOW()),
('vs_diego_filtro_std', 'org_campotech_demo_001', 'user_tech_diego', 'prod_filtro_split_std', 4, 2, 8, NOW() - INTERVAL '1 week', NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 17. TECHNICIAN LOCATIONS (Current GPS positions)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO technician_locations (id, "userId", latitude, longitude, accuracy, heading, speed, altitude, "isOnline", "lastSeen", "updatedAt") VALUES
('tloc_juan', 'user_tech_juan', -34.5834, -58.4256, 8.5, 45.0, 25.5, 25.0, true, NOW(), NOW()),
('tloc_miguel', 'user_tech_miguel', -34.5612, -58.4534, 5.2, NULL, 0.0, 28.0, true, NOW() - INTERVAL '5 minutes', NOW()),
('tloc_pablo', 'user_tech_pablo', -34.5614, -58.4561, 10.0, NULL, 0.0, 26.0, true, NOW() - INTERVAL '2 minutes', NOW()),
('tloc_diego', 'user_tech_diego', -34.5432, -58.4623, 6.8, NULL, 0.0, 22.0, true, NOW() - INTERVAL '8 minutes', NOW()),
('tloc_martin', 'user_tech_martin', -34.4856, -58.5123, 12.0, 320.0, 35.0, 18.0, true, NOW() - INTERVAL '1 minute', NOW()),
('tloc_lucas', 'user_tech_lucas', -34.4708, -58.5276, 15.0, NULL, 0.0, 20.0, false, NOW() - INTERVAL '18 hours', NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 18. DASHBOARD ALERTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO dashboard_alerts (id, "organizationId", "alertType", severity, title, message, "entityType", "entityId", "isRead", "isDismissed", "expiresAt", "createdAt", "updatedAt") VALUES
('alert_vtv_fiorino', 'org_campotech_demo_001', 'VEHICLE_DOCUMENT_EXPIRING', 'WARNING', 'VTV por vencer', 'El vehículo AG345LM (Fiat Fiorino) tiene la VTV próxima a vencer el 2025-12-10', 'vehicle', 'veh_005_fiorino', false, false, '2025-12-10', NOW() - INTERVAL '5 days', NOW()),
('alert_maint_partner', 'org_campotech_demo_001', 'VEHICLE_MAINTENANCE_DUE', 'INFO', 'Service programado', 'El vehículo AC123BD (Peugeot Partner) tiene service programado para 2026-01-15', 'vehicle', 'veh_001_partner', false, false, '2026-01-15', NOW() - INTERVAL '3 days', NOW()),
('alert_low_r22', 'org_campotech_demo_001', 'LOW_STOCK', 'WARNING', 'Stock bajo - Gas R22', 'El producto Gas Refrigerante R22 tiene stock por debajo del mínimo (12 unidades, mínimo: 5)', 'product', 'prod_r22_kg', true, false, NULL, NOW() - INTERVAL '1 week', NOW()),
('alert_tech_offline', 'org_campotech_demo_001', 'TECHNICIAN_OFFLINE', 'INFO', 'Técnico desconectado', 'Lucas Silva no ha reportado ubicación en las últimas 18 horas', 'user', 'user_tech_lucas', false, false, NULL, NOW() - INTERVAL '2 hours', NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 19. PRICE ITEMS (Service Price List)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO price_items (id, "organizationId", name, description, type, price, unit, "taxRate", "isActive", "createdAt", "updatedAt") VALUES
('price_inst_split_std', 'org_campotech_demo_001', 'Instalación Split Standard', 'Instalación de equipo split hasta 3000 frigorías (hasta 4m de caño)', 'SERVICE', 40000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_inst_split_ext', 'org_campotech_demo_001', 'Instalación Split Extendida', 'Instalación de equipo split con más de 4m de caño', 'SERVICE', 55000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_inst_split_inv', 'org_campotech_demo_001', 'Instalación Split Inverter', 'Instalación de equipo split inverter cualquier capacidad', 'SERVICE', 45000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_maint_std', 'org_campotech_demo_001', 'Mantenimiento Preventivo', 'Limpieza de filtros, verificación de gas, limpieza general', 'SERVICE', 12000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_maint_deep', 'org_campotech_demo_001', 'Mantenimiento Profundo', 'Mantenimiento completo con desmontaje y limpieza química', 'SERVICE', 18000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_diag', 'org_campotech_demo_001', 'Diagnóstico', 'Visita técnica para diagnóstico de falla', 'SERVICE', 8000.00, 'visita', 21.00, true, NOW(), NOW()),
('price_rep_gas', 'org_campotech_demo_001', 'Carga de Gas (mano de obra)', 'Servicio de carga de gas refrigerante', 'SERVICE', 12000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_rep_std', 'org_campotech_demo_001', 'Reparación Standard', 'Reparación con reemplazo de componentes menores', 'SERVICE', 15000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_rep_placa', 'org_campotech_demo_001', 'Reemplazo de Placa Electrónica', 'Mano de obra reemplazo de placa (no incluye repuesto)', 'SERVICE', 25000.00, 'servicio', 21.00, true, NOW(), NOW()),
('price_urgency', 'org_campotech_demo_001', 'Recargo Urgencia', 'Recargo por servicio urgente (50% del valor base)', 'SERVICE', 0.00, 'porcentaje', 21.00, true, NOW(), NOW()),
('price_km_extra', 'org_campotech_demo_001', 'Kilómetro Extra', 'Recargo por distancia mayor a 15km desde sucursal', 'SERVICE', 500.00, 'km', 21.00, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 20. JOBS - DECEMBER 2025 (COMPLETED) - Sample of first jobs
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO jobs (id, "jobNumber", "serviceType", description, status, urgency, "scheduledDate", "scheduledTimeSlot", "startedAt", "completedAt", resolution, "materialsUsed", photos, "customerSignature", "estimatedDuration", "actualDuration", "customerId", "technicianId", "createdById", "organizationId", "locationId", "zoneId", "createdAt", "updatedAt") VALUES
-- December 1, 2025
(
  'job_dec01_001',
  'TR-2025-0001',
  'MANTENIMIENTO_SPLIT',
  'Mantenimiento preventivo equipo split 3000 frigorías. Cliente habitual.',
  'COMPLETED',
  'NORMAL',
  '2025-12-01 09:00:00',
  '{"start": "09:00", "end": "11:00"}'::jsonb,
  '2025-12-01 09:15:00',
  '2025-12-01 10:45:00',
  'Mantenimiento completo realizado. Limpieza de filtros, verificación de gas (OK), limpieza de unidad exterior.',
  '[{"productId": "prod_filtro_split_std", "name": "Filtro de Aire Split Standard", "quantity": 1, "unitPrice": 4500}]'::jsonb,
  ARRAY['https://storage.campotech.com/photos/job_dec01_001_before.jpg', 'https://storage.campotech.com/photos/job_dec01_001_after.jpg'],
  'data:image/png;base64,sig_ana_001',
  90,
  90,
  'cust_gonzalez_ana',
  'user_tech_juan',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  '2025-11-28 14:30:00',
  '2025-12-01 10:45:00'
),
(
  'job_dec01_002',
  'TR-2025-0002',
  'REPARACION_SPLIT',
  'Equipo split no enfría. Cliente reporta que solo tira aire.',
  'COMPLETED',
  'NORMAL',
  '2025-12-01 11:30:00',
  '{"start": "11:30", "end": "13:30"}'::jsonb,
  '2025-12-01 11:45:00',
  '2025-12-01 13:15:00',
  'Falta de gas refrigerante. Se realizó carga completa de R410A (1.2kg). Verificación de presiones OK.',
  '[{"productId": "prod_r410a_kg", "name": "Gas Refrigerante R410A (1kg)", "quantity": 2, "unitPrice": 22500}]'::jsonb,
  ARRAY['https://storage.campotech.com/photos/job_dec01_002_1.jpg'],
  'data:image/png;base64,sig_roberto_001',
  120,
  90,
  'cust_martinez_roberto',
  'user_tech_juan',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  '2025-11-30 10:00:00',
  '2025-12-01 13:15:00'
),
(
  'job_dec01_003',
  'TR-2025-0003',
  'INSTALACION_SPLIT',
  'Instalación de equipo split nuevo 4500 frigorías inverter Samsung.',
  'COMPLETED',
  'NORMAL',
  '2025-12-01 14:00:00',
  '{"start": "14:00", "end": "18:00"}'::jsonb,
  '2025-12-01 14:20:00',
  '2025-12-01 18:30:00',
  'Instalación completada. Equipo Samsung instalado en living. 6 metros de caño, unidad exterior en balcón.',
  '[{"productId": "prod_split_4500", "name": "Split Inverter 4500 Frigorías", "quantity": 1, "unitPrice": 900000}, {"productId": "prod_cano_cobre_14", "name": "Caño de Cobre 1/4 (metro)", "quantity": 6, "unitPrice": 5500}, {"productId": "prod_cano_cobre_38", "name": "Caño de Cobre 3/8 (metro)", "quantity": 6, "unitPrice": 7000}, {"productId": "prod_aislacion_9mm", "name": "Aislación Térmica 9mm (metro)", "quantity": 12, "unitPrice": 2000}]'::jsonb,
  ARRAY['https://storage.campotech.com/photos/job_dec01_003_1.jpg', 'https://storage.campotech.com/photos/job_dec01_003_2.jpg'],
  'data:image/png;base64,sig_patricia_001',
  240,
  250,
  'cust_silva_patricia',
  'user_tech_miguel',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_sur',
  '2025-11-25 11:00:00',
  '2025-12-01 18:30:00'
),
-- December 2, 2025
(
  'job_dec02_001',
  'TR-2025-0004',
  'REPARACION_SPLIT',
  'Capacitor quemado. Equipo hace ruido y no arranca compresor.',
  'COMPLETED',
  'URGENTE',
  '2025-12-02 08:30:00',
  '{"start": "08:30", "end": "10:30"}'::jsonb,
  '2025-12-02 08:45:00',
  '2025-12-02 10:00:00',
  'Capacitor de arranque 25MF quemado. Reemplazado. Equipo funcionando correctamente.',
  '[{"productId": "prod_capacitor_25", "name": "Capacitor 25 MF", "quantity": 1, "unitPrice": 8000}]'::jsonb,
  ARRAY['https://storage.campotech.com/photos/job_dec02_001_1.jpg'],
  'data:image/png;base64,sig_jorge_001',
  120,
  75,
  'cust_fernandez_jorge',
  'user_tech_pablo',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_sur',
  '2025-12-01 21:30:00',
  '2025-12-02 10:00:00'
),
(
  'job_dec02_002',
  'TR-2025-0005',
  'MANTENIMIENTO_SPLIT',
  'Service completo 2 equipos split oficina.',
  'COMPLETED',
  'NORMAL',
  '2025-12-02 10:30:00',
  '{"start": "10:30", "end": "13:30"}'::jsonb,
  '2025-12-02 10:45:00',
  '2025-12-02 13:00:00',
  'Mantenimiento de 2 equipos completado. Limpieza de filtros y serpentinas. Oficina operativa.',
  '[{"productId": "prod_filtro_split_std", "name": "Filtro de Aire Split Standard", "quantity": 2, "unitPrice": 4500}]'::jsonb,
  ARRAY['https://storage.campotech.com/photos/job_dec02_002_1.jpg'],
  'data:image/png;base64,sig_eduardo_001',
  180,
  135,
  'cust_lopez_eduardo',
  'user_tech_pablo',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_recoleta',
  '2025-11-29 09:00:00',
  '2025-12-02 13:00:00'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 21. JOBS - IN PROGRESS (TODAY Dec 18)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO jobs (id, "jobNumber", "serviceType", description, status, urgency, "scheduledDate", "scheduledTimeSlot", "startedAt", "completedAt", resolution, "materialsUsed", photos, "customerSignature", "estimatedDuration", "actualDuration", "customerId", "technicianId", "createdById", "organizationId", "locationId", "zoneId", "createdAt", "updatedAt") VALUES
(
  'job_dec18_001',
  'TR-2025-0021',
  'REPARACION_SPLIT',
  'Pérdida de gas. Equipo no enfría bien.',
  'IN_PROGRESS',
  'NORMAL',
  '2025-12-18 09:00:00',
  '{"start": "09:00", "end": "11:00"}'::jsonb,
  '2025-12-18 09:15:00',
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  120,
  NULL,
  'cust_gonzalez_ana',
  'user_tech_juan',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  '2025-12-16 10:00:00',
  NOW()
),
(
  'job_dec18_002',
  'TR-2025-0022',
  'MANTENIMIENTO_SPLIT',
  'Mantenimiento preventivo anual.',
  'EN_ROUTE',
  'NORMAL',
  '2025-12-18 11:30:00',
  '{"start": "11:30", "end": "13:00"}'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  90,
  NULL,
  'cust_sanchez_maria',
  'user_tech_miguel',
  'user_dispatch_lucia',
  'org_campotech_demo_001',
  'loc_branch_belgrano',
  'zone_belgrano_r',
  '2025-12-15 14:00:00',
  NOW()
),
(
  'job_dec18_003',
  'TR-2025-0023',
  'INSTALACION_CALEFACTOR',
  'Instalación de calefactor a gas.',
  'IN_PROGRESS',
  'NORMAL',
  '2025-12-18 14:00:00',
  '{"start": "14:00", "end": "17:00"}'::jsonb,
  '2025-12-18 14:10:00',
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  180,
  NULL,
  'cust_romero_claudia',
  'user_tech_martin',
  'user_dispatch_lucia',
  'org_campotech_demo_001',
  'loc_branch_sanisidro',
  'zone_sanisidro_centro',
  '2025-12-14 09:00:00',
  NOW()
),
(
  'job_dec18_004',
  'TR-2025-0024',
  'REPARACION_SPLIT',
  'Equipo hace ruido extraño al encender.',
  'ASSIGNED',
  'NORMAL',
  '2025-12-18 16:00:00',
  '{"start": "16:00", "end": "18:00"}'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  120,
  NULL,
  'cust_aguirre_diego',
  'user_tech_pablo',
  'user_dispatch_maria',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  'zone_palermo_norte',
  '2025-12-17 11:00:00',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 22. INVOICES (Sample)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO invoices (id, "invoiceNumber", type, status, subtotal, "taxAmount", total, items, "afipCae", "afipCaeExpiry", "afipQrCode", "issuedAt", "dueDate", "jobId", "customerId", "organizationId", "locationId", "createdAt", "updatedAt") VALUES
(
  'inv_dec01_001',
  'C-0001-00000001',
  'FACTURA_C',
  'PAID',
  12396.69,
  2603.31,
  15000.00,
  '[{"description": "Mantenimiento preventivo equipo split", "quantity": 1, "unitPrice": 10500}, {"description": "Filtro de Aire Split Standard", "quantity": 1, "unitPrice": 4500}]'::jsonb,
  '71234567890123',
  '2026-01-10',
  'https://www.afip.gob.ar/qr/?p=eyJhbGciOiJIUzI1NiJ9.inv001',
  '2025-12-01 11:00:00',
  '2025-12-31',
  'job_dec01_001',
  'cust_gonzalez_ana',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  '2025-12-01 11:00:00',
  '2025-12-01 11:00:00'
),
(
  'inv_dec01_002',
  'C-0001-00000002',
  'FACTURA_C',
  'PAID',
  49586.78,
  10413.22,
  60000.00,
  '[{"description": "Reparación equipo split - Carga de gas", "quantity": 1, "unitPrice": 15000}, {"description": "Gas Refrigerante R410A (1kg)", "quantity": 2, "unitPrice": 22500}]'::jsonb,
  '71234567890124',
  '2026-01-10',
  'https://www.afip.gob.ar/qr/?p=eyJhbGciOiJIUzI1NiJ9.inv002',
  '2025-12-01 14:00:00',
  '2025-12-31',
  'job_dec01_002',
  'cust_martinez_roberto',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  '2025-12-01 14:00:00',
  '2025-12-01 14:00:00'
),
(
  'inv_dec01_003',
  'C-0001-00000003',
  'FACTURA_C',
  'PAID',
  855371.90,
  179628.10,
  1035000.00,
  '[{"description": "Instalación equipo split inverter 4500 frigorías", "quantity": 1, "unitPrice": 45000}, {"description": "Split Inverter 4500 Frigorías Samsung", "quantity": 1, "unitPrice": 900000}, {"description": "Caño de Cobre 1/4 (metro)", "quantity": 6, "unitPrice": 5500}, {"description": "Caño de Cobre 3/8 (metro)", "quantity": 6, "unitPrice": 7000}, {"description": "Aislación Térmica 9mm (metro)", "quantity": 12, "unitPrice": 2000}]'::jsonb,
  '71234567890125',
  '2026-01-10',
  'https://www.afip.gob.ar/qr/?p=eyJhbGciOiJIUzI1NiJ9.inv003',
  '2025-12-01 19:00:00',
  '2025-12-31',
  'job_dec01_003',
  'cust_silva_patricia',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  '2025-12-01 19:00:00',
  '2025-12-01 19:00:00'
),
(
  'inv_dec02_001',
  'C-0001-00000004',
  'FACTURA_C',
  'PAID',
  20661.16,
  4338.84,
  25000.00,
  '[{"description": "Reparación urgente - Reemplazo capacitor", "quantity": 1, "unitPrice": 17000}, {"description": "Capacitor 25 MF", "quantity": 1, "unitPrice": 8000}]'::jsonb,
  '71234567890126',
  '2026-01-11',
  'https://www.afip.gob.ar/qr/?p=eyJhbGciOiJIUzI1NiJ9.inv004',
  '2025-12-02 10:30:00',
  '2025-12-31',
  'job_dec02_001',
  'cust_fernandez_jorge',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  '2025-12-02 10:30:00',
  '2025-12-02 10:30:00'
),
(
  'inv_dec02_002',
  'C-0001-00000005',
  'FACTURA_C',
  'PAID',
  28925.62,
  6074.38,
  35000.00,
  '[{"description": "Mantenimiento 2 equipos split oficina", "quantity": 1, "unitPrice": 26000}, {"description": "Filtro de Aire Split Standard", "quantity": 2, "unitPrice": 4500}]'::jsonb,
  '71234567890127',
  '2026-01-11',
  'https://www.afip.gob.ar/qr/?p=eyJhbGciOiJIUzI1NiJ9.inv005',
  '2025-12-02 14:00:00',
  '2025-12-31',
  'job_dec02_002',
  'cust_lopez_eduardo',
  'org_campotech_demo_001',
  'loc_hq_palermo',
  '2025-12-02 14:00:00',
  '2025-12-02 14:00:00'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 23. PAYMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO payments (id, amount, method, status, reference, "paidAt", "invoiceId", "organizationId", "createdAt", "updatedAt") VALUES
('pay_dec01_001', 15000.00, 'MERCADOPAGO', 'COMPLETED', 'MP-2025120101-001', '2025-12-01 11:30:00', 'inv_dec01_001', 'org_campotech_demo_001', '2025-12-01 11:30:00', '2025-12-01 11:30:00'),
('pay_dec01_002', 60000.00, 'TRANSFER', 'COMPLETED', 'TRF-BA-12345678', '2025-12-01 15:00:00', 'inv_dec01_002', 'org_campotech_demo_001', '2025-12-01 15:00:00', '2025-12-01 15:00:00'),
('pay_dec01_003a', 500000.00, 'MERCADOPAGO', 'COMPLETED', 'MP-2025120101-003A', '2025-12-01 19:30:00', 'inv_dec01_003', 'org_campotech_demo_001', '2025-12-01 19:30:00', '2025-12-01 19:30:00'),
('pay_dec01_003b', 535000.00, 'TRANSFER', 'COMPLETED', 'TRF-BA-12345679', '2025-12-05 10:00:00', 'inv_dec01_003', 'org_campotech_demo_001', '2025-12-05 10:00:00', '2025-12-05 10:00:00'),
('pay_dec02_001', 25000.00, 'CASH', 'COMPLETED', NULL, '2025-12-02 10:30:00', 'inv_dec02_001', 'org_campotech_demo_001', '2025-12-02 10:30:00', '2025-12-02 10:30:00'),
('pay_dec02_002', 35000.00, 'TRANSFER', 'COMPLETED', 'TRF-BA-12345680', '2025-12-03 09:00:00', 'inv_dec02_002', 'org_campotech_demo_001', '2025-12-03 09:00:00', '2025-12-03 09:00:00');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 24. REVIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO reviews (id, "organizationId", "jobId", "customerId", "technicianId", rating, comment, token, "submittedAt", "createdAt", "updatedAt") VALUES
('rev_dec01_001', 'org_campotech_demo_001', 'job_dec01_001', 'cust_gonzalez_ana', 'user_tech_juan', 5, 'Excelente servicio, muy puntual y prolijo. Juan es muy profesional.', 'tok_rev_001', '2025-12-01 18:00:00', '2025-12-01 11:00:00', '2025-12-01 18:00:00'),
('rev_dec01_002', 'org_campotech_demo_001', 'job_dec01_002', 'cust_martinez_roberto', 'user_tech_juan', 5, 'Solucionó el problema rápidamente. Muy recomendable.', 'tok_rev_002', '2025-12-01 20:00:00', '2025-12-01 14:00:00', '2025-12-01 20:00:00'),
('rev_dec01_003', 'org_campotech_demo_001', 'job_dec01_003', 'cust_silva_patricia', 'user_tech_miguel', 4, 'Buen trabajo de instalación, aunque tardó un poco más de lo esperado.', 'tok_rev_003', '2025-12-02 10:00:00', '2025-12-01 19:00:00', '2025-12-02 10:00:00'),
('rev_dec02_001', 'org_campotech_demo_001', 'job_dec02_001', 'cust_fernandez_jorge', 'user_tech_pablo', 5, 'Urgencia atendida rapidísimo. Gracias!', 'tok_rev_004', '2025-12-02 15:00:00', '2025-12-02 10:30:00', '2025-12-02 15:00:00'),
('rev_dec02_002', 'org_campotech_demo_001', 'job_dec02_002', 'cust_lopez_eduardo', 'user_tech_pablo', 5, 'Service completo y profesional. Oficina funcionando perfecta.', 'tok_rev_005', '2025-12-03 09:00:00', '2025-12-02 14:00:00', '2025-12-03 09:00:00');
