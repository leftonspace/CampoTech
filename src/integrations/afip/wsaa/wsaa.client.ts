/**
 * WSAA Client
 * ===========
 *
 * Client for AFIP's Web Service de Autenticación y Autorización.
 * Handles authentication and token generation.
 */

import * as https from 'https';
import { parseStringPromise } from 'xml2js';
import {
  AFIPEnvironment,
  AFIPConfig,
  AFIP_ENDPOINTS,
  TicketDeAcceso,
  WSAAResponse,
} from '../afip.types';
import { createSignedTRA } from './tra-generator';
import { TokenManager, setCachedToken, getCachedToken } from './token-cache';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SOAP ENVELOPE
// ═══════════════════════════════════════════════════════════════════════════════

function buildLoginCmsEnvelope(cms: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedCredentials {
  token: string;
  sign: string;
  expirationTime: Date;
  generationTime: Date;
  source: string;
  destination: string;
}

async function parseLoginResponse(xmlResponse: string): Promise<ParsedCredentials> {
  const result = await parseStringPromise(xmlResponse, {
    explicitArray: false,
    ignoreAttrs: false,
  });

  // Navigate through SOAP envelope
  const envelope = result['soapenv:Envelope'] || result['soap:Envelope'] || result.Envelope;
  if (!envelope) {
    throw new Error('Invalid SOAP response: missing envelope');
  }

  const body = envelope['soapenv:Body'] || envelope['soap:Body'] || envelope.Body;
  if (!body) {
    throw new Error('Invalid SOAP response: missing body');
  }

  // Check for SOAP fault
  const fault = body['soapenv:Fault'] || body['soap:Fault'] || body.Fault;
  if (fault) {
    const faultString = fault.faultstring || fault.detail || 'Unknown SOAP fault';
    throw new Error(`WSAA SOAP Fault: ${faultString}`);
  }

  // Get loginCmsResponse
  const loginResponse = body.loginCmsResponse || body['ns1:loginCmsResponse'];
  if (!loginResponse) {
    throw new Error('Invalid WSAA response: missing loginCmsResponse');
  }

  // Get the loginTicketResponse XML
  const loginTicketXml = loginResponse.loginCmsReturn || loginResponse['ns1:loginCmsReturn'];
  if (!loginTicketXml) {
    throw new Error('Invalid WSAA response: missing loginTicketResponse');
  }

  // Parse the inner XML (loginTicketResponse)
  const ticketResult = await parseStringPromise(loginTicketXml, {
    explicitArray: false,
    ignoreAttrs: false,
  });

  const loginTicketResponse = ticketResult.loginTicketResponse;
  if (!loginTicketResponse) {
    throw new Error('Invalid loginTicketResponse');
  }

  const header = loginTicketResponse.header;
  const credentials = loginTicketResponse.credentials;

  if (!header || !credentials) {
    throw new Error('Invalid loginTicketResponse structure');
  }

  return {
    token: credentials.token,
    sign: credentials.sign,
    expirationTime: new Date(header.expirationTime),
    generationTime: new Date(header.generationTime),
    source: header.source || 'CN=wsaahomo',
    destination: header.destination || '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

interface HttpResponse {
  statusCode: number;
  body: string;
}

function makeHttpRequest(url: string, soapEnvelope: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapEnvelope),
        'SOAPAction': '""',
      },
      timeout: 30000, // 30 second timeout
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
      reject(new Error('WSAA request timeout'));
    });

    req.write(soapEnvelope);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WSAA CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class WSAAClient {
  private environment: AFIPEnvironment;
  private endpoint: string;
  private tokenManagers: Map<string, TokenManager> = new Map();

  constructor(environment: AFIPEnvironment = 'homologation') {
    this.environment = environment;
    this.endpoint = AFIP_ENDPOINTS[environment].wsaa;
  }

  /**
   * Authenticate and get a Ticket de Acceso
   */
  async authenticate(
    cuit: string,
    certificate: string,
    privateKey: string,
    service: string = 'wsfe'
  ): Promise<WSAAResponse> {
    try {
      log.info('WSAA authentication starting', { cuit, service, environment: this.environment });

      // Generate and sign TRA
      const signedTRA = createSignedTRA(certificate, privateKey, service);

      // Build SOAP envelope
      const envelope = buildLoginCmsEnvelope(signedTRA.cms);

      // Make request
      const response = await makeHttpRequest(this.endpoint, envelope);

      // Check HTTP status
      if (response.statusCode !== 200) {
        log.error('WSAA HTTP error', { statusCode: response.statusCode, body: response.body });
        return {
          success: false,
          error: `HTTP ${response.statusCode}: ${response.body}`,
        };
      }

      // Parse response
      const credentials = await parseLoginResponse(response.body);

      const ticket: TicketDeAcceso = {
        token: credentials.token,
        sign: credentials.sign,
        expirationTime: credentials.expirationTime,
        generatedAt: credentials.generationTime,
        service,
      };

      // Cache the token
      setCachedToken(cuit, service, ticket);

      log.info('WSAA authentication successful', {
        cuit,
        service,
        expiresAt: ticket.expirationTime,
      });

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('WSAA authentication failed', { cuit, service, error: message });

      return {
        success: false,
        error: message,
        faultCode: 'WSAA_ERROR',
      };
    }
  }

  /**
   * Get or create a TokenManager for an organization
   */
  getTokenManager(config: AFIPConfig): TokenManager {
    const key = config.cuit;

    let manager = this.tokenManagers.get(key);
    if (!manager) {
      manager = new TokenManager(config.cuit, async (cuit, service) => {
        const result = await this.authenticate(
          cuit,
          config.certificate,
          config.privateKey,
          service
        );

        if (!result.success || !result.ticket) {
          throw new Error(result.error || 'Authentication failed');
        }

        return result.ticket;
      });

      this.tokenManagers.set(key, manager);
    }

    return manager;
  }

  /**
   * Get a valid token for the specified service
   * Will authenticate if no valid token is cached
   */
  async getToken(config: AFIPConfig, service: string = 'wsfe'): Promise<TicketDeAcceso> {
    // Check cache first
    const cached = getCachedToken(config.cuit, service);
    if (cached) {
      return cached;
    }

    // Authenticate
    const result = await this.authenticate(
      config.cuit,
      config.certificate,
      config.privateKey,
      service
    );

    if (!result.success || !result.ticket) {
      throw new Error(result.error || 'Authentication failed');
    }

    return result.ticket;
  }

  /**
   * Check if the WSAA service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a simple request to check connectivity
      // Note: We can't actually test authentication without valid credentials
      const parsedUrl = new URL(this.endpoint);

      return new Promise((resolve) => {
        const req = https.request(
          {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname,
            method: 'HEAD',
            timeout: 5000,
          },
          () => resolve(true)
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      });
    } catch {
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let wsaaClient: WSAAClient | null = null;

export function getWSAAClient(environment?: AFIPEnvironment): WSAAClient {
  if (!wsaaClient) {
    const env = environment || (process.env.AFIP_ENVIRONMENT as AFIPEnvironment) || 'homologation';
    wsaaClient = new WSAAClient(env);
  }
  return wsaaClient;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetWSAAClient(): void {
  wsaaClient = null;
}
