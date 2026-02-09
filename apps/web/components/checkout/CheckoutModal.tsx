'use client';

/**
 * Checkout Modal
 * ==============
 *
 * Multi-step payment modal with slide transitions:
 *   Step 1: Payment method selection
 *   Step 2: Form for the selected method (slides in from right)
 *
 * MercadoPago wallet redirects directly (no step 2).
 */

import { useState, useCallback } from 'react';
import {
    CreditCard,
    Building2,
    Wallet,
    Shield,
    X,
    Loader2,
    ChevronRight,
    ArrowLeft,
    Lock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    planTier: string;
    registrationTicket: string | null; // Signed JWT from OTP verification
    onSkip: () => void; // Creates account + redirects to dashboard
}

interface CardFormData {
    number: string;
    name: string;
    expiry: string;
    cvv: string;
}

type ModalStep = 'methods' | 'credit_card' | 'debit_card' | 'bank_transfer';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD INPUT FORM (shared for credit & debit)
// ═══════════════════════════════════════════════════════════════════════════════

function CardForm({
    type,
    cardForm,
    setCardForm,
    isProcessing,
    error,
    onSubmit,
}: {
    type: 'credit_card' | 'debit_card';
    cardForm: CardFormData;
    setCardForm: (data: CardFormData) => void;
    isProcessing: boolean;
    error: string | null;
    onSubmit: (e: React.FormEvent) => void;
}) {
    const label = type === 'credit_card' ? 'crédito' : 'débito';
    const isValid =
        cardForm.number.replace(/\s/g, '').length >= 13 &&
        cardForm.name.trim().length > 0 &&
        cardForm.expiry.length >= 5 &&
        cardForm.cvv.length >= 3;

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Número de tarjeta
                </label>
                <div className="relative">
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1234 5678 9012 3456"
                        value={cardForm.number}
                        onChange={(e) =>
                            setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })
                        }
                        className="w-full px-3.5 py-3 rounded-xl border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all pr-10"
                        maxLength={19}
                        disabled={isProcessing}
                        autoFocus
                    />
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Nombre del titular
                </label>
                <input
                    type="text"
                    placeholder="Como figura en la tarjeta"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                    className="w-full px-3.5 py-3 rounded-xl border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all uppercase"
                    disabled={isProcessing}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Vencimiento
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/AA"
                        value={cardForm.expiry}
                        onChange={(e) =>
                            setCardForm({ ...cardForm, expiry: formatExpiry(e.target.value) })
                        }
                        className="w-full px-3.5 py-3 rounded-xl border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                        maxLength={5}
                        disabled={isProcessing}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Código de seguridad
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="CVV"
                        value={cardForm.cvv}
                        onChange={(e) =>
                            setCardForm({
                                ...cardForm,
                                cvv: e.target.value.replace(/\D/g, '').slice(0, 4),
                            })
                        }
                        className="w-full px-3.5 py-3 rounded-xl border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                        maxLength={4}
                        disabled={isProcessing}
                    />
                </div>
            </div>

            {error && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{error}</p>
            )}

            <button
                type="submit"
                disabled={!isValid || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                    </>
                ) : (
                    <>
                        <Lock className="h-4 w-4" />
                        Pagar con tarjeta de {label}
                    </>
                )}
            </button>
        </form>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANK TRANSFER FORM
// ═══════════════════════════════════════════════════════════════════════════════

function TransferForm({
    isProcessing,
    error,
    onSubmit,
}: {
    isProcessing: boolean;
    error: string | null;
    onSubmit: () => void;
}) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-600">
                Te vamos a generar los datos para que puedas completar la transferencia
                desde tu banco o billetera virtual.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-500">
                <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <p>La acreditación puede demorar hasta 24 horas hábiles</p>
                </div>
                <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <p>Recibirás una confirmación por email cuando se acredite</p>
                </div>
                <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <p>Tu prueba gratuita se mantiene activa mientras tanto</p>
                </div>
            </div>

            {error && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{error}</p>
            )}

            <button
                onClick={onSubmit}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando datos...
                    </>
                ) : (
                    <>
                        <Building2 className="h-4 w-4" />
                        Generar datos de transferencia
                    </>
                )}
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHOD BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

function MethodButton({
    icon: Icon,
    iconColor,
    iconBg,
    title,
    description,
    brands,
    onClick,
    disabled,
    loading,
}: {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    iconBg: string;
    title: string;
    description: string;
    brands?: string[];
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-gray-200 text-left bg-white hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <div className={`p-2.5 rounded-xl ${iconBg}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                {brands && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {brands.map((b) => (
                            <span
                                key={b}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500"
                            >
                                {b}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            {loading ? (
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin flex-shrink-0" />
            ) : (
                <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
            )}
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP TITLES
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_TITLES: Record<ModalStep, string> = {
    methods: 'Elegí cómo pagar',
    credit_card: 'Tarjeta de crédito',
    debit_card: 'Tarjeta de débito',
    bank_transfer: 'Transferencia bancaria',
};

const STEP_SUBTITLES: Record<ModalStep, string> = {
    methods: 'Todas las opciones son seguras',
    credit_card: 'Ingresá los datos de tu tarjeta',
    debit_card: 'Ingresá los datos de tu tarjeta',
    bank_transfer: 'Pagá desde tu banco o billetera',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function CheckoutModal({
    isOpen,
    onClose,
    planTier,
    registrationTicket,
    onSkip,
}: CheckoutModalProps) {
    const [step, setStep] = useState<ModalStep>('methods');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mpLoading, setMpLoading] = useState(false);
    const [accountCreated, setAccountCreated] = useState(false);
    const [cardForm, setCardForm] = useState<CardFormData>({
        number: '',
        name: '',
        expiry: '',
        cvv: '',
    });

    const goToStep = useCallback((newStep: ModalStep) => {
        setError(null);
        setStep(newStep);
    }, []);

    const goBack = useCallback(() => {
        setError(null);
        setStep('methods');
    }, []);

    /**
     * Complete registration: create account first, then create checkout
     */
    const completeRegistrationAndCheckout = useCallback(async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // Step 1: Complete registration (create account)
            const regResponse = await fetch('/api/auth/register/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationTicket }),
            });

            const regData = await regResponse.json();

            if (!regData.success) {
                setError(regData.error?.message || 'Error al crear la cuenta.');
                setIsProcessing(false);
                return;
            }

            // Account is now created — mark it so skip always works
            setAccountCreated(true);

            // Store tokens from completed registration
            const { accessToken, refreshToken } = regData.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            // Step 2: Create checkout preference using the new account
            const checkoutResponse = await fetch('/api/subscription/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    tier: planTier,
                    billingCycle: 'MONTHLY',
                }),
            });

            const checkoutData = await checkoutResponse.json();

            if (checkoutData.success && checkoutData.data?.checkoutUrl) {
                window.location.href = checkoutData.data.checkoutUrl;
            } else {
                // Checkout failed but account was created — user can click "skip" to proceed
                setError(
                    'No se pudo conectar con el procesador de pagos. Podés continuar con tu prueba gratuita.'
                );
                setIsProcessing(false);
            }
        } catch (err) {
            console.error('Checkout error:', err);
            setError('Error de conexión. Verificá tu conexión e intentá de nuevo.');
            setIsProcessing(false);
        }
    }, [planTier, registrationTicket]);

    const handleCardSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const digits = cardForm.number.replace(/\s/g, '');
            if (digits.length < 13) {
                setError('Número de tarjeta inválido');
                return;
            }
            if (!cardForm.name.trim()) {
                setError('Ingresá el nombre del titular');
                return;
            }
            if (cardForm.expiry.length < 5) {
                setError('Fecha de vencimiento inválida');
                return;
            }
            if (cardForm.cvv.length < 3) {
                setError('Código de seguridad inválido');
                return;
            }
            await completeRegistrationAndCheckout();
        },
        [cardForm, completeRegistrationAndCheckout]
    );

    const handleMercadoPagoClick = useCallback(async () => {
        setMpLoading(true);
        setError(null);
        await completeRegistrationAndCheckout();
        setMpLoading(false);
    }, [completeRegistrationAndCheckout]);

    if (!isOpen) return null;

    const isOnFormStep = step !== 'methods';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={isProcessing || mpLoading ? undefined : onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-gray-100">
                    {isOnFormStep && (
                        <button
                            onClick={goBack}
                            disabled={isProcessing}
                            className="p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    )}
                    <div className="flex-1">
                        <h2 className="font-semibold text-gray-900 text-base">
                            {STEP_TITLES[step]}
                        </h2>
                        <p className="text-xs text-gray-500">{STEP_SUBTITLES[step]}</p>
                    </div>
                    {!isProcessing && !mpLoading && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Content — slides between steps */}
                <div className="overflow-hidden relative">
                    {/* Step 1: Methods list */}
                    <div
                        className="transition-all duration-300 ease-in-out"
                        style={{
                            transform: isOnFormStep ? 'translateX(-100%)' : 'translateX(0)',
                            opacity: isOnFormStep ? 0 : 1,
                            position: isOnFormStep ? 'absolute' : 'relative',
                            width: '100%',
                        }}
                    >
                        <div className="p-4 space-y-2">
                            <MethodButton
                                icon={CreditCard}
                                iconColor="text-gray-600"
                                iconBg="bg-gray-100"
                                title="Tarjeta de crédito"
                                description="Hasta 12 cuotas sin interés"
                                brands={['Visa', 'Mastercard', 'Amex', 'Naranja', 'Cabal']}
                                onClick={() => goToStep('credit_card')}
                                disabled={mpLoading}
                            />
                            <MethodButton
                                icon={CreditCard}
                                iconColor="text-gray-600"
                                iconBg="bg-gray-100"
                                title="Tarjeta de débito"
                                description="Débito inmediato de tu cuenta"
                                brands={['Visa Débito', 'Maestro', 'Cabal Débito']}
                                onClick={() => goToStep('debit_card')}
                                disabled={mpLoading}
                            />
                            <MethodButton
                                icon={Building2}
                                iconColor="text-gray-600"
                                iconBg="bg-gray-100"
                                title="Transferencia bancaria"
                                description="CBU · CVU · Alias"
                                onClick={() => goToStep('bank_transfer')}
                                disabled={mpLoading}
                            />
                            <MethodButton
                                icon={Wallet}
                                iconColor="text-blue-600"
                                iconBg="bg-blue-50"
                                title="Dinero en MercadoPago"
                                description="Pagá con tu saldo"
                                onClick={handleMercadoPagoClick}
                                disabled={mpLoading}
                                loading={mpLoading}
                            />

                            {/* MP error */}
                            {error && !isOnFormStep && (
                                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">
                                    {error}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Form */}
                    <div
                        className="transition-all duration-300 ease-in-out"
                        style={{
                            transform: isOnFormStep ? 'translateX(0)' : 'translateX(100%)',
                            opacity: isOnFormStep ? 1 : 0,
                            position: isOnFormStep ? 'relative' : 'absolute',
                            top: isOnFormStep ? undefined : 0,
                            width: '100%',
                        }}
                    >
                        <div className="p-5">
                            {step === 'credit_card' && (
                                <CardForm
                                    type="credit_card"
                                    cardForm={cardForm}
                                    setCardForm={setCardForm}
                                    isProcessing={isProcessing}
                                    error={error}
                                    onSubmit={handleCardSubmit}
                                />
                            )}
                            {step === 'debit_card' && (
                                <CardForm
                                    type="debit_card"
                                    cardForm={cardForm}
                                    setCardForm={setCardForm}
                                    isProcessing={isProcessing}
                                    error={error}
                                    onSubmit={handleCardSubmit}
                                />
                            )}
                            {step === 'bank_transfer' && (
                                <TransferForm
                                    isProcessing={isProcessing}
                                    error={error}
                                    onSubmit={completeRegistrationAndCheckout}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 mb-3">
                        <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Pago seguro
                        </span>
                        <span>·</span>
                        <span>21 días gratis</span>
                        <span>·</span>
                        <span>Cancelá cuando quieras</span>
                    </div>
                    <button
                        onClick={onSkip}
                        disabled={isProcessing || mpLoading}
                        className={`w-full text-center text-xs transition-colors disabled:opacity-50 ${accountCreated
                                ? 'text-primary-600 font-medium hover:text-primary-700'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Continuar sin pagar (usar prueba gratuita)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CheckoutModal;
