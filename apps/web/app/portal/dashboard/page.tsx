'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
    Calendar,
    MapPin,
    Clock,
    ChevronRight,
    CreditCard,
    Shield,
    Wrench,
    LogOut,
    Bell,
    Star
} from 'lucide-react';

// Mock Data
const ACTIVE_JOB = {
    id: 'JOB-9821',
    service: 'Instalación Aire Acondicionado',
    technician: {
        name: 'Juan Pérez',
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=100&q=80'
    },
    status: 'EN_CAMINO',
    date: 'Hoy, 15:00 hs',
    address: 'Av. Corrientes 1234, 5B'
};

const HISTORY = [
    {
        id: 'JOB-8540',
        service: 'Reparación Pérdida Agua',
        date: '12 Dic 2024',
        amount: '$25.000',
        status: 'COMPLETED'
    },
    {
        id: 'JOB-7210',
        service: 'Mantenimiento Caldera',
        date: '15 Nov 2024',
        amount: '$45.000',
        status: 'COMPLETED'
    }
];

export default function CustomerPortalDashboard() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Portal Header */}
            <header className="bg-white border-b sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
                            <Shield className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-gray-900 text-lg">CampoTech Portal</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                            MG
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                {/* Welcome Section */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hola, María</h1>
                    <p className="text-gray-500">Tenés 1 servicio programado para hoy</p>
                </div>

                {/* Active Job Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-primary/5 p-4 border-b border-primary/10 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-primary-700 font-medium">
                            <Clock className="w-4 h-4" />
                            Llega en 15 min
                        </div>
                        <span className="px-3 py-1 bg-white text-primary-700 text-xs font-bold rounded-full shadow-sm">
                            EN CAMINO
                        </span>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-1">{ACTIVE_JOB.service}</h3>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Calendar className="w-4 h-4" /> {ACTIVE_JOB.date}
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <MapPin className="w-4 h-4" /> {ACTIVE_JOB.address}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border w-full md:w-auto">
                                <Image
                                    src={ACTIVE_JOB.technician.image}
                                    alt={ACTIVE_JOB.technician.name}
                                    width={48}
                                    height={48}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                                <div>
                                    <p className="font-semibold text-gray-900">{ACTIVE_JOB.technician.name}</p>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                        {ACTIVE_JOB.technician.rating} • Técnico Verificado
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                            <Link
                                href="/track/demo-token"
                                className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium text-center hover:bg-primary/90 transition-colors"
                            >
                                Seguir ubicación en vivo
                            </Link>
                            <button className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                                Contactar técnico
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Recent History */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Historial reciente</h3>
                            <Link href="#" className="text-sm text-primary-600 hover:underline">Ver todo</Link>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y">
                            {HISTORY.map(job => (
                                <div key={job.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                            <Wrench className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{job.service}</p>
                                            <p className="text-xs text-gray-500">{job.date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-gray-900">{job.amount}</p>
                                        <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Finalizado</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Account/Settings Quick Links */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Mi Cuenta</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
                            <Link href="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                <CreditCard className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Métodos de Pago</p>
                                    <p className="text-xs text-gray-500">Visa terminada en 4242</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                            </Link>
                            <Link href="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                <MapPin className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Direcciones</p>
                                    <p className="text-xs text-gray-500">Casa • Oficina</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                            </Link>
                            <Link href="/portal/login" className="flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg transition-colors text-red-600">
                                <LogOut className="w-5 h-5" />
                                <div className="flex-1">
                                    <p className="font-medium">Cerrar Sesión</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
