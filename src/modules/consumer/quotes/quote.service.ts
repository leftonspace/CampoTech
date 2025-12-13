/**
 * Quote Service
 * =============
 *
 * Business logic for quote management.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import {
  QuoteRepository,
  CreateQuoteInput,
  UpdateQuoteInput,
  CreateMessageInput,
  QuoteDeclineInput,
} from './quote.repository';
import { ServiceRequestRepository } from '../requests/service-request.repository';
import { BusinessPublicProfileRepository } from '../discovery/discovery.service';
import { BusinessQuote, QuoteStatus, ServiceCategory } from '../consumer.types';
import { DiscoveryService } from '../discovery/discovery.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubmitQuoteInput {
  requestId: string;
  businessProfileId: string;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  estimatedDurationHours?: number;
  description: string;
  includesPartsMessage?: string;
  validDays?: number;
  notes?: string;
}

export interface QuoteWithDetails extends BusinessQuote {
  business?: {
    id: string;
    displayName: string;
    logoUrl?: string;
    overallRating: number;
    ratingCount: number;
    badges: string[];
  };
  request?: {
    id: string;
    requestNumber: string;
    title: string;
    category: ServiceCategory;
    consumerName?: string;
  };
  unreadMessages: number;
}

export interface QuoteComparisonResult {
  quotes: QuoteWithDetails[];
  stats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    avgDuration: number;
    totalQuotes: number;
  };
  recommendation?: {
    bestValue: string;
    fastestResponse: string;
    highestRated: string;
  };
}

export interface NotificationService {
  sendWhatsApp(phone: string, templateId: string, params: Record<string, string>): Promise<void>;
  sendPush(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class QuoteError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'QuoteError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class QuoteService {
  private repository: QuoteRepository;
  private requestRepository: ServiceRequestRepository;
  private businessRepository: BusinessPublicProfileRepository;
  private discoveryService: DiscoveryService;
  private notificationService?: NotificationService;

  constructor(
    pool: Pool,
    notificationService?: NotificationService
  ) {
    this.repository = new QuoteRepository(pool);
    this.requestRepository = new ServiceRequestRepository(pool);
    this.businessRepository = new BusinessPublicProfileRepository(pool);
    this.discoveryService = new DiscoveryService(pool);
    this.notificationService = notificationService;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTE SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit a quote from a business
   */
  async submitQuote(input: SubmitQuoteInput, orgId: string): Promise<BusinessQuote> {
    // Validate request exists and is open
    const request = await this.requestRepository.findById(input.requestId);
    if (!request) {
      throw new QuoteError('REQUEST_NOT_FOUND', 'Service request not found', 404);
    }

    if (request.status !== 'open' && request.status !== 'quotes_received') {
      throw new QuoteError('REQUEST_NOT_OPEN', 'Request is not accepting quotes');
    }

    // Check if business already quoted
    const alreadyQuoted = await this.repository.hasBusinessQuoted(
      input.requestId,
      input.businessProfileId
    );
    if (alreadyQuoted) {
      throw new QuoteError('ALREADY_QUOTED', 'You have already submitted a quote for this request');
    }

    // Check if business declined
    const declined = await this.repository.hasBusinessDeclined(
      input.requestId,
      input.businessProfileId
    );
    if (declined) {
      throw new QuoteError('ALREADY_DECLINED', 'You have already declined this request');
    }

    // Validate business profile
    const business = await this.businessRepository.findById(input.businessProfileId);
    if (!business) {
      throw new QuoteError('BUSINESS_NOT_FOUND', 'Business profile not found', 404);
    }

    if (!business.isActive) {
      throw new QuoteError('BUSINESS_INACTIVE', 'Business profile is not active');
    }

    // Validate price range
    if (input.estimatedPriceMin <= 0 || input.estimatedPriceMax <= 0) {
      throw new QuoteError('INVALID_PRICE', 'Price must be greater than 0');
    }

    if (input.estimatedPriceMin > input.estimatedPriceMax) {
      throw new QuoteError('INVALID_PRICE_RANGE', 'Minimum price cannot exceed maximum price');
    }

    // Calculate valid until date
    const validDays = input.validDays || 7;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // Create quote
    const quote = await this.repository.create({
      requestId: input.requestId,
      businessProfileId: input.businessProfileId,
      orgId,
      estimatedPriceMin: input.estimatedPriceMin,
      estimatedPriceMax: input.estimatedPriceMax,
      estimatedDurationHours: input.estimatedDurationHours,
      description: input.description,
      includesPartsMessage: input.includesPartsMessage,
      validUntil,
      notes: input.notes,
    });

    // Mark quote as sent
    await this.repository.updateStatus(quote.id, QuoteStatus.SENT);

    // Update request status and quote count
    await this.requestRepository.incrementQuotesReceived(input.requestId);

    // Send notification to consumer
    await this.notifyConsumerNewQuote(request, business, quote);

    return { ...quote, status: QuoteStatus.SENT };
  }

  /**
   * Decline a request (business won't quote)
   */
  async declineRequest(input: QuoteDeclineInput): Promise<void> {
    const request = await this.requestRepository.findById(input.requestId);
    if (!request) {
      throw new QuoteError('REQUEST_NOT_FOUND', 'Service request not found', 404);
    }

    const alreadyQuoted = await this.repository.hasBusinessQuoted(
      input.requestId,
      input.businessProfileId
    );
    if (alreadyQuoted) {
      throw new QuoteError('ALREADY_QUOTED', 'Cannot decline - quote already submitted');
    }

    await this.repository.recordDecline(input);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTE RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get quote by ID with details
   */
  async getQuoteById(id: string, viewerId: string, viewerType: 'consumer' | 'business'): Promise<QuoteWithDetails | null> {
    const quote = await this.repository.findById(id);
    if (!quote) return null;

    // Mark as viewed if consumer is viewing
    if (viewerType === 'consumer' && quote.status === QuoteStatus.SENT) {
      await this.repository.markViewed(id);
    }

    // Mark messages as read
    await this.repository.markMessagesRead(id, viewerId);

    return this.enrichQuote(quote, viewerId);
  }

  /**
   * Get quotes for a request (consumer view)
   */
  async getQuotesForRequest(requestId: string, consumerId: string): Promise<QuoteWithDetails[]> {
    // Verify consumer owns request
    const request = await this.requestRepository.findById(requestId);
    if (!request || request.consumerId !== consumerId) {
      throw new QuoteError('REQUEST_NOT_FOUND', 'Request not found', 404);
    }

    const quotes = await this.repository.findByRequestId(requestId);

    // Mark all sent quotes as viewed
    for (const quote of quotes) {
      if (quote.status === QuoteStatus.SENT) {
        await this.repository.markViewed(quote.id);
      }
    }

    return Promise.all(quotes.map(q => this.enrichQuote(q, consumerId)));
  }

  /**
   * Get quotes for a business
   */
  async getQuotesForBusiness(
    businessProfileId: string,
    status?: QuoteStatus | QuoteStatus[]
  ): Promise<QuoteWithDetails[]> {
    const quotes = await this.repository.findByBusinessProfile(businessProfileId, status);
    return Promise.all(quotes.map(q => this.enrichQuote(q, businessProfileId)));
  }

  /**
   * Get quote comparison for a request
   */
  async compareQuotes(requestId: string, consumerId: string): Promise<QuoteComparisonResult> {
    const request = await this.requestRepository.findById(requestId);
    if (!request || request.consumerId !== consumerId) {
      throw new QuoteError('REQUEST_NOT_FOUND', 'Request not found', 404);
    }

    const comparison = await this.repository.getQuoteComparison(requestId);
    const enrichedQuotes = await Promise.all(
      comparison.quotes.map(q => this.enrichQuote(q, consumerId))
    );

    // Calculate recommendations
    let recommendation: QuoteComparisonResult['recommendation'];
    if (enrichedQuotes.length >= 2) {
      // Best value: lowest average price with good rating
      const sortedByValue = [...enrichedQuotes].sort((a, b) => {
        const priceA = (a.estimatedPriceMin + a.estimatedPriceMax) / 2;
        const priceB = (b.estimatedPriceMin + b.estimatedPriceMax) / 2;
        const ratingA = a.business?.overallRating || 0;
        const ratingB = b.business?.overallRating || 0;
        return (priceA / (ratingA + 1)) - (priceB / (ratingB + 1));
      });

      // Fastest response
      const sortedByResponse = [...enrichedQuotes].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Highest rated
      const sortedByRating = [...enrichedQuotes].sort((a, b) =>
        (b.business?.overallRating || 0) - (a.business?.overallRating || 0)
      );

      recommendation = {
        bestValue: sortedByValue[0].id,
        fastestResponse: sortedByResponse[0].id,
        highestRated: sortedByRating[0].id,
      };
    }

    return {
      quotes: enrichedQuotes,
      stats: {
        avgPrice: comparison.avgPrice,
        minPrice: comparison.minPrice,
        maxPrice: comparison.maxPrice,
        avgDuration: comparison.avgDuration,
        totalQuotes: comparison.quotes.length,
      },
      recommendation,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Accept a quote
   */
  async acceptQuote(quoteId: string, consumerId: string): Promise<BusinessQuote> {
    const quote = await this.repository.findById(quoteId);
    if (!quote) {
      throw new QuoteError('QUOTE_NOT_FOUND', 'Quote not found', 404);
    }

    // Verify consumer owns the request
    const request = await this.requestRepository.findById(quote.requestId);
    if (!request || request.consumerId !== consumerId) {
      throw new QuoteError('UNAUTHORIZED', 'Not authorized to accept this quote', 403);
    }

    if (![QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
      throw new QuoteError('INVALID_STATUS', `Cannot accept quote with status: ${quote.status}`);
    }

    if (quote.validUntil < new Date()) {
      throw new QuoteError('QUOTE_EXPIRED', 'This quote has expired');
    }

    // Accept the quote
    const acceptedQuote = await this.repository.accept(quoteId);

    // Reject other quotes for this request
    const otherQuotes = await this.repository.findByRequestId(quote.requestId);
    for (const other of otherQuotes) {
      if (other.id !== quoteId && [QuoteStatus.SENT, QuoteStatus.VIEWED, QuoteStatus.PENDING].includes(other.status)) {
        await this.repository.reject(other.id, 'Another quote was accepted');
      }
    }

    // Update request status
    await this.requestRepository.acceptQuote(quote.requestId, quoteId);

    // Notify business
    await this.notifyBusinessQuoteAccepted(request, quote);

    return acceptedQuote!;
  }

  /**
   * Reject a quote
   */
  async rejectQuote(quoteId: string, consumerId: string, reason?: string): Promise<BusinessQuote> {
    const quote = await this.repository.findById(quoteId);
    if (!quote) {
      throw new QuoteError('QUOTE_NOT_FOUND', 'Quote not found', 404);
    }

    // Verify consumer owns the request
    const request = await this.requestRepository.findById(quote.requestId);
    if (!request || request.consumerId !== consumerId) {
      throw new QuoteError('UNAUTHORIZED', 'Not authorized to reject this quote', 403);
    }

    if (![QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
      throw new QuoteError('INVALID_STATUS', `Cannot reject quote with status: ${quote.status}`);
    }

    const rejectedQuote = await this.repository.reject(quoteId, reason);

    // Notify business
    await this.notifyBusinessQuoteRejected(request, quote);

    return rejectedQuote!;
  }

  /**
   * Update a quote (business only, before acceptance)
   */
  async updateQuote(
    quoteId: string,
    businessProfileId: string,
    input: UpdateQuoteInput
  ): Promise<BusinessQuote> {
    const quote = await this.repository.findById(quoteId);
    if (!quote) {
      throw new QuoteError('QUOTE_NOT_FOUND', 'Quote not found', 404);
    }

    if (quote.businessProfileId !== businessProfileId) {
      throw new QuoteError('UNAUTHORIZED', 'Not authorized to update this quote', 403);
    }

    if (![QuoteStatus.PENDING, QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
      throw new QuoteError('INVALID_STATUS', 'Cannot update quote after acceptance/rejection');
    }

    if (input.estimatedPriceMin !== undefined && input.estimatedPriceMax !== undefined) {
      if (input.estimatedPriceMin > input.estimatedPriceMax) {
        throw new QuoteError('INVALID_PRICE_RANGE', 'Min price cannot exceed max price');
      }
    }

    const updatedQuote = await this.repository.update(quoteId, input);

    // Notify consumer of update
    const request = await this.requestRepository.findById(quote.requestId);
    if (request) {
      await this.notifyConsumerQuoteUpdated(request, quote);
    }

    return updatedQuote!;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a message on a quote
   */
  async sendMessage(
    quoteId: string,
    senderId: string,
    senderType: 'consumer' | 'business',
    message: string,
    attachments?: string[]
  ): Promise<any> {
    const quote = await this.repository.findById(quoteId);
    if (!quote) {
      throw new QuoteError('QUOTE_NOT_FOUND', 'Quote not found', 404);
    }

    // Verify sender has access
    if (senderType === 'business' && quote.businessProfileId !== senderId) {
      throw new QuoteError('UNAUTHORIZED', 'Not authorized to message on this quote', 403);
    }

    if (senderType === 'consumer') {
      const request = await this.requestRepository.findById(quote.requestId);
      if (!request || request.consumerId !== senderId) {
        throw new QuoteError('UNAUTHORIZED', 'Not authorized to message on this quote', 403);
      }
    }

    const quoteMessage = await this.repository.createMessage({
      quoteId,
      senderId,
      senderType,
      message,
      attachments,
    });

    // Notify recipient
    if (senderType === 'consumer') {
      await this.notifyBusinessNewMessage(quote, message);
    } else {
      const request = await this.requestRepository.findById(quote.requestId);
      if (request) {
        await this.notifyConsumerNewMessage(request, message);
      }
    }

    return quoteMessage;
  }

  /**
   * Get messages for a quote
   */
  async getMessages(quoteId: string, viewerId: string): Promise<any[]> {
    const quote = await this.repository.findById(quoteId);
    if (!quote) {
      throw new QuoteError('QUOTE_NOT_FOUND', 'Quote not found', 404);
    }

    const messages = await this.repository.getMessages(quoteId);
    await this.repository.markMessagesRead(quoteId, viewerId);

    return messages;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS MATCHING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find and notify matching businesses for a request
   */
  async notifyMatchingBusinesses(requestId: string): Promise<number> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new QuoteError('REQUEST_NOT_FOUND', 'Request not found', 404);
    }

    // Get matched businesses from discovery service
    const matches = await this.discoveryService.matchBusinessesForRequest({
      serviceCategory: request.category,
      location: {
        lat: request.lat,
        lng: request.lng,
        city: request.city,
        neighborhood: request.neighborhood,
      },
      urgency: request.urgency,
      budgetRange: request.budgetRange,
      maxBusinesses: 20,
    });

    let notified = 0;
    for (const match of matches) {
      try {
        await this.notifyBusinessNewLead(match.business, request);
        notified++;
      } catch (error) {
        console.error(`Failed to notify business ${match.business.id}:`, error);
      }
    }

    return notified;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private async notifyConsumerNewQuote(
    request: any,
    business: any,
    quote: BusinessQuote
  ): Promise<void> {
    if (!this.notificationService) return;

    // Get consumer details
    const consumerResult = await this.requestRepository['pool'].query(
      `SELECT phone, fcm_token, contact_preference FROM consumer_profiles WHERE id = $1`,
      [request.consumerId]
    );
    const consumer = consumerResult.rows[0];
    if (!consumer) return;

    const avgPrice = (quote.estimatedPriceMin + quote.estimatedPriceMax) / 2;

    // WhatsApp notification
    if (consumer.contact_preference !== 'push_only' && consumer.phone) {
      try {
        await this.notificationService.sendWhatsApp(consumer.phone, 'new_quote', {
          business_name: business.displayName,
          service: request.title,
          price: `$${avgPrice.toLocaleString('es-AR')}`,
          request_number: request.requestNumber,
        });
      } catch (error) {
        console.error('WhatsApp notification failed:', error);
      }
    }

    // Push notification
    if (consumer.fcm_token) {
      try {
        await this.notificationService.sendPush(
          consumer.fcm_token,
          'Nueva cotización recibida',
          `${business.displayName} te envió una cotización por $${avgPrice.toLocaleString('es-AR')}`,
          { type: 'new_quote', quoteId: quote.id, requestId: request.id }
        );
      } catch (error) {
        console.error('Push notification failed:', error);
      }
    }
  }

  private async notifyConsumerQuoteUpdated(request: any, quote: BusinessQuote): Promise<void> {
    if (!this.notificationService) return;

    const consumerResult = await this.requestRepository['pool'].query(
      `SELECT fcm_token FROM consumer_profiles WHERE id = $1`,
      [request.consumerId]
    );
    const consumer = consumerResult.rows[0];
    if (!consumer?.fcm_token) return;

    try {
      await this.notificationService.sendPush(
        consumer.fcm_token,
        'Cotización actualizada',
        'Un proveedor actualizó su cotización',
        { type: 'quote_updated', quoteId: quote.id }
      );
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  private async notifyConsumerNewMessage(request: any, message: string): Promise<void> {
    if (!this.notificationService) return;

    const consumerResult = await this.requestRepository['pool'].query(
      `SELECT fcm_token FROM consumer_profiles WHERE id = $1`,
      [request.consumerId]
    );
    const consumer = consumerResult.rows[0];
    if (!consumer?.fcm_token) return;

    try {
      await this.notificationService.sendPush(
        consumer.fcm_token,
        'Nuevo mensaje',
        message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        { type: 'new_message', requestId: request.id }
      );
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  private async notifyBusinessQuoteAccepted(request: any, quote: BusinessQuote): Promise<void> {
    if (!this.notificationService) return;

    const businessResult = await this.requestRepository['pool'].query(
      `SELECT
         bp.display_name,
         u.phone,
         u.fcm_token
       FROM business_public_profiles bp
       JOIN organizations o ON bp.org_id = o.id
       JOIN users u ON o.owner_id = u.id
       WHERE bp.id = $1`,
      [quote.businessProfileId]
    );
    const business = businessResult.rows[0];
    if (!business) return;

    // WhatsApp notification
    if (business.phone) {
      try {
        await this.notificationService.sendWhatsApp(business.phone, 'quote_accepted', {
          service: request.title,
          request_number: request.requestNumber,
        });
      } catch (error) {
        console.error('WhatsApp notification failed:', error);
      }
    }

    // Push notification
    if (business.fcm_token) {
      try {
        await this.notificationService.sendPush(
          business.fcm_token,
          '¡Cotización aceptada!',
          `Tu cotización para "${request.title}" fue aceptada`,
          { type: 'quote_accepted', quoteId: quote.id }
        );
      } catch (error) {
        console.error('Push notification failed:', error);
      }
    }
  }

  private async notifyBusinessQuoteRejected(request: any, quote: BusinessQuote): Promise<void> {
    if (!this.notificationService) return;

    const businessResult = await this.requestRepository['pool'].query(
      `SELECT fcm_token FROM business_public_profiles bp
       JOIN organizations o ON bp.org_id = o.id
       JOIN users u ON o.owner_id = u.id
       WHERE bp.id = $1`,
      [quote.businessProfileId]
    );
    const business = businessResult.rows[0];
    if (!business?.fcm_token) return;

    try {
      await this.notificationService.sendPush(
        business.fcm_token,
        'Cotización no seleccionada',
        `Tu cotización para "${request.title}" no fue seleccionada`,
        { type: 'quote_rejected', quoteId: quote.id }
      );
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  private async notifyBusinessNewMessage(quote: BusinessQuote, message: string): Promise<void> {
    if (!this.notificationService) return;

    const businessResult = await this.requestRepository['pool'].query(
      `SELECT fcm_token FROM business_public_profiles bp
       JOIN organizations o ON bp.org_id = o.id
       JOIN users u ON o.owner_id = u.id
       WHERE bp.id = $1`,
      [quote.businessProfileId]
    );
    const business = businessResult.rows[0];
    if (!business?.fcm_token) return;

    try {
      await this.notificationService.sendPush(
        business.fcm_token,
        'Nuevo mensaje del cliente',
        message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        { type: 'new_message', quoteId: quote.id }
      );
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  private async notifyBusinessNewLead(business: any, request: any): Promise<void> {
    if (!this.notificationService) return;

    const businessResult = await this.requestRepository['pool'].query(
      `SELECT
         u.phone,
         u.fcm_token
       FROM business_public_profiles bp
       JOIN organizations o ON bp.org_id = o.id
       JOIN users u ON o.owner_id = u.id
       WHERE bp.id = $1`,
      [business.id]
    );
    const owner = businessResult.rows[0];
    if (!owner) return;

    // WhatsApp notification
    if (owner.phone) {
      try {
        await this.notificationService.sendWhatsApp(owner.phone, 'new_lead', {
          service: request.title,
          category: request.category,
          neighborhood: request.neighborhood || request.city,
          urgency: request.urgency === 'emergency' ? 'URGENTE' : 'Normal',
        });
      } catch (error) {
        console.error('WhatsApp notification failed:', error);
      }
    }

    // Push notification
    if (owner.fcm_token) {
      try {
        await this.notificationService.sendPush(
          owner.fcm_token,
          'Nuevo pedido de servicio',
          `${request.title} en ${request.neighborhood || request.city}`,
          { type: 'new_lead', requestId: request.id }
        );
      } catch (error) {
        console.error('Push notification failed:', error);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async enrichQuote(quote: BusinessQuote, viewerId: string): Promise<QuoteWithDetails> {
    const [business, request, unreadCount] = await Promise.all([
      this.businessRepository.findById(quote.businessProfileId),
      this.requestRepository.findById(quote.requestId),
      this.repository.getUnreadCount(quote.id, viewerId),
    ]);

    return {
      ...quote,
      business: business ? {
        id: business.id,
        displayName: business.displayName,
        logoUrl: business.logoUrl,
        overallRating: business.overallRating,
        ratingCount: business.ratingCount,
        badges: business.badges,
      } : undefined,
      request: request ? {
        id: request.id,
        requestNumber: request.requestNumber,
        title: request.title,
        category: request.category,
      } : undefined,
      unreadMessages: unreadCount,
    };
  }
}
