/**
 * Business Public Profile Types
 * ==============================
 *
 * Types matching the BusinessPublicProfile schema.
 * All businesses have a public profile (mandatory marketplace presence).
 */

/**
 * Service categories available in the marketplace
 */
export type ServiceCategory =
  | 'plomeria'
  | 'electricidad'
  | 'gas'
  | 'aires'
  | 'cerrajeria'
  | 'limpieza'
  | 'pintura'
  | 'albanileria';

/**
 * Individual service offering with optional pricing
 */
export interface ServiceOffering {
  id: string;
  name: string;
  description?: string;
  priceType: 'fixed' | 'from' | 'quote';
  price?: number; // In ARS
  duration?: string; // e.g., "1-2 horas"
}

/**
 * Service area definition
 */
export interface ServiceArea {
  type: 'radius' | 'zones';
  radiusKm?: number;
  zones?: string[]; // Neighborhood names
  centerLat?: number;
  centerLng?: number;
}

/**
 * Verification badges a business can have
 */
export interface VerificationBadges {
  cuitVerified: boolean;
  insuranceVerified: boolean;
  backgroundCheck: boolean;
  professionalLicense: boolean;
}

/**
 * Business working hours
 */
export interface WorkingHours {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  dayName: string;
  isOpen: boolean;
  openTime?: string; // "09:00"
  closeTime?: string; // "18:00"
  note?: string; // "Solo emergencias"
}

/**
 * Photo from completed jobs
 */
export interface JobPhoto {
  id: string;
  url: string;
  caption?: string;
  jobType?: string;
  createdAt: string;
}

/**
 * Customer review/rating
 */
export interface CustomerReview {
  id: string;
  authorName: string;
  authorInitials: string;
  rating: number; // 1-5
  comment?: string;
  serviceType?: string;
  createdAt: string;
  helpful: number;
  response?: {
    text: string;
    createdAt: string;
  };
}

/**
 * Business Public Profile
 * Mandatory for all businesses in the marketplace
 */
export interface BusinessPublicProfile {
  id: string;
  organizationId: string;

  // Basic info
  displayName: string;
  description?: string;
  logo?: string; // URL
  coverPhoto?: string; // URL
  avatar: string; // Initials fallback

  // Services
  categories: ServiceCategory[];
  services: ServiceOffering[];

  // Location
  serviceArea: ServiceArea;
  address?: string;
  city?: string;
  province?: string;

  // Contact
  whatsappNumber: string;
  phone?: string;
  email?: string;

  // Metrics
  averageRating: number;
  totalReviews: number;
  totalJobs: number;
  responseRate: number; // 0-100%
  responseTimeMinutes: number;

  // Verification
  verification: VerificationBadges;
  memberSince: string;

  // Status
  isActive: boolean;
  isAvailable: boolean;

  // Content
  photos: JobPhoto[];
  reviews: CustomerReview[];
  certifications: string[];
  workingHours: WorkingHours[];

  // Distance (calculated based on user location)
  distance?: number;
}

/**
 * Lead/contact request from consumer to business
 */
export interface ContactLead {
  id: string;
  providerId: string;
  providerName: string;

  // Consumer info (optional - may be anonymous)
  consumerId?: string;
  consumerName?: string;
  consumerPhone?: string;

  // Request details
  type: 'whatsapp' | 'call' | 'quote_request';
  category?: ServiceCategory;
  serviceRequested?: string;
  description?: string;

  // Location
  address?: string;
  latitude?: number;
  longitude?: number;

  // Status
  status: 'pending' | 'contacted' | 'converted' | 'lost';
  createdAt: string;
  contactedAt?: string;
}

/**
 * Quote request form data
 */
export interface QuoteRequest {
  providerId: string;
  serviceCategory: ServiceCategory;
  serviceType?: string;
  description: string;
  photos?: string[]; // URLs
  preferredDate?: string;
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening' | 'flexible';
  address: string;
  latitude?: number;
  longitude?: number;
  urgency: 'normal' | 'urgent' | 'emergency';
  contactPhone: string;
  contactName?: string;
}

/**
 * Category display info for UI
 */
export const CATEGORY_INFO: Record<
  ServiceCategory,
  {
    name: string;
    icon: string;
    color: string;
  }
> = {
  plomeria: { name: 'Plomería', icon: '🔧', color: '#3b82f6' },
  electricidad: { name: 'Electricidad', icon: '⚡', color: '#f59e0b' },
  gas: { name: 'Gas', icon: '🔥', color: '#ef4444' },
  aires: { name: 'Aires Acondicionados', icon: '❄️', color: '#06b6d4' },
  cerrajeria: { name: 'Cerrajería', icon: '🔐', color: '#8b5cf6' },
  limpieza: { name: 'Limpieza', icon: '🧹', color: '#10b981' },
  pintura: { name: 'Pintura', icon: '🎨', color: '#ec4899' },
  albanileria: { name: 'Albañilería', icon: '🧱', color: '#f97316' },
};
