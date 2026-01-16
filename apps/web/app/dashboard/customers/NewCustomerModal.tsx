'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api-client';
import { ChevronDown, Check, X } from 'lucide-react';
import AddressAutocomplete, { ParsedAddress } from '@/components/ui/AddressAutocomplete';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════════════════

interface NewCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (customer: { id: string; name: string }) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRY CODES
// ═══════════════════════════════════════════════════════════════════════════════

const COUNTRY_CODES = [
    { code: '+54', country: 'Argentina', iso: 'ar', placeholder: '11 1234 5678' },
    { code: '+56', country: 'Chile', iso: 'cl', placeholder: '9 1234 5678' },
    { code: '+598', country: 'Uruguay', iso: 'uy', placeholder: '94 123 456' },
    { code: '+595', country: 'Paraguay', iso: 'py', placeholder: '981 123 456' },
    { code: '+55', country: 'Brasil', iso: 'br', placeholder: '11 91234 5678' },
    { code: '+591', country: 'Bolivia', iso: 'bo', placeholder: '7 123 4567' },
    { code: '+51', country: 'Perú', iso: 'pe', placeholder: '912 345 678' },
    { code: '+57', country: 'Colombia', iso: 'co', placeholder: '310 123 4567' },
    { code: '+52', country: 'México', iso: 'mx', placeholder: '55 1234 5678' },
    { code: '+1', country: 'USA/Canadá', iso: 'us', placeholder: '(555) 123-4567' },
    { code: 'OTHER', country: 'Otro', iso: 'un', placeholder: '123 456 7890' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FLAG COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function FlagImage({ iso, size = 20 }: { iso: string; size?: number }) {
    if (iso === 'un') {
        return (
            <span
                className="flex items-center justify-center rounded-sm"
                style={{ width: size, height: Math.round(size * 0.75), fontSize: size * 0.8 }}
            >
                🌍
            </span>
        );
    }

    return (
        <Image
            src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
            alt={`${iso} flag`}
            width={size}
            height={Math.round(size * 0.75)}
        />
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

const formatPhoneNumber = (phone: string, countryCode: string): string => {
    const digits = phone.replace(/\D/g, '');

    switch (countryCode) {
        case '+54':
        case '+52':
            if (digits.length <= 2) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;

        case '+56':
            if (digits.length <= 1) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;

        case '+598':
            if (digits.length <= 2) return digits;
            if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;

        case '+595':
        case '+51':
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;

        case '+55':
            if (digits.length <= 2) return digits;
            if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
            return `${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7, 11)}`;

        case '+591':
            if (digits.length <= 1) return digits;
            if (digits.length <= 4) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
            return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 8)}`;

        case '+57':
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;

        case '+1':
            if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : '';
            if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

        default:
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function NewCustomerModal({ isOpen, onClose, onSuccess }: NewCustomerModalProps) {
    const [mounted, setMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [countryCode, setCountryCode] = useState('+54');
    const [customCountryCode, setCustomCountryCode] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

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

    // SSR safety
    useEffect(() => {
        setMounted(true);
    }, []);

    // Animate in/out
    useEffect(() => {
        if (isOpen) {
            // Small delay to trigger CSS transition
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close country dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowCountryPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            onClose();
            // Reset form
            setFormData({
                name: '',
                phone: '',
                email: '',
                address: {
                    street: '',
                    city: '',
                    postalCode: '',
                    state: '',
                    fullAddress: '',
                    lat: undefined,
                    lng: undefined,
                },
                notes: '',
            });
            setError('');
            setCountryCode('+54');
            setCustomCountryCode('');
        }, 200);
    };

    const getActualCountryCode = () => {
        if (countryCode === 'OTHER') {
            return customCountryCode.startsWith('+') ? customCountryCode : `+${customCountryCode}`;
        }
        return countryCode;
    };

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

        const actualCode = getActualCountryCode();
        const fullPhone = `${actualCode}${formData.phone.replace(/\D/g, '')}`;

        const response = await api.customers.create({
            name: formData.name,
            phone: fullPhone,
            email: formData.email || undefined,
            address: formData.address,
            notes: formData.notes || undefined,
        });

        if (response.success) {
            const customer = response.data as { id: string; name: string };
            onSuccess?.(customer);
            handleClose();
        } else {
            setError(response.error?.message || 'Error al crear el cliente');
        }

        setIsSubmitting(false);
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            className={cn(
                'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200',
                isVisible ? 'bg-black/60' : 'bg-transparent pointer-events-none'
            )}
            onClick={handleClose}
        >
            <div
                className={cn(
                    'bg-white rounded-2xl shadow-xl w-full max-w-2xl transform transition-all duration-200 overflow-hidden',
                    isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scrollable content wrapper */}
                <div className="max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between py-3 px-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Nuevo cliente</h1>
                            <p className="text-sm text-gray-500">Agregar un cliente a tu cartera</p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Name & Phone in 2 columns */}
                        <div className="grid gap-4 sm:grid-cols-2">
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
                                    autoFocus
                                />
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
                        </div>

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone" className="label mb-1 block">
                                Teléfono *
                            </label>
                            <div className="flex rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
                                {/* Country Selector */}
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                                        className="flex items-center gap-1.5 h-10 px-3 border-r border-gray-300 bg-gray-50 rounded-l-md hover:bg-gray-100 transition-colors focus:outline-none"
                                    >
                                        <FlagImage iso={selectedCountry.iso} size={20} />
                                        <span className="text-sm text-gray-700 font-medium">
                                            {countryCode === 'OTHER' ? 'Otro' : countryCode}
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    </button>

                                    {showCountryPicker && (
                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                            <div className="p-2 border-b border-gray-100">
                                                <span className="text-xs font-medium text-gray-500 uppercase">Seleccionar país</span>
                                            </div>
                                            {COUNTRY_CODES.map((country) => (
                                                <button
                                                    key={country.code}
                                                    type="button"
                                                    onClick={() => {
                                                        setCountryCode(country.code);
                                                        setFormData({ ...formData, phone: '' });
                                                        setShowCountryPicker(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                                                >
                                                    <FlagImage iso={country.iso} size={20} />
                                                    <span className="flex-1 text-left text-sm text-gray-700">{country.country}</span>
                                                    <span className="text-sm text-gray-500">
                                                        {country.code === 'OTHER' ? 'Otro' : country.code}
                                                    </span>
                                                    {country.code === countryCode && (
                                                        <Check className="h-4 w-4 text-green-600" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Custom Country Code */}
                                {countryCode === 'OTHER' && (
                                    <input
                                        type="text"
                                        value={customCountryCode}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^+\d]/g, '');
                                            const cleaned = value.startsWith('+')
                                                ? '+' + value.slice(1).replace(/\+/g, '')
                                                : value.replace(/\+/g, '');
                                            setCustomCountryCode(cleaned);
                                        }}
                                        placeholder="+XX"
                                        className="w-16 h-10 px-2 text-sm text-center border-r border-gray-300 bg-transparent placeholder:text-gray-400 focus:outline-none"
                                        maxLength={5}
                                    />
                                )}

                                {/* Phone Input */}
                                <input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => {
                                        const actualCode = getActualCountryCode();
                                        const formatted = formatPhoneNumber(e.target.value, actualCode);
                                        setFormData({ ...formData, phone: formatted });
                                    }}
                                    placeholder={selectedCountry.placeholder}
                                    className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none"
                                    required
                                />
                            </div>
                            {countryCode === 'OTHER' && (
                                <p className="mt-1 text-xs text-gray-500">
                                    Ingresá el código de país (ej: +34 para España)
                                </p>
                            )}
                        </div>

                        {/* Address */}
                        <div className="space-y-3">
                            <label className="label block">Dirección</label>
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

                            {/* Editable address fields */}
                            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                                <p className="text-xs font-medium text-gray-500 uppercase">Detalles de dirección</p>
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
                                    className="input bg-white text-sm"
                                />
                                <div className="grid gap-2 sm:grid-cols-3">
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
                                        className="input bg-white text-sm"
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
                                        placeholder="Provincia"
                                        className="input bg-white text-sm"
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
                                        placeholder="C.P."
                                        className="input bg-white text-sm"
                                    />
                                </div>
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
                                rows={2}
                                className="input"
                            />
                        </div>

                        {error && <p className="text-sm text-danger-500">{error}</p>}

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                            <button type="button" onClick={handleClose} className="btn-outline py-2 px-4 text-sm">
                                Cancelar
                            </button>
                            <button type="submit" disabled={isSubmitting} className="btn-primary py-2 px-4 text-sm">
                                {isSubmitting ? 'Creando...' : 'Crear cliente'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
