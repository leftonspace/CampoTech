'use client';

/**
 * Report Builder Page
 * ===================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Drag-and-drop report builder for custom analytics reports.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Save,
  Play,
  Download,
  Trash2,
  GripVertical,
  BarChart3,
  PieChart,
  TrendingUp,
  Table,
  FileText,
  Calendar,
  Filter,
  Settings,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface ReportWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'text';
  config: {
    title: string;
    dataSource: string;
    chartType?: 'bar' | 'line' | 'pie' | 'area';
    metrics?: string[];
    dimensions?: string[];
    filters?: Record<string, unknown>;
    size?: 'small' | 'medium' | 'large' | 'full';
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  widgets: ReportWidget[];
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

interface SavedReport {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_SOURCES = [
  { id: 'revenue', name: 'Ingresos', icon: TrendingUp },
  { id: 'jobs', name: 'Trabajos', icon: BarChart3 },
  { id: 'customers', name: 'Clientes', icon: FileText },
  { id: 'technicians', name: 'Técnicos', icon: Table },
];

const WIDGET_TYPES = [
  { id: 'kpi', name: 'KPI Card', icon: TrendingUp, description: 'Métrica única con tendencia' },
  { id: 'chart', name: 'Gráfico', icon: BarChart3, description: 'Visualización de datos' },
  { id: 'table', name: 'Tabla', icon: Table, description: 'Datos tabulares' },
  { id: 'text', name: 'Texto', icon: FileText, description: 'Texto descriptivo' },
];

const CHART_TYPES = [
  { id: 'bar', name: 'Barras' },
  { id: 'line', name: 'Líneas' },
  { id: 'pie', name: 'Circular' },
  { id: 'area', name: 'Área' },
];

const METRICS = {
  revenue: ['total_revenue', 'avg_ticket', 'growth_rate', 'payment_count'],
  jobs: ['total_jobs', 'completed_jobs', 'avg_duration', 'completion_rate'],
  customers: ['total_customers', 'new_customers', 'churn_rate', 'avg_clv'],
  technicians: ['active_technicians', 'avg_jobs_per_tech', 'avg_rating', 'utilization'],
};

const DIMENSIONS = {
  revenue: ['date', 'service_type', 'payment_method', 'customer'],
  jobs: ['date', 'status', 'technician', 'service_type', 'priority'],
  customers: ['segment', 'acquisition_source', 'region', 'frequency'],
  technicians: ['technician', 'specialty', 'region', 'experience_level'],
};

export default function ReportBuilderPage() {
  const [reportName, setReportName] = useState('Nuevo Reporte');
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  // Fetch saved reports
  const { data: savedReports = [] } = useQuery<SavedReport[]>({
    queryKey: ['saved-reports'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/reports');
      if (!response.ok) return [];
      const data = await response.json();
      return data.reports || [];
    },
  });

  // Save report mutation
  const saveMutation = useMutation({
    mutationFn: async (report: { name: string; widgets: ReportWidget[] }) => {
      const response = await fetch('/api/analytics/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!response.ok) throw new Error('Failed to save report');
      return response.json();
    },
  });

  // Generate report mutation
  const generateMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/analytics/reports/${reportId}/generate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
  });

  const addWidget = useCallback((type: ReportWidget['type']) => {
    const newWidget: ReportWidget = {
      id: `widget-${Date.now()}`,
      type,
      config: {
        title: type === 'kpi' ? 'Nueva Métrica' : type === 'chart' ? 'Nuevo Gráfico' : type === 'table' ? 'Nueva Tabla' : 'Nuevo Texto',
        dataSource: 'revenue',
        chartType: type === 'chart' ? 'bar' : undefined,
        metrics: [],
        dimensions: [],
        size: 'medium',
      },
    };
    setWidgets([...widgets, newWidget]);
    setSelectedWidget(newWidget.id);
    setShowWidgetPicker(false);
  }, [widgets]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<ReportWidget['config']>) => {
    setWidgets(widgets.map((w) =>
      w.id === widgetId ? { ...w, config: { ...w.config, ...updates } } : w
    ));
  }, [widgets]);

  const removeWidget = useCallback((widgetId: string) => {
    setWidgets(widgets.filter((w) => w.id !== widgetId));
    if (selectedWidget === widgetId) setSelectedWidget(null);
  }, [widgets, selectedWidget]);

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    const newWidgets = [...widgets];
    const [removed] = newWidgets.splice(fromIndex, 1);
    newWidgets.splice(toIndex, 0, removed);
    setWidgets(newWidgets);
  }, [widgets]);

  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedWidget && draggedWidget !== targetId) {
      const fromIndex = widgets.findIndex((w) => w.id === draggedWidget);
      const toIndex = widgets.findIndex((w) => w.id === targetId);
      if (fromIndex !== -1 && toIndex !== -1) {
        moveWidget(fromIndex, toIndex);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const handleSave = () => {
    saveMutation.mutate({ name: reportName, widgets });
  };

  const getWidgetIcon = (type: ReportWidget['type']) => {
    switch (type) {
      case 'kpi': return <TrendingUp size={16} />;
      case 'chart': return <BarChart3 size={16} />;
      case 'table': return <Table size={16} />;
      case 'text': return <FileText size={16} />;
    }
  };

  const getSizeClass = (size?: string) => {
    switch (size) {
      case 'small': return 'col-span-1';
      case 'medium': return 'col-span-2';
      case 'large': return 'col-span-3';
      case 'full': return 'col-span-4';
      default: return 'col-span-2';
    }
  };

  const selectedWidgetData = widgets.find((w) => w.id === selectedWidget);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/analytics/overview"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="text-xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-1"
              />
              <p className="text-gray-600 text-sm mt-1">Constructor de reportes personalizado</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showPreview
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye size={18} />
              Vista previa
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save size={18} />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => generateMutation.mutate('current')}
              disabled={widgets.length === 0 || generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Play size={18} />
              Generar
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {widgets.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <Plus size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Comienza a construir tu reporte
                </h3>
                <p className="text-gray-500 mb-4">
                  Agrega widgets arrastrándolos desde el panel lateral
                </p>
                <button
                  onClick={() => setShowWidgetPicker(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Agregar widget
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 auto-rows-min">
              {widgets.map((widget, index) => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(widget.id)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedWidget(widget.id)}
                  className={`${getSizeClass(widget.config.size)} bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    selectedWidget === widget.id
                      ? 'border-green-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${draggedWidget === widget.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-gray-400 cursor-grab" />
                      {getWidgetIcon(widget.type)}
                      <span className="font-medium text-gray-900">{widget.config.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWidget(widget.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>

                  {/* Widget preview */}
                  <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                    {widget.type === 'kpi' && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">$0</div>
                        <div className="text-sm text-gray-500">{widget.config.metrics?.[0] || 'Métrica'}</div>
                      </div>
                    )}
                    {widget.type === 'chart' && (
                      <div className="text-center text-gray-400">
                        {widget.config.chartType === 'bar' && <BarChart3 size={48} />}
                        {widget.config.chartType === 'pie' && <PieChart size={48} />}
                        {widget.config.chartType === 'line' && <TrendingUp size={48} />}
                        {widget.config.chartType === 'area' && <TrendingUp size={48} />}
                      </div>
                    )}
                    {widget.type === 'table' && (
                      <Table size={48} className="text-gray-400" />
                    )}
                    {widget.type === 'text' && (
                      <FileText size={48} className="text-gray-400" />
                    )}
                  </div>
                </div>
              ))}

              {/* Add widget button */}
              <button
                onClick={() => setShowWidgetPicker(true)}
                className="col-span-1 h-48 bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <div className="text-center">
                  <Plus size={24} className="mx-auto text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Agregar widget</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar - Widget configuration */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedWidgetData ? (
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Configuración del Widget</h3>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={selectedWidgetData.config.title}
                  onChange={(e) => updateWidget(selectedWidgetData.id, { title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Data source */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuente de datos</label>
                <select
                  value={selectedWidgetData.config.dataSource}
                  onChange={(e) => updateWidget(selectedWidgetData.id, { dataSource: e.target.value, metrics: [], dimensions: [] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {DATA_SOURCES.map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </div>

              {/* Chart type (for chart widgets) */}
              {selectedWidgetData.type === 'chart' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de gráfico</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.id}
                        onClick={() => updateWidget(selectedWidgetData.id, { chartType: ct.id as 'bar' | 'line' | 'pie' | 'area' })}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          selectedWidgetData.config.chartType === ct.id
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {ct.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Métricas</label>
                <div className="space-y-1">
                  {METRICS[selectedWidgetData.config.dataSource as keyof typeof METRICS]?.map((metric) => (
                    <label key={metric} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedWidgetData.config.metrics?.includes(metric) || false}
                        onChange={(e) => {
                          const currentMetrics = selectedWidgetData.config.metrics || [];
                          const newMetrics = e.target.checked
                            ? [...currentMetrics, metric]
                            : currentMetrics.filter((m) => m !== metric);
                          updateWidget(selectedWidgetData.id, { metrics: newMetrics });
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">{metric.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              {(selectedWidgetData.type === 'chart' || selectedWidgetData.type === 'table') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dimensiones</label>
                  <div className="space-y-1">
                    {DIMENSIONS[selectedWidgetData.config.dataSource as keyof typeof DIMENSIONS]?.map((dim) => (
                      <label key={dim} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedWidgetData.config.dimensions?.includes(dim) || false}
                          onChange={(e) => {
                            const currentDims = selectedWidgetData.config.dimensions || [];
                            const newDims = e.target.checked
                              ? [...currentDims, dim]
                              : currentDims.filter((d) => d !== dim);
                            updateWidget(selectedWidgetData.id, { dimensions: newDims });
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{dim.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño</label>
                <select
                  value={selectedWidgetData.config.size || 'medium'}
                  onChange={(e) => updateWidget(selectedWidgetData.id, { size: e.target.value as 'small' | 'medium' | 'large' | 'full' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="small">Pequeño (1 col)</option>
                  <option value="medium">Mediano (2 cols)</option>
                  <option value="large">Grande (3 cols)</option>
                  <option value="full">Completo (4 cols)</option>
                </select>
              </div>

              {/* Delete widget */}
              <button
                onClick={() => removeWidget(selectedWidgetData.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                Eliminar widget
              </button>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <Settings size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Selecciona un widget para configurarlo</p>
            </div>
          )}
        </div>
      </div>

      {/* Widget picker modal */}
      {showWidgetPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Agregar Widget</h3>
              <button
                onClick={() => setShowWidgetPicker(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-2">
              {WIDGET_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => addWidget(type.id as ReportWidget['type'])}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-gray-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{type.name}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
