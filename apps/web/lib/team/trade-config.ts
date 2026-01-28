/**
 * Trade configuration for Argentine skilled trades
 * Includes specialty options, trade categories, matrícula patterns, and validation
 * 
 * @module lib/team/trade-config
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TradeCertification {
    matricula: string;
    category: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIALTY OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const SPECIALTY_OPTIONS = [
    { value: '', label: 'Sin especialidad' },
    { value: 'PLOMERO', label: 'Plomero' },
    { value: 'ELECTRICISTA', label: 'Electricista' },
    { value: 'GASISTA', label: 'Gasista' },
    { value: 'CALEFACCIONISTA', label: 'Calefaccionista' },
    { value: 'REFRIGERACION', label: 'Refrigeración' },
    { value: 'ALBANIL', label: 'Albañil' },
    { value: 'PINTOR', label: 'Pintor' },
    { value: 'CARPINTERO', label: 'Carpintero' },
    { value: 'TECHISTA', label: 'Techista' },
    { value: 'HERRERO', label: 'Herrero' },
    { value: 'SOLDADOR', label: 'Soldador' },
    { value: 'OTRO', label: 'Otro / Sin categoría formal' },
];

export const SKILL_LEVEL_OPTIONS = [
    { value: '', label: 'Sin nivel asignado' },
    { value: 'AYUDANTE', label: 'Ayudante' },
    { value: 'MEDIO_OFICIAL', label: 'Medio Oficial' },
    { value: 'OFICIAL', label: 'Oficial' },
    { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado' },
];

// Standard UOCRA categories (used for most manual trades in Argentina - CCT 76/75)
export const UOCRA_CATEGORIES = [
    { value: 'AYUDANTE', label: 'Ayudante' },
    { value: 'MEDIO_OFICIAL', label: 'Medio Oficial' },
    { value: 'OFICIAL', label: 'Oficial' },
    { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE CATEGORY OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const TRADE_CATEGORY_OPTIONS: Record<string, { value: string; label: string }[]> = {
    // --- MATRICULATED TRADES (Regulated by Law) ---

    GASISTA: [
        { value: '1RA', label: '1ra Categoría (Industrial / Edificios - >50.000 Kcal)' },
        { value: '2DA', label: '2da Categoría (Doméstico / Comercial - <50.000 Kcal)' },
        { value: '3RA', label: '3ra Categoría (Unifuncional / Domiciliario)' },
    ],

    ELECTRICISTA: [
        { value: 'CAT_A', label: 'Categoría A (Profesional / Ingeniero - Potencia Ilimitada)' },
        { value: 'CAT_B', label: 'Categoría B (Técnico - Hasta 2000 kVA)' },
        { value: 'CAT_C', label: 'Categoría C (Idóneo - Hasta 10 kW / Domiciliario)' },
    ],

    // --- NON-MATRICULATED TRADES (Regulated by UOCRA Skills) ---

    PLOMERO: [
        { value: '', label: 'Sin categoría' },
        ...UOCRA_CATEGORIES, // Uses Ayudante -> Oficial Especializado
        { value: 'DESTAPACIONES', label: 'Especialista en Destapaciones (Máquina)' },
    ],

    CALEFACCIONISTA: [
        { value: '', label: 'Sin categoría' },
        { value: 'CALDERISTA', label: 'Calderista (Vapor/Agua Caliente)' },
        { value: 'RADIADORES', label: 'Instalador de Radiadores/Piso Radiante' },
        { value: 'ESTUFAS', label: 'Reparador de Estufas/Tiro Balanceado' },
    ],

    REFRIGERACION: [
        { value: '', label: 'Sin categoría' },
        { value: 'MATRICULADO_CACAAV', label: 'Matriculado CACAAV / IRAM' },
        { value: 'INSTALADOR_SPLIT', label: 'Instalador de Splits (Baja capacidad)' },
        { value: 'TECNICO_CENTRAL', label: 'Técnico en Sistemas Centrales / VRF' },
        { value: 'HELADERAS', label: 'Reparador de Heladeras / Línea Blanca' },
    ],

    // --- CONSTRUCTION TRADES (Strictly UOCRA) ---

    ALBANIL: UOCRA_CATEGORIES,

    PINTOR: [
        ...UOCRA_CATEGORIES,
        { value: 'ALTURA', label: 'Pintor de Altura / Siletero' }, // Specialized high-risk role
    ],

    CARPINTERO: [
        ...UOCRA_CATEGORIES,
        { value: 'EBANISTA', label: 'Ebanista (Muebles a medida)' },
        { value: 'OBRA', label: 'Carpintero de Obra / Encofrador' },
    ],

    TECHISTA: [
        ...UOCRA_CATEGORIES,
        { value: 'ZINGUERO', label: 'Zinguero (Canaletas y Zinguería)' },
        { value: 'MEMBRANERO', label: 'Colocador de Membranas' },
    ],

    HERRERO: UOCRA_CATEGORIES,

    // --- HIGHLY SPECIALIZED ---

    SOLDADOR: [
        { value: '', label: 'Herrero de Obra (Sin calificación)' },
        { value: 'CALIFICADO_ASME', label: 'Calificado ASME IX (Alta Presión)' },
        { value: 'CALIFICADO_API', label: 'Calificado API 1104 (Gasoductos)' },
        { value: 'CALIFICADO_AWS', label: 'Calificado AWS D1.1 (Estructural)' },
        { value: 'ARGONISTA', label: 'Argonista / TIG (Acero Inoxidable)' },
    ],

    // Fallback
    DEFAULT: UOCRA_CATEGORIES,
};

/**
 * Get category options for a specific trade
 */
export function getTradeCategoryOptions(specialty: string) {
    return TRADE_CATEGORY_OPTIONS[specialty] || TRADE_CATEGORY_OPTIONS.DEFAULT;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATRÍCULA CONFIGURATION
// Different trades require different types of professional certifications
// All are OPTIONAL - helpers and unlicensed workers can still be added
// ═══════════════════════════════════════════════════════════════════════════════

export const SPECIALTY_MATRICULA_CONFIG: Record<string, {
    label: string;
    placeholder: string;
    hint: string;
    required: boolean;
    pattern?: RegExp;
}> = {
    GASISTA: {
        label: 'Matrícula Gasista',
        // Removed CACAAV. Added generic numeric examples common in Metrogas/Naturgy.
        placeholder: 'Ej: 12345 o MG-12345',
        hint: 'Número de matrícula habilitante (ej: MetroGas, Camuzzi, Naturgy)',
        required: false,
    },
    ELECTRICISTA: {
        label: 'Matrícula Electricista',
        // APSE and COPIME are the two big ones technicians recognize.
        placeholder: 'Ej: APSE-12345 o COPIME Tº12 Fº34',
        hint: 'Número de registro en APSE, COPIME o colegio técnico provincial',
        required: false,
    },
    PLOMERO: {
        label: 'Matrícula Sanitarista', // "Sanitarista" sounds more professional for matriculas
        placeholder: 'Ej: 12345 (AySA / Obras Sanitarias)',
        hint: 'Sólo si posee matrícula oficial de instalador sanitario',
        required: false,
    },
    CALEFACCIONISTA: {
        label: 'Matrícula Calefacción',
        // Usually implies Gasista, but could be specific hydronic heating
        placeholder: 'Ej: 12345',
        hint: 'Si es caldera a gas, por favor ingrese su matrícula de Gasista',
        required: false,
    },
    REFRIGERACION: {
        label: 'Matrícula / Registro HVAC',
        // Moved CACAAV here where it belongs
        placeholder: 'Ej: CACAAV-12345 o AARA-123',
        hint: 'Número de socio CACAAV o certificado de la Asoc. Arg. del Frío',
        required: false,
    },
    ALBANIL: {
        label: 'Registro IERIC / Credencial',
        placeholder: 'Ej: Nº de Inscripción IERIC',
        hint: 'Número de credencial IERIC (Libreta de Fondo de Desempleo) si posee',
        required: false,
    },
    PINTOR: {
        label: 'Certificación / Registro',
        placeholder: 'Ej: Curso Profesional / Capra',
        hint: 'Mencione si posee certificados de cursos o membresía en cámara de pintores',
        required: false,
    },
    CARPINTERO: {
        label: 'Registro / Afiliación',
        placeholder: 'Ej: USIMRA o Certificado FP',
        hint: 'Número de afiliación gremial o certificado de Formación Profesional',
        required: false,
    },
    TECHISTA: {
        label: 'Certificación Especialidad',
        placeholder: 'Ej: Instalador Zinguería / Techos Verdes',
        hint: 'Especifique si tiene certificación en materiales específicos',
        required: false,
    },
    HERRERO: {
        label: 'Habilitación Taller',
        placeholder: 'Ej: Habilitación Municipal',
        hint: 'Si posee taller habilitado, puede indicarlo aquí',
        required: false,
    },
    SOLDADOR: {
        label: 'Calificación de Soldadura', // This is the most technical one in this list
        placeholder: 'Ej: Norma ASME IX / API 1104',
        hint: 'Código de calificación vigente (WPQ) si realiza trabajos de alta presión',
        required: false,
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATRÍCULA VALIDATION - Argentine Skilled Trade License Numbers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Regex patterns for validating Argentine trade license/matrícula numbers
 * All patterns are optional (empty string is valid)
 */
export const MATRICULA_PATTERNS: Record<string, {
    pattern: RegExp;
    errorMessage: string;
}> = {
    GASISTA: {
        // Numeric (4-6 digits) OR alphanumeric starting with 'MG-' or 'Naturgy-'
        // Examples: 12345, 123456, MG-12345, Naturgy-123
        pattern: /^$|^(\d{4,6}|MG-\d{3,6}|Naturgy-\d{2,6}|Camuzzi-\d{2,6})$/i,
        errorMessage: 'Formato inválido. Use número (4-6 dígitos) o prefijo MG-/Naturgy-/Camuzzi-',
    },
    ELECTRICISTA: {
        // 'APSE' or 'COPIME' followed by numbers/dashes, OR just a 5-6 digit number
        // Examples: APSE-12345, COPIME Tº12 Fº34, 12345, 123456
        pattern: /^$|^(APSE[-\s]?\d{3,6}|COPIME\s*(Tº?\d{1,4}\s*Fº?\d{1,4}|\d{3,6})|\d{5,6})$/i,
        errorMessage: 'Formato inválido. Use APSE-xxxxx, COPIME Tº12 Fº34, o número de 5-6 dígitos',
    },
    PLOMERO: {
        // Numeric (3-6 digits) - AySA / Obras Sanitarias format
        // Examples: 1234, 12345, 123456
        pattern: /^$|^\d{3,6}$/,
        errorMessage: 'Use número de matrícula de 3-6 dígitos',
    },
    CALEFACCIONISTA: {
        // Numeric (4-6 digits) - same as gasista or general format
        // Examples: 1234, 12345, 123456
        pattern: /^$|^\d{4,6}$/,
        errorMessage: 'Use número de 4-6 dígitos (si es a gas, use su matrícula de gasista)',
    },
    REFRIGERACION: {
        // CACAAV-xxxxx or AARA-xxx format
        // Examples: CACAAV-12345, AARA-123, 12345
        pattern: /^$|^(CACAAV[-\s]?\d{3,6}|AARA[-\s]?\d{2,5}|\d{3,6})$/i,
        errorMessage: 'Use formato CACAAV-xxxxx, AARA-xxx, o número de 3-6 dígitos',
    },
    ALBANIL: {
        // IERIC registration number or free text (credencial number)
        // Examples: 123456789, IERIC-12345
        pattern: /^$|^(IERIC[-\s]?\d{4,10}|\d{4,12}|.{1,50})$/i,
        errorMessage: 'Use número IERIC o número de credencial',
    },
    PINTOR: {
        // Open format - certification names or course completion
        // Just validate it's not too long
        pattern: /^$|^.{1,100}$/,
        errorMessage: 'Ingrese nombre de certificación o curso (máx 100 caracteres)',
    },
    CARPINTERO: {
        // USIMRA or FP certificate format
        // Examples: USIMRA-12345, FP Carpintería 2020
        pattern: /^$|^(USIMRA[-\s]?\d{3,8}|FP\s*.{1,50}|.{1,50})$/i,
        errorMessage: 'Use número USIMRA, certificado FP, o descripción breve',
    },
    TECHISTA: {
        // Open format - specialty certification
        pattern: /^$|^.{1,100}$/,
        errorMessage: 'Ingrese tipo de certificación (máx 100 caracteres)',
    },
    HERRERO: {
        // Municipal habilitación or general format
        // Examples: Hab. Municipal CABA, 12345
        pattern: /^$|^.{1,100}$/,
        errorMessage: 'Ingrese habilitación o número de taller (máx 100 caracteres)',
    },
    SOLDADOR: {
        // ASME, API, or AWS certification format
        // Examples: ASME IX, API 1104, AWS D1.1, WPQ-123
        pattern: /^$|^(ASME\s*(IX|Section\s*IX|Sec\.?\s*IX)?|API\s*(1104|650)|AWS\s*D\d+(\.\d+)?|WPQ[-\s]?\d{1,6}|.{1,50})$/i,
        errorMessage: 'Use código ASME/API/AWS (ej: ASME IX, API 1104) o número WPQ',
    },
};

/**
 * Validate a matrícula value based on the specialty
 * @param specialty - The specialty code (e.g., 'GASISTA', 'ELECTRICISTA')
 * @param matricula - The matrícula value to validate
 * @returns { valid: boolean, error?: string }
 */
export function validateMatricula(specialty: string, matricula: string): { valid: boolean; error?: string } {
    // Empty is always valid (all matrícula fields are optional)
    if (!matricula || matricula.trim() === '') {
        return { valid: true };
    }

    const trimmed = matricula.trim();
    const config = MATRICULA_PATTERNS[specialty];

    // If no specific pattern defined, allow any non-empty value up to 100 chars
    if (!config) {
        if (trimmed.length > 100) {
            return { valid: false, error: 'Máximo 100 caracteres' };
        }
        return { valid: true };
    }

    // Test against the pattern
    if (!config.pattern.test(trimmed)) {
        return { valid: false, error: config.errorMessage };
    }

    return { valid: true };
}
