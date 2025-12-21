'use client';

/**
 * AI Assistant Panel
 * ==================
 *
 * Side panel for staff to interact with AI during customer conversations.
 * Allows staff to:
 * - Get draft responses
 * - Check availability
 * - Analyze customer
 * - Detect conflicts
 * - Request bookings
 */

import { useState, useCallback } from 'react';

interface AIAssistantPanelProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onInsertDraft?: (text: string) => void;
}

type AssistAction =
  | 'draft_response'
  | 'suggest_booking'
  | 'check_availability'
  | 'analyze_customer'
  | 'detect_conflicts'
  | 'lookup_pricing'
  | 'general_help';

interface AssistResult {
  success: boolean;
  action: string;
  result: string;
  data?: {
    suggestedResponse?: string;
    booking?: { id: string; jobNumber: string };
  };
  warnings?: string[];
}

const ACTION_BUTTONS: { action: AssistAction; label: string; icon: string }[] = [
  { action: 'draft_response', label: 'Sugerir respuesta', icon: '💬' },
  { action: 'suggest_booking', label: 'Analizar reserva', icon: '📅' },
  { action: 'check_availability', label: 'Ver disponibilidad', icon: '👷' },
  { action: 'analyze_customer', label: 'Info cliente', icon: '👤' },
  { action: 'detect_conflicts', label: 'Detectar conflictos', icon: '⚠️' },
  { action: 'lookup_pricing', label: 'Buscar precios', icon: '💰' },
];

export function AIAssistantPanel({
  conversationId,
  isOpen,
  onClose,
  onInsertDraft,
}: AIAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const executeAction = useCallback(
    async (action: AssistAction, customQuery?: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/staff-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            action,
            query: customQuery || query,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al procesar');
        }

        const data: AssistResult = await response.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [conversationId, query]
  );

  const handleGeneralHelp = useCallback(() => {
    if (query.trim()) {
      executeAction('general_help', query);
    }
  }, [executeAction, query]);

  const handleInsertDraft = useCallback(() => {
    if (result?.data?.suggestedResponse && onInsertDraft) {
      onInsertDraft(result.data.suggestedResponse);
    }
  }, [result, onInsertDraft]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-indigo-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="font-semibold text-gray-900">Asistente IA</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs text-gray-500 mb-3">Acciones rápidas</p>
        <div className="grid grid-cols-2 gap-2">
          {ACTION_BUTTONS.map(({ action, label, icon }) => (
            <button
              key={action}
              onClick={() => executeAction(action)}
              disabled={loading}
              className="flex items-center gap-2 p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{icon}</span>
              <span className="text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Query */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs text-gray-500 mb-2">Pregunta libre</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGeneralHelp()}
            placeholder="Ej: ¿Cuánto cuesta instalar un aire?"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            onClick={handleGeneralHelp}
            disabled={loading || !query.trim()}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Result Area */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Result content */}
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                {result.result}
              </pre>
            </div>

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-medium text-yellow-800 mb-1">Notas:</p>
                <ul className="text-sm text-yellow-700 list-disc list-inside">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Insert Draft button */}
            {result.data?.suggestedResponse && onInsertDraft && (
              <button
                onClick={handleInsertDraft}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Insertar en respuesta
              </button>
            )}

            {/* Booking created */}
            {result.data?.booking && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  ✅ Reserva creada: <strong>{result.data.booking.jobNumber}</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-8 text-gray-400">
            <span className="text-4xl">🤖</span>
            <p className="mt-2 text-sm">
              Usá las acciones rápidas o hacé una pregunta
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
        <p className="text-xs text-gray-400">
          Las sugerencias de IA deben ser revisadas antes de enviar
        </p>
      </div>
    </div>
  );
}

export default AIAssistantPanel;
