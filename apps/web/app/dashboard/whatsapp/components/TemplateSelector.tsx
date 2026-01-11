'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Search,
  FileText,
  ChevronRight,
  Send,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { searchMatches } from '@/lib/utils';

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
}

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template, params: Record<string, string>) => void;
  phone?: string;
}

export default function TemplateSelector({
  isOpen,
  onClose,
  onSelect,
  phone,
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.whatsapp.templates.list(),
    enabled: isOpen,
  });

  // Filter templates
  const filteredTemplates = useMemo(() => {
    const templates = (data?.data || []) as Template[];
    return templates.filter((t) => {
      const matchesSearch = !searchQuery || searchMatches(t.name, searchQuery);
      const matchesStatus = t.status === 'APPROVED';
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [data?.data, searchQuery, categoryFilter]);

  // Extract variables from template
  const extractVariables = (template: Template): string[] => {
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
    return variables.sort((a, b) => parseInt(a) - parseInt(b));
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setParams({});
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    onSelect(selectedTemplate, params);
    setSelectedTemplate(null);
    setParams({});
    onClose();
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setParams({});
  };

  if (!isOpen) return null;

  const variables = selectedTemplate ? extractVariables(selectedTemplate) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedTemplate ? 'Configurar template' : 'Seleccionar template'}
            </h2>
            {phone && (
              <p className="text-sm text-gray-500">
                Enviando a: {phone}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {selectedTemplate ? (
          /* Template configuration */
          <div className="flex-1 overflow-y-auto p-4">
            <button
              onClick={handleBack}
              className="text-sm text-primary-600 hover:underline mb-4"
            >
              ← Volver a la lista
            </button>

            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <h3 className="font-medium text-gray-900 mb-1">
                {selectedTemplate.name}
              </h3>
              <p className="text-sm text-gray-600">
                {selectedTemplate.components.find((c) => c.type === 'BODY')?.text || 'Sin contenido'}
              </p>
            </div>

            {variables.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Variables del template</p>
                {variables.map((v) => (
                  <div key={v}>
                    <label className="block text-sm text-gray-600 mb-1">
                      Variable {`{{${v}}}`}
                    </label>
                    <input
                      type="text"
                      value={params[v] || ''}
                      onChange={(e) => setParams((p) => ({ ...p, [v]: e.target.value }))}
                      placeholder={`Valor para {{${v}}}`}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Este template no tiene variables para configurar.
              </p>
            )}

            {/* Preview */}
            <div className="mt-6 p-4 bg-success-50 rounded-lg border border-success-200">
              <p className="text-sm font-medium text-success-700 mb-2">Vista previa</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {(() => {
                  let preview = selectedTemplate.components.find((c) => c.type === 'BODY')?.text || '';
                  Object.entries(params).forEach(([key, value]) => {
                    preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
                  });
                  return preview;
                })()}
              </p>
            </div>
          </div>
        ) : (
          /* Template list */
          <div className="flex-1 overflow-y-auto">
            {/* Search and filters */}
            <div className="p-4 border-b sticky top-0 bg-white">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'UTILITY', 'MARKETING'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 text-xs rounded-full ${categoryFilter === cat
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {cat === 'all' && 'Todos'}
                    {cat === 'UTILITY' && 'Utilidad'}
                    {cat === 'MARKETING' && 'Marketing'}
                  </button>
                ))}
              </div>
            </div>

            {/* Templates */}
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Cargando templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No se encontraron templates aprobados</p>
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-success-50 text-success-700">
                            Aprobado
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {template.components.find((c) => c.type === 'BODY')?.text || 'Sin contenido'}
                        </p>
                        <span className="text-xs text-gray-400 mt-2 inline-block">
                          {template.category === 'UTILITY' ? 'Utilidad' : 'Marketing'} • {template.language}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {selectedTemplate && (
          <div className="p-4 border-t">
            <button
              onClick={handleSend}
              disabled={variables.length > 0 && Object.values(params).some((v) => !v)}
              className="w-full btn-primary"
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
