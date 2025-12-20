/**
 * MercadoPago Payment Instructions API
 * =====================================
 *
 * GET /api/mercadopago/instructions - Get manual payment instructions
 *
 * Query params:
 * - organizationId: Optional (uses session org if not provided)
 * - method: 'transfer' | 'cash' | 'card_present' (default: 'transfer')
 * - format: 'json' | 'whatsapp' | 'email' (default: 'json')
 * - invoiceNumber: Optional invoice reference
 * - amount: Optional payment amount
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMPClient } from '@/lib/integrations/mercadopago';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const organizationId = params.get('organizationId') || session.organizationId;
    const method = (params.get('method') || 'transfer') as
      | 'transfer'
      | 'cash'
      | 'card_present';
    const format = params.get('format') || 'json';
    const invoiceNumber = params.get('invoiceNumber') || undefined;
    const amount = params.get('amount') ? parseFloat(params.get('amount')!) : undefined;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    if (!['transfer', 'cash', 'card_present'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be transfer, cash, or card_present' },
        { status: 400 }
      );
    }

    const client = getMPClient();
    const instructions = await client.getPaymentInstructions(organizationId, method);

    switch (format) {
      case 'whatsapp':
        return NextResponse.json({
          message: client.formatForWhatsApp(instructions, invoiceNumber, amount),
        });

      case 'email': {
        const email = client.formatForEmail(instructions, invoiceNumber, amount);
        return NextResponse.json(email);
      }

      case 'json':
      default:
        return NextResponse.json({
          instructions: {
            method: instructions.method,
            title: instructions.title,
            steps: instructions.instructions,
            bankDetails: instructions.bankDetails || null,
            customerMessage: instructions.customerMessage,
          },
          invoiceNumber,
          amount,
        });
    }
  } catch (error) {
    console.error('[MP Instructions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get instructions' },
      { status: 500 }
    );
  }
}
