'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicHeader } from '@/components/layout';
import { Mail, Loader2, Phone } from 'lucide-react';

export default function CustomerLoginPage() {
    const router = useRouter();
    const [method, setMethod] = useState<'email' | 'phone'>('email');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'input' | 'otp'>('input');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API request for OTP
        setTimeout(() => {
            setIsLoading(false);
            setStep('otp');
        }, 1500);
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate OTP verification
        setTimeout(() => {
            setIsLoading(false);
            router.push('/portal/dashboard');
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <PublicHeader />

            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            {step === 'input' ? 'Ingresar al Portal' : 'Verificá tu identidad'}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {step === 'input'
                                ? 'Gestioná tus trabajos, pagos y garantías en un solo lugar.'
                                : 'Ingresá el código de 6 dígitos que te enviamos.'}
                        </p>
                    </div>

                    {step === 'input' ? (
                        <form onSubmit={handleLogin} className="space-y-6">

                            <div className="flex p-1 bg-gray-100 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setMethod('email')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${method === 'email' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                >
                                    Email
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('phone')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${method === 'phone' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                >
                                    WhatsApp / Celular
                                </button>
                            </div>

                            {method === 'email' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="email"
                                            required
                                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                            placeholder="tu@email.com"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="tel"
                                            required
                                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                            placeholder="11 5555 5555"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Te enviaremos un código por WhatsApp</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuar'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Código de seguridad</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    className="w-full text-center text-2xl tracking-widest py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="000 000"
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ingresar'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('input')}
                                className="w-full text-sm text-gray-500 hover:text-gray-900"
                            >
                                ← Volver atrás
                            </button>
                        </form>
                    )}

                    <div className="mt-8 border-t pt-6 text-center">
                        <p className="text-xs text-gray-500">
                            ¿Sos un profesional? <Link href="/signin" className="text-primary-600 font-medium hover:underline">Ingresá acá</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
