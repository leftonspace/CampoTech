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
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Play,
  Music,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface MediaItem {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  url: string;
  mimeType?: string;
  timestamp: string;
}

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
  media?: MediaItem[];
}

export default function ContactInfo({
  isOpen,
  onClose,
  conversation,
  customer,
  media = [],
}: ContactInfoProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'jobs' | 'media'>('info');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Filter media by type
  const images = media.filter((m) => m.type === 'IMAGE');
  const videos = media.filter((m) => m.type === 'VIDEO');
  const audios = media.filter((m) => m.type === 'AUDIO');
  const documents = media.filter((m) => m.type === 'DOCUMENT');

  // Lightbox navigation
  const openLightbox = (url: string, index: number) => {
    setLightboxImage(url);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev'
      ? (lightboxIndex - 1 + images.length) % images.length
      : (lightboxIndex + 1) % images.length;
    setLightboxIndex(newIndex);
    setLightboxImage(images[newIndex].url);
  };

  if (!isOpen || !conversation) return null;

  const initials = conversation.customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
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
          <div className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${conversation.isInWindow
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
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'info'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'jobs'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Trabajos
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'media'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Media
            {media.length > 0 && (
              <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
                {media.length}
              </span>
            )}
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
          ) : activeTab === 'jobs' ? (
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
                              ? new Date(job.scheduledDate).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })
                              : 'Sin programar'}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${job.status === 'COMPLETED'
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
          ) : (
            <div className="p-4">
              {media.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay archivos compartidos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Images */}
                  {images.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Imagenes ({images.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-1">
                        {images.map((img, index) => (
                          <button
                            key={img.id}
                            onClick={() => openLightbox(img.url, index)}
                            className="aspect-square bg-gray-100 rounded overflow-hidden hover:opacity-80 transition-opacity"
                          >
                            <img
                              src={img.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Videos */}
                  {videos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Videos ({videos.length})
                      </h4>
                      <div className="space-y-2">
                        {videos.map((video) => (
                          <a
                            key={video.id}
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50"
                          >
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                              <Play className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">Video</p>
                              <p className="text-xs text-gray-500">
                                {formatRelativeTime(video.timestamp)}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audio */}
                  {audios.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Audio ({audios.length})
                      </h4>
                      <div className="space-y-2">
                        {audios.map((audio) => (
                          <div
                            key={audio.id}
                            className="flex items-center gap-3 p-2 border rounded-lg"
                          >
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                              <Music className="h-4 w-4 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <audio controls className="w-full h-8">
                                <source src={audio.url} />
                              </audio>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  {documents.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Documentos ({documents.length})
                      </h4>
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50"
                          >
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                              <FileText className="h-4 w-4 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">
                                Documento
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatRelativeTime(doc.timestamp)}
                              </p>
                            </div>
                            <Download className="h-4 w-4 text-gray-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={closeLightbox}
        >
          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('prev');
                }}
                className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('next');
                }}
                className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={lightboxImage}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 rounded-full text-white text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
