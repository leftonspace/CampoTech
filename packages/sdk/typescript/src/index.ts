/**
 * CampoTech TypeScript SDK
 * =========================
 *
 * Official TypeScript/JavaScript SDK for the CampoTech API.
 *
 * @example
 * ```typescript
 * import { CampoTech } from '@campotech/sdk';
 *
 * const client = new CampoTech({ apiKey: 'ct_live_...' });
 *
 * // List customers
 * const customers = await client.customers.list({ limit: 10 });
 *
 * // Create a job
 * const job = await client.jobs.create({
 *   customer_id: 'cust_...',
 *   title: 'AC Repair',
 *   service_type: 'repair',
 * });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CampoTechConfig {
  apiKey?: string;
  accessToken?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  onRequest?: (request: RequestInit) => RequestInit;
  onResponse?: (response: Response) => Response;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    has_more: boolean;
    next_cursor?: string;
    limit: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface ListParams {
  cursor?: string;
  limit?: number;
}

// Resource types
export interface Customer {
  id: string;
  org_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  status: 'active' | 'inactive';
  tags: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  org_id: string;
  customer_id: string;
  title: string;
  description?: string;
  service_type: string;
  status: 'pending' | 'scheduled' | 'assigned' | 'en_route' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_start?: string;
  scheduled_end?: string;
  address?: Address;
  assigned_technician_id?: string;
  line_items?: LineItem[];
  total: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  customer_id: string;
  invoice_number: string;
  status: 'draft' | 'pending' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  line_items: LineItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  org_id: string;
  customer_id: string;
  invoice_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  payment_method: string;
  payment_date: string;
  created_at: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  last_delivery_at?: string;
  last_delivery_status?: 'delivered' | 'failed';
  created_at: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  discount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

class HttpClient {
  private config: Required<CampoTechConfig>;

  constructor(config: CampoTechConfig) {
    this.config = {
      apiKey: config.apiKey || '',
      accessToken: config.accessToken || '',
      baseUrl: config.baseUrl || 'https://api.campotech.com/v1',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      onRequest: config.onRequest || ((r) => r),
      onResponse: config.onResponse || ((r) => r),
    };
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: any;
      query?: Record<string, any>;
    }
  ): Promise<T> {
    let url = `${this.config.baseUrl}${path}`;

    if (options?.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.append(key, String(value));
          }
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CampoTech-SDK-TypeScript/1.0.0',
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }

    let requestInit: RequestInit = {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    };

    requestInit = this.config.onRequest(requestInit);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        let response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        response = this.config.onResponse(response);

        const data = await response.json();

        if (!response.ok) {
          const error = data as ApiError;
          throw new CampoTechError(
            error.error?.message || 'Request failed',
            error.error?.code || 'UNKNOWN_ERROR',
            response.status,
            error.error?.details
          );
        }

        return data as T;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error instanceof CampoTechError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Retry on network errors and 5xx
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get<T>(path: string, query?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body?: any, query?: Record<string, any>): Promise<T> {
    return this.request<T>('POST', path, { body, query });
  }

  patch<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  put<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class CampoTechError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CampoTechError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

class CustomersResource {
  constructor(private http: HttpClient) {}

  async list(params?: ListParams & {
    search?: string;
    status?: 'active' | 'inactive';
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Customer>> {
    return this.http.get('/customers', params);
  }

  async get(id: string): Promise<ApiResponse<Customer>> {
    return this.http.get(`/customers/${id}`);
  }

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    address?: Address;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<Customer>> {
    return this.http.post('/customers', data);
  }

  async update(id: string, data: Partial<{
    name: string;
    email: string;
    phone: string;
    address: Address;
    status: 'active' | 'inactive';
    tags: string[];
    metadata: Record<string, any>;
  }>): Promise<ApiResponse<Customer>> {
    return this.http.patch(`/customers/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
    return this.http.delete(`/customers/${id}`);
  }
}

class JobsResource {
  constructor(private http: HttpClient) {}

  async list(params?: ListParams & {
    customer_id?: string;
    technician_id?: string;
    status?: string | string[];
    priority?: string | string[];
    scheduled_after?: string;
    scheduled_before?: string;
  }): Promise<PaginatedResponse<Job>> {
    return this.http.get('/jobs', params);
  }

  async get(id: string, include?: string[]): Promise<ApiResponse<Job>> {
    return this.http.get(`/jobs/${id}`, { include });
  }

  async create(data: {
    customer_id: string;
    title: string;
    service_type: string;
    description?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    scheduled_start?: string;
    scheduled_end?: string;
    address?: Address;
    assigned_technician_id?: string;
    line_items?: LineItem[];
  }): Promise<ApiResponse<Job>> {
    return this.http.post('/jobs', data);
  }

  async update(id: string, data: Partial<Job>): Promise<ApiResponse<Job>> {
    return this.http.patch(`/jobs/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
    return this.http.delete(`/jobs/${id}`);
  }

  async assign(id: string, technicianId: string): Promise<ApiResponse<Job>> {
    return this.http.post(`/jobs/${id}/assign`, { technician_id: technicianId });
  }

  async schedule(id: string, scheduledStart: string, scheduledEnd?: string): Promise<ApiResponse<Job>> {
    return this.http.post(`/jobs/${id}/schedule`, { scheduled_start: scheduledStart, scheduled_end: scheduledEnd });
  }

  async start(id: string): Promise<ApiResponse<Job>> {
    return this.http.post(`/jobs/${id}/start`);
  }

  async complete(id: string, data?: { completion_notes?: string; line_items?: LineItem[] }): Promise<ApiResponse<Job>> {
    return this.http.post(`/jobs/${id}/complete`, data);
  }

  async cancel(id: string, reason: string): Promise<ApiResponse<Job>> {
    return this.http.post(`/jobs/${id}/cancel`, { reason });
  }
}

class InvoicesResource {
  constructor(private http: HttpClient) {}

  async list(params?: ListParams & {
    customer_id?: string;
    status?: string | string[];
    due_after?: string;
    due_before?: string;
  }): Promise<PaginatedResponse<Invoice>> {
    return this.http.get('/invoices', params);
  }

  async get(id: string): Promise<ApiResponse<Invoice>> {
    return this.http.get(`/invoices/${id}`);
  }

  async create(data: {
    customer_id: string;
    job_id?: string;
    line_items: LineItem[];
    payment_terms?: string;
    due_date?: string;
    notes?: string;
  }): Promise<ApiResponse<Invoice>> {
    return this.http.post('/invoices', data);
  }

  async update(id: string, data: Partial<Invoice>): Promise<ApiResponse<Invoice>> {
    return this.http.patch(`/invoices/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
    return this.http.delete(`/invoices/${id}`);
  }

  async send(id: string, options?: { email?: string; message?: string }): Promise<ApiResponse<Invoice>> {
    return this.http.post(`/invoices/${id}/send`, options);
  }

  async recordPayment(id: string, data: {
    amount: number;
    payment_method: string;
    payment_date?: string;
    reference?: string;
  }): Promise<ApiResponse<Invoice>> {
    return this.http.post(`/invoices/${id}/payments`, data);
  }

  async void(id: string, reason: string): Promise<ApiResponse<Invoice>> {
    return this.http.post(`/invoices/${id}/void`, { reason });
  }
}

class PaymentsResource {
  constructor(private http: HttpClient) {}

  async list(params?: ListParams & {
    customer_id?: string;
    invoice_id?: string;
    status?: string;
    payment_method?: string;
  }): Promise<PaginatedResponse<Payment>> {
    return this.http.get('/payments', params);
  }

  async get(id: string): Promise<ApiResponse<Payment>> {
    return this.http.get(`/payments/${id}`);
  }

  async create(data: {
    customer_id: string;
    invoice_id?: string;
    amount: number;
    payment_method: string;
    reference?: string;
    notes?: string;
  }): Promise<ApiResponse<Payment>> {
    return this.http.post('/payments', data);
  }

  async refund(id: string, data: { amount?: number; reason: string }): Promise<ApiResponse<Payment>> {
    return this.http.post(`/payments/${id}/refund`, data);
  }
}

class WebhooksResource {
  constructor(private http: HttpClient) {}

  async list(params?: ListParams): Promise<PaginatedResponse<Webhook>> {
    return this.http.get('/webhooks', params);
  }

  async get(id: string): Promise<ApiResponse<Webhook>> {
    return this.http.get(`/webhooks/${id}`);
  }

  async create(data: {
    url: string;
    events: string[];
    description?: string;
  }): Promise<ApiResponse<Webhook>> {
    return this.http.post('/webhooks', data);
  }

  async update(id: string, data: Partial<{ url: string; events: string[]; enabled: boolean }>): Promise<ApiResponse<Webhook>> {
    return this.http.patch(`/webhooks/${id}`, data);
  }

  async delete(id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
    return this.http.delete(`/webhooks/${id}`);
  }

  async test(id: string, eventType: string): Promise<ApiResponse<any>> {
    return this.http.post(`/webhooks/${id}/test`, { event_type: eventType });
  }

  async rotateSecret(id: string): Promise<ApiResponse<{ secret: string }>> {
    return this.http.post(`/webhooks/${id}/rotate-secret`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class CampoTech {
  private http: HttpClient;

  public customers: CustomersResource;
  public jobs: JobsResource;
  public invoices: InvoicesResource;
  public payments: PaymentsResource;
  public webhooks: WebhooksResource;

  constructor(config: CampoTechConfig) {
    if (!config.apiKey && !config.accessToken) {
      throw new Error('CampoTech SDK requires either apiKey or accessToken');
    }

    this.http = new HttpClient(config);

    this.customers = new CustomersResource(this.http);
    this.jobs = new JobsResource(this.http);
    this.invoices = new InvoicesResource(this.http);
    this.payments = new PaymentsResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
  }
}

// Default export
export default CampoTech;
