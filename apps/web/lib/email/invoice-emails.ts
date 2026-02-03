/**
 * CampoTech Invoice Email Templates
 * ==================================
 *
 * Email templates for invoice-related notifications:
 * - Invoice sent to customer (with PDF attachment)
 * - Payment received confirmation
 * - Invoice reminder (overdue)
 */

import { getOrCreateEmailProvider, EmailResult } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  invoiceType: 'A' | 'B' | 'C';
  total: number;
  dueDate: string;
  issueDate: string;
  cae?: string | null;
  caeExpiry?: string | null;
  pdfUrl: string;
  businessName: string;
  businessCuit: string;
  bankInfo: {
    cbu: string;
    alias: string;
  };
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface PaymentConfirmationParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  businessName: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const _APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com';

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL BASE STYLES
// ═══════════════════════════════════════════════════════════════════════════════

function getEmailStyles(): string {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      color: white;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
      color: white;
    }
    .content {
      padding: 30px 20px;
      background: #ffffff;
    }
    .invoice-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      margin: 20px 0;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .invoice-type {
      display: inline-block;
      background: #16a34a;
      color: white;
      font-size: 24px;
      font-weight: bold;
      width: 40px;
      height: 40px;
      line-height: 40px;
      text-align: center;
      border-radius: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-size: 14px;
    }
    .info-value {
      font-weight: 600;
      color: #1e293b;
    }
    .total-row {
      background: #f0fdf4;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
      text-align: center;
    }
    .total-label {
      font-size: 14px;
      color: #16a34a;
      margin-bottom: 4px;
    }
    .total-amount {
      font-size: 28px;
      font-weight: bold;
      color: #16a34a;
    }
    .bank-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .bank-title {
      font-size: 16px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 12px;
    }
    .bank-row {
      display: flex;
      align-items: center;
      padding: 8px 0;
    }
    .bank-label {
      min-width: 60px;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
    }
    .bank-value {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .cae-box {
      background: #fefce8;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      font-size: 13px;
    }
    .cae-label {
      color: #92400e;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin: 20px 0;
      color: white !important;
      background: #16a34a;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .line-items {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }
    .line-items th {
      background: #f1f5f9;
      padding: 10px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .line-items td {
      padding: 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .line-items .amount {
      text-align: right;
      font-weight: 500;
    }
  `;
}

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getEmailStyles()}</style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>Este correo fue enviado automáticamente por CampoTech.</p>
      <p>&copy; ${new Date().getFullYear()} CampoTech - Sistema de Gestión para Servicios de Campo</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString));
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE SENT TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateInvoiceSentHTML(params: InvoiceEmailParams): string {
  const lineItemsTable = params.lineItems?.length
    ? `
    <table class="line-items">
      <thead>
        <tr>
          <th>Descripción</th>
          <th style="width: 60px;">Cant.</th>
          <th style="width: 100px; text-align: right;">Precio</th>
          <th style="width: 100px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${params.lineItems
      .map(
        (item) => `
          <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td class="amount">${formatCurrency(item.unitPrice)}</td>
            <td class="amount">${formatCurrency(item.total)}</td>
          </tr>
        `
      )
      .join('')}
      </tbody>
    </table>
  `
    : '';

  const caeSection = params.cae
    ? `
    <div class="cae-box">
      <span class="cae-label">CAE:</span> ${params.cae}
      ${params.caeExpiry ? ` · <span class="cae-label">Vto CAE:</span> ${params.caeExpiry}` : ''}
    </div>
  `
    : '';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>📄 Factura ${params.invoiceType}</h1>
      <p>${params.invoiceNumber}</p>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${params.customerName}</strong>,</p>
      
      <p>Adjuntamos la factura correspondiente a los servicios prestados por <strong>${params.businessName}</strong>.</p>
      
      <div class="invoice-box">
        <div style="text-align: center; margin-bottom: 16px;">
          <span class="invoice-type">${params.invoiceType}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Número</span>
          <span class="info-value">${params.invoiceNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha de Emisión</span>
          <span class="info-value">${formatDate(params.issueDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Vencimiento</span>
          <span class="info-value">${formatDate(params.dueDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">CUIT Emisor</span>
          <span class="info-value">${params.businessCuit}</span>
        </div>
        
        ${lineItemsTable}
        
        <div class="total-row">
          <div class="total-label">TOTAL A PAGAR</div>
          <div class="total-amount">${formatCurrency(params.total)}</div>
        </div>
      </div>
      
      ${caeSection}
      
      <div class="bank-box">
        <div class="bank-title">💳 Datos para Transferencia</div>
        <div class="bank-row">
          <span class="bank-label">CBU</span>
          <span class="bank-value">${params.bankInfo.cbu}</span>
        </div>
        <div class="bank-row">
          <span class="bank-label">Alias</span>
          <span class="bank-value">${params.bankInfo.alias}</span>
        </div>
      </div>
      
      <p style="text-align: center;">
        <a href="${params.pdfUrl}" class="button">
          📥 Descargar Factura PDF
        </a>
      </p>
      
      <p style="text-align: center; font-size: 13px; color: #64748b;">
        ¿Preguntas sobre esta factura? Contactanos respondiendo a este email.
      </p>
    </div>
  `);
}

function generateInvoiceSentText(params: InvoiceEmailParams): string {
  const lineItemsText = params.lineItems?.length
    ? `
DETALLE:
${params.lineItems.map((item) => `- ${item.description} (x${item.quantity}): ${formatCurrency(item.total)}`).join('\n')}
`
    : '';

  return `
FACTURA ${params.invoiceType} - ${params.invoiceNumber}

Estimado/a ${params.customerName},

Adjuntamos la factura correspondiente a los servicios prestados por ${params.businessName}.

DATOS DE LA FACTURA:
- Número: ${params.invoiceNumber}
- Fecha de Emisión: ${formatDate(params.issueDate)}
- Vencimiento: ${formatDate(params.dueDate)}
- CUIT Emisor: ${params.businessCuit}

${lineItemsText}

TOTAL A PAGAR: ${formatCurrency(params.total)}

${params.cae ? `CAE: ${params.cae}${params.caeExpiry ? ` (Vto: ${params.caeExpiry})` : ''}` : ''}

DATOS PARA TRANSFERENCIA:
- CBU: ${params.bankInfo.cbu}
- Alias: ${params.bankInfo.alias}

Descargar PDF: ${params.pdfUrl}

¿Preguntas sobre esta factura? Contactanos respondiendo a este email.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT CONFIRMATION TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generatePaymentConfirmationHTML(params: PaymentConfirmationParams): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>✓ Pago Recibido</h1>
      <p>¡Gracias por tu pago!</p>
    </div>
    <div class="content">
      <p>Estimado/a <strong>${params.customerName}</strong>,</p>
      
      <p>Confirmamos la recepción de tu pago. Gracias por confiar en <strong>${params.businessName}</strong>.</p>
      
      <div class="invoice-box">
        <div class="info-row">
          <span class="info-label">Factura</span>
          <span class="info-value">${params.invoiceNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha de Pago</span>
          <span class="info-value">${formatDate(params.paymentDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Método</span>
          <span class="info-value">${params.paymentMethod}</span>
        </div>
        
        <div class="total-row">
          <div class="total-label">MONTO PAGADO</div>
          <div class="total-amount">${formatCurrency(params.amountPaid)}</div>
        </div>
      </div>
      
      <p style="text-align: center; font-size: 13px; color: #64748b;">
        Este email sirve como comprobante de pago.
      </p>
    </div>
  `);
}

function generatePaymentConfirmationText(params: PaymentConfirmationParams): string {
  return `
PAGO RECIBIDO

Estimado/a ${params.customerName},

Confirmamos la recepción de tu pago. Gracias por confiar en ${params.businessName}.

DETALLES DEL PAGO:
- Factura: ${params.invoiceNumber}
- Fecha de Pago: ${formatDate(params.paymentDate)}
- Método: ${params.paymentMethod}
- Monto Pagado: ${formatCurrency(params.amountPaid)}

Este email sirve como comprobante de pago.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC SEND FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send invoice email to customer with PDF attachment
 * The PDF is attached via URL - Resend downloads it automatically
 */
export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  // Build attachment if PDF URL is available
  const attachments = params.pdfUrl
    ? [
      {
        filename: `Factura_${params.invoiceNumber.replace(/\//g, '-')}.pdf`,
        path: params.pdfUrl, // Resend will download from this URL
      },
    ]
    : undefined;

  return provider.sendEmail({
    to: params.to,
    subject: `Factura ${params.invoiceType} ${params.invoiceNumber} - ${params.businessName}`,
    html: generateInvoiceSentHTML(params),
    text: generateInvoiceSentText(params),
    attachments,
  });
}

/**
 * Send payment confirmation email to customer
 */
export async function sendPaymentConfirmationEmail(
  params: PaymentConfirmationParams
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: params.to,
    subject: `Pago Recibido - Factura ${params.invoiceNumber}`,
    html: generatePaymentConfirmationHTML(params),
    text: generatePaymentConfirmationText(params),
  });
}
