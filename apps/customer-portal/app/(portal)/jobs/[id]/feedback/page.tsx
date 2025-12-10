'use client';

/**
 * Job Feedback Page
 * =================
 *
 * Allows customers to rate and review completed jobs.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { cn } from '@/lib/utils';

interface FeedbackData {
  rating: number;
  serviceQuality: number;
  punctuality: number;
  professionalism: number;
  valueForMoney: number;
  wouldRecommend: boolean | null;
  comment: string;
}

const ratingCategories = [
  { key: 'serviceQuality', label: 'Calidad del servicio' },
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'professionalism', label: 'Profesionalismo' },
  { key: 'valueForMoney', label: 'Relación calidad-precio' },
];

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    serviceQuality: 0,
    punctuality: 0,
    professionalism: 0,
    valueForMoney: 0,
    wouldRecommend: null,
    comment: '',
  });

  useEffect(() => {
    loadJob();
  }, [params.id]);

  const loadJob = async () => {
    setIsLoading(true);
    const result = await customerApi.getJob(params.id as string);

    if (result.success && result.data) {
      setJob(result.data.job);
      if (result.data.job.hasFeedback) {
        setError('Ya calificaste este servicio');
      }
    } else {
      setError('Trabajo no encontrado');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (feedback.rating === 0) {
      setError('Por favor seleccioná una calificación general');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const result = await customerApi.submitFeedback(params.id as string, {
      rating: feedback.rating,
      serviceQuality: feedback.serviceQuality || undefined,
      punctuality: feedback.punctuality || undefined,
      professionalism: feedback.professionalism || undefined,
      valueForMoney: feedback.valueForMoney || undefined,
      wouldRecommend: feedback.wouldRecommend ?? undefined,
      comment: feedback.comment || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error?.message || 'Error al enviar la calificación');
    }
  };

  const setRating = (key: keyof FeedbackData, value: number) => {
    setFeedback({ ...feedback, [key]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Gracias por tu feedback!
        </h1>
        <p className="text-gray-600 mb-6">
          Tu opinión nos ayuda a mejorar nuestros servicios.
        </p>
        <button onClick={() => router.push('/jobs')} className="btn-primary">
          Volver a mis trabajos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/jobs/${params.id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Calificar servicio
        </h1>
        <p className="text-gray-600">
          {job?.serviceType} - {job?.address}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* Overall rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Calificación general *
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating('rating', star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'w-10 h-10 transition-colors',
                      star <= feedback.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              {feedback.rating === 0 && 'Seleccioná una calificación'}
              {feedback.rating === 1 && 'Muy malo'}
              {feedback.rating === 2 && 'Malo'}
              {feedback.rating === 3 && 'Regular'}
              {feedback.rating === 4 && 'Bueno'}
              {feedback.rating === 5 && 'Excelente'}
            </p>
          </div>

          {/* Category ratings */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm font-medium text-gray-700 mb-4">
              Calificaciones detalladas (opcional)
            </p>
            <div className="space-y-4">
              {ratingCategories.map((category) => (
                <div key={category.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{category.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setRating(category.key as keyof FeedbackData, star)
                        }
                        className="p-0.5"
                      >
                        <Star
                          className={cn(
                            'w-5 h-5 transition-colors',
                            star <=
                              (feedback[category.key as keyof FeedbackData] as number)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Would recommend */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm font-medium text-gray-700 mb-3">
              ¿Recomendarías este servicio?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setFeedback({ ...feedback, wouldRecommend: true })
                }
                className={cn(
                  'flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors',
                  feedback.wouldRecommend === true
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <ThumbsUp className="w-5 h-5" />
                Sí
              </button>
              <button
                type="button"
                onClick={() =>
                  setFeedback({ ...feedback, wouldRecommend: false })
                }
                className={cn(
                  'flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors',
                  feedback.wouldRecommend === false
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <ThumbsDown className="w-5 h-5" />
                No
              </button>
            </div>
          </div>

          {/* Comment */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comentario (opcional)
            </label>
            <textarea
              value={feedback.comment}
              onChange={(e) =>
                setFeedback({ ...feedback, comment: e.target.value })
              }
              placeholder="Contanos tu experiencia..."
              rows={4}
              className="input"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || feedback.rating === 0}
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Enviar calificación'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
