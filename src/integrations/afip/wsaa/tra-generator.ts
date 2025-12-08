/**
 * TRA (Ticket de Requerimiento de Acceso) Generator
 * =================================================
 *
 * Generates and signs the TRA XML document required for WSAA authentication.
 * The TRA must be signed with the organization's private key using PKCS#7.
 */

import * as crypto from 'crypto';
import { TRA } from '../afip.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TRA XML GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique ID for the TRA
 */
function generateUniqueId(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format date to ISO 8601 format required by AFIP
 */
function formatDateTime(date: Date): string {
  return date.toISOString().replace('Z', '-03:00'); // Argentina timezone
}

/**
 * Generate TRA XML document
 */
export function generateTRAXml(service: string = 'wsfe'): { xml: string; tra: TRA } {
  const now = new Date();
  const expiration = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const tra: TRA = {
    version: '1.0',
    header: {
      uniqueId: generateUniqueId(),
      generationTime: formatDateTime(now),
      expirationTime: formatDateTime(expiration),
    },
    service,
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${tra.header.uniqueId}</uniqueId>
    <generationTime>${tra.header.generationTime}</generationTime>
    <expirationTime>${tra.header.expirationTime}</expirationTime>
  </header>
  <service>${tra.service}</service>
</loginTicketRequest>`;

  return { xml, tra };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PKCS#7 SIGNING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sign TRA XML with PKCS#7 (CMS) format
 *
 * Note: This implementation uses Node.js crypto module.
 * For production, consider using node-forge for full PKCS#7 support.
 */
export function signTRA(traXml: string, certificate: string, privateKey: string): string {
  // Convert PEM to DER format for certificate
  const certDer = pemToDer(certificate);

  // Create signature using private key
  const sign = crypto.createSign('SHA256');
  sign.update(traXml);
  sign.end();

  const signature = sign.sign(privateKey);

  // Build PKCS#7 SignedData structure
  // This is a simplified implementation - for production use a proper PKCS#7 library
  const pkcs7 = buildPKCS7SignedData(traXml, certDer, signature);

  // Return base64 encoded CMS
  return pkcs7.toString('base64');
}

/**
 * Convert PEM to DER format
 */
function pemToDer(pem: string): Buffer {
  const lines = pem.split('\n');
  const base64 = lines
    .filter(line => !line.startsWith('-----'))
    .join('');
  return Buffer.from(base64, 'base64');
}

/**
 * Build PKCS#7 SignedData structure
 *
 * This is a simplified implementation that creates a basic CMS SignedData structure.
 * For full compliance, use a library like node-forge or pkcs7.
 */
function buildPKCS7SignedData(content: string, certDer: Buffer, signature: Buffer): Buffer {
  // ASN.1 structure for PKCS#7 SignedData
  // OID for signedData: 1.2.840.113549.1.7.2
  const signedDataOid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);

  // OID for data: 1.2.840.113549.1.7.1
  const dataOid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);

  // OID for SHA256: 2.16.840.1.101.3.4.2.1
  const sha256Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);

  // OID for rsaEncryption: 1.2.840.113549.1.1.1
  const rsaOid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);

  const contentBytes = Buffer.from(content, 'utf8');

  // Build the structure (simplified - proper implementation would use ASN.1 library)
  // For now, we'll use a helper approach
  const cms = buildCMSSignedData({
    content: contentBytes,
    certificate: certDer,
    signature,
    digestAlgorithm: sha256Oid,
    signatureAlgorithm: rsaOid,
    contentType: dataOid,
  });

  return cms;
}

interface CMSSignedDataParams {
  content: Buffer;
  certificate: Buffer;
  signature: Buffer;
  digestAlgorithm: Buffer;
  signatureAlgorithm: Buffer;
  contentType: Buffer;
}

/**
 * Build CMS SignedData structure
 */
function buildCMSSignedData(params: CMSSignedDataParams): Buffer {
  const { content, certificate, signature, digestAlgorithm, signatureAlgorithm, contentType } = params;

  // Helper functions for ASN.1 encoding
  const encodeLength = (length: number): Buffer => {
    if (length < 128) {
      return Buffer.from([length]);
    } else if (length < 256) {
      return Buffer.from([0x81, length]);
    } else if (length < 65536) {
      return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
    } else {
      return Buffer.from([0x83, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
    }
  };

  const encodeSequence = (data: Buffer): Buffer => {
    const len = encodeLength(data.length);
    return Buffer.concat([Buffer.from([0x30]), len, data]);
  };

  const encodeSet = (data: Buffer): Buffer => {
    const len = encodeLength(data.length);
    return Buffer.concat([Buffer.from([0x31]), len, data]);
  };

  const encodeOctetString = (data: Buffer): Buffer => {
    const len = encodeLength(data.length);
    return Buffer.concat([Buffer.from([0x04]), len, data]);
  };

  const encodeContextTag = (tag: number, data: Buffer): Buffer => {
    const len = encodeLength(data.length);
    return Buffer.concat([Buffer.from([0xa0 | tag]), len, data]);
  };

  const encodeInteger = (value: number): Buffer => {
    if (value === 1) {
      return Buffer.from([0x02, 0x01, 0x01]);
    }
    const bytes: number[] = [];
    let v = value;
    while (v > 0) {
      bytes.unshift(v & 0xff);
      v >>= 8;
    }
    if (bytes[0] & 0x80) bytes.unshift(0x00);
    return Buffer.concat([Buffer.from([0x02, bytes.length]), Buffer.from(bytes)]);
  };

  // DigestAlgorithmIdentifier
  const digestAlgId = encodeSequence(Buffer.concat([
    digestAlgorithm,
    Buffer.from([0x05, 0x00]), // NULL parameters
  ]));

  // DigestAlgorithms SET
  const digestAlgorithms = encodeSet(digestAlgId);

  // EncapsulatedContentInfo with content
  const encapContent = encodeSequence(Buffer.concat([
    contentType,
    encodeContextTag(0, encodeOctetString(content)),
  ]));

  // Certificates [0] IMPLICIT
  const certificates = encodeContextTag(0, certificate);

  // SignerInfo
  const signerInfo = encodeSequence(Buffer.concat([
    encodeInteger(1), // version
    encodeSequence(Buffer.from([0x30, 0x00, 0x02, 0x01, 0x00])), // issuerAndSerialNumber (placeholder)
    digestAlgId,
    encodeSequence(Buffer.concat([
      signatureAlgorithm,
      Buffer.from([0x05, 0x00]),
    ])),
    encodeOctetString(signature),
  ]));

  // SignerInfos SET
  const signerInfos = encodeSet(signerInfo);

  // SignedData SEQUENCE
  const signedData = encodeSequence(Buffer.concat([
    encodeInteger(1), // version
    digestAlgorithms,
    encapContent,
    certificates,
    signerInfos,
  ]));

  // ContentInfo
  const signedDataOid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
  const contentInfo = encodeSequence(Buffer.concat([
    signedDataOid,
    encodeContextTag(0, signedData),
  ]));

  return contentInfo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API
// ═══════════════════════════════════════════════════════════════════════════════

export interface SignedTRA {
  xml: string;
  cms: string;  // Base64 encoded PKCS#7
  tra: TRA;
}

/**
 * Generate and sign a TRA for the specified service
 */
export function createSignedTRA(
  certificate: string,
  privateKey: string,
  service: string = 'wsfe'
): SignedTRA {
  const { xml, tra } = generateTRAXml(service);
  const cms = signTRA(xml, certificate, privateKey);

  return { xml, cms, tra };
}
