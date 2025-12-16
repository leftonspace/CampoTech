-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('INSTALACION_SPLIT', 'REPARACION_SPLIT', 'MANTENIMIENTO_SPLIT', 'INSTALACION_CALEFACTOR', 'REPARACION_CALEFACTOR', 'MANTENIMIENTO_CALEFACTOR', 'OTRO');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'URGENTE');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('FACTURA_A', 'FACTURA_B', 'FACTURA_C');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'MERCADOPAGO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "VoiceMessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('HEADQUARTERS', 'BRANCH', 'WAREHOUSE', 'SERVICE_POINT');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('JOB_ASSIGNMENT', 'TECHNICIAN_LOAN', 'CUSTOMER_REFERRAL', 'RESOURCE_SHARE', 'FINANCIAL');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PART', 'CONSUMABLE', 'EQUIPMENT', 'SERVICE');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('MAIN', 'SECONDARY', 'TRANSIT', 'VEHICLE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE_RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'RETURN_IN', 'RETURN_OUT', 'INITIAL_STOCK', 'COUNT_ADJUSTMENT', 'SCRAP', 'VEHICLE_LOAD', 'VEHICLE_RETURN');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CountType" AS ENUM ('FULL', 'CYCLE', 'SPOT', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialSource" AS ENUM ('WAREHOUSE', 'VEHICLE', 'CUSTOMER', 'PURCHASE');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('BEFORE', 'DURING', 'AFTER', 'SIGNATURE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('CHARGEBACK', 'FRAUD_CLAIM', 'SERVICE_NOT_RECEIVED', 'DUPLICATE_CHARGE', 'PRODUCT_NOT_AS_DESCRIBED', 'CANCELLED_TRANSACTION', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING_RESPONSE', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW', 'ESCALATED', 'WON', 'LOST', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VoiceTranscriptStatus" AS ENUM ('PENDING', 'TRANSCRIBING', 'EXTRACTING', 'COMPLETED', 'NEEDS_REVIEW', 'REVIEWED', 'FAILED');

-- CreateEnum
CREATE TYPE "TrackingSessionStatus" AS ENUM ('ACTIVE', 'ARRIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'DIESEL', 'ELECTRIC', 'GNC', 'HYBRID');

-- CreateEnum
CREATE TYPE "VehicleDocumentType" AS ENUM ('INSURANCE', 'VTV', 'REGISTRATION', 'TITLE', 'GREEN_CARD', 'SERVICE_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'INSPECTION', 'REPAIR', 'SCHEDULED_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('PARTS', 'TOOLS', 'CONSUMABLES', 'EQUIPMENT', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryLocationType" AS ENUM ('HUB', 'VEHICLE', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'TRANSFER', 'USE', 'ADJUSTMENT', 'RETURN', 'INITIAL_STOCK', 'SCRAP');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('VEHICLE_DOCUMENT_EXPIRING', 'VEHICLE_DOCUMENT_EXPIRED', 'LOW_STOCK', 'OUT_OF_STOCK', 'VEHICLE_MAINTENANCE_DUE', 'JOB_OVERDUE', 'TECHNICIAN_OFFLINE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "specialty" TEXT,
    "skillLevel" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "homeLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" JSONB NOT NULL,
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "scheduledDate" TIMESTAMP(3),
    "scheduledTimeSlot" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "materialsUsed" JSONB,
    "photos" TEXT[],
    "customerSignature" TEXT,
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,
    "customerId" TEXT NOT NULL,
    "technicianId" TEXT,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "zoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'FACTURA_C',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "items" JSONB NOT NULL,
    "afipCae" TEXT,
    "afipCaeExpiry" TIMESTAMP(3),
    "afipQrCode" TEXT,
    "issuedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "jobId" TEXT,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "invoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "phone" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_messages" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "transcription" TEXT,
    "extractedData" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" "VoiceMessageStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_registrations" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reminders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "senderName" TEXT,
    "mediaId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/ogg',
    "mediaUrl" TEXT,
    "isVoice" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER,
    "transcription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "transcribedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_response_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_response_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_contexts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "messageHistory" JSONB NOT NULL DEFAULT '[]',
    "previousRequests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeJobId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_buffer_stats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalBuffersCreated" INTEGER NOT NULL DEFAULT 0,
    "totalMessagesAggregated" INTEGER NOT NULL DEFAULT 0,
    "totalImmediateTriggers" INTEGER NOT NULL DEFAULT 0,
    "totalTimeoutTriggers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_buffer_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_aggregation_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "combinedContent" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "triggerReason" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_aggregation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportId" TEXT,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "time" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "recipients" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" TEXT NOT NULL,
    "scheduledReportId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "format" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "generationTimeMs" INTEGER,
    "error" TEXT,
    "recipientResults" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportId" TEXT,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "parameters" JSONB,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "generationTimeMs" INTEGER,
    "errorMessage" TEXT,
    "downloadUrl" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "customerId" TEXT,
    "technicianId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'BRANCH',
    "address" JSONB NOT NULL,
    "coordinates" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "phone" TEXT,
    "email" TEXT,
    "managerId" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "coverageRadius" INTEGER,
    "coverageArea" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "boundary" JSONB,
    "color" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_settings" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "operatingHours" JSONB NOT NULL DEFAULT '{}',
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "serviceRadius" INTEGER,
    "maxJobsPerDay" INTEGER,
    "defaultJobDuration" INTEGER,
    "allowEmergencyJobs" BOOLEAN NOT NULL DEFAULT true,
    "emergencyFeePercent" DECIMAL(5,2),
    "pricingMultiplier" DECIMAL(5,3) NOT NULL DEFAULT 1.0,
    "travelFeePerKm" DECIMAL(10,2),
    "minimumTravelFee" DECIMAL(10,2),
    "notifyOnNewJob" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnJobComplete" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatsappNumber" TEXT,
    "whatsappBusinessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_afip_configs" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "puntoDeVenta" INTEGER NOT NULL,
    "tiposPuntoDeVenta" TEXT NOT NULL DEFAULT 'CAJA',
    "cuit" TEXT,
    "razonSocial" TEXT,
    "domicilioFiscal" JSONB,
    "condicionIva" TEXT NOT NULL DEFAULT 'RESPONSABLE_INSCRIPTO',
    "facturaALastNumber" INTEGER NOT NULL DEFAULT 0,
    "facturaBLastNumber" INTEGER NOT NULL DEFAULT 0,
    "facturaCLastNumber" INTEGER NOT NULL DEFAULT 0,
    "notaCreditoALastNumber" INTEGER NOT NULL DEFAULT 0,
    "notaCreditoBLastNumber" INTEGER NOT NULL DEFAULT 0,
    "notaCreditoCLastNumber" INTEGER NOT NULL DEFAULT 0,
    "certificatePath" TEXT,
    "certificateExpiry" TIMESTAMP(3),
    "privateKeyPath" TEXT,
    "wsaaToken" TEXT,
    "wsaaTokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_afip_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_location_transfers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "transferType" "TransferType" NOT NULL,
    "referenceId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "amount" DECIMAL(10,2),
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inter_location_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'PART',
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'UNIDAD',
    "costPrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "marginPercent" DECIMAL(5,2),
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 21.0,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER,
    "reorderQty" INTEGER,
    "weight" DECIMAL(10,3),
    "dimensions" JSONB,
    "imageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSerialTracked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'MAIN',
    "address" JSONB,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_levels" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "storageLocationId" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "quantityOnOrder" INTEGER NOT NULL DEFAULT 0,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "unitCost" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "lastCountedAt" TIMESTAMP(3),
    "lastMovementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "movementNumber" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "jobId" TEXT,
    "purchaseOrderId" TEXT,
    "inventoryCountId" TEXT,
    "transferId" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "performedById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "cuit" TEXT,
    "taxCondition" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" JSONB,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "bankInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "supplierName" TEXT,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "lastPurchaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "shippingMethod" TEXT,
    "shippingCost" DECIMAL(10,2),
    "trackingNumber" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 21.0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receivings" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivingNumber" TEXT NOT NULL,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "hasVariance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receivings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "countType" "CountType" NOT NULL DEFAULT 'FULL',
    "status" "CountStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalItems" INTEGER,
    "matchedItems" INTEGER,
    "varianceItems" INTEGER,
    "totalVariance" DECIMAL(14,2),
    "assignedToId" TEXT,
    "completedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "variance" INTEGER,
    "varianceValue" DECIMAL(12,2),
    "notes" TEXT,
    "countedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_stocks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "maxLevel" INTEGER,
    "lastRefilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishment_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "requestNumber" TEXT NOT NULL,
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_materials" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "estimatedQty" INTEGER NOT NULL DEFAULT 0,
    "usedQty" INTEGER NOT NULL DEFAULT 0,
    "returnedQty" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "sourceType" "MaterialSource" NOT NULL DEFAULT 'WAREHOUSE',
    "sourceId" TEXT,
    "isInvoiced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_photos" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "photoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "photoType" "PhotoType" NOT NULL DEFAULT 'AFTER',
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "localId" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "priceBookId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "afipProductCode" TEXT,
    "afipUnitCode" TEXT DEFAULT '7',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_disputes" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "mpDisputeId" TEXT,
    "disputeType" "DisputeType" NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING_RESPONSE',
    "responseDeadline" TIMESTAMP(3),
    "daysToRespond" INTEGER,
    "evidenceSubmittedAt" TIMESTAMP(3),
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceNotes" TEXT,
    "evidenceDocuments" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "resolutionType" TEXT,
    "disputedAmount" DECIMAL(12,2) NOT NULL,
    "recoveredAmount" DECIMAL(12,2),
    "lastCommunicationAt" TIMESTAMP(3),
    "communicationLog" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_transcripts" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdJobId" TEXT,
    "audioUrl" TEXT NOT NULL,
    "audioDuration" INTEGER,
    "audioQuality" TEXT,
    "audioLanguage" TEXT DEFAULT 'es',
    "transcription" TEXT,
    "transcriptionModel" TEXT,
    "transcriptionConfidence" DECIMAL(3,2),
    "transcriptionSegments" JSONB,
    "extractionData" JSONB,
    "extractionModel" TEXT,
    "overallConfidence" DECIMAL(3,2),
    "humanTranscription" TEXT,
    "humanExtraction" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "status" "VoiceTranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingDurationMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_jobs" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobName" TEXT,
    "jobData" JSONB NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorStack" TEXT,
    "errorCode" TEXT,
    "errorType" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    "userId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "resolutionType" TEXT,
    "retryJobId" TEXT,
    "retriedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "statusCode" INTEGER,
    "organizationId" TEXT,
    "userId" TEXT,
    "operationType" TEXT,
    "requestPath" TEXT,
    "requestMethod" TEXT,
    "requestHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "accuracy" DECIMAL(6,2),
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "altitude" DECIMAL(10,2),
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_location_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "sessionId" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "accuracy" DECIMAL(6,2),
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(6,2),
    "movementMode" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_sessions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "TrackingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentLat" DECIMAL(10,8),
    "currentLng" DECIMAL(11,8),
    "currentSpeed" DECIMAL(6,2),
    "currentHeading" DECIMAL(5,2),
    "destinationLat" DECIMAL(10,8),
    "destinationLng" DECIMAL(11,8),
    "destinationAddress" TEXT,
    "etaMinutes" INTEGER,
    "etaUpdatedAt" TIMESTAMP(3),
    "routePolyline" TEXT,
    "movementMode" TEXT NOT NULL DEFAULT 'driving',
    "positionUpdateCount" INTEGER NOT NULL DEFAULT 0,
    "lastPositionAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eta_cache" (
    "id" TEXT NOT NULL,
    "originLat" DECIMAL(10,8) NOT NULL,
    "originLng" DECIMAL(11,8) NOT NULL,
    "destLat" DECIMAL(10,8) NOT NULL,
    "destLng" DECIMAL(11,8) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eta_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT,
    "color" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentMileage" INTEGER,
    "fuelType" "FuelType" NOT NULL DEFAULT 'GASOLINE',
    "insuranceCompany" TEXT,
    "insurancePolicyNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "vtvExpiry" TIMESTAMP(3),
    "registrationExpiry" TIMESTAMP(3),
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceMileage" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "documentType" "VehicleDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_assignments" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedUntil" TIMESTAMP(3),
    "isPrimaryDriver" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "mileageAtService" INTEGER,
    "cost" DECIMAL(10,2),
    "vendor" TEXT,
    "invoiceNumber" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceMileage" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "InventoryCategory" NOT NULL DEFAULT 'PARTS',
    "unit" TEXT NOT NULL DEFAULT 'pieza',
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationType" "InventoryLocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleId" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lastCountedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "transactionType" "InventoryTransactionType" NOT NULL,
    "jobId" TEXT,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_homeLocationId_idx" ON "users"("homeLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_organizationId_key" ON "users"("email", "organizationId");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");

-- CreateIndex
CREATE INDEX "customers_locationId_idx" ON "customers"("locationId");

-- CreateIndex
CREATE INDEX "customers_zoneId_idx" ON "customers"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobNumber_key" ON "jobs"("jobNumber");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_scheduledDate_idx" ON "jobs"("scheduledDate");

-- CreateIndex
CREATE INDEX "jobs_technicianId_idx" ON "jobs"("technicianId");

-- CreateIndex
CREATE INDEX "jobs_organizationId_idx" ON "jobs"("organizationId");

-- CreateIndex
CREATE INDEX "jobs_locationId_idx" ON "jobs"("locationId");

-- CreateIndex
CREATE INDEX "jobs_zoneId_idx" ON "jobs"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_jobId_key" ON "invoices"("jobId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");

-- CreateIndex
CREATE INDEX "invoices_locationId_idx" ON "invoices"("locationId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_waMessageId_key" ON "whatsapp_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_phone_idx" ON "whatsapp_messages"("phone");

-- CreateIndex
CREATE INDEX "whatsapp_messages_organizationId_idx" ON "whatsapp_messages"("organizationId");

-- CreateIndex
CREATE INDEX "voice_messages_status_idx" ON "voice_messages"("status");

-- CreateIndex
CREATE INDEX "voice_messages_organizationId_idx" ON "voice_messages"("organizationId");

-- CreateIndex
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes"("phone");

-- CreateIndex
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_registrations_phone_key" ON "pending_registrations"("phone");

-- CreateIndex
CREATE INDEX "pending_registrations_phone_idx" ON "pending_registrations"("phone");

-- CreateIndex
CREATE INDEX "pending_registrations_cuit_idx" ON "pending_registrations"("cuit");

-- CreateIndex
CREATE INDEX "pending_registrations_expiresAt_idx" ON "pending_registrations"("expiresAt");

-- CreateIndex
CREATE INDEX "scheduled_reminders_organizationId_idx" ON "scheduled_reminders"("organizationId");

-- CreateIndex
CREATE INDEX "scheduled_reminders_status_scheduledFor_idx" ON "scheduled_reminders"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "audio_messages_organizationId_idx" ON "audio_messages"("organizationId");

-- CreateIndex
CREATE INDEX "audio_messages_status_idx" ON "audio_messages"("status");

-- CreateIndex
CREATE INDEX "audio_messages_senderPhone_idx" ON "audio_messages"("senderPhone");

-- CreateIndex
CREATE INDEX "auto_response_logs_organizationId_idx" ON "auto_response_logs"("organizationId");

-- CreateIndex
CREATE INDEX "auto_response_logs_recipientPhone_idx" ON "auto_response_logs"("recipientPhone");

-- CreateIndex
CREATE INDEX "conversation_contexts_expiresAt_idx" ON "conversation_contexts"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_contexts_organizationId_customerPhone_key" ON "conversation_contexts"("organizationId", "customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "message_buffer_stats_organizationId_date_key" ON "message_buffer_stats"("organizationId", "date");

-- CreateIndex
CREATE INDEX "message_aggregation_events_organizationId_idx" ON "message_aggregation_events"("organizationId");

-- CreateIndex
CREATE INDEX "message_aggregation_events_triggerReason_idx" ON "message_aggregation_events"("triggerReason");

-- CreateIndex
CREATE INDEX "message_aggregation_events_createdAt_idx" ON "message_aggregation_events"("createdAt");

-- CreateIndex
CREATE INDEX "scheduled_reports_organizationId_idx" ON "scheduled_reports"("organizationId");

-- CreateIndex
CREATE INDEX "scheduled_reports_enabled_idx" ON "scheduled_reports"("enabled");

-- CreateIndex
CREATE INDEX "scheduled_reports_nextRunAt_idx" ON "scheduled_reports"("nextRunAt");

-- CreateIndex
CREATE INDEX "reports_organizationId_idx" ON "reports"("organizationId");

-- CreateIndex
CREATE INDEX "reports_templateId_idx" ON "reports"("templateId");

-- CreateIndex
CREATE INDEX "report_executions_scheduledReportId_idx" ON "report_executions"("scheduledReportId");

-- CreateIndex
CREATE INDEX "report_executions_organizationId_idx" ON "report_executions"("organizationId");

-- CreateIndex
CREATE INDEX "report_executions_status_idx" ON "report_executions"("status");

-- CreateIndex
CREATE INDEX "report_history_organizationId_idx" ON "report_history"("organizationId");

-- CreateIndex
CREATE INDEX "report_history_reportType_idx" ON "report_history"("reportType");

-- CreateIndex
CREATE INDEX "report_history_status_idx" ON "report_history"("status");

-- CreateIndex
CREATE INDEX "report_history_generatedAt_idx" ON "report_history"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_jobId_key" ON "reviews"("jobId");

-- CreateIndex
CREATE INDEX "reviews_organizationId_idx" ON "reviews"("organizationId");

-- CreateIndex
CREATE INDEX "reviews_technicianId_idx" ON "reviews"("technicianId");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "locations_organizationId_idx" ON "locations"("organizationId");

-- CreateIndex
CREATE INDEX "locations_isActive_idx" ON "locations"("isActive");

-- CreateIndex
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "locations_organizationId_code_key" ON "locations"("organizationId", "code");

-- CreateIndex
CREATE INDEX "zones_locationId_idx" ON "zones"("locationId");

-- CreateIndex
CREATE INDEX "zones_isActive_idx" ON "zones"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "zones_locationId_code_key" ON "zones"("locationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "location_settings_locationId_key" ON "location_settings"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "location_afip_configs_locationId_key" ON "location_afip_configs"("locationId");

-- CreateIndex
CREATE INDEX "location_afip_configs_puntoDeVenta_idx" ON "location_afip_configs"("puntoDeVenta");

-- CreateIndex
CREATE INDEX "inter_location_transfers_organizationId_idx" ON "inter_location_transfers"("organizationId");

-- CreateIndex
CREATE INDEX "inter_location_transfers_fromLocationId_idx" ON "inter_location_transfers"("fromLocationId");

-- CreateIndex
CREATE INDEX "inter_location_transfers_toLocationId_idx" ON "inter_location_transfers"("toLocationId");

-- CreateIndex
CREATE INDEX "inter_location_transfers_status_idx" ON "inter_location_transfers"("status");

-- CreateIndex
CREATE INDEX "inter_location_transfers_transferType_idx" ON "inter_location_transfers"("transferType");

-- CreateIndex
CREATE INDEX "product_categories_organizationId_idx" ON "product_categories"("organizationId");

-- CreateIndex
CREATE INDEX "product_categories_parentId_idx" ON "product_categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_organizationId_code_key" ON "product_categories"("organizationId", "code");

-- CreateIndex
CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_sku_key" ON "products"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_sku_key" ON "product_variants"("productId", "sku");

-- CreateIndex
CREATE INDEX "warehouses_organizationId_idx" ON "warehouses"("organizationId");

-- CreateIndex
CREATE INDEX "warehouses_locationId_idx" ON "warehouses"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organizationId_code_key" ON "warehouses"("organizationId", "code");

-- CreateIndex
CREATE INDEX "storage_locations_warehouseId_idx" ON "storage_locations"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_warehouseId_code_key" ON "storage_locations"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "inventory_levels_organizationId_idx" ON "inventory_levels"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_levels_productId_idx" ON "inventory_levels"("productId");

-- CreateIndex
CREATE INDEX "inventory_levels_warehouseId_idx" ON "inventory_levels"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_levels_quantityOnHand_idx" ON "inventory_levels"("quantityOnHand");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_levels_productId_variantId_warehouseId_storageLoc_key" ON "inventory_levels"("productId", "variantId", "warehouseId", "storageLocationId", "lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_movementNumber_key" ON "stock_movements"("movementNumber");

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_idx" ON "stock_movements"("organizationId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_movementType_idx" ON "stock_movements"("movementType");

-- CreateIndex
CREATE INDEX "stock_movements_performedAt_idx" ON "stock_movements"("performedAt");

-- CreateIndex
CREATE INDEX "stock_movements_jobId_idx" ON "stock_movements"("jobId");

-- CreateIndex
CREATE INDEX "stock_movements_purchaseOrderId_idx" ON "stock_movements"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "stock_reservations_organizationId_idx" ON "stock_reservations"("organizationId");

-- CreateIndex
CREATE INDEX "stock_reservations_productId_idx" ON "stock_reservations"("productId");

-- CreateIndex
CREATE INDEX "stock_reservations_jobId_idx" ON "stock_reservations"("jobId");

-- CreateIndex
CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations"("status");

-- CreateIndex
CREATE INDEX "suppliers_organizationId_idx" ON "suppliers"("organizationId");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organizationId_code_key" ON "suppliers"("organizationId", "code");

-- CreateIndex
CREATE INDEX "supplier_products_supplierId_idx" ON "supplier_products"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_products_productId_idx" ON "supplier_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplierId_productId_key" ON "supplier_products"("supplierId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_orderNumber_key" ON "purchase_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_organizationId_idx" ON "purchase_orders"("organizationId");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receivings_receivingNumber_key" ON "purchase_receivings"("receivingNumber");

-- CreateIndex
CREATE INDEX "purchase_receivings_purchaseOrderId_idx" ON "purchase_receivings"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_countNumber_key" ON "inventory_counts"("countNumber");

-- CreateIndex
CREATE INDEX "inventory_counts_organizationId_idx" ON "inventory_counts"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_counts_warehouseId_idx" ON "inventory_counts"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_counts_status_idx" ON "inventory_counts"("status");

-- CreateIndex
CREATE INDEX "inventory_count_items_inventoryCountId_idx" ON "inventory_count_items"("inventoryCountId");

-- CreateIndex
CREATE INDEX "inventory_count_items_productId_idx" ON "inventory_count_items"("productId");

-- CreateIndex
CREATE INDEX "vehicle_stocks_organizationId_idx" ON "vehicle_stocks"("organizationId");

-- CreateIndex
CREATE INDEX "vehicle_stocks_technicianId_idx" ON "vehicle_stocks"("technicianId");

-- CreateIndex
CREATE INDEX "vehicle_stocks_productId_idx" ON "vehicle_stocks"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_stocks_technicianId_productId_key" ON "vehicle_stocks"("technicianId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "replenishment_requests_requestNumber_key" ON "replenishment_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "replenishment_requests_organizationId_idx" ON "replenishment_requests"("organizationId");

-- CreateIndex
CREATE INDEX "replenishment_requests_technicianId_idx" ON "replenishment_requests"("technicianId");

-- CreateIndex
CREATE INDEX "replenishment_requests_status_idx" ON "replenishment_requests"("status");

-- CreateIndex
CREATE INDEX "job_materials_jobId_idx" ON "job_materials"("jobId");

-- CreateIndex
CREATE INDEX "job_materials_productId_idx" ON "job_materials"("productId");

-- CreateIndex
CREATE INDEX "job_photos_jobId_idx" ON "job_photos"("jobId");

-- CreateIndex
CREATE INDEX "job_photos_syncStatus_idx" ON "job_photos"("syncStatus");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_disputes_paymentId_idx" ON "payment_disputes"("paymentId");

-- CreateIndex
CREATE INDEX "payment_disputes_status_idx" ON "payment_disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "voice_transcripts_messageId_key" ON "voice_transcripts"("messageId");

-- CreateIndex
CREATE INDEX "voice_transcripts_status_idx" ON "voice_transcripts"("status");

-- CreateIndex
CREATE INDEX "failed_jobs_queueName_status_idx" ON "failed_jobs"("queueName", "status");

-- CreateIndex
CREATE INDEX "failed_jobs_organizationId_idx" ON "failed_jobs"("organizationId");

-- CreateIndex
CREATE INDEX "failed_jobs_status_idx" ON "failed_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_organizationId_idx" ON "idempotency_keys"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "technician_locations_userId_key" ON "technician_locations"("userId");

-- CreateIndex
CREATE INDEX "technician_locations_userId_idx" ON "technician_locations"("userId");

-- CreateIndex
CREATE INDEX "technician_locations_isOnline_idx" ON "technician_locations"("isOnline");

-- CreateIndex
CREATE INDEX "technician_locations_lastSeen_idx" ON "technician_locations"("lastSeen");

-- CreateIndex
CREATE INDEX "technician_location_history_userId_recordedAt_idx" ON "technician_location_history"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "technician_location_history_jobId_idx" ON "technician_location_history"("jobId");

-- CreateIndex
CREATE INDEX "technician_location_history_sessionId_idx" ON "technician_location_history"("sessionId");

-- CreateIndex
CREATE INDEX "tracking_sessions_jobId_idx" ON "tracking_sessions"("jobId");

-- CreateIndex
CREATE INDEX "tracking_sessions_technicianId_idx" ON "tracking_sessions"("technicianId");

-- CreateIndex
CREATE INDEX "tracking_sessions_organizationId_idx" ON "tracking_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "tracking_sessions_status_idx" ON "tracking_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_tokens_token_key" ON "tracking_tokens"("token");

-- CreateIndex
CREATE INDEX "tracking_tokens_token_idx" ON "tracking_tokens"("token");

-- CreateIndex
CREATE INDEX "tracking_tokens_jobId_idx" ON "tracking_tokens"("jobId");

-- CreateIndex
CREATE INDEX "tracking_tokens_expiresAt_idx" ON "tracking_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "eta_cache_expiresAt_idx" ON "eta_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "vehicles_organizationId_idx" ON "vehicles"("organizationId");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_insuranceExpiry_idx" ON "vehicles"("insuranceExpiry");

-- CreateIndex
CREATE INDEX "vehicles_vtvExpiry_idx" ON "vehicles"("vtvExpiry");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_organizationId_plateNumber_key" ON "vehicles"("organizationId", "plateNumber");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_idx" ON "vehicle_documents"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_documents_documentType_idx" ON "vehicle_documents"("documentType");

-- CreateIndex
CREATE INDEX "vehicle_documents_expiryDate_idx" ON "vehicle_documents"("expiryDate");

-- CreateIndex
CREATE INDEX "vehicle_assignments_vehicleId_idx" ON "vehicle_assignments"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_assignments_userId_idx" ON "vehicle_assignments"("userId");

-- CreateIndex
CREATE INDEX "vehicle_assignments_assignedFrom_assignedUntil_idx" ON "vehicle_assignments"("assignedFrom", "assignedUntil");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_vehicleId_idx" ON "vehicle_maintenance"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_maintenanceType_idx" ON "vehicle_maintenance"("maintenanceType");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_scheduledDate_idx" ON "vehicle_maintenance"("scheduledDate");

-- CreateIndex
CREATE INDEX "inventory_items_organizationId_idx" ON "inventory_items"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "inventory_items_isActive_idx" ON "inventory_items"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_organizationId_sku_key" ON "inventory_items"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "inventory_locations_organizationId_idx" ON "inventory_locations"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_locations_locationType_idx" ON "inventory_locations"("locationType");

-- CreateIndex
CREATE INDEX "inventory_locations_vehicleId_idx" ON "inventory_locations"("vehicleId");

-- CreateIndex
CREATE INDEX "inventory_stock_itemId_idx" ON "inventory_stock"("itemId");

-- CreateIndex
CREATE INDEX "inventory_stock_locationId_idx" ON "inventory_stock"("locationId");

-- CreateIndex
CREATE INDEX "inventory_stock_quantity_idx" ON "inventory_stock"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_itemId_locationId_key" ON "inventory_stock"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "inventory_transactions_organizationId_idx" ON "inventory_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_transactions_itemId_idx" ON "inventory_transactions"("itemId");

-- CreateIndex
CREATE INDEX "inventory_transactions_fromLocationId_idx" ON "inventory_transactions"("fromLocationId");

-- CreateIndex
CREATE INDEX "inventory_transactions_toLocationId_idx" ON "inventory_transactions"("toLocationId");

-- CreateIndex
CREATE INDEX "inventory_transactions_transactionType_idx" ON "inventory_transactions"("transactionType");

-- CreateIndex
CREATE INDEX "inventory_transactions_performedAt_idx" ON "inventory_transactions"("performedAt");

-- CreateIndex
CREATE INDEX "dashboard_alerts_organizationId_idx" ON "dashboard_alerts"("organizationId");

-- CreateIndex
CREATE INDEX "dashboard_alerts_alertType_idx" ON "dashboard_alerts"("alertType");

-- CreateIndex
CREATE INDEX "dashboard_alerts_severity_idx" ON "dashboard_alerts"("severity");

-- CreateIndex
CREATE INDEX "dashboard_alerts_isRead_idx" ON "dashboard_alerts"("isRead");

-- CreateIndex
CREATE INDEX "dashboard_alerts_createdAt_idx" ON "dashboard_alerts"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_scheduledReportId_fkey" FOREIGN KEY ("scheduledReportId") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_history" ADD CONSTRAINT "report_history_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_settings" ADD CONSTRAINT "location_settings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_afip_configs" ADD CONSTRAINT "location_afip_configs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_location_transfers" ADD CONSTRAINT "inter_location_transfers_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_location_transfers" ADD CONSTRAINT "inter_location_transfers_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_location_transfers" ADD CONSTRAINT "inter_location_transfers_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_location_transfers" ADD CONSTRAINT "inter_location_transfers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "inventory_counts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receivings" ADD CONSTRAINT "purchase_receivings_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_stocks" ADD CONSTRAINT "vehicle_stocks_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_stocks" ADD CONSTRAINT "vehicle_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcripts" ADD CONSTRAINT "voice_transcripts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcripts" ADD CONSTRAINT "voice_transcripts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_jobs" ADD CONSTRAINT "failed_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_locations" ADD CONSTRAINT "technician_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_tokens" ADD CONSTRAINT "tracking_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tracking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_alerts" ADD CONSTRAINT "dashboard_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
