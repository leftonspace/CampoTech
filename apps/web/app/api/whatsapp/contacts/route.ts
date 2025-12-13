/**
 * WhatsApp Contacts API Route
 * ============================
 *
 * Search and manage contacts for WhatsApp messaging.
 * GET: Search contacts from customer database
 * POST: Create/link a new WhatsApp contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET: Search contacts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Search customers with phone numbers
    const customers = await prisma.customer.findMany({
      where: {
        organizationId: session.organizationId,
        NOT: [{ phone: null }, { phone: '' }],
        OR: query
          ? [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
              { email: { contains: query, mode: 'insensitive' } },
            ]
          : undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        waConversations: {
          select: {
            id: true,
            lastMessageAt: true,
            unreadCount: true,
          },
          take: 1,
          orderBy: { lastMessageAt: 'desc' },
        },
      },
      take: limit,
      orderBy: [
        { name: 'asc' },
      ],
    });

    // Format contacts
    const contacts = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      hasConversation: customer.waConversations.length > 0,
      conversationId: customer.waConversations[0]?.id || null,
      lastMessageAt: customer.waConversations[0]?.lastMessageAt || null,
      unreadCount: customer.waConversations[0]?.unreadCount || 0,
    }));

    return NextResponse.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    console.error('WhatsApp contacts search error:', error);
    return NextResponse.json(
      { success: false, error: 'Error searching contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new contact or start a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { phone, name, customerId } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('54') && normalizedPhone.length === 10) {
      normalizedPhone = '54' + normalizedPhone;
    }
    if (normalizedPhone.startsWith('54') && !normalizedPhone.startsWith('549') && normalizedPhone.length === 12) {
      normalizedPhone = '549' + normalizedPhone.slice(2);
    }

    // Check if conversation exists
    let conversation = await prisma.waConversation.findFirst({
      where: {
        organizationId: session.organizationId,
        customerPhone: normalizedPhone,
      },
    });

    // If conversation exists, return it
    if (conversation) {
      return NextResponse.json({
        success: true,
        data: {
          conversationId: conversation.id,
          phone: conversation.customerPhone,
          name: conversation.customerName,
          customerId: conversation.customerId,
          isNew: false,
        },
      });
    }

    // Find or link customer
    let linkedCustomerId = customerId;
    if (!linkedCustomerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          organizationId: session.organizationId,
          phone: { contains: normalizedPhone.slice(-10) },
        },
      });
      linkedCustomerId = customer?.id;
    }

    // Create new conversation
    conversation = await prisma.waConversation.create({
      data: {
        organizationId: session.organizationId,
        customerPhone: normalizedPhone,
        customerName: name || 'Nuevo contacto',
        customerId: linkedCustomerId || null,
        lastMessageAt: new Date(),
        isUnread: false,
        unreadCount: 0,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        phone: conversation.customerPhone,
        name: conversation.customerName,
        customerId: conversation.customerId,
        isNew: true,
      },
    });
  } catch (error) {
    console.error('WhatsApp contacts create error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating contact' },
      { status: 500 }
    );
  }
}
