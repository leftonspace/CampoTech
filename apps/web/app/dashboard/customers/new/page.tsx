'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ArrowLeft } from 'lucide-react';
import AddressAutocomplete, { ParsedAddress } from '@/components/ui/AddressAutocomplete';

// Country codes for phone input
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState('+54');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      postalCode: '',
      state: '',
      fullAddress: '',
      lat: undefined as number | undefined,
      lng: undefined as number | undefined,
    },
    notes: '',
  });

  // Handle address selection from autocomplete
  const handleAddressSelect = (parsed: ParsedAddress) => {
    setFormData({
      ...formData,
      address: {
        street: parsed.street,
        city: parsed.city,
        postalCode: parsed.postalCode,
        state: parsed.state,
        fullAddress: parsed.fullAddress,
        lat: parsed.lat,
        lng: parsed.lng,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const fullPhone = `${countryCode}${formData.phone.replace(/\D/g, '')}`;

    const response = await api.customers.create({
      name: formData.name,
      phone: fullPhone,
      email: formData.email || undefined,
      address: formData.address,
      notes: formData.notes || undefined,
    });

    if (response.success) {
      router.push('/dashboard/customers');
    } else {
      setError(response.error?.message || 'Error al crear el cliente');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/customers"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo cliente</h1>
          <p className="text-gray-500">Agregar un cliente a tu cartera</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="label mb-1 block">
            Nombre / Razón social *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Juan Pérez o Mi Empresa SRL"
            className="input"
            required
            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, completá este campo')}
            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="label mb-1 block">
            Teléfono *
          </label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="input w-32 px-2"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
              }
              placeholder="11 1234 5678"
              className="input flex-1"
              required
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá un número de teléfono')}
              onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="label mb-1 block">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="cliente@email.com"
            className="input"
          />
        </div>

        {/* Address with Google Places Autocomplete */}
        <div className="space-y-4">
          <label className="label block">Dirección</label>

          {/* Address Autocomplete Search */}
          <AddressAutocomplete
            value={formData.address.fullAddress}
            onChange={(value) =>
              setFormData({
                ...formData,
                address: { ...formData.address, fullAddress: value },
              })
            }
            onSelect={handleAddressSelect}
            placeholder="Buscar dirección..."
            defaultCountry="AR"
          />

          {/* Editable address fields (shown after selection or for manual entry) */}
          <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Detalles de dirección (editables)</p>
            <input
              type="text"
              value={formData.address.street}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, street: e.target.value },
                })
              }
              placeholder="Calle y número"
              className="input bg-white"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, city: e.target.value },
                  })
                }
                placeholder="Ciudad / Localidad"
                className="input bg-white"
              />
              <input
                type="text"
                value={formData.address.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, state: e.target.value },
                  })
                }
                placeholder="Provincia / Estado"
                className="input bg-white"
              />
            </div>
            <input
              type="text"
              value={formData.address.postalCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, postalCode: e.target.value },
                })
              }
              placeholder="Código postal"
              className="input bg-white sm:w-1/2"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="label mb-1 block">
            Notas
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notas adicionales sobre el cliente..."
            rows={3}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/customers" className="btn-outline">
            Cancelar
          </Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
