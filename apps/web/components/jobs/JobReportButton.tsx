/**
 * Job Report Button Component
 * ===========================
 * 
 * Phase 2: Task 2.3
 * 
 * Button component for downloading job completion reports.
 * Displays loading state and handles errors gracefully.
 */

'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JobReportButtonProps {
    jobId: string;
    jobNumber?: string;
    jobStatus?: string;
    variant?: 'default' | 'compact' | 'icon-only';
    className?: string;
}

export function JobReportButton({
    jobId,
    jobNumber,
    jobStatus,
    variant = 'default',
    className,
}: JobReportButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isCompleted = jobStatus === 'COMPLETED';

    const handleDownload = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/jobs/${jobId}/report?format=pdf`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al descargar el reporte');
            }

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
            const filename = filenameMatch?.[1] || `reporte-trabajo-${jobNumber || jobId}.pdf`;

            // Create blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading report:', err);
            setError(err instanceof Error ? err.message : 'Error al descargar');
        } finally {
            setIsLoading(false);
        }
    };

    // Icon-only variant (for tight spaces)
    if (variant === 'icon-only') {
        return (
            <button
                onClick={handleDownload}
                disabled={isLoading}
                title={isCompleted ? 'Descargar Reporte de Trabajo' : 'Descargar Reporte (preliminar)'}
                className={cn(
                    'inline-flex items-center justify-center p-2 rounded-lg transition-colors',
                    'hover:bg-gray-100 text-gray-600 hover:text-gray-900',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    className
                )}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <FileText className="h-4 w-4" />
                )}
            </button>
        );
    }

    // Compact variant (smaller button with icon + short text)
    if (variant === 'compact') {
        return (
            <button
                onClick={handleDownload}
                disabled={isLoading}
                className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
                    'border border-gray-200 bg-white hover:bg-gray-50',
                    'text-gray-700 hover:text-gray-900',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    className
                )}
            >
                {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Download className="h-3.5 w-3.5" />
                )}
                Reporte
            </button>
        );
    }

    // Default variant (full button with icon, text, and status awareness)
    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={handleDownload}
                disabled={isLoading}
                className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                    isCompleted
                        ? 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 hover:border-teal-300'
                        : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    className
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generando...</span>
                    </>
                ) : (
                    <>
                        <FileText className="h-4 w-4" />
                        <span>Descargar Reporte</span>
                        <Download className="h-3.5 w-3.5 ml-1 opacity-60" />
                    </>
                )}
            </button>

            {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{error}</span>
                </div>
            )}

            {!isCompleted && !error && (
                <p className="text-xs text-gray-400 pl-1">
                    El reporte se completará cuando finalice el trabajo
                </p>
            )}
        </div>
    );
}

// Export a simple inline link version for use in tables/lists
export function JobReportLink({
    jobId,
    jobNumber,
    className,
}: {
    jobId: string;
    jobNumber?: string;
    className?: string;
}) {
    return (
        <a
            href={`/api/jobs/${jobId}/report?format=pdf`}
            download={`reporte-trabajo-${jobNumber || jobId}.pdf`}
            className={cn(
                'inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 hover:underline',
                className
            )}
        >
            <FileText className="h-3.5 w-3.5" />
            <span>Descargar reporte</span>
        </a>
    );
}
