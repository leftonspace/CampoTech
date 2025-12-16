'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, Phone, MessageCircle, User, Clock, Truck, Star, CheckCircle, FileText, Download } from 'lucide-react';
import Link from 'next/link';

// Dynamically import the map component to avoid SSR issues with Leaflet
const TrackingMap = dynamic(
  () => import('@/components/maps/TrackingMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    ),
  }
);

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
  organizationPhone?: string;
  ratingToken?: string;
  completedAt?: string;
  invoiceUrl?: string;
  reportUrl?: string;
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
        {/* Interactive Map */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <TrackingMap
            technicianPosition={trackingData.currentPosition}
            destination={trackingData.destination}
            status={trackingData.status as 'active' | 'arrived' | 'completed' | 'cancelled'}
            movementMode={trackingData.movementMode}
            className="h-64"
            showRoute={trackingData.status === 'active'}
          />
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

        {/* Completed Job Section */}
        {trackingData.status === 'completed' && (
          <div className="space-y-4">
            {/* Completion Success Message */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800">
                    ¡Servicio completado!
                  </h3>
                  {trackingData.completedAt && (
                    <p className="text-sm text-green-600">
                      {new Date(trackingData.completedAt).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Documents Download */}
            {(trackingData.invoiceUrl || trackingData.reportUrl) && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-3">
                  Documentos
                </h4>
                <div className="space-y-2">
                  {trackingData.invoiceUrl && (
                    <a
                      href={trackingData.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="h-5 w-5 text-primary-600" />
                      <span className="flex-1 text-gray-900">Factura PDF</span>
                      <Download className="h-5 w-5 text-gray-400" />
                    </a>
                  )}
                  {trackingData.reportUrl && (
                    <a
                      href={trackingData.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="h-5 w-5 text-primary-600" />
                      <span className="flex-1 text-gray-900">Reporte de servicio</span>
                      <Download className="h-5 w-5 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Rating Prompt */}
            {trackingData.ratingToken && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Star className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      ¿Cómo fue tu experiencia?
                    </h4>
                    <p className="text-sm text-gray-500">
                      Tu opinión nos ayuda a mejorar
                    </p>
                  </div>
                </div>
                <Link
                  href={`/rate/${trackingData.ratingToken}`}
                  className="w-full block text-center py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
                >
                  Calificar servicio
                </Link>
              </div>
            )}

            {/* Save WhatsApp Prompt */}
            {trackingData.organizationPhone && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-800 font-medium mb-3">
                  📱 Guardá este WhatsApp para futuras consultas:
                </p>
                <a
                  href={`https://wa.me/${trackingData.organizationPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  {trackingData.organizationPhone}
                </a>
              </div>
            )}
          </div>
        )}

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
