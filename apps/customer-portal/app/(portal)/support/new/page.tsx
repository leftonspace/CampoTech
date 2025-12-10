'use client';

/**
 * New Support Ticket Page
 * =======================
 *
 * Form for creating new support tickets.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  MessageSquare,
  FileText,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  Loader2,
  AlertCircle,
  Paperclip,
  X,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { cn } from '@/lib/utils';

const categories = [
  { id: 'general', label: 'Consulta general', icon: HelpCircle },
  { id: 'service', label: 'Sobre un servicio', icon: FileText },
  { id: 'billing', label: 'Facturación', icon: CreditCard },
  { id: 'complaint', label: 'Reclamo', icon: AlertTriangle },
  { id: 'feedback', label: 'Sugerencia', icon: MessageSquare },
];

const priorities = [
  { id: 'low', label: 'Baja', description: 'Consulta sin urgencia' },
  { id: 'medium', label: 'Normal', description: 'Tiempo de respuesta normal' },
  { id: 'high', label: 'Alta', description: 'Requiere atención pronto' },
  { id: 'urgent', label: 'Urgente', description: 'Necesita respuesta inmediata' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const relatedJobId = searchParams.get('job');
  const relatedInvoiceId = searchParams.get('invoice');

  const [formData, setFormData] = useState({
    category: 'general',
    priority: 'medium',
    subject: '',
    message: '',
    relatedJobId: relatedJobId || '',
    relatedInvoiceId: relatedInvoiceId || '',
  });

  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRelatedData();
  }, []);

  const loadRelatedData = async () => {
    // Load recent jobs for linking
    const jobsResult = await customerApi.getJobs({ limit: 10 });
    if (jobsResult.success && jobsResult.data) {
      setJobs(jobsResult.data.jobs || []);
    }

    // Load recent invoices for linking
    const invoicesResult = await customerApi.getInvoices({ limit: 10 });
    if (invoicesResult.success && invoicesResult.data) {
      setInvoices(invoicesResult.data.invoices || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim()) {
      setError('Por favor ingresá un asunto');
      return;
    }
    if (!formData.message.trim()) {
      setError('Por favor ingresá un mensaje');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await customerApi.createTicket({
      category: formData.category,
      priority: formData.priority,
      subject: formData.subject.trim(),
      message: formData.message.trim(),
      relatedJobId: formData.relatedJobId || undefined,
      relatedInvoiceId: formData.relatedInvoiceId || undefined,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/support/${result.data.ticket.id}`);
    } else {
      setError(result.error?.message || 'Error al crear el ticket');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/support')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo ticket de soporte</h1>
        <p className="text-gray-600">
          Completá el formulario y te responderemos a la brevedad
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
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Categoría
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-colors flex items-center gap-2',
                    formData.category === cat.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <cat.icon
                    className={cn(
                      'w-5 h-5',
                      formData.category === cat.id
                        ? 'text-primary-600'
                        : 'text-gray-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      formData.category === cat.id
                        ? 'text-primary-700'
                        : 'text-gray-700'
                    )}
                  >
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Prioridad
            </label>
            <div className="flex flex-wrap gap-2">
              {priorities.map((pri) => (
                <button
                  key={pri.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: pri.id })}
                  className={cn(
                    'px-4 py-2 rounded-lg border-2 transition-colors',
                    formData.priority === pri.id
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {pri.label}
                </button>
              ))}
            </div>
          </div>

          {/* Related job/invoice */}
          {(formData.category === 'service' || formData.category === 'billing') && (
            <div className="grid sm:grid-cols-2 gap-4">
              {(formData.category === 'service' || formData.category === 'billing') &&
                jobs.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trabajo relacionado
                    </label>
                    <select
                      value={formData.relatedJobId}
                      onChange={(e) =>
                        setFormData({ ...formData, relatedJobId: e.target.value })
                      }
                      className="input"
                    >
                      <option value="">Ninguno</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.serviceType} - {job.address?.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {formData.category === 'billing' && invoices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Factura relacionada
                  </label>
                  <select
                    value={formData.relatedInvoiceId}
                    onChange={(e) =>
                      setFormData({ ...formData, relatedInvoiceId: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">Ninguna</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        #{inv.invoiceNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asunto *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Breve descripción de tu consulta"
              className="input"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Describí tu consulta con el mayor detalle posible..."
              rows={6}
              className="input"
              required
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/support')}
              className="btn-outline"
            >
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Enviar ticket'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
