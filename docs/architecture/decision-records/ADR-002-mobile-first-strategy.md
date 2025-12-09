# ADR-002: Mobile-First Strategy

**Status:** Accepted
**Date:** December 2024

## Context

Research indicates that 85%+ of Argentine SMB owners manage their business primarily from their phone. Many tradespeople have never owned a laptop.

The typical user:
- Has a smartphone (often Android)
- Uses WhatsApp for everything
- Works in the field
- No office or desktop computer

## Decision

Adopt a strict mobile-first architecture where:

1. **Feature parity** - Every web dashboard feature must be available on mobile
2. **Mobile signup** - Complete business setup possible from phone
3. **Offline support** - Core features work without internet
4. **Low-end device support** - Target Samsung Galaxy A10 performance

### Performance Targets
- Cold start: < 4 seconds
- Memory footprint: < 150MB
- Bundle size: < 30MB

### Required Mobile Features
- Account setup and team management
- Job creation, scheduling, assignment
- Customer database management
- Invoice creation and sending
- Payment recording
- All settings and configuration

## Consequences

### Positive
- Access to underserved market segment
- Competitive advantage in Argentina
- Better field worker experience
- No laptop requirement

### Negative
- Higher development effort (full parity)
- Complex offline sync requirements
- UI constraints on small screens

### Implementation Guidelines
- If building a web feature, mobile version must be planned
- Simpler UI patterns allowed on mobile (same functionality)
- Voice input as primary data entry method
- WhatsApp deep linking for communication

## Marketing Implications

Correct messaging:
> "Descargá la app CampoTech para manejar tu negocio desde el celular. Si tenés computadora, también podés acceder desde campotech.com.ar"

Incorrect:
> "Registrate en campotech.com.ar y descargá la app para tus técnicos."
