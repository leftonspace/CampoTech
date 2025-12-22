'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ArrowLeft } from 'lucide-react';
import AddressAutocomplete, { ParsedAddress } from '@/components/ui/AddressAutocomplete';

// Country codes for phone input with format patterns
const COUNTRY_CODES = [
  // South America
  { code: '+54', country: 'Argentina', flag: '🇦🇷', placeholder: '11 1234 5678', format: 'XX XXXX XXXX' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷', placeholder: '11 91234 5678', format: 'XX XXXXX XXXX' },
  { code: '+56', country: 'Chile', flag: '🇨🇱', placeholder: '9 1234 5678', format: 'X XXXX XXXX' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', placeholder: '310 123 4567', format: 'XXX XXX XXXX' },
  { code: '+51', country: 'Perú', flag: '🇵🇪', placeholder: '912 345 678', format: 'XXX XXX XXX' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪', placeholder: '412 123 4567', format: 'XXX XXX XXXX' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨', placeholder: '99 123 4567', format: 'XX XXX XXXX' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴', placeholder: '7 123 4567', format: 'X XXX XXXX' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾', placeholder: '981 123 456', format: 'XXX XXX XXX' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾', placeholder: '94 123 456', format: 'XX XXX XXX' },
  { code: '+592', country: 'Guyana', flag: '🇬🇾', placeholder: '621 1234', format: 'XXX XXXX' },
  { code: '+597', country: 'Surinam', flag: '🇸🇷', placeholder: '812 3456', format: 'XXX XXXX' },
  // Central America & Mexico
  { code: '+52', country: 'México', flag: '🇲🇽', placeholder: '55 1234 5678', format: 'XX XXXX XXXX' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹', placeholder: '5123 4567', format: 'XXXX XXXX' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻', placeholder: '7012 3456', format: 'XXXX XXXX' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳', placeholder: '9123 4567', format: 'XXXX XXXX' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮', placeholder: '8123 4567', format: 'XXXX XXXX' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷', placeholder: '8312 3456', format: 'XXXX XXXX' },
  { code: '+507', country: 'Panamá', flag: '🇵🇦', placeholder: '6123 4567', format: 'XXXX XXXX' },
  { code: '+501', country: 'Belice', flag: '🇧🇿', placeholder: '622 1234', format: 'XXX XXXX' },
  // Caribbean
  { code: '+53', country: 'Cuba', flag: '🇨🇺', placeholder: '5 123 4567', format: 'X XXX XXXX' },
  { code: '+1809', country: 'Rep. Dominicana', flag: '🇩🇴', placeholder: '809 123 4567', format: 'XXX XXX XXXX' },
  { code: '+1787', country: 'Puerto Rico', flag: '🇵🇷', placeholder: '787 123 4567', format: 'XXX XXX XXXX' },
  // North America
  { code: '+1', country: 'USA/Canadá', flag: '🇺🇸', placeholder: '(555) 123-4567', format: '(XXX) XXX-XXXX' },
];

// Format phone number based on country code
const formatPhoneNumber = (phone: string, countryCode: string): string => {
  const digits = phone.replace(/\D/g, '');

  switch (countryCode) {
    case '+54': // Argentina: XX XXXX XXXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;

    case '+1': // USA/Canada: (XXX) XXX-XXXX
    case '+1809': // Dominican Republic
    case '+1787': // Puerto Rico
      if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : '';
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

    case '+52': // México: XX XXXX XXXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;

    case '+55': // Brasil: XX XXXXX XXXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7, 11)}`;

    case '+56': // Chile: X XXXX XXXX
    case '+53': // Cuba: X XXX XXXX
      if (digits.length <= 1) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;

    case '+57': // Colombia: XXX XXX XXXX
    case '+58': // Venezuela: XXX XXX XXXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;

    case '+51': // Perú: XXX XXX XXX
    case '+595': // Paraguay: XXX XXX XXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;

    case '+593': // Ecuador: XX XXX XXXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;

    case '+591': // Bolivia: X XXX XXXX
      if (digits.length <= 1) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;

    case '+598': // Uruguay: XX XXX XXX
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;

    case '+592': // Guyana: XXX XXXX
    case '+597': // Surinam: XXX XXXX
    case '+501': // Belice: XXX XXXX
      if (digits.length <= 3) return digits;
      return `${digits.slice(0, 3)} ${digits.slice(3, 7)}`;

    case '+502': // Guatemala: XXXX XXXX
    case '+503': // El Salvador: XXXX XXXX
    case '+504': // Honduras: XXXX XXXX
    case '+505': // Nicaragua: XXXX XXXX
    case '+506': // Costa Rica: XXXX XXXX
    case '+507': // Panamá: XXXX XXXX
      if (digits.length <= 4) return digits;
      return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;

    default:
      return digits;
  }
};

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
              onChange={(e) => {
                setCountryCode(e.target.value);
                // Re-format phone when country changes
                if (formData.phone) {
                  const digits = formData.phone.replace(/\D/g, '');
                  setFormData({ ...formData, phone: formatPhoneNumber(digits, e.target.value) });
                }
              }}
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
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value, countryCode);
                setFormData({ ...formData, phone: formatted });
              }}
              placeholder={COUNTRY_CODES.find(c => c.code === countryCode)?.placeholder || '11 1234 5678'}
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
