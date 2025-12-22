-- Create Organization with full Empresa tier
INSERT INTO organizations (
  id, name, cuit, email, phone, address,
  subscription_tier, subscription_status,
  verification_status, can_receive_jobs, marketplace_visible,
  compliance_score, "createdAt", "updatedAt"
) VALUES (
  'org_owner_main',
  'Mi Empresa de Servicios',
  '20-12345678-9',
  'admin@miempresa.com',
  '+54 11 8199-685685',
  'Av. Corrientes 1234, CABA',
  'EMPRESA',
  'active',
  'verified',
  true,
  true,
  100,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  subscription_tier = 'EMPRESA',
  subscription_status = 'active',
  verification_status = 'verified',
  can_receive_jobs = true,
  marketplace_visible = true,
  compliance_score = 100,
  "updatedAt" = NOW();

-- Create Owner User
INSERT INTO users (
  id, phone, name, email, role,
  "organizationId", "isActive",
  verification_status, can_be_assigned_jobs, identity_verified,
  "createdAt", "updatedAt"
) VALUES (
  'user_owner_main',
  '+548199685685',
  'Dueño Principal',
  'admin@miempresa.com',
  'OWNER',
  'org_owner_main',
  true,
  'verified',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'OWNER',
  verification_status = 'verified',
  can_be_assigned_jobs = true,
  identity_verified = true,
  "updatedAt" = NOW();

-- Create Organization Subscription (Empresa tier, active)
INSERT INTO organization_subscriptions (
  id, organization_id, tier, billing_cycle, status,
  current_period_start, current_period_end,
  created_at, updated_at
) VALUES (
  'sub_owner_main',
  'org_owner_main',
  'EMPRESA',
  'MONTHLY',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
) ON CONFLICT (organization_id) DO UPDATE SET
  tier = 'EMPRESA',
  status = 'active',
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW();

-- Create Business Public Profile
INSERT INTO business_public_profiles (
  id, "organizationId", "displayName", description,
  "whatsappNumber", categories, services,
  "averageRating", "totalReviews", "totalJobs",
  "cuitVerified", "insuranceVerified", background_check, professional_license,
  "isActive", "createdAt", "updatedAt"
) VALUES (
  'profile_owner_main',
  'org_owner_main',
  'Mi Empresa de Servicios',
  'Servicios técnicos profesionales con más de 10 años de experiencia.',
  '+548199685685',
  ARRAY['plomeria', 'gas', 'electricidad'],
  '[{"name": "Reparación de cañerías", "description": "Reparación y mantenimiento de cañerías", "priceRange": "$15.000 - $50.000"}]'::jsonb,
  4.8,
  25,
  150,
  true,
  true,
  true,
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT ("organizationId") DO UPDATE SET
  "cuitVerified" = true,
  "insuranceVerified" = true,
  background_check = true,
  professional_license = true,
  "updatedAt" = NOW();
