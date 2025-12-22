'use client';

/**
 * AI Assistant Context Provider
 * ==============================
 *
 * Provides AI assistant state and settings throughout the app.
 * Synchronizes AI toggle state between WhatsApp page and AI Settings page.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-context';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AISettings {
  id: string | null;
  isEnabled: boolean;
  autoResponseEnabled: boolean;
  minConfidenceToRespond: number;
  minConfidenceToCreateJob: number;
  aiTone: string;
  companyName: string;
  companyDescription: string;
  servicesOffered: Array<{ name: string; description: string; priceRange?: string }>;
  businessHours: Record<string, { open: string; close: string } | null>;
  serviceAreas: string;
  pricingInfo: string;
  cancellationPolicy: string;
  paymentMethods: string;
  warrantyInfo: string;
  faqItems: Array<{ question: string; answer: string }>;
  customInstructions: string;
  greetingMessage: string;
  awayMessage: string;
  transferKeywords: string[];
  escalationUserId: string;
  dataAccessPermissions: {
    companyInfo: boolean;
    services: boolean;
    pricing: boolean;
    businessHours: boolean;
    serviceAreas: boolean;
    technicianNames: boolean;
    technicianAvailability: boolean;
    scheduleSlots: boolean;
    faq: boolean;
    policies: boolean;
  };
}

interface AIAssistantContextValue {
  settings: AISettings | null;
  isLoading: boolean;
  isEnabled: boolean;
  toggleEnabled: () => Promise<void>;
  updateSettings: (settings: Partial<AISettings>) => Promise<void>;
  refetch: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS: AISettings = {
  id: null,
  isEnabled: false,
  autoResponseEnabled: true,
  minConfidenceToRespond: 70,
  minConfidenceToCreateJob: 85,
  aiTone: 'friendly_professional',
  companyName: '',
  companyDescription: '',
  servicesOffered: [],
  businessHours: {},
  serviceAreas: '',
  pricingInfo: '',
  cancellationPolicy: '',
  paymentMethods: '',
  warrantyInfo: '',
  faqItems: [],
  customInstructions: '',
  greetingMessage: '',
  awayMessage: '',
  transferKeywords: [],
  escalationUserId: '',
  dataAccessPermissions: {
    companyInfo: true,
    services: true,
    pricing: true,
    businessHours: true,
    serviceAreas: true,
    technicianNames: false,
    technicianAvailability: true,
    scheduleSlots: true,
    faq: true,
    policies: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const AIAssistantContext = createContext<AIAssistantContextValue | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchAISettings(): Promise<AISettings> {
  const response = await fetch('/api/settings/ai-assistant');
  if (!response.ok) {
    throw new Error('Failed to fetch AI settings');
  }
  return response.json();
}

async function updateAISettings(settings: Partial<AISettings>): Promise<AISettings> {
  const response = await fetch('/api/settings/ai-assistant', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error('Failed to update AI settings');
  }
  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Fetch AI settings - only when authenticated
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['ai-assistant-settings'],
    queryFn: fetchAISettings,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
    enabled: isAuthenticated && !authLoading, // Only fetch when authenticated
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateAISettings,
    onSuccess: (newSettings) => {
      queryClient.setQueryData(['ai-assistant-settings'], newSettings);
    },
  });

  // Toggle AI enabled state
  const toggleEnabled = useCallback(async () => {
    const currentSettings = settings || DEFAULT_SETTINGS;
    await updateMutation.mutateAsync({
      ...currentSettings,
      isEnabled: !currentSettings.isEnabled,
    });
  }, [settings, updateMutation]);

  // Update settings
  const updateSettingsHandler = useCallback(async (newSettings: Partial<AISettings>) => {
    const currentSettings = settings || DEFAULT_SETTINGS;
    await updateMutation.mutateAsync({
      ...currentSettings,
      ...newSettings,
    });
  }, [settings, updateMutation]);

  const value: AIAssistantContextValue = {
    settings: settings || DEFAULT_SETTINGS,
    isLoading,
    isEnabled: settings?.isEnabled || false,
    toggleEnabled,
    updateSettings: updateSettingsHandler,
    refetch,
  };

  return (
    <AIAssistantContext.Provider value={value}>
      {children}
    </AIAssistantContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (context === undefined) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI STATUS TOGGLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface AIStatusToggleProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AIStatusToggle({ showLabel = true, size = 'md', className = '' }: AIStatusToggleProps) {
  const { isEnabled, isLoading, toggleEnabled } = useAIAssistant();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await toggleEnabled();
    } finally {
      setIsToggling(false);
    }
  };

  const sizeClasses = {
    sm: { toggle: 'w-8 h-4', dot: 'w-3 h-3', translate: 'translate-x-4' },
    md: { toggle: 'w-11 h-6', dot: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { toggle: 'w-14 h-7', dot: 'w-6 h-6', translate: 'translate-x-7' },
  };

  const sizes = sizeClasses[size];

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`${sizes.toggle} bg-gray-200 rounded-full animate-pulse`} />
        {showLabel && <span className="text-sm text-gray-400">Cargando...</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={`
          relative inline-flex items-center rounded-full transition-colors duration-200
          ${sizes.toggle}
          ${isEnabled ? 'bg-teal-500' : 'bg-gray-300'}
          ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-pressed={isEnabled}
        aria-label={isEnabled ? 'Desactivar AI' : 'Activar AI'}
      >
        <span
          className={`
            inline-block rounded-full bg-white shadow transform transition-transform duration-200
            ${sizes.dot}
            ${isEnabled ? sizes.translate : 'translate-x-0.5'}
          `}
        />
      </button>
      {showLabel && (
        <span className={`text-sm font-medium ${isEnabled ? 'text-teal-600' : 'text-gray-500'}`}>
          {isEnabled ? 'Activo' : 'Desactivado'}
        </span>
      )}
    </div>
  );
}
