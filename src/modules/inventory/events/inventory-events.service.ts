/**
 * Inventory Events Service
 * Phase 12: Real-time stock updates and event-driven notifications
 */

import { getEventBus, publishEvent, subscribeToEvent, Event } from '@/lib/services/event-bus';
import { sendNotification } from '@/modules/notifications/notification.service';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const InventoryEventTypes = {
  // Stock level events
  STOCK_LEVEL_CHANGED: 'inventory.stock_level_changed',
  STOCK_LOW: 'inventory.stock_low',
  STOCK_OUT: 'inventory.stock_out',
  STOCK_REPLENISHED: 'inventory.stock_replenished',

  // Movement events
  STOCK_MOVEMENT_CREATED: 'inventory.movement_created',
  STOCK_ADJUSTMENT: 'inventory.stock_adjustment',
  STOCK_TRANSFER: 'inventory.stock_transfer',

  // Reservation events
  STOCK_RESERVED: 'inventory.stock_reserved',
  RESERVATION_RELEASED: 'inventory.reservation_released',
  RESERVATION_CONVERTED: 'inventory.reservation_converted',

  // Purchase order events
  PO_CREATED: 'inventory.po_created',
  PO_SENT: 'inventory.po_sent',
  PO_RECEIVED: 'inventory.po_received',
  PO_PARTIALLY_RECEIVED: 'inventory.po_partially_received',
  PO_CANCELLED: 'inventory.po_cancelled',

  // Vehicle stock events
  VEHICLE_STOCK_UPDATED: 'inventory.vehicle_stock_updated',
  REPLENISHMENT_REQUESTED: 'inventory.replenishment_requested',
  REPLENISHMENT_APPROVED: 'inventory.replenishment_approved',
  REPLENISHMENT_COMPLETED: 'inventory.replenishment_completed',

  // Count events
  INVENTORY_COUNT_STARTED: 'inventory.count_started',
  INVENTORY_COUNT_COMPLETED: 'inventory.count_completed',
  COUNT_VARIANCE_DETECTED: 'inventory.count_variance_detected',

  // Alert events
  REORDER_POINT_REACHED: 'inventory.reorder_point_reached',
  EXPIRING_STOCK: 'inventory.expiring_stock',
  AGING_STOCK: 'inventory.aging_stock',
} as const;

export type InventoryEventType = typeof InventoryEventTypes[keyof typeof InventoryEventTypes];

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT PAYLOADS
// ═══════════════════════════════════════════════════════════════════════════════

export interface StockLevelChangedPayload {
  productId: string;
  productName: string;
  productSku: string;
  warehouseId?: string;
  warehouseName?: string;
  previousQuantity: number;
  newQuantity: number;
  changeQuantity: number;
  reason: string;
  userId?: string;
}

export interface StockAlertPayload {
  productId: string;
  productName: string;
  productSku: string;
  warehouseId?: string;
  warehouseName?: string;
  currentQuantity: number;
  minLevel: number;
  reorderPoint?: number;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'REORDER_POINT';
}

export interface MovementPayload {
  movementId: string;
  movementType: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  reference?: string;
  notes?: string;
  userId?: string;
}

export interface POEventPayload {
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  itemCount: number;
  totalAmount: number;
}

export interface VehicleStockPayload {
  vehicleId: string;
  technicianId: string;
  technicianName: string;
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
}

export interface ReplenishmentPayload {
  requestId: string;
  technicianId: string;
  technicianName: string;
  vehicleId: string;
  itemCount: number;
  status: string;
  priority: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT PUBLISHERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Publish stock level changed event
 */
export async function publishStockLevelChanged(
  organizationId: string,
  payload: StockLevelChangedPayload
): Promise<void> {
  await publishEvent(
    InventoryEventTypes.STOCK_LEVEL_CHANGED,
    payload,
    { orgId: organizationId, source: 'inventory' }
  );

  // Check for low stock alerts
  await checkAndPublishStockAlerts(organizationId, payload);
}

/**
 * Publish stock movement event
 */
export async function publishStockMovement(
  organizationId: string,
  payload: MovementPayload
): Promise<void> {
  await publishEvent(
    InventoryEventTypes.STOCK_MOVEMENT_CREATED,
    payload,
    { orgId: organizationId, source: 'inventory' }
  );
}

/**
 * Publish stock alert event
 */
export async function publishStockAlert(
  organizationId: string,
  payload: StockAlertPayload
): Promise<void> {
  const eventType =
    payload.alertType === 'OUT_OF_STOCK'
      ? InventoryEventTypes.STOCK_OUT
      : payload.alertType === 'REORDER_POINT'
      ? InventoryEventTypes.REORDER_POINT_REACHED
      : InventoryEventTypes.STOCK_LOW;

  await publishEvent(eventType, payload, { orgId: organizationId, source: 'inventory' });
}

/**
 * Publish purchase order event
 */
export async function publishPOEvent(
  organizationId: string,
  eventType: InventoryEventType,
  payload: POEventPayload
): Promise<void> {
  await publishEvent(eventType, payload, { orgId: organizationId, source: 'inventory' });
}

/**
 * Publish vehicle stock event
 */
export async function publishVehicleStockEvent(
  organizationId: string,
  payload: VehicleStockPayload
): Promise<void> {
  await publishEvent(
    InventoryEventTypes.VEHICLE_STOCK_UPDATED,
    payload,
    { orgId: organizationId, source: 'inventory' }
  );
}

/**
 * Publish replenishment event
 */
export async function publishReplenishmentEvent(
  organizationId: string,
  eventType: InventoryEventType,
  payload: ReplenishmentPayload
): Promise<void> {
  await publishEvent(eventType, payload, { orgId: organizationId, source: 'inventory' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT CHECKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check stock levels and publish alerts if needed
 */
async function checkAndPublishStockAlerts(
  organizationId: string,
  payload: StockLevelChangedPayload
): Promise<void> {
  try {
    // Get product details with min levels
    const product = await prisma.product.findFirst({
      where: { id: payload.productId, organizationId },
      select: {
        id: true,
        name: true,
        sku: true,
        minStockLevel: true,
        reorderQty: true,
      },
    });

    if (!product) return;

    const alertPayload: StockAlertPayload = {
      productId: payload.productId,
      productName: payload.productName,
      productSku: payload.productSku,
      warehouseId: payload.warehouseId,
      warehouseName: payload.warehouseName,
      currentQuantity: payload.newQuantity,
      minLevel: product.minStockLevel,
      reorderPoint: product.reorderQty || undefined,
      alertType: 'LOW_STOCK',
    };

    // Check for out of stock
    if (payload.newQuantity <= 0 && payload.previousQuantity > 0) {
      alertPayload.alertType = 'OUT_OF_STOCK';
      await publishStockAlert(organizationId, alertPayload);
    }
    // Check for reorder point
    else if (
      product.reorderQty &&
      payload.newQuantity <= product.reorderQty &&
      payload.previousQuantity > product.reorderQty
    ) {
      alertPayload.alertType = 'REORDER_POINT';
      await publishStockAlert(organizationId, alertPayload);
    }
    // Check for low stock
    else if (
      payload.newQuantity <= product.minStockLevel &&
      payload.previousQuantity > product.minStockLevel
    ) {
      alertPayload.alertType = 'LOW_STOCK';
      await publishStockAlert(organizationId, alertPayload);
    }
  } catch (error) {
    log.error('Error checking stock alerts', { error, productId: payload.productId });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT SUBSCRIBERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to inventory events
 */
export function subscribeToInventoryEvent<T>(
  eventType: InventoryEventType,
  handler: (event: Event<T>) => void | Promise<void>
): () => void {
  return subscribeToEvent(eventType, handler);
}

/**
 * Subscribe to all stock alerts for an organization
 */
export function subscribeToStockAlerts(
  organizationId: string,
  handler: (event: Event<StockAlertPayload>) => void | Promise<void>
): () => void {
  const eventBus = getEventBus();

  const alertTypes = [
    InventoryEventTypes.STOCK_LOW,
    InventoryEventTypes.STOCK_OUT,
    InventoryEventTypes.REORDER_POINT_REACHED,
  ];

  const unsubscribers = alertTypes.map((type) =>
    eventBus.subscribeForOrg(organizationId, type, handler)
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Subscribe to all stock level changes for an organization
 */
export function subscribeToStockChanges(
  organizationId: string,
  handler: (event: Event<StockLevelChangedPayload>) => void | Promise<void>
): () => void {
  return getEventBus().subscribeForOrg(
    organizationId,
    InventoryEventTypes.STOCK_LEVEL_CHANGED,
    handler
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize inventory event handlers for notifications
 */
export function initializeInventoryNotifications(): void {
  // Low stock alerts
  subscribeToInventoryEvent<StockAlertPayload>(
    InventoryEventTypes.STOCK_LOW,
    async (event) => {
      await sendLowStockNotification(event.metadata.orgId!, event.payload);
    }
  );

  // Out of stock alerts
  subscribeToInventoryEvent<StockAlertPayload>(
    InventoryEventTypes.STOCK_OUT,
    async (event) => {
      await sendOutOfStockNotification(event.metadata.orgId!, event.payload);
    }
  );

  // Reorder point alerts
  subscribeToInventoryEvent<StockAlertPayload>(
    InventoryEventTypes.REORDER_POINT_REACHED,
    async (event) => {
      await sendReorderPointNotification(event.metadata.orgId!, event.payload);
    }
  );

  // Replenishment request notifications
  subscribeToInventoryEvent<ReplenishmentPayload>(
    InventoryEventTypes.REPLENISHMENT_REQUESTED,
    async (event) => {
      await sendReplenishmentRequestNotification(event.metadata.orgId!, event.payload);
    }
  );

  // PO received notifications
  subscribeToInventoryEvent<POEventPayload>(
    InventoryEventTypes.PO_RECEIVED,
    async (event) => {
      await sendPOReceivedNotification(event.metadata.orgId!, event.payload);
    }
  );

  log.info('Inventory notification handlers initialized');
}

/**
 * Send low stock notification
 */
async function sendLowStockNotification(
  organizationId: string,
  payload: StockAlertPayload
): Promise<void> {
  // Get users with inventory management permissions
  const users = await getInventoryManagers(organizationId);

  for (const user of users) {
    await sendNotification({
      eventType: 'system_alert',
      userId: user.id,
      organizationId,
      title: 'Stock bajo',
      body: `${payload.productName} (${payload.productSku}) tiene stock bajo: ${payload.currentQuantity} unidades${
        payload.warehouseName ? ` en ${payload.warehouseName}` : ''
      }`,
      data: {
        type: 'low_stock',
        productId: payload.productId,
        warehouseId: payload.warehouseId,
        currentQuantity: payload.currentQuantity,
        minLevel: payload.minLevel,
      },
      entityType: 'product',
      entityId: payload.productId,
    });
  }
}

/**
 * Send out of stock notification
 */
async function sendOutOfStockNotification(
  organizationId: string,
  payload: StockAlertPayload
): Promise<void> {
  const users = await getInventoryManagers(organizationId);

  for (const user of users) {
    await sendNotification({
      eventType: 'system_alert',
      userId: user.id,
      organizationId,
      title: 'Sin stock',
      body: `${payload.productName} (${payload.productSku}) se ha agotado${
        payload.warehouseName ? ` en ${payload.warehouseName}` : ''
      }`,
      data: {
        type: 'out_of_stock',
        productId: payload.productId,
        warehouseId: payload.warehouseId,
      },
      entityType: 'product',
      entityId: payload.productId,
    });
  }
}

/**
 * Send reorder point notification
 */
async function sendReorderPointNotification(
  organizationId: string,
  payload: StockAlertPayload
): Promise<void> {
  const users = await getInventoryManagers(organizationId);

  for (const user of users) {
    await sendNotification({
      eventType: 'system_alert',
      userId: user.id,
      organizationId,
      title: 'Punto de reorden alcanzado',
      body: `${payload.productName} (${payload.productSku}) alcanzó el punto de reorden: ${payload.currentQuantity} unidades`,
      data: {
        type: 'reorder_point',
        productId: payload.productId,
        warehouseId: payload.warehouseId,
        currentQuantity: payload.currentQuantity,
        reorderPoint: payload.reorderPoint,
      },
      entityType: 'product',
      entityId: payload.productId,
    });
  }
}

/**
 * Send replenishment request notification
 */
async function sendReplenishmentRequestNotification(
  organizationId: string,
  payload: ReplenishmentPayload
): Promise<void> {
  const users = await getInventoryManagers(organizationId);

  for (const user of users) {
    await sendNotification({
      eventType: 'system_alert',
      userId: user.id,
      organizationId,
      title: 'Solicitud de reposición',
      body: `${payload.technicianName} solicitó reposición de ${payload.itemCount} productos (Prioridad: ${payload.priority})`,
      data: {
        type: 'replenishment_request',
        requestId: payload.requestId,
        technicianId: payload.technicianId,
        vehicleId: payload.vehicleId,
      },
      entityType: 'replenishment_request',
      entityId: payload.requestId,
    });
  }
}

/**
 * Send PO received notification
 */
async function sendPOReceivedNotification(
  organizationId: string,
  payload: POEventPayload
): Promise<void> {
  const users = await getInventoryManagers(organizationId);

  for (const user of users) {
    await sendNotification({
      eventType: 'system_alert',
      userId: user.id,
      organizationId,
      title: 'Orden de compra recibida',
      body: `OC ${payload.poNumber} de ${payload.supplierName} ha sido recibida (${payload.itemCount} items)`,
      data: {
        type: 'po_received',
        purchaseOrderId: payload.purchaseOrderId,
        poNumber: payload.poNumber,
        supplierId: payload.supplierId,
      },
      entityType: 'purchase_order',
      entityId: payload.purchaseOrderId,
    });
  }
}

/**
 * Get users with inventory management permissions
 */
async function getInventoryManagers(organizationId: string): Promise<Array<{ id: string }>> {
  return prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: { in: ['owner', 'admin', 'dispatcher'] },
    },
    select: { id: true },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  InventoryEventTypes,
  publishStockLevelChanged,
  publishStockMovement,
  publishStockAlert,
  publishPOEvent,
  publishVehicleStockEvent,
  publishReplenishmentEvent,
  subscribeToInventoryEvent,
  subscribeToStockAlerts,
  subscribeToStockChanges,
  initializeInventoryNotifications,
};
