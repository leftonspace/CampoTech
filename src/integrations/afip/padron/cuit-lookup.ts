/**
 * CUIT Lookup Service
 * ===================
 *
 * Queries AFIP's WS_SR_PADRON service to validate and retrieve
 * taxpayer information from their CUIT (tax ID).
 */

import * as https from 'https';
import { parseStringPromise, Builder } from 'xml2js';
import {
  AFIPEnvironment,
  AFIPConfig,
  AFIP_ENDPOINTS,
  CUITLookupResult,
  IVACondition,
  AFIP_IVA_CONDITION_CODES,
} from '../afip.types';
import { getWSAAClient } from '../wsaa';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CUIT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate CUIT format and checksum (Modulo 11)
 */
export function validateCUITFormat(cuit: string): { valid: boolean; error?: string } {
  // Remove hyphens and spaces
  const cleanCuit = cuit.replace(/[-\s]/g, '');

  // Check length
  if (cleanCuit.length !== 11) {
    return { valid: false, error: 'CUIT must be 11 digits' };
  }

  // Check all digits
  if (!/^\d{11}$/.test(cleanCuit)) {
    return { valid: false, error: 'CUIT must contain only digits' };
  }

  // Validate checksum (Modulo 11)
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCuit[i], 10) * weights[i];
  }

  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  const actualCheckDigit = parseInt(cleanCuit[10], 10);

  if (expectedCheckDigit !== actualCheckDigit) {
    return { valid: false, error: 'Invalid CUIT checksum' };
  }

  return { valid: true };
}

/**
 * Format CUIT with hyphens (XX-XXXXXXXX-X)
 */
export function formatCUIT(cuit: string): string {
  const clean = cuit.replace(/[-\s]/g, '');
  if (clean.length !== 11) return cuit;
  return `${clean.substring(0, 2)}-${clean.substring(2, 10)}-${clean.substring(10)}`;
}

/**
 * Clean CUIT to digits only
 */
export function cleanCUIT(cuit: string): string {
  return cuit.replace(/[-\s]/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOAP REQUEST BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

const PADRON_NAMESPACE = 'http://a4.soap.ws.server.puc.sr/';

function buildGetPersonaEnvelope(token: string, sign: string, cuitRepresentada: string, cuitConsultada: string): string {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { pretty: false },
  });

  const envelope = {
    'soapenv:Envelope': {
      $: {
        'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
        'xmlns:a4': PADRON_NAMESPACE,
      },
      'soapenv:Header': {},
      'soapenv:Body': {
        'a4:getPersona': {
          'token': token,
          'sign': sign,
          'cuitRepresentada': cuitRepresentada,
          'idPersona': cuitConsultada,
        },
      },
    },
  };

  return builder.buildObject(envelope);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOAP REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

interface SoapResponse {
  statusCode: number;
  body: string;
}

function makeSoapRequest(endpoint: string, soapEnvelope: string): Promise<SoapResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(endpoint);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapEnvelope),
        'SOAPAction': '',
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Padron request timeout'));
    });

    req.write(soapEnvelope);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

interface PersonaData {
  nombre?: string;
  apellido?: string;
  razonSocial?: string;
  nombreFantasia?: string;
  tipoPersona?: string;
  estadoClave?: string;
  categoriaMonotributo?: string;
  domicilio?: {
    localidad?: string;
    provincia?: string;
    direccion?: string;
    codigoPostal?: string;
  };
  impuestos?: number[];
}

async function parseGetPersonaResponse(xmlResponse: string): Promise<PersonaData | null> {
  try {
    const result = await parseStringPromise(xmlResponse, {
      explicitArray: false,
      ignoreAttrs: true,
    });

    // Navigate through SOAP envelope
    const envelope = result['soap:Envelope'] || result['soapenv:Envelope'] || result.Envelope;
    if (!envelope) {
      throw new Error('Invalid SOAP response');
    }

    const body = envelope['soap:Body'] || envelope['soapenv:Body'] || envelope.Body;
    if (!body) {
      throw new Error('Invalid SOAP response: missing body');
    }

    // Check for fault
    const fault = body['soap:Fault'] || body['soapenv:Fault'] || body.Fault;
    if (fault) {
      throw new Error(fault.faultstring || 'SOAP Fault');
    }

    // Get response
    const response = body.getPersonaResponse || body['ns2:getPersonaResponse'];
    if (!response) {
      return null;
    }

    const persona = response.personaReturn || response.return;
    if (!persona) {
      return null;
    }

    // Parse domicilio
    let domicilio;
    if (persona.domicilioFiscal) {
      const dom = persona.domicilioFiscal;
      domicilio = {
        localidad: dom.localidad,
        provincia: dom.descripcionProvincia || dom.idProvincia,
        direccion: `${dom.tipoCalle || ''} ${dom.nombreCalle || ''} ${dom.nroPuerta || ''}`.trim(),
        codigoPostal: dom.codPostal,
      };
    }

    // Parse impuestos
    let impuestos: number[] = [];
    if (persona.impuestos?.impuesto) {
      const impArray = Array.isArray(persona.impuestos.impuesto)
        ? persona.impuestos.impuesto
        : [persona.impuestos.impuesto];
      impuestos = impArray.map((imp: any) => parseInt(imp.idImpuesto || imp, 10));
    }

    return {
      nombre: persona.nombre,
      apellido: persona.apellido,
      razonSocial: persona.razonSocial,
      nombreFantasia: persona.nombreFantasia,
      tipoPersona: persona.tipoPersona,
      estadoClave: persona.estadoClave,
      categoriaMonotributo: persona.categoriaMonotributo?.categoria,
      domicilio,
      impuestos,
    };
  } catch (error) {
    log.warn('Failed to parse padron response', { error });
    return null;
  }
}

/**
 * Determine IVA condition from AFIP impuestos
 */
function determineIVACondition(impuestos: number[], categoriaMonotributo?: string): IVACondition {
  // 20 = IVA Responsable Inscripto
  // 32 = IVA Exento
  // 33 = IVA Responsable No Inscripto
  // Monotributo categories indicate monotributista

  if (categoriaMonotributo) {
    return 'monotributista';
  }

  if (impuestos.includes(20)) {
    return 'responsable_inscripto';
  }

  if (impuestos.includes(32)) {
    return 'exento';
  }

  // Default to consumidor final if no IVA registration
  return 'consumidor_final';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUIT LOOKUP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class CUITLookupClient {
  private environment: AFIPEnvironment;
  private endpoint: string;

  constructor(environment: AFIPEnvironment = 'homologation') {
    this.environment = environment;
    this.endpoint = AFIP_ENDPOINTS[environment].padron;
  }

  /**
   * Lookup taxpayer information by CUIT
   */
  async lookup(config: AFIPConfig, cuitToLookup: string): Promise<CUITLookupResult> {
    // Clean and validate CUIT
    const cleanedCuit = cleanCUIT(cuitToLookup);
    const validation = validateCUITFormat(cleanedCuit);

    if (!validation.valid) {
      return {
        success: false,
        cuit: cuitToLookup,
        error: validation.error,
      };
    }

    log.info('CUIT lookup starting', { cuit: cleanedCuit });

    try {
      // Get authentication token
      const wsaaClient = getWSAAClient(this.environment);
      const ticket = await wsaaClient.getToken(config, 'ws_sr_padron_a4');

      // Build SOAP request
      const envelope = buildGetPersonaEnvelope(
        ticket.token,
        ticket.sign,
        config.cuit,
        cleanedCuit
      );

      // Make request
      const response = await makeSoapRequest(this.endpoint, envelope);

      if (response.statusCode !== 200) {
        return {
          success: false,
          cuit: cleanedCuit,
          error: `HTTP ${response.statusCode}`,
        };
      }

      // Parse response
      const persona = await parseGetPersonaResponse(response.body);

      if (!persona) {
        return {
          success: false,
          cuit: cleanedCuit,
          error: 'CUIT not found or inactive',
        };
      }

      // Check if active
      const isActive = persona.estadoClave === 'ACTIVO';

      // Determine IVA condition
      const ivaCondition = determineIVACondition(
        persona.impuestos || [],
        persona.categoriaMonotributo
      );

      // Build name
      let name: string | undefined;
      if (persona.razonSocial) {
        name = persona.razonSocial;
      } else if (persona.nombre || persona.apellido) {
        name = [persona.apellido, persona.nombre].filter(Boolean).join(', ');
      }

      const result: CUITLookupResult = {
        success: true,
        cuit: cleanedCuit,
        name,
        legalName: persona.razonSocial,
        tradeName: persona.nombreFantasia,
        ivaCondition,
        isActive,
      };

      if (persona.domicilio) {
        result.address = {
          street: persona.domicilio.direccion,
          city: persona.domicilio.localidad,
          province: persona.domicilio.provincia,
          postalCode: persona.domicilio.codigoPostal,
        };
      }

      log.info('CUIT lookup successful', {
        cuit: cleanedCuit,
        ivaCondition,
        isActive,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('CUIT lookup failed', { cuit: cleanedCuit, error: message });

      return {
        success: false,
        cuit: cleanedCuit,
        error: message,
      };
    }
  }

  /**
   * Simple CUIT validation without AFIP lookup
   * Useful for quick format validation
   */
  validateFormat(cuit: string): { valid: boolean; error?: string } {
    return validateCUITFormat(cuit);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let cuitLookupClient: CUITLookupClient | null = null;

export function getCUITLookupClient(environment?: AFIPEnvironment): CUITLookupClient {
  if (!cuitLookupClient) {
    const env = environment || (process.env.AFIP_ENVIRONMENT as AFIPEnvironment) || 'homologation';
    cuitLookupClient = new CUITLookupClient(env);
  }
  return cuitLookupClient;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetCUITLookupClient(): void {
  cuitLookupClient = null;
}

