'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, CheckCircle, AlertCircle, MessageCircle, Phone, Building2 } from 'lucide-react';

interface RatingData {
  organizationName: string;
  organizationLogo?: string;
  organizationPhone?: string;
  serviceType: string;
  jobDescription: string;
  technicianName?: string;
  completedAt?: string;
  alreadyRated: boolean;
  existingRating?: number;
  existingComment?: string;
}

export default function RatingPage() {
  const params = useParams();
  const token = params.token as string;

  const [ratingData, setRatingData] = useState<RatingData | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch rating data using token
  useEffect(() => {
    const fetchRatingData = async () => {
      try {
        const response = await fetch(`/api/ratings/${token}`);
        const result = await response.json();

        if (result.success) {
          setRatingData(result.data);
          if (result.data.alreadyRated) {
            setSelectedRating(result.data.existingRating || 0);
            setComment(result.data.existingComment || '');
            setSubmitted(true);
          }
        } else {
          setError(result.error || 'Link no válido');
        }
      } catch (err) {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchRatingData();
  }, [token]);

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      setError('Por favor, selecciona una calificación');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating: selectedRating,
          comment: comment.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error || 'Error al enviar calificación');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid token)
  if (error && !ratingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Link no válido
          </h1>
          <p className="text-gray-600">
            {error || 'Este link de calificación ya no está disponible o expiró.'}
          </p>
        </div>
      </div>
    );
  }

  // Already submitted state
  if (submitted && ratingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Gracias por tu calificación!
          </h1>

          <p className="text-gray-600 mb-6">
            Tu opinión nos ayuda a mejorar nuestro servicio.
          </p>

          {/* Show stars */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-8 w-8 ${
                  star <= selectedRating
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Save WhatsApp prompt */}
          {ratingData.organizationPhone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-green-800 font-medium mb-3">
                📱 Guardá este WhatsApp para futuras consultas:
              </p>
              <a
                href={`https://wa.me/${ratingData.organizationPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                {ratingData.organizationPhone}
              </a>
            </div>
          )}

          <p className="text-sm text-gray-500">
            {ratingData.organizationName}
          </p>
        </div>
      </div>
    );
  }

  // Rating form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          {ratingData?.organizationLogo ? (
            <img
              src={ratingData.organizationLogo}
              alt={ratingData.organizationName}
              className="h-16 w-auto mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary-600" />
            </div>
          )}

          <h1 className="text-xl font-bold text-gray-900 mb-1">
            ⭐ Calificá tu experiencia
          </h1>
          <p className="text-gray-600 text-sm">
            Tu opinión nos ayuda a mejorar
          </p>
        </div>

        {/* Service info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="text-sm text-gray-500 mb-1">Servicio</div>
          <div className="font-medium text-gray-900">
            {ratingData?.serviceType}
          </div>
          {ratingData?.jobDescription && (
            <div className="text-sm text-gray-600 mt-1">
              {ratingData.jobDescription}
            </div>
          )}
          <div className="text-sm text-primary-600 mt-2">
            {ratingData?.organizationName}
          </div>
          {ratingData?.technicianName && (
            <div className="text-xs text-gray-500 mt-1">
              Técnico: {ratingData.technicianName}
            </div>
          )}
        </div>

        {/* Star rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
            ¿Cómo calificarías el servicio?
          </label>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSelectedRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    star <= (hoveredRating || selectedRating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 hover:text-yellow-200'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="text-center mt-2 h-5">
            {selectedRating > 0 && (
              <span className="text-sm text-gray-600">
                {selectedRating === 1 && 'Muy malo'}
                {selectedRating === 2 && 'Malo'}
                {selectedRating === 3 && 'Regular'}
                {selectedRating === 4 && 'Bueno'}
                {selectedRating === 5 && 'Excelente'}
              </span>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comentarios (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Querés contarnos algo más sobre tu experiencia?"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            maxLength={500}
          />
          <div className="text-xs text-gray-400 text-right mt-1">
            {comment.length}/500
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedRating === 0}
          className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all ${
            selectedRating === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : submitting
              ? 'bg-primary-400 cursor-wait'
              : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              Enviando...
            </span>
          ) : (
            'Enviar Calificación'
          )}
        </button>

        {/* Contact */}
        {ratingData?.organizationPhone && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 mb-2">¿Necesitás ayuda?</p>
            <a
              href={`tel:${ratingData.organizationPhone}`}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Phone className="h-4 w-4" />
              {ratingData.organizationPhone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
