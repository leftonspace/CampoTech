/**
 * Argentine Spanish Locale
 * ========================
 *
 * Phase 9.7: Argentine Communication Localization
 * Spanish translations optimized for Argentine market.
 * Uses "vos" conjugation and local expressions.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// LOCALE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const LOCALE_CODE = 'es-AR';
export const LOCALE_NAME = 'Español (Argentina)';
export const CURRENCY_CODE = 'ARS';
export const CURRENCY_SYMBOL = '$';
export const TIMEZONE = 'America/Argentina/Buenos_Aires';
export const DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm';

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const translations = {
  // Common
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    add: 'Agregar',
    search: 'Buscar',
    filter: 'Filtrar',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    confirm: 'Confirmar',
    back: 'Volver',
    next: 'Siguiente',
    previous: 'Anterior',
    close: 'Cerrar',
    yes: 'Sí',
    no: 'No',
    all: 'Todos',
    none: 'Ninguno',
    required: 'Requerido',
    optional: 'Opcional',
    actions: 'Acciones',
    view: 'Ver',
    details: 'Detalles',
    status: 'Estado',
    date: 'Fecha',
    time: 'Hora',
    name: 'Nombre',
    description: 'Descripción',
    notes: 'Notas',
    phone: 'Teléfono',
    email: 'Correo electrónico',
    address: 'Dirección',
  },

  // Authentication
  auth: {
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    register: 'Registrarse',
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetPassword: 'Restablecer contraseña',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    email: 'Correo electrónico',
    rememberMe: 'Recordarme',
    loginSuccess: '¡Bienvenido de vuelta!',
    loginError: 'Credenciales inválidas',
    logoutSuccess: 'Sesión cerrada correctamente',
    verifyEmail: 'Verificá tu correo electrónico',
    verifyPhone: 'Verificá tu teléfono',
    enterCode: 'Ingresá el código de verificación',
    codeExpired: 'El código expiró. Solicitá uno nuevo.',
    codeSent: 'Te enviamos un código de verificación',
  },

  // Jobs
  jobs: {
    title: 'Trabajos',
    newJob: 'Nuevo trabajo',
    editJob: 'Editar trabajo',
    jobNumber: 'Número de trabajo',
    serviceType: 'Tipo de servicio',
    customer: 'Cliente',
    technician: 'Técnico',
    scheduledDate: 'Fecha programada',
    scheduledTime: 'Hora programada',
    urgency: 'Urgencia',
    status: {
      pending: 'Pendiente',
      scheduled: 'Programado',
      confirmed: 'Confirmado',
      en_camino: 'En camino',
      working: 'En progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
      on_hold: 'En espera',
    },
    urgencyLevels: {
      low: 'Baja',
      normal: 'Normal',
      high: 'Alta',
      urgent: 'Urgente',
    },
    noJobs: 'No hay trabajos para mostrar',
    filterByStatus: 'Filtrar por estado',
    filterByTechnician: 'Filtrar por técnico',
    filterByDate: 'Filtrar por fecha',
    assignTechnician: 'Asignar técnico',
    startJob: 'Iniciar trabajo',
    completeJob: 'Completar trabajo',
    cancelJob: 'Cancelar trabajo',
    reschedule: 'Reprogramar',
    viewDetails: 'Ver detalles',
    jobCreated: 'Trabajo creado correctamente',
    jobUpdated: 'Trabajo actualizado correctamente',
    jobDeleted: 'Trabajo eliminado correctamente',
  },

  // Customers
  customers: {
    title: 'Clientes',
    newCustomer: 'Nuevo cliente',
    editCustomer: 'Editar cliente',
    firstName: 'Nombre',
    lastName: 'Apellido',
    company: 'Empresa',
    phone: 'Teléfono',
    email: 'Correo electrónico',
    address: 'Dirección',
    city: 'Ciudad',
    province: 'Provincia',
    postalCode: 'Código postal',
    notes: 'Notas',
    noCustomers: 'No hay clientes para mostrar',
    customerCreated: 'Cliente creado correctamente',
    customerUpdated: 'Cliente actualizado correctamente',
    customerDeleted: 'Cliente eliminado correctamente',
    viewHistory: 'Ver historial',
    sendMessage: 'Enviar mensaje',
  },

  // Team
  team: {
    title: 'Equipo',
    addMember: 'Agregar miembro',
    editMember: 'Editar miembro',
    name: 'Nombre',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    role: 'Rol',
    roles: {
      owner: 'Dueño',
      admin: 'Administrador',
      manager: 'Gerente',
      technician: 'Técnico',
      viewer: 'Observador',
    },
    status: {
      active: 'Activo',
      inactive: 'Inactivo',
      pending: 'Pendiente',
    },
    inviteSent: 'Invitación enviada',
    memberRemoved: 'Miembro eliminado',
    noMembers: 'No hay miembros en el equipo',
    pendingVerification: 'Verificación pendiente',
    verificationSent: 'Verificación enviada',
  },

  // Invoices
  invoices: {
    title: 'Facturación',
    newInvoice: 'Nueva factura',
    editInvoice: 'Editar factura',
    invoiceNumber: 'Número de factura',
    customer: 'Cliente',
    issueDate: 'Fecha de emisión',
    dueDate: 'Fecha de vencimiento',
    subtotal: 'Subtotal',
    tax: 'IVA',
    total: 'Total',
    status: {
      draft: 'Borrador',
      sent: 'Enviada',
      paid: 'Pagada',
      overdue: 'Vencida',
      cancelled: 'Anulada',
    },
    items: 'Ítems',
    addItem: 'Agregar ítem',
    quantity: 'Cantidad',
    unitPrice: 'Precio unitario',
    amount: 'Importe',
    sendInvoice: 'Enviar factura',
    markAsPaid: 'Marcar como pagada',
    downloadPdf: 'Descargar PDF',
    invoiceCreated: 'Factura creada correctamente',
    invoiceSent: 'Factura enviada correctamente',
    paymentReceived: 'Pago registrado correctamente',
  },

  // Notifications
  notifications: {
    title: 'Notificaciones',
    settings: 'Configuración de notificaciones',
    channels: 'Canales',
    whatsapp: 'WhatsApp',
    push: 'Notificaciones push',
    email: 'Correo electrónico',
    sms: 'SMS',
    enableChannel: 'Activar canal',
    disableChannel: 'Desactivar canal',
    eventTypes: 'Tipos de evento',
    jobAssigned: 'Trabajo asignado',
    jobReminder: 'Recordatorio de trabajo',
    jobCompleted: 'Trabajo completado',
    scheduleChange: 'Cambio de horario',
    invoiceCreated: 'Factura creada',
    paymentReceived: 'Pago recibido',
    teamMemberAdded: 'Nuevo miembro',
    systemAlert: 'Alerta del sistema',
    reminders: 'Recordatorios',
    reminderBefore24h: '24 horas antes',
    reminderBefore1h: '1 hora antes',
    reminderBefore30m: '30 minutos antes',
    reminderBefore15m: '15 minutos antes',
    quietHours: 'Horario de descanso',
    quietHoursStart: 'Desde',
    quietHoursEnd: 'Hasta',
    quietHoursEnabled: 'Activar horario de descanso',
    saveChanges: 'Guardar cambios',
    changesSaved: 'Configuración guardada correctamente',
    noNotifications: 'No tenés notificaciones',
    markAllRead: 'Marcar todas como leídas',
  },

  // Settings
  settings: {
    title: 'Configuración',
    account: 'Cuenta',
    organization: 'Organización',
    team: 'Equipo',
    notifications: 'Notificaciones',
    integrations: 'Integraciones',
    billing: 'Facturación',
    businessName: 'Nombre comercial',
    legalName: 'Razón social',
    taxId: 'CUIT',
    phone: 'Teléfono',
    email: 'Correo electrónico',
    address: 'Dirección',
    logo: 'Logo',
    uploadLogo: 'Subir logo',
    timezone: 'Zona horaria',
    language: 'Idioma',
    currency: 'Moneda',
    businessHours: 'Horario de atención',
    saveSettings: 'Guardar configuración',
    settingsSaved: 'Configuración guardada correctamente',
  },

  // WhatsApp
  whatsapp: {
    title: 'WhatsApp Business',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    phoneNumber: 'Número de teléfono',
    status: 'Estado',
    messages: 'Mensajes',
    conversations: 'Conversaciones',
    templates: 'Plantillas',
    sendMessage: 'Enviar mensaje',
    newConversation: 'Nueva conversación',
    selectContact: 'Seleccionar contacto',
    typeMessage: 'Escribí un mensaje...',
    send: 'Enviar',
    noConversations: 'No hay conversaciones',
    loadMore: 'Cargar más',
    audioMessage: 'Mensaje de audio',
    imageMessage: 'Imagen',
    documentMessage: 'Documento',
    locationMessage: 'Ubicación',
    contactMessage: 'Contacto',
  },

  // Tracking
  tracking: {
    title: 'Seguimiento',
    technicianOnWay: 'Tu técnico está en camino',
    estimatedArrival: 'Llegada estimada',
    minutes: 'minutos',
    arrived: 'El técnico llegó',
    inProgress: 'Trabajo en progreso',
    completed: 'Trabajo completado',
    viewLiveLocation: 'Ver ubicación en vivo',
    callTechnician: 'Llamar al técnico',
    shareLocation: 'Compartir ubicación',
  },

  // Errors
  errors: {
    generic: 'Algo salió mal. Por favor, intentá de nuevo.',
    network: 'Error de conexión. Verificá tu internet.',
    notFound: 'No encontrado',
    unauthorized: 'No autorizado',
    forbidden: 'Acceso denegado',
    validation: 'Por favor, revisá los datos ingresados',
    serverError: 'Error del servidor. Intentá más tarde.',
    sessionExpired: 'Tu sesión expiró. Iniciá sesión nuevamente.',
    fileTooLarge: 'El archivo es demasiado grande',
    invalidFileType: 'Tipo de archivo no válido',
    requiredField: 'Este campo es requerido',
    invalidEmail: 'Correo electrónico no válido',
    invalidPhone: 'Teléfono no válido',
    passwordMismatch: 'Las contraseñas no coinciden',
    weakPassword: 'La contraseña es muy débil',
  },

  // Success messages
  success: {
    saved: 'Guardado correctamente',
    deleted: 'Eliminado correctamente',
    updated: 'Actualizado correctamente',
    created: 'Creado correctamente',
    sent: 'Enviado correctamente',
    copied: 'Copiado al portapapeles',
  },

  // Date/Time
  datetime: {
    today: 'Hoy',
    yesterday: 'Ayer',
    tomorrow: 'Mañana',
    thisWeek: 'Esta semana',
    lastWeek: 'Semana pasada',
    nextWeek: 'Próxima semana',
    thisMonth: 'Este mes',
    lastMonth: 'Mes pasado',
    days: {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo',
    },
    months: {
      january: 'Enero',
      february: 'Febrero',
      march: 'Marzo',
      april: 'Abril',
      may: 'Mayo',
      june: 'Junio',
      july: 'Julio',
      august: 'Agosto',
      september: 'Septiembre',
      october: 'Octubre',
      november: 'Noviembre',
      december: 'Diciembre',
    },
    at: 'a las',
    hours: 'hs',
  },

  // Argentine specific
  argentina: {
    provinces: {
      buenosAires: 'Buenos Aires',
      caba: 'Ciudad Autónoma de Buenos Aires',
      catamarca: 'Catamarca',
      chaco: 'Chaco',
      chubut: 'Chubut',
      cordoba: 'Córdoba',
      corrientes: 'Corrientes',
      entreRios: 'Entre Ríos',
      formosa: 'Formosa',
      jujuy: 'Jujuy',
      laPampa: 'La Pampa',
      laRioja: 'La Rioja',
      mendoza: 'Mendoza',
      misiones: 'Misiones',
      neuquen: 'Neuquén',
      rioNegro: 'Río Negro',
      salta: 'Salta',
      sanJuan: 'San Juan',
      sanLuis: 'San Luis',
      santaCruz: 'Santa Cruz',
      santaFe: 'Santa Fe',
      santiagoDelEstero: 'Santiago del Estero',
      tierraDelFuego: 'Tierra del Fuego',
      tucuman: 'Tucumán',
    },
    cuit: 'CUIT',
    cuil: 'CUIL',
    dni: 'DNI',
    mercadoPago: 'MercadoPago',
    payWithMp: 'Pagar con MercadoPago',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format currency in Argentine pesos
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date in Argentine format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(d);
}

/**
 * Format time in 24h format
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  }).format(d);
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  }).format(d);
}

/**
 * Format relative date (hoy, ayer, etc.)
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return translations.datetime.today;
  if (diffDays === 1) return translations.datetime.yesterday;
  if (diffDays === -1) return translations.datetime.tomorrow;

  return formatDate(d);
}

/**
 * Format phone number for display (Argentine format)
 */
export function formatPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle Argentine numbers
  if (digits.startsWith('54')) {
    const local = digits.slice(2);
    if (local.length === 10) {
      // Mobile: 54 + 11 + 1234-5678
      const area = local.slice(0, 2);
      const first = local.slice(2, 6);
      const second = local.slice(6);
      return `+54 ${area} ${first}-${second}`;
    }
  }

  // Return formatted with country code
  if (digits.length >= 10) {
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  }

  return phone;
}

/**
 * Format CUIT (XX-XXXXXXXX-X)
 */
export function formatCUIT(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return cuit;

  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT LOCALE
// ═══════════════════════════════════════════════════════════════════════════════

export const esARLocale = {
  code: LOCALE_CODE,
  name: LOCALE_NAME,
  currency: {
    code: CURRENCY_CODE,
    symbol: CURRENCY_SYMBOL,
  },
  timezone: TIMEZONE,
  dateFormat: DATE_FORMAT,
  timeFormat: TIME_FORMAT,
  translations,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeDate,
  formatPhone,
  formatCUIT,
};

export default esARLocale;
