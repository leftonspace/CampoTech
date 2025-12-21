'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SetupWizard } from '@/components/whatsapp/SetupWizard';
import { api } from '@/lib/api-client';

interface WhatsAppSettings {
  integrationType: 'NONE' | 'WAME_LINK' | 'BSP_API';
  isConfigured: boolean;
  personalNumber?: string;
  subscriptionTier: string;
  canUseBsp: boolean;
}

export default function WhatsAppSetupPage() {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings-whatsapp'],
    queryFn: () => api.settings.whatsapp.get(),
  });

  const settings = data?.data as WhatsAppSettings | undefined;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">Error al cargar la configuración</p>
          <button
            onClick={() => router.push('/dashboard/settings/whatsapp')}
            className="btn-primary"
          >
            Volver a configuración
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* Minimal header - wizard has its own navigation */}
      <div className="mb-8">
        <Link
          href="/dashboard/settings/whatsapp"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a WhatsApp
        </Link>
      </div>

      <SetupWizard
        subscriptionTier={settings?.subscriptionTier || 'FREE'}
        canUseBsp={settings?.canUseBsp || false}
        currentPersonalNumber={settings?.personalNumber}
      />
    </div>
  );
}
