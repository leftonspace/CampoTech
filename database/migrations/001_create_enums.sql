-- Migration: 001_create_enums
-- Description: Create all enum types used across the database
-- Created: 2024-01-15

-- Job Status Enum
CREATE TYPE job_status AS ENUM (
    'pending',
    'scheduled',
    'en_camino',
    'working',
    'completed',
    'cancelled'
);

-- Invoice Status Enum
CREATE TYPE invoice_status AS ENUM (
    'draft',
    'pending_cae',
    'issued',
    'sent',
    'paid',
    'partial',
    'overdue',
    'cancelled',
    'refunded'
);

-- Payment Status Enum
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'approved',
    'rejected',
    'cancelled',
    'refunded',
    'partial_refund',
    'in_dispute',
    'chargedback'
);

-- Message Status Enum
CREATE TYPE message_status AS ENUM (
    'received',
    'queued',
    'sent',
    'delivered',
    'read',
    'failed',
    'fallback_sms',
    'undeliverable'
);

-- Sync Status Enum
CREATE TYPE sync_status AS ENUM (
    'pending',
    'syncing',
    'synced',
    'conflict',
    'failed'
);

-- Voice Processing Status Enum
CREATE TYPE voice_processing_status AS ENUM (
    'pending',
    'transcribing',
    'extracting',
    'completed',
    'needs_review',
    'reviewed',
    'failed'
);

-- IVA Condition Enum
CREATE TYPE iva_condition AS ENUM (
    'responsable_inscripto',
    'monotributista',
    'exento',
    'consumidor_final'
);

-- Document Type Enum
CREATE TYPE doc_type AS ENUM (
    'dni',
    'cuit',
    'cuil'
);

-- User Role Enum
CREATE TYPE user_role AS ENUM (
    'owner',
    'admin',
    'dispatcher',
    'technician',
    'accountant'
);

-- Job Type Enum
CREATE TYPE job_type AS ENUM (
    'plomeria',
    'electricidad',
    'aire_acondicionado',
    'gas',
    'general'
);

-- Priority Enum
CREATE TYPE priority_level AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

-- Invoice Type Enum (AFIP)
CREATE TYPE invoice_type AS ENUM (
    'A',
    'B',
    'C'
);

-- Message Direction Enum
CREATE TYPE message_direction AS ENUM (
    'inbound',
    'outbound'
);

-- Message Type Enum
CREATE TYPE message_type AS ENUM (
    'text',
    'voice',
    'image',
    'template'
);

-- Source Enum
CREATE TYPE record_source AS ENUM (
    'manual',
    'whatsapp',
    'voice'
);

-- Price Book Category Enum
CREATE TYPE pricebook_category AS ENUM (
    'mano_de_obra',
    'materiales',
    'consumibles',
    'viatico'
);

-- Payment Method Enum
CREATE TYPE payment_method AS ENUM (
    'credit_card',
    'debit_card',
    'account_money',
    'cash',
    'transfer'
);
