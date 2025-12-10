'use client';

/**
 * Support Ticket Detail Page
 * ==========================
 *
 * Shows ticket details and chat interface for messages.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  User,
  Headphones,
  Loader2,
  FileText,
  CreditCard,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { useCustomerAuth } from '@/lib/customer-auth';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  open: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', label: 'Abierto' },
  in_progress: { color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'En progreso' },
  waiting_customer: {
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    label: 'Esperando respuesta',
  },
  resolved: { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Resuelto' },
  closed: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Cerrado' },
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { customer } = useCustomerAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTicket();
  }, [params.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadTicket = async () => {
    setIsLoading(true);
    const result = await customerApi.getTicket(params.id as string);

    if (result.success && result.data) {
      setTicket(result.data.ticket);
      setMessages(result.data.messages || []);
    } else {
      setError(result.error?.message || 'Error al cargar el ticket');
    }
    setIsLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    setIsSending(true);
    setError('');

    const result = await customerApi.addTicketMessage(
      params.id as string,
      newMessage.trim()
    );

    if (result.success && result.data) {
      setMessages([...messages, result.data.message]);
      setNewMessage('');
    } else {
      setError(result.error?.message || 'Error al enviar el mensaje');
    }

    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => router.push('/support')} className="btn-primary">
          Volver a soporte
        </button>
      </div>
    );
  }

  const status = statusConfig[ticket.status] || statusConfig.open;
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/support')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {ticket.subject}
            </h1>
            <p className="text-sm text-gray-500">
              Ticket #{ticket.ticketNumber} • {ticket.category}
            </p>
          </div>
          <span className={cn('px-3 py-1.5 rounded-full text-sm font-medium', status.bgColor, status.color)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Related items */}
      {(ticket.relatedJobId || ticket.relatedInvoiceId) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {ticket.relatedJobId && (
            <Link
              href={`/jobs/${ticket.relatedJobId}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Ver trabajo relacionado
            </Link>
          )}
          {ticket.relatedInvoiceId && (
            <Link
              href={`/invoices/${ticket.relatedInvoiceId}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Ver factura relacionada
            </Link>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message, index) => {
            const isCustomer = message.authorType === 'customer';
            const isFirstOfGroup =
              index === 0 || messages[index - 1].authorType !== message.authorType;

            return (
              <div
                key={message.id}
                className={cn('flex', isCustomer ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%]',
                    isCustomer ? 'order-2' : 'order-1'
                  )}
                >
                  {isFirstOfGroup && (
                    <div
                      className={cn(
                        'flex items-center gap-2 mb-1',
                        isCustomer ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          isCustomer ? 'bg-primary-100' : 'bg-gray-200'
                        )}
                      >
                        {isCustomer ? (
                          <User className="w-3 h-3 text-primary-600" />
                        ) : (
                          <Headphones className="w-3 h-3 text-gray-600" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {isCustomer ? 'Vos' : message.authorName || 'Soporte'}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2',
                      isCustomer
                        ? 'bg-primary-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p
                    className={cn(
                      'text-xs text-gray-400 mt-1',
                      isCustomer ? 'text-right' : 'text-left'
                    )}
                  >
                    {formatRelativeTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!isClosed ? (
          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-gray-200 bg-white"
          >
            {error && (
              <p className="text-sm text-red-600 mb-2">{error}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribí tu mensaje..."
                className="input flex-1"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={isSending || !newMessage.trim()}
                className="btn-primary px-4"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-sm text-gray-500">
              Este ticket está {ticket.status === 'resolved' ? 'resuelto' : 'cerrado'}
            </p>
            <Link
              href="/support/new"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Crear nuevo ticket
            </Link>
          </div>
        )}
      </div>

      {/* Ticket info */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Información del ticket
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Creado</p>
            <p className="text-gray-900">{formatDate(ticket.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Última actualización</p>
            <p className="text-gray-900">{formatRelativeTime(ticket.updatedAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Prioridad</p>
            <p className="text-gray-900 capitalize">{ticket.priority}</p>
          </div>
          {ticket.assignedToName && (
            <div>
              <p className="text-gray-500">Asignado a</p>
              <p className="text-gray-900">{ticket.assignedToName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
