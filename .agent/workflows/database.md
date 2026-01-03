---
description: Prisma database commands for migrations, schema changes, and database operations
---

# 🗄️ Database Workflow (Prisma)

## Schema Location
```
apps/web/prisma/schema.prisma
```

## Common Commands

### Generate Prisma Client
Run after ANY schema.prisma change:
// turbo
```powershell
cd apps/web
pnpm prisma generate
```

### Create a Migration
After modifying schema.prisma:
// turbo
```powershell
cd apps/web
pnpm prisma migrate dev --name describe_the_change
```

Example names:
- `add_vehicle_documents_table`
- `add_status_column_to_jobs`
- `remove_legacy_customer_fields`

### Apply Migrations (Production)
```powershell
cd apps/web
pnpm prisma migrate deploy
```

### Reset Database (Development Only)
⚠️ **DESTRUCTIVE** - Drops all data!
```powershell
cd apps/web
pnpm prisma migrate reset
```

### View Database in Browser
```powershell
cd apps/web
pnpm prisma studio
```

### Push Schema Without Migration
For prototyping only (not recommended for production):
```powershell
cd apps/web
pnpm prisma db push
```

## Schema Change Workflow

### 1. Before Making Changes
```
1. Check current schema in apps/web/prisma/schema.prisma
2. Review existing migrations in apps/web/prisma/migrations/
3. Understand relationships and constraints
```

### 2. Make Schema Changes
```prisma
// Example: Adding a new field
model Job {
  // existing fields...
  newField String? // Mark optional with ? for existing tables
}
```

### 3. After Schema Changes
// turbo-all
```powershell
cd apps/web

# Generate Prisma client
pnpm prisma generate

# Create migration
pnpm prisma migrate dev --name your_change_name

# Verify types
pnpm type-check
```

## Common Schema Patterns

### Adding a New Table
```prisma
model NewTable {
  id        String   @id @default(cuid())
  orgId     String   @map("org_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  org Organization @relation(fields: [orgId], references: [id])
  
  @@map("new_tables")
}
```

### Adding a Relation
```prisma
// In parent model
children Child[]

// In child model
parentId String @map("parent_id")
parent   Parent @relation(fields: [parentId], references: [id])
```

### Adding an Enum
```prisma
enum Status {
  PENDING
  ACTIVE
  COMPLETED
}

model Job {
  status Status @default(PENDING)
}
```

## Troubleshooting

### "Migration failed to apply cleanly"
```powershell
# Check migration status
pnpm prisma migrate status

# If in dev, reset might be needed
pnpm prisma migrate reset
```

### "Prisma Client is outdated"
```powershell
pnpm prisma generate
```

### "Cannot find type 'PrismaClient'"
```powershell
# Regenerate client
pnpm prisma generate

# If still failing, check imports
import { prisma } from '@/lib/prisma'
```

## Database Connection

### Environment Variables
```powershell
# Development (Supabase)
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# With connection pooling
DATABASE_URL="postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true"
```

### Testing Connection
```powershell
cd apps/web
pnpm prisma db pull  # Should succeed if connected
```
