-- Create Organization with full Empresa tier
INSERT INTO "Organization" (
  id, name, email, phone,
  settings,
  "subscription_tier", "subscription_status",
  "verification_status", "can_receive_jobs", "marketplace_visible",
  "compliance_score", "createdAt", "updatedAt"
) VALUES (
  'org_admin_main',
  'CampoTech Admin',
  'admin@campotech.ar',
  '+5491112345678',
  '{"cuit": "30123456789", "timezone": "America/Argentina/Buenos_Aires"}',
  'EMPRESA',
  'active',
  'verified',
  true,
  true,
  100,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  "subscription_tier" = 'EMPRESA',
  "subscription_status" = 'active',
  "verification_status" = 'verified',
  "can_receive_jobs" = true,
  "marketplace_visible" = true,
  "compliance_score" = 100,
  "updatedAt" = NOW();

-- Create Owner User (password: admin123)
-- Hash: $2a$10$IQJX2jJJ.v7FkZxqy5PxYOqzV5qHqK8JvHnAKzqR5T.FxJzA3ZvDe
INSERT INTO "User" (
  id, phone, name, email, role,
  "organizationId", "isActive",
  "verification_status", "can_be_assigned_jobs", "identity_verified",
  "createdAt", "updatedAt"
) VALUES (
  'user_admin_main',
  '+5491112345678',
  'Admin CampoTech',
  'admin@campotech.ar',
  'OWNER',
  'org_admin_main',
  true,
  'verified',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'OWNER',
  "verification_status" = 'verified',
  "can_be_assigned_jobs" = true,
  "identity_verified" = true,
  "updatedAt" = NOW();

-- Create Organization Subscription (Empresa tier, active)
INSERT INTO "organization_subscriptions" (
  id, organization_id, tier, billing_cycle, status,
  current_period_start, current_period_end,
  created_at, updated_at
) VALUES (
  'sub_admin_main',
  'org_admin_main',
  'EMPRESA',
  'MONTHLY',
  'active',
  NOW(),
  NOW() + INTERVAL '365 days',
  NOW(),
  NOW()
) ON CONFLICT (organization_id) DO UPDATE SET
  tier = 'EMPRESA',
  status = 'active',
  current_period_end = NOW() + INTERVAL '365 days',
  updated_at = NOW();

SELECT 'Admin created! Login: +5491112345678' as result;
