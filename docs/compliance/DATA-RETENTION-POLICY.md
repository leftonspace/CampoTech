# CampoTech Data Retention Policy

**Version:** 1.0
**Last Updated:** December 2024
**Purpose:** Define data lifecycle, archival schedules, and legal compliance requirements

---

## Overview

This document defines the retention, archival, and deletion policies for all CampoTech data. These policies ensure:

1. **Performance** - Main database stays fast by archiving old data
2. **Compliance** - Legal requirements (AFIP, Ley 25.326) are met
3. **Cost Efficiency** - Cold storage for rarely accessed data
4. **User Rights** - ARCO rights compliance for data access/deletion

---

## Data Classification

### Hot Data (Main Database - PostgreSQL)
Active data that's frequently accessed and needs real-time query performance.

### Cold Data (Archive Storage - Supabase Storage)
Historical data that's rarely accessed but must be retained for legal/business reasons.

### Deleted Data
Data that has exceeded its retention period and can be permanently removed.

---

## Retention Schedule

### Hot Data Retention (Main Database)

| Table | Retention Period | Reason | Archive Action |
|-------|------------------|--------|----------------|
| `jobs` | 2 years | Active reference, reporting | Archive to JSON |
| `customers` | Forever | CRM data, business relationship | Never archive |
| `invoices` | 10 years | **AFIP legal requirement** | Archive after 2 years |
| `whatsapp_messages` | 1 year | Conversation history | Archive to JSON |
| `technician_locations` | 90 days | Only recent locations needed | Aggregate stats, delete raw |
| `audit_logs` | 3 years | Security compliance | Archive after 1 year |
| `notification_logs` | 6 months | Debugging only | Delete (no archive) |
| `ratings` | Forever | Marketplace reputation value | Never archive |
| `organizations` | Forever | Business account data | Never archive |
| `users` | Forever (or until deletion request) | Account data | Anonymize on request |
| `vehicles` | Forever | Asset management | Never archive |
| `equipment` | Forever | Asset management | Never archive |

### Archive Storage Retention (Cold)

| Data Type | Cold Storage Retention | Final Action |
|-----------|------------------------|--------------|
| Archived jobs | 8 additional years (10 total) | Permanent delete |
| Archived invoices | 8 additional years (10 total) | Permanent delete |
| Archived WhatsApp | 4 additional years (5 total) | Permanent delete |
| Archived audit logs | 7 additional years (10 total) | Permanent delete |
| Location aggregates | 5 years | Permanent delete |

---

## Legal Requirements (Argentina)

### AFIP - Facturación Electrónica
- **Invoices:** Minimum 10 years retention
- **Supporting documents:** 10 years from last fiscal year
- **Electronic records:** Must maintain integrity and authenticity

### Ley 25.326 - Protección de Datos Personales
- **User consent:** Required for data collection
- **ARCO Rights:** Access, Rectification, Cancellation, Opposition
- **Data deletion:** Must be possible upon user request (with exceptions for legal requirements)
- **Data minimization:** Only collect necessary data

### Employment Records
- **Employee data:** 10 years after termination
- **Payroll records:** 10 years
- **Work schedules:** 2 years after creation

---

## Archive Storage Structure

Archives are stored in Supabase Storage with the following structure:

```
archives/
├── jobs/
│   ├── 2023/
│   │   ├── 01/
│   │   │   ├── org_xxx_2023-01-01.json.gz
│   │   │   └── org_yyy_2023-01-01.json.gz
│   │   └── 02/
│   │       └── ...
│   └── 2024/
│       └── ...
├── whatsapp_messages/
│   └── [same structure]
├── technician_locations/
│   └── aggregates/
│       └── org_xxx_2023-01.json.gz  # Monthly aggregates only
├── audit_logs/
│   └── [same structure]
├── invoices/
│   └── [same structure]  # Invoices kept 10 years
└── deletion_logs/
    └── 2024/
        └── deletion_manifest_2024-01.json
```

### Archive File Format

```json
{
  "archiveVersion": "1.0",
  "table": "jobs",
  "organizationId": "org_xxx",
  "archiveDate": "2024-01-15T03:00:00Z",
  "dateRange": {
    "from": "2022-01-01T00:00:00Z",
    "to": "2022-01-31T23:59:59Z"
  },
  "recordCount": 1234,
  "checksum": "sha256:abc123...",
  "records": [
    { ... }
  ]
}
```

---

## Archival Process

### Daily Archival Job (3:00 AM UTC-3)

1. **Identify candidates:** Find records past retention threshold
2. **Export by organization:** Group records by `organizationId`
3. **Compress and upload:** Gzip JSON, upload to cold storage
4. **Verify integrity:** Compare checksums after upload
5. **Delete from hot storage:** Remove archived records from main DB
6. **Log action:** Record in `archival_audit_log`

### Archive Verification

Before deletion, verify:
- [ ] Archive file exists in storage
- [ ] Checksum matches source data
- [ ] Record count matches expected
- [ ] At least 24 hours since archival (safety window)

### Technician Locations Special Handling

Due to high volume, raw location data is handled differently:

1. **Daily aggregation:** Calculate daily stats per technician
   - Total distance traveled
   - Time on-site per job
   - Coverage area (bounding box)
2. **Store aggregates:** Keep aggregated stats only
3. **Delete raw data:** Remove individual GPS pings after 90 days

---

## ARCO Rights Compliance

### Right of Access (Acceso)

Users can request their archived data via:
- **Endpoint:** `GET /api/v1/archives`
- **Response:** Signed URL valid for 1 hour
- **Scope:** Only their organization's data

### Right of Rectification (Rectificación)

- Historical data cannot be modified
- Current data can be updated normally
- Audit trail maintained for all changes

### Right of Cancellation (Cancelación)

- **Immediate deletion:** Notification logs, location raw data
- **Anonymization:** User data in archived records
- **Retained (legal):** Invoices, audit logs (with anonymization)

### Right of Opposition (Oposición)

- Users can opt out of non-essential data collection
- Marketing/analytics data can be deleted on request
- Core service data retained for legal compliance

---

## Data Deletion Process

### Standard Deletion (Expired Retention)

```
1. Identify records past retention + archive period
2. Verify no legal holds
3. Permanently delete from cold storage
4. Log deletion in manifest
5. Update archival_audit_log
```

### User-Requested Deletion (ARCO)

```
1. Receive deletion request
2. Verify identity
3. Check legal holds (invoices, audits)
4. Anonymize where required, delete where allowed
5. Provide deletion certificate
6. Complete within 10 business days
```

### Deletion Manifest

Monthly manifest of deleted data:

```json
{
  "manifestVersion": "1.0",
  "period": "2024-01",
  "deletions": [
    {
      "table": "notification_logs",
      "organizationId": "org_xxx",
      "recordCount": 15000,
      "dateRange": { "from": "...", "to": "..." },
      "deletedAt": "2024-02-01T03:00:00Z",
      "reason": "retention_expired"
    }
  ],
  "arcoRequests": [
    {
      "requestId": "arco_123",
      "userId": "user_xxx",
      "action": "cancellation",
      "tablesAffected": ["users", "audit_logs"],
      "completedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Monitoring and Alerts

### Archive Health Metrics

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Archive job failure | 1 consecutive | 3 consecutive |
| Archive backlog (days) | 3 days | 7 days |
| Storage growth rate | > 150% monthly | > 200% monthly |
| Checksum mismatches | Any | Any |

### Required Alerts

1. **Archival job failed** - Immediate notification
2. **Checksum mismatch** - Block deletion, investigate
3. **Storage quota approaching** - 7 days before limit
4. **ARCO request pending > 5 days** - Escalate

---

## Implementation Files

| Task | File |
|------|------|
| Archival job | `apps/web/lib/jobs/data-archiver.ts` |
| Cron endpoint | `apps/web/app/api/cron/archive-data/route.ts` |
| Archive retrieval | `apps/web/app/api/v1/archives/route.ts` |
| ARCO handler | `apps/web/app/api/v1/arco/route.ts` |
| Storage client | `apps/web/lib/storage/archive-storage.ts` |

---

## Review Schedule

- **Monthly:** Archive job success rates, storage growth
- **Quarterly:** Review retention periods, update for new tables
- **Annually:** Legal compliance review, policy update

---

## Appendix: Glossary

- **AFIP:** Administración Federal de Ingresos Públicos (Argentina tax authority)
- **ARCO:** Acceso, Rectificación, Cancelación, Oposición (data rights)
- **Hot data:** Actively queried data in main database
- **Cold data:** Archived data in object storage
- **Ley 25.326:** Argentine Personal Data Protection Law
