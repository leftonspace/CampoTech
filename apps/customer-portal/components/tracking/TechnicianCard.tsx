'use client';

/**
 * Technician Card Component
 * =========================
 *
 * Displays technician information with contact options.
 */

import { User, Phone, Star, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TechnicianCardProps {
  name: string;
  phone?: string;
  rating?: number;
  specialty?: string;
  avatarUrl?: string;
  variant?: 'default' | 'compact';
  onCall?: () => void;
  onMessage?: () => void;
  className?: string;
}

export default function TechnicianCard({
  name,
  phone,
  rating,
  specialty = 'Técnico certificado',
  avatarUrl,
  variant = 'default',
  onCall,
  onMessage,
  className = '',
}: TechnicianCardProps) {
  const handleCall = () => {
    if (onCall) {
      onCall();
    } else if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleMessage = () => {
    if (onMessage) {
      onMessage();
    } else if (phone) {
      window.location.href = `https://wa.me/${phone.replace(/\D/g, '')}`;
    }
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-primary-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{name}</p>
          {rating && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-gray-500">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        {phone && (
          <button
            onClick={handleCall}
            className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors"
            aria-label="Llamar al técnico"
          >
            <Phone className="w-4 h-4 text-green-600" />
          </button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Tu técnico</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-primary-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{name}</p>
            <p className="text-sm text-gray-500">{specialty}</p>
            {rating && (
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-sm text-gray-600">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {phone && (
            <>
              <button
                onClick={handleMessage}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors"
                aria-label="Enviar WhatsApp"
              >
                <MessageCircle className="w-5 h-5 text-green-600" />
              </button>
              <button
                onClick={handleCall}
                className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors"
                aria-label="Llamar"
              >
                <Phone className="w-5 h-5 text-blue-600" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
