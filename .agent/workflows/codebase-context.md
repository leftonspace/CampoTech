---
description: How to use architecture documentation as codebase reference
---

# 📖 Codebase Context & Architecture Reference

## Primary Reference Document

**File:** `architecture/campotech-architecture-complete.md`

This document provides comprehensive information about:
- System architecture and design patterns
- Database schema and relationships
- API endpoints and their status
- State machines and workflows
- Integration details (AFIP, MercadoPago, WhatsApp)
- Mobile app architecture
- Security and authentication

## ⚠️ Important Caveats

### 1. Not 100% Accurate
The documentation may not perfectly reflect the current codebase:
- Some implementations may differ from documentation
- New code may not yet be documented

### 2. Verification Required
When making changes based on the architecture doc:
```
1. Read the relevant section in the architecture doc
2. Verify the actual implementation matches
3. If discrepancy found → trust the CODE, report the difference
4. Update documentation if needed
```

### 3. Current Project Status
The codebase is in a **cleanup phase**:
- Focus is on fixing lint errors, type errors, and tests
- Do NOT start new feature work unless asked
- Prioritize stability over new functionality

## Implementation Plan (Future Work)

**File:** `architecture/implementation-plan.md`

This document defines work to be done AFTER cleanup:
- Read for context on project direction
- Do NOT execute implementation plan tasks without explicit request
- Current priority is codebase cleanup

## How to Use References

### Before Modifying Code
```
1. Identify the module/feature area
2. Read the relevant architecture doc section
3. Check implementation status markers (✅, ⏳, 🔧)
4. Verify against actual code
5. Note any discrepancies
```

### When Discrepancies Found
Report to user with format:
```
📝 **Documentation Discrepancy Found**
- **Doc says:** [what the architecture doc states]
- **Code shows:** [what the actual implementation is]
- **Location:** [file path and section]
- **Recommendation:** [update doc / fix code / clarify]
```

## Quick Reference: Key Files

| Purpose | Location |
|---------|----------|
| Architecture overview | `architecture/campotech-architecture-complete.md` |
| Implementation plan | `architecture/implementation-plan.md` |
| Database schema | `apps/web/prisma/schema.prisma` |
| API routes | `apps/web/app/api/` |
| Shared types | `apps/web/types/` |
| Services | `apps/web/lib/services/` |
| Components | `apps/web/components/` |

## Architecture Doc Sections

Key sections to reference:
- **Section 5:** Database Schema
- **Section 6:** State Machines
- **Section 7:** API Architecture
- **Section 8:** Authentication
- **Section 9:** External Integrations
- **Section 10:** Mobile Architecture