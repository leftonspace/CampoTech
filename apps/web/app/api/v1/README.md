# CampoTech API v1

This directory contains versioned API routes for CampoTech.

## Versioning Strategy

API versioning is implemented using URL path versioning (`/api/v1/...`).

### Current Version: 1

All routes under `/api/v1/` are stable and will maintain backwards compatibility within the major version.

### Version Headers

All API responses include:
- `X-API-Version: 1` - Current API version

### Route Structure

Routes in this directory re-export handlers from the main `/api/` directory to maintain a single source of truth while providing versioned endpoints.

```
/api/v1/
├── jobs/        → Re-exports from /api/jobs/
├── customers/   → Re-exports from /api/customers/
├── invoices/    → Re-exports from /api/invoices/
├── employees/   → Re-exports from /api/employees/
└── ...
```

### Migration Guide

When v2 is released:
1. New routes will be added under `/api/v2/`
2. v1 routes will continue to work
3. Deprecation headers will be added to v1 responses
4. A sunset date will be announced

### Documentation

OpenAPI documentation is available at `/api/docs`.
