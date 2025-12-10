/**
 * Quotes Module
 * =============
 *
 * Exports for business quotes and messaging.
 * Phase 15: Consumer Marketplace
 */

export {
  QuoteRepository,
  CreateQuoteInput,
  UpdateQuoteInput,
  CreateMessageInput,
  QuoteDeclineInput,
  QuoteMessage,
  QuoteSearchParams,
} from './quote.repository';

export {
  QuoteService,
  QuoteError,
  SubmitQuoteInput,
  QuoteWithDetails,
  QuoteComparisonResult,
  NotificationService,
} from './quote.service';

export {
  createConsumerQuoteRoutes,
  createBusinessQuoteRoutes,
} from './quote.routes';
