'use client';

/**
 * Phase 4.8: WhatsApp AI Credits Dashboard
 * =========================================
 * 
 * Dashboard for managing WhatsApp AI credits.
 * Shows balance, grace status, packages, and purchase history.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    MessageCircle,
    CreditCard,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Gift,
    Zap,
    RefreshCw,
    ShoppingCart,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CreditAccount {
    balance: number;
    lifetimeCredits: number;
    lifetimeUsed: number;
    status: string;
    graceCredits: number;
    graceUsed: number;
    graceEverActivated: boolean;
    graceForfeited: boolean;
    bspStatus: string;
    bspPhoneNumber: string | null;
}

interface CreditPackage {
    name: string;
    credits: number;
    priceARS: number;
    priceUSD: number;
    description: string;
}

interface Purchase {
    id: string;
    packageName: string;
    credits: number;
    amountPaid: number;
    currency: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CreditsPage() {
    const [account, setAccount] = useState<CreditAccount | null>(null);
    const [packages, setPackages] = useState<Record<string, CreditPackage>>({});
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<string>('standard');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/credits');
            const data = await res.json();

            if (data.success) {
                setAccount(data.account);
                setPackages(data.packages);
                setPurchases(data.purchases);
            } else {
                setError(data.error || 'Error al cargar datos');
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const initiatePurchase = async () => {
        if (purchasing) return;

        setPurchasing(selectedPackage);
        setError(null);

        try {
            const res = await fetch('/api/credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageName: selectedPackage }),
            });

            const data = await res.json();

            if (data.success) {
                // In production, redirect to Mercado Pago checkout
                alert(`Compra iniciada!\n\nPaquete: ${data.package.name}\nCréditos: ${data.package.credits}\nPrecio: $${data.package.priceARS.toLocaleString()} ARS\n\n(En producción, se redireccionará a Mercado Pago)`);
                await fetchData();
            } else {
                setError(data.error || 'Error al iniciar compra');
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setPurchasing(null);
        }
    };

    // Calculate usage percentage
    const usagePercent = account && account.lifetimeCredits > 0
        ? Math.round((account.lifetimeUsed / account.lifetimeCredits) * 100)
        : 0;

    // Determine status badge
    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
            inactive: { bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle },
            active: { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: CheckCircle },
            grace: { bg: 'bg-amber-100', text: 'text-amber-600', icon: AlertTriangle },
            exhausted: { bg: 'bg-red-100', text: 'text-red-600', icon: XCircle },
        };
        const style = styles[status] || styles.inactive;
        const Icon = style.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
                <Icon className="w-4 h-4" />
                {status === 'inactive' && 'Sin créditos'}
                {status === 'active' && 'Activo'}
                {status === 'grace' && 'Período de gracia'}
                {status === 'exhausted' && 'Sin créditos'}
            </span>
        );
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard/configuracion"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2 text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Configuración
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <MessageCircle className="w-7 h-7 text-emerald-600" />
                        Créditos de WhatsApp AI
                    </h1>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-gray-500">Cargando...</div>
            ) : account && (
                <>
                    {/* Balance Card */}
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-emerald-100 text-sm mb-1">Créditos disponibles</p>
                                <p className="text-4xl font-bold">{account.balance.toLocaleString()}</p>
                                <p className="text-emerald-100 text-sm mt-2">
                                    Usados: {account.lifetimeUsed.toLocaleString()} / Total: {account.lifetimeCredits.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-right">
                                {getStatusBadge(account.status)}
                                <div className="mt-4">
                                    {account.balance <= 50 && account.balance > 0 && (
                                        <span className="text-amber-200 text-sm">⚠️ Saldo bajo</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Usage bar */}
                        {account.lifetimeCredits > 0 && (
                            <div className="mt-4">
                                <div className="flex justify-between text-sm text-emerald-100 mb-1">
                                    <span>Uso</span>
                                    <span>{usagePercent}%</span>
                                </div>
                                <div className="h-2 bg-emerald-400/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white rounded-full transition-all duration-500"
                                        style={{ width: `${usagePercent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Grace Period Status */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${account.graceEverActivated
                                ? account.graceForfeited
                                    ? 'bg-gray-100'
                                    : 'bg-amber-100'
                                : 'bg-emerald-100'
                                }`}>
                                <Gift className={`w-6 h-6 ${account.graceEverActivated
                                    ? account.graceForfeited
                                        ? 'text-gray-500'
                                        : 'text-amber-600'
                                    : 'text-emerald-600'
                                    }`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">Créditos de Emergencia (uso único)</h3>
                                {!account.graceEverActivated ? (
                                    <>
                                        <p className="text-gray-600 text-sm mt-1">
                                            <span className="font-medium text-emerald-600">{account.graceCredits} créditos</span> se activarán automáticamente cuando tu saldo llegue a 0.
                                        </p>
                                        <p className="text-gray-500 text-xs mt-2">
                                            ⚠️ Solo se pueden usar UNA VEZ. Si pagás antes de usarlos, se pierden.
                                        </p>
                                    </>
                                ) : account.graceForfeited ? (
                                    <p className="text-gray-500 text-sm mt-1">
                                        ❌ Créditos de emergencia anulados (pagaste antes de usarlos).
                                    </p>
                                ) : (
                                    <p className="text-amber-600 text-sm mt-1">
                                        ⚠️ Usando créditos de emergencia: {account.graceCredits - account.graceUsed} restantes de {account.graceCredits}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Packages */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                                Comprar Paquete
                            </h2>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(packages).map(([key, pkg]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedPackage(key)}
                                    className={`text-left p-4 rounded-xl border-2 transition-all ${selectedPackage === key
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                                ${pkg.priceARS.toLocaleString()}
                                                <span className="text-sm font-normal text-gray-500"> ARS</span>
                                            </p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedPackage === key
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-gray-300'
                                            }`}>
                                            {selectedPackage === key && (
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-emerald-600 font-medium mt-2">
                                        <Zap className="w-4 h-4 inline mr-1" />
                                        {pkg.credits.toLocaleString()} créditos
                                    </p>
                                    <p className="text-gray-500 text-sm mt-1">{pkg.description}</p>
                                    <p className="text-gray-400 text-xs mt-2">
                                        ${(pkg.priceARS / pkg.credits).toFixed(0)}/crédito • ~${pkg.priceUSD} USD
                                    </p>
                                </button>
                            ))}
                        </div>
                        <div className="p-5 bg-gray-50 border-t border-gray-100">
                            <button
                                onClick={initiatePurchase}
                                disabled={purchasing !== null}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {purchasing ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        Pagar con Mercado Pago
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Purchase History */}
                    {purchases.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-gray-100">
                                <h2 className="font-semibold text-gray-900">Historial de Compras</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paquete</th>
                                            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Créditos</th>
                                            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                                            <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {purchases.map(purchase => (
                                            <tr key={purchase.id} className="hover:bg-gray-50">
                                                <td className="px-5 py-4 text-sm text-gray-600">
                                                    {new Date(purchase.createdAt).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}
                                                </td>
                                                <td className="px-5 py-4 text-sm font-medium text-gray-900">
                                                    {purchase.packageName}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-right text-gray-600">
                                                    {purchase.credits.toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-right text-gray-900">
                                                    ${Number(purchase.amountPaid).toLocaleString()} {purchase.currency}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${purchase.status === 'completed'
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : purchase.status === 'pending'
                                                            ? 'bg-amber-100 text-amber-600'
                                                            : 'bg-red-100 text-red-600'
                                                        }`}>
                                                        {purchase.status === 'completed' ? '✓ Pagado' :
                                                            purchase.status === 'pending' ? 'Pendiente' :
                                                                purchase.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                        <h3 className="font-semibold text-blue-800 mb-2">💡 ¿Cómo funcionan los créditos?</h3>
                        <ul className="text-blue-700 text-sm space-y-1">
                            <li>• <strong>1 crédito = 1 conversación</strong> con el asistente AI</li>
                            <li>• Los créditos nunca expiran</li>
                            <li>• Cuando tu saldo llega a 0, se activan <strong>50 créditos de emergencia (uso único)</strong></li>
                            <li>• Si comprás antes de usar los de emergencia, se pierden</li>
                            <li>• Sin créditos, tu WhatsApp funciona como link directo (sin AI)</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
