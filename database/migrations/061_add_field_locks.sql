-- Migration: 061_add_field_locks
-- Description: Add triggers to prevent modifications on locked fields for Argentine legal compliance (Ley 25.326, AFIP regulations)
-- Created: 2024-12-12

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATION LOCKED FIELDS
-- Prevent modification of CUIT, Razon Social, Tipo Sociedad, Condicion IVA, Punto de Venta AFIP
-- ═══════════════════════════════════════════════════════════════════════════════

-- Note: Organization settings are stored in JSONB 'settings' field
-- We need to check for changes in the settings JSON for fiscal fields

CREATE OR REPLACE FUNCTION prevent_locked_org_settings()
RETURNS TRIGGER AS $$
DECLARE
    old_settings JSONB;
    new_settings JSONB;
BEGIN
    -- Get settings as JSONB
    old_settings := COALESCE(OLD.settings::jsonb, '{}'::jsonb);
    new_settings := COALESCE(NEW.settings::jsonb, '{}'::jsonb);

    -- Check CUIT modification
    IF (old_settings->>'cuit') IS NOT NULL
       AND (old_settings->>'cuit') != ''
       AND (new_settings->>'cuit') IS DISTINCT FROM (old_settings->>'cuit') THEN
        RAISE EXCEPTION 'CUIT cannot be modified. Submit change request to support.';
    END IF;

    -- Check Razon Social modification
    IF (old_settings->>'razonSocial') IS NOT NULL
       AND (old_settings->>'razonSocial') != ''
       AND (new_settings->>'razonSocial') IS DISTINCT FROM (old_settings->>'razonSocial') THEN
        RAISE EXCEPTION 'Razon Social cannot be modified. Submit change request to support.';
    END IF;

    -- Check Tipo Sociedad modification
    IF (old_settings->>'tipoSociedad') IS NOT NULL
       AND (old_settings->>'tipoSociedad') != ''
       AND (new_settings->>'tipoSociedad') IS DISTINCT FROM (old_settings->>'tipoSociedad') THEN
        RAISE EXCEPTION 'Tipo Sociedad cannot be modified. Submit change request to support.';
    END IF;

    -- Check Condicion IVA modification
    IF (old_settings->>'ivaCondition') IS NOT NULL
       AND (old_settings->>'ivaCondition') != ''
       AND (new_settings->>'ivaCondition') IS DISTINCT FROM (old_settings->>'ivaCondition') THEN
        RAISE EXCEPTION 'Condicion IVA cannot be modified. Submit change request to support.';
    END IF;

    -- Check Punto de Venta AFIP modification
    IF (old_settings->>'puntoVentaAfip') IS NOT NULL
       AND (new_settings->>'puntoVentaAfip') IS DISTINCT FROM (old_settings->>'puntoVentaAfip') THEN
        RAISE EXCEPTION 'Punto de Venta AFIP cannot be modified. Submit change request to support.';
    END IF;

    -- Check Ingresos Brutos modification
    IF (old_settings->>'ingresosBrutos') IS NOT NULL
       AND (old_settings->>'ingresosBrutos') != ''
       AND (new_settings->>'ingresosBrutos') IS DISTINCT FROM (old_settings->>'ingresosBrutos') THEN
        RAISE EXCEPTION 'Numero de IIBB cannot be modified. Submit change request to support.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_organization_locked_fields ON organizations;
CREATE TRIGGER protect_organization_locked_fields
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_org_settings();

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER (EMPLOYEE) LOCKED FIELDS
-- Prevent modification of CUIL, DNI, fecha_nacimiento, fecha_ingreso, legal_name
-- ═══════════════════════════════════════════════════════════════════════════════

-- First, let's add the new columns to users table if they don't exist
-- These are needed for proper employee management under Argentine law
DO $$
BEGIN
    -- Add cuil column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'cuil') THEN
        ALTER TABLE users ADD COLUMN cuil TEXT;
        CREATE INDEX idx_users_cuil ON users(cuil);
    END IF;

    -- Add dni column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'dni') THEN
        ALTER TABLE users ADD COLUMN dni TEXT;
    END IF;

    -- Add legal_name column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'legal_name') THEN
        ALTER TABLE users ADD COLUMN legal_name TEXT;
    END IF;

    -- Add fecha_nacimiento column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fecha_nacimiento') THEN
        ALTER TABLE users ADD COLUMN fecha_nacimiento DATE;
    END IF;

    -- Add fecha_ingreso column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fecha_ingreso') THEN
        ALTER TABLE users ADD COLUMN fecha_ingreso DATE;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_locked_user_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check CUIL modification
    IF OLD.cuil IS NOT NULL AND OLD.cuil != '' AND NEW.cuil IS DISTINCT FROM OLD.cuil THEN
        RAISE EXCEPTION 'CUIL cannot be modified. Submit change request to support.';
    END IF;

    -- Check DNI modification
    IF OLD.dni IS NOT NULL AND OLD.dni != '' AND NEW.dni IS DISTINCT FROM OLD.dni THEN
        RAISE EXCEPTION 'DNI cannot be modified. Submit change request to support.';
    END IF;

    -- Check fecha_nacimiento modification
    IF OLD.fecha_nacimiento IS NOT NULL AND NEW.fecha_nacimiento IS DISTINCT FROM OLD.fecha_nacimiento THEN
        RAISE EXCEPTION 'Fecha de nacimiento cannot be modified.';
    END IF;

    -- Check fecha_ingreso modification
    IF OLD.fecha_ingreso IS NOT NULL AND NEW.fecha_ingreso IS DISTINCT FROM OLD.fecha_ingreso THEN
        RAISE EXCEPTION 'Fecha de ingreso cannot be modified. Submit change request to support.';
    END IF;

    -- Check legal_name modification
    IF OLD.legal_name IS NOT NULL AND OLD.legal_name != '' AND NEW.legal_name IS DISTINCT FROM OLD.legal_name THEN
        RAISE EXCEPTION 'Legal name cannot be modified. Submit change request to support.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_user_locked_fields ON users;
CREATE TRIGGER protect_user_locked_fields
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_user_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VEHICLE LOCKED FIELDS
-- Prevent modification of plate_number, VIN, make, model, year
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_locked_vehicle_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check plate_number modification
    IF OLD.plate_number IS NOT NULL AND OLD.plate_number != '' AND NEW.plate_number IS DISTINCT FROM OLD.plate_number THEN
        RAISE EXCEPTION 'Patente cannot be modified. Create a new vehicle instead.';
    END IF;

    -- Check VIN modification
    IF OLD.vin IS NOT NULL AND OLD.vin != '' AND NEW.vin IS DISTINCT FROM OLD.vin THEN
        RAISE EXCEPTION 'VIN cannot be modified.';
    END IF;

    -- Check make modification
    IF OLD.make IS NOT NULL AND OLD.make != '' AND NEW.make IS DISTINCT FROM OLD.make THEN
        RAISE EXCEPTION 'Vehicle make cannot be modified.';
    END IF;

    -- Check model modification
    IF OLD.model IS NOT NULL AND OLD.model != '' AND NEW.model IS DISTINCT FROM OLD.model THEN
        RAISE EXCEPTION 'Vehicle model cannot be modified.';
    END IF;

    -- Check year modification
    IF OLD.year IS NOT NULL AND NEW.year IS DISTINCT FROM OLD.year THEN
        RAISE EXCEPTION 'Vehicle year cannot be modified.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_vehicle_locked_fields ON vehicles;
CREATE TRIGGER protect_vehicle_locked_fields
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_vehicle_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER LOCKED FIELDS
-- Add CUIT fields to customers and prevent modification
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add new fiscal columns to customers
DO $$
BEGIN
    -- Add cuit column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'cuit') THEN
        ALTER TABLE customers ADD COLUMN cuit TEXT;
        CREATE INDEX idx_customers_cuit ON customers(cuit);
    END IF;

    -- Add razon_social column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'razon_social') THEN
        ALTER TABLE customers ADD COLUMN razon_social TEXT;
    END IF;

    -- Add condicion_iva column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'condicion_iva') THEN
        ALTER TABLE customers ADD COLUMN condicion_iva TEXT;
    END IF;

    -- Add dni column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'dni') THEN
        ALTER TABLE customers ADD COLUMN dni TEXT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_locked_customer_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check CUIT modification (business customers)
    IF OLD.cuit IS NOT NULL AND OLD.cuit != '' AND NEW.cuit IS DISTINCT FROM OLD.cuit THEN
        RAISE EXCEPTION 'Customer CUIT cannot be modified. Submit change request to support.';
    END IF;

    -- Check Razon Social modification (only if has CUIT - business customer)
    IF OLD.cuit IS NOT NULL AND OLD.cuit != ''
       AND OLD.razon_social IS NOT NULL AND OLD.razon_social != ''
       AND NEW.razon_social IS DISTINCT FROM OLD.razon_social THEN
        RAISE EXCEPTION 'Razon Social cannot be modified for business customers. Submit change request.';
    END IF;

    -- Check Condicion IVA modification
    IF OLD.condicion_iva IS NOT NULL AND OLD.condicion_iva != '' AND NEW.condicion_iva IS DISTINCT FROM OLD.condicion_iva THEN
        RAISE EXCEPTION 'Condicion IVA cannot be modified. Submit change request to support.';
    END IF;

    -- Check DNI modification
    IF OLD.dni IS NOT NULL AND OLD.dni != '' AND NEW.dni IS DISTINCT FROM OLD.dni THEN
        RAISE EXCEPTION 'Customer DNI cannot be modified. Submit change request to support.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_customer_locked_fields ON customers;
CREATE TRIGGER protect_customer_locked_fields
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_customer_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- INVOICE LOCKED FIELDS
-- Prevent ANY modification to invoices after CAE is assigned
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_invoice_modification_after_cae()
RETURNS TRIGGER AS $$
BEGIN
    -- Only apply restrictions if invoice has CAE
    IF OLD.afip_cae IS NOT NULL AND OLD.afip_cae != '' THEN
        -- Allow ONLY status, paid_at equivalent changes
        -- All other fields must remain unchanged

        -- Check invoice_number
        IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
            RAISE EXCEPTION 'Invoice with CAE cannot be modified. Issue a credit note instead.';
        END IF;

        -- Check CAE
        IF NEW.afip_cae IS DISTINCT FROM OLD.afip_cae THEN
            RAISE EXCEPTION 'Invoice CAE cannot be modified.';
        END IF;

        -- Check CAE expiry
        IF NEW.afip_cae_expiry IS DISTINCT FROM OLD.afip_cae_expiry THEN
            RAISE EXCEPTION 'Invoice CAE expiry cannot be modified.';
        END IF;

        -- Check issue date
        IF NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
            RAISE EXCEPTION 'Invoice issue date cannot be modified after CAE assignment.';
        END IF;

        -- Check invoice type
        IF NEW.type IS DISTINCT FROM OLD.type THEN
            RAISE EXCEPTION 'Invoice type cannot be modified after CAE assignment.';
        END IF;

        -- Check totals
        IF NEW.total IS DISTINCT FROM OLD.total THEN
            RAISE EXCEPTION 'Invoice total cannot be modified after CAE assignment. Issue a credit note instead.';
        END IF;

        IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
            RAISE EXCEPTION 'Invoice subtotal cannot be modified after CAE assignment. Issue a credit note instead.';
        END IF;

        IF NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
            RAISE EXCEPTION 'Invoice tax amount cannot be modified after CAE assignment. Issue a credit note instead.';
        END IF;

        -- Check customer
        IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
            RAISE EXCEPTION 'Invoice customer cannot be modified after CAE assignment.';
        END IF;

        -- Check items
        IF NEW.items::text IS DISTINCT FROM OLD.items::text THEN
            RAISE EXCEPTION 'Invoice items cannot be modified after CAE assignment. Issue a credit note instead.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_invoice_after_cae ON invoices;
CREATE TRIGGER protect_invoice_after_cae
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION prevent_invoice_modification_after_cae();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STOCK MOVEMENT LOCKED - Audit Trail Protection
-- Prevent ANY modification of stock movements
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_stock_movement_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Stock movements cannot be modified. Create an adjustment instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_stock_movements ON stock_movements;
CREATE TRIGGER protect_stock_movements
    BEFORE UPDATE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_movement_modification();

-- ═══════════════════════════════════════════════════════════════════════════════
-- INVENTORY TRANSACTIONS LOCKED - Audit Trail Protection
-- Prevent ANY modification of inventory transactions
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS protect_inventory_transactions ON inventory_transactions;
CREATE TRIGGER protect_inventory_transactions
    BEFORE UPDATE ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_movement_modification();

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCT SKU LOCKED
-- Prevent modification of product SKU after creation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_locked_product_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check SKU modification
    IF OLD.sku IS NOT NULL AND OLD.sku != '' AND NEW.sku IS DISTINCT FROM OLD.sku THEN
        RAISE EXCEPTION 'SKU cannot be modified. Create a new product instead.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_product_locked_fields ON products;
CREATE TRIGGER protect_product_locked_fields
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_product_fields();

-- Also protect inventory_items SKU
DROP TRIGGER IF EXISTS protect_inventory_item_locked_fields ON inventory_items;
CREATE TRIGGER protect_inventory_item_locked_fields
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_product_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- JOB NUMBER AND SIGNATURE LOCKED
-- Prevent modification of job_number and customer_signature after set
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_locked_job_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check job_number modification
    IF OLD.job_number IS NOT NULL AND OLD.job_number != '' AND NEW.job_number IS DISTINCT FROM OLD.job_number THEN
        RAISE EXCEPTION 'Job number cannot be modified.';
    END IF;

    -- Check customer_signature modification (once captured, cannot be changed)
    IF OLD.customer_signature IS NOT NULL AND OLD.customer_signature != '' AND NEW.customer_signature IS DISTINCT FROM OLD.customer_signature THEN
        RAISE EXCEPTION 'Customer signature cannot be modified once captured.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_job_locked_fields ON jobs;
CREATE TRIGGER protect_job_locked_fields
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_job_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHANGE REQUESTS TABLE
-- For requesting changes to locked fields
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS change_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- What to change
    entity_type TEXT NOT NULL, -- 'organization', 'user', 'customer', 'vehicle', 'product'
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    current_value TEXT,
    requested_value TEXT NOT NULL,

    -- Documentation
    reason TEXT NOT NULL,
    document_urls TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_org ON change_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_change_requests_entity ON change_requests(entity_type, entity_id);

-- Comments for documentation
COMMENT ON TABLE change_requests IS 'Requests to modify locked fields that require manual review';
COMMENT ON COLUMN change_requests.entity_type IS 'Type of entity: organization, user, customer, vehicle, product';
COMMENT ON COLUMN change_requests.status IS 'pending: awaiting review, approved: change applied, rejected: change denied';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_change_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_change_request_timestamp ON change_requests;
CREATE TRIGGER set_change_request_timestamp
    BEFORE UPDATE ON change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_change_request_timestamp();
