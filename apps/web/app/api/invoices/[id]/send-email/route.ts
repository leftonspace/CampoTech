/**
 * Invoice Email Sending API
 * =========================
 * POST /api/invoices/[id]/send-email
 * 
 * Sends the invoice PDF to the customer via email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendInvoiceEmail } from '@/lib/email/invoice-emails';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Fetch invoice with related data
        const invoice = await prisma.invoice.findFirst({
            where: {
                id,
                organizationId: session.organizationId,
            },
            include: {
                job: {
                    include: {
                        customer: true,
                        lineItems: {
                            include: {
                                priceItem: true,
                            },
                        },
                    },
                },
                organization: true,
            },
        });

        if (!invoice) {
            return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
        }

        // Validate customer has email
        const customerEmail = invoice.job?.customer?.email;
        if (!customerEmail) {
            return NextResponse.json(
                { success: false, error: 'El cliente no tiene email registrado' },
                { status: 400 }
            );
        }

        // Validate invoice has PDF URL
        if (!invoice.pdfUrl) {
            return NextResponse.json(
                { success: false, error: 'La factura no tiene PDF generado' },
                { status: 400 }
            );
        }

        // Build line items for email
        interface LineItemData {
            description: string;
            quantity: number;
            unitPrice: number | { toNumber: () => number };
            total: number | { toNumber: () => number };
        }
        const lineItems = (invoice.job?.lineItems as LineItemData[] | undefined)?.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.total),
        })) || [];

        // Get organization bank info (fallback to defaults)
        const bankInfo = {
            cbu: (invoice.organization as { bankCbu?: string })?.bankCbu || 'No configurado',
            alias: (invoice.organization as { bankAlias?: string })?.bankAlias || 'No configurado',
        };

        // Send the email
        const result = await sendInvoiceEmail({
            to: customerEmail,
            customerName: invoice.job?.customer?.name || 'Cliente',
            invoiceNumber: invoice.invoiceNumber,
            invoiceType: (invoice.invoiceType as 'A' | 'B' | 'C') || 'C',
            total: Number(invoice.total),
            dueDate: invoice.dueDate?.toISOString() || invoice.createdAt.toISOString(),
            issueDate: invoice.invoiceDate?.toISOString() || invoice.createdAt.toISOString(),
            cae: invoice.caeNumber,
            caeExpiry: invoice.caeExpiryDate?.toISOString().split('T')[0] || null,
            pdfUrl: invoice.pdfUrl,
            businessName: invoice.organization?.name || 'CampoTech',
            businessCuit: (invoice.organization as { cuit?: string })?.cuit || '',
            bankInfo,
            lineItems,
        });

        if (!result.success) {
            console.error('Email send failed:', result.error);
            return NextResponse.json(
                { success: false, error: 'Error al enviar el email' },
                { status: 500 }
            );
        }

        // Update invoice with email sent timestamp
        await prisma.invoice.update({
            where: { id },
            data: { emailSentAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            data: {
                sentTo: customerEmail,
                sentAt: new Date().toISOString(),
                messageId: result.messageId,
            },
        });
    } catch (error) {
        console.error('Invoice email error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Get email send status for this invoice
        const invoice = await prisma.invoice.findFirst({
            where: {
                id,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                emailSentAt: true,
                job: {
                    select: {
                        customer: {
                            select: {
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!invoice) {
            return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                canSendEmail: !!invoice.job?.customer?.email,
                customerEmail: invoice.job?.customer?.email || null,
                emailSentAt: invoice.emailSentAt?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error('Invoice email status error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
