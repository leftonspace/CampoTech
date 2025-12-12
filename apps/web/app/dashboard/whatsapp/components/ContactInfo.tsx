'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  MessageCircle,
  Clock,
  User,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface ContactInfoProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    id: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    isInWindow: boolean;
    unreadCount: number;
    lastMessage: {
      timestamp: string;
    };
  } | null;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    jobs?: Array<{
      id: string;
      title: string;
      status: string;
      scheduledDate?: string;
    }>;
  } | null;
}

export default function ContactInfo({
  isOpen,
  onClose,
  conversation,
  customer,
}: ContactInfoProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'jobs'>('info');

  if (!isOpen || !conversation) return null;

  const initials = conversation.customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Informacion del contacto</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Profile */}
      <div className="p-6 text-center border-b">
        <div className="w-20 h-20 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-2xl">
          {initials}
        </div>
        <h2 className="mt-4 font-semibold text-gray-900 text-lg">
          {conversation.customerName}
        </h2>
        <p className="text-gray-500">{conversation.customerPhone}</p>

        {/* Window status */}
        <div className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
          conversation.isInWindow
            ? 'bg-success-50 text-success-700'
            : 'bg-warning-50 text-warning-700'
        }`}>
          <Clock className="h-4 w-4" />
          {conversation.isInWindow ? 'En ventana 24h' : 'Fuera de ventana'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'info'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Informacion
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'jobs'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Trabajos
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' ? (
          <div className="p-4 space-y-4">
            {/* Contact details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded">
                  <Phone className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telefono</p>
                  <p className="text-sm text-gray-900">{conversation.customerPhone}</p>
                </div>
              </div>

              {customer?.email && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded">
                    <Mail className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-900">{customer.email}</p>
                  </div>
                </div>
              )}

              {customer?.address && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded">
                    <MapPin className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Direccion</p>
                    <p className="text-sm text-gray-900">{customer.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="pt-4 border-t">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">
                Actividad
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <MessageCircle className="h-5 w-5 mx-auto text-gray-400 mb-1" />
                  <p className="text-lg font-semibold text-gray-900">
                    {conversation.unreadCount}
                  </p>
                  <p className="text-xs text-gray-500">No leidos</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <Calendar className="h-5 w-5 mx-auto text-gray-400 mb-1" />
                  <p className="text-sm font-medium text-gray-900">
                    {formatRelativeTime(conversation.lastMessage.timestamp)}
                  </p>
                  <p className="text-xs text-gray-500">Ultimo mensaje</p>
                </div>
              </div>
            </div>

            {/* Link to customer */}
            {conversation.customerId && (
              <div className="pt-4 border-t">
                <Link
                  href={`/dashboard/customers/${conversation.customerId}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-700">Ver ficha del cliente</span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            {customer?.jobs && customer.jobs.length > 0 ? (
              <div className="space-y-3">
                {customer.jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {job.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.scheduledDate
                            ? new Date(job.scheduledDate).toLocaleDateString('es-AR')
                            : 'Sin programar'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        job.status === 'COMPLETED'
                          ? 'bg-success-50 text-success-700'
                          : job.status === 'IN_PROGRESS'
                          ? 'bg-primary-50 text-primary-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {job.status === 'COMPLETED' && 'Completado'}
                        {job.status === 'IN_PROGRESS' && 'En progreso'}
                        {job.status === 'PENDING' && 'Pendiente'}
                        {job.status === 'SCHEDULED' && 'Programado'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Briefcase className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay trabajos asociados</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
