'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PublicHeader, PublicFooter } from '@/components/layout';
import {
  MapPin,
  MessageSquare,
  Calendar,
  ShieldCheck,
  Users,
  Truck,
  FileText,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Bell,
  Zap,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Bot,
  User,
  Mic,
  Clock,
  CalendarPlus,
  UserPlus,
  Send,
  Building2,
  Shield,
  Flame,
  Droplet,
  BadgeCheck,
  UserCheck,
  Car,
  Wrench,
  FileCheck,
  Award,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION LINKS
// ═══════════════════════════════════════════════════════════════════════════════

const navLinks = [
  { label: 'Funciones', href: '#features' },
  { label: 'Cómo funciona', href: '#how-it-works' },
  { label: 'Precios', href: '#pricing' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            Verificación CUIT integrada
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            Gestión de servicios
            <span className="text-primary"> inteligente</span> para técnicos y oficios
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Menos papeles, más trabajos. Ahorrá tiempo y cobrá más rápido.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-12 px-8 text-base font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Empezar ahora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center h-12 px-8 text-base font-medium rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Ver demostración
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              14 días gratis, sin tarjeta
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Cancelá cuando quieras
            </div>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-16 relative">
          <div className="bg-gradient-to-t from-background via-transparent to-transparent absolute inset-x-0 bottom-0 h-32 z-10" />
          <div className="bg-sidebar rounded-xl shadow-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-destructive/50" />
              <div className="w-3 h-3 rounded-full bg-accent/50" />
              <div className="w-3 h-3 rounded-full bg-success/50" />
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Trabajos Hoy</div>
                <div className="text-2xl font-bold text-foreground">12</div>
                <div className="text-xs text-success">+3 vs ayer</div>
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Técnicos Activos</div>
                <div className="text-2xl font-bold text-foreground">8</div>
                <div className="text-xs text-muted-foreground">En campo</div>
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Facturado</div>
                <div className="text-2xl font-bold text-foreground">$156K</div>
                <div className="text-xs text-success">+18% este mes</div>
              </div>
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Satisfacción</div>
                <div className="text-2xl font-bold text-foreground">4.9</div>
                <div className="text-xs text-accent">⭐ Excelente</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES GRID SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Todo lo que necesitás para gestionar tu negocio
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Herramientas potentes diseñadas para empresas de servicios en Argentina
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Live Map */}
          <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors group">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Mapa en Tiempo Real</h3>
            <p className="text-muted-foreground">
              Seguí la ubicación de tu equipo en vivo. Asigná trabajos al técnico más cercano y optimizá rutas automáticamente.
            </p>
          </div>

          {/* WhatsApp AI */}
          <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors group">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-success/20 transition-colors">
              <MessageSquare className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">WhatsApp Inteligente</h3>
            <p className="text-muted-foreground">
              Tu asistente responde consultas, agenda turnos y crea fichas de clientes automáticamente. Configuralo a tu medida.
            </p>
          </div>

          {/* Smart Scheduling */}
          <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors group">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <Calendar className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Agenda Inteligente</h3>
            <p className="text-muted-foreground">
              Evitá superposiciones automáticamente. El sistema detecta conflictos y sugiere horarios disponibles al instante.
            </p>
          </div>

          {/* Team Management */}
          <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors group">
            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-info/20 transition-colors">
              <Users className="w-6 h-6 text-info" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Gestión de Equipo</h3>
            <p className="text-muted-foreground">
              Controlá horarios, asistencia y rendimiento. Cada técnico tiene su perfil con historial completo de trabajos.
            </p>
          </div>

          {/* Fleet Management */}
          <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors group">
            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-warning/20 transition-colors">
              <Truck className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Control de Flota</h3>
            <p className="text-muted-foreground">
              Seguimiento de vehículos, alertas de mantenimiento y control de combustible. Todo en un solo lugar.
            </p>
          </div>

          {/* AFIP Integration */}
          <div className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-colors group">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Facturación AFIP</h3>
            <p className="text-muted-foreground">
              Generá facturas electrónicas directo a AFIP. Presupuestos, seguimiento de pagos y reportes fiscales incluidos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP CONVERSATION DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread?: number;
  aiConfidence?: number;
}

interface ChatMessage {
  id: string;
  type: 'inbound' | 'outbound' | 'ai-response';
  content: string;
  time: string;
  isVoice?: boolean;
}

interface AIAction {
  type: 'alert' | 'success' | 'info';
  title: string;
  description: string;
  actions?: { label: string; icon: React.ReactNode }[];
}

interface ConversationScenario {
  id: string;
  title: string;
  description: string;
  contacts: Contact[];
  activeContactId: string;
  messages: ChatMessage[];
  aiPanel: {
    status: 'active' | 'monitoring' | 'off';
    actions: AIAction[];
  };
}

const conversationScenarios: ConversationScenario[] = [
  // Scenario 1: AI Auto-Response & Booking
  {
    id: 'auto-booking',
    title: 'Reserva Automática',
    description: 'La IA responde, agenda y notifica automáticamente',
    contacts: [
      { id: '1', name: 'María García', phone: '+54 11 5555-1234', lastMessage: 'Necesito un técnico para mañana', time: '14:32', unread: 1, aiConfidence: 94 },
      { id: '2', name: 'Carlos Ruiz', phone: '+54 11 5555-5678', lastMessage: 'Gracias, confirmado!', time: '13:15', aiConfidence: 88 },
      { id: '3', name: 'Ana López', phone: '+54 11 5555-9012', lastMessage: '¿Cuánto sale la instalación?', time: '12:40', aiConfidence: 91 },
    ],
    activeContactId: '1',
    messages: [
      { id: 'm1', type: 'inbound', content: 'Hola! Necesito un técnico para instalar un aire acondicionado mañana a la tarde', time: '14:32' },
      { id: 'm2', type: 'ai-response', content: '¡Hola María! Con gusto te ayudo. Tenemos disponibilidad mañana a las 15:00 o 17:00. El costo de instalación de split es $45.000. ¿Qué horario te queda mejor?', time: '14:32' },
      { id: 'm3', type: 'inbound', content: 'A las 15 me viene perfecto. Mi dirección es Av. Corrientes 1234, 5to B', time: '14:33' },
      { id: 'm4', type: 'ai-response', content: '¡Perfecto! Tu turno quedó agendado para mañana a las 15:00hs. El técnico Juan te va a estar contactando 30 min antes de llegar. ¿Necesitás algo más?', time: '14:33' },
    ],
    aiPanel: {
      status: 'active',
      actions: [
        { type: 'success', title: 'Turno Creado', description: 'Instalación Split - Mañana 15:00hs', actions: [{ label: 'Ver turno', icon: <CalendarPlus className="w-3 h-3" /> }] },
        { type: 'success', title: 'Cliente Creado', description: 'María García agregada a la base', actions: [{ label: 'Ver ficha', icon: <UserPlus className="w-3 h-3" /> }] },
        { type: 'info', title: 'Técnico Notificado', description: 'Juan recibió la asignación por WhatsApp', actions: [{ label: 'Ver mensaje', icon: <Send className="w-3 h-3" /> }] },
      ],
    },
  },
  // Scenario 2: AI Advisory - Schedule Conflict
  {
    id: 'schedule-conflict',
    title: 'Conflicto de Agenda',
    description: 'La IA detecta errores y sugiere alternativas',
    contacts: [
      { id: '1', name: 'Roberto Méndez', phone: '+54 11 4444-1234', lastMessage: 'Quiero el lunes a las 14hs', time: '10:15', unread: 1, aiConfidence: 87 },
      { id: '2', name: 'Lucía Fernández', phone: '+54 11 4444-5678', lastMessage: 'Ok, nos vemos el martes', time: '09:30', aiConfidence: 92 },
      { id: '3', name: 'Diego Torres', phone: '+54 11 4444-9012', lastMessage: 'Trabajo completado ✓', time: 'Ayer', aiConfidence: 95 },
    ],
    activeContactId: '1',
    messages: [
      { id: 'm1', type: 'inbound', content: 'Buenos días, necesito que vengan a revisar una pérdida de agua', time: '10:12' },
      { id: 'm2', type: 'outbound', content: 'Hola Roberto! Sí, podemos ir. ¿Qué día te queda bien?', time: '10:13' },
      { id: 'm3', type: 'inbound', content: 'El lunes a las 14hs me viene perfecto', time: '10:15' },
    ],
    aiPanel: {
      status: 'monitoring',
      actions: [
        { type: 'alert', title: '⚠️ Conflicto Detectado', description: 'Lunes 14hs ya tiene 2 trabajos asignados. Riesgo de superposición.', actions: [{ label: 'Ver agenda', icon: <Calendar className="w-3 h-3" /> }] },
        { type: 'info', title: 'Horarios Disponibles', description: 'Lunes: 10:00, 16:30 | Martes: Todo el día', actions: [] },
        { type: 'info', title: 'Respuesta Sugerida', description: '"El lunes 14hs tenemos la agenda completa. ¿Te sirve a las 16:30 o preferís el martes?"', actions: [{ label: 'Usar', icon: <Send className="w-3 h-3" /> }] },
      ],
    },
  },
  // Scenario 3: Human to Human (AI Monitoring)
  {
    id: 'human-chat',
    title: 'Chat Humano',
    description: 'Conversación normal con IA en segundo plano',
    contacts: [
      { id: '1', name: 'Patricia Sosa', phone: '+54 11 3333-1234', lastMessage: '🎤 Audio (0:23)', time: '16:45', unread: 1, aiConfidence: 78 },
      { id: '2', name: 'Martín Acosta', phone: '+54 11 3333-5678', lastMessage: 'Dale, te espero', time: '15:20', aiConfidence: 85 },
      { id: '3', name: 'Empresa ABC', phone: '+54 11 3333-9012', lastMessage: 'Presupuesto recibido', time: '14:00', aiConfidence: 90 },
    ],
    activeContactId: '1',
    messages: [
      { id: 'm1', type: 'inbound', content: 'Hola! El técnico que vino ayer fue muy amable, quedó todo perfecto', time: '16:40' },
      { id: 'm2', type: 'outbound', content: 'Qué bueno Patricia! Me alegra mucho. ¿Quedó funcionando bien el equipo?', time: '16:42' },
      { id: 'm3', type: 'inbound', content: '🎤 Audio (0:23): "Sí, anda bárbaro. Quería consultarte si hacen mantenimiento también, porque me dijeron que hay que hacerlo una vez al año..."', time: '16:45', isVoice: true },
    ],
    aiPanel: {
      status: 'monitoring',
      actions: [
        { type: 'info', title: '🎤 Audio Transcripto', description: 'Cliente consulta por servicio de mantenimiento anual', actions: [] },
        { type: 'info', title: 'Oportunidad Detectada', description: 'Potencial venta de contrato de mantenimiento', actions: [] },
        { type: 'info', title: 'Dato Sugerido', description: 'Mantenimiento preventivo: $25.000/año (incluye 2 visitas)', actions: [{ label: 'Insertar', icon: <Send className="w-3 h-3" /> }] },
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURE HIGHLIGHT SECTION WITH CAROUSEL
// ═══════════════════════════════════════════════════════════════════════════════

function AIFeatureSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % conversationScenarios.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + conversationScenarios.length) % conversationScenarios.length);
  }, []);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const scenario = conversationScenarios[currentSlide];
  const activeContact = scenario.contacts.find(c => c.id === scenario.activeContactId);

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Asistente Inteligente con WhatsApp
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Tu copiloto en cada conversación
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            La IA trabaja en segundo plano: responde consultas, detecta conflictos de agenda,
            crea fichas de clientes y notifica a tu equipo. <span className="text-foreground font-medium">Entiende audios de voz</span> y responde siempre por texto.
          </p>
        </div>

        {/* Carousel Navigation Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {conversationScenarios.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              className={`transition-all ${
                idx === currentSlide
                  ? 'w-8 h-2 bg-primary rounded-full'
                  : 'w-2 h-2 bg-muted-foreground/30 rounded-full hover:bg-muted-foreground/50'
              }`}
              aria-label={`Ir a escenario ${idx + 1}`}
            />
          ))}
        </div>

        {/* Scenario Title */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-foreground">{scenario.title}</h3>
          <p className="text-sm text-muted-foreground">{scenario.description}</p>
        </div>

        {/* Main Chat Interface */}
        <div
          className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Contact List */}
            <div className="lg:col-span-3 border-r border-border bg-muted/30">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-foreground text-sm">WhatsApp</span>
                  </div>
                  <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Conectado</span>
                </div>
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-foreground">3</div>
                    <div className="text-[10px] text-muted-foreground">Hoy</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-success">
                      {Math.round(scenario.contacts.reduce((acc, c) => acc + (c.aiConfidence || 0), 0) / scenario.contacts.length)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">IA Resuelto</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-warning">{scenario.contacts.filter(c => c.unread).length}</div>
                    <div className="text-[10px] text-muted-foreground">Pendientes</div>
                  </div>
                </div>
              </div>

              {/* Contact List */}
              <div className="divide-y divide-border">
                {scenario.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      contact.id === scenario.activeContactId
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground text-sm truncate">{contact.name}</span>
                          <span className="text-[10px] text-muted-foreground">{contact.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">{contact.phone}</span>
                          {contact.aiConfidence && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              contact.aiConfidence >= 90 ? 'bg-success/20 text-success' :
                              contact.aiConfidence >= 80 ? 'bg-warning/20 text-warning' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              IA {contact.aiConfidence}%
                            </span>
                          )}
                        </div>
                      </div>
                      {contact.unread && (
                        <span className="w-5 h-5 bg-success rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Chat Messages */}
            <div className="lg:col-span-5 flex flex-col bg-[url('/chat-bg.png')] bg-repeat bg-muted/10">
              {/* Chat Header */}
              <div className="p-3 border-b border-border bg-card flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{activeContact?.name}</div>
                  <div className="text-xs text-muted-foreground">{activeContact?.phone}</div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 space-y-3 min-h-[280px] overflow-y-auto">
                {scenario.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.type === 'inbound' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        msg.type === 'inbound'
                          ? 'bg-white border border-border rounded-tl-none'
                          : msg.type === 'ai-response'
                          ? 'bg-success/20 border border-success/30 rounded-tr-none'
                          : 'bg-primary/10 border border-primary/20 rounded-tr-none'
                      }`}
                    >
                      {msg.type === 'ai-response' && (
                        <div className="flex items-center gap-1 text-[10px] text-success font-medium mb-1">
                          <Bot className="w-3 h-3" />
                          Respuesta IA
                        </div>
                      )}
                      {msg.isVoice && (
                        <div className="flex items-center gap-2 mb-1">
                          <Mic className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 h-1 bg-muted rounded-full">
                            <div className="w-3/4 h-full bg-muted-foreground/50 rounded-full" />
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-foreground">{msg.content}</p>
                      <div className="text-[10px] text-muted-foreground text-right mt-1">{msg.time}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2">
                  <input
                    type="text"
                    placeholder="Escribí un mensaje..."
                    className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                    readOnly
                  />
                  <Mic className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Right: AI Assistant Panel */}
            <div className="lg:col-span-4 border-l border-border bg-gradient-to-b from-primary/5 to-background">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      scenario.aiPanel.status === 'active' ? 'bg-success/20' : 'bg-primary/20'
                    }`}>
                      <Bot className={`w-4 h-4 ${
                        scenario.aiPanel.status === 'active' ? 'text-success' : 'text-primary'
                      }`} />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">Asistente IA</div>
                      <div className="text-[10px] text-muted-foreground">
                        {scenario.aiPanel.status === 'active' ? 'Respondiendo automáticamente' : 'Monitoreando conversación'}
                      </div>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    scenario.aiPanel.status === 'active' ? 'bg-success' : 'bg-primary'
                  }`} />
                </div>
              </div>

              {/* AI Actions */}
              <div className="p-4 space-y-3">
                {scenario.aiPanel.actions.map((action, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 border ${
                      action.type === 'alert'
                        ? 'bg-warning/10 border-warning/30'
                        : action.type === 'success'
                        ? 'bg-success/10 border-success/30'
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      action.type === 'alert' ? 'text-warning' :
                      action.type === 'success' ? 'text-success' :
                      'text-foreground'
                    }`}>
                      {action.title}
                    </div>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                    {action.actions && action.actions.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {action.actions.map((btn, btnIdx) => (
                          <button
                            key={btnIdx}
                            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            {btn.icon}
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Voice Memo Note */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mic className="w-4 h-4" />
                    <span>La IA transcribe audios de voz automáticamente pero siempre responde por texto</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={prevSlide}
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Escenario anterior"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <span className="text-sm text-muted-foreground">
            {currentSlide + 1} / {conversationScenarios.length}
          </span>
          <button
            onClick={nextSlide}
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Escenario siguiente"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Feature List */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-success" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Respuestas automáticas</h4>
              <p className="text-muted-foreground text-sm">Agenda turnos, crea clientes y notifica técnicos sin intervención manual.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Detección de conflictos</h4>
              <p className="text-muted-foreground text-sm">Te avisa si hay superposiciones y sugiere horarios disponibles.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Transcripción de audios</h4>
              <p className="text-muted-foreground text-sm">Entiende notas de voz de clientes y te muestra el texto.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function VerificationSection() {
  const requiredVerifications = [
    { icon: Building2, label: 'CUIT validado con AFIP', auto: true },
    { icon: CheckCircle2, label: 'Estado activo en AFIP', auto: true },
    { icon: FileCheck, label: 'Actividad económica verificada', auto: true },
    { icon: UserCheck, label: 'DNI del titular', auto: false },
    { icon: User, label: 'Selfie con DNI', auto: false },
  ];

  const optionalBadges = [
    { icon: Flame, label: 'Gasista Matriculado', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: Zap, label: 'Electricista Matriculado', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { icon: Droplet, label: 'Plomero Matriculado', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: Shield, label: 'Seguro de Responsabilidad Civil', color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: BadgeCheck, label: 'Antecedentes Verificados', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: FileText, label: 'ART Vigente', color: 'text-teal-500', bg: 'bg-teal-500/10' },
    { icon: Car, label: 'Flota Asegurada', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    { icon: Wrench, label: 'Herramientas Certificadas', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary/5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            Confianza verificada
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Verificamos todo para que tus clientes confíen
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Cada técnico en CampoTech pasa por un proceso de verificación. Tus clientes ven los badges de confianza en tu perfil y saben que trabajás en regla.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Required Verifications */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Verificaciones Obligatorias</h3>
                <p className="text-sm text-muted-foreground">Requeridas para usar CampoTech</p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
              <div className="space-y-4">
                {requiredVerifications.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <span className="text-foreground">{item.label}</span>
                      {item.auto && (
                        <span className="ml-2 text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                          Automático
                        </span>
                      )}
                    </div>
                    <Check className="w-5 h-5 text-success" />
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>Validación directa con AFIP en tiempo real</span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Badges */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                <Award className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Badges Opcionales</h3>
                <p className="text-sm text-muted-foreground">Destacá tu perfil con más certificaciones</p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
              <div className="grid grid-cols-2 gap-3">
                {optionalBadges.map((badge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className={`w-8 h-8 ${badge.bg} rounded-lg flex items-center justify-center`}>
                      <badge.icon className={`w-4 h-4 ${badge.color}`} />
                    </div>
                    <span className="text-sm text-foreground">{badge.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Los badges se muestran en tu perfil público, en la app del cliente y en el marketplace. Más badges = más confianza = más trabajos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg p-4 border border-border text-center">
            <div className="text-2xl font-bold text-primary mb-1">100%</div>
            <div className="text-sm text-muted-foreground">Validación AFIP</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border text-center">
            <div className="text-2xl font-bold text-success mb-1">Automático</div>
            <div className="text-sm text-muted-foreground">Sin papeleos</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border text-center">
            <div className="text-2xl font-bold text-accent mb-1">8+</div>
            <div className="text-sm text-muted-foreground">Badges disponibles</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border text-center">
            <div className="text-2xl font-bold text-warning mb-1">Visible</div>
            <div className="text-sm text-muted-foreground">En app y marketplace</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function StatsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Empresas de servicios confían en nosotros
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-primary mb-2">500+</div>
            <div className="text-muted-foreground">Empresas activas</div>
          </div>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-primary mb-2">15K</div>
            <div className="text-muted-foreground">Trabajos por mes</div>
          </div>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-primary mb-2">98%</div>
            <div className="text-muted-foreground">Satisfacción</div>
          </div>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-primary mb-2">24/7</div>
            <div className="text-muted-foreground">Soporte técnico</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING DATA
// ═══════════════════════════════════════════════════════════════════════════════

const pricing = [
  {
    name: 'Inicial',
    price: '$25',
    description: 'Para trabajadores independientes',
    features: [
      '1 usuario',
      '50 trabajos/mes',
      'App técnico',
      'Facturación AFIP',
      'Inventario básico',
      'WhatsApp manual',
    ],
    notIncluded: ['Reportes de voz', 'Analytics', 'WhatsApp con IA'],
    cta: 'Comenzar',
    popular: false,
  },
  {
    name: 'Profesional',
    price: '$55',
    description: 'Para pequeñas empresas (2-5 empleados)',
    features: [
      '5 usuarios',
      '200 trabajos/mes',
      'App técnico',
      'Facturación AFIP',
      'Inventario completo',
      'WhatsApp + IA (100 conv/mes)',
      'Reportes de voz',
      'Analytics básico',
    ],
    notIncluded: [],
    cta: 'Comenzar',
    popular: true,
  },
  {
    name: 'Empresa',
    price: '$120',
    description: 'Para empresas medianas (6+ empleados)',
    features: [
      'Usuarios ilimitados',
      'Trabajos ilimitados',
      'App técnico',
      'Facturación AFIP',
      'Inventario completo',
      'WhatsApp + IA ilimitado',
      'Reportes de voz',
      'Analytics avanzado',
      'Soporte prioritario',
    ],
    notIncluded: [],
    cta: 'Comenzar',
    popular: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Planes simples, sin sorpresas
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Elegí el plan que mejor se adapte a tu negocio. Podés cambiar en cualquier momento.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-xl p-8 border flex flex-col ${
                plan.popular
                  ? 'border-primary ring-2 ring-primary shadow-lg'
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                    Más popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
              </div>

              <ul className="mt-8 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-success" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-muted-foreground">
                    <X className="h-5 w-5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Todos los planes incluyen: Soporte por WhatsApp, actualizaciones y backup de datos.
          <br />
          Precios en USD. Facturamos en pesos argentinos al tipo de cambio del día.
        </p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CTA SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-6">
          Empezá a organizar tu negocio hoy
        </h2>
        <p className="text-xl text-primary-foreground/80 mb-8">
          14 días de prueba gratis. Sin compromisos. Cancelá cuando quieras.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center h-12 px-8 text-base font-medium rounded-lg bg-white text-primary hover:bg-primary-foreground/90 transition-colors"
          >
            Crear cuenta gratis
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <a
            href="#"
            className="inline-flex items-center justify-center h-12 px-8 text-base font-medium rounded-lg border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
          >
            Hablar con ventas
          </a>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader navLinks={navLinks} />
      <main>
        <HeroSection />
        <FeaturesSection />
        <AIFeatureSection />
        <VerificationSection />
        <StatsSection />
        <PricingSection />
        <CTASection />
      </main>
      <PublicFooter />
    </div>
  );
}
