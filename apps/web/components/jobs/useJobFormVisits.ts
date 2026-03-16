'use client';

/**
 * useJobFormVisits — Shared Hook for Job Form Visit Management
 * =============================================================
 *
 * Extracted from NewJobModal and EditJobModal to eliminate duplication.
 * Manages visits state, conflict validation, vehicle defaults,
 * service types, customer search, and availability lookups.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ParsedAddress } from '@/components/ui/AddressAutocomplete';
import type { ValidationWarning } from '@/hooks/useAssignmentValidation';
import {
    type JobVisit,
    type Customer,
    createEmptyVisit,
    convertTo24h,
} from '@/components/jobs/job-form-shared';

// ─── Types ───────────────────────────────────────────────────────

export interface DefaultVehicleInfo {
    vehicle: { id: string; plateNumber: string; make: string; model: string };
    matchType: 'permanent' | 'date_range' | 'recurring';
}

export interface ConflictModalData {
    isOpen: boolean;
    technicianId: string;
    technicianName: string;
    date: Date;
    visitId: string;
}

interface AvailableEmployee {
    id: string;
    name: string;
    isAvailable: boolean;
    currentJobCount: number;
}

interface UseJobFormVisitsOptions {
    isOpen: boolean;
    formData: { address: string; serviceType: string;[key: string]: unknown };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData: React.Dispatch<React.SetStateAction<any>>;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useJobFormVisits({ isOpen, formData: _formData, setFormData }: UseJobFormVisitsOptions) {
    const queryClient = useQueryClient();

    // ── Visit State ──────────────────────────────────────────────
    const [visits, setVisits] = useState<JobVisit[]>([createEmptyVisit()]);
    const [activeVisitDropdown, setActiveVisitDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ── Vehicle Assignment State ─────────────────────────────────
    const [vehicleAssignmentVisitId, setVehicleAssignmentVisitId] = useState<string | null>(null);
    const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

    // ── Default Vehicles (from VehicleSchedule) ──────────────────
    const [defaultVehicles, setDefaultVehicles] = useState<Record<string, DefaultVehicleInfo | null>>({});
    const fetchedTechIdsRef = useRef<Set<string>>(new Set());

    // ── Conflict Tracking ────────────────────────────────────────
    const [visitConflicts, setVisitConflicts] = useState<Record<string, ValidationWarning[]>>({});
    const [isValidatingConflicts, setIsValidatingConflicts] = useState(false);
    const [conflictModalData, setConflictModalData] = useState<ConflictModalData | null>(null);

    // ── Customer State ───────────────────────────────────────────
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [useCustomerAddress, setUseCustomerAddress] = useState(true);

    // ── Service Type State ───────────────────────────────────────
    const [showCreateServiceType, setShowCreateServiceType] = useState(false);
    const [newServiceTypeName, setNewServiceTypeName] = useState('');
    const [isCreatingServiceType, setIsCreatingServiceType] = useState(false);

    // ── New Customer Modal ───────────────────────────────────────
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

    // ── Description Expand ───────────────────────────────────────
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const descriptionRef = useRef<HTMLDivElement>(null);

    // ── Error State ──────────────────────────────────────────────
    const [error, setError] = useState('');

    // ─── Visit Management Functions ──────────────────────────────

    const addVisit = useCallback(() => {
        setVisits(prev => [...prev, createEmptyVisit()]);
    }, []);

    const removeVisit = useCallback((visitId: string) => {
        setVisits(prev => prev.length > 1 ? prev.filter(v => v.id !== visitId) : prev);
    }, []);

    const updateVisit = useCallback((
        visitId: string,
        field: keyof JobVisit,
        value: string | string[] | boolean | number | null | { vehicleId: string; driverIds: string[] }[]
    ) => {
        setVisits(prev => prev.map(v =>
            v.id === visitId ? { ...v, [field]: value } : v
        ));
    }, []);

    const toggleVisitTechnician = useCallback((visitId: string, techId: string) => {
        setVisits(prev => prev.map(v => {
            if (v.id !== visitId) return v;
            const isSelected = v.technicianIds.includes(techId);
            return {
                ...v,
                technicianIds: isSelected
                    ? v.technicianIds.filter(id => id !== techId)
                    : [...v.technicianIds, techId]
            };
        }));
    }, []);

    // ─── Conflict Validation ─────────────────────────────────────

    const validateVisitAssignments = useCallback(async (visit: JobVisit) => {
        if (!visit.date || visit.technicianIds.length === 0) {
            setVisitConflicts(prev => ({ ...prev, [visit.id]: [] }));
            return;
        }

        setIsValidatingConflicts(true);
        const allWarnings: ValidationWarning[] = [];

        // Helper to convert 12h to 24h format
        const to24h = (time: string, period: 'AM' | 'PM'): string | null => {
            if (!time) return null;
            const hour = parseInt(time.split(':')[0]);
            const min = time.split(':')[1] || '00';
            let h24 = hour;
            if (period === 'PM' && hour !== 12) h24 = hour + 12;
            if (period === 'AM' && hour === 12) h24 = 0;
            return `${h24}:${min}`;
        };

        const timeStart = to24h(visit.timeStart, visit.timePeriodStart);
        const timeEnd = to24h(visit.timeEnd, visit.timePeriodEnd);

        for (const techId of visit.technicianIds) {
            try {
                const response = await fetch('/api/employees/schedule/validate-assignment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        technicianId: techId,
                        scheduledDate: visit.date,
                        scheduledTimeStart: timeStart,
                        scheduledTimeEnd: timeEnd,
                    }),
                });
                const data = await response.json();
                if (data.success && data.data?.warnings) {
                    allWarnings.push(...data.data.warnings);
                }
            } catch (error) {
                console.error('Error validating technician:', error);
            }
        }

        setVisitConflicts(prev => ({ ...prev, [visit.id]: allWarnings }));
        setIsValidatingConflicts(false);
    }, []);

    // Re-validate when visits change (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            visits.forEach(visit => {
                if (visit.date && visit.technicianIds.length > 0) {
                    validateVisitAssignments(visit);
                }
            });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [visits, validateVisitAssignments]);

    // Check if any visit has unresolved conflicts
    const hasUnresolvedConflicts = Object.values(visitConflicts).some(warnings => warnings.length > 0);

    // Handle conflict action
    const handleConflictAction = useCallback((
        action: 'change_date' | 'remove_technician' | 'modify_exception' | 'modify_schedule',
        warning: ValidationWarning,
        visitId: string
    ) => {
        if (action === 'remove_technician') {
            toggleVisitTechnician(visitId, warning.details.technicianId);
        } else if (action === 'modify_exception' && warning.details.exceptionDate) {
            setConflictModalData({
                isOpen: true,
                technicianId: warning.details.technicianId,
                technicianName: warning.details.technicianName,
                date: new Date(warning.details.exceptionDate),
                visitId,
            });
        } else if (action === 'change_date') {
            const dateInput = document.querySelector(`input[type="date"]`) as HTMLInputElement;
            if (dateInput) {
                dateInput.focus();
                dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (action === 'modify_schedule') {
            window.open(`/dashboard/team?employee=${warning.details.technicianId}&tab=schedule`, '_blank');
        }
    }, [toggleVisitTechnician]);

    // ─── Close Dropdown on Outside Click ─────────────────────────

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveVisitDropdown(null);
            }
        };

        if (activeVisitDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeVisitDropdown]);

    // ─── Default Vehicles Fetch ──────────────────────────────────

    useEffect(() => {
        const fetchDefaultVehicles = async () => {
            const techsToFetch: { techId: string; date: string }[] = [];

            for (const visit of visits) {
                if (!visit.date || visit.technicianIds.length === 0) continue;

                for (const techId of visit.technicianIds) {
                    if (techsToFetch.some(t => t.techId === techId)) continue;
                    if (fetchedTechIdsRef.current.has(techId)) continue;
                    const hasExplicitVehicle = visit.vehicleAssignments.some(
                        va => va.driverIds && va.driverIds.includes(techId)
                    );
                    if (hasExplicitVehicle) continue;

                    techsToFetch.push({ techId, date: visit.date });
                }
            }

            if (techsToFetch.length === 0) return;

            // Mark as fetched immediately to prevent duplicate requests
            for (const { techId } of techsToFetch) {
                fetchedTechIdsRef.current.add(techId);
            }

            const results = await Promise.all(
                techsToFetch.map(async ({ techId, date }) => {
                    try {
                        const response = await fetch(
                            `/api/scheduling/vehicle-for-job?technicianId=${techId}&date=${date}`
                        );
                        if (response.ok) {
                            const result = await response.json();
                            if (result.success && result.vehicle) {
                                return {
                                    techId,
                                    data: {
                                        vehicle: {
                                            id: result.vehicle.id,
                                            plateNumber: result.vehicle.plateNumber,
                                            make: result.vehicle.make,
                                            model: result.vehicle.model,
                                        },
                                        matchType: result.matchType as 'permanent' | 'date_range' | 'recurring',
                                    } as DefaultVehicleInfo,
                                };
                            }
                        }
                        return { techId, data: null };
                    } catch (err) {
                        console.error('[JobForm] Error fetching default vehicle for technician:', techId, err);
                        return { techId, data: null };
                    }
                })
            );

            const newDefaults: Record<string, DefaultVehicleInfo | null> = {};
            for (const result of results) {
                newDefaults[result.techId] = result.data;
            }

            if (Object.keys(newDefaults).length > 0) {
                setDefaultVehicles(prev => ({ ...prev, ...newDefaults }));
            }
        };

        fetchDefaultVehicles();
    }, [visits]); // Removed defaultVehicles dependency — using ref instead to prevent re-render loop

    // ─── Vehicles Query ──────────────────────────────────────────

    const { data: vehiclesData } = useQuery({
        queryKey: ['vehicles-for-job'],
        queryFn: async () => {
            const response = await fetch('/api/vehicles');
            if (!response.ok) throw new Error('Failed to fetch vehicles');
            const data = await response.json();
            return data.data?.vehicles || [];
        },
        enabled: isOpen,
        staleTime: 1000 * 60 * 5,
    });

    // ─── Service Types ───────────────────────────────────────────

    const { data: serviceTypesData } = useQuery({
        queryKey: ['service-types'],
        queryFn: async () => {
            const res = await fetch('/api/settings/service-types');
            return res.json();
        },
    });

    const businessServiceTypes = serviceTypesData?.data?.map((st: { code: string; name: string }) => ({
        value: st.code,
        label: st.name,
    })) || [];

    const hasOtro = businessServiceTypes.some((st: { value: string }) => st.value === 'OTRO');
    const SERVICE_TYPES = hasOtro
        ? businessServiceTypes
        : [...businessServiceTypes, { value: 'OTRO', label: 'Otro' }];

    const handleCreateServiceType = useCallback(async () => {
        if (!newServiceTypeName.trim()) return;

        setIsCreatingServiceType(true);
        try {
            const res = await fetch('/api/settings/service-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: newServiceTypeName.toUpperCase().replace(/\s+/g, '_'),
                    name: newServiceTypeName.trim(),
                }),
            });
            const data = await res.json();

            if (data.success) {
                await queryClient.invalidateQueries({ queryKey: ['service-types'] });
                setFormData((prev: Record<string, unknown>) => ({ ...prev, serviceType: data.data.code }));
                setShowCreateServiceType(false);
                setNewServiceTypeName('');
            } else {
                setError(data.error || 'Error creando tipo de servicio');
            }
        } catch (_err) {
            setError('Error creando tipo de servicio');
        } finally {
            setIsCreatingServiceType(false);
        }
    }, [newServiceTypeName, queryClient, setFormData]);

    // ─── Customer Search ─────────────────────────────────────────

    const { data: customersData } = useQuery({
        queryKey: ['customers-search', customerSearch],
        queryFn: () => api.customers.search(customerSearch),
        enabled: customerSearch.length > 2 && !selectedCustomer,
    });

    const customers = customersData?.data as Customer[] | undefined;

    // Auto-fill address when customer is selected
    useEffect(() => {
        if (selectedCustomer && useCustomerAddress) {
            const customerAddress = selectedCustomer.address;
            if (customerAddress) {
                const addressString = customerAddress.fullAddress ||
                    [customerAddress.street, customerAddress.city, customerAddress.state, customerAddress.postalCode]
                        .filter(Boolean)
                        .join(', ');
                setFormData((prev: Record<string, unknown>) => ({ ...prev, address: addressString }));
            }
        }
    }, [selectedCustomer, useCustomerAddress, setFormData]);

    const handleAddressSelect = useCallback((parsed: ParsedAddress) => {
        setFormData((prev: Record<string, unknown>) => ({ ...prev, address: parsed.fullAddress }));
        setUseCustomerAddress(false);
    }, [setFormData]);

    // ─── Team Members & Availability ─────────────────────────────

    const { data: usersData } = useQuery({
        queryKey: ['users-all'],
        queryFn: () => api.users.list(),
    });

    const teamMembers = usersData?.data as Array<{ id: string; name: string; role: string }> | undefined;

    const firstVisit = visits[0];
    const { data: availabilityData } = useQuery({
        queryKey: ['employee-availability', firstVisit?.date, convertTo24h(firstVisit?.timeStart || '', firstVisit?.timePeriodStart || 'AM')],
        queryFn: async () => {
            const params = new URLSearchParams({ date: firstVisit?.date || '' });
            const timeStr = convertTo24h(firstVisit?.timeStart || '', firstVisit?.timePeriodStart || 'AM');
            if (timeStr) params.append('time', timeStr);
            const res = await fetch(`/api/employees/availability?${params}`);
            return res.json();
        },
        enabled: !!firstVisit?.date,
    });

    const availabilityMap = new Map<string, AvailableEmployee>();
    if (availabilityData?.data?.employees) {
        (availabilityData.data.employees as AvailableEmployee[]).forEach((emp) => {
            availabilityMap.set(emp.id, emp);
        });
    }

    // ─── Reset Function ──────────────────────────────────────────

    const resetVisitState = useCallback(() => {
        setVisits([createEmptyVisit()]);
        setVisitConflicts({});
        setVehicleAssignmentVisitId(null);
        setSelectedDriverIds([]);
        setSelectedVehicleId('');
        setDefaultVehicles({});
        fetchedTechIdsRef.current.clear();
        setCustomerSearch('');
        setSelectedCustomer(null);
        setUseCustomerAddress(true);
        setShowCreateServiceType(false);
        setNewServiceTypeName('');
        setIsDescriptionExpanded(false);
        setError('');
        setShowNewCustomerModal(false);
    }, []);

    // ─── Return ──────────────────────────────────────────────────

    return {
        // Visit state
        visits,
        setVisits,
        activeVisitDropdown,
        setActiveVisitDropdown,
        dropdownRef,

        // Visit functions
        addVisit,
        removeVisit,
        updateVisit,
        toggleVisitTechnician,

        // Vehicle assignment
        vehicleAssignmentVisitId,
        setVehicleAssignmentVisitId,
        selectedDriverIds,
        setSelectedDriverIds,
        selectedVehicleId,
        setSelectedVehicleId,
        defaultVehicles,
        setDefaultVehicles,
        vehiclesData,

        // Conflict tracking
        visitConflicts,
        setVisitConflicts,
        isValidatingConflicts,
        hasUnresolvedConflicts,
        handleConflictAction,
        conflictModalData,
        setConflictModalData,
        validateVisitAssignments,

        // Customer
        customerSearch,
        setCustomerSearch,
        selectedCustomer,
        setSelectedCustomer,
        useCustomerAddress,
        setUseCustomerAddress,
        customers,
        showNewCustomerModal,
        setShowNewCustomerModal,
        handleAddressSelect,

        // Service types
        SERVICE_TYPES,
        showCreateServiceType,
        setShowCreateServiceType,
        newServiceTypeName,
        setNewServiceTypeName,
        isCreatingServiceType,
        handleCreateServiceType,

        // Description
        isDescriptionExpanded,
        setIsDescriptionExpanded,
        descriptionRef,

        // Team & availability
        teamMembers,
        availabilityMap,

        // Error
        error,
        setError,

        // Reset
        resetVisitState,
    };
}
