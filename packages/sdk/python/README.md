# CampoTech Python SDK

Official Python SDK for the CampoTech API.

## Installation

```bash
pip install campotech
```

## Quick Start

```python
from campotech import CampoTech

client = CampoTech(api_key='ct_live_your_api_key_here')

# List customers
customers = client.customers.list(limit=10)
for customer in customers.data:
    print(f"Customer: {customer.name}")

# Create a job
job = client.jobs.create(
    customer_id='cust_abc123',
    title='AC Repair',
    service_type='repair',
    address={
        'street': 'Av. Corrientes 1234',
        'city': 'Buenos Aires',
        'state': 'CABA',
    }
)
print(f"Job created: {job.data.id}")
```

## Configuration

```python
from campotech import CampoTech

client = CampoTech(
    # Required: API Key or Access Token
    api_key='ct_live_...',
    # OR
    access_token='your_oauth_token',

    # Optional configuration
    base_url='https://api.campotech.com/v1',  # Default
    timeout=30,  # 30 seconds default
    max_retries=3,  # Retry failed requests
)
```

## Resources

### Customers

```python
# List customers with pagination
customers = client.customers.list(
    limit=20,
    cursor='next_page_cursor',
    search='john',
    status='active'
)

# Get a customer
customer = client.customers.get('cust_abc123')

# Create a customer
new_customer = client.customers.create(
    name='Juan Pérez',
    email='juan@example.com',
    phone='+54 11 1234-5678'
)

# Update a customer
client.customers.update('cust_abc123', phone='+54 11 9999-8888')

# Delete a customer
client.customers.delete('cust_abc123')
```

### Jobs

```python
# List jobs
jobs = client.jobs.list(
    status=['scheduled', 'in_progress'],
    customer_id='cust_abc123'
)

# Create a job
job = client.jobs.create(
    customer_id='cust_abc123',
    title='Install AC Unit',
    service_type='installation',
    scheduled_start='2025-01-15T10:00:00Z',
    line_items=[
        {'description': 'AC Unit', 'quantity': 1, 'unit_price': 50000},
        {'description': 'Installation Labor', 'quantity': 2, 'unit_price': 5000},
    ]
)

# Assign a technician
client.jobs.assign('job_xyz789', technician_id='tech_abc123')

# Start the job
client.jobs.start('job_xyz789')

# Complete the job
client.jobs.complete('job_xyz789', completion_notes='Installation completed successfully')

# Cancel a job
client.jobs.cancel('job_xyz789', reason='Customer requested cancellation')
```

### Invoices

```python
# Create an invoice
invoice = client.invoices.create(
    customer_id='cust_abc123',
    job_id='job_xyz789',
    line_items=[
        {'description': 'Service', 'quantity': 1, 'unit_price': 10000, 'tax_rate': 0.21}
    ],
    due_date='2025-02-01'
)

# Send invoice by email
client.invoices.send(
    'inv_abc123',
    email='customer@example.com',
    message='Please find your invoice attached.'
)

# Record a payment
client.invoices.record_payment(
    'inv_abc123',
    amount=10000,
    payment_method='credit_card'
)
```

### Payments

```python
# List payments
payments = client.payments.list(
    customer_id='cust_abc123',
    status='completed'
)

# Create a payment
payment = client.payments.create(
    customer_id='cust_abc123',
    invoice_id='inv_abc123',
    amount=5000,
    payment_method='bank_transfer'
)

# Refund a payment
client.payments.refund(
    'pay_abc123',
    amount=2500,
    reason='Partial service refund'
)
```

### Webhooks

```python
# Create a webhook
webhook = client.webhooks.create(
    url='https://your-app.com/webhooks/campotech',
    events=['job.created', 'job.completed', 'invoice.paid']
)

# Test a webhook
client.webhooks.test('wh_abc123', event_type='job.created')

# Rotate webhook secret
result = client.webhooks.rotate_secret('wh_abc123')
print(f"New secret: {result.data.secret}")
```

## Error Handling

```python
from campotech import CampoTech, CampoTechError, NotFoundError, ValidationError

try:
    customer = client.customers.get('invalid_id')
except NotFoundError as e:
    print(f"Customer not found: {e.message}")
except ValidationError as e:
    print(f"Invalid input: {e.message}")
    print(f"Details: {e.details}")
except CampoTechError as e:
    print(f"API Error: {e.message}")
    print(f"Code: {e.code}")
    print(f"Status: {e.status_code}")
```

## Async Support

For async applications, use the async client:

```python
from campotech import AsyncCampoTech
import asyncio

async def main():
    client = AsyncCampoTech(api_key='ct_live_...')

    customers = await client.customers.list(limit=10)
    for customer in customers.data:
        print(customer.name)

asyncio.run(main())
```

## OAuth 2.0 Authentication

For user-authorized access, use OAuth tokens:

```python
client = CampoTech(access_token='oauth_access_token_here')
```

## Type Hints

The SDK includes full type hints for all methods and responses:

```python
from campotech import CampoTech, Customer, Job, Invoice

client = CampoTech(api_key='...')

# IDE will provide autocomplete for customer attributes
customer: Customer = client.customers.get('cust_abc123').data
print(customer.name)
```

## Support

- Documentation: https://developers.campotech.com
- API Reference: https://developers.campotech.com/reference
- Support: api@campotech.com

## License

MIT
