/**
 * Consumer Module Types
 * =====================
 *
 * Type definitions for the consumer marketplace module.
 * Phase 15: Consumer Marketplace (Free Service Finder)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export enum ConsumerContactPreference {
  WHATSAPP = 'whatsapp',
  PHONE = 'phone',
  APP = 'app',
  EMAIL = 'email',
}

export enum ServiceUrgency {
  EMERGENCY = 'emergency',
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  FLEXIBLE = 'flexible',
}

export enum ServiceRequestStatus {
  OPEN = 'open',
  QUOTES_RECEIVED = 'quotes_received',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum QuoteStatus {
  PENDING = 'pending',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  WITHDRAWN = 'withdrawn',
}

export enum ReviewStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  FLAGGED = 'flagged',
  REMOVED = 'removed',
}

export enum ReviewVerification {
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
}

export enum BusinessBadge {
  VERIFIED = 'verified',
  TOP_RATED = 'top_rated',
  FAST_RESPONDER = 'fast_responder',
  NEW = 'new',
  LICENSED = 'licensed',
  INSURED = 'insured',
  BACKGROUND_CHECKED = 'background_checked',
  PREMIUM = 'premium',
}

export enum ServiceCategory {
  PLUMBING = 'plumbing',
  ELECTRICAL = 'electrical',
  HVAC = 'hvac',
  GAS = 'gas',
  LOCKSMITH = 'locksmith',
  PAINTING = 'painting',
  CONSTRUCTION = 'construction',
  CLEANING = 'cleaning',
  GARDENING = 'gardening',
  PEST_CONTROL = 'pest_control',
  APPLIANCE_REPAIR = 'appliance_repair',
  CARPENTRY = 'carpentry',
  ROOFING = 'roofing',
  FLOORING = 'flooring',
  WINDOWS_DOORS = 'windows_doors',
  SECURITY = 'security',
  MOVING = 'moving',
  GENERAL = 'general',
}

export enum BudgetRange {
  UNDER_5000 = 'under_5000',
  RANGE_5000_15000 = '5000_15000',
  RANGE_15000_50000 = '15000_50000',
  RANGE_50000_100000 = '50000_100000',
  OVER_100000 = 'over_100000',
  NOT_SPECIFIED = 'not_specified',
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsumerProfile {
  id: string;
  phone: string;
  phoneVerified: boolean;
  email?: string;
  emailVerified: boolean;
  firstName: string;
  lastName?: string;
  profilePhotoUrl?: string;
  bio?: string;

  // Location
  defaultAddress?: string;
  defaultAddressExtra?: string;
  defaultLat?: number;
  defaultLng?: number;
  neighborhood?: string;
  city: string;
  province: string;
  postalCode?: string;

  // Saved addresses
  savedAddresses: SavedAddress[];

  // Preferences
  preferredContact: ConsumerContactPreference;
  language: string;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;

  // Privacy
  profileVisibility: 'public' | 'service_providers' | 'private';
  showLastName: boolean;

  // Stats
  totalRequests: number;
  totalJobsCompleted: number;
  totalReviewsGiven: number;
  averageRatingGiven?: number;

  // Referral
  referralCode: string;
  referredBy?: string;
  referralCount: number;

  // Status
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason?: string;

  // FCM tokens
  fcmTokens: string[];

  // Last location
  lastKnownLat?: number;
  lastKnownLng?: number;
  lastLocationUpdate?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  deletedAt?: Date;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  addressExtra?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  city: string;
  isDefault: boolean;
}

export interface CreateConsumerDTO {
  phone: string;
  firstName: string;
  lastName?: string;
  email?: string;
  defaultAddress?: string;
  city?: string;
  province?: string;
  neighborhood?: string;
  referralCode?: string; // Code used to sign up
}

export interface UpdateConsumerDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
  profilePhotoUrl?: string;
  bio?: string;
  defaultAddress?: string;
  defaultAddressExtra?: string;
  defaultLat?: number;
  defaultLng?: number;
  neighborhood?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  preferredContact?: ConsumerContactPreference;
  language?: string;
  pushNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  profileVisibility?: 'public' | 'service_providers' | 'private';
  showLastName?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER SESSION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsumerSession {
  id: string;
  consumerId: string;
  refreshTokenHash: string;
  deviceType?: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  ipAddress?: string;
  isActive: boolean;
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER AUTH
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsumerAuthContext {
  consumerId: string;
  phone: string;
  firstName: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ConsumerAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  consumer: ConsumerProfile;
  isNewConsumer: boolean;
}

export interface ConsumerDeviceInfo {
  deviceType: 'ios' | 'android' | 'web';
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}

export enum ConsumerAuthErrorCode {
  PHONE_REQUIRED = 'PHONE_REQUIRED',
  INVALID_PHONE = 'INVALID_PHONE',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_INVALID = 'OTP_INVALID',
  OTP_MAX_ATTEMPTS = 'OTP_MAX_ATTEMPTS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  CONSUMER_NOT_FOUND = 'CONSUMER_NOT_FOUND',
  CONSUMER_SUSPENDED = 'CONSUMER_SUSPENDED',
  RATE_LIMITED = 'RATE_LIMITED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS PUBLIC PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

export interface BusinessPublicProfile {
  id: string;
  orgId: string;
  displayName: string;
  slug?: string;
  logoUrl?: string;
  coverPhotoUrl?: string;
  description?: string;
  shortDescription?: string;

  // Gallery
  galleryPhotos: GalleryPhoto[];
  workShowcase: WorkShowcaseItem[];

  // Services
  categories: ServiceCategory[];
  services: BusinessService[];

  // Service areas
  serviceAreas: ServiceArea[];
  maxTravelDistanceKm: number;

  // Contact preferences
  acceptsQuotes: boolean;
  autoRespondQuotes: boolean;
  responseTemplate?: string;

  // Working hours
  workingHours: WorkingHours;
  acceptsEmergency: boolean;
  emergencySurchargePercentage?: number;

  // Availability
  acceptingNewClients: boolean;
  maxActiveQuotes: number;
  quoteResponseTimeHours: number;

  // Verification
  cuitVerified: boolean;
  licenseVerified: boolean;
  licenseNumber?: string;
  licenseExpiry?: Date;
  insuranceVerified: boolean;
  insuranceProvider?: string;
  insuranceExpiry?: Date;
  backgroundCheckVerified: boolean;
  backgroundCheckDate?: Date;

  // Badges
  badges: BusinessBadge[];

  // Ratings
  overallRating: number;
  ratingCount: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;

  // Stats
  totalJobsCompleted: number;
  totalQuotesSent: number;
  quoteAcceptanceRate?: number;
  avgResponseTimeHours?: number;
  yearsOnPlatform: number;

  // Profile completeness
  profileCompleteness: number;

  // Visibility
  isVisible: boolean;
  isFeatured: boolean;
  isSuspended: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface GalleryPhoto {
  url: string;
  caption?: string;
  order: number;
}

export interface WorkShowcaseItem {
  beforeUrl?: string;
  afterUrl: string;
  description?: string;
  category?: ServiceCategory;
}

export interface BusinessService {
  name: string;
  description?: string;
  priceRange?: string;
  duration?: string;
}

export interface ServiceArea {
  neighborhood?: string;
  city: string;
  radiusKm?: number;
}

export interface WorkingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  start: string;  // "09:00"
  end: string;    // "18:00"
  closed?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

export interface ServiceRequest {
  id: string;
  consumerId: string;
  requestNumber: string;

  // What they need
  category: ServiceCategory;
  serviceType?: string;
  title: string;
  description: string;

  // Media
  photoUrls: string[];
  voiceNoteUrl?: string;
  videoUrl?: string;

  // Location
  address: string;
  addressExtra?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  city: string;
  province: string;
  postalCode?: string;

  // Timing
  urgency: ServiceUrgency;
  preferredDate?: Date;
  preferredTimeSlot?: string;
  flexibleDates: boolean;
  availableDates: AvailableDate[];

  // Budget
  budgetRange: BudgetRange;
  budgetMin?: number;
  budgetMax?: number;
  budgetNotes?: string;

  // Status
  status: ServiceRequestStatus;
  statusChangedAt: Date;

  // Matching
  matchedBusinessIds: string[];
  maxQuotes: number;
  quotesReceived: number;
  quotesViewed: number;

  // Acceptance
  acceptedQuoteId?: string;
  acceptedAt?: Date;

  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string;

  // Job linkage
  jobId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  deletedAt?: Date;
}

export interface AvailableDate {
  date: string;
  timeSlots: string[];
}

export interface CreateServiceRequestDTO {
  category: ServiceCategory;
  serviceType?: string;
  title: string;
  description: string;
  photoUrls?: string[];
  voiceNoteUrl?: string;
  address: string;
  addressExtra?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  city?: string;
  province?: string;
  urgency?: ServiceUrgency;
  preferredDate?: Date;
  preferredTimeSlot?: string;
  flexibleDates?: boolean;
  budgetRange?: BudgetRange;
  budgetMin?: number;
  budgetMax?: number;
  budgetNotes?: string;
}

export interface UpdateServiceRequestDTO {
  title?: string;
  description?: string;
  photoUrls?: string[];
  urgency?: ServiceUrgency;
  preferredDate?: Date;
  preferredTimeSlot?: string;
  budgetRange?: BudgetRange;
  budgetMin?: number;
  budgetMax?: number;
}

export interface ServiceRequestSearchParams {
  category?: ServiceCategory;
  status?: ServiceRequestStatus;
  urgency?: ServiceUrgency;
  city?: string;
  neighborhood?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS QUOTE
// ═══════════════════════════════════════════════════════════════════════════════

export interface BusinessQuote {
  id: string;
  serviceRequestId: string;
  requestId?: string; // Alias for serviceRequestId
  businessProfileId: string;
  orgId: string;
  quoteNumber: string;

  // Pricing
  priceType: 'fixed' | 'range' | 'hourly' | 'on_site';
  priceAmount?: number;
  priceMin?: number;
  priceMax?: number;
  estimatedPriceMin?: number; // Alias for priceMin
  estimatedPriceMax?: number; // Alias for priceMax
  hourlyRate?: number;
  estimatedHours?: number;
  currency: string;
  validUntil?: Date; // Quote validity deadline

  // Price breakdown
  laborCost?: number;
  materialsCost?: number;
  travelCost?: number;
  otherCosts: OtherCost[];

  // Details
  description?: string;
  includes: string[];
  excludes: string[];
  terms?: string;
  warrantyInfo?: string;

  // Timeline
  estimatedDurationHours?: number;
  availableDate?: Date;
  availableTimeSlot?: string;
  canStartImmediately: boolean;

  // Status
  status: QuoteStatus;
  statusChangedAt: Date;

  // Tracking
  sentAt: Date;
  viewedAt?: Date;
  viewCount: number;

  // Resolution
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  expiresAt: Date;
  withdrawnAt?: Date;
  withdrawalReason?: string;

  // Job
  jobId?: string;
  jobCreatedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface OtherCost {
  description: string;
  amount: number;
}

export interface CreateQuoteDTO {
  serviceRequestId: string;
  priceType: 'fixed' | 'range' | 'hourly' | 'on_site';
  priceAmount?: number;
  priceMin?: number;
  priceMax?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  laborCost?: number;
  materialsCost?: number;
  travelCost?: number;
  otherCosts?: OtherCost[];
  description?: string;
  includes?: string[];
  excludes?: string[];
  terms?: string;
  warrantyInfo?: string;
  estimatedDurationHours?: number;
  availableDate?: Date;
  availableTimeSlot?: string;
  canStartImmediately?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSUMER REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsumerReview {
  id: string;
  consumerId: string;
  businessProfileId: string;
  orgId: string;
  jobId?: string;
  quoteId?: string;
  serviceRequestId?: string;

  // Ratings
  overallRating: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;

  // Content
  title?: string;
  reviewText?: string;
  comment?: string; // Alias for reviewText
  pros?: string;
  cons?: string;
  photoUrls: string[];
  photos?: string[]; // Alias for photoUrls

  // Service details
  serviceCategory?: ServiceCategory;
  serviceDescription?: string;
  approximatePrice?: number;

  // Verification
  verificationStatus: ReviewVerification;
  verifiedAt?: Date;
  verificationMethod?: string;

  // Recommendations
  wouldRecommend: boolean;
  wouldUseAgain: boolean;

  // Business response
  businessResponse?: string;
  businessResponseAt?: Date;

  // Moderation
  status: ReviewStatus;
  flaggedReason?: string;
  flaggedAt?: Date;

  // Trust
  trustScore: number;
  isFeatured: boolean;
  helpfulCount: number;
  notHelpfulCount: number;

  // Edit tracking
  isEdited: boolean;
  lastEditedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewDTO {
  businessProfileId: string;
  jobId?: string;
  quoteId?: string;
  serviceRequestId?: string;
  overallRating: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  title?: string;
  reviewText?: string;
  pros?: string;
  cons?: string;
  photoUrls?: string[];
  serviceCategory?: ServiceCategory;
  serviceDescription?: string;
  approximatePrice?: number;
  wouldRecommend?: boolean;
  wouldUseAgain?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVERY & SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export interface BusinessSearchParams {
  query?: string;
  category?: ServiceCategory;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  city?: string;
  neighborhood?: string;
  minRating?: number;
  maxResponseTimeHours?: number;
  hasEmergency?: boolean;
  badges?: BusinessBadge[];
  sortBy?: 'rating' | 'distance' | 'response_time' | 'reviews';
  sortOrder?: 'asc' | 'desc';
}

export interface BusinessSearchResult {
  business: BusinessPublicProfile;
  distance?: number;  // in km
  matchScore: number;
  highlights?: string[];
}

export interface BusinessRankingFactors {
  averageRating: number;
  totalReviews: number;
  recentReviewTrend: number;
  verifiedReviewPercentage: number;
  responseTime: number;
  acceptanceRate: number;
  completionRate: number;
  lastActiveAt: Date;
  profileCompleteness: number;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  yearsInBusiness: number;
  distanceToConsumer: number;
  serviceMatch: number;
  availabilityMatch: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsumerPaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ConsumerPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
