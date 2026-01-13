'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Search, Calendar, Clock, Users, MapPin, X, Check, Wrench, Repeat, Plus, Truck } from 'lucide-react';
import Link from 'next/link';
import AddressAutocomplete, { ParsedAddress } from '@/components/ui/AddressAutocomplete';
import { useVehicleSuggestion, getMatchTypeLabel } from '@/hooks/useVehicleSuggestion';
import { AssignmentConflictBanner } from '@/components/schedule/AssignmentConflictBanner';
import EmployeeDayModal from '@/components/schedule/EmployeeDayModal';
import type { ValidationWarning } from '@/hooks/useAssignmentValidation';

// Customer type with address
interface CustomerAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  fullAddress?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: CustomerAddress;
}

// Visit structure for multi-visit jobs
interface JobVisit {
  id: string;
  date: string;
  endDate: string; // Optional: if set, creates visits for each day in range
  timeStart: string;
  timeEnd: string;
  timePeriodStart: 'AM' | 'PM';
  timePeriodEnd: 'AM' | 'PM';
  technicianIds: string[];
  vehicleId: string | null; // Vehicle for this visit (Phase 2.1)
  // Recurrence settings per visit
  isRecurring: boolean;
  recurrencePattern: string;
  recurrenceCount: number;
}

const createEmptyVisit = (): JobVisit => ({
  id: Math.random().toString(36).substring(7),
  date: '',
  endDate: '',
  timeStart: '',
  timeEnd: '',
  timePeriodStart: 'AM',
  timePeriodEnd: 'PM',
  technicianIds: [],
  vehicleId: null,
  isRecurring: false,
  recurrencePattern: 'MONTHLY',
  recurrenceCount: 6,
});

// Helper to expand a date range into individual dates
const expandDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ensure we don't create too many dates (max 30 days)
  const maxDays = 30;
  const current = new Date(start);
  let count = 0;

  while (current <= end && count < maxDays) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
    count++;
  }

  return dates;
};

const RECURRENCE_PATTERNS = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'BIANNUAL', label: 'Semestral' },
  { value: 'ANNUAL', label: 'Anual' },
];

// Inline Vehicle Suggestion Component - Phase 2.1
function VehicleSuggestionInline({
  technicianId,
  date,
  time,
  selectedVehicleId,
  onVehicleSelect,
}: {
  technicianId: string;
  date: string;
  time?: string;
  selectedVehicleId: string | null;
  onVehicleSelect: (vehicleId: string | null) => void;
}) {
  const { data, isLoading } = useVehicleSuggestion({
    technicianId,
    date,
    time: time || null,
    enabled: !!technicianId && !!date,
  });

  if (!technicianId || !date) return null;

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-gray-500">
          <Truck className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Buscando vehículo asignado...</span>
        </div>
      </div>
    );
  }

  if (!data?.vehicle) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-center gap-2 text-amber-700">
          <Truck className="h-4 w-4" />
          <span className="text-sm">No hay vehículo asignado para este técnico en esta fecha</span>
        </div>
      </div>
    );
  }

  const vehicle = data.vehicle;
  const vehicleName = `${vehicle.make} ${vehicle.model} - ${vehicle.plateNumber}`;
  const isSelected = selectedVehicleId === vehicle.id;

  return (
    <div className={`mt-3 rounded-lg border ${isSelected ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50'} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className={`h-4 w-4 ${isSelected ? 'text-green-600' : 'text-blue-600'}`} />
          <div>
            <span className={`text-sm font-medium ${isSelected ? 'text-green-800' : 'text-blue-800'}`}>
              {vehicleName}
            </span>
            <span className={`ml-2 text-xs ${isSelected ? 'text-green-600' : 'text-blue-600'}`}>
              ({getMatchTypeLabel(data.matchType)})
            </span>
          </div>
        </div>
        {!isSelected ? (
          <button
            type="button"
            onClick={() => onVehicleSelect(vehicle.id)}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Asignar
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
            <Check className="h-3 w-3" />
            Asignado
          </span>
        )}
      </div>
    </div>
  );
}

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [useCustomerAddress, setUseCustomerAddress] = useState(true);

  // Service type creation state
  const [showCreateServiceType, setShowCreateServiceType] = useState(false);
  const [newServiceTypeName, setNewServiceTypeName] = useState('');
  const [isCreatingServiceType, setIsCreatingServiceType] = useState(false);

  // Get customerId from URL params (from "Nuevo trabajo para cliente" button)
  const preselectedCustomerId = searchParams.get('customerId');

  // Fetch pre-selected customer if customerId is in URL
  const { data: preselectedCustomerData } = useQuery({
    queryKey: ['customer', preselectedCustomerId],
    queryFn: () => api.customers.get(preselectedCustomerId!),
    enabled: !!preselectedCustomerId && !selectedCustomer,
  });

  // Set selected customer when pre-selected data loads
  useEffect(() => {
    if (preselectedCustomerData?.data && !selectedCustomer) {
      setSelectedCustomer(preselectedCustomerData.data as Customer);
      setUseCustomerAddress(true);
    }
  }, [preselectedCustomerData, selectedCustomer]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    serviceType: '',
    priority: 'normal',
  });

  // Multi-visit support - each visit has its own date, time, and technicians
  const [visits, setVisits] = useState<JobVisit[]>([createEmptyVisit()]);
  const [activeVisitDropdown, setActiveVisitDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Assignment conflict tracking
  const [visitConflicts, setVisitConflicts] = useState<Record<string, ValidationWarning[]>>({});
  const [isValidatingConflicts, setIsValidatingConflicts] = useState(false);
  const [conflictModalData, setConflictModalData] = useState<{
    isOpen: boolean;
    technicianId: string;
    technicianName: string;
    date: Date;
    visitId: string;
  } | null>(null);

  // Close dropdown when clicking outside
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

  // Fetch service types from API (configurable by business owner)
  const { data: serviceTypesData } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await fetch('/api/settings/service-types');
      return res.json();
    },
  });

  // Use fetched service types - only show what the business has created
  // Always include "Otro" as a fallback option (if not already present)
  const businessServiceTypes = serviceTypesData?.data?.map((st: { code: string; name: string }) => ({
    value: st.code,
    label: st.name,
  })) || [];

  // Only add OTRO if it's not already in the list
  const hasOtro = businessServiceTypes.some((st: { value: string }) => st.value === 'OTRO');
  const SERVICE_TYPES = hasOtro
    ? businessServiceTypes
    : [...businessServiceTypes, { value: 'OTRO', label: 'Otro' }];

  // Create service type mutation
  const handleCreateServiceType = async () => {
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
        // Refresh service types and select the new one
        await queryClient.invalidateQueries({ queryKey: ['service-types'] });
        setFormData({ ...formData, serviceType: data.data.code });
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
  };

  // Convert 12h to 24h format for API
  const convertTo24h = (time12h: string, period: 'AM' | 'PM'): string => {
    if (!time12h) return '';
    // Handle flexible input: "1", "11", "1:30", "11:30"
    const parts = time12h.split(':');
    let hours = parseInt(parts[0]) || 0;
    const minutes = parts[1] ? parseInt(parts[1]) || 0 : 0;

    // Normalize hours > 12 to valid 12h format (e.g., 15 -> 3)
    // This handles cases where user types in 24h format by mistake
    if (hours > 12) {
      hours = hours % 12 || 12;
    }

    let h = hours;
    if (period === 'PM' && hours !== 12) h += 12;
    if (period === 'AM' && hours === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Visit management functions
  const addVisit = () => {
    setVisits([...visits, createEmptyVisit()]);
  };

  const removeVisit = (visitId: string) => {
    if (visits.length > 1) {
      setVisits(visits.filter(v => v.id !== visitId));
    }
  };

  const updateVisit = (visitId: string, field: keyof JobVisit, value: string | string[] | boolean | number) => {
    setVisits(visits.map(v =>
      v.id === visitId ? { ...v, [field]: value } : v
    ));
  };

  const toggleVisitTechnician = (visitId: string, techId: string) => {
    setVisits(visits.map(v => {
      if (v.id !== visitId) return v;
      const isSelected = v.technicianIds.includes(techId);
      return {
        ...v,
        technicianIds: isSelected
          ? v.technicianIds.filter(id => id !== techId)
          : [...v.technicianIds, techId]
      };
    }));
  };

  // Validate technicians for scheduling conflicts
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

  // Re-validate when visits change (technicians or date)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      visits.forEach(visit => {
        if (visit.date && visit.technicianIds.length > 0) {
          validateVisitAssignments(visit);
        }
      });
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [visits, validateVisitAssignments]);

  // Check if any visit has unresolved conflicts
  const hasUnresolvedConflicts = Object.values(visitConflicts).some(warnings => warnings.length > 0);

  // Handle conflict action (change date, remove technician, modify exception)
  const handleConflictAction = (
    action: 'change_date' | 'remove_technician' | 'modify_exception' | 'modify_schedule',
    warning: ValidationWarning,
    visitId: string
  ) => {
    if (action === 'remove_technician') {
      toggleVisitTechnician(visitId, warning.details.technicianId);
    } else if (action === 'modify_exception' && warning.details.exceptionDate) {
      // Open the EmployeeDayModal to modify the exception
      setConflictModalData({
        isOpen: true,
        technicianId: warning.details.technicianId,
        technicianName: warning.details.technicianName,
        date: new Date(warning.details.exceptionDate),
        visitId,
      });
    } else if (action === 'change_date') {
      // Focus the date input (scroll into view)
      const dateInput = document.querySelector(`input[type="date"]`) as HTMLInputElement;
      if (dateInput) {
        dateInput.focus();
        dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (action === 'modify_schedule') {
      // Redirect to team schedule page
      window.open(`/dashboard/settings/team?employee=${warning.details.technicianId}&tab=schedule`, '_blank');
    }
  };

  // Auto-fill address when customer is selected
  useEffect(() => {
    if (selectedCustomer && useCustomerAddress) {
      const customerAddress = selectedCustomer.address;
      if (customerAddress) {
        // Use fullAddress if available, otherwise build from parts
        const addressString = customerAddress.fullAddress ||
          [customerAddress.street, customerAddress.city, customerAddress.state, customerAddress.postalCode]
            .filter(Boolean)
            .join(', ');
        setFormData((prev) => ({ ...prev, address: addressString }));
      }
    }
  }, [selectedCustomer, useCustomerAddress]);

  // Handle address selection from autocomplete
  const handleAddressSelect = (parsed: ParsedAddress) => {
    setFormData((prev) => ({ ...prev, address: parsed.fullAddress }));
    setUseCustomerAddress(false);
  };

  const { data: customersData } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => api.customers.search(customerSearch),
    enabled: customerSearch.length > 2 && !selectedCustomer,
  });

  // Fetch all team members (admins and technicians)
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.users.list(),
  });

  // Fetch availability when first visit date is selected
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

  const customers = customersData?.data as Customer[] | undefined;
  const teamMembers = usersData?.data as Array<{ id: string; name: string; role: string }> | undefined;

  // Build availability map for quick lookup
  interface AvailableEmployee {
    id: string;
    name: string;
    isAvailable: boolean;
    currentJobCount: number;
  }
  const availabilityMap = new Map<string, AvailableEmployee>();
  if (availabilityData?.data?.employees) {
    (availabilityData.data.employees as AvailableEmployee[]).forEach((emp) => {
      availabilityMap.set(emp.id, emp);
    });
  }

  // Get availability status for a team member
  const _getAvailabilityStatus = (memberId: string) => {
    const avail = availabilityMap.get(memberId);
    if (!avail) return null;
    return {
      isAvailable: avail.isAvailable,
      jobCount: avail.currentJobCount,
    };
  };

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

    const response = await api.jobs.create(jobData);

    if (response.success) {
      router.push('/dashboard/jobs');
    } else {
      setError(response.error?.message || 'Error al crear el trabajo');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/jobs"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo trabajo</h1>
          <p className="text-gray-500">Crear un nuevo trabajo o servicio</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Customer selection */}
        <div>
          <label className="label mb-1 block">Cliente *</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-md border bg-gray-50 p-3">
              <span className="font-medium">{selectedCustomer.name}</span>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-sm text-primary-600 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar cliente por nombre o teléfono..."
                className="input pl-10"
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
                        setUseCustomerAddress(true); // Reset to use customer address
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
          <Link
            href="/dashboard/customers/new"
            className="mt-2 inline-block text-sm text-primary-600 hover:underline"
          >
            + Crear nuevo cliente
          </Link>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="label mb-1 block">
            Título del trabajo *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ej: Instalación de aire acondicionado"
            className="input"
            required
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el título del trabajo')}
            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="label mb-1 block">
            Descripción
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Detalles adicionales del trabajo..."
            rows={3}
            className="input"
          />
        </div>

        {/* Service Type */}
        <div>
          <label htmlFor="serviceType" className="label mb-1 block">
            Tipo de servicio *
          </label>
          {!showCreateServiceType ? (
            <>
              <div className="relative">
                <Wrench className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  id="serviceType"
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="input pl-10"
                  required
                >
                  <option value="">Seleccionar tipo de servicio...</option>
                  {SERVICE_TYPES.map((type: { value: string; label: string }) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateServiceType(true)}
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
              >
                <Plus className="h-4 w-4" />
                Crear nuevo tipo de servicio
              </button>
            </>
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
          <label htmlFor="address" className="label mb-1 block">
            Dirección del servicio *
          </label>

          {/* Show indicator when using customer address */}
          {selectedCustomer && selectedCustomer.address && useCustomerAddress && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-700">
              <MapPin className="h-4 w-4" />
              <span>Usando la dirección del cliente</span>
              <button
                type="button"
                onClick={() => setUseCustomerAddress(false)}
                className="ml-auto text-primary-600 hover:underline"
              >
                Usar otra dirección
              </button>
            </div>
          )}

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
          />

          {/* Option to reset to customer address */}
          {selectedCustomer && selectedCustomer.address && !useCustomerAddress && (
            <button
              type="button"
              onClick={() => setUseCustomerAddress(true)}
              className="mt-2 text-sm text-primary-600 hover:underline"
            >
              Í¢â€ Â Volver a usar la dirección del cliente
            </button>
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
          >
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>

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
              className={`rounded-lg border p-4 ${index === 0 ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">
                  {visits.length === 1 ? 'Fecha y hora' : `Visita ${index + 1}`}
                </h4>
                {visits.length > 1 && (
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
              <div className="grid gap-4 sm:grid-cols-2 mb-4">
                <div>
                  <label className="label mb-1 block text-sm">Fecha inicio {index === 0 && '*'}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={visit.date}
                      onChange={(e) => updateVisit(visit.id, 'date', e.target.value)}
                      className="input pl-10"
                      required={index === 0}
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
                      className="input pl-10"
                      placeholder="Mismo día"
                    />
                  </div>
                  {visit.endDate && visit.date && (
                    <p className="mt-1 text-xs text-primary-600">
                      {(() => {
                        const days = expandDateRange(visit.date, visit.endDate).length;
                        return `${days} día${days > 1 ? 's' : ''} con el mismo horario`;
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Time inputs */}
              <div className="grid gap-4 sm:grid-cols-2 mb-4">
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
                          // Allow flexible input: 1, 11, 1:30, 11:30
                          const val = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
                          updateVisit(visit.id, 'timeStart', val);
                        }}
                        className="input pl-10"
                        maxLength={5}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateVisit(visit.id, 'timePeriodStart', visit.timePeriodStart === 'AM' ? 'PM' : 'AM')}
                      className="flex h-[42px] w-14 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 text-sm"
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
                          // Allow flexible input: 1, 11, 1:30, 11:30
                          const val = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
                          updateVisit(visit.id, 'timeEnd', val);
                        }}
                        className="input pl-10"
                        maxLength={5}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateVisit(visit.id, 'timePeriodEnd', visit.timePeriodEnd === 'AM' ? 'PM' : 'AM')}
                      className="flex h-[42px] w-14 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 text-sm"
                    >
                      {visit.timePeriodEnd}
                    </button>
                  </div>
                </div>
              </div>

              {/* Technician assignment per visit */}
              <div>
                <label className="label mb-1 block text-sm">Técnico(s) para esta visita</label>

                {/* Selected technicians */}
                {visit.technicianIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {visit.technicianIds.map((techId) => {
                      const member = teamMembers?.find((m) => m.id === techId) ||
                        (currentUser?.id === techId ? { id: currentUser.id, name: currentUser.name, role: 'CURRENT' } : null);
                      if (!member) return null;
                      return (
                        <span
                          key={techId}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700"
                        >
                          {member.name}
                          <button
                            type="button"
                            onClick={() => toggleVisitTechnician(visit.id, techId)}
                            className="hover:bg-primary-200 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Technician dropdown */}
                <div className="relative" ref={activeVisitDropdown === visit.id ? dropdownRef : null}>
                  <button
                    type="button"
                    onClick={() => setActiveVisitDropdown(activeVisitDropdown === visit.id ? null : visit.id)}
                    className="input flex w-full items-center justify-between pl-10 text-left text-sm"
                  >
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <span className={visit.technicianIds.length === 0 ? 'text-gray-400' : ''}>
                      {visit.technicianIds.length === 0
                        ? 'Seleccionar técnicos...'
                        : `${visit.technicianIds.length} seleccionado(s)`}
                    </span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {activeVisitDropdown === visit.id && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-lg">
                      <div className="max-h-48 overflow-auto py-1">
                        {currentUser && (
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
                            <span>Yo ({currentUser.name})</span>
                          </button>
                        )}
                        {teamMembers?.filter(m => m.id !== currentUser?.id).map((member) => (
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
                            <span>{member.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="border-t px-3 py-2 space-y-1">
                        <Link
                          href="/dashboard/settings/team"
                          className="block w-full text-center text-xs text-primary-600 hover:underline"
                        >
                          + Agregar nuevo miembro al equipo
                        </Link>
                        <button
                          type="button"
                          onClick={() => setActiveVisitDropdown(null)}
                          className="w-full text-center text-xs text-gray-500 hover:underline"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  )}
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

                {/* Vehicle Suggestion - Phase 2.1 */}
                {visit.technicianIds.length > 0 && visit.date && (
                  <VehicleSuggestionInline
                    technicianId={visit.technicianIds[0]} // Use first technician
                    date={visit.date}
                    time={convertTo24h(visit.timeStart, visit.timePeriodStart) || undefined}
                    selectedVehicleId={visit.vehicleId}
                    onVehicleSelect={(vehicleId) => updateVisit(visit.id, 'vehicleId', vehicleId || '')}
                  />
                )}

                {/* Recurrence option per visit */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visit.isRecurring}
                      onChange={(e) => updateVisit(visit.id, 'isRecurring', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Repetir esta visita</span>
                    </div>
                  </label>

                  {visit.isRecurring && (
                    <div className="mt-3 ml-7 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label mb-1 block text-xs">Frecuencia</label>
                        <select
                          value={visit.recurrencePattern}
                          onChange={(e) => updateVisit(visit.id, 'recurrencePattern', e.target.value)}
                          className="input text-sm"
                        >
                          {RECURRENCE_PATTERNS.map((pattern) => (
                            <option key={pattern.value} value={pattern.value}>
                              {pattern.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label mb-1 block text-xs">Repeticiones</label>
                        <input
                          type="number"
                          min={2}
                          max={24}
                          value={visit.recurrenceCount}
                          onChange={(e) => updateVisit(visit.id, 'recurrenceCount', parseInt(e.target.value) || 6)}
                          className="input text-sm"
                        />
                      </div>
                      <p className="sm:col-span-2 text-xs text-gray-500">
                        Se crearán {visit.recurrenceCount} visitas con frecuencia {RECURRENCE_PATTERNS.find(p => p.value === visit.recurrencePattern)?.label.toLowerCase()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add visit button */}
          <button
            type="button"
            onClick={addVisit}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Agregar otra visita
          </button>
          <p className="text-xs text-gray-500 text-center">
            Para trabajos con múltiples fechas no consecutivas o con diferentes horarios/técnicos por día
          </p>
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Conflict warning before submit */}
        {hasUnresolvedConflicts && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-700 font-medium">
              ⚠️ Hay conflictos de horario sin resolver. Resolvé los conflictos antes de crear el trabajo.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/jobs" className="btn-outline">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || hasUnresolvedConflicts}
            className="btn-primary"
            title={hasUnresolvedConflicts ? 'Resolvé los conflictos de horario antes de continuar' : undefined}
          >
            {isSubmitting ? 'Creando...' : 'Crear trabajo'}
          </button>
        </div>
      </form>

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
    </div>
  );
}
