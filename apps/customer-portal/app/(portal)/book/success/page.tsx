'use client';

/**
 * Booking Success Page
 * ====================
 *
 * Confirmation page shown after successful booking.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('id');
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (bookingId) {
      loadBooking();
    }
  }, [bookingId]);

  const loadBooking = async () => {
    const result = await customerApi.getBooking(bookingId!);
    if (result.success && result.data) {
      setBooking(result.data.booking);
    }
  };

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        {/* Success icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Reserva creada!
        </h1>
        <p className="text-gray-600 mb-6">
          Tu solicitud fue enviada correctamente. Te notificaremos cuando sea
          confirmada.
        </p>

        {/* Booking details */}
        {booking && (
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-500">Servicio</p>
                  <p className="font-medium text-gray-900">
                    {booking.serviceTypeName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-500">Fecha solicitada</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(booking.requestedDateTime, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-500">Dirección</p>
                  <p className="font-medium text-gray-900">{booking.address}</p>
                </div>
              </div>

              {booking.estimatedPrice && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500">Precio estimado</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(booking.estimatedPrice)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
          Pendiente de confirmación
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link href="/jobs" className="btn-primary w-full">
            Ver mis reservas
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <Link
            href="/dashboard"
            className="block text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al inicio
          </Link>
        </div>
      </div>

      {/* Info text */}
      <p className="text-sm text-gray-500 mt-6">
        Recibirás un email y/o SMS cuando tu reserva sea confirmada.
        <br />
        Si tenés alguna consulta, contactanos desde{' '}
        <Link href="/support" className="text-primary-600 hover:underline">
          Soporte
        </Link>
        .
      </p>
    </div>
  );
}
