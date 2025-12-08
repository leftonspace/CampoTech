SUPERSEDED by "campotech-architecture-complete.md"

# CampoTech: Argentina MVP Roadmap v7 - Part 2
## Security, Encryption & Abuse Prevention (Continued)

---

# SECTION 15: SECURITY & ENCRYPTION (Continued)

## Encryption Service Implementation

```typescript
// infrastructure/security/EncryptionService.ts

import crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyRotationDays = 365;

  /**
   * Encrypt sensitive data
   */
  async encrypt(data: string, context: EncryptionContext): Promise<EncryptedData> {
    // Get current key for context
    const key = await this.getKey(context.purpose);
    
    // Generate IV (unique per encryption)
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key.value, iv);
    
    // Encrypt
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get auth tag for GCM
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId: key.id,
      algorithm: this.algorithm,
      encryptedAt: new Date()
    };
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encrypted: EncryptedData): Promise<string> {
    // Get key by ID (supports old keys for rotation)
    const key = await this.getKeyById(encrypted.keyId);
    
    if (!key) {
      throw new Error('Encryption key not found');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(
      encrypted.algorithm,
      key.value,
      Buffer.from(encrypted.iv, 'base64')
    );
    
    // Set auth tag
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    
    // Decrypt
    let decrypted = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKey(purpose: KeyPurpose): Promise<void> {
    // Generate new key
    const newKey = {
      id: uuid(),
      purpose,
      value: crypto.randomBytes(32),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.keyRotationDays * 24 * 60 * 60 * 1000)
    };

    // Store new key (don't delete old ones yet)
    await this.keyStore.create(newKey);

    // Mark old key as deprecated
    const oldKey = await this.getKey(purpose);
    if (oldKey) {
      await this.keyStore.update(oldKey.id, { deprecated: true });
    }

    // Schedule re-encryption of data using old key
    await this.scheduleReEncryption(purpose, oldKey.id, newKey.id);

    // Audit log
    await this.auditLog.log({
      action: 'key_rotated',
      entity_type: 'encryption_key',
      entity_id: newKey.id,
      metadata: { purpose, oldKeyId: oldKey?.id }
    });
  }

  /**
   * Re-encrypt data with new key (background job)
   */
  private async scheduleReEncryption(
    purpose: KeyPurpose,
    oldKeyId: string,
    newKeyId: string
  ): Promise<void> {
    // Find all data encrypted with old key
    const tables = KEY_PURPOSE_TABLES[purpose];
    
    for (const table of tables) {
      await this.reEncryptionQueue.add({
        table,
        oldKeyId,
        newKeyId,
        batchSize: 100
      });
    }
  }
}

// Key purposes and their associated tables
const KEY_PURPOSE_TABLES: Record<KeyPurpose, string[]> = {
  afip_credentials: ['organizations.afip_cert', 'organizations.afip_key'],
  mp_tokens: ['organizations.mp_access_token', 'organizations.mp_refresh_token'],
  customer_pii: ['customers.doc_number', 'customers.phone'],
  general: ['invoices.line_items'] // Contains pricing info
};
```

## Secure Storage for AFIP Certificates

```typescript
// services/security/AfipCredentialService.ts

export class AfipCredentialService {
  private encryptionService: EncryptionService;

  /**
   * Store AFIP certificate securely
   */
  async storeCertificate(
    orgId: string,
    certificate: Buffer,
    privateKey: Buffer,
    passphrase: string
  ): Promise<void> {
    // Validate certificate
    const certInfo = await this.validateCertificate(certificate, privateKey, passphrase);
    
    // Encrypt certificate
    const encryptedCert = await this.encryptionService.encrypt(
      certificate.toString('base64'),
      { purpose: 'afip_credentials' }
    );

    // Encrypt private key (with passphrase if provided)
    const encryptedKey = await this.encryptionService.encrypt(
      privateKey.toString('base64'),
      { purpose: 'afip_credentials' }
    );

    // Store encrypted
    await this.orgRepo.update(orgId, {
      afip_cert: JSON.stringify(encryptedCert),
      afip_key: JSON.stringify(encryptedKey),
      afip_cert_expiry: certInfo.validTo,
      afip_cert_subject: certInfo.subject,
      afip_cert_updated_at: new Date()
    });

    // Audit
    await this.auditLog.log({
      action: 'afip_cert_stored',
      entity_type: 'organization',
      entity_id: orgId,
      metadata: {
        subject: certInfo.subject,
        validTo: certInfo.validTo,
        // Never log the actual certificate
      }
    });

    // Alert if expiring soon
    const daysToExpiry = Math.ceil(
      (certInfo.validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysToExpiry < 30) {
      await this.notificationService.send('afip.cert_expiring_soon', {
        orgId,
        daysRemaining: daysToExpiry
      });
    }
  }

  /**
   * Retrieve decrypted certificate for AFIP operations
   */
  async getCertificate(orgId: string): Promise<AfipCredentials> {
    const org = await this.orgRepo.findById(orgId);
    
    if (!org.afip_cert || !org.afip_key) {
      throw new Error('AFIP credentials not configured');
    }

    // Check expiry
    if (org.afip_cert_expiry && new Date(org.afip_cert_expiry) < new Date()) {
      throw new Error('AFIP certificate expired');
    }

    // Decrypt
    const certEncrypted = JSON.parse(org.afip_cert);
    const keyEncrypted = JSON.parse(org.afip_key);

    const certificate = Buffer.from(
      await this.encryptionService.decrypt(certEncrypted),
      'base64'
    );
    const privateKey = Buffer.from(
      await this.encryptionService.decrypt(keyEncrypted),
      'base64'
    );

    // Audit access
    await this.auditLog.log({
      action: 'afip_cert_accessed',
      entity_type: 'organization',
      entity_id: orgId
    });

    return { certificate, privateKey };
  }
}
```

## Log Redaction

```typescript
// infrastructure/logging/LogRedaction.ts

const SENSITIVE_PATTERNS: RedactionPattern[] = [
  // CUIT/CUIL
  { pattern: /\b\d{2}-\d{8}-\d{1}\b/g, replacement: 'CUIT:[REDACTED]' },
  // Phone numbers
  { pattern: /\b\d{10,11}\b/g, replacement: 'PHONE:[REDACTED]' },
  // Credit card numbers
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: 'CARD:[REDACTED]' },
  // CBU
  { pattern: /\b\d{22}\b/g, replacement: 'CBU:[REDACTED]' },
  // Email
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: 'EMAIL:[REDACTED]' },
  // API keys/tokens (common patterns)
  { pattern: /Bearer\s+[A-Za-z0-9\-_]+/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /api[_-]?key[=:]\s*["']?[A-Za-z0-9\-_]+["']?/gi, replacement: 'api_key:[REDACTED]' },
  // Passwords
  { pattern: /password[=:]\s*["']?[^"'\s]+["']?/gi, replacement: 'password:[REDACTED]' }
];

export class LogRedaction {
  /**
   * Redact sensitive data from log entry
   */
  redact(data: any): any {
    if (typeof data === 'string') {
      return this.redactString(data);
    }

    if (typeof data === 'object' && data !== null) {
      return this.redactObject(data);
    }

    return data;
  }

  private redactString(str: string): string {
    let result = str;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private redactObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Always redact these fields
      if (ALWAYS_REDACT_FIELDS.includes(key.toLowerCase())) {
        result[key] = '[REDACTED]';
        continue;
      }

      // Recursively process
      if (typeof value === 'object' && value !== null) {
        result[key] = Array.isArray(value)
          ? value.map(v => this.redact(v))
          : this.redactObject(value);
      } else if (typeof value === 'string') {
        result[key] = this.redactString(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

const ALWAYS_REDACT_FIELDS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'private_key',
  'certificate',
  'cuit',
  'cuil',
  'dni',
  'cbu',
  'card_number',
  'cvv',
  'ssn'
];
```

## Technician Location Data Protection

```typescript
// services/security/LocationPrivacyService.ts

export class LocationPrivacyService {
  /**
   * Store technician location with privacy controls
   */
  async updateLocation(
    technicianId: string,
    location: GeoLocation
  ): Promise<void> {
    // Only store during working hours for active jobs
    const hasActiveJob = await this.hasActiveJob(technicianId);
    if (!hasActiveJob) {
      // Don't track when not working
      return;
    }

    // Round coordinates (reduce precision when not en route)
    const roundedLocation = await this.applyPrecisionRules(
      technicianId,
      location
    );

    // Store with TTL (auto-delete after shift)
    await this.locationCache.set(
      `location:${technicianId}`,
      JSON.stringify(roundedLocation),
      'EX',
      8 * 60 * 60 // 8 hour TTL
    );

    // Don't persist to permanent storage unless actively on job
    const job = await this.getActiveEnRouteJob(technicianId);
    if (job) {
      // Update ETA only, don't store raw location
      await this.updateJobETA(job.id, roundedLocation);
    }
  }

  /**
   * Apply precision rules based on context
   */
  private async applyPrecisionRules(
    technicianId: string,
    location: GeoLocation
  ): Promise<GeoLocation> {
    const status = await this.getTechnicianStatus(technicianId);

    switch (status) {
      case 'en_camino':
        // High precision for ETA calculation
        return {
          lat: Math.round(location.lat * 10000) / 10000, // ~11m precision
          lng: Math.round(location.lng * 10000) / 10000
        };
      
      case 'working':
        // Medium precision (at customer location)
        return {
          lat: Math.round(location.lat * 1000) / 1000, // ~111m precision
          lng: Math.round(location.lng * 1000) / 1000
        };
      
      default:
        // Low precision (general area only)
        return {
          lat: Math.round(location.lat * 100) / 100, // ~1.1km precision
          lng: Math.round(location.lng * 100) / 100
        };
    }
  }

  /**
   * Get location for display (with privacy masks)
   */
  async getLocationForDisplay(
    technicianId: string,
    requestedBy: string,
    requestedByRole: UserRole
  ): Promise<LocationDisplay> {
    // Only owner/admin can see technician locations
    if (!['owner', 'admin', 'dispatcher'].includes(requestedByRole)) {
      throw new Error('Not authorized to view technician location');
    }

    const location = await this.locationCache.get(`location:${technicianId}`);
    if (!location) {
      return { available: false };
    }

    // Audit access
    await this.auditLog.log({
      action: 'location_accessed',
      entity_type: 'technician',
      entity_id: technicianId,
      user_id: requestedBy
    });

    return {
      available: true,
      location: JSON.parse(location),
      lastUpdated: await this.getLastUpdateTime(technicianId)
    };
  }
}
```

---

# SECTION 16: ABUSE PREVENTION

## Abuse Detection System

```typescript
// services/security/AbuseDetectionService.ts

interface AbusePattern {
  type: string;
  check: (event: IncomingEvent) => Promise<AbuseCheckResult>;
  action: AbuseAction;
  threshold: number;
  window: number; // seconds
}

const ABUSE_PATTERNS: AbusePattern[] = [
  // High volume from single number
  {
    type: 'message_flood',
    check: async (event) => {
      const count = await getMessageCount(event.sender, 60); // Last minute
      return { triggered: count > 20, score: count / 20 };
    },
    action: 'rate_limit',
    threshold: 20,
    window: 60
  },

  // Spam content detection
  {
    type: 'spam_content',
    check: async (event) => {
      const spamScore = await checkSpamPatterns(event.content);
      return { triggered: spamScore > 0.8, score: spamScore };
    },
    action: 'flag_for_review',
    threshold: 0.8,
    window: 0
  },

  // URL spam
  {
    type: 'url_spam',
    check: async (event) => {
      const urlCount = (event.content.match(/https?:\/\//g) || []).length;
      return { triggered: urlCount > 2, score: urlCount / 2 };
    },
    action: 'block',
    threshold: 2,
    window: 0
  },

  // New number + high volume
  {
    type: 'new_number_flood',
    check: async (event) => {
      const isNew = await isNewSender(event.sender, 24 * 60); // 24 hours
      const count = await getMessageCount(event.sender, 5); // 5 minutes
      return { triggered: isNew && count > 5, score: count / 5 };
    },
    action: 'block',
    threshold: 5,
    window: 300
  },

  // Repeated identical messages
  {
    type: 'duplicate_messages',
    check: async (event) => {
      const duplicates = await getDuplicateCount(event.sender, event.contentHash, 60);
      return { triggered: duplicates > 3, score: duplicates / 3 };
    },
    action: 'rate_limit',
    threshold: 3,
    window: 60
  },

  // Off-hours flooding (bot behavior)
  {
    type: 'off_hours_flood',
    check: async (event) => {
      const hour = new Date().getHours();
      const isOffHours = hour < 6 || hour > 23;
      const count = await getMessageCount(event.sender, 10); // 10 minutes
      return { triggered: isOffHours && count > 10, score: count / 10 };
    },
    action: 'flag_for_review',
    threshold: 10,
    window: 600
  },

  // Known bad actor
  {
    type: 'known_bad_actor',
    check: async (event) => {
      const isBlacklisted = await isOnBlacklist(event.sender);
      return { triggered: isBlacklisted, score: 1 };
    },
    action: 'block',
    threshold: 1,
    window: 0
  }
];

export class AbuseDetectionService {
  /**
   * Check incoming event for abuse
   */
  async checkForAbuse(event: IncomingEvent): Promise<AbuseCheckResult> {
    const results: AbuseCheckDetail[] = [];
    let maxScore = 0;
    let primaryAction: AbuseAction = 'allow';

    for (const pattern of ABUSE_PATTERNS) {
      const result = await pattern.check(event);
      
      results.push({
        type: pattern.type,
        triggered: result.triggered,
        score: result.score
      });

      if (result.triggered && result.score > maxScore) {
        maxScore = result.score;
        primaryAction = pattern.action;
      }
    }

    // Log if any checks triggered
    if (results.some(r => r.triggered)) {
      await this.logAbuseAttempt(event, results);
    }

    return {
      allowed: primaryAction === 'allow',
      action: primaryAction,
      score: maxScore,
      details: results
    };
  }

  /**
   * Apply abuse action
   */
  async applyAction(event: IncomingEvent, result: AbuseCheckResult): Promise<void> {
    switch (result.action) {
      case 'block':
        // Add to temporary blacklist
        await this.addToBlacklist(event.sender, 24 * 60 * 60); // 24 hours
        // Log
        await this.logBlock(event, result);
        break;

      case 'rate_limit':
        // Reduce rate limit for sender
        await this.applyRateLimit(event.sender, {
          max: 5,
          window: 300 // 5 per 5 minutes
        });
        break;

      case 'flag_for_review':
        // Add to review queue
        await this.flagForReview(event, result);
        break;

      case 'allow':
        // Normal processing
        break;
    }
  }

  /**
   * Log abuse attempt for analysis
   */
  private async logAbuseAttempt(
    event: IncomingEvent,
    results: AbuseCheckDetail[]
  ): Promise<void> {
    await this.abuseLogRepo.create({
      sender: event.sender,
      org_id: event.orgId,
      event_type: event.type,
      checks_triggered: results.filter(r => r.triggered).map(r => r.type),
      max_score: Math.max(...results.map(r => r.score)),
      content_preview: event.content?.slice(0, 100), // Truncated for privacy
      timestamp: new Date()
    });

    // Alert if high volume abuse
    const recentAbuse = await this.getRecentAbuseCount(event.sender, 60);
    if (recentAbuse > 10) {
      await this.alertService.sendWarning({
        title: 'High volume abuse detected',
        message: `Sender ${this.maskPhone(event.sender)} triggered ${recentAbuse} abuse checks in 1 hour`,
        channel: 'ops-security'
      });
    }
  }
}
```

## Spam Filter for Voice Messages

```typescript
// services/voice-ai/VoiceSpamFilter.ts

export class VoiceSpamFilter {
  /**
   * Pre-filter voice messages before expensive AI processing
   */
  async shouldProcess(message: WhatsAppVoiceMessage): Promise<FilterResult> {
    // 1. Check duration (too short = noise, too long = probably not a job request)
    if (message.duration < 2) {
      return { process: false, reason: 'too_short' };
    }
    if (message.duration > 300) { // 5 minutes
      return { process: false, reason: 'too_long' };
    }

    // 2. Check sender reputation
    const reputation = await this.getSenderReputation(message.sender);
    if (reputation.blocked) {
      return { process: false, reason: 'sender_blocked' };
    }

    // 3. Check rate limit
    const recentMessages = await this.getRecentVoiceMessages(message.sender, 60);
    if (recentMessages > 5) {
      return { process: false, reason: 'rate_limited' };
    }

    // 4. Check for known spam audio patterns (optional ML)
    const spamScore = await this.checkAudioSpamPatterns(message.audioUrl);
    if (spamScore > 0.9) {
      return { process: false, reason: 'spam_audio_detected', confidence: spamScore };
    }

    // 5. Check if this is a reply to our message (higher priority)
    const isReply = await this.isReplyToOurMessage(message.sender, message.orgId);
    
    return {
      process: true,
      priority: isReply ? 'high' : 'normal'
    };
  }

  /**
   * Get sender reputation based on history
   */
  private async getSenderReputation(sender: string): Promise<SenderReputation> {
    // Check blacklist
    const blacklisted = await this.redis.get(`blacklist:${sender}`);
    if (blacklisted) {
      return { blocked: true, reason: 'blacklisted' };
    }

    // Check history
    const history = await this.getMessageHistory(sender, 30 * 24 * 60 * 60); // 30 days
    
    // Good indicators
    const hasCreatedJobs = history.jobsCreated > 0;
    const hasCompletedJobs = history.jobsCompleted > 0;
    const hasPaidInvoices = history.invoicesPaid > 0;
    
    // Bad indicators
    const spamFlagged = history.spamFlags > 0;
    const ignored = history.messagesIgnored / Math.max(history.totalMessages, 1);

    const score = this.calculateReputationScore({
      hasCreatedJobs,
      hasCompletedJobs,
      hasPaidInvoices,
      spamFlagged,
      ignoredRatio: ignored
    });

    return {
      blocked: false,
      score,
      isKnownCustomer: hasCreatedJobs,
      isPaying: hasPaidInvoices
    };
  }
}
```

## Rate Limiting per Organization

```typescript
// infrastructure/security/OrgRateLimiter.ts

interface RateLimitConfig {
  // Per-org limits
  messagesPerMinute: number;
  voiceMessagesPerHour: number;
  jobCreationsPerDay: number;
  
  // Per-sender limits (within org)
  senderMessagesPerMinute: number;
  senderVoicePerHour: number;
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  messagesPerMinute: 100,
  voiceMessagesPerHour: 50,
  jobCreationsPerDay: 200,
  senderMessagesPerMinute: 10,
  senderVoicePerHour: 5
};

export class OrgRateLimiter {
  /**
   * Check rate limit
   */
  async checkLimit(
    orgId: string,
    sender: string,
    type: 'message' | 'voice' | 'job'
  ): Promise<RateLimitResult> {
    const config = await this.getOrgLimits(orgId);
    const now = Date.now();

    // Check org-level limit
    const orgKey = `ratelimit:org:${orgId}:${type}`;
    const orgCount = await this.getWindowCount(orgKey, this.getWindow(type));
    const orgLimit = this.getOrgLimit(config, type);

    if (orgCount >= orgLimit) {
      return {
        allowed: false,
        reason: 'org_limit_exceeded',
        retryAfter: this.getRetryAfter(orgKey)
      };
    }

    // Check sender-level limit
    const senderKey = `ratelimit:sender:${orgId}:${sender}:${type}`;
    const senderCount = await this.getWindowCount(senderKey, this.getWindow(type));
    const senderLimit = this.getSenderLimit(config, type);

    if (senderCount >= senderLimit) {
      return {
        allowed: false,
        reason: 'sender_limit_exceeded',
        retryAfter: this.getRetryAfter(senderKey)
      };
    }

    // Increment counters
    await this.increment(orgKey, this.getWindow(type));
    await this.increment(senderKey, this.getWindow(type));

    return {
      allowed: true,
      remaining: {
        org: orgLimit - orgCount - 1,
        sender: senderLimit - senderCount - 1
      }
    };
  }

  /**
   * Sliding window counter using Redis sorted sets
   */
  private async getWindowCount(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current window
    return await this.redis.zcard(key);
  }

  private async increment(key: string, windowSeconds: number): Promise<void> {
    const now = Date.now();
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSeconds);
  }

  private getWindow(type: string): number {
    switch (type) {
      case 'message': return 60; // 1 minute
      case 'voice': return 3600; // 1 hour
      case 'job': return 86400; // 1 day
      default: return 60;
    }
  }
}
```

## Abuse Review Queue

```typescript
// components/admin/AbuseReviewQueue.tsx

export function AbuseReviewQueue() {
  const { data: queue } = useAbuseReviewQueue();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Mensajes para revisar</h2>
        <Badge>{queue?.length || 0} pendientes</Badge>
      </div>

      {queue?.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex justify-between">
              <div>
                <CardTitle className="text-base">
                  {maskPhone(item.sender)}
                </CardTitle>
                <CardDescription>
                  {formatRelativeTime(item.created_at)} • 
                  Org: {item.org_name}
                </CardDescription>
              </div>
              <AbuseScoreBadge score={item.abuse_score} />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Abuse indicators */}
            <div className="flex flex-wrap gap-2">
              {item.triggered_checks.map((check: string) => (
                <Badge key={check} variant="outline">
                  {translateAbuseCheck(check)}
                </Badge>
              ))}
            </div>

            {/* Message preview */}
            <div className="p-3 bg-gray-50 rounded text-sm">
              {item.message_type === 'voice' ? (
                <AudioPlayer url={item.audio_url} />
              ) : (
                <p>{item.content_preview}</p>
              )}
            </div>

            {/* Sender history */}
            <div className="text-sm text-muted-foreground">
              <p>Historial: {item.sender_history.total_messages} mensajes, 
                 {item.sender_history.jobs_created} trabajos creados</p>
              {item.sender_history.spam_flags > 0 && (
                <p className="text-red-600">
                  ⚠️ Flaggeado como spam {item.sender_history.spam_flags} veces
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => approveMessage(item.id)}
              >
                <Check className="h-4 w-4 mr-1" />
                Aprobar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAsSpam(item.id)}
              >
                <Trash className="h-4 w-4 mr-1" />
                Spam
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => blockSender(item.sender)}
            >
              <Ban className="h-4 w-4 mr-1" />
              Bloquear número
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function translateAbuseCheck(check: string): string {
  const translations: Record<string, string> = {
    message_flood: 'Muchos mensajes',
    spam_content: 'Contenido spam',
    url_spam: 'Muchos links',
    new_number_flood: 'Número nuevo sospechoso',
    duplicate_messages: 'Mensajes duplicados',
    off_hours_flood: 'Actividad fuera de horario'
  };
  return translations[check] || check;
}
```

---

# UPDATED TIMELINE (18 Weeks)

## Changes from v6

| Phase | v6 | v7 | Delta |
|-------|----|----|-------|
| Pre-development | 2 weeks | 2 weeks | Same |
| Foundation | 2 weeks | 2 weeks | Same |
| AFIP | 3 weeks | 3 weeks | Same |
| Payments + WhatsApp | 2 weeks | 2 weeks | Same |
| Voice AI | 3 weeks | 3 weeks | Same |
| Mobile | 4 weeks | 4 weeks | Same |
| **Security & Governance** | - | **1.5 weeks** | +1.5 weeks |
| Testing | 1 week | 1.5 weeks | +0.5 weeks |
| Launch | 1 week | 1 week | Same |
| **Total** | **16 weeks** | **18 weeks** | **+2 weeks** |

## New Week: Security & Governance (Week 15)

| Day | Deliverables |
|-----|--------------|
| 1-2 | Encryption service, key management |
| 3 | AFIP credential encryption, token rotation |
| 4 | Log redaction, audit log system |
| 5 | Abuse detection, spam filters |
| 6 | Rate limiting, blacklist management |
| 7 | Admin review queue, security testing |

---

# FINAL SUCCESS METRICS (v7)

## Launch Day (Week 18)

| Metric | Target |
|--------|--------|
| Signup to first job | < 2 minutes |
| First job to paid invoice | < 30 seconds |
| Voice AI accuracy | ≥ 70% |
| Offline job completion | Works on Samsung A10 |
| Cold start (Samsung A10) | < 4 seconds |
| Visible errors | 0 |
| **Duplicate invoices** | **0 (idempotency verified)** |
| **Security audit passed** | **Yes** |

## Month 1

| Metric | Target |
|--------|--------|
| Pilot customers | 10 |
| Cost per user | < $8 |
| Voice AI human review rate | < 30% |
| Offline sync success rate | > 95% |
| **Abuse incidents** | **< 5** |
| **Data breach incidents** | **0** |

---

# DOCUMENT INDEX

| Section | Topic | Key Deliverables |
|---------|-------|------------------|
| 1 | Event Ownership | Domain ownership matrix, conflict resolution |
| 2 | Idempotency | External service idempotency keys |
| 3 | UI States | User-facing status models for all entities |
| 4 | Notifications | Priority matrix, suppression rules |
| 5 | Job Automation | 8 automation rules, spam detection |
| 6 | Tax Integration | IVA calculation, invoice types A/B/C |
| 7 | Disputes | Refund/chargeback handling |
| 8 | Permissions | 5 roles, permission matrix |
| 9 | Offline | Photo specs, signature, conflict resolution |
| 10 | Mode Navigation | Simple/Advanced switching |
| 11 | Retention | 10-year archive, GDPR delete |
| 12 | Versioning | Immutable documents, audit chain |
| 13 | Panic Mode | Metric triggers, hysteresis, manual override |
| 14 | Backpressure | Queue overflow, priority processing |
| 15 | Security | Encryption, key rotation, log redaction |
| 16 | Abuse Prevention | Spam detection, rate limiting |

---

*Document Version: 7.0 (Production-Grade)*
*Last Updated: December 2025*
*Timeline: 18 weeks*
*Budget: ~$720/month at 100 users*
*Security: AES-256, TLS 1.3, 10-year retention*
