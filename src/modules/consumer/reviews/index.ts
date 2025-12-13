/**
 * Reviews Module
 * ==============
 *
 * Exports for consumer reviews.
 * Phase 15: Consumer Marketplace
 */

export { ReviewRepository } from './review.repository';
export type {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewWithConsumer,
  ReviewSearchParams,
  RatingSummary,
} from './review.repository';

export { ReviewService } from './review.service';
export type {
  ReviewError,
  SubmitReviewInput,
  FraudSignal,
  ReviewAnalysis,
} from './review.service';

export {
  createReviewRoutes,
  createBusinessReviewRoutes,
  createReviewModerationRoutes,
} from './review.routes';
