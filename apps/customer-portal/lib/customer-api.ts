/**
 * Customer Portal API Client
 * ==========================
 *
 * Type-safe API client for the customer portal backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total?: number;
    page?: number;
    totalPages?: number;
  };
}

export interface CustomerProfile {
  id: string;
  orgId: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CustomerDashboard {
  profile: CustomerProfile;
  upcomingJobs: Array<{
    id: string;
    description: string;
    scheduledAt: string;
    status: string;
    technicianName?: string;
  }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber?: number;
    total: number;
    status: string;
    issuedAt?: string;
  }>;
  unpaidBalance: number;
  openTickets: number;
  unratedJobs: number;
  stats: {
    totalJobs: number;
    completedJobs: number;
    totalSpent: number;
  };
}

export interface Job {
  id: string;
  description: string;
  address: string;
  city?: string;
  scheduledAt?: string;
  completedAt?: string;
  status: string;
  technicianName?: string;
  total: number;
  rating?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber?: number;
  invoiceType: string;
  status: string;
  issuedAt?: string;
  dueDate?: string;
  total: number;
  pdfUrl?: string;
}

export interface Booking {
  id: string;
  serviceTypeName: string;
  requestedDateTime: string;
  confirmedDateTime?: string;
  address: string;
  status: string;
  estimatedPrice?: number;
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface DayAvailability {
  date: string;
  isOpen: boolean;
  slots: TimeSlot[];
  availableSlots: number;
}

export interface ServiceType {
  id: string;
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  basePrice: number;
  category: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  authorType: 'customer' | 'staff';
  authorName: string;
  content: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class CustomerApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private orgId: string | null = null;

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('customer_access_token', accessToken);
      localStorage.setItem('customer_refresh_token', refreshToken);
    }
  }

  setOrgId(orgId: string) {
    this.orgId = orgId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('customer_org_id', orgId);
    }
  }

  loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('customer_access_token');
      this.refreshToken = localStorage.getItem('customer_refresh_token');
      this.orgId = localStorage.getItem('customer_org_id');
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('customer_access_token');
      localStorage.removeItem('customer_refresh_token');
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}/customer${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle token refresh
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return retryResponse.json();
        }
      }

      return response.json();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server',
        },
      };
    }
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/customer/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      if (data.success) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }

      this.clearTokens();
      return false;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  async requestMagicLink(email: string, orgId: string) {
    return this.request<{ email: string; expiresAt: string }>('/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email, orgId }),
    });
  }

  async verifyMagicLink(token: string) {
    const result = await this.request<{
      customer: CustomerProfile;
      tokens: { accessToken: string; refreshToken: string };
      isNewCustomer: boolean;
    }>('/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    if (result.success && result.data) {
      this.setTokens(result.data.tokens.accessToken, result.data.tokens.refreshToken);
    }

    return result;
  }

  async requestOTP(phone: string, orgId: string) {
    return this.request<{ phone: string; expiresAt: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone, orgId }),
    });
  }

  async verifyOTP(phone: string, code: string, orgId: string) {
    const result = await this.request<{
      customer: CustomerProfile;
      tokens: { accessToken: string; refreshToken: string };
      isNewCustomer: boolean;
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, orgId }),
    });

    if (result.success && result.data) {
      this.setTokens(result.data.tokens.accessToken, result.data.tokens.refreshToken);
    }

    return result;
  }

  async logout() {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    this.clearTokens();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD & PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  async getDashboard() {
    return this.request<CustomerDashboard>('/portal/dashboard');
  }

  async getProfile() {
    return this.request<CustomerProfile>('/portal/profile');
  }

  async updateProfile(data: Partial<CustomerProfile>) {
    return this.request<CustomerProfile>('/portal/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING
  // ═══════════════════════════════════════════════════════════════════════════

  async getServices() {
    return this.request<ServiceType[]>('/portal/services');
  }

  async getAvailability(startDate: string, endDate: string, serviceTypeId?: string) {
    const params = new URLSearchParams({ startDate, endDate });
    if (serviceTypeId) params.set('serviceTypeId', serviceTypeId);
    return this.request<DayAvailability[]>(`/portal/availability?${params}`);
  }

  async createBooking(data: {
    serviceTypeId: string;
    requestedDateTime: string;
    address: string;
    city?: string;
    province?: string;
    description?: string;
  }) {
    return this.request<Booking>('/portal/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBookings(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<Booking[]>(`/portal/bookings${params}`);
  }

  async cancelBooking(id: string, reason: string) {
    return this.request(`/portal/bookings/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOBS
  // ═══════════════════════════════════════════════════════════════════════════

  async getJobs(params?: { status?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString() ? `?${searchParams}` : '';
    return this.request<Job[]>(`/portal/jobs${query}`);
  }

  async getJob(id: string) {
    return this.request<Job>(`/portal/jobs/${id}`);
  }

  async getUpcomingJobs() {
    return this.request<Job[]>('/portal/jobs/upcoming');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════════

  async getInvoices(params?: { status?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString() ? `?${searchParams}` : '';
    return this.request<Invoice[]>(`/portal/invoices${query}`);
  }

  async getInvoice(id: string) {
    return this.request<Invoice>(`/portal/invoices/${id}`);
  }

  async getInvoicePdf(id: string) {
    return this.request<{ pdfUrl: string }>(`/portal/invoices/${id}/pdf`);
  }

  async getUnpaidInvoices() {
    return this.request<Invoice[]>('/portal/invoices/unpaid');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async initiatePayment(invoiceId: string, method: string, returnUrl?: string) {
    return this.request<{
      paymentId: string;
      redirectUrl?: string;
      expiresAt?: string;
    }>('/portal/payments', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, method, returnUrl }),
    });
  }

  async getPaymentStatus(id: string) {
    return this.request<{ status: string; amount: number }>(`/portal/payments/${id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════

  async createTicket(data: {
    subject: string;
    category: string;
    message: string;
    relatedJobId?: string;
    relatedInvoiceId?: string;
  }) {
    return this.request<SupportTicket>('/portal/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTickets(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<SupportTicket[]>(`/portal/tickets${params}`);
  }

  async getTicket(id: string) {
    return this.request<SupportTicket>(`/portal/tickets/${id}`);
  }

  async addTicketMessage(ticketId: string, content: string) {
    return this.request<TicketMessage>(`/portal/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════

  async submitFeedback(data: {
    jobId: string;
    rating: number;
    comment?: string;
    serviceQuality?: number;
    punctuality?: number;
    professionalism?: number;
    wouldRecommend?: boolean;
  }) {
    return this.request('/portal/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPendingFeedback() {
    return this.request<Job[]>('/portal/feedback/pending');
  }
}

// Export singleton instance
export const customerApi = new CustomerApiClient();
