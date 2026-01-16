-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED 500 REALISTIC BUENOS AIRES CUSTOMERS
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- This script generates 500 realistic customers located around Buenos Aires.
-- Features:
-- - Real Buenos Aires streets, neighborhoods, and postal codes
-- - Multiple customers per building (different apartments)
-- - Proper Argentine phone numbers
-- - Coordinates for map display
-- - Mix of individual and business customers
--
-- USAGE: Run in Supabase SQL Editor or via psql
-- ═══════════════════════════════════════════════════════════════════════════════

-- IMPORTANT: Replace this with your actual organization ID
-- You can find it by running: SELECT id FROM organizations LIMIT 1;
DO $$
DECLARE
  org_id TEXT := 'org-demo-001';  -- CHANGE THIS to your organization ID
  
  -- Arrays for generating realistic data
  first_names TEXT[] := ARRAY[
    'María', 'Juan', 'Carlos', 'Ana', 'Luis', 'Sofía', 'Martín', 'Lucía',
    'Diego', 'Valentina', 'Pablo', 'Camila', 'Nicolás', 'Florencia', 'Matías',
    'Agustina', 'Sebastián', 'Carolina', 'Federico', 'Paula', 'Gonzalo', 'Daniela',
    'Tomás', 'Victoria', 'Alejandro', 'Julieta', 'Fernando', 'Milagros', 'Rodrigo',
    'Rocío', 'Facundo', 'Antonella', 'Emiliano', 'Candela', 'Ignacio', 'Abril',
    'Santiago', 'Micaela', 'Maximiliano', 'Delfina', 'Leandro', 'Martina', 'Ezequiel',
    'Catalina', 'Joaquín', 'Lara', 'Lucas', 'Pilar', 'Ramiro', 'Josefina',
    'Manuel', 'Renata', 'Bruno', 'Clara', 'Iván', 'Jazmín', 'Gastón', 'Mora',
    'Andrés', 'Sol', 'Javier', 'Luna', 'Gabriel', 'Bianca', 'Leonardo', 'Emma'
  ];
  
  last_names TEXT[] := ARRAY[
    'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez',
    'Romero', 'Díaz', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Acosta',
    'Benítez', 'Medina', 'Suárez', 'Fernández', 'Castro', 'Ríos', 'Rojas',
    'Molina', 'Ortiz', 'Silva', 'Gutiérrez', 'Vargas', 'Moreno', 'Aguirre',
    'Cabrera', 'Núñez', 'Méndez', 'Cardozo', 'Giménez', 'Herrera', 'Peralta',
    'Figueroa', 'Miranda', 'Paz', 'Vega', 'Campos', 'Carrizo', 'Mansilla',
    'Coronel', 'Ojeda', 'Ledesma', 'Escobar', 'Bravo', 'Pereyra', 'Villalba'
  ];
  
  -- Business name components
  business_types TEXT[] := ARRAY[
    'Construcciones', 'Inmobiliaria', 'Administración', 'Consorcio', 'Estudio',
    'Servicios', 'Comercial', 'Industrial', 'Propiedades', 'Desarrollo'
  ];
  
  business_suffixes TEXT[] := ARRAY['S.A.', 'S.R.L.', 'S.A.S.', 'y Asociados', 'Hnos.', 'e Hijos'];
  
  -- Real Buenos Aires streets with typical building numbers
  streets JSONB := '[
    {"street": "Av. Santa Fe", "min": 800, "max": 5500, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Av. Corrientes", "min": 500, "max": 6500, "neighborhood": "San Nicolás", "cp": "1043"},
    {"street": "Av. Callao", "min": 100, "max": 2000, "neighborhood": "Recoleta", "cp": "1023"},
    {"street": "Av. Rivadavia", "min": 1000, "max": 12000, "neighborhood": "Caballito", "cp": "1406"},
    {"street": "Av. Cabildo", "min": 500, "max": 4500, "neighborhood": "Belgrano", "cp": "1426"},
    {"street": "Av. Las Heras", "min": 1500, "max": 3800, "neighborhood": "Palermo", "cp": "1425"},
    {"street": "Av. Pueyrredón", "min": 100, "max": 2500, "neighborhood": "Recoleta", "cp": "1032"},
    {"street": "Av. Córdoba", "min": 800, "max": 6000, "neighborhood": "Villa Crespo", "cp": "1414"},
    {"street": "Av. Scalabrini Ortiz", "min": 100, "max": 3500, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Av. Libertador", "min": 1000, "max": 8000, "neighborhood": "Núñez", "cp": "1429"},
    {"street": "Av. del Libertador", "min": 500, "max": 6500, "neighborhood": "Palermo", "cp": "1425"},
    {"street": "Av. Juan B. Justo", "min": 1000, "max": 5000, "neighborhood": "Villa Crespo", "cp": "1414"},
    {"street": "Av. Belgrano", "min": 300, "max": 3500, "neighborhood": "Monserrat", "cp": "1092"},
    {"street": "Av. Independencia", "min": 500, "max": 4000, "neighborhood": "San Telmo", "cp": "1099"},
    {"street": "Av. San Juan", "min": 500, "max": 3800, "neighborhood": "San Cristóbal", "cp": "1147"},
    {"street": "Av. Garay", "min": 500, "max": 2500, "neighborhood": "Constitución", "cp": "1153"},
    {"street": "Av. Acoyte", "min": 100, "max": 1200, "neighborhood": "Caballito", "cp": "1405"},
    {"street": "Av. Díaz Vélez", "min": 3500, "max": 5500, "neighborhood": "Almagro", "cp": "1200"},
    {"street": "Calle Florida", "min": 1, "max": 1200, "neighborhood": "Microcentro", "cp": "1005"},
    {"street": "Calle Lavalle", "min": 500, "max": 2000, "neighborhood": "Microcentro", "cp": "1047"},
    {"street": "Thames", "min": 100, "max": 2800, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Gurruchaga", "min": 100, "max": 2500, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Armenia", "min": 1000, "max": 2500, "neighborhood": "Palermo Hollywood", "cp": "1414"},
    {"street": "Honduras", "min": 3500, "max": 6000, "neighborhood": "Palermo Soho", "cp": "1414"},
    {"street": "El Salvador", "min": 4000, "max": 6000, "neighborhood": "Palermo Soho", "cp": "1414"},
    {"street": "Costa Rica", "min": 4000, "max": 6200, "neighborhood": "Palermo Hollywood", "cp": "1414"},
    {"street": "Niceto Vega", "min": 4500, "max": 6000, "neighborhood": "Palermo Hollywood", "cp": "1414"},
    {"street": "Cabrera", "min": 3500, "max": 6000, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Guatemala", "min": 4000, "max": 6000, "neighborhood": "Palermo Soho", "cp": "1425"},
    {"street": "Paraguay", "min": 800, "max": 6000, "neighborhood": "Retiro", "cp": "1057"},
    {"street": "Tucumán", "min": 500, "max": 2500, "neighborhood": "San Nicolás", "cp": "1049"},
    {"street": "Viamonte", "min": 500, "max": 2500, "neighborhood": "San Nicolás", "cp": "1053"},
    {"street": "Sarmiento", "min": 500, "max": 3500, "neighborhood": "Balvanera", "cp": "1041"},
    {"street": "Perón", "min": 500, "max": 3500, "neighborhood": "San Nicolás", "cp": "1038"},
    {"street": "Bartolomé Mitre", "min": 500, "max": 3000, "neighborhood": "San Nicolás", "cp": "1036"},
    {"street": "Arenales", "min": 800, "max": 3500, "neighborhood": "Recoleta", "cp": "1061"},
    {"street": "Juncal", "min": 800, "max": 3500, "neighborhood": "Recoleta", "cp": "1062"},
    {"street": "Peña", "min": 1500, "max": 3000, "neighborhood": "Recoleta", "cp": "1110"},
    {"street": "Beruti", "min": 2500, "max": 4500, "neighborhood": "Palermo", "cp": "1425"},
    {"street": "Charcas", "min": 2500, "max": 5000, "neighborhood": "Palermo", "cp": "1425"},
    {"street": "Güemes", "min": 3500, "max": 5000, "neighborhood": "Palermo", "cp": "1425"},
    {"street": "Mansilla", "min": 2500, "max": 4000, "neighborhood": "Palermo", "cp": "1425"},
    {"street": "Bulnes", "min": 500, "max": 3000, "neighborhood": "Almagro", "cp": "1176"},
    {"street": "Gallo", "min": 500, "max": 2000, "neighborhood": "Almagro", "cp": "1172"},
    {"street": "Billinghurst", "min": 500, "max": 2500, "neighborhood": "Almagro", "cp": "1174"},
    {"street": "Salguero", "min": 500, "max": 3500, "neighborhood": "Palermo", "cp": "1177"},
    {"street": "Uriarte", "min": 1000, "max": 2500, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Malabia", "min": 500, "max": 2800, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Serrano", "min": 1000, "max": 2000, "neighborhood": "Palermo", "cp": "1414"},
    {"street": "Borges", "min": 1500, "max": 2500, "neighborhood": "Palermo", "cp": "1425"}
  ]';
  
  -- Buenos Aires coordinates boundaries (for realistic distribution)
  -- Central Buenos Aires roughly: -34.55 to -34.65 lat, -58.35 to -58.50 lng
  base_lat DECIMAL := -34.60;
  base_lng DECIMAL := -58.43;
  
  -- Variables for generation
  i INTEGER;
  building_count INTEGER := 0;
  current_street JSONB;
  street_name TEXT;
  street_number INTEGER;
  floor_num INTEGER;
  apt TEXT;
  neighborhood TEXT;
  postal_code TEXT;
  customer_name TEXT;
  customer_email TEXT;
  customer_phone TEXT;
  is_business BOOLEAN;
  customer_notes TEXT;
  is_vip BOOLEAN;
  lat DECIMAL;
  lng DECIMAL;
  address_json JSONB;
  customer_id TEXT;
  apartments_in_building INTEGER;
  j INTEGER;
  phone_suffix INTEGER := 50000000;  -- Start from 5000-0000 for test numbers
  
BEGIN
  -- Verify organization exists
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = org_id) THEN
    RAISE EXCEPTION 'Organization % not found. Please update org_id variable.', org_id;
  END IF;
  
  RAISE NOTICE '🌱 Starting to seed 500 customers for organization: %', org_id;
  
  -- Loop to create customers
  -- We'll create ~150 buildings with 2-5 apartments each to reach 500+ customers
  WHILE building_count < 175 LOOP
    -- Pick a random street
    current_street := streets->(floor(random() * jsonb_array_length(streets))::int);
    street_name := current_street->>'street';
    street_number := (current_street->>'min')::int + floor(random() * ((current_street->>'max')::int - (current_street->>'min')::int))::int;
    neighborhood := current_street->>'neighborhood';
    postal_code := current_street->>'cp';
    
    -- Calculate coordinates (add small random offset for each street)
    -- This creates a realistic distribution across Buenos Aires
    lat := base_lat + (random() - 0.5) * 0.12;  -- Roughly ±6km north/south
    lng := base_lng + (random() - 0.5) * 0.15;  -- Roughly ±7.5km east/west
    
    -- Determine how many apartments in this building (2-5)
    apartments_in_building := 2 + floor(random() * 4)::int;
    
    -- Create customers for each apartment in this building
    FOR j IN 1..apartments_in_building LOOP
      -- Random floor (1-12 for high-rises, weighted towards lower floors)
      floor_num := CASE 
        WHEN random() < 0.6 THEN 1 + floor(random() * 5)::int  -- 60% in floors 1-5
        ELSE 6 + floor(random() * 7)::int  -- 40% in floors 6-12
      END;
      
      -- Apartment letter or number
      apt := CASE floor(random() * 8)::int
        WHEN 0 THEN 'A'
        WHEN 1 THEN 'B'
        WHEN 2 THEN 'C'
        WHEN 3 THEN 'D'
        WHEN 4 THEN '1'
        WHEN 5 THEN '2'
        WHEN 6 THEN (floor_num * 2 - 1)::text  -- Odd apartments
        ELSE (floor_num * 2)::text  -- Even apartments
      END;
      
      -- 15% chance of being a business
      is_business := random() < 0.15;
      
      IF is_business THEN
        -- Generate business name
        customer_name := last_names[1 + floor(random() * array_length(last_names, 1))::int] || ' ' ||
                        business_types[1 + floor(random() * array_length(business_types, 1))::int] || ' ' ||
                        business_suffixes[1 + floor(random() * array_length(business_suffixes, 1))::int];
      ELSE
        -- Generate individual name
        customer_name := first_names[1 + floor(random() * array_length(first_names, 1))::int] || ' ' ||
                        last_names[1 + floor(random() * array_length(last_names, 1))::int];
      END IF;
      
      -- Generate email (70% have email)
      IF random() < 0.70 THEN
        customer_email := lower(regexp_replace(
          regexp_replace(customer_name, ' (S\.A\.|S\.R\.L\.|S\.A\.S\.|y Asociados|Hnos\.|e Hijos)', '', 'g'),
          '[^a-zA-Z0-9]', '.', 'g'
        )) || '@' || 
        CASE floor(random() * 5)::int
          WHEN 0 THEN 'gmail.com'
          WHEN 1 THEN 'hotmail.com'
          WHEN 2 THEN 'yahoo.com.ar'
          WHEN 3 THEN 'outlook.com'
          ELSE 'fibertel.com.ar'
        END;
      ELSE
        customer_email := NULL;
      END IF;
      
      -- Generate phone number (+54 9 11 5XXX-XXXX format for test)
      phone_suffix := phone_suffix + 1;
      customer_phone := '+54 9 11 ' || substring(phone_suffix::text, 1, 4) || '-' || substring(phone_suffix::text, 5, 4);
      
      -- VIP status (5% are VIP)
      is_vip := random() < 0.05;
      
      -- Random notes (30% have notes)
      customer_notes := CASE 
        WHEN random() < 0.30 THEN
          CASE floor(random() * 8)::int
            WHEN 0 THEN 'Portero eléctrico código: ' || (1000 + floor(random() * 9000)::int)::text
            WHEN 1 THEN 'Llamar antes de ir. Horario preferido: mañana'
            WHEN 2 THEN 'Dejar con el portero si no está'
            WHEN 3 THEN 'Entrada por cochera. Timbre blanco.'
            WHEN 4 THEN 'Edificio antiguo. Ascensor hasta el 4to piso únicamente.'
            WHEN 5 THEN 'Cliente frecuente. Prefiere pago en efectivo.'
            WHEN 6 THEN 'Mascotas en el hogar. Avisar antes de entrar.'
            ELSE 'Departamento al fondo del pasillo'
          END
        ELSE NULL
      END;
      
      -- Build address JSON with coordinates
      address_json := jsonb_build_object(
        'street', street_name,
        'number', street_number::text,
        'floor', floor_num::text,
        'apartment', apt,
        'neighborhood', neighborhood,
        'city', 'Buenos Aires',
        'province', 'CABA',
        'postalCode', postal_code,
        'coordinates', jsonb_build_object(
          'lat', lat + (random() - 0.5) * 0.001,  -- Tiny offset per apartment
          'lng', lng + (random() - 0.5) * 0.001
        )
      );
      
      -- Generate unique customer ID
      customer_id := 'cust-seed-' || lpad((building_count * 10 + j)::text, 5, '0');
      
      -- Insert customer
      INSERT INTO customers (
        id,
        name,
        phone,
        email,
        address,
        notes,
        "organizationId",
        "isVip",
        "createdAt",
        "updatedAt"
      ) VALUES (
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        address_json,
        customer_notes,
        org_id,
        is_vip,
        NOW() - (random() * interval '180 days'),  -- Random creation date in last 6 months
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        "updatedAt" = NOW();
      
      -- Exit early if we've reached 500
      IF (building_count * 10 + j) >= 500 THEN
        EXIT;
      END IF;
    END LOOP;
    
    building_count := building_count + 1;
    
    -- Progress indicator every 25 buildings
    IF building_count % 25 = 0 THEN
      RAISE NOTICE '  Created customers for % buildings...', building_count;
    END IF;
    
    -- Exit if we have enough
    IF building_count * 3 >= 500 THEN  -- Average 3 per building
      EXIT;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Seeding complete! Created approximately 500 customers';
  RAISE NOTICE '   - Multiple customers per building (different apartments)';
  RAISE NOTICE '   - Real Buenos Aires streets and neighborhoods';
  RAISE NOTICE '   - Coordinates included for map display';
  
END $$;

-- Verify the results
SELECT 
  COUNT(*) as total_customers,
  COUNT(DISTINCT (address->>'street' || ' ' || address->>'number')) as unique_buildings,
  COUNT(CASE WHEN "isVip" THEN 1 END) as vip_customers,
  COUNT(email) as customers_with_email
FROM customers
WHERE id LIKE 'cust-seed-%';
