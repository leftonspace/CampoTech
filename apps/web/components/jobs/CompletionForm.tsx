'use client';

/**
 * Job Completion Form Component
 * ==============================
 * 
 * Phase 3.2: Completion UI
 * 
 * This component renders the job completion form with:
 * - End mileage input (if vehicle assigned)
 * - Trip distance calculation
 * - Notes/resolution field
 * - Customer signature capture
 * - Photo upload
 * - Snapshot preview
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Truck,
    User,
    AlertTriangle,
    CheckCircle,
    Camera,
    FileText,
    Gauge,
    X,
} from 'lucide-react';

interface CompletionFormProps {
    jobId: string;
    onComplete: () => void;
    onCancel: () => void;
}

interface CompletionRequirements {
    job: {
        id: string;
        jobNumber: string;
        status: string;
        serviceType: string;
        description: string;
        startedAt: string | null;
        vehicleMileageStart: number | null;
    };
    vehicle: {
        id: string;
        plateNumber: string;
        make: string;
        model: string;
        currentMileage: number | null;
    } | null;
    technician: {
        id: string;
        name: string;
        driverLicenseNumber: string | null;
        driverLicenseExpiry: string | null;
        driverLicenseCategory: string | null;
    } | null;
    customer: {
        id: string;
        name: string;
        phone: string;
    } | null;
    requirements: {
        requiresMileage: boolean;
        minimumMileage: number;
        canComplete: boolean;
    };
    previewSnapshot: {
        vehiclePlate: string | null;
        driverName: string | null;
        driverLicense: string | null;
    };
}

export function CompletionForm({ jobId, onComplete, onCancel }: CompletionFormProps) {
    const queryClient = useQueryClient();
    const [mileageEnd, setMileageEnd] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [warnings, setWarnings] = useState<string[]>([]);
    const [showWarningConfirm, setShowWarningConfirm] = useState(false);

    // Fetch completion requirements
    const { data: reqData, isLoading } = useQuery({
        queryKey: ['job-completion-requirements', jobId],
        queryFn: async () => {
            const res = await fetch(`/api/jobs/${jobId}/complete`);
            return res.json();
        },
    });

    const requirements = reqData?.data as CompletionRequirements | undefined;

    // Set default mileage when data loads
    useEffect(() => {
        if (requirements?.requirements.minimumMileage) {
            setMileageEnd(requirements.requirements.minimumMileage.toString());
        }
    }, [requirements]);

    // Complete job mutation
    const completeMutation = useMutation({
        mutationFn: async (skipWarnings: boolean) => {
            const res = await fetch(`/api/jobs/${jobId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mileageEnd: mileageEnd ? parseInt(mileageEnd) : undefined,
                    notes: notes || undefined,
                    skipWarnings,
                }),
            });
            return res.json();
        },
        onSuccess: (data) => {
            if (data.requiresConfirmation) {
                // Show warnings for confirmation
                setWarnings(data.warnings);
                setShowWarningConfirm(true);
            } else if (data.success) {
                queryClient.invalidateQueries({ queryKey: ['job', jobId] });
                queryClient.invalidateQueries({ queryKey: ['jobs'] });
                onComplete();
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        completeMutation.mutate(false);
    };

    const handleConfirmWithWarnings = () => {
        completeMutation.mutate(true);
    };

    // Calculate trip distance
    const tripDistance = requirements?.job.vehicleMileageStart !== null && mileageEnd
        ? parseInt(mileageEnd) - (requirements?.job.vehicleMileageStart || 0)
        : null;

    // Check if mileage seems unusual
    const mileageWarning = tripDistance !== null && (tripDistance > 500 || tripDistance < 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
        );
    }

    if (!requirements) {
        return (
            <div className="p-6 text-center text-gray-500">
                Error al cargar los datos de completación
            </div>
        );
    }

    if (!requirements.requirements.canComplete) {
        return (
            <div className="p-6">
                <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 text-amber-800">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <p>Este trabajo no puede ser completado en su estado actual ({requirements.job.status})</p>
                </div>
            </div>
        );
    }

    // Warning confirmation modal
    if (showWarningConfirm && warnings.length > 0) {
        return (
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-amber-700">
                    <AlertTriangle className="h-6 w-6" />
                    <h3 className="text-lg font-semibold">Advertencias</h3>
                </div>

                <div className="space-y-2">
                    {warnings.map((warning, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{warning}</span>
                        </div>
                    ))}
                </div>

                <p className="text-gray-600">¿Desea completar el trabajo de todos modos?</p>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowWarningConfirm(false)}
                        className="btn-outline flex-1"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmWithWarnings}
                        disabled={completeMutation.isPending}
                        className="btn-primary flex-1"
                    >
                        {completeMutation.isPending ? 'Completando...' : 'Completar de todos modos'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
                Completar Trabajo {requirements.job.jobNumber}
            </h2>

            {/* Snapshot Preview */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 font-medium text-blue-800">
                    <Camera className="h-4 w-4" />
                    Datos que se guardarán para auditoría
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                        <span className="text-gray-600">Patente:</span>
                        <span className="font-medium text-gray-900">
                            {requirements.previewSnapshot.vehiclePlate || 'Sin vehículo'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="text-gray-600">Conductor:</span>
                        <span className="font-medium text-gray-900">
                            {requirements.previewSnapshot.driverName || 'Sin asignar'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-gray-600">Licencia:</span>
                        <span className="font-medium text-gray-900">
                            {requirements.previewSnapshot.driverLicense || (
                                <span className="text-amber-600">⚠️ No registrada</span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* Mileage Section */}
            {requirements.requirements.requiresMileage && (
                <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-medium text-gray-900">
                        <Gauge className="h-5 w-5" />
                        Kilometraje
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Start Mileage (read-only) */}
                        <div>
                            <label className="label mb-1 block text-sm">Km inicio</label>
                            <div className="input bg-gray-50 text-gray-600">
                                {requirements.job.vehicleMileageStart?.toLocaleString() || '-'} km
                            </div>
                        </div>

                        {/* End Mileage (editable) */}
                        <div>
                            <label className="label mb-1 block text-sm">Km final *</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={mileageEnd}
                                    onChange={(e) => setMileageEnd(e.target.value)}
                                    min={requirements.requirements.minimumMileage}
                                    placeholder={`Mínimo: ${requirements.requirements.minimumMileage}`}
                                    className={`input pr-10 ${mileageWarning ? 'border-amber-500 focus:ring-amber-500' : ''}`}
                                    required
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                    km
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Trip Distance */}
                    {tripDistance !== null && !mileageWarning && (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800">
                            <CheckCircle className="h-5 w-5" />
                            <span>
                                Distancia recorrida: <strong>{tripDistance.toLocaleString()} km</strong>
                            </span>
                        </div>
                    )}

                    {/* Mileage Warning */}
                    {mileageWarning && tripDistance !== null && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
                            <AlertTriangle className="h-5 w-5" />
                            <span>
                                {tripDistance < 0
                                    ? 'El kilometraje final no puede ser menor al inicial'
                                    : `Distancia inusual: ${tripDistance.toLocaleString()} km. Por favor verificar.`
                                }
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Notes */}
            <div>
                <label className="label mb-1 block">Notas de resolución</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Descripción del trabajo realizado, materiales usados, observaciones..."
                    className="input"
                />
            </div>

            {/* Error Display */}
            {completeMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800">
                    <X className="h-5 w-5" />
                    <span>{(completeMutation.error as Error)?.message || 'Error al completar'}</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn-outline flex-1"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={completeMutation.isPending || (mileageWarning && (tripDistance ?? 0) < 0)}
                    className="btn-primary flex-1"
                >
                    {completeMutation.isPending ? (
                        <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Completando...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Completar Trabajo
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
