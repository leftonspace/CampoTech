/**
 * WatermelonDB Schema
 * ===================
 *
 * Defines the local database schema for offline-first functionality.
 * Tables are synced with the server when online.
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    // Jobs table - core data for technicians
    tableSchema({
      name: 'jobs',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'customer_id', type: 'string', isIndexed: true },
        { name: 'organization_id', type: 'string', isIndexed: true },
        { name: 'assigned_to_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'service_type', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'priority', type: 'string' },
        { name: 'scheduled_start', type: 'number', isOptional: true, isIndexed: true },
        { name: 'scheduled_end', type: 'number', isOptional: true },
        { name: 'actual_start', type: 'number', isOptional: true },
        { name: 'actual_end', type: 'number', isOptional: true },
        { name: 'address', type: 'string' },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'internal_notes', type: 'string', isOptional: true },
        { name: 'completion_notes', type: 'string', isOptional: true },
        { name: 'materials_used', type: 'string', isOptional: true }, // JSON stringified
        { name: 'signature_url', type: 'string', isOptional: true },
        { name: 'subtotal', type: 'number', isOptional: true },
        { name: 'tax', type: 'number', isOptional: true },
        { name: 'total', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'is_dirty', type: 'boolean' }, // Local changes pending sync
      ],
    }),

    // Customers table
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'organization_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'phone', type: 'string', isIndexed: true },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'dni', type: 'string', isOptional: true },
        { name: 'cuit', type: 'string', isOptional: true, isIndexed: true },
        { name: 'iva_condition', type: 'string', isOptional: true },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'city', type: 'string', isOptional: true },
        { name: 'province', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    // Price book items
    tableSchema({
      name: 'price_book_items',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'organization_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'unit_price', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'tax_rate', type: 'number' },
        { name: 'afip_product_code', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    // Job photos (local storage for offline)
    tableSchema({
      name: 'job_photos',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'local_uri', type: 'string' },
        { name: 'remote_url', type: 'string', isOptional: true },
        { name: 'type', type: 'string' }, // 'before', 'during', 'after', 'signature'
        { name: 'caption', type: 'string', isOptional: true },
        { name: 'uploaded', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),

    // Sync operations queue
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'entity_type', type: 'string', isIndexed: true },
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'operation', type: 'string' }, // 'create', 'update', 'delete'
        { name: 'payload', type: 'string' }, // JSON stringified
        { name: 'priority', type: 'number', isIndexed: true },
        { name: 'retry_count', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),

    // Sync conflicts
    tableSchema({
      name: 'sync_conflicts',
      columns: [
        { name: 'entity_type', type: 'string', isIndexed: true },
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'local_data', type: 'string' }, // JSON
        { name: 'server_data', type: 'string' }, // JSON
        { name: 'conflict_type', type: 'string' },
        { name: 'resolved', type: 'boolean' },
        { name: 'resolution', type: 'string', isOptional: true }, // 'local', 'server', 'merged'
        { name: 'created_at', type: 'number' },
        { name: 'resolved_at', type: 'number', isOptional: true },
      ],
    }),

    // User session
    tableSchema({
      name: 'user_session',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'organization_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'mode', type: 'string' }, // 'simple', 'advanced'
        { name: 'last_sync', type: 'number', isOptional: true },
      ],
    }),

    // Products (inventory)
    tableSchema({
      name: 'products',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'organization_id', type: 'string', isIndexed: true },
        { name: 'sku', type: 'string', isIndexed: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'category_name', type: 'string', isOptional: true },
        { name: 'unit_of_measure', type: 'string' },
        { name: 'sale_price', type: 'number' },
        { name: 'cost_price', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'track_inventory', type: 'boolean' },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Vehicle stock (technician inventory)
    tableSchema({
      name: 'vehicle_stock',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'vehicle_id', type: 'string', isIndexed: true },
        { name: 'product_id', type: 'string', isIndexed: true },
        { name: 'product_name', type: 'string' },
        { name: 'product_sku', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'min_quantity', type: 'number' },
        { name: 'max_quantity', type: 'number' },
        { name: 'unit_cost', type: 'number' },
        { name: 'needs_replenishment', type: 'boolean', isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Replenishment requests
    tableSchema({
      name: 'replenishment_requests',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'vehicle_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'priority', type: 'string' },
        { name: 'items', type: 'string' }, // JSON stringified
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'processed_by_id', type: 'string', isOptional: true },
        { name: 'processed_by_name', type: 'string', isOptional: true },
        { name: 'is_synced', type: 'boolean' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
        { name: 'processed_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});

export default schema;
