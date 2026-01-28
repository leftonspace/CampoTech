'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
    X,
    Save,
    Wrench,
    Eye,
    Award,
    Trash2,
    MessageCircle,
    Upload,
    Image as ImageIcon,
    Calendar,
    Star,
    Briefcase,
} from 'lucide-react';
import PhoneInput from '@/components/ui/PhoneInput';
import type { TeamMember, TradeCertification } from './types';
import {
    SPECIALTY_OPTIONS,
    SPECIALTY_MATRICULA_CONFIG,
    getTradeCategoryOptions,
    validateMatricula,
} from '@/lib/team/trade-config';

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER MODAL (Add/Edit)
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamMemberModalProps {
    member: TeamMember | null;
    currentUserId?: string;
    currentUserRole?: string;
    onClose: () => void;
    onSuccess: () => void;
    onDelete?: (member: TeamMember) => void;
}

export function TeamMemberModal({ member, currentUserId, currentUserRole, onClose, onSuccess, onDelete }: TeamMemberModalProps) {
    // Initialize certifications from member data (handle legacy single specialty)
    const initCertifications = (): Record<string, TradeCertification> => {
        if (member?.certifications) {
            return member.certifications;
        }
        // Legacy: convert single specialty to certifications format
        if (member?.specialty && member?.specialty !== '') {
            return {
                [member.specialty]: {
                    matricula: member.matricula || '',
                    category: member.skillLevel || '',
                },
            };
        }
        return {};
    };

    // Initialize specialties from member data
    const initSpecialties = (): string[] => {
        if (member?.specialties && member.specialties.length > 0) {
            return member.specialties;
        }
        // Legacy: convert single specialty to array
        if (member?.specialty && member.specialty !== '') {
            return [member.specialty];
        }
        return [];
    };

    const [formData, setFormData] = useState({
        name: member?.name || '',
        phone: member?.phone || '',
        email: member?.email || '',
        role: member?.role || 'TECHNICIAN',
        // Multi-specialty support
        specialties: initSpecialties(),
        certifications: initCertifications(),
        isActive: member?.isActive ?? true,
        sendWelcome: true,
        // Driver's license (optional)
        driverLicenseNumber: member?.driverLicenseNumber || '',
        driverLicenseExpiry: member?.driverLicenseExpiry?.split('T')[0] || '', // Format for date input
        driverLicenseCategory: member?.driverLicenseCategory || '',
        driverLicensePhotoFront: member?.driverLicensePhotoFront || '',
        driverLicensePhotoBack: member?.driverLicensePhotoBack || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [certificationErrors, setCertificationErrors] = useState<Record<string, string>>({});
    const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
    const specialtyButtonRef = useRef<HTMLButtonElement>(null);

    // Driver's license photo upload refs and state
    const licensePhotoFrontRef = useRef<HTMLInputElement>(null);
    const licensePhotoBackRef = useRef<HTMLInputElement>(null);
    const [uploadingPhotoFront, setUploadingPhotoFront] = useState(false);
    const [uploadingPhotoBack, setUploadingPhotoBack] = useState(false);

    // Lightbox state for photo preview
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

    const isOwner = member?.role === 'OWNER';
    const isEditing = !!member;

    // ACCESS CONTROL: Determine if user can edit or just view
    const normalizedRole = currentUserRole?.toUpperCase() || 'TECHNICIAN';
    const isEditingSelf = member?.id === currentUserId;
    const canEdit = isEditingSelf || ['OWNER', 'DISPATCHER'].includes(normalizedRole);
    const isViewOnly = isEditing && !canEdit;

    // Resend access states (Edit mode only)
    const [resendPhoneOTP, setResendPhoneOTP] = useState(false);
    const originalEmail = member?.email || '';
    const emailChanged = isEditing && formData.email !== originalEmail && formData.email.trim() !== '';

    // Handle specialty dropdown toggle with position calculation
    const handleSpecialtyDropdownToggle = () => {
        if (!showSpecialtyDropdown && specialtyButtonRef.current) {
            const rect = specialtyButtonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 20; // 20px margin from viewport bottom

            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                maxHeight: Math.max(150, Math.min(240, spaceBelow)), // Between 150px and 240px
            });
        }
        setShowSpecialtyDropdown(!showSpecialtyDropdown);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showSpecialtyDropdown &&
                specialtyButtonRef.current &&
                !specialtyButtonRef.current.contains(event.target as Node)
            ) {
                // Check if click is inside the portal dropdown
                const portalDropdown = document.getElementById('specialty-dropdown-portal');
                if (portalDropdown && !portalDropdown.contains(event.target as Node)) {
                    setShowSpecialtyDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSpecialtyDropdown]);

    // Recalculate dropdown position when specialties change or on resize/scroll
    useEffect(() => {
        if (!showSpecialtyDropdown || !specialtyButtonRef.current) return;

        const updatePosition = () => {
            if (specialtyButtonRef.current) {
                const rect = specialtyButtonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom - 20; // 20px margin from viewport bottom

                setDropdownPosition({
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: rect.width,
                    maxHeight: Math.max(150, Math.min(240, spaceBelow)), // Between 150px and 240px
                });
            }
        };

        // 1. Update immediately
        updatePosition();

        // 2. Watch for resizing (The Modal Animation)
        const observer = new ResizeObserver(() => {
            updatePosition();
        });
        observer.observe(specialtyButtonRef.current);

        // 3. Watch for scrolling (window resize/scroll)
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [showSpecialtyDropdown, formData.specialties]); // Re-run if specialties change

    // Toggle a specialty in the multi-select
    const toggleSpecialty = (specialty: string) => {
        const currentSpecialties = formData.specialties;
        const currentCerts = { ...formData.certifications };

        if (currentSpecialties.includes(specialty)) {
            // Remove specialty
            const newSpecialties = currentSpecialties.filter((s) => s !== specialty);
            delete currentCerts[specialty];
            setFormData({
                ...formData,
                specialties: newSpecialties,
                certifications: currentCerts,
            });
            // Clear any error for this specialty
            const newErrors = { ...certificationErrors };
            delete newErrors[specialty];
            setCertificationErrors(newErrors);
        } else {
            // Add specialty
            const newSpecialties = [...currentSpecialties, specialty];
            currentCerts[specialty] = { matricula: '', category: '' };
            setFormData({
                ...formData,
                specialties: newSpecialties,
                certifications: currentCerts,
            });
        }
    };

    // Update certification for a specific specialty
    const updateCertification = (specialty: string, field: 'matricula' | 'category', value: string) => {
        const currentCerts = { ...formData.certifications };
        if (!currentCerts[specialty]) {
            currentCerts[specialty] = { matricula: '', category: '' };
        }
        currentCerts[specialty][field] = value;
        setFormData({ ...formData, certifications: currentCerts });

        // Clear error when typing
        if (field === 'matricula' && certificationErrors[specialty]) {
            const newErrors = { ...certificationErrors };
            delete newErrors[specialty];
            setCertificationErrors(newErrors);
        }
    };

    // Validate matrícula for a specific specialty
    const validateCertification = (specialty: string) => {
        const cert = formData.certifications[specialty];
        if (cert?.matricula) {
            const result = validateMatricula(specialty, cert.matricula);
            if (!result.valid) {
                setCertificationErrors((prev) => ({ ...prev, [specialty]: result.error || 'Formato inválido' }));
                return false;
            }
        }
        setCertificationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[specialty];
            return newErrors;
        });
        return true;
    };

    // Validate all certifications before submit
    const validateAllCertifications = (): boolean => {
        let allValid = true;
        const newErrors: Record<string, string> = {};

        for (const specialty of formData.specialties) {
            const cert = formData.certifications[specialty];
            if (cert?.matricula) {
                const result = validateMatricula(specialty, cert.matricula);
                if (!result.valid) {
                    newErrors[specialty] = result.error || 'Formato inválido';
                    allValid = false;
                }
            }
        }

        setCertificationErrors(newErrors);
        return allValid;
    };

    // Handle photo upload for driver's license
    const handlePhotoUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        side: 'front' | 'back'
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Por favor, seleccioná una imagen (JPG, PNG, etc.)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen no puede superar los 5MB');
            return;
        }

        const setUploading = side === 'front' ? setUploadingPhotoFront : setUploadingPhotoBack;
        const fieldName = side === 'front' ? 'driverLicensePhotoFront' : 'driverLicensePhotoBack';

        setUploading(true);

        try {
            // Convert to base64 for preview (in production, upload to storage and use URL)
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setFormData(prev => ({ ...prev, [fieldName]: base64 }));
                setUploading(false);
            };
            reader.onerror = () => {
                alert('Error al leer la imagen');
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch {
            alert('Error al procesar la imagen');
            setUploading(false);
        }

        // Clear the input so the same file can be selected again
        e.target.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        // Validate all certifications
        if (!validateAllCertifications()) {
            setIsSubmitting(false);
            return;
        }

        try {
            const url = member ? `/api/users/${member.id}` : '/api/users';
            const method = member ? 'PUT' : 'POST';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = {
                name: formData.name,
                phone: formData.phone, // Already includes country code from PhoneInput
                email: formData.email,
                role: formData.role,
                // Multi-specialty data
                specialties: formData.specialties,
                certifications: formData.certifications,
                // Legacy fields for backwards compatibility (use first specialty)
                specialty: formData.specialties[0] || null,
                matricula: formData.certifications[formData.specialties[0]]?.matricula || null,
                skillLevel: formData.certifications[formData.specialties[0]]?.category || null,
                isActive: formData.isActive,
                // Driver's license fields
                driverLicenseNumber: formData.driverLicenseNumber || null,
                driverLicenseExpiry: formData.driverLicenseExpiry || null,
                driverLicenseCategory: formData.driverLicenseCategory || null,
                driverLicensePhotoFront: formData.driverLicensePhotoFront || null,
                driverLicensePhotoBack: formData.driverLicensePhotoBack || null,
            };

            // Only include sendWelcome for new users
            if (!member) {
                payload.sendWelcome = formData.sendWelcome;
            }

            // For edits: Include resend flags
            if (member) {
                // Auto-trigger email notification if email changed
                if (emailChanged) {
                    payload.resendEmailNotification = true;
                }
                // Manual toggle for resending phone OTP
                if (resendPhoneOTP) {
                    payload.resendPhoneOTP = true;
                }
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                // Translate common API errors to Spanish
                const errorMessage = data.error?.message || data.error || 'Error al guardar';
                const errorTranslations: Record<string, string> = {
                    'Phone number already in use': 'Este número de teléfono ya está registrado',
                    'Name and phone are required': 'El nombre y teléfono son obligatorios',
                    'Cannot create users with OWNER role': 'No se puede crear usuarios con rol de Propietario',
                    'Unauthorized': 'No autorizado',
                    'Forbidden: insufficient permissions': 'No tienes permisos para realizar esta acción',
                };
                throw new Error(errorTranslations[errorMessage] || errorMessage);
            }

            onSuccess();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            // Scroll the form to top to show the error
            const scrollContainer = document.querySelector('[data-form-scroll]');
            if (scrollContainer) scrollContainer.scrollTop = 0;
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dynamic width based on whether specialties are selected
    const hasSpecialties = formData.specialties.length > 0;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop overlay - covers entire screen */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal content - centered with max height, binary width (no gradual growth) */}
            <div className="flex h-full items-center justify-center p-4">
                <div
                    className={cn(
                        "relative flex flex-col rounded-xl bg-white shadow-xl overflow-x-hidden",
                        "transition-all duration-500 ease-in-out",
                        "max-h-[90vh] w-full",
                        // Binary sizing: Compact (max-w-2xl) or Medium-Wide (max-w-3xl)
                        hasSpecialties ? "max-w-3xl" : "max-w-2xl"
                    )}
                >
                    {/* Fixed Header */}
                    <div className="flex-shrink-0 flex items-center justify-between border-b p-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {!member ? 'Nuevo miembro' : (isViewOnly ? 'Ver Empleado' : 'Editar Empleado')}
                            </h2>
                            {/* Stats (Edit mode only) - inline with title */}
                            {isEditing && member && (
                                <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        <span>{member.jobCount || 0} trabajos</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 text-amber-400" />
                                        <span>{member.avgRating !== null ? member.avgRating.toFixed(1) : '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>
                                            {member.createdAt
                                                ? new Date(member.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Buenos_Aires' })
                                                : '—'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div data-form-scroll className="flex-1 overflow-y-auto p-4 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                    <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* ═══════════════════════════════════════════════════════════════ */}
                            {/* TOP SECTION: Personal Info - 2 Column Grid                       */}
                            {/* ═══════════════════════════════════════════════════════════════ */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Row 1: Name | Phone */}
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nombre {!isViewOnly && '*'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                                        placeholder="Nombre completo"
                                        required={!isViewOnly}
                                        disabled={isViewOnly}
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <PhoneInput
                                        id="employee-phone"
                                        value={formData.phone}
                                        onChange={(fullPhone) => setFormData({ ...formData, phone: fullPhone })}
                                        label="Teléfono"
                                        required
                                        disabled={isEditing}
                                        error={isEditing ? '🔒 Bloqueado por seguridad. Si cambió de número, desactive este usuario y cree uno nuevo.' : undefined}
                                    />
                                    {/* Edit mode: Resend OTP link */}
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setResendPhoneOTP(!resendPhoneOTP)}
                                            className={cn(
                                                "mt-1 text-sm underline transition-colors",
                                                resendPhoneOTP ? "text-green-600" : "text-blue-600 hover:text-blue-800"
                                            )}
                                        >
                                            {resendPhoneOTP ? '✓ Se reenviará código de verificación' : '¿Reenviar acceso?'}
                                        </button>
                                    )}
                                </div>

                                {/* Row 2: Email | Rol */}
                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="input w-full h-10"
                                        placeholder="email@ejemplo.com"
                                        required
                                    />
                                    {/* Create mode: Standard message */}
                                    {!isEditing && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            Se enviará una notificación al empleado
                                        </p>
                                    )}
                                    {/* Edit mode: Show if email changed */}
                                    {isEditing && emailChanged && (
                                        <p className="mt-1 text-xs text-green-600">
                                            ✓ Se enviará notificación al nuevo email
                                        </p>
                                    )}
                                    {/* Edit mode: Email not changed - no message needed */}
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rol
                                    </label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as TeamMember['role'] })}
                                        className="input w-full h-10"
                                        disabled={isOwner}
                                    >
                                        <option value="TECHNICIAN">Técnico</option>
                                        <option value="DISPATCHER">Despachador</option>
                                        {isOwner && <option value="OWNER">Dueño</option>}
                                    </select>
                                    {/* Active checkbox - under Rol for alignment */}
                                    <div className="mt-3">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                className="rounded text-primary-600"
                                                disabled={member?.id === currentUserId}
                                            />
                                            <span className="text-sm text-gray-700">Usuario activo</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* ═══════════════════════════════════════════════════════════════ */}
                            {/* DRIVER'S LICENSE SECTION (Optional)                             */}
                            {/* ═══════════════════════════════════════════════════════════════ */}

                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    🚗 Licencia de Conducir
                                    <span className="text-xs font-normal text-gray-500">(opcional)</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* License Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Número de Licencia
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.driverLicenseNumber}
                                            onChange={(e) => setFormData({ ...formData, driverLicenseNumber: e.target.value })}
                                            className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                                            placeholder="Ej: 12345678"
                                            disabled={isViewOnly}
                                        />
                                    </div>
                                    {/* License Expiry */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Vencimiento
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.driverLicenseExpiry}
                                            onChange={(e) => setFormData({ ...formData, driverLicenseExpiry: e.target.value })}
                                            className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                                            disabled={isViewOnly}
                                        />
                                    </div>
                                    {/* License Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Categoría
                                        </label>
                                        <select
                                            value={formData.driverLicenseCategory}
                                            onChange={(e) => setFormData({ ...formData, driverLicenseCategory: e.target.value })}
                                            className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                                            disabled={isViewOnly}
                                        >
                                            <option value="">Sin especificar</option>
                                            <option value="B1">B1 - Auto hasta 3500kg</option>
                                            <option value="B2">B2 - Auto + remolque</option>
                                            <option value="C">C - Camión</option>
                                            <option value="D1">D1 - Transporte de pasajeros</option>
                                        </select>
                                    </div>
                                </div>

                                {/* License Photo Uploads - Second Row */}
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    {/* Photo Front */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Foto Frente
                                        </label>
                                        <input
                                            ref={licensePhotoFrontRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handlePhotoUpload(e, 'front')}
                                            className="hidden"
                                            disabled={isViewOnly}
                                        />
                                        {formData.driverLicensePhotoFront ? (
                                            <div className="relative group">
                                                <img
                                                    src={formData.driverLicensePhotoFront}
                                                    alt="Licencia frente"
                                                    className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                                                    onClick={() => setLightboxImage({ src: formData.driverLicensePhotoFront, alt: 'Licencia de Conducir - Frente' })}
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                                    {/* Cambiar imagen - only when editable */}
                                                    {!isViewOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => licensePhotoFrontRef.current?.click()}
                                                            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                                            title="Cambiar imagen"
                                                        >
                                                            <Upload className="h-4 w-4 text-gray-700" />
                                                        </button>
                                                    )}
                                                    {/* Ver imagen - always visible */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setLightboxImage({ src: formData.driverLicensePhotoFront, alt: 'Licencia de Conducir - Frente' })}
                                                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                                        title="Ver imagen"
                                                    >
                                                        <Eye className="h-4 w-4 text-gray-700" />
                                                    </button>
                                                    {/* Quitar imagen - only when editable */}
                                                    {!isViewOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, driverLicensePhotoFront: '' })}
                                                            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                                            title="Quitar imagen"
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => !isViewOnly && licensePhotoFrontRef.current?.click()}
                                                disabled={isViewOnly || uploadingPhotoFront}
                                                className={cn(
                                                    "w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors",
                                                    isViewOnly
                                                        ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                                                        : "border-gray-300 hover:border-teal-400 hover:bg-teal-50 cursor-pointer"
                                                )}
                                            >
                                                {uploadingPhotoFront ? (
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                                                ) : (
                                                    <>
                                                        <ImageIcon className="h-6 w-6 text-gray-400" />
                                                        <span className="text-xs text-gray-500">Subir foto</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Photo Back */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Foto Dorso
                                        </label>
                                        <input
                                            ref={licensePhotoBackRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handlePhotoUpload(e, 'back')}
                                            className="hidden"
                                            disabled={isViewOnly}
                                        />
                                        {formData.driverLicensePhotoBack ? (
                                            <div className="relative group">
                                                <img
                                                    src={formData.driverLicensePhotoBack}
                                                    alt="Licencia dorso"
                                                    className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                                                    onClick={() => setLightboxImage({ src: formData.driverLicensePhotoBack, alt: 'Licencia de Conducir - Dorso' })}
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                                    {/* Cambiar imagen - only when editable */}
                                                    {!isViewOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => licensePhotoBackRef.current?.click()}
                                                            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                                            title="Cambiar imagen"
                                                        >
                                                            <Upload className="h-4 w-4 text-gray-700" />
                                                        </button>
                                                    )}
                                                    {/* Ver imagen - always visible */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setLightboxImage({ src: formData.driverLicensePhotoBack, alt: 'Licencia de Conducir - Dorso' })}
                                                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                                        title="Ver imagen"
                                                    >
                                                        <Eye className="h-4 w-4 text-gray-700" />
                                                    </button>
                                                    {/* Quitar imagen - only when editable */}
                                                    {!isViewOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, driverLicensePhotoBack: '' })}
                                                            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                                            title="Quitar imagen"
                                                        >
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => !isViewOnly && licensePhotoBackRef.current?.click()}
                                                disabled={isViewOnly || uploadingPhotoBack}
                                                className={cn(
                                                    "w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors",
                                                    isViewOnly
                                                        ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                                                        : "border-gray-300 hover:border-teal-400 hover:bg-teal-50 cursor-pointer"
                                                )}
                                            >
                                                {uploadingPhotoBack ? (
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                                                ) : (
                                                    <>
                                                        <ImageIcon className="h-6 w-6 text-gray-400" />
                                                        <span className="text-xs text-gray-500">Subir foto</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {!formData.driverLicenseNumber && isEditing && !isViewOnly && (
                                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                        ⚠️ Sin licencia registrada - recomendamos agregar para asignaciones de vehículos y seguros
                                    </p>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════════════════════════ */}
                            {/* BOTTOM SECTION: Trade Details - Full Width                       */}
                            {/* ═══════════════════════════════════════════════════════════════ */}


                            {/* Divider with section title */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Wrench className="h-4 w-4 text-teal-600" />
                                    Oficios y Credenciales
                                </h3>
                            </div>

                            {/* Multi-Select Specialties */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Especialidades <span className="text-gray-400 text-xs font-normal">(puede seleccionar varias)</span>
                                </label>

                                {/* Selected specialties as chips */}
                                {formData.specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {formData.specialties.map((specialty) => {
                                            const opt = SPECIALTY_OPTIONS.find((o) => o.value === specialty);
                                            return (
                                                <span
                                                    key={specialty}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-sm"
                                                >
                                                    {opt?.label || specialty}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSpecialty(specialty)}
                                                        className="hover:bg-teal-200 rounded-full p-0.5"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Dropdown button */}
                                <div className="relative">
                                    <button
                                        ref={specialtyButtonRef}
                                        type="button"
                                        onClick={handleSpecialtyDropdownToggle}
                                        className="input w-full h-10 text-left flex items-center justify-between"
                                    >
                                        <span className="text-gray-500">
                                            {formData.specialties.length === 0
                                                ? 'Seleccionar especialidades...'
                                                : `${formData.specialties.length} especialidad(es) seleccionada(s)`}
                                        </span>
                                        <Wrench className="h-4 w-4 text-gray-400" />
                                    </button>
                                </div>

                                {/* Portal dropdown menu - renders to document.body */}
                                {showSpecialtyDropdown && typeof document !== 'undefined' && createPortal(
                                    <div
                                        id="specialty-dropdown-portal"
                                        className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto"
                                        style={{
                                            position: 'fixed',
                                            top: dropdownPosition.top,
                                            left: dropdownPosition.left,
                                            width: dropdownPosition.width,
                                            maxHeight: dropdownPosition.maxHeight,
                                            zIndex: 9999,
                                        }}
                                    >
                                        {SPECIALTY_OPTIONS.filter((opt) => opt.value !== '').map((opt) => (
                                            <label
                                                key={opt.value}
                                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.specialties.includes(opt.value)}
                                                    onChange={() => toggleSpecialty(opt.value)}
                                                    className="rounded text-teal-600"
                                                />
                                                <span className="text-sm">{opt.label}</span>
                                            </label>
                                        ))}
                                        <div className="border-t p-2 sticky bottom-0 bg-white">
                                            <button
                                                type="button"
                                                onClick={() => setShowSpecialtyDropdown(false)}
                                                className="w-full text-center text-sm text-teal-600 hover:text-teal-700"
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    </div>,
                                    document.body
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    Seleccione todos los oficios que el empleado puede realizar
                                </p>
                            </div>

                            {/* Dynamic Trade Cards - One for each selected specialty */}
                            {formData.specialties.length > 0 && (
                                <div className="space-y-4">
                                    {formData.specialties.map((specialty) => {
                                        const config = SPECIALTY_MATRICULA_CONFIG[specialty];
                                        const categoryOptions = getTradeCategoryOptions(specialty);
                                        const cert = formData.certifications[specialty] || { matricula: '', category: '' };
                                        const error = certificationErrors[specialty];
                                        const specialtyLabel = SPECIALTY_OPTIONS.find((o) => o.value === specialty)?.label || specialty;

                                        return (
                                            <div
                                                key={specialty}
                                                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Award className="h-4 w-4 text-teal-600" />
                                                    <h4 className="text-sm font-medium text-gray-900">{specialtyLabel}</h4>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {/* Matrícula for this trade */}
                                                    {config && (
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                {config.label}
                                                                <span className="text-gray-400 text-xs font-normal ml-1">(opcional)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={cert.matricula}
                                                                onChange={(e) => updateCertification(specialty, 'matricula', e.target.value)}
                                                                onBlur={() => validateCertification(specialty)}
                                                                className={cn(
                                                                    "input w-full",
                                                                    error && "border-red-500 focus:ring-red-500"
                                                                )}
                                                                placeholder={config.placeholder}
                                                            />
                                                            {error ? (
                                                                <p className="mt-1 text-xs text-red-500">{error}</p>
                                                            ) : (
                                                                <p className="mt-1 text-xs text-gray-500">{config.hint}</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Category for this trade */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Categoría / Nivel
                                                        </label>
                                                        <select
                                                            value={cert.category}
                                                            onChange={(e) => updateCertification(specialty, 'category', e.target.value)}
                                                            className="input w-full h-10 truncate"
                                                            title={categoryOptions.find(o => o.value === cert.category)?.label}
                                                        >
                                                            {categoryOptions.map((opt) => (
                                                                <option key={opt.value} value={opt.value} title={opt.label}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Send welcome message (only for new members) - LAST ITEM */}
                            {!isEditing && (
                                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                    <label className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.sendWelcome}
                                            onChange={(e) => setFormData({ ...formData, sendWelcome: e.target.checked })}
                                            className="rounded text-teal-600 mt-0.5"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-teal-800">
                                                Enviar bienvenida y código de verificación
                                            </span>
                                            <p className="text-xs text-teal-600 mt-0.5">
                                                Se enviará por WhatsApp un mensaje de bienvenida con código de verificación (6 dígitos)
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            )}
                            {/* / Scrollable content ends here */}
                        </div>

                        {/* Smart Footer - Different layouts for Create vs Edit vs View mode */}
                        <div className="flex-shrink-0 flex items-center justify-between gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
                            {/* Left Side: Secondary Actions (Edit mode only, not view-only) */}
                            {isEditing && member ? (
                                <div className="flex items-center gap-2">
                                    {/* WhatsApp Button - always visible */}
                                    <a
                                        href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        <span className="hidden sm:inline">WhatsApp</span>
                                    </a>
                                    {/* Delete Button - hidden in view-only mode */}
                                    {!isViewOnly && member.role !== 'OWNER' && member.id !== currentUserId && onDelete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                onDelete(member);
                                            }}
                                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="hidden sm:inline">Eliminar</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div /> /* Empty spacer for create mode */
                            )}

                            {/* Right Side: Primary Actions */}
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={onClose} className="btn-outline">
                                    {isViewOnly ? 'Cerrar' : 'Cancelar'}
                                </button>
                                {/* Save button - hidden in view-only mode */}
                                {!isViewOnly && (
                                    <button type="submit" disabled={isSubmitting} className="btn-primary">
                                        <Save className="mr-2 h-4 w-4" />
                                        {isSubmitting ? 'Guardando...' : 'Guardar'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Lightbox Overlay for Image Preview */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setLightboxImage(null)}
                    onKeyDown={(e) => e.key === 'Escape' && setLightboxImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={lightboxImage.alt}
                    tabIndex={-1}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-colors"
                            title="Cerrar"
                        >
                            <X className="h-6 w-6" />
                        </button>

                        {/* Image */}
                        <img
                            src={lightboxImage.src}
                            alt={lightboxImage.alt}
                            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                        />

                        {/* Caption */}
                        <p className="text-center text-white/80 text-sm mt-3">
                            {lightboxImage.alt}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeamMemberModal;
