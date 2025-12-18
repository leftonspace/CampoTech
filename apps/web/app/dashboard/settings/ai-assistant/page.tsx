'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  Save,
  Bot,
  Power,
  Sliders,
  Building2,
  Clock,
  HelpCircle,
  Plus,
  Trash2,
  MessageSquare,
  Users,
  AlertTriangle,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceInfo {
  name: string;
  description: string;
  priceRange?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface BusinessHours {
  [day: string]: { open: string; close: string } | null;
}

interface AIConfig {
  id?: string;
  isEnabled: boolean;
  autoResponseEnabled: boolean;
  minConfidenceToRespond: number;
  minConfidenceToCreateJob: number;
  companyName: string;
  companyDescription: string;
  servicesOffered: ServiceInfo[];
  businessHours: BusinessHours;
  serviceAreas: string;
  pricingInfo: string;
  cancellationPolicy: string;
  paymentMethods: string;
  warrantyInfo: string;
  faqItems: FAQItem[];
  customInstructions: string;
  aiTone: string;
  greetingMessage: string;
  awayMessage: string;
  transferKeywords: string[];
  escalationUserId: string;
}

const DAYS_OF_WEEK = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

const AI_TONES = [
  { value: 'friendly_professional', label: 'Amigable y Profesional', description: 'Cálido pero eficiente, usa "vos"' },
  { value: 'formal', label: 'Formal', description: 'Respetuoso y distante, usa "usted"' },
  { value: 'casual', label: 'Casual', description: 'Relajado y cercano, como un vecino' },
];

const DEFAULT_CONFIG: AIConfig = {
  isEnabled: false,
  autoResponseEnabled: true,
  minConfidenceToRespond: 70,
  minConfidenceToCreateJob: 85,
  companyName: '',
  companyDescription: '',
  servicesOffered: [],
  businessHours: {
    lunes: { open: '09:00', close: '18:00' },
    martes: { open: '09:00', close: '18:00' },
    miercoles: { open: '09:00', close: '18:00' },
    jueves: { open: '09:00', close: '18:00' },
    viernes: { open: '09:00', close: '18:00' },
    sabado: null,
    domingo: null,
  },
  serviceAreas: '',
  pricingInfo: '',
  cancellationPolicy: '',
  paymentMethods: 'Efectivo, Transferencia bancaria',
  warrantyInfo: '',
  faqItems: [],
  customInstructions: '',
  aiTone: 'friendly_professional',
  greetingMessage: '',
  awayMessage: '',
  transferKeywords: ['hablar con persona', 'operador', 'queja', 'reclamo'],
  escalationUserId: '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchAIConfig(): Promise<AIConfig> {
  const res = await fetch('/api/settings/ai-assistant');
  if (!res.ok) {
    if (res.status === 404) return DEFAULT_CONFIG;
    throw new Error('Error cargando configuración');
  }
  return res.json();
}

async function saveAIConfig(config: AIConfig): Promise<AIConfig> {
  const res = await fetch('/api/settings/ai-assistant', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Error guardando configuración');
  return res.json();
}

async function fetchTeamMembers(): Promise<Array<{ id: string; name: string; role: string }>> {
  const res = await fetch('/api/users?role=OWNER,DISPATCHER');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIAssistantSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'company' | 'hours' | 'faq' | 'advanced'>('general');
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: fetchAIConfig,
  });

  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-escalation'],
    queryFn: fetchTeamMembers,
  });

  const saveMutation = useMutation({
    mutationFn: saveAIConfig,
    onSuccess: () => {
      setSuccess('Configuración guardada correctamente');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    },
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const updateConfig = <K extends keyof AIConfig>(key: K, value: AIConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  // Service management
  const addService = () => {
    updateConfig('servicesOffered', [
      ...config.servicesOffered,
      { name: '', description: '', priceRange: '' },
    ]);
  };

  const updateService = (index: number, field: keyof ServiceInfo, value: string) => {
    const updated = [...config.servicesOffered];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig('servicesOffered', updated);
  };

  const removeService = (index: number) => {
    updateConfig('servicesOffered', config.servicesOffered.filter((_, i) => i !== index));
  };

  // FAQ management
  const addFAQ = () => {
    updateConfig('faqItems', [...config.faqItems, { question: '', answer: '' }]);
  };

  const updateFAQ = (index: number, field: keyof FAQItem, value: string) => {
    const updated = [...config.faqItems];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig('faqItems', updated);
  };

  const removeFAQ = (index: number) => {
    updateConfig('faqItems', config.faqItems.filter((_, i) => i !== index));
  };

  // Business hours management
  const updateHours = (day: string, field: 'open' | 'close', value: string) => {
    const current = config.businessHours[day];
    if (current) {
      updateConfig('businessHours', {
        ...config.businessHours,
        [day]: { ...current, [field]: value },
      });
    }
  };

  const toggleDayOff = (day: string) => {
    const current = config.businessHours[day];
    updateConfig('businessHours', {
      ...config.businessHours,
      [day]: current ? null : { open: '09:00', close: '18:00' },
    });
  };

  // Transfer keywords management
  const addKeyword = (keyword: string) => {
    if (keyword && !config.transferKeywords.includes(keyword)) {
      updateConfig('transferKeywords', [...config.transferKeywords, keyword]);
    }
  };

  const removeKeyword = (index: number) => {
    updateConfig('transferKeywords', config.transferKeywords.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/settings"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asistente IA</h1>
            <p className="text-gray-500">Configurá las respuestas automáticas de WhatsApp</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-green-700 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {success}
        </div>
      )}

      {/* Master Toggle */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`rounded-full p-3 ${config.isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Bot className={`h-6 w-6 ${config.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Asistente IA Activo</h2>
              <p className="text-sm text-gray-500">
                {config.isEnabled
                  ? 'El asistente responde mensajes de WhatsApp automáticamente'
                  : 'El asistente está desactivado'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateConfig('isEnabled', !config.isEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.isEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { key: 'general', label: 'General', icon: Sliders },
            { key: 'company', label: 'Empresa', icon: Building2 },
            { key: 'hours', label: 'Horarios', icon: Clock },
            { key: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle },
            { key: 'advanced', label: 'Avanzado', icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración General</h3>

              {/* Auto Response */}
              <div className="flex items-center justify-between py-4 border-b">
                <div>
                  <p className="font-medium text-gray-900">Respuesta automática</p>
                  <p className="text-sm text-gray-500">Responder automáticamente si la confianza es suficiente</p>
                </div>
                <button
                  onClick={() => updateConfig('autoResponseEnabled', !config.autoResponseEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.autoResponseEnabled ? 'bg-primary-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.autoResponseEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Confidence Thresholds */}
              <div className="py-4 border-b">
                <p className="font-medium text-gray-900 mb-2">Confianza mínima para responder</p>
                <p className="text-sm text-gray-500 mb-3">
                  Si el AI tiene menos confianza, transfiere a un humano
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.minConfidenceToRespond}
                    onChange={(e) => updateConfig('minConfidenceToRespond', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-12 text-center font-mono text-sm">
                    {config.minConfidenceToRespond}%
                  </span>
                </div>
              </div>

              <div className="py-4 border-b">
                <p className="font-medium text-gray-900 mb-2">Confianza mínima para crear trabajo</p>
                <p className="text-sm text-gray-500 mb-3">
                  Si tiene menos confianza, pide confirmación al cliente
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.minConfidenceToCreateJob}
                    onChange={(e) => updateConfig('minConfidenceToCreateJob', Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-12 text-center font-mono text-sm">
                    {config.minConfidenceToCreateJob}%
                  </span>
                </div>
              </div>

              {/* AI Tone */}
              <div className="py-4">
                <p className="font-medium text-gray-900 mb-2">Tono del asistente</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {AI_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => updateConfig('aiTone', tone.value)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        config.aiTone === tone.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{tone.label}</p>
                      <p className="text-sm text-gray-500">{tone.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Company Tab */}
        {activeTab === 'company' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Información de la Empresa</h3>
              <p className="text-sm text-gray-500 mb-6">
                Esta información ayuda al AI a responder correctamente sobre tu negocio
              </p>

              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la empresa
                  </label>
                  <input
                    type="text"
                    value={config.companyName}
                    onChange={(e) => updateConfig('companyName', e.target.value)}
                    className="input"
                    placeholder="Ej: Climatización del Sur"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción de la empresa
                  </label>
                  <textarea
                    value={config.companyDescription}
                    onChange={(e) => updateConfig('companyDescription', e.target.value)}
                    className="input min-h-[100px]"
                    placeholder="Ej: Somos una empresa especializada en instalación y mantenimiento de aires acondicionados y calefacción..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zonas de servicio
                  </label>
                  <textarea
                    value={config.serviceAreas}
                    onChange={(e) => updateConfig('serviceAreas', e.target.value)}
                    className="input"
                    placeholder="Ej: CABA, Zona Norte (San Isidro, Vicente López, Tigre)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Métodos de pago
                  </label>
                  <input
                    type="text"
                    value={config.paymentMethods}
                    onChange={(e) => updateConfig('paymentMethods', e.target.value)}
                    className="input"
                    placeholder="Ej: Efectivo, Transferencia, Tarjeta de crédito"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Información de precios
                  </label>
                  <textarea
                    value={config.pricingInfo}
                    onChange={(e) => updateConfig('pricingInfo', e.target.value)}
                    className="input"
                    placeholder="Ej: Visita de diagnóstico $5.000. Instalación desde $25.000 según el equipo..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Política de cancelación
                  </label>
                  <textarea
                    value={config.cancellationPolicy}
                    onChange={(e) => updateConfig('cancellationPolicy', e.target.value)}
                    className="input"
                    placeholder="Ej: Cancelaciones con 24 horas de anticipación sin cargo..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Garantía
                  </label>
                  <textarea
                    value={config.warrantyInfo}
                    onChange={(e) => updateConfig('warrantyInfo', e.target.value)}
                    className="input"
                    placeholder="Ej: 6 meses de garantía en mano de obra, 1 año en repuestos..."
                  />
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Servicios</h3>
                  <p className="text-sm text-gray-500">Listá los servicios que ofrece tu empresa</p>
                </div>
                <button onClick={addService} className="btn-outline flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar servicio
                </button>
              </div>

              <div className="space-y-4">
                {config.servicesOffered.map((service, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid gap-3 sm:grid-cols-3">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(index, 'name', e.target.value)}
                          className="input"
                          placeholder="Nombre del servicio"
                        />
                        <input
                          type="text"
                          value={service.description}
                          onChange={(e) => updateService(index, 'description', e.target.value)}
                          className="input"
                          placeholder="Descripción breve"
                        />
                        <input
                          type="text"
                          value={service.priceRange || ''}
                          onChange={(e) => updateService(index, 'priceRange', e.target.value)}
                          className="input"
                          placeholder="Rango de precio (opcional)"
                        />
                      </div>
                      <button
                        onClick={() => removeService(index)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {config.servicesOffered.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
                    No hay servicios configurados. Agregá al menos uno para que el AI pueda informar a los clientes.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hours Tab */}
        {activeTab === 'hours' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Horarios de Atención</h3>
              <p className="text-sm text-gray-500 mb-6">
                El AI usará estos horarios para informar a los clientes y enviar el mensaje de ausencia fuera de horario
              </p>

              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const hours = config.businessHours[day.key];
                  return (
                    <div key={day.key} className="flex items-center gap-4 py-2">
                      <div className="w-28">
                        <span className="font-medium text-gray-900">{day.label}</span>
                      </div>
                      <button
                        onClick={() => toggleDayOff(day.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          hours ? 'bg-primary-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            hours ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      {hours ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={hours.open}
                            onChange={(e) => updateHours(day.key, 'open', e.target.value)}
                            className="input w-32"
                          />
                          <span className="text-gray-500">a</span>
                          <input
                            type="time"
                            value={hours.close}
                            onChange={(e) => updateHours(day.key, 'close', e.target.value)}
                            className="input w-32"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-500">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Away Message */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Mensaje fuera de horario</h3>
              <p className="text-sm text-gray-500 mb-4">
                Se envía cuando un cliente escribe fuera del horario de atención
              </p>
              <textarea
                value={config.awayMessage}
                onChange={(e) => updateConfig('awayMessage', e.target.value)}
                className="input min-h-[100px]"
                placeholder="Ej: ¡Hola! Gracias por contactarnos. En este momento estamos fuera de horario. Te responderemos mañana a primera hora. Nuestro horario es de Lunes a Viernes de 9 a 18hs."
              />
            </div>

            {/* Greeting Message */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Mensaje de bienvenida</h3>
              <p className="text-sm text-gray-500 mb-4">
                Se envía cuando un cliente nuevo escribe por primera vez (opcional)
              </p>
              <textarea
                value={config.greetingMessage}
                onChange={(e) => updateConfig('greetingMessage', e.target.value)}
                className="input min-h-[100px]"
                placeholder="Ej: ¡Hola! Bienvenido a [Empresa]. Soy el asistente virtual y estoy acá para ayudarte. ¿En qué te puedo ayudar?"
              />
            </div>
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Preguntas Frecuentes</h3>
                <p className="text-sm text-gray-500">
                  Agregá preguntas comunes para que el AI pueda responderlas
                </p>
              </div>
              <button onClick={addFAQ} className="btn-outline flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Agregar pregunta
              </button>
            </div>

            <div className="space-y-4">
              {config.faqItems.map((faq, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pregunta
                        </label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                          className="input"
                          placeholder="Ej: ¿Hacen instalaciones los fines de semana?"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Respuesta
                        </label>
                        <textarea
                          value={faq.answer}
                          onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                          className="input"
                          placeholder="Ej: Sí, trabajamos sábados con costo adicional del 30%..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeFAQ(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {config.faqItems.length === 0 && (
                <div className="rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
                  <HelpCircle className="mx-auto h-8 w-8 mb-2" />
                  <p>No hay preguntas frecuentes configuradas.</p>
                  <p className="text-sm">Agregá preguntas comunes para mejorar las respuestas del AI.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {/* Transfer Keywords */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Palabras de transferencia</h3>
              <p className="text-sm text-gray-500 mb-4">
                Si el cliente usa estas palabras, se transfiere automáticamente a un humano
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {config.transferKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
                  >
                    {keyword}
                    <button
                      onClick={() => removeKeyword(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nueva palabra clave"
                  className="input flex-1"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addKeyword((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                    addKeyword(input.value);
                    input.value = '';
                  }}
                  className="btn-outline"
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Escalation User */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Usuario de escalación</h3>
              <p className="text-sm text-gray-500 mb-4">
                Este usuario recibirá notificaciones cuando el AI transfiera una conversación
              </p>
              <select
                value={config.escalationUserId}
                onChange={(e) => updateConfig('escalationUserId', e.target.value)}
                className="input"
              >
                <option value="">Seleccionar usuario...</option>
                {teamMembers?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Instructions */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Instrucciones personalizadas</h3>
              <p className="text-sm text-gray-500 mb-4">
                Instrucciones adicionales para el comportamiento del AI (avanzado)
              </p>
              <textarea
                value={config.customInstructions}
                onChange={(e) => updateConfig('customInstructions', e.target.value)}
                className="input min-h-[150px] font-mono text-sm"
                placeholder={`Ej:
- Siempre ofrecer presupuesto sin cargo
- Si preguntan por equipos, recomendar marca X
- No dar información sobre la competencia
- Si el cliente menciona urgencia, priorizar disponibilidad inmediata`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
