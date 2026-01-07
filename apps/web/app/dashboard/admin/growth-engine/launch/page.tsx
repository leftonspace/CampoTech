/**
 * Launch Gate Page
 * ================
 * 
 * Phase 4.4: Growth Engine
 * /dashboard/admin/growth-engine/launch
 * 
 * Checklist to unlock outbound messaging capabilities.
 */

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Shield,
    CheckCircle2,
    Circle,
    AlertTriangle,
    Lock,
    FileText,
    Users,
    Mail,
    MessageSquare,
    Settings
} from 'lucide-react';

// Platform admin organization IDs
const PLATFORM_ADMIN_ORGS = ['test-org-001'];

async function checkPlatformAdmin(organizationId: string): Promise<boolean> {
    if (PLATFORM_ADMIN_ORGS.includes(organizationId)) {
        return true;
    }
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
    });
    const settings = org?.settings as Record<string, unknown> | null;
    return settings?.isPlatformAdmin === true;
}

// Simulated checklist items - in reality these would be checked dynamically
const checklistItems: Array<{
    id: string;
    title: string;
    description: string;
    icon: typeof FileText;
    status: 'pending' | 'completed';
}> = [
        {
            id: 'legal_review',
            title: 'Revisión Legal',
            description: 'Aprobación del equipo legal para campañas de outreach',
            icon: FileText,
            status: 'pending',
        },
        {
            id: 'data_quality',
            title: 'Calidad de Datos',
            description: 'Al menos 1,000 perfiles con teléfono o email válido',
            icon: Users,
            status: 'pending',
        },
        {
            id: 'email_templates',
            title: 'Templates de Email',
            description: 'Al menos 1 template de email aprobado',
            icon: Mail,
            status: 'pending',
        },
        {
            id: 'whatsapp_templates',
            title: 'Templates de WhatsApp',
            description: 'Al menos 1 template de WhatsApp aprobado por Meta',
            icon: MessageSquare,
            status: 'pending',
        },
        {
            id: 'rate_limits',
            title: 'Límites de Envío',
            description: 'Configuración de rate limits y throttling',
            icon: Settings,
            status: 'pending',
        },
        {
            id: 'unsubscribe',
            title: 'Sistema de Baja',
            description: 'Mecanismo de opt-out funcionando',
            icon: Shield,
            status: 'pending',
        },
    ];


export default async function LaunchGatePage() {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    const isPlatformAdmin = await checkPlatformAdmin(session.organizationId);
    if (!isPlatformAdmin) {
        redirect('/dashboard/admin/growth-engine');
    }

    const completedCount = checklistItems.filter(item => item.status === 'completed').length;
    const progressPercent = (completedCount / checklistItems.length) * 100;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <Link
                    href="/dashboard/admin/growth-engine"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Growth Engine
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Checklist de Lanzamiento</h1>
                <p className="text-gray-500 mt-1">
                    Completá estos pasos antes de activar el envío de mensajes
                </p>
            </div>

            {/* Status Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Lock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-amber-800">Launch Gate Bloqueado</h2>
                        <p className="text-amber-700 mt-1">
                            El envío de mensajes está deshabilitado hasta que se completen todos los requisitos.
                            Esto protege a CampoTech de envíos accidentales o no autorizados.
                        </p>

                        {/* Progress Bar */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-amber-700">Progreso</span>
                                <span className="font-medium text-amber-800">
                                    {completedCount} / {checklistItems.length} completados
                                </span>
                            </div>
                            <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 rounded-full transition-all"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Checklist */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Requisitos</h2>
                </div>
                <div className="divide-y divide-gray-100">
                    {checklistItems.map((item) => {
                        const Icon = item.icon;
                        const isComplete = item.status === 'completed';

                        return (
                            <div
                                key={item.id}
                                className={`p-4 flex items-start gap-4 ${isComplete ? 'bg-emerald-50' : ''}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isComplete ? 'bg-emerald-100' : 'bg-gray-100'
                                    }`}>
                                    <Icon className={`w-5 h-5 ${isComplete ? 'text-emerald-600' : 'text-gray-500'}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-medium ${isComplete ? 'text-emerald-800' : 'text-gray-900'}`}>
                                            {item.title}
                                        </h3>
                                        {isComplete ? (
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                                                Completado
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                Pendiente
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm mt-1 ${isComplete ? 'text-emerald-700' : 'text-gray-500'}`}>
                                        {item.description}
                                    </p>
                                </div>
                                <div className="flex-shrink-0">
                                    {isComplete ? (
                                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    ) : (
                                        <Circle className="w-6 h-6 text-gray-300" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-700">Funcionalidad en Desarrollo</h3>
                <p className="text-gray-500 mt-1 max-w-md mx-auto">
                    El sistema de Launch Gate estará completamente funcional en una próxima versión.
                    Por ahora, todos los envíos están bloqueados por seguridad.
                </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    ¿Por qué existe el Launch Gate?
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-blue-700">
                    <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Previene envíos accidentales de mensajes masivos</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Asegura cumplimiento con regulaciones de comunicación</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Protege la reputación de CampoTech y la entregabilidad</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Permite revisar y aprobar contenido antes del envío</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
