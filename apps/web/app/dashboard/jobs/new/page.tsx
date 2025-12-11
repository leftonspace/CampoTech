'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Search, Calendar, Clock, User, MapPin } from 'lucide-react';
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

export default function NewJobPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [useCustomerAddress, setUseCustomerAddress] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    priority: 'normal',
    scheduledDate: '',
    scheduledTimeStart: '',
    scheduledTimeEnd: '',
    assignedToId: '',
  });

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

  const customers = customersData?.data as Customer[] | undefined;
  const teamMembers = usersData?.data as Array<{ id: string; name: string; role: string }> | undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setError('Seleccioná un cliente');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const response = await api.jobs.create({
      ...formData,
      customerId: selectedCustomer.id,
    });

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

        {/* Schedule */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="scheduledDate" className="label mb-1 block">
              Fecha
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
              />
            </div>
          </div>
          <div>
            <label htmlFor="scheduledTimeStart" className="label mb-1 block">
              Hora inicio
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="scheduledTimeStart"
                type="time"
                value={formData.scheduledTimeStart}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledTimeStart: e.target.value })
                }
                className="input pl-10"
              />
            </div>
          </div>
          <div>
            <label htmlFor="scheduledTimeEnd" className="label mb-1 block">
              Hora fin
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="scheduledTimeEnd"
                type="time"
                value={formData.scheduledTimeEnd}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledTimeEnd: e.target.value })
                }
                className="input pl-10"
              />
            </div>
          </div>
        </div>

        {/* Team member assignment */}
        <div>
          <label htmlFor="assignedToId" className="label mb-1 block">
            Asignar a
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              id="assignedToId"
              value={formData.assignedToId}
              onChange={(e) =>
                setFormData({ ...formData, assignedToId: e.target.value })
              }
              className="input pl-10"
            >
              <option value="">Sin asignar</option>
              {currentUser && (
                <option value={currentUser.id}>
                  Yo ({currentUser.name})
                </option>
              )}
              {teamMembers
                ?.filter((member) => member.id !== currentUser?.id)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} {member.role === 'TECHNICIAN' ? '(Técnico)' : member.role === 'ADMIN' ? '(Admin)' : ''}
                  </option>
                ))}
            </select>
          </div>
          <Link
            href="/dashboard/settings/team"
            className="mt-2 inline-block text-sm text-primary-600 hover:underline"
          >
            + Agregar nuevo miembro al equipo
          </Link>
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
