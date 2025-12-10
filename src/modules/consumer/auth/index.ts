/**
 * Consumer Auth Module
 * ====================
 *
 * Exports for consumer authentication.
 * Phase 15: Consumer Marketplace
 */

export {
  ConsumerAuthService,
  ConsumerOTPService,
  ConsumerSessionService,
  ConsumerAuthError,
  getConsumerAuthService,
  initializeConsumerAuthService,
  resetConsumerAuthService,
} from './consumer-auth.service';

export {
  authenticateConsumer,
  optionalConsumerAuth,
  rateLimitOTP,
  requireActiveConsumer,
} from './consumer-auth.middleware';

export { createConsumerAuthRoutes } from './consumer-auth.routes';
