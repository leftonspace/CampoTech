/**
 * WSFEv1 Client
 * =============
 *
 * Client for AFIP's Web Service de Factura Electrónica v1.
 * Handles CAE requests and invoice number queries.
 */

import * as https from 'https';
import { parseStringPromise, Builder } from 'xml2js';
import {
  AFIPEnvironment,
  AFIPConfig,
  AFIP_ENDPOINTS,
  AFIPInvoiceType,
  FECAERequest,
  FECAEResponse,
  FECAEDetResponse,
  UltimoAutorizadoResponse,
  CAEResult,
  AFIPError,
  WSFEAuth,
} from '../afip.types';
import { getWSAAClient } from '../wsaa';
import { parseAFIPDate } from './invoice-builder';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SOAP ENVELOPE BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

const WSFE_NAMESPACE = 'http://ar.gov.afip.dif.FEV1/';

function buildSoapEnvelope(operation: string, body: object): string {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { pretty: false },
  });

  const envelope = {
    'soap:Envelope': {
      $: {
        'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
        'xmlns:ar': WSFE_NAMESPACE,
      },
      'soap:Header': {},
      'soap:Body': {
        [`ar:${operation}`]: body,
      },
    },
  };

  return builder.buildObject(envelope);
}

function buildAuthBody(auth: WSFEAuth): object {
  return {
    'ar:Auth': {
      'ar:Token': auth.Token,
      'ar:Sign': auth.Sign,
      'ar:Cuit': auth.Cuit,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOAP REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

interface SoapResponse {
  statusCode: number;
  body: string;
}

function makeSoapRequest(
  endpoint: string,
  operation: string,
  soapEnvelope: string
): Promise<SoapResponse> {
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
        'SOAPAction': `${WSFE_NAMESPACE}${operation}`,
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
      reject(new Error('WSFE request timeout'));
    });

    req.write(soapEnvelope);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

async function parseSoapResponse<T>(xmlResponse: string, resultName: string): Promise<T> {
  const result = await parseStringPromise(xmlResponse, {
    explicitArray: false,
    ignoreAttrs: true,
  });

  // Navigate through SOAP envelope
  const envelope = result['soap:Envelope'] || result['soapenv:Envelope'] || result.Envelope;
  if (!envelope) {
    throw new Error('Invalid SOAP response: missing envelope');
  }

  const body = envelope['soap:Body'] || envelope['soapenv:Body'] || envelope.Body;
  if (!body) {
    throw new Error('Invalid SOAP response: missing body');
  }

  // Check for SOAP fault
  const fault = body['soap:Fault'] || body['soapenv:Fault'] || body.Fault;
  if (fault) {
    const faultString = fault.faultstring || fault.detail || 'Unknown SOAP fault';
    throw new Error(`WSFE SOAP Fault: ${faultString}`);
  }

  // Get the response element
  const responseElement = body[resultName];
  if (!responseElement) {
    throw new Error(`Invalid WSFE response: missing ${resultName}`);
  }

  // Get the result
  const resultElement = responseElement[`${resultName.replace('Response', 'Result')}`];
  return resultElement || responseElement;
}

function parseErrors(response: any): AFIPError[] {
  const errors: AFIPError[] = [];

  if (response.Errors?.Err) {
    const errArray = Array.isArray(response.Errors.Err)
      ? response.Errors.Err
      : [response.Errors.Err];

    for (const err of errArray) {
      errors.push({
        Code: parseInt(err.Code, 10),
        Msg: err.Msg,
      });
    }
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WSFE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export class WSFEClient {
  private environment: AFIPEnvironment;
  private endpoint: string;

  constructor(environment: AFIPEnvironment = 'homologation') {
    this.environment = environment;
    this.endpoint = AFIP_ENDPOINTS[environment].wsfe;
  }

  /**
   * Get authentication for WSFE
   */
  private async getAuth(config: AFIPConfig): Promise<WSFEAuth> {
    const wsaaClient = getWSAAClient(this.environment);
    const ticket = await wsaaClient.getToken(config, 'wsfe');

    return {
      Token: ticket.token,
      Sign: ticket.sign,
      Cuit: config.cuit,
    };
  }

  /**
   * Get the last authorized invoice number for a punto de venta and invoice type
   */
  async getUltimoAutorizado(
    config: AFIPConfig,
    puntoVenta: number,
    invoiceType: AFIPInvoiceType
  ): Promise<UltimoAutorizadoResponse> {
    log.info('WSFE FECompUltimoAutorizado', { cuit: config.cuit, puntoVenta, invoiceType });

    const auth = await this.getAuth(config);

    const body = {
      ...buildAuthBody(auth),
      'ar:PtoVta': puntoVenta,
      'ar:CbteTipo': invoiceType,
    };

    const envelope = buildSoapEnvelope('FECompUltimoAutorizado', body);
    const response = await makeSoapRequest(this.endpoint, 'FECompUltimoAutorizado', envelope);

    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
    }

    const result = await parseSoapResponse<any>(response.body, 'FECompUltimoAutorizadoResponse');

    const errors = parseErrors(result);
    if (errors.length > 0) {
      throw new Error(`AFIP Error: ${errors[0].Code} - ${errors[0].Msg}`);
    }

    return {
      PtoVta: parseInt(result.PtoVta, 10),
      CbteTipo: parseInt(result.CbteTipo, 10),
      CbteNro: parseInt(result.CbteNro, 10),
    };
  }

  /**
   * Get the next invoice number
   */
  async getNextInvoiceNumber(
    config: AFIPConfig,
    puntoVenta: number,
    invoiceType: AFIPInvoiceType
  ): Promise<number> {
    const ultimo = await this.getUltimoAutorizado(config, puntoVenta, invoiceType);
    return ultimo.CbteNro + 1;
  }

  /**
   * Request CAE for an invoice
   */
  async solicitarCAE(
    config: AFIPConfig,
    request: FECAERequest
  ): Promise<CAEResult> {
    log.info('WSFE FECAESolicitar', {
      cuit: config.cuit,
      puntoVenta: request.FeCAEReq.FeCabReq.PtoVta,
      invoiceType: request.FeCAEReq.FeCabReq.CbteTipo,
      invoiceNumber: request.FeCAEReq.FeDetReq.FECAEDetRequest[0].CbteDesde,
    });

    const auth = await this.getAuth(config);

    // Build the request body
    const detRequest = request.FeCAEReq.FeDetReq.FECAEDetRequest[0];

    const body = {
      ...buildAuthBody(auth),
      'ar:FeCAEReq': {
        'ar:FeCabReq': {
          'ar:CantReg': request.FeCAEReq.FeCabReq.CantReg,
          'ar:PtoVta': request.FeCAEReq.FeCabReq.PtoVta,
          'ar:CbteTipo': request.FeCAEReq.FeCabReq.CbteTipo,
        },
        'ar:FeDetReq': {
          'ar:FECAEDetRequest': {
            'ar:Concepto': detRequest.Concepto,
            'ar:DocTipo': detRequest.DocTipo,
            'ar:DocNro': detRequest.DocNro,
            'ar:CbteDesde': detRequest.CbteDesde,
            'ar:CbteHasta': detRequest.CbteHasta,
            'ar:CbteFch': detRequest.CbteFch,
            'ar:ImpTotal': detRequest.ImpTotal,
            'ar:ImpTotConc': detRequest.ImpTotConc,
            'ar:ImpNeto': detRequest.ImpNeto,
            'ar:ImpOpEx': detRequest.ImpOpEx,
            'ar:ImpIVA': detRequest.ImpIVA,
            'ar:ImpTrib': detRequest.ImpTrib,
            'ar:MonId': detRequest.MonId,
            'ar:MonCotiz': detRequest.MonCotiz,
            ...(detRequest.FchServDesde && { 'ar:FchServDesde': detRequest.FchServDesde }),
            ...(detRequest.FchServHasta && { 'ar:FchServHasta': detRequest.FchServHasta }),
            ...(detRequest.FchVtoPago && { 'ar:FchVtoPago': detRequest.FchVtoPago }),
            ...(detRequest.Iva && detRequest.Iva.length > 0 && {
              'ar:Iva': {
                'ar:AlicIva': detRequest.Iva.map(iva => ({
                  'ar:Id': iva.Id,
                  'ar:BaseImp': iva.BaseImp,
                  'ar:Importe': iva.Importe,
                })),
              },
            }),
          },
        },
      },
    };

    const envelope = buildSoapEnvelope('FECAESolicitar', body);
    const soapResponse = await makeSoapRequest(this.endpoint, 'FECAESolicitar', envelope);

    if (soapResponse.statusCode !== 200) {
      return {
        success: false,
        errors: [{ Code: soapResponse.statusCode, Msg: soapResponse.body }],
      };
    }

    try {
      const result = await parseSoapResponse<any>(soapResponse.body, 'FECAESolicitarResponse');
      return this.parseCAEResponse(result);
    } catch (error) {
      return {
        success: false,
        errors: [{
          Code: 0,
          Msg: error instanceof Error ? error.message : 'Unknown error',
        }],
      };
    }
  }

  /**
   * Parse CAE response
   */
  private parseCAEResponse(result: any): CAEResult {
    const errors = parseErrors(result);

    // Get the detail response
    const feCabResp = result.FeCabResp;
    const feDetResp = result.FeDetResp?.FECAEDetResponse;

    if (!feCabResp || !feDetResp) {
      return {
        success: false,
        errors: errors.length > 0 ? errors : [{ Code: 0, Msg: 'Invalid response structure' }],
      };
    }

    const detResponse: FECAEDetResponse = Array.isArray(feDetResp) ? feDetResp[0] : feDetResp;

    // Check if approved
    const isApproved = detResponse.Resultado === 'A';

    // Parse observations
    const observations = detResponse.Observaciones?.Obs
      ? (Array.isArray(detResponse.Observaciones.Obs)
          ? detResponse.Observaciones.Obs
          : [detResponse.Observaciones.Obs])
        .map((obs: any) => ({ Code: parseInt(obs.Code, 10), Msg: obs.Msg }))
      : [];

    const caeResult: CAEResult = {
      success: isApproved,
      invoiceNumber: parseInt(String(detResponse.CbteDesde), 10),
      processDate: new Date(),
      errors,
      observations,
    };

    if (isApproved && detResponse.CAE && detResponse.CAEFchVto) {
      caeResult.cae = detResponse.CAE;
      caeResult.caeExpiry = parseAFIPDate(detResponse.CAEFchVto);
    }

    log.info('WSFE FECAESolicitar result', {
      success: isApproved,
      invoiceNumber: caeResult.invoiceNumber,
      cae: caeResult.cae,
      errors: errors.map(e => `${e.Code}: ${e.Msg}`),
    });

    return caeResult;
  }

  /**
   * Check server status
   */
  async serverStatus(): Promise<{ appServer: string; dbServer: string; authServer: string }> {
    const envelope = buildSoapEnvelope('FEDummy', {});
    const response = await makeSoapRequest(this.endpoint, 'FEDummy', envelope);

    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}`);
    }

    const result = await parseSoapResponse<any>(response.body, 'FEDummyResponse');

    return {
      appServer: result.AppServer || 'UNKNOWN',
      dbServer: result.DbServer || 'UNKNOWN',
      authServer: result.AuthServer || 'UNKNOWN',
    };
  }

  /**
   * Health check - returns true if service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.serverStatus();
      return status.appServer === 'OK' && status.dbServer === 'OK' && status.authServer === 'OK';
    } catch {
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let wsfeClient: WSFEClient | null = null;

export function getWSFEClient(environment?: AFIPEnvironment): WSFEClient {
  if (!wsfeClient) {
    const env = environment || (process.env.AFIP_ENVIRONMENT as AFIPEnvironment) || 'homologation';
    wsfeClient = new WSFEClient(env);
  }
  return wsfeClient;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetWSFEClient(): void {
  wsfeClient = null;
}
