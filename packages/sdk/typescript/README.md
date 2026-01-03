# @campotech/sdk

Official TypeScript/JavaScript SDK for the CampoTech API.

## Installation

```bash
pnpm add @campotech/sdk
# or
npm install @campotech/sdk
# or
yarn add @campotech/sdk
```

## Quick Start

```typescript
import { CampoTech } from '@campotech/sdk';

const client = new CampoTech({
  apiKey: 'ct_live_your_api_key_here',
});

// List customers
const customers = await client.customers.list({ limit: 10 });
console.log(customers.data);

// Create a job
const job = await client.jobs.create({
  customer_id: 'cust_abc123',
  title: 'AC Repair',
  service_type: 'repair',
  address: {
    street: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    state: 'CABA',
  },
});
console.log('Job created:', job.data.id);
```

## Configuration

```typescript
const client = new CampoTech({
  // Required: API Key or Access Token
  apiKey: 'ct_live_...',
  // OR
  accessToken: 'your_oauth_token',

  // Optional configuration
  baseUrl: 'https://api.campotech.com/v1', // Default
  timeout: 30000, // 30 seconds default
  maxRetries: 3, // Retry failed requests

  // Request/Response hooks
  onRequest: (request) => {
    console.log('Request:', request);
    return request;
  },
  onResponse: (response) => {
    console.log('Response:', response.status);
    return response;
  },
});
```

## Resources

### Customers

```typescript
// List customers with pagination
const customers = await client.customers.list({
  limit: 20,
  cursor: 'next_page_cursor',
  search: 'john',
  status: 'active',
});

// Get a customer
const customer = await client.customers.get('cust_abc123');

// Create a customer
const newCustomer = await client.customers.create({
  name: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '+54 11 1234-5678',
});

// Update a customer
await client.customers.update('cust_abc123', {
  phone: '+54 11 9999-8888',
});

// Delete a customer
await client.customers.delete('cust_abc123');
```

### Jobs

```typescript
// List jobs
const jobs = await client.jobs.list({
  status: ['scheduled', 'in_progress'],
  customer_id: 'cust_abc123',
});

// Create a job
const job = await client.jobs.create({
  customer_id: 'cust_abc123',
  title: 'Install AC Unit',
  service_type: 'installation',
  scheduled_start: '2025-01-15T10:00:00Z',
  line_items: [
    { description: 'AC Unit', quantity: 1, unit_price: 50000 },
    { description: 'Installation Labor', quantity: 2, unit_price: 5000 },
  ],
});

// Assign a technician
await client.jobs.assign('job_xyz789', 'tech_abc123');

// Start the job
await client.jobs.start('job_xyz789');

// Complete the job
await client.jobs.complete('job_xyz789', {
  completion_notes: 'Installation completed successfully',
});

// Cancel a job
await client.jobs.cancel('job_xyz789', 'Customer requested cancellation');
```

### Invoices

```typescript
// Create an invoice
const invoice = await client.invoices.create({
  customer_id: 'cust_abc123',
  job_id: 'job_xyz789',
  line_items: [
    { description: 'Service', quantity: 1, unit_price: 10000, tax_rate: 0.21 },
  ],
  due_date: '2025-02-01',
});

// Send invoice by email
await client.invoices.send('inv_abc123', {
  email: 'customer@example.com',
  message: 'Please find your invoice attached.',
});

// Record a payment
await client.invoices.recordPayment('inv_abc123', {
  amount: 10000,
  payment_method: 'credit_card',
});
```

### Payments

```typescript
// List payments
const payments = await client.payments.list({
  customer_id: 'cust_abc123',
  status: 'completed',
});

// Create a payment
const payment = await client.payments.create({
  customer_id: 'cust_abc123',
  invoice_id: 'inv_abc123',
  amount: 5000,
  payment_method: 'bank_transfer',
});

// Refund a payment
await client.payments.refund('pay_abc123', {
  amount: 2500,
  reason: 'Partial service refund',
});
```

### Webhooks

```typescript
// Create a webhook
const webhook = await client.webhooks.create({
  url: 'https://your-app.com/webhooks/campotech',
  events: ['job.created', 'job.completed', 'invoice.paid'],
});

// Test a webhook
await client.webhooks.test('wh_abc123', 'job.created');

// Rotate webhook secret
const { secret } = await client.webhooks.rotateSecret('wh_abc123');
```

## Error Handling

```typescript
import { CampoTech, CampoTechError } from '@campotech/sdk';

try {
  const customer = await client.customers.get('invalid_id');
} catch (error) {
  if (error instanceof CampoTechError) {
    console.error('API Error:', error.message);
    console.error('Error Code:', error.code);
    console.error('Status:', error.statusCode);
    console.error('Details:', error.details);
  }
}
```

## TypeScript Support

This SDK is written in TypeScript and includes full type definitions:

```typescript
import type {
  Customer,
  Job,
  Invoice,
  Payment,
  Webhook,
  Address,
  LineItem,
} from '@campotech/sdk';
```

## OAuth 2.0 Authentication

For user-authorized access, use OAuth tokens:

```typescript
const client = new CampoTech({
  accessToken: 'oauth_access_token_here',
});
```

## Support

- Documentation: https://developers.campotech.com
- API Reference: https://developers.campotech.com/reference
- Support: api@campotech.com

## License

MIT
