'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Search, Calendar, Clock, Users, MapPin, X, Check, Wrench, AlertTriangle, Repeat, Plus } from 'lucide-react';
import Link from 'next/link';
import AddressAutocomplete, { ParsedAddress } from '@/components/ui/AddressAutocomplete';

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

const RECURRENCE_PATTERNS = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'BIANNUAL', label: 'Semestral' },
  { value: 'ANNUAL', label: 'Anual' },
];

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
    scheduledDate: '',
    scheduledEndDate: '', // Optional - for multi-day jobs
    scheduledTimeStart: '',
    scheduledTimeEnd: '',
    assignedToIds: [] as string[],
    // Recurring option
    isRecurring: false,
    recurrencePattern: 'MONTHLY',
    recurrenceCount: 6,
  });
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('PM');

  // Fetch service types from API (configurable by business owner)
  const { data: serviceTypesData } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await fetch('/api/settings/service-types');
      return res.json();
    },
  });

  // Use fetched service types - only show what the business has created
  // Always include "Otro" as a fallback option
  const businessServiceTypes = serviceTypesData?.data?.map((st: { code: string; name: string }) => ({
    value: st.code,
    label: st.name,
  })) || [];

  const SERVICE_TYPES = [
    ...businessServiceTypes,
    { value: 'OTRO', label: 'Otro' },
  ];

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
    } catch (err) {
      setError('Error creando tipo de servicio');
    } finally {
      setIsCreatingServiceType(false);
    }
  };

  // Convert 12h to 24h format for API
  const convertTo24h = (time12h: string, period: 'AM' | 'PM'): string => {
    if (!time12h) return '';
    const [hours, minutes] = time12h.split(':').map(Number);
    let h = hours;
    if (period === 'PM' && hours !== 12) h += 12;
    if (period === 'AM' && hours === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
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

  // Fetch availability when date is selected
  const { data: availabilityData } = useQuery({
    queryKey: ['employee-availability', formData.scheduledDate, convertTo24h(formData.scheduledTimeStart, startPeriod)],
    queryFn: async () => {
      const params = new URLSearchParams({ date: formData.scheduledDate });
      const timeStr = convertTo24h(formData.scheduledTimeStart, startPeriod);
      if (timeStr) params.append('time', timeStr);
      const res = await fetch(`/api/employees/availability?${params}`);
      return res.json();
    },
    enabled: !!formData.scheduledDate,
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
  const getAvailabilityStatus = (memberId: string) => {
    const avail = availabilityMap.get(memberId);
    if (!avail) return null;
    return {
      isAvailable: avail.isAvailable,
      jobCount: avail.currentJobCount,
    };
  };

  // Sort team members by availability
  const getSortedTeamMembers = () => {
    if (!teamMembers) return [];

    if (availabilityMap.size === 0) return teamMembers;

    return [...teamMembers].sort((a, b) => {
      const aAvail = availabilityMap.get(a.id);
      const bAvail = availabilityMap.get(b.id);

      // Available first
      if (aAvail?.isAvailable && !bAvail?.isAvailable) return -1;
      if (!aAvail?.isAvailable && bAvail?.isAvailable) return 1;

      // Then by job count (less busy first)
      const aJobs = aAvail?.currentJobCount || 0;
      const bJobs = bAvail?.currentJobCount || 0;
      return aJobs - bJobs;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError('Seleccioná un cliente');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Build job data with simplified scheduling
    const jobData = {
      ...formData,
      customerId: selectedCustomer.id,
      technicianIds: formData.assignedToIds,
      serviceType: formData.serviceType || 'OTRO',
      scheduledTimeStart: convertTo24h(formData.scheduledTimeStart, startPeriod),
      scheduledTimeEnd: convertTo24h(formData.scheduledTimeEnd, endPeriod),
      // Duration type based on dates
      durationType: formData.scheduledEndDate ? 'MULTI_DAY' : 'SINGLE_VISIT',
      // Recurring config
      ...(formData.isRecurring && {
        durationType: 'RECURRING',
        recurrencePattern: formData.recurrencePattern,
        recurrenceCount: formData.recurrenceCount,
      }),
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
              ← Volver a usar la dirección del cliente
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

        {/* Schedule - Simplified: Start Date + Optional End Date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="scheduledDate" className="label mb-1 block">
              Fecha de inicio *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledDate: e.target.value })
                }
                className="input pl-10"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="scheduledEndDate" className="label mb-1 block">
              Fecha de fin <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="scheduledEndDate"
                type="date"
                value={formData.scheduledEndDate}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledEndDate: e.target.value })
                }
                className="input pl-10"
                min={formData.scheduledDate}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Solo para trabajos de varios días consecutivos
            </p>
          </div>
        </div>

        {/* Recurring option */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isRecurring}
              onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-gray-400" />
              <span className="font-medium text-gray-900">Mantenimiento recurrente</span>
            </div>
          </label>
          <p className="mt-1 ml-7 text-sm text-gray-500">
            Se repite periódicamente (ej: limpieza mensual de filtros)
          </p>

          {formData.isRecurring && (
            <div className="mt-4 ml-7 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="recurrencePattern" className="label mb-1 block">
                  Frecuencia
                </label>
                <select
                  id="recurrencePattern"
                  value={formData.recurrencePattern}
                  onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value })}
                  className="input"
                >
                  {RECURRENCE_PATTERNS.map((pattern) => (
                    <option key={pattern.value} value={pattern.value}>
                      {pattern.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="recurrenceCount" className="label mb-1 block">
                  Cantidad de repeticiones
                </label>
                <input
                  id="recurrenceCount"
                  type="number"
                  min={2}
                  max={24}
                  value={formData.recurrenceCount}
                  onChange={(e) => setFormData({ ...formData, recurrenceCount: parseInt(e.target.value) || 6 })}
                  className="input"
                />
              </div>
              <p className="sm:col-span-2 text-xs text-gray-500">
                Se crearán {formData.recurrenceCount} servicios con frecuencia {RECURRENCE_PATTERNS.find(p => p.value === formData.recurrencePattern)?.label.toLowerCase()}
              </p>
            </div>
          )}
        </div>

        {/* Time inputs with AM/PM toggle */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="scheduledTimeStart" className="label mb-1 block">
              Hora inicio
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="scheduledTimeStart"
                  type="text"
                  placeholder="09:00"
                  value={formData.scheduledTimeStart}
                  onChange={(e) => {
                    // Allow only numbers and colon, format as HH:MM
                    let val = e.target.value.replace(/[^0-9:]/g, '');
                    if (val.length === 2 && !val.includes(':')) val += ':';
                    if (val.length > 5) val = val.slice(0, 5);
                    setFormData({ ...formData, scheduledTimeStart: val });
                  }}
                  className="input pl-10"
                  maxLength={5}
                />
              </div>
              <button
                type="button"
                onClick={() => setStartPeriod(startPeriod === 'AM' ? 'PM' : 'AM')}
                className="flex h-[42px] w-16 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 transition-all hover:bg-primary-100 active:scale-95"
              >
                {startPeriod}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="scheduledTimeEnd" className="label mb-1 block">
              Hora fin
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="scheduledTimeEnd"
                  type="text"
                  placeholder="05:00"
                  value={formData.scheduledTimeEnd}
                  onChange={(e) => {
                    // Allow only numbers and colon, format as HH:MM
                    let val = e.target.value.replace(/[^0-9:]/g, '');
                    if (val.length === 2 && !val.includes(':')) val += ':';
                    if (val.length > 5) val = val.slice(0, 5);
                    setFormData({ ...formData, scheduledTimeEnd: val });
                  }}
                  className="input pl-10"
                  maxLength={5}
                />
              </div>
              <button
                type="button"
                onClick={() => setEndPeriod(endPeriod === 'AM' ? 'PM' : 'AM')}
                className="flex h-[42px] w-16 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 transition-all hover:bg-primary-100 active:scale-95"
              >
                {endPeriod}
              </button>
            </div>
          </div>
        </div>

        {/* Team member assignment - Multi-select */}
        <div>
          <label className="label mb-1 block">
            Asignar a (múltiples técnicos)
          </label>

          {/* Availability warning */}
          {formData.scheduledDate && availabilityData?.data?.availableCount === 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span>No hay técnicos disponibles para esta fecha/hora</span>
            </div>
          )}

          {/* Selected technicians display */}
          {formData.assignedToIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.assignedToIds.map((id) => {
                const member = teamMembers?.find((m) => m.id === id) ||
                  (currentUser?.id === id ? { id: currentUser.id, name: currentUser.name, role: 'CURRENT' } : null);
                if (!member) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-sm text-primary-700"
                  >
                    {member.name}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          assignedToIds: formData.assignedToIds.filter((tid) => tid !== id),
                        })
                      }
                      className="ml-1 rounded-full p-0.5 hover:bg-primary-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Dropdown trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTeamDropdown(!showTeamDropdown)}
              className="input flex w-full items-center justify-between pl-10 text-left"
            >
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <span className={formData.assignedToIds.length === 0 ? 'text-gray-400' : ''}>
                {formData.assignedToIds.length === 0
                  ? 'Seleccionar técnicos...'
                  : `${formData.assignedToIds.length} técnico(s) seleccionado(s)`}
              </span>
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showTeamDropdown && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-lg">
                <div className="max-h-60 overflow-auto py-1">
                  {/* Current user option */}
                  {currentUser && (() => {
                    const status = getAvailabilityStatus(currentUser.id);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const isSelected = formData.assignedToIds.includes(currentUser.id);
                          setFormData({
                            ...formData,
                            assignedToIds: isSelected
                              ? formData.assignedToIds.filter((id) => id !== currentUser.id)
                              : [...formData.assignedToIds, currentUser.id],
                          });
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                          formData.assignedToIds.includes(currentUser.id)
                            ? 'border-primary-600 bg-primary-600 text-white'
                            : 'border-gray-300'
                        }`}>
                          {formData.assignedToIds.includes(currentUser.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </span>
                        <span className="flex-1">
                          <span className="font-medium">Yo ({currentUser.name})</span>
                        </span>
                        {status && (
                          <span className={`text-xs ${status.isAvailable ? 'text-green-600' : 'text-amber-600'}`}>
                            {status.isAvailable
                              ? status.jobCount > 0 ? `✓ ${status.jobCount} trabajo(s)` : '✓ Disponible'
                              : '⚠ No disponible'}
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  {/* Team members */}
                  {getSortedTeamMembers()
                    .filter((member) => member.id !== currentUser?.id)
                    .map((member) => {
                      const status = getAvailabilityStatus(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            const isSelected = formData.assignedToIds.includes(member.id);
                            setFormData({
                              ...formData,
                              assignedToIds: isSelected
                                ? formData.assignedToIds.filter((id) => id !== member.id)
                                : [...formData.assignedToIds, member.id],
                            });
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                            formData.assignedToIds.includes(member.id)
                              ? 'border-primary-600 bg-primary-600 text-white'
                              : 'border-gray-300'
                          }`}>
                            {formData.assignedToIds.includes(member.id) && (
                              <Check className="h-3 w-3" />
                            )}
                          </span>
                          <span className="flex-1">
                            <span className="font-medium">{member.name}</span>
                            <span className="ml-1 text-sm text-gray-500">
                              {member.role === 'TECHNICIAN' ? '(Técnico)' : member.role === 'DISPATCHER' ? '(Despachador)' : ''}
                            </span>
                          </span>
                          {/* Availability indicator */}
                          {status && (
                            <span className={`text-xs ${status.isAvailable ? 'text-green-600' : 'text-amber-600'}`}>
                              {status.isAvailable
                                ? status.jobCount > 0 ? `✓ ${status.jobCount} trabajo(s)` : '✓ Disponible'
                                : '⚠ No disponible'}
                            </span>
                          )}
                        </button>
                      );
                    })}

                  {(!teamMembers || teamMembers.length === 0) && !currentUser && (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      No hay miembros del equipo disponibles
                    </div>
                  )}
                </div>

                {/* Close dropdown button */}
                <div className="border-t px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setShowTeamDropdown(false)}
                    className="w-full text-center text-sm text-primary-600 hover:underline"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link
              href="/dashboard/settings/team"
              className="text-primary-600 hover:underline"
            >
              + Agregar nuevo miembro al equipo
            </Link>
            {formData.scheduledDate && (
              <span className="text-gray-500">
                Disponibilidad para el {new Date(formData.scheduledDate + 'T12:00:00').toLocaleDateString('es-AR')}
                {formData.scheduledTimeStart && ` a las ${formData.scheduledTimeStart} ${startPeriod}`}
              </span>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/jobs" className="btn-outline">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Creando...' : 'Crear trabajo'}
          </button>
        </div>
      </form>
    </div>
  );
}
