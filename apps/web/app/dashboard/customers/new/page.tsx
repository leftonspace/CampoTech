'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { validateCUIT } from '@/lib/cuit';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

// Country codes for phone input
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
];

const IVA_CONDITIONS = [
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState('+54');
  const [cuitError, setCuitError] = useState('');
  const [cuitValid, setCuitValid] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    cuit: '',
    ivaCondition: 'CONSUMIDOR_FINAL',
    address: {
      street: '',
      city: '',
      postalCode: '',
    },
    notes: '',
  });

  const handleCuitChange = (value: string) => {
    setFormData({ ...formData, cuit: value });
    const digits = value.replace(/\D/g, '');

    // Only validate when we have 11 digits
    if (digits.length === 11) {
      const result = validateCUIT(digits);
      if (result.valid) {
        setCuitError('');
        setCuitValid(true);
      } else {
        setCuitError(result.error || 'CUIT inválido');
        setCuitValid(false);
      }
    } else if (digits.length > 0) {
      setCuitError('');
      setCuitValid(false);
    } else {
      setCuitError('');
      setCuitValid(false);
    }
  };

  const formatCuit = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate CUIT if provided
    const cuitDigits = formData.cuit.replace(/\D/g, '');
    if (cuitDigits.length > 0 && cuitDigits.length !== 11) {
      setError('El CUIT debe tener 11 dígitos');
      setIsSubmitting(false);
      return;
    }

    if (cuitDigits.length === 11) {
      const cuitResult = validateCUIT(cuitDigits);
      if (!cuitResult.valid) {
        setError(cuitResult.error || 'CUIT inválido');
        setIsSubmitting(false);
        return;
      }
    }

    const fullPhone = `${countryCode}${formData.phone.replace(/\D/g, '')}`;

    const response = await api.customers.create({
      name: formData.name,
      phone: fullPhone,
      email: formData.email || undefined,
      cuit: cuitDigits || undefined,
      ivaCondition: formData.ivaCondition,
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

        {/* CUIT & IVA */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cuit" className="label mb-1 block">
              CUIT
            </label>
            <div className="relative">
              <input
                id="cuit"
                type="text"
                value={formatCuit(formData.cuit)}
                onChange={(e) => handleCuitChange(e.target.value)}
                placeholder="XX-XXXXXXXX-X"
                className={`input pr-10 ${cuitError ? 'border-danger-500' : cuitValid ? 'border-success-500' : ''}`}
              />
              {(cuitValid || cuitError) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {cuitValid ? (
                    <CheckCircle className="h-5 w-5 text-success-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-danger-500" />
                  )}
                </div>
              )}
            </div>
            {cuitError && (
              <p className="mt-1 text-sm text-danger-500">{cuitError}</p>
            )}
          </div>
          <div>
            <label htmlFor="ivaCondition" className="label mb-1 block">
              Condición IVA
            </label>
            <select
              id="ivaCondition"
              value={formData.ivaCondition}
              onChange={(e) =>
                setFormData({ ...formData, ivaCondition: e.target.value })
              }
              className="input"
            >
              {IVA_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <label className="label block">Dirección</label>
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
            className="input"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              value={formData.address.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value },
                })
              }
              placeholder="Ciudad"
              className="input"
            />
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
              className="input"
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
