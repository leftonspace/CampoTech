'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { Search, Calendar, Clock, Users, X, Check, Wrench, Repeat, Plus, Truck, MessageCircle, XCircle, Lock, DollarSign, CreditCard } from 'lucide-react';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import NewCustomerModal from '@/app/dashboard/customers/NewCustomerModal';
import { AssignmentConflictBanner } from '@/components/schedule/AssignmentConflictBanner';
import EmployeeDayModal from '@/components/schedule/EmployeeDayModal';
import { cn } from '@/lib/utils';
import { PricebookLineItems } from '@/components/jobs/PricebookLineItems';
import {

  RECURRENCE_PATTERNS,
  createEmptyVisit,
  expandDateRange,
  convertTo24h,
  parseTimeTo12h,
} from '@/components/jobs/job-form-shared';
import { useJobFormVisits } from '@/components/jobs/useJobFormVisits';

// EditJobModal-specific props
interface EditJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  jobId: string; // Required: the job to edit
}

export default function EditJobModal({
  isOpen,
  onClose,
  onSuccess,
  jobId,
}: EditJobModalProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobLoaded, setIsJobLoaded] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    serviceType: '',
    priority: 'normal',
    // Pricing fields (Phase 1.12)
    estimatedTotal: '',
    depositAmount: '',
    techProposedTotal: '',
    finalTotal: '',
    pricingLockedAt: null as string | null,
  });

  // ── Shared hook for visits, conflicts, vehicles, service types, customers, team ──
  const {
    visits, setVisits,
    activeVisitDropdown, setActiveVisitDropdown, dropdownRef,
    addVisit, removeVisit, updateVisit, toggleVisitTechnician,
    vehicleAssignmentVisitId, setVehicleAssignmentVisitId,
    selectedDriverIds, setSelectedDriverIds,
    selectedVehicleId, setSelectedVehicleId,
    defaultVehicles, setDefaultVehicles: _setDefaultVehicles, vehiclesData,
    visitConflicts, isValidatingConflicts, hasUnresolvedConflicts,
    handleConflictAction, conflictModalData, setConflictModalData,
    validateVisitAssignments,
    customerSearch, setCustomerSearch,
    selectedCustomer, setSelectedCustomer,
    useCustomerAddress: _useCustomerAddress, setUseCustomerAddress,
    customers, showNewCustomerModal, setShowNewCustomerModal,
    handleAddressSelect,
    SERVICE_TYPES, showCreateServiceType, setShowCreateServiceType,
    newServiceTypeName, setNewServiceTypeName, isCreatingServiceType,
    handleCreateServiceType,
    isDescriptionExpanded, setIsDescriptionExpanded, descriptionRef,
    teamMembers, availabilityMap: _availabilityMap,
    error, setError,
    resetVisitState,
  } = useJobFormVisits({ isOpen, formData, setFormData });

  // Reset state when modal opens (for new job edit)
  useEffect(() => {
    if (isOpen && jobId) {
      setIsJobLoaded(false);
      setFormData({
        title: '',
        description: '',
        address: '',
        serviceType: '',
        priority: 'normal',
        estimatedTotal: '',
        depositAmount: '',
        techProposedTotal: '',
        finalTotal: '',
        pricingLockedAt: null,
      });
      resetVisitState();
    }
  }, [isOpen, jobId, resetVisitState]);

  // Mount and animation effect
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Double requestAnimationFrame ensures the initial render is painted
      // before starting the animation - prevents janky transitions with cached data
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setIsJobLoaded(false);
    setFormData({
      title: '',
      description: '',
      address: '',
      serviceType: '',
      priority: 'normal',
      estimatedTotal: '',
      depositAmount: '',
      techProposedTotal: '',
      finalTotal: '',
      pricingLockedAt: null,
    });
    setSelectedCustomer(null);
    setVisits([createEmptyVisit()]);
    setError('');
    // Clear the cache for this specific job so fresh data is fetched next time
    queryClient.removeQueries({ queryKey: ['job-edit', jobId] });
    setTimeout(onClose, 300);
  };

  // Fetch the job data
  const { data: jobData, isLoading: isLoadingJob, error: jobError } = useQuery({
    queryKey: ['job-edit', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      return res.json();
    },
    enabled: !!jobId && isOpen,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = jobData?.data as any;
  const isLocked = job?.status === 'COMPLETED' || job?.status === 'CANCELLED';

  // Populate form when job data loads
  useEffect(() => {
    if (job && !isJobLoaded) {
      console.log('[EditJobModal] Job data received:', {
        jobId: job.id,
        assignments: job.assignments,
        visits: job.visits,
        technicianId: job.technicianId,
      });

      const desc = job.description || '';
      const separatorIndex = desc.indexOf('\n\n');
      const title = separatorIndex > 0 ? desc.substring(0, separatorIndex).trim() : desc.trim();
      const description = separatorIndex > 0 ? desc.substring(separatorIndex + 2).trim() : '';

      const urgencyToPriority: Record<string, string> = {
        NORMAL: 'normal',
        URGENTE: 'high',
      };

      setFormData({
        title,
        description,
        address: job.customer?.address?.fullAddress || '',
        serviceType: job.serviceType || '',
        priority: urgencyToPriority[job.urgency] || 'normal',
        estimatedTotal: job.estimatedTotal?.toString() || '',
        depositAmount: job.depositAmount?.toString() || '',
        techProposedTotal: job.techProposedTotal?.toString() || '',
        finalTotal: job.finalTotal?.toString() || '',
        pricingLockedAt: job.pricingLockedAt || null,
      });

      if (job.customer) {
        setSelectedCustomer({
          id: job.customer.id,
          name: job.customer.name,
          phone: job.customer.phone,
          address: job.customer.address,
        });
      }

      // Set visits from job data
      if (job.visits && job.visits.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allAssignedTechnicianIds: string[] = (job.assignments || []).map((a: any) => a.technicianId);
        console.log('[EditJobModal] All assigned technician IDs:', allAssignedTechnicianIds);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadedVisits = job.visits.map((v: any) => {
          const timeSlot = v.scheduledTimeSlot as { start?: string; end?: string } | null;
          const startParsed = parseTimeTo12h(timeSlot?.start);
          const endParsed = parseTimeTo12h(timeSlot?.end);

          const visitTechnicianIds = allAssignedTechnicianIds.length > 0
            ? allAssignedTechnicianIds
            : (v.technicianId ? [v.technicianId] : []);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vehicleAssignments = (v.vehicleAssignments || []).map((va: any) => ({
            vehicleId: va.vehicleId || va.vehicle?.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            driverIds: (va.drivers || []).map((d: any) => d.userId || d.user?.id),
          }));
          console.log('[EditJobModal] Visit vehicleAssignments raw:', v.vehicleAssignments);
          console.log('[EditJobModal] Visit vehicleAssignments parsed:', vehicleAssignments);

          return {
            id: v.id || Math.random().toString(36).substring(7),
            date: v.scheduledDate ? new Date(v.scheduledDate).toISOString().split('T')[0] : '',
            endDate: '',
            timeStart: startParsed.time,
            timeEnd: endParsed.time,
            timePeriodStart: startParsed.period,
            timePeriodEnd: endParsed.period,
            technicianIds: visitTechnicianIds,
            vehicleId: vehicleAssignments[0]?.vehicleId || null,
            vehicleAssignments: vehicleAssignments,
            isRecurring: false,
            recurrencePattern: 'MONTHLY',
            recurrenceCount: 6,
            estimatedPrice: v.estimatedPrice?.toString() || '',
            requiresDeposit: v.requiresDeposit || false,
            depositAmount: v.depositAmount?.toString() || '',
          };
        });
        setVisits(loadedVisits);
      } else if (job.scheduledDate) {
        // Legacy single-visit job
        const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
        const startParsed = parseTimeTo12h(timeSlot?.start);
        const endParsed = parseTimeTo12h(timeSlot?.end);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const technicianIds = (job.assignments || []).map((a: any) => a.technicianId);

        setVisits([{
          id: Math.random().toString(36).substring(7),
          date: new Date(job.scheduledDate).toISOString().split('T')[0],
          endDate: '',
          timeStart: startParsed.time,
          timeEnd: endParsed.time,
          timePeriodStart: startParsed.period,
          timePeriodEnd: endParsed.period,
          technicianIds: technicianIds.length > 0 ? technicianIds : (job.technicianId ? [job.technicianId] : []),
          vehicleId: job.vehicleId || null,
          vehicleAssignments: job.vehicleId ? [{ vehicleId: job.vehicleId, driverIds: [] }] : [],
          isRecurring: false,
          recurrencePattern: 'MONTHLY',
          recurrenceCount: 6,
          estimatedPrice: '',
          requiresDeposit: false,
          depositAmount: '',
        }]);
      }

      setIsJobLoaded(true);
    }
  }, [job, isJobLoaded, setSelectedCustomer, setVisits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError('Seleccioná un cliente');
      return;
    }

    // Validate at least the first visit has a date
    if (!visits[0].date) {
      setError('Seleccioná al menos una fecha para el trabajo');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Convert visits to API format, expanding date ranges and including recurrence
    // Include visitConfigIndex so the backend knows which expanded dates belong to the same "Visita" config
    // Include vehicleId for vehicle/driver tracking (Phase 2.1)
    const formattedVisits: Array<{
      date: string;
      timeStart: string;
      timeEnd: string;
      technicianIds: string[];
      vehicleId: string | null;
      visitConfigIndex: number; // Which "Visita" block this came from (1, 2, 3...)
      isRecurring?: boolean;
      recurrencePattern?: string;
      recurrenceCount?: number;
    }> = [];

    visits
      .filter(v => v.date) // Only include visits with dates
      .forEach((v, configIdx) => {
        const visitConfigIndex = configIdx + 1; // 1-based index for the original "Visita" config
        const timeStart = convertTo24h(v.timeStart, v.timePeriodStart);
        const timeEnd = convertTo24h(v.timeEnd, v.timePeriodEnd);
        const technicianIds = v.technicianIds;
        const vehicleId = v.vehicleId || null;
        const recurrenceInfo = v.isRecurring ? {
          isRecurring: true,
          recurrencePattern: v.recurrencePattern,
          recurrenceCount: v.recurrenceCount,
        } : {};

        // If there's an end date, expand to individual visits for each day
        // All expanded dates share the same visitConfigIndex and vehicleId
        if (v.endDate && v.endDate !== v.date) {
          const dates = expandDateRange(v.date, v.endDate);
          dates.forEach(date => {
            formattedVisits.push({ date, timeStart, timeEnd, technicianIds, vehicleId, visitConfigIndex, ...recurrenceInfo });
          });
        } else {
          // Single date visit
          formattedVisits.push({ date: v.date, timeStart, timeEnd, technicianIds, vehicleId, visitConfigIndex, ...recurrenceInfo });
        }
      });

    // Check if any visit has recurrence
    const hasRecurringVisits = visits.some(v => v.isRecurring);

    // Determine duration type based on visits
    let durationType = 'SINGLE_VISIT';
    if (hasRecurringVisits) {
      durationType = 'RECURRING';
    } else if (formattedVisits.length > 1) {
      durationType = 'MULTIPLE_VISITS';
    }

    // Map priority to urgency for API (schema only has NORMAL and URGENTE)
    const priorityToUrgency: Record<string, string> = {
      low: 'NORMAL',
      normal: 'NORMAL',
      high: 'URGENTE',
      urgent: 'URGENTE',
    };

    // Valid service type enum values (database constraint)
    const validServiceTypes = [
      'INSTALACION_SPLIT', 'REPARACION_SPLIT', 'MANTENIMIENTO_SPLIT',
      'INSTALACION_CALEFACTOR', 'REPARACION_CALEFACTOR', 'MANTENIMIENTO_CALEFACTOR',
      'OTRO'
    ];
    // Default to OTRO if custom service type isn't in the enum
    const serviceType = validServiceTypes.includes(formData.serviceType)
      ? formData.serviceType
      : 'OTRO';

    // Build job data with correct field names for API
    // Combine title into description if both exist
    const fullDescription = formData.title
      ? (formData.description ? `${formData.title}\n\n${formData.description}` : formData.title)
      : formData.description;

    const jobData = {
      description: fullDescription || 'Sin descripción',
      serviceType: serviceType,
      urgency: priorityToUrgency[formData.priority] || 'NORMAL',
      customerId: selectedCustomer.id,
      durationType,
      // First visit data for backwards compatibility
      scheduledDate: formattedVisits[0].date,
      scheduledTimeSlot: formattedVisits[0].timeStart || formattedVisits[0].timeEnd
        ? { start: formattedVisits[0].timeStart || '', end: formattedVisits[0].timeEnd || '' }
        : null,
      technicianIds: formattedVisits[0].technicianIds,
      // Vehicle for this job (Phase 2.1)
      vehicleId: formattedVisits[0].vehicleId,
      // All visits for multi-visit jobs (now includes per-visit recurrence and vehicleId)
      visits: formattedVisits,
    };

    // Use PUT to update the job
    const response = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    const result = await response.json();

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['job-edit', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onSuccess?.();
      handleClose();
    } else {
      setError(result.error || 'Error al guardar el trabajo');
    }

    setIsSubmitting(false);
  };

  // Don't render until mounted (SSR safety)
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-out',
        isVisible ? 'bg-black/60' : 'bg-transparent pointer-events-none'
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-xl w-full max-w-4xl transform transition-all duration-300 ease-out overflow-hidden',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable content wrapper */}
        <div className="max-h-[92vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between py-2 px-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Editar Trabajo</h1>
                {job && (
                  <p className="text-sm text-gray-500">
                    Trabajo-{job.jobNumber?.replace('JOB-', '')}
                    {isLocked && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                        <Lock className="h-3 w-3" /> Bloqueado
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Loading state */}
          {isLoadingJob ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Cargando trabajo...</p>
            </div>
          ) : jobError ? (
            <div className="p-8 text-center text-red-500">
              Error al cargar el trabajo. Por favor, intentá de nuevo.
            </div>
          ) : (

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Row 1: Título del trabajo | Cliente */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1 h-5">
                    <label htmlFor="title" className="label">
                      Título del trabajo *
                    </label>
                  </div>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Instalación de aire acondicionado"
                    className={cn('input', isLocked && 'cursor-not-allowed bg-gray-100')}
                    required
                    disabled={isLocked}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el título del trabajo')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  />
                </div>

                {/* Customer selection */}
                <div>
                  <div className="flex items-center justify-between mb-1 h-5">
                    <label className="label">Cliente *</label>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => setShowNewCustomerModal(true)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        + Crear nuevo cliente
                      </button>
                    )}
                  </div>
                  {selectedCustomer ? (
                    <div className={cn('input flex items-center justify-between bg-gray-50', isLocked && 'cursor-not-allowed')}>
                      <span className="font-medium truncate">{selectedCustomer.name}</span>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-sm text-primary-600 hover:underline flex-shrink-0 ml-2"
                        >
                          Cambiar
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Buscar cliente por nombre o teléfono..."
                        className={cn('input pl-10', isLocked && 'cursor-not-allowed bg-gray-100')}
                        disabled={isLocked}
                      />
                      {customers && customers.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
                          {customers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerSearch('');
                                setUseCustomerAddress(true);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
                            >
                              <span className="font-medium">{customer.name}</span>
                              <span className="text-sm text-gray-500">{customer.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Tipo de servicio | Dirección del servicio */}
              <div className="grid gap-4 lg:grid-cols-2 items-start">
                {/* Service Type */}
                <div>
                  <div className="flex items-center justify-between mb-1 h-5">
                    <label htmlFor="serviceType" className="label">
                      Tipo de servicio *
                    </label>
                    {!showCreateServiceType && !isLocked && (
                      <button
                        type="button"
                        onClick={() => setShowCreateServiceType(true)}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        Crear nuevo
                      </button>
                    )}
                  </div>
                  {!showCreateServiceType ? (
                    <div className="relative">
                      <Wrench className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <select
                        id="serviceType"
                        value={formData.serviceType}
                        onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                        className={cn('input pl-10', isLocked && 'cursor-not-allowed bg-gray-100')}
                        required
                        disabled={isLocked}
                        onInvalid={(e) => (e.target as HTMLSelectElement).setCustomValidity('Por favor, seleccioná un tipo de servicio')}
                        onInput={(e) => (e.target as HTMLSelectElement).setCustomValidity('')}
                      >
                        <option value="">Seleccionar tipo de servicio...</option>
                        {SERVICE_TYPES.map((type: { value: string; label: string }) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4">
                      <h4 className="mb-3 font-medium text-gray-900">Nuevo tipo de servicio</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newServiceTypeName}
                          onChange={(e) => setNewServiceTypeName(e.target.value)}
                          placeholder="Ej: Instalación de termotanque"
                          className="input flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleCreateServiceType}
                          disabled={isCreatingServiceType || !newServiceTypeName.trim()}
                          className="btn-primary px-4"
                        >
                          {isCreatingServiceType ? 'Creando...' : 'Crear'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateServiceType(false);
                            setNewServiceTypeName('');
                          }}
                          className="btn-outline px-4"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Este tipo de servicio quedará guardado para futuros trabajos
                      </p>
                    </div>
                  )}
                </div>

                {/* Address with Google Places Autocomplete */}
                <div>
                  <div className="flex items-center justify-between mb-1 h-5">
                    <label htmlFor="address" className="label">
                      Dirección del servicio *
                    </label>
                  </div>

                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => {
                      setFormData({ ...formData, address: value });
                      if (value !== '') setUseCustomerAddress(false);
                    }}
                    onSelect={handleAddressSelect}
                    placeholder={selectedCustomer ? "Buscar otra dirección..." : "Buscar dirección del servicio..."}
                    defaultCountry="AR"
                    required
                    disabled={isLocked}
                  />
                </div>
              </div>

              {/* Row 3: Descripción | Prioridad */}
              <div className="grid gap-4 lg:grid-cols-2 items-start">
                {/* Description - click to expand overlay */}
                <div className="relative">
                  <label htmlFor="description" className="label mb-1 block">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalles adicionales del trabajo..."
                    onClick={() => !isLocked && setIsDescriptionExpanded(true)}
                    readOnly={isDescriptionExpanded}
                    rows={2}
                    className={cn(
                      "input resize-none cursor-pointer",
                      isDescriptionExpanded && "ring-2 ring-primary-300"
                    )}
                    disabled={isLocked}
                  />
                  {/* Expanded overlay - positioned below the input */}
                  {isDescriptionExpanded && (
                    <div
                      ref={descriptionRef}
                      className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-xl border border-primary-200 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detalles adicionales del trabajo..."
                        autoFocus
                        onBlur={() => {
                          setTimeout(() => {
                            if (!descriptionRef.current?.contains(document.activeElement)) {
                              setIsDescriptionExpanded(false);
                            }
                          }, 100);
                        }}
                        rows={6}
                        className="w-full p-3 rounded-lg border-0 focus:outline-none focus:ring-0 resize-none"
                        disabled={isLocked}
                      />
                      <div className="flex justify-end px-3 pb-2">
                        <button
                          type="button"
                          onClick={() => setIsDescriptionExpanded(false)}
                          className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          Listo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label htmlFor="priority" className="label mb-1 block">
                    Prioridad
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input"
                    disabled={isLocked}
                  >
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Pricing Section (Phase 1.12) - Display pricing information */}
              <div className="rounded-lg border border-green-100 bg-green-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Información de Precios</span>
                  </div>
                  {formData.pricingLockedAt && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      <Lock className="h-3 w-3" />
                      <span>Precios bloqueados</span>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="label mb-1 block text-xs text-gray-500">Total Estimado</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.estimatedTotal}
                        onChange={(e) => setFormData({ ...formData, estimatedTotal: e.target.value })}
                        placeholder="0"
                        className="input pl-8 text-sm"
                        disabled={isLocked || !!formData.pricingLockedAt}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs text-gray-500">Seña Recibida</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.depositAmount}
                        onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                        placeholder="0"
                        className="input pl-10 text-sm"
                        disabled={isLocked || !!formData.pricingLockedAt}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs text-gray-500">Propuesto por Técnico</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.techProposedTotal}
                        readOnly
                        placeholder="-"
                        className="input pl-8 text-sm bg-gray-50"
                        disabled
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs text-gray-500">Total Final</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.finalTotal}
                        onChange={(e) => setFormData({ ...formData, finalTotal: e.target.value })}
                        placeholder="0"
                        className="input pl-8 text-sm font-semibold"
                        disabled={isLocked || !!formData.pricingLockedAt}
                      />
                    </div>
                  </div>
                </div>
                {formData.estimatedTotal && formData.depositAmount && (
                  <p className="text-xs text-gray-500">
                    Saldo pendiente: ${(parseFloat(formData.estimatedTotal || '0') - parseFloat(formData.depositAmount || '0')).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </p>
                )}
              </div>

              {/* Pricebook Line Items - Add services/products after diagnosis */}
              <PricebookLineItems
                jobId={jobId}
                isLocked={isLocked || !!formData.pricingLockedAt}
                className="rounded-lg border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-4"
              />

              {/* Visits Section - Multi-visit support */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="label">Programación de visitas *</label>
                  {visits.length === 1 && (
                    <span className="text-xs text-gray-500">Agregá más visitas si el trabajo tiene múltiples fechas</span>
                  )}
                </div>

                {visits.map((visit, index) => (
                  <div
                    key={visit.id}
                    className="rounded-lg border border-primary-200 bg-primary-50/30 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {visits.length === 1 ? 'Fecha y hora' : `Visita ${index + 1}`}
                      </h4>
                      {visits.length > 1 && !isLocked && (
                        <button
                          type="button"
                          onClick={() => removeVisit(visit.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    {/* Date / Date Range */}
                    <div className="grid gap-3 sm:grid-cols-2 mb-3">
                      <div>
                        <label className="label mb-1 block text-sm">Fecha inicio {index === 0 && '*'}</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="date"
                            value={visit.date}
                            onChange={(e) => updateVisit(visit.id, 'date', e.target.value)}
                            className={cn('input pl-10', isLocked && 'cursor-not-allowed bg-gray-100')}
                            required={index === 0}
                            disabled={isLocked}
                            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, seleccioná una fecha de inicio')}
                            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label mb-1 block text-sm">
                          Fecha fin <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="date"
                            value={visit.endDate}
                            onChange={(e) => updateVisit(visit.id, 'endDate', e.target.value)}
                            min={visit.date || undefined}
                            className={cn('input pl-10', isLocked && 'cursor-not-allowed bg-gray-100')}
                            placeholder="Mismo día"
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Time inputs */}
                    <div className="grid gap-3 sm:grid-cols-2 mb-3">
                      <div>
                        <label className="label mb-1 block text-sm">Hora inicio</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="9:00"
                              value={visit.timeStart}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
                                updateVisit(visit.id, 'timeStart', val);
                              }}
                              className={cn('input pl-10', isLocked && 'cursor-not-allowed bg-gray-100')}
                              maxLength={5}
                              disabled={isLocked}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => !isLocked && updateVisit(visit.id, 'timePeriodStart', visit.timePeriodStart === 'AM' ? 'PM' : 'AM')}
                            className={cn(
                              'flex h-[42px] w-14 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 text-sm',
                              isLocked && 'cursor-not-allowed opacity-60'
                            )}
                            disabled={isLocked}
                          >
                            {visit.timePeriodStart}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label mb-1 block text-sm">Hora fin</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="5:00"
                              value={visit.timeEnd}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
                                updateVisit(visit.id, 'timeEnd', val);
                              }}
                              className={cn('input pl-10', isLocked && 'cursor-not-allowed bg-gray-100')}
                              maxLength={5}
                              disabled={isLocked}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => !isLocked && updateVisit(visit.id, 'timePeriodEnd', visit.timePeriodEnd === 'AM' ? 'PM' : 'AM')}
                            className={cn(
                              'flex h-[42px] w-14 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 text-sm',
                              isLocked && 'cursor-not-allowed opacity-60'
                            )}
                            disabled={isLocked}
                          >
                            {visit.timePeriodEnd}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Technician assignment per visit */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label text-sm">Técnico(s) para esta visita</label>
                        {visit.technicianIds.length > 0 && !isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              // Pre-select the single technician if only one
                              if (visit.technicianIds.length === 1) {
                                setSelectedDriverIds([visit.technicianIds[0]]);
                              } else {
                                setSelectedDriverIds([]);
                              }
                              setSelectedVehicleId('');
                              setVehicleAssignmentVisitId(vehicleAssignmentVisitId === visit.id ? null : visit.id);
                            }}
                            className="text-xs text-primary-600 hover:underline flex items-center gap-0.5"
                          >
                            <Truck className="h-3 w-3" />
                            {visit.vehicleAssignments.length > 0 ? '+ Agregar vehículo' : 'Asignar vehículo'}
                          </button>
                        )}
                      </div>
                      <div className="relative" ref={activeVisitDropdown === visit.id ? dropdownRef : null}>
                        <button
                          type="button"
                          onClick={() => !isLocked && setActiveVisitDropdown(activeVisitDropdown === visit.id ? null : visit.id)}
                          className={cn(
                            'input flex w-full items-center justify-between pl-10 text-left text-sm',
                            isLocked && 'cursor-not-allowed bg-gray-100'
                          )}
                          disabled={isLocked}
                        >
                          <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <span className={`truncate ${visit.technicianIds.length === 0 ? 'text-gray-400' : ''}`}>
                            {visit.technicianIds.length === 0
                              ? 'Seleccionar técnicos...'
                              : (() => {
                                const names = visit.technicianIds.map(id => {
                                  if (id === currentUser?.id) return currentUser.name;
                                  const member = teamMembers?.find(m => m.id === id);
                                  return member?.name || 'Técnico';
                                });
                                return names.join(', ');
                              })()}
                          </span>
                          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {activeVisitDropdown === visit.id && (
                          <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-lg">
                            <div className="max-h-48 overflow-auto py-1">
                              {currentUser && (() => {
                                // Find if current user has a job-specific vehicle assignment for this visit
                                const jobVehicleAssignment = visit.vehicleAssignments.find(a => a.driverIds.includes(currentUser.id));
                                const jobVehicle = jobVehicleAssignment ? vehiclesData?.find((v: { id: string }) => v.id === jobVehicleAssignment.vehicleId) : null;
                                // Check if has a permanent vehicle assignment
                                const hasPermanentVehicle = vehiclesData?.some((v: { assignments: { user: { id: string } }[] }) =>
                                  v.assignments?.some(a => a.user?.id === currentUser.id)
                                );
                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleVisitTechnician(visit.id, currentUser.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                                  >
                                    <span className={`flex h-4 w-4 items-center justify-center rounded border ${visit.technicianIds.includes(currentUser.id)
                                      ? 'border-primary-600 bg-primary-600 text-white'
                                      : 'border-gray-300'
                                      }`}>
                                      {visit.technicianIds.includes(currentUser.id) && <Check className="h-3 w-3" />}
                                    </span>
                                    <span className="flex-1">Yo ({currentUser.name})</span>
                                    {jobVehicle ? (
                                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                        <Truck className="h-3 w-3" />
                                        {jobVehicle.make} {jobVehicle.model}
                                      </span>
                                    ) : hasPermanentVehicle && (
                                      <Truck className="h-3.5 w-3.5 text-primary-500" />
                                    )}
                                  </button>
                                );
                              })()}
                              {teamMembers?.filter(m => m.id !== currentUser?.id).map((member) => {
                                // Find if member has a job-specific vehicle assignment for this visit
                                const jobVehicleAssignment = visit.vehicleAssignments.find(a => a.driverIds.includes(member.id));
                                const jobVehicle = jobVehicleAssignment ? vehiclesData?.find((v: { id: string }) => v.id === jobVehicleAssignment.vehicleId) : null;
                                // Check if has a permanent vehicle assignment
                                const hasPermanentVehicle = vehiclesData?.some((v: { assignments: { user: { id: string } }[] }) =>
                                  v.assignments?.some(a => a.user?.id === member.id)
                                );
                                return (
                                  <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => toggleVisitTechnician(visit.id, member.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                                  >
                                    <span className={`flex h-4 w-4 items-center justify-center rounded border ${visit.technicianIds.includes(member.id)
                                      ? 'border-primary-600 bg-primary-600 text-white'
                                      : 'border-gray-300'
                                      }`}>
                                      {visit.technicianIds.includes(member.id) && <Check className="h-3 w-3" />}
                                    </span>
                                    <span className="flex-1">{member.name}</span>
                                    {jobVehicle ? (
                                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                        <Truck className="h-3 w-3" />
                                        {jobVehicle.make} {jobVehicle.model}
                                      </span>
                                    ) : hasPermanentVehicle && (
                                      <Truck className="h-3.5 w-3.5 text-primary-500" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Scheduling Conflict Warnings */}
                    {visitConflicts[visit.id]?.length > 0 && (
                      <AssignmentConflictBanner
                        warnings={visitConflicts[visit.id]}
                        isLoading={isValidatingConflicts}
                        onAction={(action, warning) => handleConflictAction(action, warning, visit.id)}
                        className="mt-2"
                      />
                    )}

                    {/* Show assigned vehicles list */}
                    {visit.vehicleAssignments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {visit.vehicleAssignments.map((assignment, idx) => {
                          const vehicle = vehiclesData?.find((v: { id: string }) => v.id === assignment.vehicleId);
                          const driverNames = assignment.driverIds.map(id => {
                            if (id === currentUser?.id) return currentUser.name;
                            return teamMembers?.find(m => m.id === id)?.name || 'Técnico';
                          }).join(', ');
                          return (
                            <div key={`${assignment.vehicleId}-${idx}`} className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Truck className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-800">
                                  {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehículo'}
                                </span>
                                <span className="text-green-600">•</span>
                                <span className="text-green-700">{driverNames}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newAssignments = visit.vehicleAssignments.filter((_, i) => i !== idx);
                                  updateVisit(visit.id, 'vehicleAssignments', newAssignments);
                                }}
                                className="text-xs text-gray-500 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Show default vehicles for technicians without explicit assignments */}
                    {(() => {
                      // Get technicians without explicit vehicle assignments
                      const techsWithExplicitVehicles = new Set(
                        visit.vehicleAssignments.flatMap(va => va.driverIds || [])
                      );
                      const techsWithoutVehicles = visit.technicianIds.filter(
                        id => !techsWithExplicitVehicles.has(id)
                      );

                      // Filter to only those who have default vehicles
                      const techsWithDefaults = techsWithoutVehicles.filter(
                        id => defaultVehicles[id]?.vehicle
                      );

                      if (techsWithDefaults.length === 0) return null;

                      return (
                        <div className="mt-2 space-y-1.5">
                          {techsWithDefaults.map(techId => {
                            const defaultData = defaultVehicles[techId];
                            if (!defaultData?.vehicle) return null;

                            const techName = techId === currentUser?.id
                              ? currentUser.name
                              : teamMembers?.find(m => m.id === techId)?.name || 'Técnico';

                            const matchLabel = defaultData.matchType === 'permanent'
                              ? 'predeterminado'
                              : defaultData.matchType === 'date_range'
                                ? 'por fechas'
                                : 'por día';

                            return (
                              <div
                                key={`default-${techId}`}
                                className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 border-dashed px-3 py-2"
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <Truck className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium text-blue-800">
                                    {defaultData.vehicle.make} {defaultData.vehicle.model}
                                  </span>
                                  <span className="text-blue-400">•</span>
                                  <span className="text-blue-600">{techName}</span>
                                  <span className="text-xs text-blue-400 bg-blue-100 px-1.5 py-0.5 rounded">
                                    {matchLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Recurrence option - compact inline */}
                    <div className={cn('mt-2 pt-2 border-t border-gray-100 flex items-center gap-4 flex-wrap', isLocked && 'opacity-60')}>
                      <label className={cn('flex items-center gap-2', isLocked ? 'cursor-not-allowed' : 'cursor-pointer')}>
                        <input
                          type="checkbox"
                          checked={visit.isRecurring}
                          onChange={(e) => updateVisit(visit.id, 'isRecurring', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          disabled={isLocked}
                        />
                        <Repeat className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-700">Repetir</span>
                      </label>

                      {visit.isRecurring && (
                        <>
                          <select
                            value={visit.recurrencePattern}
                            onChange={(e) => updateVisit(visit.id, 'recurrencePattern', e.target.value)}
                            className={cn('input text-xs py-1 px-2 w-auto', isLocked && 'cursor-not-allowed bg-gray-100')}
                            disabled={isLocked}
                          >
                            {RECURRENCE_PATTERNS.map((pattern) => (
                              <option key={pattern.value} value={pattern.value}>
                                {pattern.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={2}
                              max={24}
                              value={visit.recurrenceCount}
                              onChange={(e) => updateVisit(visit.id, 'recurrenceCount', parseInt(e.target.value) || 6)}
                              className={cn('input text-xs py-1 px-2 w-14', isLocked && 'cursor-not-allowed bg-gray-100')}
                              disabled={isLocked}
                            />
                            <span className="text-xs text-gray-500">veces</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add visit button */}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={addVisit}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar otra visita
                  </button>
                )}
              </div>

              {error && <p className="text-sm text-danger-500">{error}</p>}

              {/* Conflict warning before submit */}
              {hasUnresolvedConflicts && !isLocked && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs text-amber-700 font-medium">
                    ⚠️ Hay conflictos de horario sin resolver. Resolvé los conflictos antes de guardar.
                  </p>
                </div>
              )}

              {/* Locked message */}
              {isLocked && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-700 font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Este trabajo está {job?.status === 'COMPLETED' ? 'completado' : 'cancelado'} y no puede ser modificado.
                  </p>
                </div>
              )}

              {/* Footer Actions - matching Empleados pattern */}
              <div className="flex justify-between items-center gap-2 pt-3 border-t border-gray-100">
                {/* Left side: WhatsApp + Cancel job */}
                <div className="flex gap-2">
                  {/* WhatsApp button - green outline */}
                  {selectedCustomer?.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        const cleanPhone = selectedCustomer.phone.replace(/\D/g, '');
                        const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
                        window.open(`https://wa.me/${whatsappPhone}`, '_blank');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                  )}

                  {/* Cancel job button - red outline (only if not already cancelled/completed) */}
                  {!isLocked && job?.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('¿Estás seguro de que querés cancelar este trabajo?')) {
                          const res = await fetch(`/api/jobs/${jobId}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'CANCELLED' }),
                          });
                          if (res.ok) {
                            queryClient.invalidateQueries({ queryKey: ['jobs'] });
                            handleClose();
                          }
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </button>
                  )}
                </div>

                {/* Right side: Cancel modal + Save */}
                <div className="flex gap-2">
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
                    Cancelar
                  </button>
                  {!isLocked && (
                    <button
                      type="submit"
                      disabled={isSubmitting || hasUnresolvedConflicts}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      title={hasUnresolvedConflicts ? 'Resolvé los conflictos de horario antes de continuar' : undefined}
                    >
                      {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Exception Modification Modal */}
          {conflictModalData?.isOpen && (
            <EmployeeDayModal
              employee={{
                id: conflictModalData.technicianId,
                name: conflictModalData.technicianName,
                role: 'TECHNICIAN',
              }}
              date={conflictModalData.date}
              exceptions={[]}
              onClose={() => {
                setConflictModalData(null);
                // Re-validate after modal closes
                const visit = visits.find(v => v.id === conflictModalData.visitId);
                if (visit) {
                  setTimeout(() => validateVisitAssignments(visit), 500);
                }
              }}
              onUpdate={() => {
                setConflictModalData(null);
                // Re-validate
                const visit = visits.find(v => v.id === conflictModalData.visitId);
                if (visit) {
                  setTimeout(() => validateVisitAssignments(visit), 500);
                }
              }}
            />
          )}

          {/* New Customer Modal (stacked on top) */}
          <NewCustomerModal
            isOpen={showNewCustomerModal}
            onClose={() => setShowNewCustomerModal(false)}
            onSuccess={(customer) => {
              // Auto-select the newly created customer
              setSelectedCustomer({
                id: customer.id,
                name: customer.name,
                phone: '',
                address: undefined,
              });
              setUseCustomerAddress(false); // New customer may not have address yet
              queryClient.invalidateQueries({ queryKey: ['customers'] });
            }}
          />

          {/* Vehicle Assignment Modal (stacked on top) */}
          {vehicleAssignmentVisitId && createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50"
              onClick={() => setVehicleAssignmentVisitId(null)}
            >
              <div
                className="bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between py-3 px-5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-bold text-gray-900">Asignar vehículo</h2>
                  </div>
                  <button
                    onClick={() => setVehicleAssignmentVisitId(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  {/* Driver Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conductor(es)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const currentVisit = visits.find(v => v.id === vehicleAssignmentVisitId);
                        if (!currentVisit) return null;

                        // Get all technicians already assigned to a vehicle in this visit
                        const alreadyAssignedTechs = new Map<string, string>(); // techId -> vehicleId
                        currentVisit.vehicleAssignments.forEach(a => {
                          a.driverIds.forEach(dId => {
                            alreadyAssignedTechs.set(dId, a.vehicleId);
                          });
                        });

                        return currentVisit.technicianIds.map((techId) => {
                          const tech = teamMembers?.find(m => m.id === techId) ||
                            (currentUser?.id === techId ? { id: techId, name: currentUser.name } : null);
                          if (!tech) return null;

                          const isSelected = selectedDriverIds.includes(techId);
                          const existingVehicleId = alreadyAssignedTechs.get(techId);
                          const existingVehicle = existingVehicleId ? vehiclesData?.find((v: { id: string }) => v.id === existingVehicleId) : null;
                          const isAlreadyAssigned = !!existingVehicleId;

                          return (
                            <button
                              key={techId}
                              type="button"
                              disabled={isAlreadyAssigned}
                              onClick={() => {
                                if (isAlreadyAssigned) return;
                                if (isSelected) {
                                  setSelectedDriverIds(selectedDriverIds.filter(id => id !== techId));
                                } else {
                                  setSelectedDriverIds([...selectedDriverIds, techId]);
                                }
                              }}
                              className={cn(
                                'px-4 py-2 text-sm rounded-lg border-2 transition-all flex items-center gap-2',
                                isAlreadyAssigned
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-primary-400'
                              )}
                              title={isAlreadyAssigned ? `Ya asignado a ${existingVehicle?.make || 'otro vehículo'}` : undefined}
                            >
                              {tech.name}
                              {isAlreadyAssigned && existingVehicle && (
                                <span className="text-xs text-gray-500">({existingVehicle.make})</span>
                              )}
                              {isSelected && !isAlreadyAssigned && <Check className="h-4 w-4" />}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    {(() => {
                      const currentVisit = visits.find(v => v.id === vehicleAssignmentVisitId);
                      const alreadyAssignedCount = currentVisit?.vehicleAssignments.reduce((acc, a) => acc + a.driverIds.length, 0) || 0;
                      const totalTechs = currentVisit?.technicianIds.length || 0;
                      if (alreadyAssignedCount > 0 && alreadyAssignedCount < totalTechs) {
                        return (
                          <p className="text-xs text-amber-600 mt-2">
                            ⚠️ {alreadyAssignedCount} de {totalTechs} técnicos ya tienen vehículo asignado
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Vehicle Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehículo
                    </label>
                    <div className="relative">
                      <Truck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="input pl-10"
                      >
                        <option value="">Seleccionar vehículo...</option>
                        {(() => {
                          const currentVisit = visits.find(v => v.id === vehicleAssignmentVisitId);
                          const assignedVehicleIds = new Set(currentVisit?.vehicleAssignments.map(a => a.vehicleId) || []);

                          return vehiclesData?.filter((v: { id: string; status: string }) =>
                            // Filter out vehicles already assigned to this visit
                            !assignedVehicleIds.has(v.id)
                          ).map((v: { id: string; make: string; model: string; plateNumber: string; status: string }) => (
                            <option key={v.id} value={v.id} disabled={v.status !== 'ACTIVE'}>
                              {v.make} {v.model} - {v.plateNumber} {v.status !== 'ACTIVE' ? '(No disponible)' : ''}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>

                  {/* Info message */}
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-xs text-blue-700">
                      💡 Esta asignación es solo para este trabajo. Para conductores permanentes, configurá en{' '}
                      <span className="font-medium">Flota → Vehículos</span>.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setVehicleAssignmentVisitId(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={selectedDriverIds.length === 0 || !selectedVehicleId}
                    onClick={() => {
                      // Add the vehicle assignment to the list
                      const currentVisit = visits.find(v => v.id === vehicleAssignmentVisitId);
                      if (currentVisit) {
                        const newAssignment = {
                          vehicleId: selectedVehicleId,
                          driverIds: selectedDriverIds,
                        };
                        const updatedAssignments = [...currentVisit.vehicleAssignments, newAssignment];
                        updateVisit(vehicleAssignmentVisitId, 'vehicleAssignments', updatedAssignments);
                      }
                      setVehicleAssignmentVisitId(null);
                      setSelectedDriverIds([]);
                      setSelectedVehicleId('');
                    }}
                    className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Asignar vehículo
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div >
    </div >,
    document.body
  );
}
