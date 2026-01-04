'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { searchMatches } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Search,
  Eye,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function WhatsAppTemplatesPage() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showSendModal, setShowSendModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.whatsapp.templates.list(),
  });

  const templates = (data?.data || []) as Template[];

  const syncMutation = useMutation({
    mutationFn: () => api.whatsapp.templates.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
    },
  });

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = !searchQuery || searchMatches(t.name, searchQuery);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success-50 text-success-700">
            <CheckCircle className="h-3 w-3" />
            Aprobado
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-warning-50 text-warning-700">
            <Clock className="h-3 w-3" />
            Pendiente
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-danger-50 text-danger-700">
            <XCircle className="h-3 w-3" />
            Rechazado
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
            <AlertCircle className="h-3 w-3" />
            Deshabilitado
          </span>
        );
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'UTILITY':
        return 'Utilidad';
      case 'MARKETING':
        return 'Marketing';
      case 'AUTHENTICATION':
        return 'Autenticación';
      default:
        return category;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/whatsapp"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates de WhatsApp</h1>
            <p className="text-gray-500">
              Plantillas pre-aprobadas para mensajes fuera de la ventana 24h
            </p>
          </div>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="btn-outline"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
          />
          Sincronizar con Meta
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Todos los estados</option>
          <option value="APPROVED">Aprobados</option>
          <option value="PENDING">Pendientes</option>
          <option value="REJECTED">Rechazados</option>
        </select>
      </div>

      {/* Templates grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Cargando templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No se encontraron templates
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div key={template.id} className="card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500">
                    {getCategoryLabel(template.category)} • {template.language}
                  </p>
                </div>
                {getStatusBadge(template.status)}
              </div>

              {/* Preview */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                {template.components.find((c) => c.type === 'BODY')?.text ||
                  'Sin contenido'}
              </div>

              {/* Buttons preview */}
              {template.components.find((c) => c.type === 'BUTTONS') && (
                <div className="flex flex-wrap gap-2">
                  {template.components
                    .find((c) => c.type === 'BUTTONS')
                    ?.buttons?.map((btn, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 text-xs bg-gray-100 rounded-full text-gray-700"
                      >
                        {btn.text}
                      </span>
                    ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  Ver detalle
                </button>
                {template.status === 'APPROVED' && (
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowSendModal(true);
                    }}
                    className="btn-primary text-sm py-1"
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Enviar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Template detail modal */}
      {selectedTemplate && !showSendModal && (
        <TemplateDetailModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* Send template modal */}
      {selectedTemplate && showSendModal && (
        <SendTemplateModal
          template={selectedTemplate}
          onClose={() => {
            setShowSendModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateDetailModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {template.name}
          </h2>

          <div className="space-y-4">
            {/* Components */}
            {template.components.map((comp, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  {comp.type}
                </p>
                {comp.text && <p className="text-sm text-gray-900">{comp.text}</p>}
                {comp.format && (
                  <p className="text-sm text-gray-600">Formato: {comp.format}</p>
                )}
                {comp.buttons && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {comp.buttons.map((btn, j) => (
                      <span
                        key={j}
                        className="px-3 py-1 text-xs border rounded-full"
                      >
                        {btn.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="btn-outline">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendTemplateModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});

  const sendMutation = useMutation({
    mutationFn: () =>
      api.whatsapp.templates.send({
        templateName: template.name,
        phone,
        params,
      }),
    onSuccess: () => {
      onClose();
    },
  });

  // Extract variables from template ({{1}}, {{2}}, etc.)
  const variables: string[] = [];
  template.components.forEach((comp) => {
    if (comp.text) {
      const matches = comp.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        matches.forEach((m) => {
          const num = m.replace(/[{}]/g, '');
          if (!variables.includes(num)) {
            variables.push(num);
          }
        });
      }
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Enviar template: {template.name}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="label mb-1 block">Teléfono del destinatario</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 1234-5678"
                className="input"
              />
            </div>

            {variables.length > 0 && (
              <>
                <p className="text-sm font-medium text-gray-700">Variables</p>
                {variables.map((v) => (
                  <div key={v}>
                    <label className="label mb-1 block">Variable {v}</label>
                    <input
                      type="text"
                      value={params[v] || ''}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, [v]: e.target.value }))
                      }
                      placeholder={`Valor para {{${v}}}`}
                      className="input"
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!phone || sendMutation.isPending}
              className="btn-primary"
            >
              {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
