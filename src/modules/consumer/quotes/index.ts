/**
 * Quotes Module
 * =============
 *
 * Exports for business quotes and messaging.
 * Phase 15: Consumer Marketplace
 */

export { QuoteRepository } from './quote.repository';
export type {
  CreateQuoteInput,
  UpdateQuoteInput,
  CreateMessageInput,
  QuoteDeclineInput,
  QuoteMessage,
  QuoteSearchParams,
} from './quote.repository';

export { QuoteService, NotificationService } from './quote.service';
export type {
  QuoteError,
  SubmitQuoteInput,
  QuoteWithDetails,
  QuoteComparisonResult,
} from './quote.service';

export {
  createConsumerQuoteRoutes,
  createBusinessQuoteRoutes,
} from './quote.routes';
