---
description: Debugging workflow - common issues and troubleshooting for CampoTech
---

# 🔧 Debugging Workflow

## Quick Diagnostics

### Check Overall Health
// turbo-all
```powershell
cd apps/web
pnpm type-check   # TypeScript errors
pnpm lint         # ESLint issues
pnpm build        # Build errors
```

## Common Issues & Solutions

### 1. TypeScript Errors

#### "Cannot find module '@/...'"
**Cause:** Path alias not resolving
**Fix:** Check `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### "Property 'X' does not exist on type 'Y'"
**Cause:** Missing type definition or Prisma client outdated
**Fix:**
```powershell
pnpm prisma generate  # If database-related
pnpm type-check       # See full error
```

#### "Type 'X' is not assignable to type 'Y'"
**Cause:** Type mismatch
**Debug:** Check the actual types being used:
```typescript
// Add explicit type to see what TypeScript infers
const x: ExpectedType = value; // Error will show actual type
```

### 2. Build Errors

#### "Module not found: Can't resolve '...'"
**Cause:** Missing dependency or wrong import path
**Fix:**
```powershell
# Check if package exists
pnpm list package-name

# If missing, install it
pnpm add package-name
```

#### "You're importing a component that needs useState..."
**Cause:** Using client hooks in Server Component
**Fix:** Add `'use client'` directive at top of file:
```typescript
'use client';

import { useState } from 'react';
```

#### "Hydration failed..."
**Cause:** Server/client HTML mismatch
**Common causes:**
- Using `Date.now()` without `useEffect`
- Browser extensions modifying DOM
- Conditional rendering based on client-only values

### 3. Prisma/Database Errors

#### "PrismaClient is unable to run in the browser"
**Cause:** Importing Prisma in client component
**Fix:** Only use Prisma in:
- Server Components
- API Routes
- Server Actions

#### "Record not found"
**Debug:**
```typescript
// Add logging to see what's happening
console.log('Looking for:', { id, orgId });
const result = await prisma.model.findUnique({ where: { id } });
console.log('Found:', result);
```

#### "Foreign key constraint failed"
**Cause:** Trying to delete/update with existing references
**Fix:** Delete child records first or use cascading:
```prisma
model Child {
  parent Parent @relation(fields: [parentId], references: [id], onDelete: Cascade)
}
```

### 4. API Route Errors

#### 500 Internal Server Error
**Debug:**
```typescript
// Add try-catch with detailed logging
export async function GET(request: Request) {
  try {
    // ... your code
  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

#### 401 Unauthorized
**Check:**
```typescript
// Verify session is being retrieved
const session = await getServerSession(authOptions);
console.log('Session:', session);
```

#### CORS Errors
**Fix:** Add headers to API route:
```typescript
return new Response(body, {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
});
```

### 5. Runtime Errors

#### "Cannot read property 'X' of undefined"
**Debug:**
```typescript
// Add defensive checks
const value = obj?.property ?? defaultValue;

// Or use optional chaining
const name = customer?.name;
```

#### "Maximum call stack size exceeded"
**Cause:** Infinite recursion or circular dependency
**Debug:**
```powershell
# Check for circular imports
pnpm madge --circular apps/web/
```

## Debugging Tools

### Add Console Logging
```typescript
console.log('DEBUG:', { variable, context });
console.table(arrayData); // For arrays
console.dir(object, { depth: null }); // Deep objects
```

### Use VS Code Debugger
1. Add `debugger;` statement in code
2. Run with: `NODE_OPTIONS='--inspect' pnpm dev`
3. Open Chrome DevTools and connect

### Check Network Requests
```typescript
// Log all fetch requests
const originalFetch = global.fetch;
global.fetch = async (...args) => {
  console.log('FETCH:', args[0]);
  return originalFetch(...args);
};
```

## Environment Issues

### Environment Variables Not Loading
**Check:**
```powershell
# Verify .env.local exists
Get-Item apps/web/.env.local

# Log env vars (don't commit this!)
# In your TypeScript code:
# console.log('DB URL:', process.env.DATABASE_URL?.substring(0, 20) + '...');
```

### Wrong Environment
```typescript
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Is Production:', process.env.NODE_ENV === 'production');
```

## Performance Debugging

### Slow API Routes
```typescript
const start = performance.now();
// ... your code
console.log(`Operation took ${performance.now() - start}ms`);
```

### Database Query Performance
```typescript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

## When to Escalate to User

Report to user when:
1. Error persists after trying obvious fixes
2. Error requires business decision (e.g., "should this field be nullable?")
3. Error indicates architectural issue
4. You need credentials or access to external services
5. Multiple valid solutions exist and you need direction
