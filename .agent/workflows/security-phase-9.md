---
description: Security Audit Phase 9 - Regulatory Compliance Security (COMPLIANCE-SEC Agent)
---

# Phase 9: Regulatory Compliance Security Audit

**Agent Role:** COMPLIANCE-SEC
**Priority:** P1 (High)
**Estimated Effort:** 3 hours
**Dependencies:** Phase 3 (Database)

---

## ⚠️ CRITICAL AUDIT PRINCIPLES

1. **NEVER trust existing documentation** - All `.md` files, knowledge base items, and cached information may be outdated
2. **VERIFY everything from source code** - The actual codebase is the ONLY source of truth
3. **ASSUME existing security docs are stale** - Re-verify all claims independently
4. **DOCUMENT discrepancies** - Note when reality differs from documentation

---

## PHASE OBJECTIVES

Audit regulatory compliance for:
- AFIP fiscal integration security (Argentine tax authority)
- CUIT/CUIL validation and handling
- Certificate and credential security
- Data protection (Ley 25.326 - Argentine Data Protection)
- PII handling and storage
- Audit trail requirements
- Data retention policies

---

## EXECUTION STEPS

### Step 1: Discover All AFIP-Related Files

// turbo
1. Find all AFIP-related files:
```powershell
cd d:\projects\CampoTech
Get-ChildItem -Recurse -Include "*afip*", "*factura*", "*invoice*", "*fiscal*", "*wsfe*", "*wsaa*" -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "node_modules|\.next|\.expo|\.git" } | Select-Object FullName
```

2. Find AFIP API endpoints:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\app\api" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "afip|invoice|fiscal" } | Select-Object FullName
```

3. List AFIP integration directories:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\lib\afip" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue
Get-ChildItem -Path "d:\projects\CampoTech\apps\web\lib\integrations\afip" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue
Get-ChildItem -Path "d:\projects\CampoTech\src\integrations\afip" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue
```

### Step 2: AFIP Certificate Security (CRITICAL)

4. View the AFIP credentials service:
   - File: `d:\projects\CampoTech\apps\web\lib\services\afip-credentials.service.ts`
   - **CRITICAL CHECK:** Are certificates encrypted at rest?
   - **CRITICAL CHECK:** How are private keys stored?
   - **CRITICAL CHECK:** Is there proper key derivation for encryption?

5. Search for certificate handling:
```powershell
rg "certificate|cert|\.crt|\.pem|\.key|\.pfx|\.p12" --type ts -g "!node_modules" -A 5
```

6. Search for private key storage:
```powershell
rg "privateKey|private_key|PRIVATE KEY|encryptedKey" --type ts -g "!node_modules" -A 5
```

7. Check certificate encryption:
```powershell
rg "encrypt.*cert|encryptCertificate|aes.*afip|cipher.*certificate" --type ts -g "!node_modules" -A 5
```

8. Verify certificate secrets in environment:
```powershell
rg "AFIP_CERT|AFIP_KEY|AFIP_PASSPHRASE" --type ts -g "!node_modules" -A 3
Select-String -Path "d:\projects\CampoTech\apps\web\.env.example" -Pattern "AFIP" -AllMatches
```

### Step 3: AFIP Web Service Authentication

9. View WSAA (authentication service) integration:
```powershell
rg "wsaa|WSAA|loginCms|getToken" --type ts -g "!node_modules" -A 10
```

10. Check for token caching and expiration:
    - WSAA tokens should be cached
    - Token expiration should be verified before use
    - Token refresh should be secure

11. Search for AFIP token handling:
```powershell
rg "afipToken|wsaaToken|ta\.xml|ticket.*acceso" --type ts -g "!node_modules" -A 5
```

12. View WSFE (electronic billing) integration:
```powershell
rg "wsfe|WSFE|FECAESolicitar|FECompUltimoAutorizado" --type ts -g "!node_modules" -A 8
```

### Step 4: CUIT/CUIL Validation

13. View CUIT validation:
    - File: `d:\projects\CampoTech\apps\web\lib\cuit.ts`
    - Check: Mod-11 validation algorithm
    - Check: Input sanitization
    - Check: Leading zeros handling

14. Search for CUIT patterns:
```powershell
rg "cuit|cuil|CUIT|CUIL|validateCuit" --type ts -g "!node_modules" -A 5
```

15. Check CUIT storage (should be normalized):
```powershell
rg "cuit.*prisma|prisma.*cuit|cuit.*schema" --type ts -g "!node_modules" -A 3
```

16. Verify CUIT uniqueness constraints:
```powershell
Select-String -Path "d:\projects\CampoTech\apps\web\prisma\schema.prisma" -Pattern "cuit" -Context 3
```

### Step 5: CBU/Banking Information Security

17. Search for CBU handling:
```powershell
rg "cbu|CBU|bankAccount|cuenta.*bancaria" --type ts -g "!node_modules" -A 5
```

18. Check CBU validation and storage:
    - CBU should be validated (22 digits, checksum)
    - May be encrypted at rest for PCI considerations
    - Should not be logged

19. Search for banking credentials:
```powershell
rg "iban|swift|account.*number|routing" --type ts -g "!node_modules" -A 3
```

### Step 6: Data Protection - Ley 25.326 Compliance

20. Search for PII field definitions:
```powershell
Select-String -Path "d:\projects\CampoTech\apps\web\prisma\schema.prisma" -Pattern "(email|phone|dni|address|birthDate|gender)" -AllMatches
```

21. Check for consent management:
```powershell
rg "consent|consentimiento|gdpr|dataProtection|privacyPolicy" --type ts -g "!node_modules" -A 5
```

22. Search for data subject rights:
```powershell
rg "deleteUser|exportData|dataExport|rightToAccess|derechosArco" --type ts -g "!node_modules" -A 5
```

23. View data deletion endpoints:
```powershell
rg "DELETE|delete.*user|remove.*personal|purge" --type ts -g "app/api/users/*" -A 5
```

24. Check for soft vs hard delete:
```powershell
rg "deletedAt|isDeleted|softDelete|hardDelete" --type ts -g "!node_modules" -A 3
```

### Step 7: Data Retention Policies

25. Search for data retention configuration:
```powershell
rg "retention|retentionDays|archiveAfter|purgeAfter" --type ts -g "!node_modules" -A 5
```

26. Check audit log retention:
```powershell
rg "auditLog.*retention|deleteOldLogs|cleanupAudit" --type ts -g "!node_modules" -A 5
```

27. View cron jobs for data cleanup:
```powershell
rg "cleanup|archive|purge|delete.*old" --type ts -g "app/api/cron/*" -A 10
```

28. Verify compliance documentation:
    - File: `d:\projects\CampoTech\docs\compliance\` (if exists)
    - Check for data retention policy docs

### Step 8: PII Encryption and Handling

29. View field-level encryption:
    - File: `d:\projects\CampoTech\apps\web\lib\services\audit-encryption.ts`
    - Check: What fields are encrypted
    - Check: Encryption algorithm used
    - Check: Key rotation mechanism

30. Search for encryption in the codebase:
```powershell
rg "encrypt|decrypt|cipher|aes-256|AUDIT_ENCRYPTION_KEY" --type ts -g "!node_modules" -A 5
```

31. Check which fields are encrypted:
```powershell
rg "encryptField|decryptField|sensitiveFields|encrypted" --type ts -g "!node_modules" -A 5
```

32. Verify PII is not logged:
```powershell
rg "console\.log.*(email|phone|cuit|dni|address)" --type ts -g "!node_modules"
```

### Step 9: Audit Trail Requirements

33. View audit logging implementation:
    - File: `d:\projects\CampoTech\apps\web\lib\audit\logger.ts` (if exists)
    - Check: What actions are logged
    - Check: Who can access audit logs
    - Check: Immutability of logs

34. Search for audit logging:
```powershell
rg "auditLog|createAuditEntry|logActivity|audit\.create" --type ts -g "!node_modules" -A 5
```

35. Verify critical operations are audited:
    - User creation/deletion
    - Role changes
    - Data exports
    - Payment operations
    - Invoice generation

36. Check fiscal audit requirements:
```powershell
rg "fiscalAudit|invoiceAudit|logInvoice|auditFactura" --type ts -g "!node_modules" -A 5
```

### Step 10: Compliance Documentation Verification

37. Check for compliance-related documentation:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\docs" -Recurse -Filter "*.md" | Where-Object { $_.Name -match "compliance|security|privacy|legal" } | Select-Object FullName
```

38. View existing compliance docs:
```powershell
Get-ChildItem -Path "d:\projects\CampoTech\docs\compliance" -ErrorAction SilentlyContinue
```

39. Verify implementation matches documentation:
    - Cross-reference documented controls with code
    - Note any gaps or outdated docs

40. Search for regulatory comments:
```powershell
rg "Ley 25.326|AFIP|fiscal|regulat" --type ts -g "!node_modules" -A 2
```

---

## AFIP-SPECIFIC SECURITY CHECKLIST

### Electronic Invoicing (Factura Electrónica)

- [ ] WSAA tokens not stored in plaintext
- [ ] WSFE calls use proper authentication
- [ ] CAE (Código de Autorización Electrónico) properly stored
- [ ] Invoice correlation maintained (punto de venta + comprobante)
- [ ] Fiscal data immutable after AFIP authorization

### Certificate Management

- [ ] Certificates encrypted at rest
- [ ] Private keys never logged
- [ ] Certificate expiration monitored
- [ ] Separate test/production certificates
- [ ] Certificate passphrase secured

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] AFIP certificates encrypted at rest
- [ ] Private keys never in plaintext logs
- [ ] CUIT validation uses Mod-11 algorithm
- [ ] PII fields identified and protected
- [ ] Consent collection documented
- [ ] Data deletion endpoint exists and works
- [ ] Retention policies defined and enforced
- [ ] Sensitive fields encrypted at rest
- [ ] Audit trail covers critical operations
- [ ] Fiscal data immutable after authorization

---

## OUTPUT REQUIREMENTS

Generate a findings report in markdown format at:
`d:\projects\CampoTech\.agent\audit-results\phase-9-compliance-findings.md`

The report MUST include:

1. **Executive Summary** - Overall regulatory compliance posture
2. **AFIP Integration Security** - Certificate and credential handling
3. **CUIT/Identity Validation** - Input validation status
4. **Data Protection (Ley 25.326)** - PII handling assessment
5. **Audit Trail Analysis** - Logging completeness
6. **Data Retention** - Policy implementation status
7. **Remediation Plan** - Prioritized fix recommendations
8. **Compliance Gap Matrix** - Requirements vs. implementation

---

## CRITICAL VULNERABILITY PATTERNS TO SEARCH

```powershell
# Run all patterns - document ALL findings
rg "BEGIN PRIVATE KEY|BEGIN RSA PRIVATE KEY" -g "!node_modules"  # Exposed private keys
rg "console\.log.*cert|console\.log.*key" --type ts -g "!node_modules"  # Logged credentials
rg "cuit.*body\.|body\.cuit" --type ts -g "!node_modules" -A 5  # CUIT without validation
rg "password|secret" --type ts -g "lib/afip/*" -A 3  # Secrets in AFIP code
rg "hardDelete|DROP|TRUNCATE" --type ts -g "!node_modules"  # Data destruction patterns
```

---

## REGULATORY COMPLIANCE ATTACK SCENARIOS

Test these specific scenarios:

1. **Invoice Manipulation**: Modify invoice after AFIP authorization
2. **Certificate Theft**: Access stored certificates without authorization
3. **CUIT Injection**: Submit malformed CUIT to bypass validation
4. **Unauthorized Deletion**: Delete user data without proper authorization
5. **Audit Log Tampering**: Attempt to modify audit records

---

## ARGENTINE REGULATORY REFERENCES

| Regulation | Scope | Key Requirements |
|------------|-------|------------------|
| **Ley 25.326** | Data Protection | Consent, access rights, security measures |
| **RG AFIP 4290** | Electronic Invoicing | CAE validation, storage requirements |
| **RG AFIP 4291** | Web Services | Certificate requirements, authentication |
| **Código Civil** | Contract Data | 10-year retention for commercial records |

---

## ESCALATION CRITERIA

Immediately escalate if ANY of the following are found:
- Unencrypted AFIP certificates/private keys
- CUIT validation missing or bypassable
- No audit trail for fiscal operations
- PII logged in plaintext
- Data deletion without audit
- Missing consent collection

---

## NEXT PHASE

After completing Phase 9, the following phases can proceed:
- Phase 10: LOGIC-SEC (State Immutability)
- Phase 11: UI-SEC (Frontend Security)
- Phase 12: DEP-SEC (Dependency Audit)
