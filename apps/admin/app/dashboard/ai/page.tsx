'use client';

import { useState } from 'react';
import { mockAIConversations, mockVoiceTranscriptions } from '@/lib/mock-data';
import { AIConversation } from '@/types';

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type StatusFilter = 'all' | 'completed' | 'escalated' | 'failed';

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  escalated: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  completed: 'Completado',
  escalated: 'Escalado',
  failed: 'Fallido',
};

export default function AIMonitorPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null);
  const [activeTab, setActiveTab] = useState<'conversations' | 'voice'>('conversations');

  const filteredConversations = mockAIConversations.filter(
    (conv) => statusFilter === 'all' || conv.status === statusFilter
  );

  // AI Performance Metrics (mock)
  const metrics = {
    totalConversations: 1234,
    avgConfidence: 0.82,
    completionRate: 78,
    escalationRate: 15,
    failureRate: 7,
    avgResponseTime: 2.3, // seconds
    avgMessagesPerConversation: 6.2,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Monitor de IA WhatsApp</h1>
        <p className="text-slate-500 mt-1">Conversaciones de IA, rendimiento y transcripciones de voz</p>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Conversaciones</p>
          <p className="text-xl font-bold text-slate-900">{metrics.totalConversations}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Confianza Prom.</p>
          <p className="text-xl font-bold text-blue-600">{Math.round(metrics.avgConfidence * 100)}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Completados</p>
          <p className="text-xl font-bold text-green-600">{metrics.completionRate}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Escalados</p>
          <p className="text-xl font-bold text-yellow-600">{metrics.escalationRate}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Fallidos</p>
          <p className="text-xl font-bold text-red-600">{metrics.failureRate}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Tiempo Resp.</p>
          <p className="text-xl font-bold text-slate-900">{metrics.avgResponseTime}s</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Msgs/Conv.</p>
          <p className="text-xl font-bold text-slate-900">{metrics.avgMessagesPerConversation}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('conversations')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'conversations'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Conversaciones IA
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'voice'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Transcripciones de Voz
        </button>
      </div>

      {activeTab === 'conversations' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Filtrar por estado:</span>
              {(['all', 'completed', 'escalated', 'failed'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {status === 'all' ? 'Todos' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Negocio</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Cliente</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Mensajes</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Confianza</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Estado</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Fecha</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredConversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{conv.businessName}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{conv.customerPhone}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{conv.messageCount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              conv.confidenceScore >= 0.8
                                ? 'bg-green-500'
                                : conv.confidenceScore >= 0.5
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${conv.confidenceScore * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {Math.round(conv.confidenceScore * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[conv.status]}`}>
                        {statusLabels[conv.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatDateTime(conv.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setSelectedConversation(conv)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredConversations.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-slate-500">No hay conversaciones con este filtro</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'voice' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {mockVoiceTranscriptions.map((transcription) => (
              <div key={transcription.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-medium text-slate-900">{transcription.technicianName}</p>
                    <p className="text-sm text-slate-500">{transcription.businessId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">
                      <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDuration(transcription.duration)}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(transcription.createdAt)}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-xs font-medium text-slate-500 uppercase">Transcripción</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{transcription.transcription}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    Reproducir Audio
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                    Exportar para Entrenamiento
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Performance Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Rendimiento del Modelo (Últimos 7 días)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-8 border-green-200 mb-4">
              <span className="text-2xl font-bold text-green-600">{metrics.completionRate}%</span>
            </div>
            <p className="text-sm text-slate-600">Tasa de Completado</p>
            <p className="text-xs text-green-600 mt-1">+3% vs semana anterior</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-8 border-blue-200 mb-4">
              <span className="text-2xl font-bold text-blue-600">{Math.round(metrics.avgConfidence * 100)}%</span>
            </div>
            <p className="text-sm text-slate-600">Confianza Promedio</p>
            <p className="text-xs text-blue-600 mt-1">+2% vs semana anterior</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-8 border-yellow-200 mb-4">
              <span className="text-2xl font-bold text-yellow-600">{metrics.escalationRate}%</span>
            </div>
            <p className="text-sm text-slate-600">Tasa de Escalado</p>
            <p className="text-xs text-yellow-600 mt-1">-1% vs semana anterior</p>
          </div>
        </div>
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Detalle de Conversación</h2>
                <p className="text-sm text-slate-500">{selectedConversation.businessName}</p>
              </div>
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Cliente</p>
                  <p className="font-medium text-slate-900">{selectedConversation.customerPhone}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Mensajes</p>
                  <p className="font-medium text-slate-900">{selectedConversation.messageCount}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Confianza</p>
                  <p className="font-medium text-slate-900">
                    {Math.round(selectedConversation.confidenceScore * 100)}%
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500">Estado</p>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[selectedConversation.status]}`}>
                    {statusLabels[selectedConversation.status]}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-2">Resumen</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-slate-700">{selectedConversation.summary}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-2">Fecha y Hora</p>
                <p className="font-medium text-slate-900">{formatDateTime(selectedConversation.createdAt)}</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Ver Conversación Completa
                </button>
                <button className="py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                  Exportar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
