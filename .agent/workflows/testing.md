---
description: Testing workflow - how to write and run tests in CampoTech
---

# 🧪 Testing Workflow

## Test Framework
- **Unit/Integration:** Jest + React Testing Library
- **E2E:** Playwright (when configured)
- **Location:** `apps/web/tests/`

## Running Tests

### Run All Tests
// turbo
```powershell
cd apps/web
pnpm test:run
```

### Run Tests in Watch Mode
```powershell
cd apps/web
pnpm test
```

### Run Specific Test File
```powershell
cd apps/web
pnpm test:run tests/unit/specific-file.test.ts
```

### Run Tests Matching Pattern
```powershell
cd apps/web
pnpm test:run --grep "customer"
```

## Test File Structure

```
apps/web/tests/
├── unit/           # Unit tests for individual functions/components
├── integration/    # Tests for API routes and services
├── e2e/            # End-to-end tests (Playwright)
└── fixtures/       # Test data and mocks
```

## Writing Tests

### Unit Test Template
```typescript
// tests/unit/example.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(() => functionUnderTest(null)).toThrow();
  });
});
```

### API Route Test Template
```typescript
// tests/integration/api/customers.test.ts
import { describe, it, expect } from '@jest/globals';

describe('GET /api/customers', () => {
  it('returns customers for authenticated user', async () => {
    const response = await fetch('/api/customers', {
      headers: { Authorization: 'Bearer test-token' }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.customers)).toBe(true);
  });

  it('returns 401 for unauthenticated request', async () => {
    const response = await fetch('/api/customers');
    expect(response.status).toBe(401);
  });
});
```

### Component Test Template
```typescript
// tests/unit/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Testing Patterns for CampoTech

### Testing CUIT Validation
```typescript
describe('CUIT Validation', () => {
  it('validates correct CUIT format', () => {
    expect(validateCuit('20-12345678-9')).toBe(true);
    expect(validateCuit('20123456789')).toBe(true);
  });

  it('rejects invalid CUIT', () => {
    expect(validateCuit('invalid')).toBe(false);
    expect(validateCuit('12-12345678-9')).toBe(false); // Invalid type
  });
});
```

### Testing Services with Mocks
```typescript
import { prismaMock } from '../mocks/prisma';

describe('CustomerService', () => {
  it('creates a customer', async () => {
    prismaMock.customer.create.mockResolvedValue({
      id: 'cust_123',
      name: 'Test Customer',
      // ... other fields
    });

    const result = await customerService.create({
      name: 'Test Customer',
      orgId: 'org_123',
    });

    expect(result.id).toBe('cust_123');
  });
});
```

## Test Data

### Using Fixtures
```typescript
// tests/fixtures/customers.ts
export const mockCustomer = {
  id: 'cust_test_123',
  name: 'Juan Pérez',
  cuit: '20-12345678-9',
  phone: '+54 11 1234-5678',
  orgId: 'org_test_123',
};

// In test file
import { mockCustomer } from '../fixtures/customers';
```

### Argentine-Specific Test Data
```typescript
export const testData = {
  validCuits: ['20-12345678-9', '27-12345678-4', '30-12345678-5'],
  validPhones: ['+54 11 1234-5678', '+54 9 11 1234-5678'],
  addresses: ['Av. Corrientes 1234, CABA', 'Calle Falsa 123, GBA'],
};
```

## Before Committing

// turbo-all
```powershell
cd apps/web

# Run all tests
pnpm test:run

# Check for test coverage issues
pnpm test:run --coverage
```

## Troubleshooting

### Tests Failing After Schema Change
```powershell
pnpm prisma generate  # Regenerate Prisma client
pnpm test:run
```

### Module Not Found in Tests
Check `jest.config.js` for path mappings:
```js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

### Async Tests Timing Out
```typescript
it('handles slow operation', async () => {
  jest.setTimeout(10000); // Increase timeout
  // ... test code
}, 10000);
```
