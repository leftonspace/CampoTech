/**
 * Example: Guarded Service Implementations
 * =========================================
 *
 * This file demonstrates the correct pattern for using capability guards
 * in service methods. Copy and adapt these patterns for your services.
 *
 * PATTERN: Every external service call or feature-gated functionality
 * should be wrapped with a capability guard.
 *
 * RULE: Guards NEVER throw exceptions. They return false and the service
 * implements fallback behavior.
 */

import { guards } from '../capability-guards';

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: AFIP Invoice Service
// ═══════════════════════════════════════════════════════════════════════════════

interface InvoiceData {
  orgId: string;
  customerId: string;
  items: Array<{ description: string; amount: number }>;
  total: number;
}

interface Invoice {
  id: string;
  cae?: string;
  status: 'draft' | 'authorized';
}

class AfipInvoiceService {
  /**
   * Create an invoice with CAE if AFIP is available
   * FALLBACK: Creates draft invoice and queues for later CAE request
   */
  async createInvoice(data: InvoiceData): Promise<Invoice> {
    // ✅ CORRECT: Guard before external call
    if (!await guards.afip(data.orgId)) {
      return this.createDraftInvoice(data);
    }

    // Normal flow: request CAE from AFIP
    return this.createAuthorizedInvoice(data);
  }

  private async createDraftInvoice(data: InvoiceData): Promise<Invoice> {
    // Create draft without CAE
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      status: 'draft',
    };

    // Queue for later CAE request when AFIP is available
    await this.queueForCAE(invoice.id);

    return invoice;
  }

  private async createAuthorizedInvoice(data: InvoiceData): Promise<Invoice> {
    // Call AFIP API to get CAE
    const cae = await this.requestCAEFromAFIP(data);

    return {
      id: crypto.randomUUID(),
      cae,
      status: 'authorized',
    };
  }

  private async requestCAEFromAFIP(_data: InvoiceData): Promise<string> {
    // Actual AFIP API call
    return 'CAE-123456789';
  }

  private async queueForCAE(_invoiceId: string): Promise<void> {
    // Add to CAE processing queue
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Payment Service with Multiple Guards
// ═══════════════════════════════════════════════════════════════════════════════

interface PaymentRequest {
  orgId: string;
  invoiceId: string;
  amount: number;
  method: 'mercadopago' | 'cash' | 'bank_transfer';
}

interface PaymentResult {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  paymentUrl?: string;
}

class PaymentService {
  /**
   * Process a payment request
   * Multiple guards based on payment method
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // ✅ CORRECT: Guard for payment processing in general
    if (!await guards.payments(request.orgId)) {
      throw new Error('Payment processing is currently disabled');
    }

    switch (request.method) {
      case 'mercadopago':
        return this.processMercadoPago(request);
      case 'cash':
      case 'bank_transfer':
        return this.processManualPayment(request);
      default:
        throw new Error(`Unknown payment method: ${request.method}`);
    }
  }

  private async processMercadoPago(request: PaymentRequest): Promise<PaymentResult> {
    // ✅ CORRECT: Specific guard for Mercado Pago
    if (!await guards.mercadopago(request.orgId)) {
      // Fallback: offer alternative payment methods
      return {
        id: crypto.randomUUID(),
        status: 'pending',
        // No paymentUrl - user must use alternative method
      };
    }

    // Call Mercado Pago API
    const paymentUrl = await this.createMPPreference(request);

    return {
      id: crypto.randomUUID(),
      status: 'pending',
      paymentUrl,
    };
  }

  private async processManualPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Manual payments don't need external service guards
    return {
      id: crypto.randomUUID(),
      status: 'pending',
    };
  }

  private async createMPPreference(_request: PaymentRequest): Promise<string> {
    // Actual Mercado Pago API call
    return 'https://www.mercadopago.com/checkout/...';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: WhatsApp Notification Service with SMS Fallback
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationRequest {
  orgId: string;
  phone: string;
  message: string;
  priority: 'critical' | 'normal' | 'promotional';
}

interface NotificationResult {
  channel: 'whatsapp' | 'sms' | 'none';
  messageId?: string;
}

class NotificationService {
  /**
   * Send notification via best available channel
   * FALLBACK: SMS for critical messages, skip promotional
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    // ✅ CORRECT: Guard with fallback logic based on priority
    if (await guards.whatsapp(request.orgId)) {
      return this.sendWhatsApp(request);
    }

    // WhatsApp disabled - apply fallback strategy
    switch (request.priority) {
      case 'critical':
        // Critical messages fall back to SMS
        return this.sendSMS(request);

      case 'normal':
        // Normal messages are queued for later
        await this.queueForLater(request);
        return { channel: 'none' };

      case 'promotional':
        // Promotional messages are skipped entirely
        console.log(`[Notification] Skipping promotional message (WhatsApp disabled)`);
        return { channel: 'none' };

      default:
        return { channel: 'none' };
    }
  }

  private async sendWhatsApp(request: NotificationRequest): Promise<NotificationResult> {
    // Call WhatsApp Cloud API
    return {
      channel: 'whatsapp',
      messageId: crypto.randomUUID(),
    };
  }

  private async sendSMS(request: NotificationRequest): Promise<NotificationResult> {
    // Call SMS provider (Twilio, etc.)
    return {
      channel: 'sms',
      messageId: crypto.randomUUID(),
    };
  }

  private async queueForLater(_request: NotificationRequest): Promise<void> {
    // Add to message queue for later delivery
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Voice AI Processing with Manual Review Fallback
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceMessage {
  orgId: string;
  audioUrl: string;
  senderId: string;
}

interface VoiceProcessingResult {
  transcription?: string;
  extractedJob?: {
    title: string;
    description: string;
  };
  requiresManualReview: boolean;
}

class VoiceProcessingService {
  /**
   * Process incoming voice message
   * FALLBACK: Queue for manual review, prompt user for text
   */
  async processVoiceMessage(message: VoiceMessage): Promise<VoiceProcessingResult> {
    // ✅ CORRECT: Guard for Voice AI
    if (!await guards.voiceAI(message.orgId)) {
      // Queue for manual review
      await this.queueForManualReview(message);

      // Request text input from user
      await this.requestTextFallback(message.senderId);

      return {
        requiresManualReview: true,
      };
    }

    // Normal flow: AI transcription and extraction
    const transcription = await this.transcribeAudio(message.audioUrl);
    const extractedJob = await this.extractJobDetails(transcription);

    return {
      transcription,
      extractedJob,
      requiresManualReview: false,
    };
  }

  private async transcribeAudio(_audioUrl: string): Promise<string> {
    // Call Whisper API
    return 'Transcribed text here...';
  }

  private async extractJobDetails(_text: string): Promise<{ title: string; description: string }> {
    // Call GPT for extraction
    return { title: 'Job Title', description: 'Job Description' };
  }

  private async queueForManualReview(_message: VoiceMessage): Promise<void> {
    // Add to manual review queue
  }

  private async requestTextFallback(_senderId: string): Promise<void> {
    // Send message asking user to type instead
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Job Assignment Service
// ═══════════════════════════════════════════════════════════════════════════════

interface Job {
  id: string;
  orgId: string;
  location: { lat: number; lng: number };
  scheduledDate: Date;
}

interface Technician {
  id: string;
  name: string;
  score?: number;
}

interface AssignmentResult {
  technicians: Technician[];
  isSmartSuggestion: boolean;
}

class JobAssignmentService {
  /**
   * Get technician suggestions for a job
   * FALLBACK: Return all available technicians without scoring
   */
  async getSuggestions(job: Job): Promise<AssignmentResult> {
    // ✅ CORRECT: Guard for smart assignment
    if (!await guards.jobAssignment(job.orgId)) {
      // Return basic list without AI scoring
      const technicians = await this.getAvailableTechnicians(job);
      return {
        technicians,
        isSmartSuggestion: false,
      };
    }

    // Normal flow: AI-powered suggestions with scoring
    const technicians = await this.getSmartSuggestions(job);
    return {
      technicians,
      isSmartSuggestion: true,
    };
  }

  private async getAvailableTechnicians(_job: Job): Promise<Technician[]> {
    // Simple availability check
    return [
      { id: '1', name: 'Tech 1' },
      { id: '2', name: 'Tech 2' },
    ];
  }

  private async getSmartSuggestions(_job: Job): Promise<Technician[]> {
    // AI-powered suggestions with proximity, skills, history
    return [
      { id: '1', name: 'Tech 1', score: 95 },
      { id: '2', name: 'Tech 2', score: 87 },
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Analytics/Reporting Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardData {
  revenue?: { total: number; trend: number };
  jobs?: { completed: number; pending: number };
  customers?: { new: number; returning: number };
}

class ReportingService {
  /**
   * Get dashboard data for organization
   * FALLBACK: Return empty/limited data
   */
  async getDashboardData(orgId: string): Promise<DashboardData> {
    // ✅ CORRECT: Guard for reporting dashboard
    if (!await guards.reportingDashboard(orgId)) {
      // Return minimal data without analytics
      return {
        jobs: await this.getBasicJobStats(orgId),
      };
    }

    // Full analytics dashboard
    return {
      revenue: await this.getRevenueAnalytics(orgId),
      jobs: await this.getJobAnalytics(orgId),
      customers: await this.getCustomerAnalytics(orgId),
    };
  }

  private async getBasicJobStats(_orgId: string): Promise<{ completed: number; pending: number }> {
    return { completed: 10, pending: 5 };
  }

  private async getRevenueAnalytics(_orgId: string): Promise<{ total: number; trend: number }> {
    return { total: 50000, trend: 12.5 };
  }

  private async getJobAnalytics(_orgId: string): Promise<{ completed: number; pending: number }> {
    return { completed: 10, pending: 5 };
  }

  private async getCustomerAnalytics(_orgId: string): Promise<{ new: number; returning: number }> {
    return { new: 3, returning: 15 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Price Book Suggestions
// ═══════════════════════════════════════════════════════════════════════════════

interface PriceItem {
  id: string;
  name: string;
  price: number;
  suggestedPrice?: number;
}

class PricebookService {
  /**
   * Get price items with optional suggestions
   * FALLBACK: Return items without AI suggestions
   */
  async getPriceItems(orgId: string, searchTerm?: string): Promise<PriceItem[]> {
    // ✅ CORRECT: Guard for pricebook features
    if (!await guards.pricebook(orgId)) {
      // Basic price list without suggestions
      return this.getBasicPriceList(orgId, searchTerm);
    }

    // Enhanced with AI suggestions
    return this.getEnhancedPriceList(orgId, searchTerm);
  }

  private async getBasicPriceList(_orgId: string, _search?: string): Promise<PriceItem[]> {
    return [
      { id: '1', name: 'Service A', price: 100 },
      { id: '2', name: 'Service B', price: 200 },
    ];
  }

  private async getEnhancedPriceList(_orgId: string, _search?: string): Promise<PriceItem[]> {
    return [
      { id: '1', name: 'Service A', price: 100, suggestedPrice: 110 },
      { id: '2', name: 'Service B', price: 200, suggestedPrice: 195 },
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS (for reference)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  AfipInvoiceService,
  PaymentService,
  NotificationService,
  VoiceProcessingService,
  JobAssignmentService,
  ReportingService,
  PricebookService,
};
