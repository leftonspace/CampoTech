-- CampoTech Test Data Seed Script
-- Admin Account: +18199685685
-- Run this in Supabase SQL Editor

-- ============================================
-- IMPORTANT: Run this script AFTER the admin user
-- has logged in for the first time via OTP
-- ============================================

-- Variables (update these based on your actual IDs after first login)
-- To find your org_id and user_id:
-- SELECT id as user_id, org_id FROM users WHERE phone = '+18199685685';

-- ============================================
-- 1. GET OR CREATE TEST ORGANIZATION
-- ============================================

DO $$
DECLARE
    v_admin_phone TEXT := '+18199685685';
    v_org_id UUID;
    v_admin_user_id UUID;
    v_tech_carlos_id UUID;
    v_tech_diego_id UUID;
    v_admin_sofia_id UUID;
    v_dispatch_elena_id UUID;
    v_customer_juan_id UUID;
    v_customer_maria_id UUID;
    v_customer_pedro_id UUID;
    v_customer_ana_id UUID;
    v_customer_offline_id UUID;
    v_job1_id UUID;
    v_job2_id UUID;
    v_job3_id UUID;
    v_job4_id UUID;
    v_job5_id UUID;
BEGIN
    -- Get admin user and org
    SELECT id, org_id INTO v_admin_user_id, v_org_id
    FROM users
    WHERE phone = v_admin_phone;

    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Admin user not found. Please login first with phone %', v_admin_phone;
    END IF;

    RAISE NOTICE 'Found admin user: %, org: %', v_admin_user_id, v_org_id;

    -- Update organization with test CUIT if not set
    UPDATE organizations
    SET
        name = COALESCE(name, 'CampoTech Test Org'),
        cuit = COALESCE(cuit, '20-12345678-9'),
        iva_condition = COALESCE(iva_condition, 'responsable_inscripto'),
        settings = jsonb_build_object(
            'ui_mode', 'advanced',
            'auto_invoice_on_complete', true,
            'auto_send_whatsapp', true,
            'voice_auto_create_threshold', 0.7
        ),
        updated_at = NOW()
    WHERE id = v_org_id;

    RAISE NOTICE 'Organization updated';

    -- ============================================
    -- 2. CREATE TEST TECHNICIANS
    -- ============================================

    -- Tech Carlos
    INSERT INTO users (id, org_id, role, full_name, phone, email, is_active, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'technician',
        'Tech Carlos',
        '+5491155552001',
        'carlos@test.campotech.com',
        true,
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO v_tech_carlos_id;

    -- Tech Diego
    INSERT INTO users (id, org_id, role, full_name, phone, email, is_active, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'technician',
        'Tech Diego',
        '+5491155552002',
        'diego@test.campotech.com',
        true,
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO v_tech_diego_id;

    -- Admin Sofia
    INSERT INTO users (id, org_id, role, full_name, phone, email, is_active, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'admin',
        'Admin Sofia',
        '+5491155552003',
        'sofia@test.campotech.com',
        true,
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO v_admin_sofia_id;

    -- Dispatcher Elena
    INSERT INTO users (id, org_id, role, full_name, phone, email, is_active, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'dispatcher',
        'Dispatch Elena',
        '+5491155552004',
        'elena@test.campotech.com',
        true,
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO v_dispatch_elena_id;

    RAISE NOTICE 'Created/updated technicians: Carlos=%, Diego=%, Sofia=%, Elena=%',
        v_tech_carlos_id, v_tech_diego_id, v_admin_sofia_id, v_dispatch_elena_id;

    -- ============================================
    -- 3. CREATE TEST CUSTOMERS
    -- ============================================

    -- Customer: Juan Perez (Responsable Inscripto - for Factura A)
    INSERT INTO customers (id, org_id, name, phone, doc_type, doc_number, iva_condition, address, neighborhood, city, province, source, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Juan Perez',
        '+5491155551001',
        'cuit',
        '20-11111111-1',
        'responsable_inscripto',
        'Av. Corrientes 1234',
        'Centro',
        'Buenos Aires',
        'CABA',
        'manual',
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_customer_juan_id;

    -- Customer: Maria Garcia (Monotributista - for Factura C)
    INSERT INTO customers (id, org_id, name, phone, doc_type, doc_number, iva_condition, address, neighborhood, city, province, source, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Maria Garcia',
        '+5491155551002',
        'cuit',
        '27-22222222-2',
        'monotributista',
        'Cabildo 2500',
        'Belgrano',
        'Buenos Aires',
        'CABA',
        'manual',
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_customer_maria_id;

    -- Customer: Pedro Lopez (Consumidor Final - for Factura B)
    INSERT INTO customers (id, org_id, name, phone, doc_type, doc_number, iva_condition, address, neighborhood, city, province, source, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Pedro Lopez',
        '+5491155551003',
        'dni',
        '33333333',
        'consumidor_final',
        'Gorriti 4500',
        'Palermo',
        'Buenos Aires',
        'CABA',
        'manual',
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_customer_pedro_id;

    -- Customer: Ana Martinez (Exento)
    INSERT INTO customers (id, org_id, name, phone, doc_type, doc_number, iva_condition, address, neighborhood, city, province, source, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Ana Martinez',
        '+5491155551004',
        'cuit',
        '23-44444444-4',
        'exento',
        'Santa Fe 3000',
        'Recoleta',
        'Buenos Aires',
        'CABA',
        'manual',
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_customer_ana_id;

    -- Customer: Test Offline
    INSERT INTO customers (id, org_id, name, phone, doc_type, doc_number, iva_condition, address, neighborhood, city, province, source, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Test Offline Customer',
        '+5491155551005',
        'dni',
        '55555555',
        'consumidor_final',
        'Rivadavia 5000',
        'Caballito',
        'Buenos Aires',
        'CABA',
        'manual',
        NOW()
    )
    ON CONFLICT (org_id, phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_customer_offline_id;

    RAISE NOTICE 'Created/updated customers: Juan=%, Maria=%, Pedro=%, Ana=%, Offline=%',
        v_customer_juan_id, v_customer_maria_id, v_customer_pedro_id, v_customer_ana_id, v_customer_offline_id;

    -- ============================================
    -- 4. CREATE PRICE BOOK
    -- ============================================

    -- Visita diagnostico
    INSERT INTO price_book (id, org_id, name, description, category, service_type, base_price, tax_rate, includes_tax, afip_product_code, is_active, sort_order, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Visita diagnostico',
        'Visita inicial para diagnóstico del problema',
        'mano_de_obra',
        'general',
        5000.00,
        21.00,
        false,
        '1',
        true,
        1,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Reparacion canilla
    INSERT INTO price_book (id, org_id, name, description, category, service_type, base_price, tax_rate, includes_tax, afip_product_code, is_active, sort_order, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Reparacion canilla',
        'Reparación o reemplazo de canilla/grifo',
        'mano_de_obra',
        'plomeria',
        8000.00,
        21.00,
        false,
        '1',
        true,
        2,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Instalacion aire
    INSERT INTO price_book (id, org_id, name, description, category, service_type, base_price, tax_rate, includes_tax, afip_product_code, is_active, sort_order, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Instalacion aire acondicionado',
        'Instalación completa de split',
        'mano_de_obra',
        'aire_acondicionado',
        25000.00,
        21.00,
        false,
        '1',
        true,
        3,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Caño PVC
    INSERT INTO price_book (id, org_id, name, description, category, service_type, base_price, tax_rate, includes_tax, afip_product_code, is_active, sort_order, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Caño PVC 1/2',
        'Caño PVC de media pulgada por metro',
        'materiales',
        'plomeria',
        500.00,
        21.00,
        false,
        '84172190',
        true,
        4,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Cinta teflon
    INSERT INTO price_book (id, org_id, name, description, category, service_type, base_price, tax_rate, includes_tax, afip_product_code, is_active, sort_order, created_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        'Cinta teflon',
        'Cinta selladora de teflon',
        'consumibles',
        'plomeria',
        200.00,
        21.00,
        false,
        '39172190',
        true,
        5,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created price book items';

    -- ============================================
    -- 5. CREATE SAMPLE JOBS (Various Statuses)
    -- ============================================

    -- Job 1: Pending (no technician)
    INSERT INTO jobs (id, org_id, customer_id, title, description, job_type, priority, status, address, neighborhood, source, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        v_customer_juan_id,
        'Pérdida de agua en cocina',
        'El cliente reporta una pérdida debajo de la pileta de la cocina',
        'plomeria',
        'normal',
        'pending',
        'Av. Corrientes 1234',
        'Centro',
        'manual',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
    )
    RETURNING id INTO v_job1_id;

    -- Job 2: Scheduled (for tomorrow)
    INSERT INTO jobs (id, org_id, customer_id, assigned_to, title, description, job_type, priority, status, scheduled_date, scheduled_time_start, scheduled_time_end, address, neighborhood, source, created_at, updated_at, status_changed_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        v_customer_maria_id,
        v_tech_carlos_id,
        'Instalación aire split',
        'Instalación de aire acondicionado split 3000 frigorías',
        'aire_acondicionado',
        'normal',
        'scheduled',
        CURRENT_DATE + 1,
        '10:00',
        '12:00',
        'Cabildo 2500',
        'Belgrano',
        'manual',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
    )
    RETURNING id INTO v_job2_id;

    -- Job 3: En Camino (happening now)
    INSERT INTO jobs (id, org_id, customer_id, assigned_to, title, description, job_type, priority, status, scheduled_date, scheduled_time_start, scheduled_time_end, address, neighborhood, source, created_at, updated_at, status_changed_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        v_customer_pedro_id,
        v_tech_diego_id,
        'Reparar enchufe',
        'Enchufe de la habitación principal no funciona',
        'electricidad',
        'high',
        'en_camino',
        CURRENT_DATE,
        '14:00',
        '16:00',
        'Gorriti 4500',
        'Palermo',
        'manual',
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '30 minutes',
        NOW() - INTERVAL '30 minutes'
    )
    RETURNING id INTO v_job3_id;

    -- Job 4: Working (tech on site)
    INSERT INTO jobs (id, org_id, customer_id, assigned_to, title, description, job_type, priority, status, scheduled_date, scheduled_time_start, scheduled_time_end, address, neighborhood, actual_start, source, created_at, updated_at, status_changed_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        v_customer_ana_id,
        v_tech_carlos_id,
        'Revisión caldera',
        'Mantenimiento anual de caldera a gas',
        'gas',
        'normal',
        'working',
        CURRENT_DATE,
        '09:00',
        '11:00',
        'Santa Fe 3000',
        'Recoleta',
        NOW() - INTERVAL '1 hour',
        'manual',
        NOW() - INTERVAL '5 hours',
        NOW() - INTERVAL '15 minutes',
        NOW() - INTERVAL '15 minutes'
    )
    RETURNING id INTO v_job4_id;

    -- Job 5: Completed (yesterday)
    INSERT INTO jobs (id, org_id, customer_id, assigned_to, title, description, job_type, priority, status, scheduled_date, scheduled_time_start, scheduled_time_end, address, neighborhood, actual_start, actual_end, notes, source, created_at, updated_at, status_changed_at)
    VALUES (
        gen_random_uuid(),
        v_org_id,
        v_customer_offline_id,
        v_tech_diego_id,
        'Destape cañería',
        'Cañería del baño tapada',
        'plomeria',
        'urgent',
        'completed',
        CURRENT_DATE - 1,
        '16:00',
        '18:00',
        'Rivadavia 5000',
        'Caballito',
        (CURRENT_DATE - 1)::timestamp + TIME '16:15:00',
        (CURRENT_DATE - 1)::timestamp + TIME '17:30:00',
        'Se destapó la cañería principal. Se recomendó mantenimiento preventivo cada 6 meses.',
        'manual',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
    )
    RETURNING id INTO v_job5_id;

    RAISE NOTICE 'Created sample jobs: Job1=%, Job2=%, Job3=%, Job4=%, Job5=%',
        v_job1_id, v_job2_id, v_job3_id, v_job4_id, v_job5_id;

    -- ============================================
    -- 6. SUMMARY
    -- ============================================

    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'TEST DATA SEED COMPLETED SUCCESSFULLY';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Organization ID: %', v_org_id;
    RAISE NOTICE 'Admin User ID: %', v_admin_user_id;
    RAISE NOTICE 'Technicians: Carlos, Diego';
    RAISE NOTICE 'Staff: Admin Sofia, Dispatcher Elena';
    RAISE NOTICE 'Customers: 5 created (various IVA conditions)';
    RAISE NOTICE 'Price Book Items: 5 created';
    RAISE NOTICE 'Sample Jobs: 5 created (various statuses)';
    RAISE NOTICE '===========================================';

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check organization
SELECT id, name, cuit, iva_condition, settings FROM organizations LIMIT 1;

-- Check users by role
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Check customers
SELECT name, phone, iva_condition FROM customers ORDER BY created_at DESC LIMIT 10;

-- Check jobs by status
SELECT status, COUNT(*) FROM jobs GROUP BY status ORDER BY COUNT(*) DESC;

-- Check price book
SELECT name, category, base_price FROM price_book ORDER BY sort_order;
