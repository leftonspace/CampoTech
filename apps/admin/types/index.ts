// Admin Dashboard Types

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
}

export interface Business {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';
  mrr: number;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  createdAt: string;
  lastActiveAt: string;
  userCount: number;
  jobCount: number;
  notes?: string;
}

export interface DashboardMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  mrr: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
  churnRate: number;
  activeUsersToday: number;
  systemHealth: {
    api: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
    whatsapp: 'healthy' | 'degraded' | 'down';
    payments: 'healthy' | 'degraded' | 'down';
  };
}

export interface RevenueData {
  date: string;
  revenue: number;
  subscriptions: number;
}

export interface RevenueByTier {
  tier: string;
  revenue: number;
  count: number;
  percentage: number;
}

export interface FailedPayment {
  id: string;
  businessId: string;
  businessName: string;
  amount: number;
  failedAt: string;
  reason: string;
  retryCount: number;
}

export interface AIConversation {
  id: string;
  businessId: string;
  businessName: string;
  customerPhone: string; // Anonymized
  messageCount: number;
  confidenceScore: number;
  status: 'completed' | 'escalated' | 'failed';
  createdAt: string;
  summary?: string;
}

export interface VoiceTranscription {
  id: string;
  businessId: string;
  technicianName: string;
  duration: number;
  transcription: string;
  createdAt: string;
}

export interface TechnicianLocation {
  id: string;
  technicianId: string;
  technicianName: string;
  businessId: string;
  businessName: string;
  latitude: number;
  longitude: number;
  status: 'en_route' | 'arrived' | 'in_progress' | 'completed';
  currentJobId?: string;
  lastUpdated: string;
}

export interface Job {
  id: string;
  businessId: string;
  businessName: string;
  customerId: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
  scheduledAt: string;
  technicianId?: string;
  technicianName?: string;
}
