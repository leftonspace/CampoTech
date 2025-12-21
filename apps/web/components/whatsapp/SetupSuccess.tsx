'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Phone,
  Copy,
  Check,
  QrCode,
  MessageCircle,
  Bot,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Settings,
} from 'lucide-react';
import type { IntegrationType } from './SetupWizard';

interface SetupSuccessProps {
  phoneNumber: string;
  integrationType: IntegrationType;
  onFinish: () => void;
}

export function SetupSuccess({
  phoneNumber,
  integrationType,
  onFinish,
}: SetupSuccessProps) {
  const [copied, setCopied] = useState(false);

  // Normalize phone for wa.me link
  const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  const waLink = `https://wa.me/${normalizedPhone}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(waLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPhoneDisplay = (phone: string) => {
    // Simple formatting for display
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('549')) {
      // Argentina mobile format
      const rest = digits.slice(3);
      if (rest.length >= 10) {
        const area = rest.slice(0, 2);
        const first = rest.slice(2, 6);
        const last = rest.slice(6, 10);
        return `+54 9 ${area} ${first}-${last}`;
      }
    }
    return phone;
  };

  return (
    <div className="space-y-6 text-center">
      {/* Success animation */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-bounce-once">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping-slow" />
      </div>

      {/* Success message */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡WhatsApp configurado!
        </h1>
        <p className="text-gray-600">
          {integrationType === 'bsp'
            ? 'Tu número exclusivo está listo para recibir mensajes'
            : 'Tu número personal está vinculado a tu negocio'}
        </p>
      </div>

      {/* Phone number display */}
      <div className="card p-6 text-left">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500">Tu número de WhatsApp</p>
            <p className="text-xl font-mono font-bold text-gray-900 truncate">
              {formatPhoneDisplay(phoneNumber)}
            </p>
          </div>
        </div>

        {/* wa.me link */}
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-medium text-green-800 mb-2">
            Tu link de WhatsApp:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-white rounded text-sm font-mono text-green-700 truncate">
              {waLink}
            </code>
            <button
              onClick={handleCopy}
              className="p-2 rounded-md hover:bg-green-100 text-green-600 transition-colors"
              title="Copiar link"
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex gap-2">
          <a
            href={`${waLink}?text=${encodeURIComponent('Hola, quiero hacer una consulta')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline flex-1 justify-center text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Probar link
          </a>
          <button className="btn-outline flex-1 justify-center text-sm" disabled>
            <QrCode className="h-4 w-4 mr-1" />
            Ver QR
          </button>
        </div>
      </div>

      {/* Next steps */}
      <div className="card p-6 text-left space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary-600" />
          Próximos pasos
        </h2>

        <div className="space-y-3">
          {integrationType === 'bsp' ? (
            <>
              <NextStep
                icon={<Bot className="h-5 w-5" />}
                title="Configurar respuestas de IA"
                description="Personalizá cómo responde la IA a tus clientes"
                href="/dashboard/settings/ai"
                color="purple"
              />
              <NextStep
                icon={<MessageCircle className="h-5 w-5" />}
                title="Ver conversaciones"
                description="Mirá los mensajes que recibís de tus clientes"
                href="/dashboard/whatsapp"
                color="green"
              />
              <NextStep
                icon={<Settings className="h-5 w-5" />}
                title="Ajustar horarios"
                description="Configurá cuándo la IA puede responder"
                href="/dashboard/settings/ai"
                color="gray"
              />
            </>
          ) : (
            <>
              <NextStep
                icon={<Smartphone className="h-5 w-5" />}
                title="Agregá WhatsApp a tus facturas"
                description="Tus clientes podrán consultarte fácilmente"
                href="/dashboard/settings/invoices"
                color="green"
              />
              <NextStep
                icon={<QrCode className="h-5 w-5" />}
                title="Generá tu código QR"
                description="Para tarjetas de visita o publicidad"
                href="/dashboard/settings/whatsapp"
                color="blue"
              />
            </>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="p-4 bg-blue-50 rounded-lg text-left">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          Tip: Probá enviar un mensaje
        </h3>
        <p className="text-sm text-blue-700">
          {integrationType === 'bsp'
            ? 'Escaneá el código QR o usá el link desde otro celular para ver cómo responde la IA.'
            : 'Compartí el link con un amigo para verificar que todo funcione correctamente.'}
        </p>
      </div>

      {/* Finish button */}
      <button onClick={onFinish} className="btn-primary w-full">
        Ir a configuración de WhatsApp
        <ArrowRight className="h-4 w-4 ml-2" />
      </button>
    </div>
  );
}

function NextStep({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: 'purple' | 'green' | 'blue' | 'gray';
}) {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
          {title}
        </p>
        <p className="text-sm text-gray-500 truncate">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-primary-600 transition-colors" />
    </Link>
  );
}
