/**
 * Hook for validating technician job assignments
 * Checks on-call advance notice requirements and shows warnings
 */

import { useState, useCallback } from 'react';

interface ValidationWarning {
    type: 'advance_notice' | 'outside_availability' | 'day_off' | 'exception';
    message: string;
    details: {
        technicianId: string;
        technicianName: string;
        scheduleType: string;
        advanceNoticeRequired?: number;
        actualNoticeHours?: number;
        exceptionId?: string;
        exceptionReason?: string;
        exceptionDate?: string;
        exceptionStartTime?: string | null;
        exceptionEndTime?: string | null;
    };
}

interface ValidationResult {
    isValid: boolean;
    warnings: ValidationWarning[];
}

interface UseAssignmentValidationOptions {
    onWarning?: (warnings: ValidationWarning[]) => void;
}

export function useAssignmentValidation(options?: UseAssignmentValidationOptions) {
    const [isValidating, setIsValidating] = useState(false);
    const [lastResult, setLastResult] = useState<ValidationResult | null>(null);

    const validateAssignment = useCallback(async (
        technicianId: string,
        scheduledDate?: string | null,
        scheduledTimeStart?: string | null
    ): Promise<ValidationResult> => {
        if (!technicianId) {
            return { isValid: true, warnings: [] };
        }

        setIsValidating(true);
        try {
            const response = await fetch('/api/employees/schedule/validate-assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    technicianId,
                    scheduledDate,
                    scheduledTimeStart,
                }),
            });

            const data = await response.json();

            if (data.success && data.data) {
                const result = data.data as ValidationResult;
                setLastResult(result);

                if (result.warnings.length > 0 && options?.onWarning) {
                    options.onWarning(result.warnings);
                }

                return result;
            }

            return { isValid: true, warnings: [] };
        } catch (error) {
            console.error('Error validating assignment:', error);
            return { isValid: true, warnings: [] };
        } finally {
            setIsValidating(false);
        }
    }, [options]);

    const clearResult = useCallback(() => {
        setLastResult(null);
    }, []);

    return {
        validateAssignment,
        isValidating,
        lastResult,
        clearResult,
    };
}

export type { ValidationWarning, ValidationResult };
