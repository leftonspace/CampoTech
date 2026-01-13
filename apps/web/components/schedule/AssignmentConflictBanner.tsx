'use client';

/**
 * Assignment Conflict Banner
 * Displays inline warnings when assigning technicians with scheduling conflicts
 * Includes actionable buttons to resolve conflicts
 */

import { AlertTriangle, Clock, CalendarX, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationWarning } from '@/hooks/useAssignmentValidation';

interface ConflictAction {
    type: 'change_date' | 'remove_technician' | 'modify_exception' | 'modify_schedule';
    label: string;
}

interface AssignmentConflictBannerProps {
    warnings: ValidationWarning[];
    isLoading?: boolean;
    onAction: (action: ConflictAction['type'], warning: ValidationWarning) => void;
    className?: string;
}

const WARNING_ICONS: Record<ValidationWarning['type'], typeof AlertTriangle> = {
    advance_notice: Clock,
    outside_availability: AlertTriangle,
    day_off: CalendarX,
    exception: CalendarX,
};

const WARNING_COLORS: Record<ValidationWarning['type'], string> = {
    advance_notice: 'border-amber-200 bg-amber-50',
    outside_availability: 'border-orange-200 bg-orange-50',
    day_off: 'border-red-200 bg-red-50',
    exception: 'border-purple-200 bg-purple-50',
};

const ICON_COLORS: Record<ValidationWarning['type'], string> = {
    advance_notice: 'text-amber-600',
    outside_availability: 'text-orange-600',
    day_off: 'text-red-600',
    exception: 'text-purple-600',
};

// Get available actions based on warning type
function getActionsForWarning(warning: ValidationWarning): ConflictAction[] {
    const actions: ConflictAction[] = [];

    // Always offer changing date
    actions.push({ type: 'change_date', label: 'Cambiar fecha' });

    // Exception-specific actions
    if (warning.type === 'exception') {
        actions.push({ type: 'modify_exception', label: 'Modificar excepción' });
    }

    // On-call specific actions
    if (warning.type === 'advance_notice' || warning.type === 'day_off' || warning.type === 'outside_availability') {
        if (warning.details.scheduleType === 'ondemand') {
            actions.push({ type: 'modify_schedule', label: 'Modificar horario' });
        }
    }

    // Always offer removing technician
    actions.push({ type: 'remove_technician', label: 'Quitar técnico' });

    return actions;
}

export function AssignmentConflictBanner({
    warnings,
    isLoading = false,
    onAction,
    className,
}: AssignmentConflictBannerProps) {
    if (warnings.length === 0) return null;

    return (
        <div className={cn("space-y-2", className)}>
            {warnings.map((warning, index) => {
                const Icon = WARNING_ICONS[warning.type];
                const colorClass = WARNING_COLORS[warning.type];
                const iconColor = ICON_COLORS[warning.type];
                const actions = getActionsForWarning(warning);

                return (
                    <div
                        key={`${warning.details.technicianId}-${warning.type}-${index}`}
                        className={cn(
                            "rounded-lg border p-3",
                            colorClass
                        )}
                    >
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={cn("mt-0.5", iconColor)}>
                                {isLoading ? (
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Icon className="h-5 w-5" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                {/* Message */}
                                <p className="text-sm font-medium text-gray-900">
                                    {warning.message}
                                </p>

                                {/* Additional details for exceptions */}
                                {warning.type === 'exception' && warning.details.exceptionStartTime && (
                                    <p className="text-xs text-gray-600 mt-0.5">
                                        Horario: {warning.details.exceptionStartTime} - {warning.details.exceptionEndTime}
                                    </p>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {actions.map((action) => (
                                        <button
                                            key={action.type}
                                            onClick={() => onAction(action.type, warning)}
                                            disabled={isLoading}
                                            className={cn(
                                                "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                                                action.type === 'remove_technician'
                                                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
                                                "disabled:opacity-50 disabled:cursor-not-allowed"
                                            )}
                                        >
                                            {action.type === 'remove_technician' && <X className="h-3 w-3 inline mr-1" />}
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
