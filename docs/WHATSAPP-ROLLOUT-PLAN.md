# WhatsApp Integration Rollout Plan

This document outlines the phased rollout strategy for the WhatsApp integration in CampoTech.

## Executive Summary

The WhatsApp integration will be rolled out in three phases:
1. **Phase 1**: wa.me links for INICIAL+ tiers (Immediate)
2. **Phase 2**: BSP beta for select EMPRESARIAL customers (Week 1-2)
3. **Phase 3**: BSP general availability for PROFESIONAL+ (Week 3+)

---

## Phase 1: wa.me Links (Immediate Release)

### Scope
- Click-to-chat links using customer's personal WhatsApp
- No AI, no automation
- All paid tiers (INICIAL, PROFESIONAL, EMPRESARIAL, ENTERPRISE)

### Features Included
- [ ] Personal WhatsApp number configuration
- [ ] wa.me link generation
- [ ] WhatsApp button on invoices
- [ ] WhatsApp button on customer profiles
- [ ] WhatsApp button on job confirmations
- [ ] QR code generation
- [ ] Phone number validation

### Rollout Steps

1. **Pre-Launch (Day -1)**
   - [ ] Deploy wa.me link code to production
   - [ ] Enable feature flag: `WHATSAPP_WAME_ENABLED=true`
   - [ ] Verify all tiers can access settings page

2. **Soft Launch (Day 0)**
   - [ ] Enable for all paid subscriptions
   - [ ] Monitor error rates in Sentry
   - [ ] Check link generation analytics

3. **Communication (Day 1)**
   - [ ] In-app notification: "New feature: WhatsApp integration"
   - [ ] Email to all paid users
   - [ ] Blog post announcement

### Success Metrics
- 50% of INICIAL users configure number within 7 days
- Error rate < 0.1%
- No support tickets about invalid links

---

## Phase 2: BSP Beta (Week 1-2)

### Scope
- Exclusive WhatsApp numbers via 360dialog
- AI-powered automatic responses
- Limited to select EMPRESARIAL customers

### Beta Criteria
Select 10-20 customers who:
- Are on EMPRESARIAL plan
- Have high message volume expected
- Are willing to provide feedback
- Agree to beta terms

### Features Included
- [ ] Number provisioning (Argentine numbers)
- [ ] Verification flow (SMS OTP)
- [ ] AI responder integration
- [ ] Conversation history
- [ ] Basic usage tracking

### Rollout Steps

1. **Beta Preparation (Day 0)**
   - [ ] Configure 360dialog production credentials
   - [ ] Set up webhook endpoints
   - [ ] Prepare number pool (20 numbers)
   - [ ] Enable feature flag: `WHATSAPP_BSP_BETA=true`

2. **Beta Onboarding (Days 1-3)**
   - [ ] Personally invite beta customers
   - [ ] Schedule 30-min onboarding calls
   - [ ] Assist with AI configuration
   - [ ] Monitor first messages closely

3. **Beta Monitoring (Days 4-14)**
   - [ ] Daily check of error logs
   - [ ] Weekly feedback calls
   - [ ] Track usage metrics
   - [ ] Document issues and fixes

### Beta Exit Criteria
- [ ] 5+ customers using daily for 1 week
- [ ] AI response satisfaction > 80%
- [ ] No P1 bugs unresolved
- [ ] Usage tracking accurate
- [ ] Billing integration tested

### Known Limitations During Beta
- Maximum 5 concurrent conversations
- No multi-agent assignment
- English transcription only for voice
- Manual monthly billing reset

---

## Phase 3: General Availability (Week 3+)

### Scope
- Full BSP functionality for PROFESIONAL+
- Self-service provisioning
- Automated billing and limits

### Features Included
All beta features plus:
- [ ] Self-service number selection
- [ ] Automated tier limit enforcement
- [ ] Usage dashboard
- [ ] Upgrade prompts when approaching limits
- [ ] Template message support

### Rollout Steps

1. **GA Preparation (Day -3 to 0)**
   - [ ] Remove beta feature flag
   - [ ] Enable `WHATSAPP_BSP_GA=true`
   - [ ] Increase number pool to 100 numbers
   - [ ] Prepare customer communication

2. **EMPRESARIAL Launch (Day 1)**
   - [ ] Enable for all EMPRESARIAL customers
   - [ ] In-app promotion on dashboard
   - [ ] Email announcement
   - [ ] Monitor provisioning volume

3. **PROFESIONAL Launch (Day 7)**
   - [ ] Enable for all PROFESIONAL customers
   - [ ] Emphasize 1,000 message limit
   - [ ] Promote upgrade path to EMPRESARIAL

4. **Full GA (Day 14)**
   - [ ] Enable signup during onboarding
   - [ ] Show in plan comparison
   - [ ] Marketing campaign

### Success Metrics (90 days post-GA)
- 30% of PROFESIONAL+ customers use WhatsApp
- Average 50 messages/day per active customer
- Customer satisfaction (NPS) > 8
- Support tickets < 5/week related to WhatsApp

---

## Monitoring Plan

### Key Metrics Dashboard

Create a monitoring dashboard with:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Active WhatsApp users | Growing | Drop > 10% week-over-week |
| Messages sent/day | Per-tier average | Unusual spikes |
| AI response rate | > 90% | < 80% |
| Delivery success | > 98% | < 95% |
| Average response time | < 30 seconds | > 60 seconds |
| Provisioning success | > 95% | < 90% |
| Customer complaints | < 5/week | > 10/week |

### Alerting

Set up alerts for:
- [ ] Webhook failures > 1% in 5 minutes
- [ ] Message delivery failures > 5% in 1 hour
- [ ] AI errors > 10 in 1 hour
- [ ] Zero messages processed in 30 minutes (during business hours)
- [ ] Usage limit reached (warn at 80%, alert at 100%)

### Weekly Review

Every Monday:
1. Review week's metrics
2. Check support tickets
3. Review error logs
4. Plan fixes for any issues
5. Gather customer feedback

---

## Rollback Procedures

### Level 1: Disable AI Only
```env
AI_WHATSAPP_ENABLED=false
```
- Messages still received
- Human-only responses
- Quick toggle

### Level 2: Disable BSP New Signups
```env
WHATSAPP_BSP_NEW_SIGNUPS=false
```
- Existing users continue working
- No new provisioning
- Used during issues

### Level 3: Full BSP Disable
```env
WHATSAPP_BSP_ENABLED=false
```
- All BSP features disabled
- wa.me links still work
- Used for major issues

### Level 4: Complete Rollback
1. Disable all WhatsApp features
2. Revert database migrations (if needed)
3. Communicate with affected customers
4. Issue credits if service impacted

---

## Communication Plan

### Internal Communication

| Audience | Channel | Timing | Message |
|----------|---------|--------|---------|
| Engineering | Slack | Daily | Status updates |
| Support | Slack + Training | Pre-launch | How to handle tickets |
| Sales | Email + Demo | Pre-launch | Feature selling points |
| Leadership | Weekly update | Weekly | Metrics summary |

### Customer Communication

| Phase | Channel | Content |
|-------|---------|---------|
| Phase 1 | In-app + Email | New feature announcement |
| Phase 2 | Personal invite | Beta invitation |
| Phase 3 | In-app + Email + Blog | GA announcement |
| Ongoing | In-app | Usage tips, upgrade prompts |

### Support Preparation

1. **Documentation**
   - [ ] Update help center with WhatsApp guides
   - [ ] Create FAQ document
   - [ ] Prepare canned responses

2. **Training**
   - [ ] 1-hour training session for support team
   - [ ] Walkthrough of setup flow
   - [ ] Common issues and resolutions

3. **Escalation**
   - [ ] Define L1/L2/L3 support levels
   - [ ] 360dialog support contact
   - [ ] Engineering escalation path

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 360dialog API outage | Low | High | Fallback to wa.me links |
| High provisioning volume | Medium | Medium | Queue system, increase pool |
| AI inappropriate responses | Medium | High | Content filtering, quick toggle |
| Message limit confusion | High | Low | Clear UI, proactive alerts |
| Verification failures | Medium | Medium | Multiple retry, manual override |
| Customer data privacy | Low | Critical | Encryption, access controls |

---

## Budget Considerations

### 360dialog Costs
- Per-message pricing: Check current 360dialog rates
- Number rental: Monthly fee per number
- Bulk pricing: Negotiate based on volume

### Infrastructure
- Additional server capacity for webhooks
- Database storage for messages
- OpenAI API costs for AI responses

### Budget Monitoring
- Set up cost alerts
- Weekly review of 360dialog invoice
- Track cost per customer

---

## Post-Launch Improvements (90+ days)

### Planned Enhancements
1. **Multi-language support** - Spanish variations, Portuguese
2. **Template messages** - Pre-approved templates for marketing
3. **Broadcast messaging** - Send to multiple customers
4. **Media support** - Image/document sending
5. **Integration with CRM** - Sync conversations
6. **Analytics dashboard** - Detailed conversation analytics

### Feedback Collection
- Monthly customer surveys
- In-app feedback widget
- Support ticket analysis
- Usage pattern analysis

---

## Approval Checklist

Before each phase launch:

- [ ] Engineering sign-off
- [ ] QA testing complete
- [ ] Support team trained
- [ ] Documentation updated
- [ ] Monitoring in place
- [ ] Rollback plan tested
- [ ] Communication ready
- [ ] Leadership approval

---

## Timeline Summary

```
Week 0        Week 1        Week 2        Week 3        Week 4
   |             |             |             |             |
   ├─ Phase 1 ───┤             |             |             |
   │  (wa.me)    │             |             |             |
                 ├── Phase 2 ──┤             |             |
                 │   (Beta)    │             |             |
                               ├── Phase 3 ──┼─────────────>
                               │   (GA)      │
```

---

*Last Updated: December 2024*
*Owner: Engineering Team*
*Review: Monthly*
