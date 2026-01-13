import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { parseDateTimeAsArgentina } from '@/lib/timezone';

// This is a PUBLIC endpoint (Rate Limited) for anonymous users to book a service
// Flow: Search -> Click Profile -> "Book Now" -> This API

const bookingSchema = z.object({
    providerId: z.string(), // Organization/Technician ID
    serviceTypeId: z.string(),
    customer: z.object({
        name: z.string(),
        phone: z.string(), // Requires OTP verification in real flow
        email: z.string().email().optional(),
        address: z.string(),
        coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    }),
    scheduledAt: z.string().datetime(), // ISO Date
    notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = bookingSchema.parse(body);

        // 1. Verify Provider Availability (Simplified)
        // In real app: Check `technician_availability` or `calendar` table

        // 2. Create "Lead" / "Pending Job"
        // We don't create a confirmed job immediately. It needs provider acceptance.
        const job = await prisma.job.create({
            data: {
                organizationId: data.providerId,
                status: 'PENDING_APPROVAL', // New status for marketplace requests
                source: 'MARKETPLACE',
                description: data.notes || 'Solicitud desde Marketplace',
                scheduledDate: parseDateTimeAsArgentina(data.scheduledAt.split('T')[0], data.scheduledAt.split('T')[1]?.substring(0, 5)),

                // Customer Info (Either link existing or create loose link)
                customerName: data.customer.name,
                customerPhone: data.customer.phone,
                address: {
                    // Assuming address is a JSON field or related model
                    formatted: data.customer.address,
                    coordinates: data.customer.coordinates
                },

                metadata: {
                    serviceTypeId: data.serviceTypeId,
                    isConsumerBooking: true
                }
            }
        });

        // 3. Notify Provider (Push/WhatsApp/Email)
        // await notifications.sendBookingRequest(data.providerId, job);

        return NextResponse.json({
            success: true,
            data: {
                bookingId: job.id,
                status: 'PENDING_APPROVAL',
                message: 'Tu solicitud fue enviada al profesional. Te avisaremos cuando confirme.',
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
        }
        console.error('Booking API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
