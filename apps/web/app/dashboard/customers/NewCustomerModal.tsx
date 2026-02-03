'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import AddressAutocomplete, { type ParsedAddress } from '@/components/ui/AddressAutocomplete';
import { api } from '@/lib/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
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
    { code: '+598', country: 'Uruguay', iso: 'uy', placeholder: '99 123 456' },
    { code: '+595', country: 'Paraguay', iso: 'py', placeholder: '961 123 456' },
    { code: '+55', country: 'Brasil', iso: 'br', placeholder: '11 91234 5678' },
    { code: '+591', country: 'Bolivia', iso: 'bo', placeholder: '7 123 4567' },
    { code: '+51', country: 'Perú', iso: 'pe', placeholder: '912 345 678' },
    { code: '+57', country: 'Colombia', iso: 'co', placeholder: '301 234 5678' },
    { code: '+52', country: 'México', iso: 'mx', placeholder: '55 1234 5678' },
    { code: '+1', country: 'USA/Canada', iso: 'us', placeholder: '(555) 123-4567' },
    { code: 'OTHER', country: 'Otro', iso: 'un', placeholder: '123 456 7890' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER TYPES (Argentine Market)
// ═══════════════════════════════════════════════════════════════════════════════

const CUSTOMER_TYPES = [
    { value: 'PARTICULAR', label: 'Particular', description: 'Ciudadano individual' },
    { value: 'CONSORCIO', label: 'Consorcio', description: 'Administración de edificio' },
    { value: 'COUNTRY', label: 'Country / Barrio Privado', description: 'Comunidad cerrada' },
    { value: 'COMERCIO', label: 'Comercio', description: 'Local comercial' },
    { value: 'INDUSTRIAL', label: 'Industrial', description: 'Fábrica, depósito' },
    { value: 'INSTITUCIONAL', label: 'Institucional', description: 'Escuela, hospital' },
    { value: 'ADMINISTRADORA', label: 'Administradora', description: 'Gestora de propiedades' },
    { value: 'CONSTRUCTORA', label: 'Constructora', description: 'Empresa de construcción' },
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
                {"\u{1F30D}"}</span>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
            alt={`${iso} flag`}
            width={size}
            height={Math.round(size * 0.75)}
            className="object-contain"
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
// FORM DATA TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface FormData {
    customerType: string;
    // Core fields - labels adapt based on type
    name: string;
    phone: string;
    email: string;
    // Common
    cuit: string;
    razonSocial: string;
    // CONSORCIO
    encargadoName: string;
    encargadoPhone: string;
    unitsCount: string;
    accessHours: string;
    // COUNTRY
    countryName: string;
    lotNumber: string;
    securityContact: string;
    entryRequirements: string;
    allowedEntryHours: string;
    // COMERCIO
    businessType: string;
    businessHours: string;
    // INDUSTRIAL
    safetyContact: string;
    epp: string;
    plantHours: string;
    // INSTITUCIONAL
    institutionType: string;
    maintenanceContact: string;
    serviceHours: string;
    // ADMINISTRADORA
    propertyCount: string;
    operationsContact: string;
    ticketingSystem: string;
    // CONSTRUCTORA
    currentProject: string;
    projectManager: string;
    siteRequirements: string;
    // Address + Notes
    address: {
        street: string;
        city: string;
        postalCode: string;
        state: string;
        fullAddress: string;
        lat?: number;
        lng?: number;
    };
    notes: string;
}

const getInitialFormData = (): FormData => ({
    customerType: 'PARTICULAR',
    name: '',
    phone: '',
    email: '',
    cuit: '',
    razonSocial: '',
    encargadoName: '',
    encargadoPhone: '',
    unitsCount: '',
    accessHours: '',
    countryName: '',
    lotNumber: '',
    securityContact: '',
    entryRequirements: '',
    allowedEntryHours: '',
    businessType: '',
    businessHours: '',
    safetyContact: '',
    epp: '',
    plantHours: '',
    institutionType: '',
    maintenanceContact: '',
    serviceHours: '',
    propertyCount: '',
    operationsContact: '',
    ticketingSystem: '',
    currentProject: '',
    projectManager: '',
    siteRequirements: '',
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

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD LABELS BY TYPE - Contextual labels for name, phone, email
// ═══════════════════════════════════════════════════════════════════════════════

const getFieldLabels = (customerType: string) => {
    switch (customerType) {
        case 'CONSORCIO':
            return {
                name: 'Nombre del Consorcio / Edificio *',
                namePlaceholder: 'Consorcio Edificio Las Flores',
                phone: 'Teléfono del Administrador *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email del Administrador',
                emailPlaceholder: 'admin@consorcio.com',
            };
        case 'COUNTRY':
            return {
                name: 'Nombre del Propietario *',
                namePlaceholder: 'Juan Pérez',
                phone: 'Teléfono del Propietario *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'propietario@email.com',
            };
        case 'COMERCIO':
            return {
                name: 'Nombre del Comercio *',
                namePlaceholder: 'Restaurante El Buen Sabor',
                phone: 'Teléfono *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'contacto@comercio.com',
            };
        case 'INDUSTRIAL':
            return {
                name: 'Nombre de la Empresa *',
                namePlaceholder: 'Industrias XYZ S.A.',
                phone: 'Teléfono de Contacto *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'contacto@industria.com',
            };
        case 'INSTITUCIONAL':
            return {
                name: 'Nombre de la Institución *',
                namePlaceholder: 'Escuela N°5 Manuel Belgrano',
                phone: 'Teléfono *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'contacto@institucion.edu.ar',
            };
        case 'ADMINISTRADORA':
            return {
                name: 'Nombre de la Administradora *',
                namePlaceholder: 'Administraciones López SRL',
                phone: 'Teléfono *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'contacto@administradora.com',
            };
        case 'CONSTRUCTORA':
            return {
                name: 'Nombre de la Constructora *',
                namePlaceholder: 'Construcciones del Sur S.A.',
                phone: 'Teléfono *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'contacto@constructora.com',
            };
        default: // PARTICULAR
            return {
                name: 'Nombre completo *',
                namePlaceholder: 'Juan Pérez',
                phone: 'Teléfono *',
                phonePlaceholder: '11 1234 5678',
                email: 'Email',
                emailPlaceholder: 'cliente@email.com',
            };
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

    const [formData, setFormData] = useState<FormData>(getInitialFormData());
    const labels = getFieldLabels(formData.customerType);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

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
            setFormData(getInitialFormData());
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

        // Build notes with type-specific fields
        let enrichedNotes = formData.notes;
        const addField = (label: string, value: string) => {
            if (value.trim()) {
                enrichedNotes = enrichedNotes ? `${enrichedNotes}\n${label}: ${value}` : `${label}: ${value}`;
            }
        };

        // Add type-specific fields to notes
        // Store operational info first (technician-relevant), billing info last
        switch (formData.customerType) {
            case 'CONSORCIO':
                // Operational - who to contact, when to access
                addField('Encargado', formData.encargadoName);
                addField('Tel. Encargado', formData.encargadoPhone);
                addField('Horario de acceso', formData.accessHours);
                addField('Unidades', formData.unitsCount);
                // Billing
                addField('CUIT', formData.cuit);
                addField('Razón Social', formData.razonSocial);
                break;
            case 'COUNTRY':
                // Operational - entry requirements, security contact
                addField('Seguridad', formData.securityContact);
                addField('Requisitos de ingreso', formData.entryRequirements);
                addField('Horario permitido', formData.allowedEntryHours);
                addField('Lote/Casa', formData.lotNumber);
                addField('Nombre del Country', formData.countryName);
                break;
            case 'COMERCIO':
                // Operational - when open
                addField('Horario comercial', formData.businessHours);
                addField('Rubro', formData.businessType);
                // Billing
                addField('CUIT', formData.cuit);
                addField('Razón Social', formData.razonSocial);
                break;
            case 'INDUSTRIAL':
                // Operational - safety requirements (CRITICAL for technicians)
                addField('⚠️ Requisitos EPP', formData.epp);
                addField('Contacto Seg. e Higiene', formData.safetyContact);
                addField('Horario de planta', formData.plantHours);
                // Billing
                addField('CUIT', formData.cuit);
                addField('Razón Social', formData.razonSocial);
                break;
            case 'INSTITUCIONAL':
                // Operational - who to contact, when to access
                addField('Contacto mantenimiento', formData.maintenanceContact);
                addField('Horario de atención', formData.serviceHours);
                addField('Tipo de institución', formData.institutionType);
                // Billing
                addField('CUIT', formData.cuit);
                addField('Razón Social', formData.razonSocial);
                break;
            case 'ADMINISTRADORA':
                // Operational - who to contact
                addField('Contacto operaciones', formData.operationsContact);
                addField('Sistema de tickets', formData.ticketingSystem);
                addField('Cantidad de propiedades', formData.propertyCount);
                // Billing
                addField('CUIT', formData.cuit);
                addField('Razón Social', formData.razonSocial);
                break;
            case 'CONSTRUCTORA':
                // Operational - safety/entry requirements (CRITICAL for technicians)
                addField('⚠️ Requisitos de obra', formData.siteRequirements);
                addField('Jefe de obra', formData.projectManager);
                addField('Obra actual', formData.currentProject);
                // Billing
                addField('CUIT', formData.cuit);
                addField('Razón Social', formData.razonSocial);
                break;
        }

        const response = await api.customers.create({
            name: formData.name,
            phone: fullPhone,
            email: formData.email || undefined,
            customerType: formData.customerType,
            address: formData.address,
            notes: enrichedNotes || undefined,
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

    const selectedType = CUSTOMER_TYPES.find(t => t.value === formData.customerType);

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

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* CUSTOMER TYPE - Simple dropdown */}
                        <div>
                            <label htmlFor="customerType" className="label mb-1 block">
                                Tipo de cliente
                            </label>
                            <select
                                id="customerType"
                                value={formData.customerType}
                                onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                                className="input"
                            >
                                {CUSTOMER_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">{selectedType?.description}</p>
                        </div>

                        {/* CORE FIELDS - Labels adapt based on type */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="name" className="label mb-1 block">
                                    {labels.name}
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={labels.namePlaceholder}
                                    className="input"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="label mb-1 block">
                                    {labels.email}
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder={labels.emailPlaceholder}
                                    className="input"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone" className="label mb-1 block">
                                {labels.phone}
                            </label>
                            <div className="flex rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
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

                                <input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => {
                                        const actualCode = getActualCountryCode();
                                        const formatted = formatPhoneNumber(e.target.value, actualCode);
                                        setFormData({ ...formData, phone: formatted });
                                    }}
                                    placeholder={labels.phonePlaceholder}
                                    className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════════════════════════════════════
                            TYPE-SPECIFIC FIELDS
                        ═══════════════════════════════════════════════════════════════════════════════ */}

                        {/* CONSORCIO Fields */}
                        {formData.customerType === 'CONSORCIO' && (
                            <>
                                {/* Billing Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Facturación</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">CUIT</label>
                                            <input
                                                type="text"
                                                value={formData.cuit}
                                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                                placeholder="30-12345678-9"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Razón Social</label>
                                            <input
                                                type="text"
                                                value={formData.razonSocial}
                                                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                                                placeholder="Consorcio de Propietarios Edificio..."
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Operational Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos Operativos</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">Nombre del Encargado</label>
                                            <input
                                                type="text"
                                                value={formData.encargadoName}
                                                onChange={(e) => setFormData({ ...formData, encargadoName: e.target.value })}
                                                placeholder="Pedro Gómez"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Teléfono del Encargado</label>
                                            <input
                                                type="tel"
                                                value={formData.encargadoPhone}
                                                onChange={(e) => setFormData({ ...formData, encargadoPhone: e.target.value })}
                                                placeholder="+54 11 5555 1234"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Número de Unidades</label>
                                            <input
                                                type="text"
                                                value={formData.unitsCount}
                                                onChange={(e) => setFormData({ ...formData, unitsCount: e.target.value })}
                                                placeholder="48 unidades"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Horario de Acceso</label>
                                            <input
                                                type="text"
                                                value={formData.accessHours}
                                                onChange={(e) => setFormData({ ...formData, accessHours: e.target.value })}
                                                placeholder="Lunes a Viernes 8:00-18:00"
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* COUNTRY Fields */}
                        {formData.customerType === 'COUNTRY' && (
                            <div className="space-y-4 pt-2 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-500 uppercase">Datos del Country</p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="label mb-1 block">Nombre del Country</label>
                                        <input
                                            type="text"
                                            value={formData.countryName}
                                            onChange={(e) => setFormData({ ...formData, countryName: e.target.value })}
                                            placeholder="Nordelta, Pilar del Este..."
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block">Lote / Número de casa</label>
                                        <input
                                            type="text"
                                            value={formData.lotNumber}
                                            onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                            placeholder="Lote 45, Casa 12"
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block">Contacto de Seguridad</label>
                                        <input
                                            type="text"
                                            value={formData.securityContact}
                                            onChange={(e) => setFormData({ ...formData, securityContact: e.target.value })}
                                            placeholder="Guardia: +54 11 5555 0000"
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="label mb-1 block">Horario de Ingreso</label>
                                        <input
                                            type="text"
                                            value={formData.allowedEntryHours}
                                            onChange={(e) => setFormData({ ...formData, allowedEntryHours: e.target.value })}
                                            placeholder="8:00-18:00"
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label mb-1 block">Requisitos de Ingreso</label>
                                    <input
                                        type="text"
                                        value={formData.entryRequirements}
                                        onChange={(e) => setFormData({ ...formData, entryRequirements: e.target.value })}
                                        placeholder="Pre-autorización, DNI, patente..."
                                        className="input"
                                    />
                                </div>
                            </div>
                        )}

                        {/* COMERCIO Fields */}
                        {formData.customerType === 'COMERCIO' && (
                            <>
                                {/* Billing Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Facturación</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">CUIT</label>
                                            <input
                                                type="text"
                                                value={formData.cuit}
                                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                                placeholder="30-12345678-9"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Razón Social</label>
                                            <input
                                                type="text"
                                                value={formData.razonSocial}
                                                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                                                placeholder="Comercio S.A."
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Operational Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos Operativos</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">Rubro / Actividad</label>
                                            <input
                                                type="text"
                                                value={formData.businessType}
                                                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                                                placeholder="Restaurante, Farmacia..."
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Horario Comercial</label>
                                            <input
                                                type="text"
                                                value={formData.businessHours}
                                                onChange={(e) => setFormData({ ...formData, businessHours: e.target.value })}
                                                placeholder="9:00-21:00"
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* INDUSTRIAL Fields */}
                        {formData.customerType === 'INDUSTRIAL' && (
                            <>
                                {/* Billing Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Facturación</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">CUIT</label>
                                            <input
                                                type="text"
                                                value={formData.cuit}
                                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                                placeholder="30-12345678-9"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Razón Social</label>
                                            <input
                                                type="text"
                                                value={formData.razonSocial}
                                                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                                                placeholder="Industrias XYZ S.A."
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Operational Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Seguridad e Higiene</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">Contacto Seg. e Higiene</label>
                                            <input
                                                type="text"
                                                value={formData.safetyContact}
                                                onChange={(e) => setFormData({ ...formData, safetyContact: e.target.value })}
                                                placeholder="Nombre y teléfono"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Horario de Planta</label>
                                            <input
                                                type="text"
                                                value={formData.plantHours}
                                                onChange={(e) => setFormData({ ...formData, plantHours: e.target.value })}
                                                placeholder="24/7 o turnos"
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label mb-1 block">Requisitos de EPP</label>
                                        <input
                                            type="text"
                                            value={formData.epp}
                                            onChange={(e) => setFormData({ ...formData, epp: e.target.value })}
                                            placeholder="Casco, chaleco, zapatos de seguridad..."
                                            className="input"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* INSTITUCIONAL Fields */}
                        {formData.customerType === 'INSTITUCIONAL' && (
                            <>
                                {/* Billing Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Facturación</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">CUIT</label>
                                            <input
                                                type="text"
                                                value={formData.cuit}
                                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                                placeholder="30-12345678-9"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Razón Social</label>
                                            <input
                                                type="text"
                                                value={formData.razonSocial}
                                                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                                                placeholder="Escuela N°5 Manuel Belgrano"
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Operational Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos Operativos</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">Tipo de Institución</label>
                                            <select
                                                value={formData.institutionType}
                                                onChange={(e) => setFormData({ ...formData, institutionType: e.target.value })}
                                                className="input"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="escuela">Escuela</option>
                                                <option value="hospital">Hospital / Centro de Salud</option>
                                                <option value="gobierno">Gobierno</option>
                                                <option value="universidad">Universidad</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Horario de Atención</label>
                                            <input
                                                type="text"
                                                value={formData.serviceHours}
                                                onChange={(e) => setFormData({ ...formData, serviceHours: e.target.value })}
                                                placeholder="8:00-16:00 días hábiles"
                                                className="input"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label mb-1 block">Contacto de Mantenimiento</label>
                                            <input
                                                type="text"
                                                value={formData.maintenanceContact}
                                                onChange={(e) => setFormData({ ...formData, maintenanceContact: e.target.value })}
                                                placeholder="Nombre y teléfono"
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ADMINISTRADORA Fields */}
                        {formData.customerType === 'ADMINISTRADORA' && (
                            <>
                                {/* Billing Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Facturación</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">CUIT</label>
                                            <input
                                                type="text"
                                                value={formData.cuit}
                                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                                placeholder="30-12345678-9"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Razón Social</label>
                                            <input
                                                type="text"
                                                value={formData.razonSocial}
                                                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                                                placeholder="Administraciones López SRL"
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Operational Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos Operativos</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">Cantidad de Propiedades</label>
                                            <input
                                                type="text"
                                                value={formData.propertyCount}
                                                onChange={(e) => setFormData({ ...formData, propertyCount: e.target.value })}
                                                placeholder="25 edificios"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Contacto de Operaciones</label>
                                            <input
                                                type="text"
                                                value={formData.operationsContact}
                                                onChange={(e) => setFormData({ ...formData, operationsContact: e.target.value })}
                                                placeholder="Nombre y teléfono"
                                                className="input"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label mb-1 block">Sistema de Tickets</label>
                                            <input
                                                type="text"
                                                value={formData.ticketingSystem}
                                                onChange={(e) => setFormData({ ...formData, ticketingSystem: e.target.value })}
                                                placeholder="Consorcio Virtual, SGA, etc."
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* CONSTRUCTORA Fields */}
                        {formData.customerType === 'CONSTRUCTORA' && (
                            <>
                                {/* Billing Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Facturación</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">CUIT</label>
                                            <input
                                                type="text"
                                                value={formData.cuit}
                                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                                placeholder="30-12345678-9"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Razón Social</label>
                                            <input
                                                type="text"
                                                value={formData.razonSocial}
                                                onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                                                placeholder="Construcciones del Sur S.A."
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Operational Section */}
                                <div className="space-y-4 pt-2 border-t border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Datos de Obra</p>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="label mb-1 block">Jefe de Obra</label>
                                            <input
                                                type="text"
                                                value={formData.projectManager}
                                                onChange={(e) => setFormData({ ...formData, projectManager: e.target.value })}
                                                placeholder="Nombre y teléfono"
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label mb-1 block">Obra Actual</label>
                                            <input
                                                type="text"
                                                value={formData.currentProject}
                                                onChange={(e) => setFormData({ ...formData, currentProject: e.target.value })}
                                                placeholder="Nombre del proyecto"
                                                className="input"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="label mb-1 block">Requisitos de Ingreso</label>
                                            <input
                                                type="text"
                                                value={formData.siteRequirements}
                                                onChange={(e) => setFormData({ ...formData, siteRequirements: e.target.value })}
                                                placeholder="ART, casco, chaleco, zapatos de seguridad..."
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Address - Always shown */}
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                            <label className="label block">Dirección</label>
                            <AddressAutocomplete
                                value={formData.address.fullAddress}
                                onChange={(value: string) =>
                                    setFormData({
                                        ...formData,
                                        address: { ...formData.address, fullAddress: value },
                                    })
                                }
                                onSelect={handleAddressSelect}
                                placeholder="Buscar dirección..."
                                defaultCountry="AR"
                            />

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

                        {/* Notes - Always shown */}
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
