'use client';

/**
 * Settings Verification Page
 * ==========================
 *
 * This page redirects to the main verification center.
 * Located under settings for better discoverability.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsVerificationPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the main verification center
        router.replace('/dashboard/verificacion');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
                <p className="text-gray-500">Redirigiendo al Centro de Verificación...</p>
            </div>
        </div>
    );
}
