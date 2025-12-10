/**
 * Service Request Service
 * =======================
 *
 * Business logic for consumer service requests.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import {
  ServiceRequest,
  CreateServiceRequestDTO,
  UpdateServiceRequestDTO,
  ServiceRequestStatus,
  ServiceCategory,
  ServiceUrgency,
  ConsumerPaginationParams,
  ConsumerPaginatedResult,
} from '../consumer.types';
import { ServiceRequestRepository } from './service-request.repository';
import { ConsumerProfileRepository } from '../profiles/consumer-profile.repository';

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ServiceRequestError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'ServiceRequestError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_CATEGORIES = Object.values(ServiceCategory);
const VALID_URGENCIES = Object.values(ServiceUrgency);

function validateCategory(category: string): ServiceCategory {
  if (!VALID_CATEGORIES.includes(category as ServiceCategory)) {
    throw new ServiceRequestError('INVALID_CATEGORY', `Invalid service category: ${category}`);
  }
  return category as ServiceCategory;
}

function validateUrgency(urgency: string): ServiceUrgency {
  if (!VALID_URGENCIES.includes(urgency as ServiceUrgency)) {
    throw new ServiceRequestError('INVALID_URGENCY', `Invalid urgency: ${urgency}`);
  }
  return urgency as ServiceUrgency;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ServiceRequestService {
  private repo: ServiceRequestRepository;
  private profileRepo: ConsumerProfileRepository;

  constructor(pool: Pool) {
    this.repo = new ServiceRequestRepository(pool);
    this.profileRepo = new ConsumerProfileRepository(pool);
  }

  /**
   * Get request by ID
   */
  async getById(id: string): Promise<ServiceRequest> {
    const request = await this.repo.findById(id);
    if (!request) {
      throw new ServiceRequestError('REQUEST_NOT_FOUND', 'Service request not found', 404);
    }
    return request;
  }

  /**
   * Get request by request number
   */
  async getByRequestNumber(requestNumber: string): Promise<ServiceRequest> {
    const request = await this.repo.findByRequestNumber(requestNumber);
    if (!request) {
      throw new ServiceRequestError('REQUEST_NOT_FOUND', 'Service request not found', 404);
    }
    return request;
  }

  /**
   * Get requests for a consumer
   */
  async getConsumerRequests(
    consumerId: string,
    params: { status?: ServiceRequestStatus },
    pagination: ConsumerPaginationParams
  ): Promise<ConsumerPaginatedResult<ServiceRequest>> {
    return this.repo.findByConsumerId(consumerId, params, pagination);
  }

  /**
   * Create a new service request
   */
  async create(consumerId: string, data: CreateServiceRequestDTO): Promise<ServiceRequest> {
    // Validate consumer exists
    const consumer = await this.profileRepo.findById(consumerId);
    if (!consumer) {
      throw new ServiceRequestError('CONSUMER_NOT_FOUND', 'Consumer not found', 404);
    }

    // Validate category
    validateCategory(data.category);

    // Validate urgency if provided
    if (data.urgency) {
      validateUrgency(data.urgency);
    }

    // Validate required fields
    if (!data.title || data.title.trim().length < 5) {
      throw new ServiceRequestError('INVALID_TITLE', 'Title must be at least 5 characters');
    }

    if (!data.description || data.description.trim().length < 10) {
      throw new ServiceRequestError(
        'INVALID_DESCRIPTION',
        'Description must be at least 10 characters'
      );
    }

    if (!data.address || data.address.trim().length < 5) {
      throw new ServiceRequestError('INVALID_ADDRESS', 'Address is required');
    }

    // Create request
    const request = await this.repo.create(consumerId, data);

    // Update consumer stats
    await this.profileRepo.incrementRequestCount(consumerId);

    console.log(
      `[ServiceRequest] Created request ${request.requestNumber} for consumer ${consumerId.slice(0, 8)}...`
    );

    return request;
  }

  /**
   * Update service request
   */
  async update(
    id: string,
    consumerId: string,
    data: UpdateServiceRequestDTO
  ): Promise<ServiceRequest> {
    const request = await this.getById(id);

    // Verify ownership
    if (request.consumerId !== consumerId) {
      throw new ServiceRequestError('UNAUTHORIZED', 'You cannot modify this request', 403);
    }

    // Can only update if still open
    if (!['open', 'quotes_received'].includes(request.status)) {
      throw new ServiceRequestError(
        'CANNOT_UPDATE',
        'Cannot update request in current status'
      );
    }

    // Validate urgency if provided
    if (data.urgency) {
      validateUrgency(data.urgency);
    }

    const updated = await this.repo.update(id, data);
    if (!updated) {
      throw new ServiceRequestError('UPDATE_FAILED', 'Failed to update request');
    }

    return updated;
  }

  /**
   * Cancel service request
   */
  async cancel(id: string, consumerId: string, reason?: string): Promise<ServiceRequest> {
    const request = await this.getById(id);

    // Verify ownership
    if (request.consumerId !== consumerId) {
      throw new ServiceRequestError('UNAUTHORIZED', 'You cannot cancel this request', 403);
    }

    // Can only cancel if not already completed or cancelled
    if (['completed', 'cancelled', 'expired'].includes(request.status)) {
      throw new ServiceRequestError('CANNOT_CANCEL', 'Cannot cancel request in current status');
    }

    const cancelled = await this.repo.cancel(id, reason || 'Cancelled by consumer', 'consumer');
    if (!cancelled) {
      throw new ServiceRequestError('CANCEL_FAILED', 'Failed to cancel request');
    }

    console.log(`[ServiceRequest] Request ${request.requestNumber} cancelled by consumer`);

    return cancelled;
  }

  /**
   * Delete service request (soft delete)
   */
  async delete(id: string, consumerId: string): Promise<void> {
    const request = await this.getById(id);

    // Verify ownership
    if (request.consumerId !== consumerId) {
      throw new ServiceRequestError('UNAUTHORIZED', 'You cannot delete this request', 403);
    }

    // Can only delete if cancelled or expired
    if (!['cancelled', 'expired'].includes(request.status)) {
      throw new ServiceRequestError(
        'CANNOT_DELETE',
        'Can only delete cancelled or expired requests'
      );
    }

    await this.repo.softDelete(id);
    console.log(`[ServiceRequest] Request ${request.requestNumber} deleted`);
  }

  /**
   * Accept a quote for this request
   */
  async acceptQuote(id: string, consumerId: string, quoteId: string): Promise<ServiceRequest> {
    const request = await this.getById(id);

    // Verify ownership
    if (request.consumerId !== consumerId) {
      throw new ServiceRequestError('UNAUTHORIZED', 'You cannot accept quotes for this request', 403);
    }

    // Can only accept if status is open or quotes_received
    if (!['open', 'quotes_received'].includes(request.status)) {
      throw new ServiceRequestError('CANNOT_ACCEPT', 'Cannot accept quote in current status');
    }

    const updated = await this.repo.acceptQuote(id, quoteId);
    if (!updated) {
      throw new ServiceRequestError('ACCEPT_FAILED', 'Failed to accept quote');
    }

    console.log(`[ServiceRequest] Quote ${quoteId.slice(0, 8)}... accepted for request ${request.requestNumber}`);

    return updated;
  }

  /**
   * Mark request as completed
   */
  async markCompleted(id: string, jobId?: string): Promise<ServiceRequest> {
    const request = await this.getById(id);

    if (request.status !== 'accepted' && request.status !== 'in_progress') {
      throw new ServiceRequestError('INVALID_STATUS', 'Request must be accepted or in progress to complete');
    }

    const updated = await this.repo.updateStatus(id, ServiceRequestStatus.COMPLETED, { jobId });
    if (!updated) {
      throw new ServiceRequestError('UPDATE_FAILED', 'Failed to mark as completed');
    }

    // Update consumer stats
    await this.profileRepo.incrementCompletedJobs(request.consumerId);

    console.log(`[ServiceRequest] Request ${request.requestNumber} completed`);

    return updated;
  }

  /**
   * Get consumer request stats
   */
  async getConsumerStats(consumerId: string): Promise<{
    total: number;
    open: number;
    completed: number;
    cancelled: number;
    avgQuotesReceived: number;
  }> {
    return this.repo.getConsumerStats(consumerId);
  }

  /**
   * Get open requests for businesses to see (matching)
   */
  async getOpenRequests(
    params: {
      category?: ServiceCategory;
      city?: string;
      neighborhood?: string;
      urgency?: ServiceUrgency;
    },
    pagination: ConsumerPaginationParams
  ): Promise<ConsumerPaginatedResult<ServiceRequest>> {
    return this.repo.findOpenForMatching(params, pagination);
  }

  /**
   * Add business to matched list
   */
  async addMatchedBusiness(id: string, businessId: string): Promise<void> {
    await this.repo.addMatchedBusiness(id, businessId);
  }

  /**
   * Record quote received
   */
  async recordQuoteReceived(id: string): Promise<void> {
    await this.repo.incrementQuotesReceived(id);
  }

  /**
   * Link job to request
   */
  async linkJob(id: string, jobId: string): Promise<void> {
    await this.repo.linkJob(id, jobId);
  }

  /**
   * Expire old requests (scheduled job)
   */
  async expireOldRequests(): Promise<number> {
    const count = await this.repo.expireOldRequests();
    if (count > 0) {
      console.log(`[ServiceRequest] Expired ${count} old requests`);
    }
    return count;
  }

  /**
   * Get request detail with related info
   */
  async getRequestDetail(id: string, consumerId?: string): Promise<{
    request: ServiceRequest;
    isOwner: boolean;
    canEdit: boolean;
    canCancel: boolean;
    canAcceptQuote: boolean;
  }> {
    const request = await this.getById(id);
    const isOwner = consumerId ? request.consumerId === consumerId : false;

    return {
      request,
      isOwner,
      canEdit: isOwner && ['open', 'quotes_received'].includes(request.status),
      canCancel: isOwner && !['completed', 'cancelled', 'expired'].includes(request.status),
      canAcceptQuote: isOwner && ['open', 'quotes_received'].includes(request.status),
    };
  }
}
