'use client';

/**
 * Booking Page
 * ============
 *
 * Multi-step booking flow for customers to schedule services.
 * Steps: Service Selection -> Date/Time -> Address -> Confirmation
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

type BookingStep = 'service' | 'datetime' | 'address' | 'confirm';

interface ServiceType {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  priceRange: { min: number; max: number };
}

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  availableTechnicians: number;
}

interface BookingData {
  serviceTypeId: string;
  serviceTypeName: string;
  selectedDate: string;
  selectedTime: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  notes: string;
}

const steps: { id: BookingStep; label: string }[] = [
  { id: 'service', label: 'Servicio' },
  { id: 'datetime', label: 'Fecha y Hora' },
  { id: 'address', label: 'Dirección' },
  { id: 'confirm', label: 'Confirmación' },
];

export default function BookingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [services, setServices] = useState<ServiceType[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());

  const [bookingData, setBookingData] = useState<BookingData>({
    serviceTypeId: '',
    serviceTypeName: '',
    selectedDate: '',
    selectedTime: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    notes: '',
  });

  // Load available services on mount
  useEffect(() => {
    loadServices();
  }, []);

  // Load available slots when service is selected
  useEffect(() => {
    if (bookingData.serviceTypeId && currentStep === 'datetime') {
      loadAvailability();
    }
  }, [bookingData.serviceTypeId, selectedWeek, currentStep]);

  const loadServices = async () => {
    setIsLoading(true);
    const result = await customerApi.getAvailableServices();
    if (result.success && result.data) {
      setServices(result.data.services || []);
    } else {
      setError('Error al cargar los servicios disponibles');
    }
    setIsLoading(false);
  };

  const loadAvailability = async () => {
    setIsLoading(true);
    const startDate = selectedWeek.toISOString().split('T')[0];
    const endDate = new Date(selectedWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const result = await customerApi.getAvailability(
      bookingData.serviceTypeId,
      startDate,
      endDate
    );

    if (result.success && result.data) {
      setAvailableSlots(result.data.slots || []);
    } else {
      setError('Error al cargar la disponibilidad');
    }
    setIsLoading(false);
  };

  const handleServiceSelect = (service: ServiceType) => {
    setBookingData({
      ...bookingData,
      serviceTypeId: service.id,
      serviceTypeName: service.name,
    });
    setCurrentStep('datetime');
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setBookingData({
      ...bookingData,
      selectedDate: slot.date,
      selectedTime: slot.startTime,
    });
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingData.address) {
      setError('Por favor ingresá una dirección');
      return;
    }
    setError('');
    setCurrentStep('confirm');
  };

  const handleConfirmBooking = async () => {
    setIsLoading(true);
    setError('');

    const result = await customerApi.createBooking({
      serviceTypeId: bookingData.serviceTypeId,
      serviceTypeName: bookingData.serviceTypeName,
      requestedDateTime: `${bookingData.selectedDate}T${bookingData.selectedTime}`,
      address: bookingData.address,
      city: bookingData.city,
      province: bookingData.province,
      postalCode: bookingData.postalCode,
      notes: bookingData.notes,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/book/success?id=${result.data.booking.id}`);
    } else {
      setError(result.error?.message || 'Error al crear la reserva');
    }
  };

  const goBack = () => {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  };

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservar servicio</h1>
        <p className="text-gray-600">
          Completá los pasos para agendar tu servicio
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex items-center">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  index < currentStepIndex
                    ? 'bg-primary-600 text-white'
                    : index === currentStepIndex
                    ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2',
                    index < currentStepIndex ? 'bg-primary-600' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <span
              key={step.id}
              className="text-xs text-gray-500 flex-1 text-center first:text-left last:text-right"
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Service selection */}
        {currentStep === 'service' && (
          <ServiceSelectionStep
            services={services}
            isLoading={isLoading}
            onSelect={handleServiceSelect}
          />
        )}

        {/* Date/Time selection */}
        {currentStep === 'datetime' && (
          <DateTimeSelectionStep
            slots={availableSlots}
            selectedDate={bookingData.selectedDate}
            selectedTime={bookingData.selectedTime}
            isLoading={isLoading}
            selectedWeek={selectedWeek}
            onSlotSelect={handleSlotSelect}
            onWeekChange={setSelectedWeek}
            onBack={goBack}
            onNext={() => setCurrentStep('address')}
          />
        )}

        {/* Address input */}
        {currentStep === 'address' && (
          <AddressStep
            bookingData={bookingData}
            onChange={(data) => setBookingData({ ...bookingData, ...data })}
            onBack={goBack}
            onSubmit={handleAddressSubmit}
          />
        )}

        {/* Confirmation */}
        {currentStep === 'confirm' && (
          <ConfirmationStep
            bookingData={bookingData}
            services={services}
            isLoading={isLoading}
            onBack={goBack}
            onConfirm={handleConfirmBooking}
          />
        )}
      </div>
    </div>
  );
}

// Service selection step
function ServiceSelectionStep({
  services,
  isLoading,
  onSelect,
}: {
  services: ServiceType[];
  isLoading: boolean;
  onSelect: (service: ServiceType) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Seleccioná el servicio
      </h2>
      <div className="space-y-3">
        {services.length > 0 ? (
          services.map((service) => (
            <button
              key={service.id}
              onClick={() => onSelect(service)}
              className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Duración estimada: {service.estimatedDuration} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {formatCurrency(service.priceRange.min)} -{' '}
                    {formatCurrency(service.priceRange.max)}
                  </p>
                  <ArrowRight className="w-5 h-5 text-gray-400 ml-auto mt-2" />
                </div>
              </div>
            </button>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">
            No hay servicios disponibles en este momento
          </p>
        )}
      </div>
    </div>
  );
}

// Date/Time selection step
function DateTimeSelectionStep({
  slots,
  selectedDate,
  selectedTime,
  isLoading,
  selectedWeek,
  onSlotSelect,
  onWeekChange,
  onBack,
  onNext,
}: {
  slots: TimeSlot[];
  selectedDate: string;
  selectedTime: string;
  isLoading: boolean;
  selectedWeek: Date;
  onSlotSelect: (slot: TimeSlot) => void;
  onWeekChange: (date: Date) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() + i);
    return date;
  });

  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  const prevWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() - 7);
    if (newDate >= new Date()) {
      onWeekChange(newDate);
    }
  };

  const nextWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + 7);
    onWeekChange(newDate);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Elegí fecha y hora
      </h2>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevWeek}
          className="p-2 rounded-lg hover:bg-gray-100"
          disabled={selectedWeek <= new Date()}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-medium text-gray-700">
          {formatDate(selectedWeek.toISOString(), { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map((day) => {
          const dateStr = day.toISOString().split('T')[0];
          const hasSlots = groupedSlots[dateStr]?.some((s) => s.available);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              disabled={!hasSlots}
              onClick={() => {
                const firstAvailable = groupedSlots[dateStr]?.find(
                  (s) => s.available
                );
                if (firstAvailable) onSlotSelect(firstAvailable);
              }}
              className={cn(
                'p-2 rounded-lg text-center transition-colors',
                isSelected
                  ? 'bg-primary-600 text-white'
                  : hasSlots
                  ? 'bg-gray-50 hover:bg-primary-50 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              <span className="block text-xs">
                {day.toLocaleDateString('es-AR', { weekday: 'short' })}
              </span>
              <span className="block text-lg font-medium">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Time slots for selected date */}
      {selectedDate && groupedSlots[selectedDate] && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Horarios disponibles
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {groupedSlots[selectedDate].map((slot) => (
              <button
                key={`${slot.date}-${slot.startTime}`}
                disabled={!slot.available}
                onClick={() => onSlotSelect(slot)}
                className={cn(
                  'p-2 rounded-lg text-sm transition-colors',
                  selectedTime === slot.startTime
                    ? 'bg-primary-600 text-white'
                    : slot.available
                    ? 'bg-gray-50 hover:bg-primary-50'
                    : 'bg-gray-100 text-gray-400 line-through'
                )}
              >
                {slot.startTime.slice(0, 5)}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!selectedDate || !selectedTime}
          className="btn-primary"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// Address step
function AddressStep({
  bookingData,
  onChange,
  onBack,
  onSubmit,
}: {
  bookingData: BookingData;
  onChange: (data: Partial<BookingData>) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Dirección del servicio
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección *
          </label>
          <input
            type="text"
            value={bookingData.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Ej: Av. Corrientes 1234, Piso 5, Depto A"
            className="input"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ciudad
            </label>
            <input
              type="text"
              value={bookingData.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="Buenos Aires"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provincia
            </label>
            <input
              type="text"
              value={bookingData.province}
              onChange={(e) => onChange({ province: e.target.value })}
              placeholder="CABA"
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código Postal
          </label>
          <input
            type="text"
            value={bookingData.postalCode}
            onChange={(e) => onChange({ postalCode: e.target.value })}
            placeholder="C1043"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas adicionales
          </label>
          <textarea
            value={bookingData.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Instrucciones especiales, detalles del problema, etc."
            rows={3}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button type="submit" className="btn-primary">
          Continuar
        </button>
      </div>
    </form>
  );
}

// Confirmation step
function ConfirmationStep({
  bookingData,
  services,
  isLoading,
  onBack,
  onConfirm,
}: {
  bookingData: BookingData;
  services: ServiceType[];
  isLoading: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const selectedService = services.find((s) => s.id === bookingData.serviceTypeId);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Confirmá tu reserva
      </h2>

      <div className="space-y-4">
        {/* Service */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <Calendar className="w-5 h-5 text-primary-600 mt-0.5" />
          <div>
            <p className="text-sm text-gray-500">Servicio</p>
            <p className="font-medium text-gray-900">{bookingData.serviceTypeName}</p>
            {selectedService && (
              <p className="text-sm text-gray-500">
                Precio estimado: {formatCurrency(selectedService.priceRange.min)} -{' '}
                {formatCurrency(selectedService.priceRange.max)}
              </p>
            )}
          </div>
        </div>

        {/* Date/Time */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <Clock className="w-5 h-5 text-primary-600 mt-0.5" />
          <div>
            <p className="text-sm text-gray-500">Fecha y hora</p>
            <p className="font-medium text-gray-900">
              {formatDate(bookingData.selectedDate, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <p className="text-sm text-gray-700">{bookingData.selectedTime.slice(0, 5)} hs</p>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <MapPin className="w-5 h-5 text-primary-600 mt-0.5" />
          <div>
            <p className="text-sm text-gray-500">Dirección</p>
            <p className="font-medium text-gray-900">{bookingData.address}</p>
            {(bookingData.city || bookingData.province) && (
              <p className="text-sm text-gray-700">
                {[bookingData.city, bookingData.province].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {bookingData.notes && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Notas</p>
            <p className="text-gray-700">{bookingData.notes}</p>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 mt-4">
        Al confirmar, recibirás una notificación cuando tu reserva sea aprobada.
      </p>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>
        <button onClick={onConfirm} disabled={isLoading} className="btn-primary">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Confirmar reserva'
          )}
        </button>
      </div>
    </div>
  );
}
