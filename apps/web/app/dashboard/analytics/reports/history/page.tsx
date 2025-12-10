'use client';

/**
 * Report History Page
 * ===================
 *
 * Phase 10.4: Analytics Dashboard UI
 * View and download previously generated reports.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Eye,
  Trash2,
  FileText,
  Calendar,
  Clock,
  Filter,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  FileSpreadsheet,
  File,
} from 'lucide-react';
import Link from 'next/link';

interface ReportHistoryItem {
  id: string;
  name: string;
  reportType: string;
  format: 'pdf' | 'excel' | 'csv';
  status: 'completed' | 'failed' | 'processing';
  generatedAt: string;
  generatedBy: string;
  fileSize?: number;
  downloadUrl?: string;
  parameters?: Record<string, unknown>;
  errorMessage?: string;
}

interface HistoryFilters {
  search: string;
  format: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export default function ReportHistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>({
    search: '',
    format: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedReports, setSelectedReports] = useState<string[]>([]);

  // Fetch report history
  const { data, isLoading, refetch } = useQuery<{ reports: ReportHistoryItem[]; total: number }>({
    queryKey: ['report-history', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.format !== 'all') params.set('format', filters.format);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);

      const response = await fetch(`/api/analytics/reports/history?${params}`);
      if (!response.ok) return { reports: [], total: 0 };
      return response.json();
    },
  });

  const reports = data?.reports || [];
  const total = data?.total || 0;

  const toggleSelectReport = (id: string) => {
    setSelectedReports((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReports.length === reports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(reports.map((r) => r.id));
    }
  };

  const getStatusIcon = (status: ReportHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'processing':
        return <Loader size={16} className="text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: ReportHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle size={12} />
            Completado
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <XCircle size={12} />
            Fallido
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            <Loader size={12} className="animate-spin" />
            Procesando
          </span>
        );
    }
  };

  const getFormatIcon = (format: ReportHistoryItem['format']) => {
    switch (format) {
      case 'pdf':
        return <FileText size={16} className="text-red-500" />;
      case 'excel':
        return <FileSpreadsheet size={16} className="text-green-500" />;
      case 'csv':
        return <File size={16} className="text-blue-500" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = async (report: ReportHistoryItem) => {
    if (!report.downloadUrl) return;
    window.open(report.downloadUrl, '_blank');
  };

  const handleBulkDownload = async () => {
    const selectedItems = reports.filter((r) => selectedReports.includes(r.id) && r.downloadUrl);
    for (const report of selectedItems) {
      if (report.downloadUrl) {
        window.open(report.downloadUrl, '_blank');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este reporte?')) return;
    // Would call delete API
    refetch();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Está seguro de eliminar ${selectedReports.length} reportes?`)) return;
    // Would call delete API
    setSelectedReports([]);
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/analytics/reports"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Reportes</h1>
            <p className="text-gray-600 mt-1">Reportes generados anteriormente</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Buscar reportes..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Format filter */}
          <select
            value={filters.format}
            onChange={(e) => setFilters({ ...filters, format: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Todos los formatos</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="csv">CSV</option>
          </select>

          {/* Status filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="completed">Completado</option>
            <option value="failed">Fallido</option>
            <option value="processing">Procesando</option>
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Clear filters */}
          <button
            onClick={() =>
              setFilters({ search: '', format: 'all', status: 'all', dateFrom: '', dateTo: '' })
            }
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedReports.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-green-700 font-medium">
            {selectedReports.length} reporte(s) seleccionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download size={16} />
              Descargar
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay reportes</h3>
          <p className="text-gray-500 mb-4">
            No se encontraron reportes que coincidan con los filtros
          </p>
          <Link
            href="/dashboard/analytics/reports"
            className="inline-flex px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Crear nuevo reporte
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedReports.length === reports.length && reports.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reporte
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Formato
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tamaño
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Generado
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className={`hover:bg-gray-50 ${selectedReports.includes(report.id) ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedReports.includes(report.id)}
                      onChange={() => toggleSelectReport(report.id)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{report.name}</p>
                      <p className="text-sm text-gray-500">{report.reportType}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getFormatIcon(report.format)}
                      <span className="text-sm text-gray-700 uppercase">{report.format}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {formatFileSize(report.fileSize)}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-700">{formatDate(report.generatedAt)}</p>
                      <p className="text-xs text-gray-500">por {report.generatedBy}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(report.status)}
                    {report.status === 'failed' && report.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{report.errorMessage}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {report.status === 'completed' && (
                        <>
                          <button
                            onClick={() => handleDownload(report)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                            title="Descargar"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                            title="Vista previa"
                          >
                            <Eye size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="p-1.5 hover:bg-gray-100 rounded text-red-500 hover:text-red-700"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {reports.length} de {total} reportes
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Anterior
              </button>
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
