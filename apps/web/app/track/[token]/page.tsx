'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MapPin, Phone, MessageCircle, User, Clock, Truck } from 'lucide-react';

interface TrackingData {
  technicianName: string;
  technicianPhoto?: string;
  technicianRating?: number;
  currentPosition?: { lat: number; lng: number };
  destination: { lat: number; lng: number; address: string };
  etaMinutes?: number;
  movementMode: string;
  status: string;
  jobDescription: string;
  jobReference: string;
  organizationName: string;
  organizationLogo?: string;
}

export default function TrackingPage() {
  const params = useParams();
  const token = params.token as string;

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch tracking data
  const fetchTrackingData = async () => {
    try {
      const response = await fetch(`/api/tracking/${token}`);
      const result = await response.json();

      if (result.success) {
        setTrackingData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Error al cargar datos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();

    // Poll every 10 seconds for updates
    const interval = setInterval(fetchTrackingData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Link no válido
          </h1>
          <p className="text-gray-600">
            {error || 'Este link de seguimiento ya no está disponible o expiró.'}
          </p>
        </div>
      </div>
    );
  }

  const getStatusDisplay = () => {
    switch (trackingData.status) {
      case 'active':
        return { text: 'En camino', color: 'bg-blue-100 text-blue-700' };
      case 'arrived':
        return { text: 'Llegó', color: 'bg-green-100 text-green-700' };
      case 'completed':
        return { text: 'Completado', color: 'bg-gray-100 text-gray-700' };
      default:
        return { text: trackingData.status, color: 'bg-gray-100 text-gray-700' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary-600" />
            <span className="font-semibold text-gray-900">
              {trackingData.organizationName}
            </span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
            {status.text}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Map Placeholder */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="h-64 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center relative">
            {trackingData.status === 'active' ? (
              <div className="text-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl animate-pulse">
                    🚐
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Técnico en movimiento
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl">
                  ✓
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  {trackingData.status === 'arrived' ? 'El técnico llegó' : 'Servicio completado'}
                </p>
              </div>
            )}

            {/* Destination marker */}
            <div className="absolute bottom-4 right-4 bg-white rounded-lg px-3 py-2 shadow-md">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-red-500" />
                <span className="text-gray-700">Tu ubicación</span>
              </div>
            </div>
          </div>
        </div>

        {/* ETA Card */}
        {trackingData.status === 'active' && trackingData.etaMinutes && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Llegada estimada</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ~{trackingData.etaMinutes} min
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {trackingData.movementMode === 'driving'
                    ? 'En vehículo'
                    : trackingData.movementMode === 'walking'
                      ? 'Caminando'
                      : 'Detenido'}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(10, 100 - (trackingData.etaMinutes / 30) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Technician Card */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {trackingData.technicianPhoto ? (
                <img
                  src={trackingData.technicianPhoto}
                  alt={trackingData.technicianName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-7 w-7 text-gray-500" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {trackingData.technicianName}
              </h3>
              {trackingData.technicianRating && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <span className="text-yellow-500">★</span>
                  <span>{trackingData.technicianRating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Contact buttons */}
            <div className="flex gap-2">
              <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Phone className="h-5 w-5 text-gray-700" />
              </button>
              <button className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors">
                <MessageCircle className="h-5 w-5 text-green-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">
            Detalles del servicio
          </h4>
          <p className="text-gray-900">{trackingData.jobDescription}</p>
          <p className="text-sm text-gray-500 mt-1">
            Referencia: {trackingData.jobReference}
          </p>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                {trackingData.destination.address}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Powered by CampoTech
          </p>
        </div>
      </main>
    </div>
  );
}
